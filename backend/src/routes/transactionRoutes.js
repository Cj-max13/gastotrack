const express = require("express");
const router = express.Router();
const controller = require("../controllers/transactionController");
const auth = require("../middleware/auth");

// All transaction routes require a valid JWT
router.use(auth);

router.post("/raw", controller.createTransaction);
router.get("/", controller.getTransactions);
router.delete("/reset/:category", controller.resetCategory);

module.exports = router;
