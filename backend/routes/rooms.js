const express = require("express");
const router = express.Router();
const { v4: uuidv4 } = require("uuid");
const { protect } = require("../middleware/auth");

// ─── Create Room ──────────────────────────────────────────────────────────────
router.post("/create", protect, (req, res) => {
  try {
    const { name } = req.body;
    const roomId = uuidv4().slice(0, 8).toUpperCase();

    res.json({
      success: true,
      room: {
        roomId,
        name: name || `${req.user.username}'s Room`,
        createdBy: req.user.username,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── Generate Quick Join ID ────────────────────────────────────────────────────
router.get("/generate", (req, res) => {
  const roomId = uuidv4().slice(0, 8).toUpperCase();
  res.json({ success: true, roomId });
});

module.exports = router;
