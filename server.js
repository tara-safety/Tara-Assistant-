import express from "express";
import OpenAI from "openai";
import twilio from "twilio";
import cors from "cors";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import path from "path";
import { fileURLToPath } from "url";

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
   3. TEXT + QUESTION HELPERS
========================================================= */

function cleanText(text = "") {
  return String(text)
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isTowingQuestion(question) {
  const q = cleanText(question);

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
    "unlock",
    "lockout",
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
    "flat tire",
    "spare tire",
    "ev",
    "electric vehicle",
    "tow truck",
    "carrier",
    "vehicle",
    "stuck",
    "snow",
    "ditch pull",
    "tow points",
    "transport mode",
    "tesla",
    "hybrid",
    "12v",
    "charging",
    "dispatcher",
    "dispatch",
    "disabled vehicle",
    "jack",
    "lug nut",
    "dolly",
    "rollback",
    "j-hook",
    "tie down",
    "move over"
  ];

  return keywords.some((word) => q.includes(word));
}

function isLockoutQuestion(question) {
  const q = cleanText(question);
  return (
    q.includes("unlock") ||
    q.includes("lockout") ||
    q.includes("locked keys") ||
    q.includes("keys locked") ||
    q.includes("locked out")
  );
}

function isEVQuestion(question) {
  const q = cleanText(question);
  return (
    q.includes("ev") ||
    q.includes("electric vehicle") ||
    q.includes("tesla") ||
    q.includes("hybrid") ||
    q.includes("plug in") ||
    q.includes("battery electric")
  );
}

function getImportantQuestionTerms(question) {
  return cleanText(question)
    .split(/\s+/)
    .filter(
      (word) =>
        word.length > 3 &&
        ![
          "what",
          "how",
          "when",
          "where",
          "with",
          "from",
          "that",
          "this",
          "into",
          "your",
          "does",
          "have",
          "will",
          "ford",
          "vehicle",
          "about",
          "could",
          "would",
          "should",
          "there",
          "their",
          "them"
        ].includes(word)
    );
}

/* =========================================================
   4. EMBEDDINGS + KNOWLEDGE SEARCH
========================================================= */

async function getEmbedding(text) {
  const response = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: text
  });

  return response.data[0].embedding;
}

