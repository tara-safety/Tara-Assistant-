// server.js
import express from "express";
import fetch from "node-fetch";
import fs from "fs";

const app = express();
app.use(express.json());

// Helper: smart JSON logging
function logQA({ question, answer, status = "success", sessionId = null }) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    sessionId,
    question,
    answer,
    status
  };
  fs.appendFile(
    "tara_logs.json",
    JSON.stringify(logEntry) + "\n",
    (err) => {
      if (err) console.error("Logging error:", err);
    }
  );
}

// /ask route
app.post("/ask", async (req, res) => {
  const { question, sessionId } = req.body;

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-5",
        input:
          "You are T.A.R.A., the Towing and Recovery Assistant powered by Safety Intelligence. Provide clear, professional towing safety guidance: " +
          question,
      }),
    });

    const data = await response.json();
    console.log("OPENAI RESPONSE:", data);

    if (!response.ok) {
      const errMsg = data.error?.message || "Unknown error";
      res.json({ answer: "T.A.R.A. error: " + errMsg });
      logQA({ question, answer: errMsg, status: "API error", sessionId });
      return;
    }

    const answer = data.output_text || "No response returned.";
    res.json({ answer });
    logQA({ question, answer, status: "success", sessionId });

  } catch (error) {
    console.error("SERVER ERROR:", error);
    const errMsg = "Server connection error.";
    res.json({ answer: errMsg });
    logQA({ question, answer: errMsg, status: "server error", sessionId });
  }
});

// Start server
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`T.A.R.A. running on port ${PORT}`));
