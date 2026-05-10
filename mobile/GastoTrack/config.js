/**
 * GastoTrack — Server Configuration
 *
 * LOCAL DEV:  Uses your PC's local IP — phone must be on same WiFi.
 * PRODUCTION: Railway URLs — any phone anywhere can connect.
 *
 * Switch between LOCAL and PRODUCTION by commenting/uncommenting below.
 */

// ── LOCAL DEVELOPMENT ────────────────────────────────────────────────────────
// const CONFIG = {
//   API_URL: 'http://192.168.0.11:3000',
//   AI_URL:  'http://192.168.0.11:8000',
// };

// ── PRODUCTION (Railway) ──────────────────────────────────────────────────────
// Replace these URLs with your actual Railway deployment URLs
const CONFIG = {
  API_URL: 'https://gastotrack-backend-production.up.railway.app',
  AI_URL:  'https://gastotrack-ai-production.up.railway.app',
};

export default CONFIG;
