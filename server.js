import express from "express";

const app = express();

app.use(express.json());
app.use(express.static("public"));

app.post("/ask", async (req, res) => {

const question = req.body.question || "";

const mockAnswer =
"T.A.R.A. Safety Guidance:\n\n" +
"Ensure the vehicle is in transport mode, use manufacturer-approved tow points, and never drag EV wheels unless approved.";

res.json({ answer: mockAnswer });

});

const PORT = process.env.PORT || 10000;

app.listen(PORT, () =>
console.log("T.A.R.A. running on port " + PORT)
);
