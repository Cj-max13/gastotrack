const express    = require("express");
const cors       = require("cors");
const helmet     = require("helmet");
const rateLimit  = require("express-rate-limit");

const authRoutes        = require("./routes/authRoutes");
const transactionRoutes = require("./routes/transactionRoutes");
const downloadRoutes    = require("./routes/downloadRoutes");

const app = express();

// ── Security headers ──────────────────────────────────────────────────────────
app.use(helmet());

// ── CORS ──────────────────────────────────────────────────────────────────────
app.use(cors());

// ── Body parsing (limit payload size) ────────────────────────────────────────
app.use(express.json({ limit: "50kb" }));

// ── Global rate limiter: 200 req / 15 min per IP ─────────────────────────────
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests. Please try again later." },
});
app.use(globalLimiter);

// ── Stricter limiter for auth endpoints: 20 req / 15 min per IP ──────────────
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many login attempts. Please try again in 15 minutes." },
});

app.use("/auth", authLimiter, authRoutes);
app.use("/transactions", transactionRoutes);
app.use("/download", downloadRoutes);

app.get("/health", (req, res) => res.json({ status: "ok" }));

module.exports = app;
