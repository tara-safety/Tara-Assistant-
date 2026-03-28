import express from "express";
import OpenAI from "openai";
import twilio from "twilio";
import cors from "cors";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import path from "path";
import { fileURLToPath } from "url";
import {
  handleAsk,
  analyzeTowImage,
  insertKnowledge,
  bulkInsertKnowledge,
  backfillEmbeddings
} from "./taraAI.js";

/* =========================================================
   0. PATH + ENV
========================================================= */

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, ".env") });

console.log("ENV CHECK - OPENAI:", !!process.env.OPENAI_API_KEY);

/* =========================================================
   1. APP SETUP
========================================================= */

const app = express();
app.use(cors());
app.use(express.json({ limit: "12mb" }));
app.use(express.static(path.join(__dirname, "public")));

/* =========================================================
   2. HELPERS
========================================================= */

function normalizeMode(value) {
  const mode = String(value || "chat").trim().toLowerCase();
  return mode === "camera" ? "camera" : "chat";
}

function isValidCoordinate(value) {
  const num = Number(value);
  return Number.isFinite(num);
}

function parseBoolean(value, defaultValue = false) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const v = value.trim().toLowerCase();
    if (v === "true") return true;
    if (v === "false") return false;
  }
  if (typeof value === "number") return value !== 0;
  return defaultValue;
}

/* =========================================================
   3. FEATURE FLAGS
========================================================= */

const USE_STORED_KNOWLEDGE = parseBoolean(
  process.env.USE_STORED_KNOWLEDGE,
  true
);
const USE_CHAT_MEMORY = parseBoolean(
  process.env.USE_CHAT_MEMORY,
  true
);
const USE_LEARNING_LOG = parseBoolean(
  process.env.USE_LEARNING_LOG,
  false
);
const ALLOW_KNOWLEDGE_WRITE = parseBoolean(
  process.env.ALLOW_KNOWLEDGE_WRITE,
  false
);
const ALLOW_EMBEDDING_BACKFILL = parseBoolean(
  process.env.ALLOW_EMBEDDING_BACKFILL,
  false
);

console.log("TARA FLAGS:", {
  USE_STORED_KNOWLEDGE,
  USE_CHAT_MEMORY,
  USE_LEARNING_LOG,
  ALLOW_KNOWLEDGE_WRITE,
  ALLOW_EMBEDDING_BACKFILL
});

/* =========================================================
   4. CLIENT SETUP
========================================================= */

let openai = null;

if (process.env.OPENAI_API_KEY) {
  openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
  });
  console.log("OpenAI connected");
} else {
  console.warn("OpenAI not configured");
}

const twilioReady =
  !!process.env.TWILIO_ACCOUNT_SID &&
  !!process.env.TWILIO_AUTH_TOKEN &&
  !!process.env.TWILIO_PHONE_NUMBER &&
  !!process.env.ALERT_PHONE_NUMBER;

let twilioClient = null;

if (twilioReady) {
  twilioClient = twilio(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_AUTH_TOKEN
  );
  console.log("Twilio connected");
} else {
  console.warn("Twilio NOT loaded (missing env variables)");
}

let supabase = null;

if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
  supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
  console.log("Supabase connected");
} else {
  console.warn("Supabase environment variables missing");
}

/* =========================================================
   5. AI ROUTES
========================================================= */

