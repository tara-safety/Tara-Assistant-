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
"Authorization": `Bearer YOUR_OPENAI_KEY`,
"Content-Type": "application/json"
},
body: JSON.stringify({
model: "gpt-5",
input:
"You are T.A.R.A., a professional towing and recovery safety assistant. Provide clear, practical safety guidance: "
+ question
})
});

const data = await response.json();

const answer =
data.output_text ||
"Sorry, T.A.R.A. could not generate a response.";

res.json({ answer });

}
catch (error) {

console.log(error);

res.json({
answer:
"T.A.R.A. encountered an error. Please try again."
});

}

});

app.listen(10000, () =>
console.log("T.A.R.A. running"));
