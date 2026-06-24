// ── Room State ─────────────────────────────────────────────────────────────────
const roomId = window.location.pathname.split("/room/")[1];
const userData = JSON.parse(localStorage.getItem("roomUser") || "{}");
const username = userData.username || "Guest" + Math.floor(Math.random() * 1000);
const token = userData.token || null;
const API = window.location.origin;

// Media & WebRTC
let localStream = null;
let screenStream = null;
let micEnabled = true;
let camEnabled = true;
let screenSharing = false;
let peer = null;
let calls = {}; // { peerId: call }
let socket = null;
let peerId = null;

// Whiteboard
let wbCanvas, wbCtx;
let isDrawing = false;
let wbTool = "pen";
let wbHistory = [];
let wbLastX = 0, wbLastY = 0;

// Timer
let callStart = null;
let timerInterval = null;

// ── Init ───────────────────────────────────────────────────────────────────────
window.addEventListener("DOMContentLoaded", async () => {
  if (!roomId) return (window.location.href = "/");

  // Set room ID in header
  document.getElementById("roomIdDisplay").textContent = roomId;
  document.getElementById("selfName").textContent = username;

  // Init whiteboard
  initWhiteboard();

  // Get media
  try {
    localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    document.getElementById("localVideo").srcObject = localStream;
  } catch (err) {
    showToast("⚠️ Could not access camera/mic: " + err.message);
    localStream = new MediaStream(); // Empty stream fallback
  }

  // Start timer
  callStart = Date.now();
  timerInterval = setInterval(updateTimer, 1000);

  // Init PeerJS
  peer = new Peer({
    config: {
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
      ],
    },
  });

  peer.on("open", (id) => {
    peerId = id;
    console.log("PeerJS ID:", id);
    initSocket();
  });

  peer.on("call", (call) => {
    call.answer(localStream);
    call.on("stream", (remoteStream) => {
      addRemoteVideo(call.peer, remoteStream, "Remote User");
    });
    call.on("close", () => removeRemoteVideo(call.peer));
    calls[call.peer] = call;
  });

  peer.on("error", (err) => {
    console.error("PeerJS error:", err);
    showToast("⚠️ Peer connection error: " + err.type);
  });

  // Handle page close
  window.addEventListener("beforeunload", cleanup);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") cleanup();
  });
});

// ── Socket.io ─────────────────────────────────────────────────────────────────
function initSocket() {
  socket = io();

  socket.emit("join-room", { roomId, username, peerId });

  // Someone joined — call them
  socket.on("user-connected", ({ peerId: remotePeerId, username: remoteName }) => {
    showToast(`👋 ${remoteName} joined`);
    addSystemMessage(`${remoteName} joined the room`);
    setTimeout(() => {
      const call = peer.call(remotePeerId, localStream);
      if (!call) return;
      call.on("stream", (remoteStream) => addRemoteVideo(remotePeerId, remoteStream, remoteName));
      call.on("close", () => removeRemoteVideo(remotePeerId));
      calls[remotePeerId] = call;
    }, 1000);
  });

  // Existing users list
  socket.on("room-users", (users) => {
    users.forEach(({ peerId: rPeerId, username: rName }) => {
      if (rPeerId !== peerId) {
        const call = peer.call(rPeerId, localStream);
        if (!call) return;
        call.on("stream", (remoteStream) => addRemoteVideo(rPeerId, remoteStream, rName));
        call.on("close", () => removeRemoteVideo(rPeerId));
        calls[rPeerId] = call;
      }
    });
  });

  // User left
  socket.on("user-disconnected", ({ peerId: rPeerId, username: rName }) => {
    showToast(`❌ ${rName} left`);
    addSystemMessage(`${rName} left the room`);
    removeRemoteVideo(rPeerId);
    if (calls[rPeerId]) {
      calls[rPeerId].close();
      delete calls[rPeerId];
    }
  });

  socket.on("user-count", (count) => {
    document.getElementById("userCount").textContent = count;
  });

  // Chat
  socket.on("chat-message", (msg) => addChatMessage(msg));
  socket.on("chat-history", (messages) => messages.forEach(addChatMessage));

  // File share notification
  socket.on("file-shared", ({ fileInfo, username: sender }) => {
    addFileToList(fileInfo, sender, false);
    addSystemMessage(`📁 ${sender} shared a file: ${fileInfo.originalName}`);
  });

  // Whiteboard
  socket.on("whiteboard-draw", (drawData) => {
    drawOnCanvas(drawData, false);
    wbHistory.push(drawData);
  });
  socket.on("whiteboard-clear", () => {
    wbCtx.clearRect(0, 0, wbCanvas.width, wbCanvas.height);
    wbHistory = [];
  });
  socket.on("whiteboard-undo", () => {
    wbHistory.pop();
    redrawWhiteboard();
  });

  // Whiteboard sync
  socket.on("whiteboard-sync", (data) => {
    wbHistory = data || [];
    redrawWhiteboard();
  });

  // Screen share events
  socket.on("screen-share-started", ({ socketId }) => {
    showToast("🖥 Someone started screen sharing");
  });
  socket.on("screen-share-stopped", ({ socketId }) => {
    showToast("🖥 Screen sharing stopped");
  });
}

