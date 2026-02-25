javascript
import express from "express";
import fetch from "node-fetch";
import cors from "cors";
import  as dotenv from 'dotenv'
dotenv.config()

const app = express();
const PORT = process.env.PORT || 10000;

// Middleware setup
app.use(cors());
app.use(express.json());
app.use(express.static("."));

// Endpoint to handle questions
app.post("/ask", async (req, res) => {
    try {
        const question = req.body.question;

        if (!question) {
            return res.status(400).json({ answer: "Question is required." });
        }

        const openaiResponse = await fetch("https://api.openai.com/v1/completions", {
            method: "POST",
            headers: {
                "Authorization": Bearer ${process.env.OPENAIAPIKEY},
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: "gpt-3.5-turbo-instruct", // More stable and widely available
                prompt: You are T.A.R.A., a towing and recovery safety assistant. Provide clear safety guidance: ${question},
                maxtokens: 150, // Limit response length
                temperature: 0.7, // Adjust creativity
                n: 1, // Number of responses
                stop: null, // Stop sequences
            }),
        });

        const data = await openaiResponse.json();

        console.log("OPENAI RESPONSE:", data);

        if (!openaiResponse.ok) {
            console.error("OpenAI API Error:", data); // Log the error for debugging
            return res.status(500).json({
                answer: T.A.R.A. error: ${data.error?.message || "Unknown error"}
            });
        }

        const answer = data.choices?.[0]?.text?.trim() || "No response returned.";
        res.json({ answer });

    } catch (error) {
        console.error("SERVER ERROR:", error);
        res.status(500).json({ answer: "Server connection error." });
    }
});

// Start the server
app.listen(PORT, () => {
    console.log(T.A.R.A. running on port ${PORT});
});

