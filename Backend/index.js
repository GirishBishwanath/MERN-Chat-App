import express from "express";
import dotenv from "dotenv";
import mongoose from "mongoose";
import cors from "cors";
import cookieParser from "cookie-parser";

import userRoute from "./routes/user.route.js";
import messageRoute from "./routes/message.route.js";
import { app, server } from "./SocketIO/server.js";

dotenv.config();

const PORT = process.env.PORT || 3001;
const URI = process.env.MONGODB_URI;

if (!URI) {
  throw new Error("MONGODB_URI environment variable is not configured");
}

if (!process.env.JWT_SECRET) {
  throw new Error("JWT_SECRET environment variable is not configured");
}

app.use(express.json());
app.use(cookieParser());

const allowedOrigins = [
  "https://mern-chat-app-jade.vercel.app",
  "http://localhost:3001",
];

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error("CORS policy violation"));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "Accept"],
};

app.use(cors(corsOptions));
app.options("*", cors(corsOptions));

app.use("/api/user", userRoute);
app.use("/api/message", messageRoute);

const startServer = async () => {
  await mongoose.connect(URI);
  console.log("Connected to MongoDB");

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server is Running on port ${PORT}`);
  });
};

startServer().catch((error) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});