app.post("/ask", async (req, res) => {
  const mode = normalizeMode(req.body?.mode);

  try {
    if (!openai) {
      return res.status(500).json({
        answer: "TARA AI is not configured right now.",
        sourcesUsed: 0,
        modeUsed: mode,
        brain: {
          storedKnowledge: USE_STORED_KNOWLEDGE,
          chatMemory: USE_CHAT_MEMORY,
          learningLog: USE_LEARNING_LOG
        }
      });
    }

    const question = String(req.body?.question || "").trim();
    const proMode = parseBoolean(req.body?.proMode, false);
    const sessionId = String(
      req.body?.sessionId ||
      req.headers["x-session-id"] ||
      req.ip ||
      "default"
    ).trim();

    if (!question) {
      return res.status(400).json({
        answer: "Please enter a question for TARA.",
        sourcesUsed: 0,
        modeUsed: mode,
        brain: {
          storedKnowledge: USE_STORED_KNOWLEDGE,
          chatMemory: USE_CHAT_MEMORY,
          learningLog: USE_LEARNING_LOG
        }
      });
    }

    console.log("ASK REQUEST:", {
      question,
      mode,
      proMode,
      sessionId,
      storedKnowledge: USE_STORED_KNOWLEDGE
    });

    const result = await handleAsk({
      openai,
      supabase,
      question,
      mode,
      proMode,
      sessionId,
      featureFlags: {
        useStoredKnowledge: USE_STORED_KNOWLEDGE,
        useChatMemory: USE_CHAT_MEMORY,
        useLearningLog: USE_LEARNING_LOG
      }
    });

    return res.json({
      ...result,
      modeUsed: result?.modeUsed || mode,
      brain: {
        storedKnowledge: USE_STORED_KNOWLEDGE,
        chatMemory: USE_CHAT_MEMORY,
        learningLog: USE_LEARNING_LOG
      }
    });
  } catch (err) {
    console.error("OpenAI /ask route error:", err?.message || err);

    return res.status(500).json({
      answer: "TARA could not complete that answer right now.",
      sourcesUsed: 0,
      modeUsed: mode,
      error: err?.message || "Unknown /ask error",
      brain: {
        storedKnowledge: USE_STORED_KNOWLEDGE,
        chatMemory: USE_CHAT_MEMORY,
        learningLog: USE_LEARNING_LOG
      }
    });
  }
});

app.post("/tow-ai", async (req, res) => {
  try {
    if (!openai) {
      return res.status(500).json({
        answer: "TARA Vision is not configured right now."
      });
    }

    const result = await analyzeTowImage({
      openai,
      imageDataUrl: req.body?.imageDataUrl
    });

    return res.status(result.status).json(result.body);
  } catch (err) {
    console.error("Tow AI route error:", err);
    return res.status(500).json({
      answer: err.message || "TARA Vision could not analyze this image right now."
    });
  }
});

/* =========================================================
   6. KNOWLEDGE MANAGEMENT ROUTES
========================================================= */

app.post("/knowledge", async (req, res) => {
  try {
    if (!ALLOW_KNOWLEDGE_WRITE) {
      return res.status(403).json({
        error: "Knowledge write is temporarily disabled while TARA brain is being rebuilt."
      });
    }

    if (!openai) {
      return res.status(500).json({
        error: "OpenAI not configured"
      });
    }

    if (!supabase) {
      return res.status(500).json({
        error: "Supabase not configured"
      });
    }

    const result = await insertKnowledge({
      openai,
      supabase,
      content: req.body?.content,
      metadata: req.body?.metadata || {}
    });

    return res.status(result.status).json(result.body);
  } catch (err) {
    console.error("Knowledge route error:", err.message);
    return res.status(500).json({ error: "Failed to create embedding" });
  }
});

app.post("/knowledge/bulk", async (req, res) => {
  try {
    if (!ALLOW_KNOWLEDGE_WRITE) {
      return res.status(403).json({
        error: "Bulk knowledge upload is temporarily disabled while TARA brain is being rebuilt."
      });
    }

    if (!openai) {
      return res.status(500).json({
        error: "OpenAI not configured"
      });
    }

    if (!supabase) {
      return res.status(500).json({
        error: "Supabase not configured"
      });
    }

    const result = await bulkInsertKnowledge({
      openai,
      supabase,
      entries: req.body?.entries
    });

    return res.status(result.status).json(result.body);
  } catch (err) {
    console.error("Bulk knowledge route error:", err.message);
    return res.status(500).json({ error: "Failed to process bulk knowledge" });
  }
});

app.post("/backfill-embeddings", async (req, res) => {
  try {
    if (!ALLOW_EMBEDDING_BACKFILL) {
      return res.status(403).json({
        error: "Embedding backfill is temporarily disabled while TARA brain is being rebuilt."
      });
    }

    if (!openai) {
      return res.status(500).json({
        error: "OpenAI not configured"
      });
    }

    if (!supabase) {
      return res.status(500).json({
        error: "Supabase not configured"
      });
    }

    const result = await backfillEmbeddings({
      openai,
      supabase
    });

    return res.status(result.status).json(result.body);
  } catch (err) {
    console.error("Backfill error:", err.message);
    return res.status(500).json({ error: "Backfill failed" });
  }
});

