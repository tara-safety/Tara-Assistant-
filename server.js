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
app.post("/chat", (req, res) => {

    const message = req.body.message;

    console.log("User said:", message);

    res.json({
        reply:
        "T.A.R.A safety guidance: Ensure vehicle is secure, use approved tow points, and follow manufacturer procedures."
    });

});


/* optional homepage safety */
app.get("/", (req, res) => {

    res.sendFile(path.join(__dirname, "public", "index.html"));

});


const PORT = process.env.PORT || 10000;

app.listen(PORT, () => {

    console.log("T.A.R.A running on port " + PORT);

});
