// ── State ─────────────────────────────────────────────────────────────────────
let currentUser = null;
const API = window.location.origin;

// ── Init ──────────────────────────────────────────────────────────────────────
window.addEventListener("DOMContentLoaded", async () => {
  const token = localStorage.getItem("token");
  if (token) {
    try {
      const res = await fetch(`${API}/api/auth/verify`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        currentUser = data.user;
        showDashboard();
      } else {
        localStorage.removeItem("token");
      }
    } catch {
      localStorage.removeItem("token");
    }
  }
});

// ── Auth UI ───────────────────────────────────────────────────────────────────
function showAuth(tab = "login") {
  document.getElementById("authModal").classList.remove("hidden");
  switchTab(tab);
}

function closeModal() {
  document.getElementById("authModal").classList.add("hidden");
}

function switchTab(tab) {
  const loginForm = document.getElementById("loginForm");
  const registerForm = document.getElementById("registerForm");
  const loginTab = document.getElementById("loginTab");
  const registerTab = document.getElementById("registerTab");

  if (tab === "login") {
    loginForm.classList.remove("hidden");
    registerForm.classList.add("hidden");
    loginTab.classList.add("active");
    registerTab.classList.remove("active");
  } else {
    loginForm.classList.add("hidden");
    registerForm.classList.remove("hidden");
    loginTab.classList.remove("active");
    registerTab.classList.add("active");
  }
}

// Close modal on overlay click
document.getElementById("authModal").addEventListener("click", (e) => {
  if (e.target === e.currentTarget) closeModal();
});

// ── Register ──────────────────────────────────────────────────────────────────
async function register() {
  const username = document.getElementById("regUsername").value.trim();
  const email = document.getElementById("regEmail").value.trim();
  const password = document.getElementById("regPassword").value;
  const errEl = document.getElementById("registerError");

  errEl.classList.add("hidden");

  if (!username || !email || !password) {
    return showError(errEl, "All fields are required.");
  }

  try {
    const res = await fetch(`${API}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, email, password }),
    });
    const data = await res.json();

    if (!data.success) return showError(errEl, data.message);

    localStorage.setItem("token", data.token);
    currentUser = data.user;
    closeModal();
    showDashboard();
  } catch {
    showError(errEl, "Server error. Please try again.");
  }
}

// ── Login ─────────────────────────────────────────────────────────────────────
async function login() {
  const email = document.getElementById("loginEmail").value.trim();
  const password = document.getElementById("loginPassword").value;
  const errEl = document.getElementById("loginError");

  errEl.classList.add("hidden");

  if (!email || !password) {
    return showError(errEl, "Email and password are required.");
  }

  try {
    const res = await fetch(`${API}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();

    if (!data.success) return showError(errEl, data.message);

    localStorage.setItem("token", data.token);
    currentUser = data.user;
    closeModal();
    showDashboard();
  } catch {
    showError(errEl, "Server error. Please try again.");
  }
}

// ── Logout ────────────────────────────────────────────────────────────────────
function logout() {
  localStorage.removeItem("token");
  currentUser = null;
  document.getElementById("heroSection").classList.remove("hidden");
  document.getElementById("dashboardSection").classList.add("hidden");
  document.getElementById("navAuth").classList.remove("hidden");
  document.getElementById("navUser").classList.add("hidden");
}

// ── Show Dashboard ────────────────────────────────────────────────────────────
function showDashboard() {
  document.getElementById("heroSection").classList.add("hidden");
  document.getElementById("dashboardSection").classList.remove("hidden");
  document.getElementById("navAuth").classList.add("hidden");
  document.getElementById("navUser").classList.remove("hidden");
  document.getElementById("navUsername").textContent = currentUser.username;
  document.getElementById("dashUsername").textContent = currentUser.username;
}

// ── Create Room ───────────────────────────────────────────────────────────────
async function createRoom() {
  const name = document.getElementById("roomNameInput").value.trim();
  const token = localStorage.getItem("token");

  try {
    const res = await fetch(`${API}/api/rooms/create`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ name }),
    });
    const data = await res.json();

    if (data.success) {
      localStorage.setItem(
        "roomUser",
        JSON.stringify({ username: currentUser.username, token })
      );
      window.location.href = `/room/${data.room.roomId}`;
    }
  } catch {
    alert("Failed to create room. Please try again.");
  }
}

// ── Join Room ─────────────────────────────────────────────────────────────────
function joinRoom() {
  const roomId = document.getElementById("joinRoomInput").value.trim().toUpperCase();
  if (!roomId) return alert("Please enter a Room ID.");

  const token = localStorage.getItem("token");
  localStorage.setItem(
    "roomUser",
    JSON.stringify({ username: currentUser.username, token })
  );
  window.location.href = `/room/${roomId}`;
}

// ── Quick Join ────────────────────────────────────────────────────────────────
function quickJoin() {
  document.getElementById("quickModal").classList.remove("hidden");
}

function quickJoinNow() {
  const name = document.getElementById("quickName").value.trim();
  const roomId = document.getElementById("quickRoomId").value.trim().toUpperCase();

  if (!name) return alert("Please enter your name.");
  if (!roomId) return alert("Please enter a Room ID.");

  localStorage.setItem("roomUser", JSON.stringify({ username: name, token: null }));
  window.location.href = `/room/${roomId}`;
}

document.getElementById("quickModal").addEventListener("click", (e) => {
  if (e.target === e.currentTarget)
    e.currentTarget.classList.add("hidden");
});

// Allow Enter key in auth forms
document.addEventListener("keydown", (e) => {
  if (e.key !== "Enter") return;
  if (!document.getElementById("loginForm").classList.contains("hidden")) login();
  else if (!document.getElementById("registerForm").classList.contains("hidden")) register();
});

// ── Helper ────────────────────────────────────────────────────────────────────
function showError(el, msg) {
  el.textContent = msg;
  el.classList.remove("hidden");
}
