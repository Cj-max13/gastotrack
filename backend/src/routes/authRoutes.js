const express        = require("express");
const router         = express.Router();
const authController = require("../controllers/authController");
const auth           = require("../middleware/auth");

// Public routes — no JWT needed
router.post("/register", authController.register);
router.post("/login",    authController.login);

// Protected routes — JWT required
router.get("/me",           auth, authController.me);
router.put("/budget",       auth, authController.updateBudget);
router.delete("/account",   auth, authController.deleteAccount);

module.exports = router;
