/**
 * GastoTrack — Server Configuration
 *
 * PRODUCTION: Replace with your Railway URLs after deploying.
 * LOCAL DEV:  Comment out PRODUCTION and uncomment LOCAL below.
 */

// ── PRODUCTION (Railway) ─────────────────────────────────────────────────────
// Replace these with your actual Railway URLs:
const CONFIG = {
  API_URL: 'https://gastotrack-backend-production.up.railway.app',
  AI_URL:  'https://gastotrack-ai-production.up.railway.app',
};

// ── LOCAL DEVELOPMENT ────────────────────────────────────────────────────────
// Uncomment this block and comment out the one above when developing locally:
// const CONFIG = {
//   API_URL: 'http://192.168.0.11:3000',
//   AI_URL:  'http://192.168.0.11:8000',
// };

export default CONFIG;
