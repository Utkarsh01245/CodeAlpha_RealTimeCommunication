# ConnectX — Real-Time Communication App
### CodeAlpha Full Stack Internship — Task 4

A full-featured video conferencing and collaboration platform built with WebRTC, Socket.io, Node.js, and Express.

---

## ✅ Features Implemented (All Task 4 Requirements)

| Feature | Status | Technology |
|---|---|---|
| Multi-user Video Calling | ✅ | WebRTC + PeerJS |
| Screen Sharing | ✅ | `getDisplayMedia()` API |
| File Sharing (25MB) | ✅ | Multer + Socket.io |
| Live Whiteboard | ✅ | HTML Canvas + Socket.io |
| Real-Time Chat | ✅ | Socket.io |
| User Authentication | ✅ | JWT + bcrypt |
| Data Encryption | ✅ | DTLS (WebRTC) + JWT + Helmet |
| Real-Time Signaling | ✅ | Socket.io |

---

## 🛠 Tech Stack

**Backend:**
- Node.js + Express.js
- Socket.io (real-time signaling)
- MongoDB + Mongoose (user data)
- JWT + bcryptjs (authentication)
- Multer (file uploads)
- Helmet (security headers)
- Express Rate Limiter

**Frontend:**
- HTML5, CSS3, JavaScript (Vanilla)
- WebRTC via PeerJS library
- Socket.io Client
- HTML Canvas (whiteboard)
- Google Fonts (Inter + Space Grotesk)

---

## 🚀 Setup & Run

### Prerequisites
- Node.js v16+
- MongoDB (optional — app runs in demo mode without it)

### 1. Clone the Repository
```bash
git clone https://github.com/YOUR_USERNAME/CodeAlpha_RealTimeCommunication
cd CodeAlpha_RealTimeCommunication/backend
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Configure Environment
```bash
cp .env.example .env
# Edit .env and set your MongoDB URI and JWT secret
```

### 4. Start the Server
```bash
npm start
# or for development with auto-reload:
npm run dev
```

### 5. Open in Browser
```
http://localhost:5000
```

---

## 📱 How to Use

1. **Register/Login** — Create an account or use Quick Join (guest)
2. **Create a Room** — Click "Create Room", give it a name
3. **Share the Room ID** — Copy the 8-character ID and share with others
4. **Join a Room** — Others paste the ID and click Join
5. **Video Call** — Camera and mic activate automatically
6. **Screen Share** — Click the Screen button to share your display
7. **Chat** — Type messages in the Chat panel (right sidebar)
8. **Whiteboard** — Draw collaboratively on the shared canvas
9. **Files** — Upload files (max 25MB) to share with the room
10. **End Call** — Click the red End button to leave

---

## 🔒 Security Features

- **WebRTC DTLS encryption** — All video/audio streams encrypted end-to-end
- **JWT Authentication** — Stateless, secure session management
- **bcrypt password hashing** — Passwords stored with 12 salt rounds
- **Helmet.js** — HTTP security headers (XSS, CSRF protection)
- **Rate Limiting** — 200 requests per 15 minutes per IP
- **File type filtering** — Blocks .exe, .bat, .sh, .ps1, .cmd uploads
- **File size limits** — Max 25MB per upload
- **Input sanitization** — HTML escaping in chat

---

## 📁 Project Structure

```
CodeAlpha_RealTimeCommunication/
├── backend/
│   ├── server.js            # Main server + Socket.io + WebRTC signaling
│   ├── routes/
│   │   ├── auth.js          # Register, Login, Token verify
│   │   ├── rooms.js         # Create room, generate ID
│   │   └── files.js         # File upload with Multer
│   ├── models/
│   │   ├── User.js          # User schema (bcrypt)
│   │   └── Room.js          # Room schema
│   ├── middleware/
│   │   └── auth.js          # JWT verification middleware
│   ├── uploads/             # Uploaded files directory
│   ├── package.json
│   └── .env.example
│
└── frontend/
    └── public/
        ├── index.html       # Landing page + Auth + Dashboard
        ├── room.html        # Video conferencing room
        ├── css/
        │   ├── main.css     # Main styles
        │   └── room.css     # Room styles
        └── js/
            ├── main.js      # Auth + dashboard logic
            └── room.js      # WebRTC + Socket.io + Whiteboard + Chat
```

---

## 🌐 Deployment Notes

For production deployment (e.g., on Render, Railway, or DigitalOcean):
- Set `NODE_ENV=production` in environment
- Configure a real MongoDB URI (MongoDB Atlas recommended)
- For WebRTC to work across networks, add a **TURN server** (e.g., Metered.ca free tier)

---

## 👤 Author
- **Intern:** [Your Name]
- **Program:** CodeAlpha Full Stack Development Internship
- **Task:** Task 4 — Real-Time Communication App

---

## 📝 License
This project was built as part of the CodeAlpha internship program.
