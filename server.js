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
  console.log("✅ Supabase connected");
} else {
  console.warn("⚠️ Supabase environment variables missing");
}

/* ------------------------
   HELPERS
-------------------------*/

function isTowingQuestion(question) {
  const q = question.toLowerCase();

  const keywords = [
    "tow","towing","recovery","winch","flatbed","wheel lift",
    "strap","chain","roadside","ditch","rollover","highway",
    "battery","jump","lockout","flat tire","ev","vehicle"
  ];

  return keywords.some(word => q.includes(word));
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
      match_count: matchCount,
      match_threshold: 0.45
    });

    if (error) {
      console.error("❌ Knowledge search error:", error);
      return [];
    }

    return data || [];
  } catch (err) {
    console.error("❌ Embedding/search failure:", err.message);
    return [];
  }
}

function formatKnowledgeContext(matches) {
  if (!matches.length) return "No relevant knowledge found.";

  return matches.map((m, i) =>
    `Source ${i + 1}: ${m.content}`
  ).join("\n");
}

/* ------------------------
   AI ROUTE
-------------------------*/

app.post("/ask", async (req, res) => {

  const question = (req.body.question || "").trim();

  if (!question) {
    return res.json({ answer: "Please enter a question." });
  }

  if (!isTowingQuestion(question)) {
    return res.json({
      answer: "Sorry, I can only answer towing and roadside safety questions."
    });
  }

  try {
    const matches = await searchKnowledgeBase(question);
    const context = formatKnowledgeContext(matches);

    const completion = await openai.chat.completions.create({
      model: "gpt-5-mini",
      max_completion_tokens: 500,
      messages: [
        {
          role: "system",
          content: `You are TARA, a professional towing safety assistant.

Rules:
- Max 5 sentences
- Be practical
- Give step-by-step when possible
- Use knowledge base first
- No AAA/CAA references`
        },
        {
          role: "system",
          content: `Knowledge:\n${context}`
        },
        {
          role: "user",
          content: question
        }
      ]
    });

   const answer =
  completion.choices?.[0]?.message?.content?.trim() ||
  "TARA could not generate a response right now.";
    res.json({
      answer,
      sourcesUsed: matches.length
    });

  } catch (err) {
    console.error(err);
    res.json({ answer: "AI error occurred." });
  }

});

/* ------------------------
   ADD KNOWLEDGE
-------------------------*/

app.post("/knowledge", async (req, res) => {

  const { content, metadata = {} } = req.body;

  if (!supabase) {
    return res.status(500).json({ error: "No Supabase" });
  }

  try {
    const embedding = await getEmbedding(content);

    await supabase.from("knowledge_base").insert([
      { content, metadata, embedding }
    ]);

    res.json({ status: "Saved" });

  } catch (err) {
    res.status(500).json({ error: "Failed" });
  }

});

/* ------------------------
   BULK KNOWLEDGE
-------------------------*/

app.post("/knowledge/bulk", async (req, res) => {

  const { entries } = req.body;

  if (!Array.isArray(entries)) {
    return res.status(400).json({ error: "Invalid entries" });
  }

  try {
    const rows = [];

    for (const e of entries) {
      const embedding = await getEmbedding(e.content);

      rows.push({
        content: e.content,
        metadata: e.metadata || {},
        embedding
      });
    }

    await supabase.from("knowledge_base").insert(rows);

    res.json({ status: "Bulk saved", count: rows.length });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Bulk failed" });
  }

});

/* ------------------------
   BACKFILL
-------------------------*/

app.post("/backfill-embeddings", async (req, res) => {

  const { data: rows } = await supabase
    .from("knowledge_base")
    .select("id, content, embedding");

  let updated = 0;

  for (const row of rows) {
    if (row.embedding) continue;

    const embedding = await getEmbedding(row.content);

    await supabase
      .from("knowledge_base")
      .update({ embedding })
      .eq("id", row.id);

    updated++;
  }

  res.json({ updated });

});

/* ------------------------
   EMERGENCY
-------------------------*/

app.post("/emergency", async (req, res) => {

  const { lat, lon, driver = "Driver" } = req.body;

  const link = `https://maps.google.com/?q=${lat},${lon}`;

  try {

    await twilioClient.messages.create({
      body: `EMERGENCY from ${driver}\n${link}`,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: process.env.ALERT_PHONE_NUMBER
    });

    await supabase.from("alerts").insert([
      {
        driver,
        latitude: lat,
        longitude: lon,
        alert_type: "emergency",
        map_link: link
      }
    ]);

    res.json({ status: "sent" });

  } catch (err) {
    res.status(500).json({ error: "failed" });
  }

});

/* ------------------------
   GET ALERTS
-------------------------*/

app.get("/alerts", async (req, res) => {

  const { data } = await supabase
    .from("alerts")
    .select("*")
    .order("created_at", { ascending: false });

  res.json(data);

});

/* ------------------------
   START SERVER
-------------------------*/

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 TARA running on port ${PORT}`);
});