// ── Video Management ──────────────────────────────────────────────────────────
function addRemoteVideo(remotePeerId, stream, name) {
  const existing = document.getElementById(`tile-${remotePeerId}`);
  if (existing) {
    existing.querySelector("video").srcObject = stream;
    return;
  }

  const tile = document.createElement("div");
  tile.className = "video-tile";
  tile.id = `tile-${remotePeerId}`;
  tile.innerHTML = `
    <video autoplay playsinline></video>
    <div class="tile-overlay">
      <span class="tile-name">${name || "Remote"}</span>
    </div>
  `;
  tile.querySelector("video").srcObject = stream;
  document.getElementById("videoArea").appendChild(tile);
}

function removeRemoteVideo(remotePeerId) {
  const tile = document.getElementById(`tile-${remotePeerId}`);
  if (tile) tile.remove();
}

// ── Controls ──────────────────────────────────────────────────────────────────
function toggleMic() {
  micEnabled = !micEnabled;
  localStream.getAudioTracks().forEach((t) => (t.enabled = micEnabled));
  const btn = document.getElementById("micBtn");
  btn.classList.toggle("active", micEnabled);
  btn.classList.toggle("inactive", !micEnabled);
  document.getElementById("selfMutedIcon").classList.toggle("hidden", micEnabled);
  showToast(micEnabled ? "🎤 Mic on" : "🔇 Mic muted");
}

function toggleCamera() {
  camEnabled = !camEnabled;
  localStream.getVideoTracks().forEach((t) => (t.enabled = camEnabled));
  const btn = document.getElementById("camBtn");
  btn.classList.toggle("active", camEnabled);
  btn.classList.toggle("inactive", !camEnabled);
  showToast(camEnabled ? "📹 Camera on" : "📵 Camera off");
}

async function toggleScreenShare() {
  if (!screenSharing) {
    try {
      screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: { cursor: "always" },
        audio: true,
      });

      const screenTrack = screenStream.getVideoTracks()[0];

      // Replace video track in all peer connections
      Object.values(calls).forEach((call) => {
        const sender = call.peerConnection
          ?.getSenders()
          ?.find((s) => s.track?.kind === "video");
        if (sender) sender.replaceTrack(screenTrack);
      });

      // Show local screen preview
      document.getElementById("localVideo").srcObject = screenStream;

      screenSharing = true;
      document.getElementById("screenBtn").classList.add("active");
      socket?.emit("screen-share-started", { roomId });
      showToast("🖥 Screen sharing started");

      // Auto stop when user ends share
      screenTrack.onended = stopScreenShare;
    } catch (err) {
      showToast("⚠️ Screen share cancelled or failed");
    }
  } else {
    stopScreenShare();
  }
}

function stopScreenShare() {
  if (!screenSharing) return;
  screenStream?.getTracks().forEach((t) => t.stop());

  // Restore camera
  const videoTrack = localStream.getVideoTracks()[0];
  Object.values(calls).forEach((call) => {
    const sender = call.peerConnection
      ?.getSenders()
      ?.find((s) => s.track?.kind === "video");
    if (sender && videoTrack) sender.replaceTrack(videoTrack);
  });

  document.getElementById("localVideo").srcObject = localStream;
  screenSharing = false;
  document.getElementById("screenBtn").classList.remove("active");
  socket?.emit("screen-share-stopped", { roomId });
  showToast("🖥 Screen sharing stopped");
}

