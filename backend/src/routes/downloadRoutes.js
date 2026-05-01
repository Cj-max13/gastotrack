const express = require("express");
const router = express.Router();
const crypto = require("crypto");

// In-memory store for one-time download tokens
// In production, use Redis or a DB table
const downloadTokens = new Map();

const APK_URL = process.env.APK_URL || ""; // Set this after EAS build completes

/**
 * GET /download
 * Serves the app download landing page with QR code
 */
router.get("/", (req, res) => {
  const appUrl = `${req.protocol}://${req.get("host")}/download`;

  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>GastoTrack — Download App</title>
  <script src="https://cdn.jsdelivr.net/npm/qrcode/build/qrcode.min.js"></script>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: #0F0F0F; color: #F5F5F0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      min-height: 100vh; display: flex; align-items: center; justify-content: center;
      padding: 24px;
    }
    .card {
      background: #181818; border: 1px solid #2A2A2A;
      border-radius: 24px; padding: 40px 32px;
      max-width: 420px; width: 100%; text-align: center;
    }
    .logo { font-size: 52px; margin-bottom: 8px; }
    .title { font-size: 28px; font-weight: 800; color: #C8F135; letter-spacing: -1px; }
    .sub { font-size: 13px; color: #5A5A54; margin-top: 4px; margin-bottom: 32px; }

    .qr-wrap {
      background: #fff; border-radius: 16px;
      padding: 16px; display: inline-block; margin-bottom: 24px;
    }
    canvas { display: block; }

    .steps { text-align: left; margin-bottom: 28px; }
    .step { display: flex; gap: 12px; align-items: flex-start; margin-bottom: 14px; }
    .step-num {
      background: #C8F135; color: #0F0F0F;
      font-weight: 700; font-size: 13px;
      width: 24px; height: 24px; border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0; margin-top: 1px;
    }
    .step-text { font-size: 14px; color: #9A9A92; line-height: 1.5; }
    .step-text strong { color: #F5F5F0; }

    .btn {
      display: block; width: 100%;
      background: #C8F135; color: #0F0F0F;
      font-size: 16px; font-weight: 700;
      padding: 16px; border-radius: 14px;
      text-decoration: none; border: none; cursor: pointer;
      transition: opacity 0.15s;
    }
    .btn:hover { opacity: 0.85; }
    .btn-secondary {
      background: #222; color: #F5F5F0;
      border: 1px solid #333; margin-top: 10px;
      font-size: 14px; padding: 13px;
    }
    .version { font-size: 11px; color: #3A3A3A; margin-top: 20px; }
    .no-apk {
      background: #2A1A00; border: 1px solid #FFB34740;
      border-radius: 12px; padding: 14px;
      font-size: 13px; color: #FFB347; margin-bottom: 20px;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">💸</div>
    <div class="title">GastoTrack</div>
    <div class="sub">Smart expense tracking</div>

    <div class="qr-wrap">
      <canvas id="qr"></canvas>
    </div>

    ${APK_URL ? "" : `
    <div class="no-apk">
      ⚠️ APK not yet built. Run <strong>npm run build:apk</strong> in the mobile folder,
      then set <strong>APK_URL</strong> in backend/.env
    </div>
    `}

    <div class="steps">
      <div class="step">
        <div class="step-num">1</div>
        <div class="step-text">Scan the QR code with your phone camera <strong>or</strong> open this page on your phone</div>
      </div>
      <div class="step">
        <div class="step-num">2</div>
        <div class="step-text">Tap <strong>Download APK</strong> and allow installation from unknown sources</div>
      </div>
      <div class="step">
        <div class="step-num">3</div>
        <div class="step-text">Open the installed <strong>GastoTrack</strong> app and create your account</div>
      </div>
    </div>

    ${APK_URL
      ? `<a class="btn" href="${APK_URL}" download>⬇️ Download APK</a>`
      : `<button class="btn" disabled style="opacity:0.4;cursor:not-allowed">⬇️ APK Not Ready Yet</button>`
    }
    <a class="btn btn-secondary" href="${appUrl}">🔗 Share this page</a>

    <div class="version">GastoTrack v1.0.0 · Android</div>
  </div>

  <script>
    QRCode.toCanvas(document.getElementById('qr'), '${appUrl}', {
      width: 200, margin: 0,
      color: { dark: '#0F0F0F', light: '#FFFFFF' }
    });
  </script>
</body>
</html>`);
});

module.exports = router;
