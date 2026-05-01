/**
 * GastoTrack — Server Configuration
 *
 * LOCAL DEV:  Uses your PC's local IP — phone must be on same WiFi.
 * PRODUCTION: Swap to Railway URLs once deployed.
 */

// ── LOCAL DEVELOPMENT ────────────────────────────────────────────────────────
const CONFIG = {
  API_URL: 'http://192.168.0.11:3000',
  AI_URL:  'http://192.168.0.11:8000',
};

// ── PRODUCTION (Railway) — uncomment when deployed ───────────────────────────
// const CONFIG = {
//   API_URL: 'https://gastotrack-backend-production.up.railway.app',
//   AI_URL:  'https://gastotrack-ai-production.up.railway.app',
// };

export default CONFIG;
