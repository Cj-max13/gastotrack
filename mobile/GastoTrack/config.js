/**
 * GastoTrack — Server Configuration
 *
 * LOCAL DEV:  Uses your PC's local IP — phone must be on same WiFi.
 * PRODUCTION: Render URLs — any phone anywhere can connect.
 *
 * Switch between LOCAL and PRODUCTION by commenting/uncommenting below.
 */

// ── LOCAL DEVELOPMENT ────────────────────────────────────────────────────────
// const CONFIG = {
//   API_URL: 'http://192.168.0.11:3000',
//   AI_URL:  'http://192.168.0.11:8000',
// };

// ── PRODUCTION (Render) ───────────────────────────────────────────────────────
const CONFIG = {
  API_URL: 'https://gastotrack.onrender.com',
  AI_URL:  'https://gastotrack-1.onrender.com',
};

export default CONFIG;