function endCall() {
  cleanup();
  window.location.href = "/";
}

function cleanup() {
  localStream?.getTracks().forEach((t) => t.stop());
  screenStream?.getTracks().forEach((t) => t.stop());
  Object.values(calls).forEach((c) => c.close());
  peer?.destroy();
  socket?.disconnect();
  clearInterval(timerInterval);
}

// ── Chat ──────────────────────────────────────────────────────────────────────
function handleChatKey(e) {
  if (e.key === "Enter") sendMessage();
}

function sendMessage() {
  const input = document.getElementById("chatInput");
  const message = input.value.trim();
  if (!message) return;
  input.value = "";

  socket?.emit("chat-message", { roomId, message, username });
}

function addChatMessage(msg) {
  const area = document.getElementById("messagesArea");
  const time = new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const div = document.createElement("div");
  div.className = "message";
  div.innerHTML = `
    <div class="message-header">
      <span class="message-name">${msg.username}</span>
      <span class="message-time">${time}</span>
    </div>
    <div class="message-body">${escapeHtml(msg.message)}</div>
  `;
  area.appendChild(div);
  area.scrollTop = area.scrollHeight;
}

function addSystemMessage(text) {
  const area = document.getElementById("messagesArea");
  const div = document.createElement("div");
  div.className = "message system";
  div.innerHTML = `<div class="message-body">${text}</div>`;
  area.appendChild(div);
  area.scrollTop = area.scrollHeight;
}

// ── File Sharing ──────────────────────────────────────────────────────────────
async function uploadFile(event) {
  const file = event.target.files[0];
  if (!file) return;
  if (file.size > 25 * 1024 * 1024) return showToast("⚠️ File too large (max 25MB)");

  showToast("📤 Uploading...");

  const formData = new FormData();
  formData.append("file", file);

  try {
    const res = await fetch(`${API}/api/files/upload`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    });
    const data = await res.json();

    if (data.success) {
      addFileToList(data.file, username, true);
      socket?.emit("file-shared", { roomId, fileInfo: data.file, username });
      showToast("✅ File shared!");
    } else {
      // Demo mode: show file name anyway
      addFileToList({ originalName: file.name, size: file.size, url: "#", mimetype: file.type }, username, true);
      socket?.emit("file-shared", { roomId, fileInfo: { originalName: file.name, size: file.size }, username });
    }
  } catch {
    addFileToList({ originalName: file.name, size: file.size, url: "#", mimetype: file.type }, username, true);
    socket?.emit("file-shared", { roomId, fileInfo: { originalName: file.name, size: file.size }, username });
    showToast("✅ File shared (demo)");
  }

  event.target.value = "";
}

function addFileToList(fileInfo, sender, isMine) {
  const list = document.getElementById("filesList");
  const size = fileInfo.size
    ? fileInfo.size < 1024 * 1024
      ? (fileInfo.size / 1024).toFixed(1) + " KB"
      : (fileInfo.size / 1024 / 1024).toFixed(1) + " MB"
    : "";

  const ext = fileInfo.originalName?.split(".").pop()?.toLowerCase();
  const icons = { pdf: "📄", doc: "📝", docx: "📝", xls: "📊", xlsx: "📊", png: "🖼", jpg: "🖼", mp4: "🎬", zip: "🗜", txt: "📃" };
  const icon = icons[ext] || "📁";

  const div = document.createElement("div");
  div.className = "file-item";
  div.innerHTML = `
    <span class="file-icon">${icon}</span>
    <div class="file-info">
      <div class="file-name">${fileInfo.originalName}</div>
      <div class="file-meta">${sender} · ${size}</div>
    </div>
    ${fileInfo.url && fileInfo.url !== "#" ? `<a href="${fileInfo.url}" download class="file-download">⬇ Save</a>` : ""}
  `;
  list.prepend(div);
}

