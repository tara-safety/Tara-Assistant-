import express from "express";
import path from "path";
import { fileURLToPath } from "url";

const app = express();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.json());

/* serve public folder */
app.use(express.static(path.join(__dirname, "public")));


/* TEST CHAT ENDPOINT */
app.post("/ask", async (req, res) => {

  const question = req.body.question || "";

  const mockAnswer =
    "Ensure vehicle is secured, use manufacturer tow points, and always wear high visibility PPE.";

  res.json({ answer: mockAnswer });

});

         


/* optional homepage safety */
app.get("/", (req, res) => {

    res.sendFile(path.join(__dirname, "public", "index.html"));

});


const PORT = process.env.PORT || 10000;

app.listen(PORT, () => {

    console.log("T.A.R.A running on port " + PORT);

});
