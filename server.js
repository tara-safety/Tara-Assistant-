import express from "express";
import OpenAI from "openai";
import twilio from "twilio";
import fs from "fs";
import { createClient } from "@supabase/supabase-js";
import { processMotionEvent, cancelIncident } from "./services/detectionEngine.js";

/* ------------------------
   APP SETUP
-------------------------*/

const app = express();
app.use(express.json());
app.use(express.static("public"));

/* ------------------------
   ENVIRONMENT CLIENTS
-------------------------*/

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
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

  try {

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

If unrelated respond:
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

  } catch (err) {
    console.error("AI error:", err);
    res.status(500).json({ error: "AI request failed" });
  }

});

/* ------------------------
   EMERGENCY ROUTE
-------------------------*/

app.post("/emergency", async (req, res) => {

  const { lat, lon, driver } = req.body;

  if (!lat || !lon || !driver) {
    return res.status(400).json({ error: "Missing emergency data" });
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
      twiml: `<Response><Say voice="alice">Emergency alert from ${driver}. GPS location has been sent by text message.</Say></Response>`,
      to: process.env.ALERT_PHONE_NUMBER,
      from: process.env.TWILIO_PHONE_NUMBER
    });

    /* LOG INCIDENT */

     console.log("Sending to Supabase:", driver, lat, lon);
    const { error } = await supabase
      .from("alerts")
      .insert([
        {
          driver: driver,
          latitude: lat,
          longitude: lon,
          alert_type: "emergency",
          map_link: mapLink
        }
      ]);

    if (error) {
      console.error("Supabase error:", error);
    }

    console.log("🚨 Emergency logged:", driver, lat, lon);

    res.json({
      status: "Emergency Alert Sent",
      location: mapLink
    });

  } catch (err) {

    console.error("Emergency failure:", err);

    res.status(500).json({
      error: "Emergency system failed"
    });

  }

});

/* ------------------------
   MOTION EVENT ROUTE
-------------------------*/

app.post("/motion-event", async (req, res) => {

  const result = processMotionEvent(req.body, async (incident) => {

    console.log("🚨 INCIDENT ESCALATED:", incident);

    await twilioClient.messages.create({
      body: `Driver ${incident.user_id} impact detected at ${incident.gps}`,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: process.env.ALERT_PHONE_NUMBER
    });

  });

  res.json(result);

});

/* ------------------------
   CANCEL INCIDENT
-------------------------*/

app.post("/cancel-incident", (req, res) => {

  const { incidentId } = req.body;
  const cancelled = cancelIncident(incidentId);

  res.json({ cancelled });

});

/* ------------------------
   SIMULATION TEST
-------------------------*/

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
      from: process.env.TWILIO_PHONE_NUMBER,
      to: process.env.ALERT_PHONE_NUMBER
    });

  });

  res.json(result);

});

/* ------------------------
   START SERVER
-------------------------*/

const PORT = process.env.PORT;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`TARA server running on port ${PORT}`);
});

/* ------------------------
   GET ALERTS FOR DASHBOARD
-------------------------*/

app.get("/alerts", async (req, res) => {

  try {

    const { data, error } = await supabase
      .from("alerts")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Supabase read error:", error);
      return res.status(500).json({ error: "Database read failed" });
    }

    res.json(data);

  } catch (err) {

    console.error("Alerts route failure:", err);

    res.status(500).json({
      error: "Server error"
    });

  }

});
