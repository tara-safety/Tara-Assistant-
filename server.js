import express from "express";
import OpenAI from "openai";
import twilio from "twilio";

const app = express();
app.use(express.json());
app.use(express.static("public"));

const openai = new OpenAI({
apiKey: process.env.OPENAI_API_KEY
});

const client = twilio(
process.env.TWILIO_ACCOUNT_SID,
process.env.TWILIO_AUTH_TOKEN
);


/* ---------------------------
   AI TOWING + SAFETY FILTER
----------------------------*/

app.post("/ask", async (req, res) => {

const userQuestion = req.body.question;

const completion = await openai.chat.completions.create({

model: "gpt-4o-mini",

messages: [
{
role: "system",
content:
`You are TARA, a professional towing safety and automotive technical assistant.

ONLY answer questions related to:
- Towing procedures
- Roadside safety
- Vehicle recovery
- Automotive technical locations (battery, jack point, spare tire, tow hooks)
- EV safety
- Incident prevention

If question is unrelated (cooking, sports, random topics), respond:
"I am restricted to towing and roadside safety assistance only."`
},
{
role: "user",
content: userQuestion
}
]

});

res.json({
answer: completion.choices[0].message.content
});

});


/* ---------------------------
   EMERGENCY ALERT ROUTE
----------------------------*/

app.post("/emergency", async (req, res) => {

const { lat, lon, driver } = req.body;

const gpsLink = `https://maps.google.com/?q=${lat},${lon}`;

const message =
`${driver} has sent an EMERGENCY ALERT.

Location:
${gpsLink}

Immediate response required.`;


/* SEND SMS */

await client.messages.create({
body: message,
from: process.env.TWILIO_PHONE_NUMBER,
to: process.env.ALERT_PHONE_NUMBER
});


/* CALL YOU */

await client.calls.create({
twiml: `<Response><Say voice="alice">Emergency alert from ${driver}. Location sent by SMS.</Say></Response>`,
to: process.env.ALERT_PHONE_NUMBER,
from: process.env.TWILIO_PHONE_NUMBER
});


res.json({ status: "Alert sent" });

});


app.listen(10000, () =>
console.log("Server running")
);
