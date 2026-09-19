import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";

import { config } from "./config/env.js";
import userRoute from "./routes/user.route.js";
import messageRoute from "./routes/message.route.js";
import healthRoute from "./routes/health.route.js";
import { app } from "./SocketIO/server.js";
import { requestContext } from "./middleware/requestContext.js";
import { securityHeaders } from "./middleware/securityHeaders.js";
import { verifyRequestOrigin } from "./middleware/verifyOrigin.js";
import { notFoundHandler, errorHandler } from "./middleware/errorHandler.js";

app.disable("x-powered-by");
app.use(requestContext);
app.use(securityHeaders);
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || config.corsOrigins.includes(origin)) return callback(null, true);
    return callback(new Error("CORS policy violation"));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "Accept", "X-Request-Id"],
}));
app.use(express.json({ limit: "16kb" }));
app.use(cookieParser());

app.use("/health", healthRoute);
app.use(verifyRequestOrigin);
app.use("/api/user", userRoute);
app.use("/api/message", messageRoute);
app.use(notFoundHandler);
app.use(errorHandler);

export { app };
