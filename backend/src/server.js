// backend/src/server.js
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

// ----------------- CORS -----------------
const PROD_ORIGIN = "https://www.luciadecode.com";

// Base allowlist
const defaultAllowed = new Set([PROD_ORIGIN]);

// Allow localhost in dev if CORS_ORIGIN not set
if (process.env.NODE_ENV !== "production") {
  [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
  ].forEach(o => defaultAllowed.add(o));
}

// Optional env override (comma-separated)
const corsOrigin = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(",").map(s => s.trim()).filter(Boolean)
  : null;

const isAllowed = (origin) => {
  if (!origin) return true; // same-origin/non-browser
  if (corsOrigin) {
    if (corsOrigin.includes("*") || corsOrigin.includes(origin)) return true;
    return false;
  }
  return defaultAllowed.has(origin);
};

app.use(
  cors({
    origin: (origin, cb) => {
      if (isAllowed(origin)) return cb(null, true);
      return cb(new Error("Not allowed by CORS"));
    },
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "stripe-signature", "authorization", "Authorization"],
    credentials: false,
  })
);

// Preflight for all routes
app.options("*", cors());
// ---------------------------------------

app.use(helmet());

// IMPORTANT: Stripe webhook must read the raw body BEFORE json parser
app.post("/stripe/webhook", express.raw({ type: "application/json" }), webhookHandler);

// JSON parser for the rest
app.use(express.json({ limit: "1mb" }));

app.get("/healthz", (_req, res) => res.status(200).json({ ok: true }));

// API routes (mounted under /api)
app.use("/api/secure-prompts", securePrompts);
app.use("/api/chat", chat);
app.use("/api/files", files);

// Payments API (e.g., POST /api/pay/checkout)
// Mirror the verified Origin header for responses under /api/pay.
// This fixes the prior hard-coded PROD_ORIGIN that broke localhost/preview.
app.use("/api/pay", (req, res, next) => {
  const o = req.headers.origin;
  if (o && isAllowed(o)) {
    res.setHeader("Access-Control-Allow-Origin", o);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, stripe-signature, authorization, Authorization");
  }
  next();
}, payRouter);

// Optional extra Stripe routes (non-webhook) if you have any
app.use("/stripe", (req, res, next) => {
  const o = req.headers.origin;
  if (o && isAllowed(o)) {
    res.setHeader("Access-Control-Allow-Origin", o);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, stripe-signature, authorization, Authorization");
  }
  next();
}, stripeRouter);

const port = process.env.PORT || 8080;
app.listen(port, () => console.log(`API listening on :${port}`));
