import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import cookieParser from "cookie-parser";

import { config } from "./config/env.js";
import userRoute from "./routes/user.route.js";
import messageRoute from "./routes/message.route.js";
import healthRoute from "./routes/health.route.js";
import { app, server } from "./SocketIO/server.js";
import { requestContext } from "./middleware/requestContext.js";
import { notFoundHandler, errorHandler } from "./middleware/errorHandler.js";
import { logger } from "./utils/logger.js";

app.use(requestContext);
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || config.corsOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error("CORS policy violation"));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "X-Requested-With",
    "Accept",
    "X-Request-Id",
  ],
}));
app.use(express.json());
app.use(cookieParser());

app.use("/health", healthRoute);
app.use("/api/user", userRoute);
app.use("/api/message", messageRoute);

app.use(notFoundHandler);
app.use(errorHandler);

const startServer = async () => {
  await mongoose.connect(config.mongodbUri);
  logger.info("database_connected", { database: "mongodb" });

  server.listen(config.port, "0.0.0.0", () => {
    logger.info("server_started", { port: config.port });
  });
};

const shutdown = async (signal) => {
  logger.info("server_shutdown_started", { signal });
  server.close(async () => {
    await mongoose.disconnect();
    logger.info("server_shutdown_completed");
    process.exit(0);
  });
};

process.once("SIGTERM", () => shutdown("SIGTERM"));
process.once("SIGINT", () => shutdown("SIGINT"));

startServer().catch((error) => {
  logger.error("server_start_failed", { errorName: error?.name });
  process.exit(1);
});
