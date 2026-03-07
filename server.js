import express from "express";
import OpenAI from "openai";
import twilio from "twilio";
import fs from "fs";
import { processMotionEvent, cancelIncident } from "./services/detectionEngine.js";

const app = express();
app.use(express.json());
app.use(express.static("public"));

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);
/* ------------------------
   ENVIRONMENT
-------------------------*/

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

/* ------------------------
   LOAD KNOWLEDGE BASE
-------------------------*/

let knowledge = [];

try {
  const data = fs.readFileSync("./knowledge.json");
  knowledge = JSON.parse(data);
} catch (err) {
  console.log("No knowledge file yet.");
}

/* ------------------------
   AI ROUTE
-------------------------*/

app.post("/ask", async (req, res) => {

  const question = req.body.question || "";

  function normalize(text) {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, "")
      .trim();
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

  // If not found, use AI

  // If not found, use AI (restricted)
  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: `
You are TARA, a professional towing, roadside safety, and automotive technical assistant.

ONLY answer:
- Towing procedures
- Recovery methods
- Roadside operator safety
- EV safety
- Battery location
- Jack points
- Tow hooks
- Vehicle technical positioning
- Hook equipment 
- Lift equipment
- Vehicle situations 
- Call types
- Vehicle battery
- Vehicle starting
- Vehicle electrical
- Vehicle lockouts 
- Vehicle key fob
- EV specific
- Hybrid specific
- Risk including safety
- Towing equipment

If unrelated, respond:
"I am restricted to towing and roadside safety assistance only."
`
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

});

/* ------------------------
   EMERGENCY ROUTE
-------------------------*/

app.post("/emergency", async (req, res) => {

  const { lat, lon, driver } = req.body;

  const mapLink = `https://maps.google.com/?q=${lat},${lon}`;

  const message =
`${driver} has sent an EMERGENCY ALERT.

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
      twiml: `<Response><Say voice="alice">Emergency alert from ${driver}. GPS location sent by SMS.</Say></Response>`,
      to: process.env.ALERT_PHONE_NUMBER,
      from: process.env.TWILIO_PHONE_NUMBER
    });

    res.json({ status: "Alert Sent" });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Emergency failed" });
  }

});

app.listen(10000, () => {
  console.log("TARA server running");
});

app.post("/motion-event", async (req, res) => {
  const result = processMotionEvent(req.body, async (incident) => {
    
    console.log("🚨 INCIDENT ESCALATED:", incident);

    // Twilio alert example
    await twilioClient.messages.create({
      body: `Driver ${incident.user_id} impact detected at ${incident.gps}`,
      from: process.env.TWILIO_PHONE,
      to: process.env.ALERT_PHONE
    });

  });

  res.json(result);
});

app.post("/cancel-incident", (req, res) => {
  const { incidentId } = req.body;
  const cancelled = cancelIncident(incidentId);

  res.json({ cancelled });
});

app.get("/simulate-impact", async (req, res) => {

  const fakeEvent = {
    user_id: "Driver-00",
    acceleration: 8.2,
    impact_flag: true,
    gps: "46.123,-64.456"
  };

  const result = processMotionEvent(fakeEvent, async (incident) => {

    await twilioClient.messages.create({
      body: `SIMULATED ALERT: ${incident.user_id} impact at ${incident.gps}`,
      from: process.env.TWILIO_PHONE,
      to: process.env.ALERT_PHONE
    });

  });

  res.json(result);
});
