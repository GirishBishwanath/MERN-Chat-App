import dotenv from "dotenv";

dotenv.config();

const required = (name) => {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} environment variable is not configured`);
  }
  return value;
};

const port = Number.parseInt(process.env.PORT || "3001", 10);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("PORT environment variable must be a valid TCP port");
}

const corsOrigins = (process.env.CORS_ORIGINS || "http://localhost:3001,https://mern-chat-app-jade.vercel.app")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

export const config = Object.freeze({
  nodeEnv: process.env.NODE_ENV || "development",
  port,
  mongodbUri: required("MONGODB_URI"),
  jwtSecret: required("JWT_SECRET"),
  corsOrigins,
});
