const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");

// In-memory user store (fallback if MongoDB is not connected)
const inMemoryUsers = {};

let User;
try {
  User = require("../models/User");
} catch (e) {
  User = null;
}

const generateToken = (userId, username) => {
  return jwt.sign(
    { id: userId, username },
    process.env.JWT_SECRET || "codealpha_secret_key",
    { expiresIn: process.env.JWT_EXPIRE || "7d" }
  );
};

// ─── Register ─────────────────────────────────────────────────────────────────
router.post("/register", async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ success: false, message: "All fields are required." });
    }

    if (password.length < 6) {
      return res.status(400).json({ success: false, message: "Password must be at least 6 characters." });
    }

    // Try MongoDB first
    if (User) {
      const existingUser = await User.findOne({ $or: [{ email }, { username }] });
      if (existingUser) {
        return res.status(400).json({ success: false, message: "Username or email already exists." });
      }

      const user = await User.create({ username, email, password });
      const token = generateToken(user._id, user.username);

      return res.status(201).json({
        success: true,
        message: "Account created successfully!",
        token,
        user: { id: user._id, username: user.username, email: user.email },
      });
    }

    // Fallback: in-memory
    if (inMemoryUsers[email] || Object.values(inMemoryUsers).find((u) => u.username === username)) {
      return res.status(400).json({ success: false, message: "Username or email already exists." });
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const userId = Date.now().toString();
    inMemoryUsers[email] = { id: userId, username, email, password: hashedPassword };

    const token = generateToken(userId, username);
    res.status(201).json({
      success: true,
      message: "Account created successfully!",
      token,
      user: { id: userId, username, email },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── Login ────────────────────────────────────────────────────────────────────
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: "Email and password are required." });
    }

    // Try MongoDB first
    if (User) {
      const user = await User.findOne({ email }).select("+password");
      if (!user || !(await user.comparePassword(password))) {
        return res.status(401).json({ success: false, message: "Invalid email or password." });
      }

      const token = generateToken(user._id, user.username);
      return res.json({
        success: true,
        message: "Login successful!",
        token,
        user: { id: user._id, username: user.username, email: user.email },
      });
    }

    // Fallback: in-memory
    const user = inMemoryUsers[email];
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ success: false, message: "Invalid email or password." });
    }

    const token = generateToken(user.id, user.username);
    res.json({
      success: true,
      message: "Login successful!",
      token,
      user: { id: user.id, username: user.username, email: user.email },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── Verify Token ─────────────────────────────────────────────────────────────
router.get("/verify", (req, res) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ success: false });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "codealpha_secret_key");
    res.json({ success: true, user: decoded });
  } catch {
    res.status(401).json({ success: false });
  }
});

module.exports = router;
