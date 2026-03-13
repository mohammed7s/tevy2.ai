// Catch silent crashes
process.on("uncaughtException", (err) => {
  console.error("UNCAUGHT EXCEPTION:", err);
});
process.on("unhandledRejection", (err) => {
  console.error("UNHANDLED REJECTION:", err);
});

import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { serve } from "@hono/node-server";
import { env } from "./env.js";
import authRoutes from "./routes/auth.js";
import instanceRoutes from "./routes/instances.js";

const app = new Hono();

// Middleware
app.use("*", logger());
app.use(
  "*",
  cors({
    origin: env.FRONTEND_URL,
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);

// Health check
app.get("/health", (c) => c.json({ status: "ok", service: "tevy2-backend" }));

// Routes
app.route("/api/auth", authRoutes);
app.route("/api/instances", instanceRoutes);

// 404
app.notFound((c) => c.json({ error: "Not found" }, 404));

// Error handler
app.onError((err, c) => {
  console.error("Unhandled error:", err);
  return c.json({ error: "Internal server error" }, 500);
});

// Start
console.log(`🚀 tevy2 backend starting on port ${env.PORT}`);
serve({ fetch: app.fetch, port: env.PORT });
console.log(`✅ tevy2 backend running at http://localhost:${env.PORT}`);
