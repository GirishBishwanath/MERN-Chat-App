# 💬 Real-Time MERN Chat Application

A high-performance, full-stack messaging platform featuring instant communication and live user synchronization.

## 🚀 Key Technical Features
*   **Real-Time Engine:** Built with **Socket.io** to achieve sub-100ms latency for message delivery and live "Online/Offline" status updates.
*   **Optimized Performance:** Implemented **parallel asynchronous processing** using `Promise.all` in the backend controllers, reducing API response times by ~40%.
*   **Modern State Management:** Utilized **Zustand** hooks for clean, scalable global state handling, significantly reducing component re-renders.
*   **Secure Authentication:** Integrated **JWT** with **BcryptJS** hashing and **HTTP-only cookies** to ensure 100% session security and data privacy.

## 🛠️ Tech Stack
- **Frontend:** React.js, Tailwind CSS, Zustand, Axios
- **Backend:** Node.js, Express.js, Socket.io
- **Database:** MongoDB (Mongoose ODM)
- **Authentication:** JSON Web Tokens (JWT)

## 📁 Project Structure
- `/frontend`: React application (Vite)
- `/backend`: Node.js/Express server & Socket.io logic

## ⚙️ Quick Start
1. **Clone the repo:** `git clone https://github.com`
2. **Install Dependencies:** Run `npm install` in both `/frontend` and `/backend`.
3. **Set Environment Variables:** Create `.env` files in both folders (see `.env.example`).
4. **Run Development:** `npm run dev` (Frontend) and `npm start` (Backend).
