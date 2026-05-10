const express    = require("express");
const router     = express.Router();
const controller = require("../controllers/transactionController");
const auth       = require("../middleware/auth");

// All transaction routes require a valid JWT
router.use(auth);

// ── Create ────────────────────────────────────────────────────────────────────
router.post("/raw",    controller.createFromRaw);   // from Android notification
router.post("/manual", controller.createManual);    // from user typed/voice input

// ── Read ──────────────────────────────────────────────────────────────────────
// NOTE: /offsets must come BEFORE /:id so Express doesn't treat "offsets" as an ID
router.get("/offsets", controller.getCategoryOffsets);
router.get("/",        controller.getTransactions);
router.get("/:id",     controller.getTransactionById);

// ── Update / Delete ───────────────────────────────────────────────────────────
router.put("/:id",    controller.updateTransaction);
router.delete("/:id", controller.deleteTransaction);

// ── Reset ─────────────────────────────────────────────────────────────────────
router.post("/reset/:category", controller.resetCategory);

module.exports = router;