// ── Whiteboard ────────────────────────────────────────────────────────────────
function initWhiteboard() {
  wbCanvas = document.getElementById("whiteboardCanvas");
  wbCtx = wbCanvas.getContext("2d");

  const resizeCanvas = () => {
    const dpr = window.devicePixelRatio || 1;
    const rect = wbCanvas.getBoundingClientRect();
    wbCanvas.width = rect.width * dpr;
    wbCanvas.height = rect.height * dpr;
    wbCtx.scale(dpr, dpr);
    redrawWhiteboard();
  };

  new ResizeObserver(resizeCanvas).observe(wbCanvas);
  setTimeout(resizeCanvas, 100);

  wbCanvas.addEventListener("mousedown", startDraw);
  wbCanvas.addEventListener("mousemove", draw);
  wbCanvas.addEventListener("mouseup", stopDraw);
  wbCanvas.addEventListener("mouseleave", stopDraw);

  // Touch
  wbCanvas.addEventListener("touchstart", (e) => { e.preventDefault(); startDraw(e.touches[0]); });
  wbCanvas.addEventListener("touchmove", (e) => { e.preventDefault(); draw(e.touches[0]); });
  wbCanvas.addEventListener("touchend", stopDraw);
}

function getPos(e) {
  const rect = wbCanvas.getBoundingClientRect();
  return { x: (e.clientX || 0) - rect.left, y: (e.clientY || 0) - rect.top };
}

function startDraw(e) {
  isDrawing = true;
  const pos = getPos(e);
  wbLastX = pos.x;
  wbLastY = pos.y;
}

function draw(e) {
  if (!isDrawing) return;
  const pos = getPos(e);
  const color = wbTool === "eraser" ? "#1a1a24" : document.getElementById("wbColor").value;
  const size = parseInt(document.getElementById("wbSize").value);

  const drawData = {
    fromX: wbLastX, fromY: wbLastY,
    toX: pos.x, toY: pos.y,
    color, size, tool: wbTool,
  };

  drawOnCanvas(drawData, true);
  wbHistory.push(drawData);
  socket?.emit("whiteboard-draw", { roomId, drawData });

  wbLastX = pos.x;
  wbLastY = pos.y;
}

function stopDraw() { isDrawing = false; }

function drawOnCanvas(data, local) {
  wbCtx.beginPath();
  wbCtx.moveTo(data.fromX, data.fromY);
  wbCtx.lineTo(data.toX, data.toY);
  wbCtx.strokeStyle = data.color;
  wbCtx.lineWidth = data.size;
  wbCtx.lineCap = "round";
  wbCtx.lineJoin = "round";
  wbCtx.stroke();
}

function redrawWhiteboard() {
  wbCtx.clearRect(0, 0, wbCanvas.width, wbCanvas.height);
  wbHistory.forEach((d) => drawOnCanvas(d, false));
}

function setWbTool(tool, btn) {
  wbTool = tool;
  document.querySelectorAll(".wb-btn").forEach((b) => b.classList.remove("active"));
  btn.classList.add("active");
}

function clearWhiteboard() {
  if (!confirm("Clear the whiteboard for everyone?")) return;
  wbCtx.clearRect(0, 0, wbCanvas.width, wbCanvas.height);
  wbHistory = [];
  socket?.emit("whiteboard-clear", { roomId });
}

function undoWhiteboard() {
  wbHistory.pop();
  redrawWhiteboard();
  socket?.emit("whiteboard-undo", { roomId });
}

// ── Sidebar Tabs ──────────────────────────────────────────────────────────────
function openTab(name, btn) {
  document.querySelectorAll(".tab-content").forEach((el) => {
    el.classList.remove("active");
    el.classList.add("hidden");
  });
  document.querySelectorAll(".stab").forEach((b) => b.classList.remove("active"));

  document.getElementById(`${name}Tab`).classList.remove("hidden");
  document.getElementById(`${name}Tab`).classList.add("active");
  btn.classList.add("active");
}

function toggleSidebar() {
  document.getElementById("sidebar").classList.toggle("collapsed");
}

// ── Copy Room ID ──────────────────────────────────────────────────────────────
function copyRoomId() {
  navigator.clipboard.writeText(roomId).then(() => showToast("✅ Room ID copied!"));
}

// ── Timer ─────────────────────────────────────────────────────────────────────
function updateTimer() {
  const elapsed = Math.floor((Date.now() - callStart) / 1000);
  const m = String(Math.floor(elapsed / 60)).padStart(2, "0");
  const s = String(elapsed % 60).padStart(2, "0");
  document.getElementById("callTimer").textContent = `${m}:${s}`;
}

// ── Toast ─────────────────────────────────────────────────────────────────────
let toastTimeout = null;
function showToast(msg) {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.classList.remove("hidden");
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => el.classList.add("hidden"), 3000);
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function escapeHtml(str) {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
