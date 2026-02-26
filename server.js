const express = require("express");
const path = require("path");

const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

app.post("/chat", (req, res) => {

    const message = req.body.message;

    res.json({
        reply: "TARA received: " + message
    });

});


const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log("Server running on port " + PORT);
});