/* =========================================================
   7. EMERGENCY ALERT ROUTE
========================================================= */

app.post("/emergency", async (req, res) => {
  const lat = req.body?.lat;
  const lon = req.body?.lon;
  const driver = String(req.body?.driver || "Unknown Driver").trim();

  if (!isValidCoordinate(lat) || !isValidCoordinate(lon) || !driver) {
    return res.status(400).json({
      error: "Missing or invalid emergency data"
    });
  }

  if (!twilioClient) {
    return res.status(500).json({
      error: "Emergency messaging is not configured"
    });
  }

  const latitude = Number(lat);
  const longitude = Number(lon);
  const mapLink = `https://maps.google.com/?q=${latitude},${longitude}`;

  const message = `${driver} has sent an EMERGENCY ALERT.

Location:
${mapLink}

Immediate response required.`;

  try {
    await twilioClient.messages.create({
      body: message,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: process.env.ALERT_PHONE_NUMBER
    });

    await twilioClient.calls.create({
      twiml: `<Response><Say voice="alice">Emergency alert from ${driver}. GPS location sent by text.</Say></Response>`,
      to: process.env.ALERT_PHONE_NUMBER,
      from: process.env.TWILIO_PHONE_NUMBER
    });

    if (supabase) {
      const { error } = await supabase.from("alerts").insert([
        {
          driver,
          latitude,
          longitude,
          alert_type: "emergency",
          map_link: mapLink
        }
      ]);

      if (error) {
        console.error("Supabase alert insert error:", error);
      }
    }

    return res.json({
      status: "Emergency alert sent",
      location: mapLink
    });
  } catch (err) {
    console.error("Emergency error:", err);

    return res.status(500).json({
      error: "Emergency system failed"
    });
  }
});

/* =========================================================
   8. ALERT + DRIVER LOCATION ROUTES
========================================================= */

app.get("/alerts", async (req, res) => {
  try {
    if (!supabase) {
      return res.status(500).json({
        error: "Supabase not configured"
      });
    }

    const { data, error } = await supabase
      .from("alerts")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Alerts read error:", error);
      return res.status(500).json({
        error: "Database error"
      });
    }

    return res.json(data || []);
  } catch (err) {
    console.error("Alerts route error:", err);

    return res.status(500).json({
      error: "Server error"
    });
  }
});

app.get("/driver-locations", async (req, res) => {
  try {
    if (!supabase) {
      return res.status(500).json({
        error: "Supabase not configured"
      });
    }

    const { data, error } = await supabase
      .from("alerts")
      .select("driver, latitude, longitude, alert_type, created_at")
      .not("latitude", "is", null)
      .not("longitude", "is", null)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Driver locations read error:", error);
      return res.status(500).json({
        error: "Database error"
      });
    }

    const latestByDriver = [];
    const seenDrivers = new Set();

    for (const row of data || []) {
      const driverName = row.driver || "Unknown Driver";

      if (seenDrivers.has(driverName)) continue;
      seenDrivers.add(driverName);

      latestByDriver.push({
        driver: driverName,
        latitude: Number(row.latitude),
        longitude: Number(row.longitude),
        alert_type: row.alert_type || "status",
        created_at: row.created_at
      });
    }

    return res.json(latestByDriver);
  } catch (err) {
    console.error("Driver locations route error:", err);
    return res.status(500).json({
      error: "Server error"
    });
  }
});

/* =========================================================
   9. HEALTH CHECK
========================================================= */

app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    openai: !!openai,
    supabase: !!supabase,
    twilio: !!twilioClient,
    brain: {
      storedKnowledge: USE_STORED_KNOWLEDGE,
      chatMemory: USE_CHAT_MEMORY,
      learningLog: USE_LEARNING_LOG,
      knowledgeWriteEnabled: ALLOW_KNOWLEDGE_WRITE,
      embeddingBackfillEnabled: ALLOW_EMBEDDING_BACKFILL
    }
  });
});

/* =========================================================
   10. START SERVER
========================================================= */

const PORT = process.env.PORT || 10000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`TARA server running on port ${PORT}`);
});
