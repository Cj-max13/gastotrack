const express          = require("express");
const router           = express.Router();
const budgetController = require("../controllers/budgetController");
const auth             = require("../middleware/auth");

// All budget routes require a valid JWT
router.use(auth);

// NOTE: /status must come BEFORE / to avoid Express treating "status" as a param
router.get("/status", budgetController.getBudgetStatus);
router.get("/",       budgetController.getBudget);
router.put("/",       budgetController.updateBudget);

module.exports = router;
