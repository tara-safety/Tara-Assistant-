import express from "express";
import OpenAI from "openai";

const app = express();

app.use(express.json());
app.use(express.static("public"));

const openai =
new OpenAI({
apiKey: process.env.OPENAI_API_KEY
});


app.post("/ask", async (req,res)=>{

const question =
req.body.question;


try{

const completion =
await openai.chat.completions.create({

model:"gpt-4o-mini",

messages:[

{
role:"system",
content:
"You are TARA, a towing and recovery safety AI. Only answer towing, recovery, vehicle safety, and technical vehicle questions. If unrelated, reply: 'This system is restricted to towing and vehicle safety.'"
},

{
role:"user",
content:question
}

],

max_tokens:200

});


res.json({
answer:
completion.choices[0].message.content
});

}
catch(e){

res.json({
answer:"AI error"
});

}

});


app.listen(
process.env.PORT || 10000,
()=> console.log("Server running")
);
