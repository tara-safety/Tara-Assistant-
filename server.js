const express = require("express");
const path = require("path");

const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));


// ✅ THIS IS THE MISSING PART — ADD THIS
app.post("/chat", (req, res) => {

    const message = req.body.message;

    console.log("User said:", message);

    res.json({
        reply: "Safety reminder: Always verify tow points before recovery."
    });

});


const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log("Server running on port " + PORT);
});
