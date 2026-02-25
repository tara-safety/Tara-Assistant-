const express = require("express");
const fetch = require("node-fetch"); // make sure you have node-fetch installed
const app = express();

app.use(express.json()); // for parsing JSON request bodies

// /ask route
app.post("/ask", async (req, res) => {
  try {
    const question = req.body.question;

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-5",
        input:
          "You are T.A.R.A., the Towing and Recovery Assistant powered by Safety Intelligence. Provide clear, professional towing safety guidance: " +
          question
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

    const answer = data.output_text || "No response returned.";

    res.json({ answer });
  } catch (error) {
    console.log("SERVER ERROR:", error);
    res.json({
      answer: "Server connection error."
    });
  }
});

// Start server
const PORT = process.env.PORT || 10000;
app.listen(PORT, () =>
  console.log("T.A.R.A. running on port " + PORT)
);
