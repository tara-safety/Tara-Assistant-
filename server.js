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

dotenv.config();

/* =========================================================
   1. APP SETUP
========================================================= */

const app = express();
app.use(cors());
app.use(express.json({ limit: "12mb" }));

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.static(path.join(__dirname, "public")));

/* =========================================================
   2. CLIENT SETUP
========================================================= */

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

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
   3. AI ROUTES
========================================================= */

app.post("/ask", async (req, res) => {
  try {
    const question = String(req.body.question || "").trim();
    const mode = String(req.body.mode || "chat").trim().toLowerCase();
    const proMode = Boolean(req.body.proMode);

    const result = await handleAsk({
      openai,
      supabase,
      question,
      mode,
      proMode
    });

    return res.json(result);
  } catch (err) {
    console.error("OpenAI / ask route error:", err);

    const mode = String(req.body.mode || "chat").trim().toLowerCase();
    const modeUsed = mode === "camera" ? "camera" : "chat";

    return res.json({
      answer: "TARA could not connect to AI right now.",
      sourcesUsed: 0,
      modeUsed
    });
  }
});

app.post("/tow-ai", async (req, res) => {
  try {
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
   4. KNOWLEDGE MANAGEMENT ROUTES
========================================================= */

app.post("/knowledge", async (req, res) => {
  try {
    const result = await insertKnowledge({
      openai,
      supabase,
      content: req.body.content,
      metadata: req.body.metadata || {}
    });

    return res.status(result.status).json(result.body);
  } catch (err) {
    console.error("Knowledge route error:", err.message);
    return res.status(500).json({ error: "Failed to create embedding" });
  }
});

app.post("/knowledge/bulk", async (req, res) => {
  try {
    const result = await bulkInsertKnowledge({
      openai,
      supabase,
      entries: req.body.entries
    });

    return res.status(result.status).json(result.body);
  } catch (err) {
    console.error("Bulk knowledge route error:", err.message);
    return res.status(500).json({ error: "Failed to process bulk knowledge" });
  }
});

app.post("/backfill-embeddings", async (req, res) => {
  try {
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
   5. EMERGENCY ALERT ROUTE
========================================================= */

app.post("/emergency", async (req, res) => {
  const { lat, lon, driver = "Unknown Driver" } = req.body;

  if (!lat || !lon || !driver) {
    return res.status(400).json({
      error: "Missing emergency data"
    });
  }

  const mapLink = `https://maps.google.com/?q=${lat},${lon}`;

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
          latitude: lat,
          longitude: lon,
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
   6. ALERT + DRIVER LOCATION ROUTES
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

    return res.json(data);
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

    for (const row of data) {
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
   7. HEALTH CHECK
========================================================= */

app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    supabase: !!supabase
  });
});

/* =========================================================
   8. START SERVER
========================================================= */

const PORT = process.env.PORT || 3000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`TARA server running on port ${PORT}`);
});
