import express from "express";
import OpenAI from "openai";
import twilio from "twilio";
import cors from "cors";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

/* ------------------------
   APP SETUP
------------------------- */

const app = express();
app.use(cors());
app.use(express.json({ limit: "12mb" }));

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.static(path.join(__dirname, "public")));

/* ------------------------
   CLIENT SETUP
------------------------- */

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
   HELPERS
------------------------- */

function isTowingQuestion(question) {
  const q = question.toLowerCase();

  const keywords = [
    "tow",
    "towing",
    "recovery",
    "winch",
    "flatbed",
    "wheel lift",
    "wheel-lift",
    "strap",
    "chain",
    "hook",
    "roadside",
    "ditch",
    "rollover",
    "highway",
    "traffic",
    "pylons",
    "cones",
    "battery",
    "jump start",
    "jump-start",
    "lockout",
    "flat tire",
    "spare tire",
    "ev",
    "electric vehicle",
    "tow truck",
    "carrier",
    "vehicle"
  ];

  return keywords.some((word) => q.includes(word));
}

async function getEmbedding(text) {
  const response = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: text
  });

  return response.data[0].embedding;
}

async function searchKnowledgeBase(question, matchCount = 3) {
  if (!supabase) {
    console.log("Supabase not configured for search");
    return [];
  }

  try {
    const queryEmbedding = await getEmbedding(question);

    const { data, error } = await supabase.rpc("match_knowledge_base", {
      query_embedding: queryEmbedding,
      match_count: matchCount,
      match_threshold: 0.45
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
    return "No relevant knowledge found.";
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

function extractAnswerFromCompletion(completion) {
  const msg = completion?.choices?.[0]?.message;
  if (!msg) return "";

  if (typeof msg.content === "string") {
    return msg.content.trim();
  }

  if (Array.isArray(msg.content)) {
    return msg.content
      .map((part) => {
        if (typeof part === "string") return part;
        if (part?.type === "text" && typeof part.text === "string") return part.text;
        if (typeof part?.content === "string") return part.content;
        return "";
      })
      .join(" ")
      .trim();
  }

  return "";
}

/* ------------------------
   AI ASSISTANT
------------------------- */

app.post("/ask", async (req, res) => {
  const question = (req.body.question || "").trim();

  if (!question) {
    return res.json({
      answer: "Please enter a towing or roadside safety question.",
      sourcesUsed: 0
    });
  }

  if (!isTowingQuestion(question)) {
    return res.json({
      answer: "Sorry, I can only answer towing and roadside safety questions.",
      sourcesUsed: 0
    });
  }

  try {
    const matches = await searchKnowledgeBase(question, 3);
    const knowledgeContext = formatKnowledgeContext(matches);

    const completion = await openai.chat.completions.create({
      model: "gpt-5-mini",
      reasoning_effort: "low",
      max_completion_tokens: 400,
      messages: [
        {
          role: "system",
          content: `You are TARA (Tow Awareness and Response Assistant).

You assist professional tow truck operators in real-world roadside situations.

You must answer using this format:
Immediate Risk: ...
First Action: ...
Safe Procedure: ...
Final Warning: ...

Rules:
- Maximum 5 short sentences total
- Be direct, practical, and professional
- Only answer towing and roadside safety questions
- Use the supplied knowledge base first when relevant
- Do not mention AAA or CAA
- Do not mention source files unless specifically asked
- If the question is unrelated, say exactly: Sorry, I can only answer towing and roadside safety questions.
- Always end with: Follow company policy and local regulations.`
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

    let answer = extractAnswerFromCompletion(completion)
      .replace(/\n\s+/g, "\n")
      .trim();

    if (!answer) {
      answer = matches.length
        ? `TARA found ${matches.length} matching safety sources, but the AI response came back empty. Top match: ${matches[0].content}`
        : "TARA could not generate a response right now.";
    }

    if (!res.headersSent) {
      return res.json({
        answer,
        sourcesUsed: matches.length
      });
    }
  } catch (err) {
    console.error("OpenAI / ask route error:", err);

    return res.json({
      answer: "TARA could not connect to AI right now.",
      sourcesUsed: 0
    });
  }
});

/* ------------------------
   TOW AI VISION (NO INSTALL VERSION)
------------------------- */

app.post("/tow-ai", async (req, res) => {
  try {
    const imageDataUrl = req.body?.imageDataUrl;

    if (!imageDataUrl || typeof imageDataUrl !== "string") {
      return res.status(400).json({
        answer: "No image was uploaded."
      });
    }

    const openaiRes = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: "gpt-5.4",
        input: [
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text: `You are TARA Vision, a towing and roadside safety scene assistant.

Analyze this towing recovery scene image and give SAFE, practical, high-level guidance.

Rules:
- Safety comes first.
- Do NOT guess exact OEM hook points from one image.
- Do NOT claim hidden areas are safe.
- Do NOT provide exact dangerous recovery instructions that depend on unseen underbody points.
- Separate what is observed from what is inferred.
- If information is missing, say so clearly.
- Focus on scene type, hazards, likely recovery category, and verification steps.
- Never tell the user to attach to suspension, steering, or unknown underbody components.
- Mention EV / battery / structural uncertainty if relevant.
- Keep the answer practical, short, and field-usable.

Use this exact structure:

1. What I see
2. Main hazards
3. Likely recovery category
4. Verify before recovery
5. Do not do this
6. Next best question`
              },
              {
                type: "input_image",
                image_url: imageDataUrl
              }
            ]
          }
        ]
      })
    });

    const data = await openaiRes.json();

    if (!openaiRes.ok) {
      console.error("Tow AI OpenAI error:", data);
      return res.status(500).json({
        answer: "TARA Vision could not analyze this image right now."
      });
    }

    const answer =
      data.output_text?.trim() ||
      "TARA Vision could not confidently analyze that image.";

    return res.json({ answer });
  } catch (err) {
    console.error("Tow AI route error:", err);
    return res.status(500).json({
      answer: "TARA Vision could not analyze this image right now."
    });
  }
});

/* ------------------------
   ADD SINGLE KNOWLEDGE ENTRY
------------------------- */

app.post("/knowledge", async (req, res) => {
  const { content, metadata = {} } = req.body;

  if (!supabase) {
    return res.status(500).json({ error: "Supabase not configured" });
  }

  if (!content || !content.trim()) {
    return res.status(400).json({ error: "Content is required" });
  }

  try {
    const embedding = await getEmbedding(content.trim());

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

    return res.json({
      status: "Knowledge saved",
      data
    });
  } catch (err) {
    console.error("Knowledge route error:", err.message);
    return res.status(500).json({ error: "Failed to create embedding" });
  }
});

/* ------------------------
   BULK KNOWLEDGE UPLOAD
------------------------- */

app.post("/knowledge/bulk", async (req, res) => {
  const { entries } = req.body;

  if (!supabase) {
    return res.status(500).json({ error: "Supabase not configured" });
  }

  if (!Array.isArray(entries) || entries.length === 0) {
    return res.status(400).json({ error: "Entries array is required" });
  }

  try {
    const rowsToInsert = [];

    for (const entry of entries) {
      const content = entry?.content?.trim();
      const metadata = entry?.metadata || {};

      if (!content) continue;

      const embedding = await getEmbedding(content);

      rowsToInsert.push({
        content,
        metadata,
        embedding
      });
    }

    if (rowsToInsert.length === 0) {
      return res.status(400).json({ error: "No valid entries to insert" });
    }

    const { data, error } = await supabase
      .from("knowledge_base")
      .insert(rowsToInsert)
      .select();

    if (error) {
      console.error("Bulk insert error:", error);
      return res.status(500).json({ error: "Bulk insert failed" });
    }

    return res.json({
      status: "Bulk knowledge saved",
      inserted: data.length
    });
  } catch (err) {
    console.error("Bulk knowledge route error:", err.message);
    return res.status(500).json({ error: "Failed to process bulk knowledge" });
  }
});

/* ------------------------
   BACKFILL EMBEDDINGS
------------------------- */

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

    return res.json({
      status: "Backfill complete",
      updated
    });
  } catch (err) {
    console.error("Backfill error:", err.message);
    return res.status(500).json({ error: "Backfill failed" });
  }
});

/* ------------------------
   EMERGENCY ALERT
------------------------- */

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

/* ------------------------
   DASHBOARD ALERTS
------------------------- */

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

/* ------------------------
   HEALTH CHECK
------------------------- */

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

/* ------------------------
   START SERVER
------------------------- */

const PORT = process.env.PORT || 3000;

/* ------------------------
   LIVE DRIVER LOCATIONS
------------------------- */

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

app.listen(PORT, "0.0.0.0", () => {
  console.log(`TARA server running on port ${PORT}`);
});
