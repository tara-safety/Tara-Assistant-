import express from "express";
import fetch from "node-fetch";
import cors from "cors";

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static("."));

app.post("/ask", async (req, res) => {

try {

const question = req.body.question;

const response = await fetch(
"https://api.openai.com/v1/responses",
{
method: "POST",
headers: {
"Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
"Content-Type": "application/json"
},
body: JSON.stringify({
model: "gpt-5",
input:
"You are T.A.R.A., a towing and recovery safety assistant. Provide clear safety guidance: "
+ question
})
});

const data = await response.json();

console.log("OPENAI RESPONSE:", data);

if (!response.ok) {
return res.json({
answer:
"T.A.R.A. error: " +
(data.error?.message || "Unknown error")
});
}

const answer =
data.output_text ||
"No response returned.";

res.json({ answer });

}
catch (error) {

console.log("SERVER ERROR:", error);

res.json({
answer:
"Server connection error."
});

}

});
