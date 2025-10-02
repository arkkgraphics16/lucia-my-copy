"use strict";

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");

// Routers / handlers
const securePrompts = require("./routes/securePrompts");
const chat = require("./routes/chat");
const files = require("./routes/files");
const { router: stripeRouter, payRouter, webhookHandler } = require("./routes/payments");

const app = express();

// Trust proxy if running behind API Gateway/ALB (safe default)
app.set("trust proxy", true);

// ----- CORS -----
const PROD_ORIGIN = "https://www.luciadecode.com";
const allowedOrigins = new Set([
  PROD_ORIGIN,
]);

// Allow localhost in dev if CORS_ORIGIN not set
if (process.env.NODE_ENV !== "production") {
  allowedOrigins.add("http://localhost:5173");
  allowedOrigins.add("http://127.0.0.1:5173");
  allowedOrigins.add("http://localhost:3000");
  allowedOrigins.add("http://127.0.0.1:3000");
}

const corsOrigin = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(",").map(s => s.trim())
  : null;

app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true); // non-browser or same-origin
    if (corsOrigin) {
      if (corsOrigin.includes("*") || corsOrigin.includes(origin)) return cb(null, true);
      return cb(new Error("Not allowed by CORS"));
    }
    if (allowedOrigins.has(origin)) return cb(null, true);
    return cb(new Error("Not allowed by CORS"));
  },
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "stripe-signature", "authorization"],
  credentials: false,
}));
app.options("*", cors()); // preflight for all routes
// -----------------

app.use(helmet());

// IMPORTANT: webhook must read the raw body BEFORE json parser
app.post("/stripe/webhook", express.raw({ type: "application/json" }), webhookHandler);

// JSON parser for the rest
app.use(express.json({ limit: "1mb" }));

app.get("/healthz", (_req, res) => res.status(200).json({ ok: true }));

// API routes (mounted under /api)
app.use("/api/secure-prompts", securePrompts);
app.use("/api/chat", chat);
app.use("/api/files", files);

// Payments API (e.g., POST /api/pay/checkout)
// Also set CORS headers explicitly to be extra-safe
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", PROD_ORIGIN);
  res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, stripe-signature, authorization");
  next();
});
app.use("/api/pay", payRouter);

// Optional extra Stripe routes (non-webhook) if you have any
app.use("/stripe", stripeRouter);

const port = process.env.PORT || 8080;
app.listen(port, () => console.log(`API listening on :${port}`));
