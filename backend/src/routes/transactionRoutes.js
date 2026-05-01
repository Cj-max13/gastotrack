const express = require("express");
const router = express.Router();
const controller = require("../controllers/transactionController");
const auth = require("../middleware/auth");

router.use(auth);

router.post("/raw", controller.createTransaction);
router.get("/", controller.getTransactions);
router.get("/offsets", controller.getCategoryOffsets);
router.post("/reset/:category", controller.resetCategory);

module.exports = router;
