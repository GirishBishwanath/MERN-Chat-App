# 💬 Real-Time MERN Chat Application

![Stack](https://img.shields.io/badge/Stack-MERN-green)
![Realtime](https://img.shields.io/badge/Feature-RealTime-blue)
![Auth](https://img.shields.io/badge/Auth-Session%20%2B%20JWT-orange)

A full-stack real-time messaging platform enabling seamless communication with server-authoritative authentication and live updates.

🔗 **Live Demo:** [mern-chat-app-jade.vercel.app](https://mern-chat-app-jade.vercel.app)
📦 **Repo:** [github.com/GirishBishwanath/MERN-Chat-App](https://github.com/GirishBishwanath/MERN-Chat-App)

---

## 🚀 Key Features

- **Real-Time Messaging:** Implemented using **Socket.IO** for instant message delivery and live user connectivity.
- **Online User Tracking:** Maintains active user sessions and dynamically updates online/offline status.
- **Server-Authoritative Authentication:** Short-lived JWT access cookies plus persistent, rotating refresh sessions stored server-side.
- **Secure Cookies:** Authentication credentials are stored in HttpOnly cookies and are never read by frontend JavaScript.
- **Session Lifecycle:** Includes `/me`, refresh, logout, and logout-all-devices server endpoints with session expiration and revocation.
- **Password Security:** Passwords are hashed with bcrypt and confirmation credentials are not persisted.
- **Modern Frontend Architecture:** Authentication state has an explicit `loading`, `authenticated`, and `unauthenticated` lifecycle.

---

## 🛠️ Tech Stack

- **Frontend:** React.js, Tailwind CSS, Axios
- **Backend:** Node.js, Express.js, Socket.IO
- **Database:** MongoDB (Mongoose ODM)
- **Authentication:** JWT access credentials, MongoDB-backed refresh sessions, bcrypt

---

## 🔐 Authentication Architecture

The browser is not the authority for authentication.

```text
Browser
  │
  │ HttpOnly cookies
  ▼
Express API
  │
  ├── accessToken (15 minutes)
  │     └── JWT → user identity
  │
  └── refreshToken (30 days)
        └── SHA-256 hash stored in MongoDB Session

Page load
  → GET /api/user/me
  → if access token expired: POST /api/user/refresh
  → authenticated / unauthenticated

Logout
  → revoke refresh session
  → clear both cookies

Logout all devices
  → delete all sessions for the authenticated user
  → clear current cookies
```

The refresh token is opaque and only its SHA-256 hash is persisted. Refresh rotates the token and extends the server-side session expiry. The access token is deliberately short-lived so compromise has a limited lifetime.

For production cross-domain deployment, authentication cookies use `HttpOnly`, `Secure`, and `SameSite=None`. Local development uses `Secure=false` and `SameSite=Lax` so cookies work over HTTP localhost.

---

## ☁️ Deployment

- **Frontend:** Vercel
- **Backend:** Render (persistent Node service for Socket.IO)
- **Database:** MongoDB Atlas

The root `render.yaml` configures the backend deployment.

Render backend environment variables:
- `MONGODB_URI`
- `JWT_SECRET`

Vercel frontend environment variable:
- `VITE_BACKEND_URL`

---

## 📁 Project Structure

```bash
ChatApp/
├── README.md
├── assets/
├── Backend/
│   ├── index.js
│   ├── package.json
│   ├── .env.example
│   ├── auth/
│   │   ├── session.js
│   │   ├── session.test.js
│   │   └── user.controller.test.js
│   ├── controller/
│   │   ├── message.controller.js
│   │   └── user.controller.js
│   ├── middleware/
│   │   └── secureRoute.js
│   ├── models/
│   │   ├── conversation.model.js
│   │   ├── message.model.js
│   │   ├── session.model.js
│   │   └── user.model.js
│   ├── routes/
│   │   ├── message.route.js
│   │   └── user.route.js
│   └── SocketIO/
│       └── server.js
└── Frontend/
    ├── package.json
    ├── vercel.json
    └── src/
        ├── App.jsx
        ├── components/
        │   ├── Loading.jsx
        │   ├── Login.jsx
        │   └── Signup.jsx
        ├── context/
        │   ├── AuthProvider.jsx
        │   ├── SocketContext.jsx
        │   ├── useGetAllUsers.jsx
        │   ├── useGetMessage.js
        │   ├── useGetSocketMessage.js
        │   └── useSendMessage.js
        ├── home/
        └── statemanage/
```

---

## ⚙️ Setup & Installation

1. Clone the repository
```bash
git clone https://github.com/GirishBishwanath/MERN-Chat-App
cd MERN-Chat-App
```

2. Install dependencies
```bash
cd Backend && npm install
cd ../Frontend && npm install
```

3. Configure backend environment variables

Create `Backend/.env` from `Backend/.env.example`:
```env
PORT=3001
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=your_long_random_jwt_secret
NODE_ENV=development
```

> ⚠️ Never commit your `.env` file.

Create `Frontend/.env`:
```env
VITE_BACKEND_URL=http://localhost:3001
```

4. Run the application
```bash
# Backend
cd Backend
npm start

# Frontend (in a separate terminal)
cd Frontend
npm run dev
```

---

## 🧪 Authentication Tests

The backend includes Node's built-in test runner for authentication regression coverage.

```bash
cd Backend
npm test
```

The suite covers credential validation, nonexistent users, invalid passwords, successful signup/login session creation, logout revocation, access-token verification, expired tokens, protected requests, and cookie clearing.

---

## 📚 Engineering Documentation

The engineering roadmap and phase reports live under `docs/engineering/`.

- `MASTER_ENGINEERING_PROMPT.md` — project engineering constitution
- `ROADMAP.md` — sequential 20-phase execution plan
- `PHASE-01-FORENSIC-AUDIT.md` — repository baseline and findings

---

## 🤝 Contributing

Contributions, issues, and feature requests are welcome!

1. Fork the repository
2. Create your feature branch: `git checkout -b feature/your-feature-name`
3. Commit your changes: `git commit -m 'Add some feature'`
4. Push to the branch: `git push origin your-feature-name`
5. Open a Pull Request

---

## 📄 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.
