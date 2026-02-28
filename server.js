import express from "express";

const app = express();

app.use(express.json());
app.use(express.static("public"));


app.post("/ask", async (req,res)=>{

try{

const question=req.body.question;


const response=await fetch(
"https://api.openai.com/v1/responses",
{
method:"POST",

headers:{
"Authorization":`Bearer ${process.env.OPENAI_API_KEY}`,
"Content-Type":"application/json"
},

body:JSON.stringify({

model:"gpt-5-mini",

input:
"You are T.A.R.A., the Towing and Recovery Assistant powered by Safety Intelligence. "+
"Provide clear, accurate, professional towing and recovery safety guidance. "+
"Focus on EV towing, hook points, recovery procedures, technician safety, and damage prevention. "+
"Keep answers practical and concise. Question: "+question

})
}
);


const data=await response.json();


const answer =
data.output_text ||
"T.A.R.A, Troy you are doing good, keep building me and testing.";


res.json({answer});


}
catch(error){

console.log(error);

res.json({
answer:"Connection to Safety Intelligence failed."
});

}

});


const PORT=process.env.PORT||10000;

app.listen(PORT,()=>{

console.log("T.A.R.A Commercial Server running on port "+PORT);

});
