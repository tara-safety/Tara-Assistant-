import express from "express";
import OpenAI from "openai";
import twilio from "twilio";
import fs from "fs";
import cors from "cors";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

/* ------------------------
   APP SETUP
-------------------------*/

const app = express();

app.use(cors());
app.use(express.json());

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.static(path.join(__dirname, "public")));

/* ------------------------
   CLIENT SETUP
-------------------------*/

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

/* ------------------------
   LOAD LOCAL KNOWLEDGE FILE
-------------------------*/

let knowledge = [];

try {
  if (fs.existsSync("./knowledge.json")) {
    const data = fs.readFileSync("./knowledge.json", "utf8");
    knowledge = JSON.parse(data);
  }
} catch (err) {
  console.log("Knowledge base not loaded.");
}

/* ------------------------
   HELPERS
-------------------------*/

function isTowingQuestion(question) {
  const q = question.toLowerCase();

  const towingKeywords = [
    "tow",
    "towing",
    "recovery",
    "winch",
    "flatbed",
    "wheel lift",
    "wheel-lift",
    "hook",
    "strap",
    "chain",
    "tie down",
    "tie-down",
    "roadside",
    "disabled vehicle",
    "ditch",
    "rollover",
    "accident scene",
    "load securement",
    "pylons",
    "cones",
    "traffic",
    "shoulder",
    "highway",
    "jump start",
    "jump-start",
    "battery",
    "lockout",
    "flat tire",
    "spare tire",
    "tow truck",
    "carrier",
    "ev",
    "electric vehicle"
  ];

  return towingKeywords.some((word) => q.includes(word));
}

async function getEmbedding(text) {
  const response = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: text
  });

  return response.data[0].embedding;
}

async function searchKnowledgeBase(question, matchCount = 3) {
  if (!supabase) return [];

  try {
    const queryEmbedding = await getEmbedding(question);

    const { data, error } = await supabase.rpc("match_knowledge_base", {
      query_embedding: queryEmbedding,
      match_count: matchCount
    });

    if (error) {
      console.error("Knowledge search error:", error);
      return [];
    }

    return data || [];
  } catch (err) {
    console.error("Embedding/search failure:", err.message);
    return [];
  }
}

function formatKnowledgeContext(matches) {
  if (!matches || matches.length === 0) {
    return "No database knowledge found.";
  }

  return matches
    .map((item, index) => {
      const metadata = item.metadata ? JSON.stringify(item.metadata) : "{}";
      return `Source ${index + 1}:
Content: ${item.content}
Metadata: ${metadata}`;
    })
    .join("\n\n");
}

/* ------------------------
   AI ASSISTANT
-------------------------*/

app.post("/ask", async (req, res) => {
  const question = (req.body.question || "").trim();

  if (!question) {
    return res.json({
      answer: "Please enter a towing or roadside safety question."
    });
  }

  if (!isTowingQuestion(question)) {
    return res.json({
      answer: "Sorry, I can only answer towing and roadside safety questions."
    });
  }

  try {
    const matches = await searchKnowledgeBase(question, 3);
    const knowledgeContext = formatKnowledgeContext(matches);

    const completion = await openai.chat.completions.create({
      model: "gpt-5-mini",
      reasoning_effort: "low",
      max_completion_tokens: 800,
      messages: [
        {
          role: "system",
          content: `You are TARA (Tow Awareness and Response Assistant).

You assist professional tow truck operators working roadside.

Rules:
• Give short practical answers.
• Maximum 5 sentences.
• Only answer towing or roadside service questions.
• Never recommend calling AAA or CAA.
• If details are missing, provide general safe towing procedures.
• When possible include quick step-by-step instructions.
• Use the supplied knowledge base context first when it is relevant.
• If unrelated say exactly: Sorry, I can only answer towing and roadside safety questions.`
        },
        {
          role: "system",
          content: `Knowledge base context:

${knowledgeContext}`
        },
        {
          role: "user",
          content: question
        }
      ]
    });

    console.log("AI RAW:", completion);

    const answer =
      completion.choices?.[0]?.message?.content ||
      "TARA could not generate a response.";

    res.json({
      answer,
      sourcesUsed: matches.length
    });
  } catch (err) {
    console.error("OpenAI error:", err.message);

    res.json({
      answer: "TARA could not connect to AI right now."
    });
  }
});

/* ------------------------
   ADD KNOWLEDGE ENTRY
-------------------------*/

app.post("/knowledge", async (req, res) => {
  const { content, metadata = {} } = req.body;

  if (!supabase) {
    return res.status(500).json({ error: "Supabase not configured" });
  }

  if (!content || !content.trim()) {
    return res.status(400).json({ error: "Content is required" });
  }

  try {
    const embedding = await getEmbedding(content);

    const { data, error } = await supabase
      .from("knowledge_base")
      .insert([
        {
          content: content.trim(),
          metadata,
          embedding
        }
      ])
      .select();

    if (error) {
      console.error("Knowledge insert error:", error);
      return res.status(500).json({ error: "Failed to save knowledge" });
    }

    res.json({
      status: "Knowledge saved",
      data
    });
  } catch (err) {
    console.error("Knowledge route error:", err.message);
    res.status(500).json({ error: "Failed to create embedding" });
  }
});

/* ------------------------
   BACKFILL EMBEDDINGS
-------------------------*/

app.post("/backfill-embeddings", async (req, res) => {
  if (!supabase) {
    return res.status(500).json({ error: "Supabase not configured" });
  }

  try {
    const { data: rows, error } = await supabase
      .from("knowledge_base")
      .select("id, content, embedding");

    if (error) {
      console.error("Read error:", error);
      return res.status(500).json({ error: "Failed to read knowledge base" });
    }

    let updated = 0;

    for (const row of rows) {
      if (row.embedding) continue;
      if (!row.content) continue;

      const embedding = await getEmbedding(row.content);

      const { error: updateError } = await supabase
        .from("knowledge_base")
        .update({ embedding })
        .eq("id", row.id);

      if (updateError) {
        console.error(`Failed on row ${row.id}:`, updateError);
        continue;
      }

      updated++;
      console.log(`Embedded row ${row.id}`);
    }

    res.json({
      status: "Backfill complete",
      updated
    });
  } catch (err) {
    console.error("Backfill error:", err.message);
    res.status(500).json({ error: "Backfill failed" });
  }
});

/* ------------------------
   EMERGENCY ALERT
-------------------------*/

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
        console.error("Supabase error:", error);
      }
    }

    res.json({
      status: "Emergency alert sent",
      location: mapLink
    });
  } catch (err) {
    console.error("Emergency error:", err);

    res.status(500).json({
      error: "Emergency system failed"
    });
  }
});

/* ------------------------
   DASHBOARD ALERTS
-------------------------*/

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
      console.error(error);
      return res.status(500).json({
        error: "Database error"
      });
    }

    res.json(data);
  } catch (err) {
    console.error(err);

    res.status(500).json({
      error: "Server error"
    });
  }
});

/* ------------------------
   START SERVER
-------------------------*/

const PORT = process.env.PORT || 3000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`TARA server running on port ${PORT}`);
});
