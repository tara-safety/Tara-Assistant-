import express from "express";

const app=express();

app.use(express.json());

app.use(express.static("public"));

app.post("/ask",(req,res)=>{

const question=req.body.question||"";

const answer=
"TARA Safety Guidance: Ensure proper tow points, secure vehicle, and maintain situational awareness.";

res.json({answer});

});

app.listen(3000,()=>{
console.log("running");
});
