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
   LOAD KNOWLEDGE BASE
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
   HEALTH CHECK
-------------------------*/

app.get("/", (req, res) => {
  res.send("TARA server running");
});

/* ------------------------
   AI ASSISTANT
-------------------------*/

app.post("/ask", async (req, res) => {

  const question = req.body.question || "";

  function normalize(text) {
    return text.toLowerCase().replace(/[^a-z0-9\s]/g, "").trim();
  }

  const normalizedQuestion = normalize(question);

  const match = knowledge.find(entry =>
    entry.keywords.some(keyword =>
      normalizedQuestion.includes(normalize(keyword))
    )
  );

  if (match) {
    return res.json({ answer: match.answer });
  }

  try {

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are TARA, a professional towing and roadside safety assistant. Only answer towing or roadside related questions. If unrelated say you are restricted to towing assistance."
        },
        {
          role: "user",
          content: question
        }
      ]
    });

    res.json({
      answer: completion.choices[0].message.content
    });

  } catch (err) {

    console.error("AI error:", err);

    res.status(500).json({
      error: "AI request failed"
    });

  }

});

/* ------------------------
   EMERGENCY ALERT
-------------------------*/

app.post("/emergency", async (req, res) => {

  const { lat, lon, driver } = req.body;

  if (!lat || !lon || !driver) {
    return res.status(400).json({
      error: "Missing emergency data"
    });
  }

  const mapLink = `https://maps.google.com/?q=${lat},${lon}`;

  const message =
`${driver} has sent an EMERGENCY ALERT.

Location:
${mapLink}

Immediate response required.`;

  try {

    /* SEND SMS */

    await twilioClient.messages.create({
      body: message,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: process.env.ALERT_PHONE_NUMBER
    });

    /* PLACE CALL */

    await twilioClient.calls.create({
      twiml:
        `<Response><Say voice="alice">Emergency alert from ${driver}. GPS location sent by text.</Say></Response>`,
      to: process.env.ALERT_PHONE_NUMBER,
      from: process.env.TWILIO_PHONE_NUMBER
    });

    /* SAVE ALERT */

    const { error } = await supabase
      .from("alerts")
      .insert([
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

const map = L.map('map').setView([46.1, -64.7], 7);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: 'Map data © OpenStreetMap'
}).addTo(map);

/* ------------------------
   START SERVER
-------------------------*/

const PORT = process.env.PORT || 3000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`TARA server running on port ${PORT}`);
});