async function searchKnowledgeBase(question, matchCount = 5) {
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

function filterKnowledgeMatches(question, matches) {
  if (!Array.isArray(matches) || matches.length === 0) return [];

  const terms = getImportantQuestionTerms(question);

  if (terms.length === 0) {
    return matches.slice(0, 3);
  }

  const filtered = matches.filter((item) => {
    const content = String(item?.content || "").toLowerCase();
    const metadata = JSON.stringify(item?.metadata || {}).toLowerCase();
    const haystack = `${content} ${metadata}`;

    const hitCount = terms.filter((term) => haystack.includes(term)).length;
    return hitCount >= 1;
  });

  return filtered.slice(0, 3);
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

/* =========================================================
   5. RESPONSE PARSING + WEB SOURCES
========================================================= */

function extractResponseText(data) {
  if (typeof data?.output_text === "string" && data.output_text.trim()) {
    return data.output_text.trim();
  }

  if (Array.isArray(data?.output)) {
    const parts = [];

    for (const item of data.output) {
      if (!Array.isArray(item?.content)) continue;

      for (const part of item.content) {
        if (part?.type === "output_text" && typeof part.text === "string") {
          parts.push(part.text);
        }
      }
    }

    const joined = parts.join("\n").trim();
    if (joined) return joined;
  }

  return "";
}

function extractWebSources(data) {
  const sources = [];

  try {
    for (const item of data?.output || []) {
      if (
        item?.type === "web_search_call" &&
        Array.isArray(item?.action?.sources)
      ) {
        for (const src of item.action.sources) {
          if (src?.url) {
            sources.push({
              title: src.title || "Source",
              url: src.url
            });
          }
        }
      }
    }
  } catch (err) {
    console.error("Web source extraction error:", err.message);
  }

  return sources.slice(0, 5);
}

/* =========================================================
   6. LEARNING / SAVE TO KNOWLEDGE BASE
========================================================= */

async function saveLearnedKnowledge(question, answer, metadata = {}) {
  if (!supabase) return;

  try {
    const content = `Question: ${question}\nAnswer: ${answer}`;
    const embedding = await getEmbedding(content);

    const { error } = await supabase.from("knowledge_base").insert([
      {
        content,
        metadata: {
          source_type: "learned_web_answer",
          saved_at: new Date().toISOString(),
          original_question: question,
          ...metadata
        },
        embedding
      }
    ]);

    if (error) {
      console.error("Learned knowledge insert error:", error);
    }
  } catch (err) {
    console.error("saveLearnedKnowledge error:", err.message);
  }
}

/* =========================================================
   7. BUILT-IN SMART ANSWERS
========================================================= */

function getSmartBuiltInAnswer(question) {
  const q = cleanText(question);

  if (isEVQuestion(question) && (q.includes("tow") || q.includes("towing"))) {
    return "Most EVs should be transported on a flatbed because dragging the drive wheels can damage the drivetrain or create system issues. First confirm the exact make, model, drive type, and whether transport mode or tow mode is required before moving it. Do not assume the vehicle will roll freely just because it is powered off, and do not attach to unknown underbody components. If the exact manufacturer procedure is unclear, stop and verify it before towing. Follow company policy and local regulations.";
  }

  if (isLockoutQuestion(question)) {
    return "Start with the least-damaging entry method and make sure the vehicle is secure before touching glass, trim, or seals. Protect the glass, weather stripping, trim, and paint during entry. If the exact method for that vehicle is uncertain, stop and verify before proceeding. Protect the vehicle first and follow company policy and local regulations.";
  }

  if (
    q.includes("ditch") ||
    q.includes("nose first") ||
    q.includes("rear first") ||
    q.includes("stuck in ditch")
  ) {
    return "Start by slowing the whole scene down and checking traffic exposure, shoulder stability, ditch depth, vehicle angle, ground condition, and whether the customer can stay safely inside or must move to a protected area. Stabilize the vehicle first if there is any chance of shifting, sliding, or rolling during hookup. Use the straightest and least-shocking pull possible, and avoid side-loading, sudden jerks, or attachment to weak or unknown components. Before pulling, confirm where the vehicle will travel, what will happen when it reaches the shoulder, and whether a winch-out, wheel-lift assist, dollies, or flatbed load is the safer finish. If the recovery angle, anchor point, or vehicle condition is uncertain, stop and reassess before continuing. Follow company policy and local regulations.";
  }

  if (
    q.includes("winch") ||
    q.includes("winching") ||
    q.includes("pull out")
  ) {
    return "Set up for the straightest pull you can, and reduce side-load on the cable, vehicle, and casualty unit as much as possible. Inspect the scene, ground condition, vehicle condition, and likely travel path before loading the line. Keep people clear of the danger zone, remove slack carefully, and use controlled tension instead of shock loading. If the vehicle may bind, shift, or climb unpredictably, stop and reset the plan before continuing. Follow company policy and local regulations.";
  }

  if (
    q.includes("rollover") ||
    q.includes("on side") ||
    q.includes("upside down")
  ) {
    return "Treat rollover work as a high-risk recovery from the start. Control the scene, check for occupant, fuel, battery, cargo, and stability hazards, and make sure the vehicle is not going to shift unexpectedly during setup. Build the recovery plan before applying force, control the roll path, and avoid rushing the lift or rotation. If stabilization, traffic exposure, or attachment strategy is uncertain, stop and reassess before proceeding. Follow company policy and local regulations.";
  }

  if (
    q.includes("snow") ||
    q.includes("mud") ||
    q.includes("soft shoulder") ||
    q.includes("soft ground")
  ) {
    return "Check traction, sink depth, ground firmness, and whether the casualty vehicle can roll once it starts moving. Use the least aggressive recovery that will work, and avoid spinning tires, digging deeper, or shock loading the vehicle. Keep the pull as straight and controlled as possible, and think through where the vehicle will go once it breaks free. If the ground, angle, or attachment plan is uncertain, stop and reassess before continuing. Follow company policy and local regulations.";
  }

  if (q.includes("flat tire") || q.includes("spare tire")) {
    return "First confirm the vehicle is in a safe location and properly secured before lifting or moving it. Check whether the vehicle has a spare, inflator kit, run-flat tires, or manufacturer restrictions before choosing the next step. On newer vehicles, especially EVs and hybrids, verify approved lifting and jacking points before service. Follow company policy and local regulations.";
  }

  if (
    q.includes("jump start") ||
    q.includes("jump-start") ||
    q.includes("battery")
  ) {
    return "Confirm the vehicle type first, because EVs, hybrids, and newer vehicles can have different low-voltage support procedures than older gas vehicles. Use the correct connection points, protect modules from reverse polarity, and verify whether the issue is a low 12-volt system or a deeper fault before continuing. Follow company policy and local regulations.";
  }

  if (q.includes("tow points") || q.includes("hook points")) {
    return "Do not guess tow points from appearance alone. Confirm approved recovery or tie-down points for that exact vehicle before loading or pulling, and never attach to suspension, steering, battery protection, or unknown underbody parts. Follow company policy and local regulations.";
  }

  return "";
}

function buildFallbackAnswer(question) {
  const builtIn = getSmartBuiltInAnswer(question);

  if (builtIn) {
    return builtIn;
  }

  return "I don’t have a strong answer on that yet. The safest move is to slow down, verify the vehicle details, and confirm the right procedure before continuing. Follow company policy and local regulations.";
}

function shouldUseWebFallback(answer) {
  if (!answer) return true;

  const a = answer.toLowerCase().trim();

  if (a.length < 80) return true;

  const weakPhrases = [
    "i don't have a strong answer",
    "i dont have a strong answer",
    "i'm not sure",
    "i am not sure",
    "not certain",
    "may vary",
    "depends on the model",
    "depends on trim",
    "check the owner",
    "check the manual",
    "not enough information",
    "unclear from the information"
  ];

  return weakPhrases.some((phrase) => a.includes(phrase));
}

/* =========================================================
   8. PROMPTS
========================================================= */

function buildChatPrompt(question, knowledgeContext) {
  return `You are TARA (Tow Awareness and Response Assistant).

You are speaking to a tow operator, dispatcher, roadside tech, or fleet user.

Style:
- sound natural, practical, and human
- do not sound robotic
- do not use a rigid safety template for normal questions
- for simple questions, give a simple direct answer first
- after the direct answer, add the most important caution or verification step if needed

Rules:
- stay focused on towing, roadside, recovery, EV service, dispatch, and vehicle disablement
- use the knowledge context if it is relevant
- if the exact make/model procedure may vary, say what is typical first, then say what should be verified
- do not mention internal source files
- do not mention AAA or CAA
- if the user asks outside your scope, say exactly: Sorry, I can only answer towing and roadside safety questions.

Knowledge base context:
${knowledgeContext}

User question:
${question}`;
}

function buildCameraPrompt(sceneQuestion, knowledgeContext) {
  return `You are TARA Vision, a towing and roadside scene assistant.

How you speak:
- short
- clear
- human
- safety-first
- not robotic

Rules:
- focus on what is visible, what is risky, and what should be verified next
- do not guess exact OEM hook points from limited information
- do not claim hidden areas are safe
- never advise attaching to suspension, steering, or unknown underbody parts
- if information is missing, say so clearly
- use practical field language

Knowledge base context:
${knowledgeContext}

Scene question or scene details:
${sceneQuestion}`;
}

function buildWebSearchPrompt(question, mode, knowledgeContext) {
  return mode === "camera"
    ? buildCameraPrompt(question, knowledgeContext)
    : buildChatPrompt(question, knowledgeContext);
}

/* =========================================================
   9. MAIN AI CHAT ROUTE
========================================================= */

app.post("/ask", async (req, res) => {
  const question = String(req.body.question || "").trim();
  const mode = String(req.body.mode || "chat").trim().toLowerCase();
  const modeUsed = mode === "camera" ? "camera" : "chat";

  if (!question) {
    return res.json({
      answer: "Please enter a towing or roadside safety question.",
      sourcesUsed: 0,
      modeUsed
    });
  }

  if (!isTowingQuestion(question)) {
    return res.json({
      answer: "Sorry, I can only answer towing and roadside safety questions.",
      sourcesUsed: 0,
      modeUsed
    });
  }

  try {
    const rawMatches = await searchKnowledgeBase(question, 5);
    const matches = filterKnowledgeMatches(question, rawMatches);
    const knowledgeContext = formatKnowledgeContext(matches);
    const builtInAnswer = getSmartBuiltInAnswer(question);

    /* ------------------------
       STEP 1: FIRST PASS
    ------------------------- */
    const firstPass = await openai.responses.create({
      model: "gpt-5-mini",
      instructions:
        modeUsed === "camera"
          ? buildCameraPrompt(question, knowledgeContext)
          : buildChatPrompt(question, knowledgeContext),
      input: question,
      max_output_tokens: 350
    });

    let answer = extractResponseText(firstPass).replace(/\n\s+/g, "\n").trim();

    /* ------------------------
       STEP 2: UPGRADE WEAK ANSWERS
    ------------------------- */
    if ((!answer || shouldUseWebFallback(answer)) && builtInAnswer) {
      answer = builtInAnswer;
    }

    /* ------------------------
       STEP 3: WEB FALLBACK
    ------------------------- */
    let webSources = [];

    if (shouldUseWebFallback(answer)) {
      const webResult = await openai.responses.create({
        model: "gpt-5-mini",
        tools: [{ type: "web_search" }],
        include: ["web_search_call.action.sources"],
        instructions: buildWebSearchPrompt(question, modeUsed, knowledgeContext),
        input: question,
        max_output_tokens: 400
      });

      const webAnswer = extractResponseText(webResult).trim();

      if (webAnswer && webAnswer.length > 60) {
        answer = webAnswer;
        webSources = extractWebSources(webResult);

        await saveLearnedKnowledge(question, webAnswer, {
          mode_used: modeUsed,
          web_sources: webSources
        });
      }
    }

    /* ------------------------
       STEP 4: FINAL FALLBACK
    ------------------------- */
    if (!answer) {
      answer = buildFallbackAnswer(question);
    }

    return res.json({
      answer,
      sourcesUsed: matches.length,
      modeUsed,
      webSources
    });
  } catch (err) {
    console.error("OpenAI / ask route error:", err);

    return res.json({
      answer: "TARA could not connect to AI right now.",
      sourcesUsed: 0,
      modeUsed
    });
  }
});

/* =========================================================
   10. TOW AI VISION ROUTE
========================================================= */

app.post("/tow-ai", async (req, res) => {
  try {
    const imageDataUrl = req.body?.imageDataUrl;

    if (!imageDataUrl || typeof imageDataUrl !== "string") {
      return res.status(400).json({
        answer: "No image was uploaded."
      });
    }

    const response = await openai.responses.create({
      model: "gpt-4.1-mini",
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: `You are TARA Vision, a towing and roadside safety scene assistant.

Analyze this towing recovery scene image and give safe, practical, high-level guidance.

Rules:
- Safety comes first
- Do NOT guess exact OEM hook points from one image
- Do NOT claim hidden areas are safe
- Do NOT provide exact dangerous recovery instructions that depend on unseen underbody points
- Separate what is observed from what is inferred
- If information is missing, say so clearly
- Focus on scene type, hazards, likely recovery category, and verification steps
- Never tell the user to attach to suspension, steering, or unknown underbody components
- Mention EV, battery, or structural uncertainty if relevant
- Keep the answer practical, short, and field-usable

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
              image_url: imageDataUrl,
              detail: "low"
            }
          ]
        }
      ],
      max_output_tokens: 450
    });

    const answer = extractResponseText(response);

    if (!answer) {
      return res.json({
        answer:
          "TARA Vision received the image, but the model returned no readable text."
      });
    }

    return res.json({ answer });
  } catch (err) {
    console.error("Tow AI route error:", err);
    return res.status(500).json({
      answer: err.message || "TARA Vision could not analyze this image right now."
    });
  }
});

/* =========================================================
   11. KNOWLEDGE MANAGEMENT ROUTES
========================================================= */

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

/* =========================================================
   12. EMERGENCY ALERT ROUTE
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
   13. ALERT + DRIVER LOCATION ROUTES
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
   14. HEALTH CHECK
========================================================= */

app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    supabase: !!supabase
  });
});

/* =========================================================
   15. START SERVER
========================================================= */

const PORT = process.env.PORT || 3000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`TARA server running on port ${PORT}`);
});
