const express = require("express");
const cors = require("cors");

const authRoutes        = require("./routes/authRoutes");
const transactionRoutes = require("./routes/transactionRoutes");
const downloadRoutes    = require("./routes/downloadRoutes");

const app = express();

app.use(cors());
app.use(express.json());

app.use("/auth", authRoutes);
app.use("/transactions", transactionRoutes);
app.use("/download", downloadRoutes);

app.get("/health", (req, res) => res.json({ status: "ok" }));

module.exports = app;
