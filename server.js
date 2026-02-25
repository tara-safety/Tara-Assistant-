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
`Bearer YOUR_OPENAI_KEY`,
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

res.json({
answer:
data.output[0].content[0].text
});

});

app.listen(10000);
