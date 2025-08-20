// Backend Patch for Railway (Express.js)
const express = require("express");
const cors = require("cors");
const multer = require("multer");

const app = express();
app.use(cors());
app.use(express.json());

// Simple /chat endpoint
app.post("/chat", (req, res) => {
  const msg = req.body.message || "";
  let reply = "I don't know that yet.";
  if (msg.toLowerCase().includes("price")) reply = "Our prices start at $19.99.";
  if (msg.toLowerCase().includes("shipping")) reply = "We ship worldwide in 5-7 days.";
  if (msg.toLowerCase().includes("return")) reply = "You can return products within 30 days.";
  res.json({ reply });
});

// Health check
app.get("/health", (req, res) => res.json({ status: "ok" }));

// Mascot upload
const upload = multer({ dest: "uploads/" });
app.post("/mascot/upload", upload.single("mascot"), (req, res) => {
  res.json({ message: "Mascot uploaded!", file: req.file });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Mascot backend running on " + PORT));
