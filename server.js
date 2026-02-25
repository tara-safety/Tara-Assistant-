import express from "express";
import fetch from "node-fetch";
import cors from "cors";
import path from "path";

const app = express();

app.use(cors());
app.use(express.json());

app.use(express.static("."));

app.post("/ask", async (req,res)=>{

const question = req.body.question;

const response = await fetch(
"https://api.openai.com/v1/responses",
{
method:"POST",
headers:{
"Authorization":
`Bearer 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`,
"Content-Type":"application/json"
},
body:JSON.stringify({
model:"gpt-5",
input:
"You are T.A.R.A., a professional towing safety assistant. Answer clearly and professionally: "
+ question
})
});

const data = await response.json();

const answer =
data.output_text ||
"Sorry, T.A.R.A. could not generate a response.";

res.json({
answer: answer
});

});

app.listen(10000);
