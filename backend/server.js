require("dotenv").config();
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const helmet = require("helmet");
const path = require("path");
const mongoose = require("mongoose");
const rateLimit = require("express-rate-limit");

const authRoutes = require("./routes/auth");
const roomRoutes = require("./routes/rooms");
const fileRoutes = require("./routes/files");

const app = express();
const server = http.createServer(app);

// ─── Socket.io Setup ─────────────────────────────────────────────────────────
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

// ─── Security Middleware ──────────────────────────────────────────────────────
app.use(
  helmet({
    contentSecurityPolicy: false, // Allow inline scripts for frontend
  })
);

app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200,
  message: "Too many requests from this IP",
});
app.use("/api/", limiter);

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// ─── Static Files ─────────────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, "../frontend/public")));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// ─── API Routes ───────────────────────────────────────────────────────────────
app.use("/api/auth", authRoutes);
app.use("/api/rooms", roomRoutes);
app.use("/api/files", fileRoutes);

// ─── Serve Frontend Pages ─────────────────────────────────────────────────────
app.get("/", (req, res) =>
  res.sendFile(path.join(__dirname, "../frontend/public/index.html"))
);
app.get("/room/:id", (req, res) =>
  res.sendFile(path.join(__dirname, "../frontend/public/room.html"))
);

// ─── MongoDB ──────────────────────────────────────────────────────────────────
mongoose
  .connect(process.env.MONGODB_URI || "mongodb://localhost:27017/codealpha_rtc")
  .then(() => console.log("✅ MongoDB Connected"))
  .catch((err) => console.log("⚠️  MongoDB Error (demo mode):", err.message));

// ─── In-Memory Room State ─────────────────────────────────────────────────────
const rooms = {}; // { roomId: { users: {socketId: {username, peerId}}, messages: [] } }

// ─── Socket.io — WebRTC Signaling + Real-Time Features ───────────────────────
io.on("connection", (socket) => {
  console.log(`🔌 Connected: ${socket.id}`);

  // ── Join Room ──────────────────────────────────────────────────────────────
  socket.on("join-room", ({ roomId, username, peerId }) => {
    socket.join(roomId);

    if (!rooms[roomId]) {
      rooms[roomId] = { users: {}, messages: [], whiteboardData: [] };
    }

    rooms[roomId].users[socket.id] = { username, peerId, socketId: socket.id };

    // Notify existing users
    socket.to(roomId).emit("user-connected", {
      peerId,
      username,
      socketId: socket.id,
    });

    // Send current users list to new joiner
    socket.emit("room-users", Object.values(rooms[roomId].users));

    // Send existing whiteboard data
    socket.emit("whiteboard-sync", rooms[roomId].whiteboardData);

    // Send recent messages
    socket.emit("chat-history", rooms[roomId].messages.slice(-50));

    io.to(roomId).emit("user-count", Object.keys(rooms[roomId].users).length);

    console.log(
      `👤 ${username} joined room ${roomId} | Users: ${Object.keys(rooms[roomId].users).length}`
    );
  });

  // ── WebRTC Signaling ───────────────────────────────────────────────────────
  socket.on("offer", ({ offer, to }) => {
    socket.to(to).emit("offer", { offer, from: socket.id });
  });

  socket.on("answer", ({ answer, to }) => {
    socket.to(to).emit("answer", { answer, from: socket.id });
  });

  socket.on("ice-candidate", ({ candidate, to }) => {
    socket.to(to).emit("ice-candidate", { candidate, from: socket.id });
  });

  // ── Screen Share Toggle ────────────────────────────────────────────────────
  socket.on("screen-share-started", ({ roomId }) => {
    socket.to(roomId).emit("screen-share-started", { socketId: socket.id });
  });

  socket.on("screen-share-stopped", ({ roomId }) => {
    socket.to(roomId).emit("screen-share-stopped", { socketId: socket.id });
  });

  // ── Chat Messages ──────────────────────────────────────────────────────────
  socket.on("chat-message", ({ roomId, message, username }) => {
    const msg = {
      id: Date.now(),
      username,
      message,
      timestamp: new Date().toISOString(),
    };

    if (rooms[roomId]) {
      rooms[roomId].messages.push(msg);
      // Keep only last 200 messages
      if (rooms[roomId].messages.length > 200) {
        rooms[roomId].messages.shift();
      }
    }

    io.to(roomId).emit("chat-message", msg);
  });

  // ── File Share Notification ────────────────────────────────────────────────
  socket.on("file-shared", ({ roomId, fileInfo, username }) => {
    socket.to(roomId).emit("file-shared", { fileInfo, username });
  });

  // ── Whiteboard Events ──────────────────────────────────────────────────────
  socket.on("whiteboard-draw", ({ roomId, drawData }) => {
    if (rooms[roomId]) {
      rooms[roomId].whiteboardData.push(drawData);
    }
    socket.to(roomId).emit("whiteboard-draw", drawData);
  });

  socket.on("whiteboard-clear", ({ roomId }) => {
    if (rooms[roomId]) {
      rooms[roomId].whiteboardData = [];
    }
    io.to(roomId).emit("whiteboard-clear");
  });

  socket.on("whiteboard-undo", ({ roomId }) => {
    if (rooms[roomId] && rooms[roomId].whiteboardData.length > 0) {
      rooms[roomId].whiteboardData.pop();
    }
    socket.to(roomId).emit("whiteboard-undo");
  });

  // ── Disconnect ─────────────────────────────────────────────────────────────
  socket.on("disconnect", () => {
    for (const roomId in rooms) {
      if (rooms[roomId].users[socket.id]) {
        const user = rooms[roomId].users[socket.id];
        delete rooms[roomId].users[socket.id];

        socket.to(roomId).emit("user-disconnected", {
          socketId: socket.id,
          peerId: user.peerId,
          username: user.username,
        });

        io.to(roomId).emit(
          "user-count",
          Object.keys(rooms[roomId].users).length
        );

        // Clean up empty rooms
        if (Object.keys(rooms[roomId].users).length === 0) {
          delete rooms[roomId];
        }
        console.log(`❌ ${user.username} left room ${roomId}`);
      }
    }
  });
});

// ─── Start Server ─────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 CodeAlpha RTC Server running on http://localhost:${PORT}`);
  console.log(`🔐 Auth: JWT | 🎥 Video: WebRTC | ⚡ Real-time: Socket.io`);
});

module.exports = { app, io };
