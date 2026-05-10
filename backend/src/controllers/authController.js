const bcrypt = require("bcrypt");
const jwt    = require("jsonwebtoken");
const pool   = require("../config/db");
const userModel = require("../models/userModel");

const JWT_SECRET  = process.env.JWT_SECRET || "gastotrack_secret_change_in_prod";
const JWT_EXPIRES = "7d";

// Basic email format check — keeps garbage out without a heavy library
const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

// ── REGISTER ──────────────────────────────────────────────────────────────────
exports.register = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // Input validation
    if (!name || !email || !password)
      return res.status(400).json({ error: "Name, email and password are required." });

    if (name.trim().length < 2)
      return res.status(400).json({ error: "Name must be at least 2 characters." });

    if (!isValidEmail(email))
      return res.status(400).json({ error: "Please enter a valid email address." });

    if (password.length < 6)
      return res.status(400).json({ error: "Password must be at least 6 characters." });

    // Duplicate check
    const existing = await userModel.findByEmail(email.toLowerCase().trim());
    if (existing)
      return res.status(409).json({ error: "An account with this email already exists." });

    // Hash password (cost factor 10 = good balance of speed vs security)
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const user = await userModel.createUser({
      name:           name.trim(),
      email:          email.toLowerCase().trim(),
      hashedPassword,
    });

    // Seed default categories for this new user (food, transport, etc.)
    // Uses the PostgreSQL function we created in Step 1
    await pool.query("SELECT seed_user_categories($1)", [user.id]);

    // Issue JWT
    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: JWT_EXPIRES });

    res.status(201).json({
      token,
      user: {
        id:             user.id,
        name:           user.name,
        email:          user.email,
        monthly_budget: user.monthly_budget,
        created_at:     user.created_at,
      },
    });
  } catch (err) {
    console.error("Register error:", err);
    res.status(500).json({ error: "Registration failed. Please try again." });
  }
};

// ── LOGIN ─────────────────────────────────────────────────────────────────────
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password)
      return res.status(400).json({ error: "Email and password are required." });

    // Always look up by lowercase email
    const user = await userModel.findByEmail(email.toLowerCase().trim());

    // Use the same error message for both "not found" and "wrong password"
    // — prevents user enumeration attacks
    if (!user)
      return res.status(401).json({ error: "Invalid email or password." });

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid)
      return res.status(401).json({ error: "Invalid email or password." });

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: JWT_EXPIRES });

    res.json({
      token,
      user: {
        id:             user.id,
        name:           user.name,
        email:          user.email,
        monthly_budget: user.monthly_budget,
      },
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Login failed. Please try again." });
  }
};

// ── GET CURRENT USER ──────────────────────────────────────────────────────────
exports.me = async (req, res) => {
  try {
    const user = await userModel.findById(req.userId);
    if (!user) return res.status(404).json({ error: "User not found." });
    res.json(user);
  } catch (err) {
    console.error("Me error:", err);
    res.status(500).json({ error: err.message });
  }
};

// ── UPDATE MONTHLY BUDGET ─────────────────────────────────────────────────────
// PUT /auth/budget  { monthly_budget: 15000 }
exports.updateBudget = async (req, res) => {
  try {
    const { monthly_budget } = req.body;

    if (monthly_budget === undefined || isNaN(monthly_budget))
      return res.status(400).json({ error: "monthly_budget must be a number." });

    if (parseFloat(monthly_budget) < 0)
      return res.status(400).json({ error: "Budget cannot be negative." });

    const result = await pool.query(
      `UPDATE users SET monthly_budget = $1 WHERE id = $2
       RETURNING id, name, email, monthly_budget`,
      [parseFloat(monthly_budget), req.userId]
    );

    if (!result.rows[0])
      return res.status(404).json({ error: "User not found." });

    res.json({ message: "Budget updated.", user: result.rows[0] });
  } catch (err) {
    console.error("Update budget error:", err);
    res.status(500).json({ error: "Failed to update budget." });
  }
};

// ── DELETE ACCOUNT ────────────────────────────────────────────────────────────
exports.deleteAccount = async (req, res) => {
  try {
    const { password } = req.body;
    if (!password)
      return res.status(400).json({ error: "Password is required to delete your account." });

    const user = await userModel.findById(req.userId);
    if (!user) return res.status(404).json({ error: "User not found." });

    // Re-fetch with password_hash (findById strips it for safety)
    const fullUser = await userModel.findByEmail(user.email);
    const valid = await bcrypt.compare(password, fullUser.password_hash);
    if (!valid)
      return res.status(401).json({ error: "Incorrect password." });

    await userModel.deleteById(req.userId);
    res.json({ message: "Account deleted successfully." });
  } catch (err) {
    console.error("Delete account error:", err);
    res.status(500).json({ error: "Failed to delete account." });
  }
};
