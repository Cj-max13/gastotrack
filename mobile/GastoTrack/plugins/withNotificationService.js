/**
 * Expo Config Plugin — GastoTrack Notification Listener
 *
 * Copies NotificationService.kt into the Android build and registers
 * the service in AndroidManifest.xml.
 *
 * The Kotlin source lives in plugins/NotificationService.kt — editing
 * that file directly avoids all JS string escaping issues.
 */
const { withAndroidManifest, withDangerousMod } = require('@expo/config-plugins');
const fs   = require('fs');
const path = require('path');

// ── Copy NotificationService.kt into the Android project ─────────────────────
function withKotlinService(config) {
  return withDangerousMod(config, [
    'android',
    async (config) => {
      const platformRoot = config.modRequest.platformProjectRoot;
      const pkg = (config.android?.package || 'com.gastotrack.app').replace(/\./g, '/');
      const destDir = path.join(platformRoot, 'app', 'src', 'main', 'java', ...pkg.split('/'));

      fs.mkdirSync(destDir, { recursive: true });

      // Source: plugins/NotificationService.kt (next to this file)
      const srcFile  = path.join(__dirname, 'NotificationService.kt');
      const destFile = path.join(destDir, 'NotificationService.kt');

      if (!fs.existsSync(srcFile)) {
        throw new Error(
          `[withNotificationService] NotificationService.kt not found at: ${srcFile}`
        );
      }

      fs.copyFileSync(srcFile, destFile);
      console.log(`[withNotificationService] Copied NotificationService.kt → ${destFile}`);
      return config;
    },
  ]);
}

// ── Register service in AndroidManifest.xml ───────────────────────────────────
function withManifestService(config) {
  return withAndroidManifest(config, async (config) => {
    const manifest = config.modResults;
    const app = manifest.manifest.application[0];

    // Ensure uses-permission array exists
    if (!manifest.manifest['uses-permission']) {
      manifest.manifest['uses-permission'] = [];
    }

    // Add BIND_NOTIFICATION_LISTENER_SERVICE permission if missing
    const hasPerm = manifest.manifest['uses-permission'].some(
      p => p.$?.['android:name'] === 'android.permission.BIND_NOTIFICATION_LISTENER_SERVICE'
    );
    if (!hasPerm) {
      manifest.manifest['uses-permission'].push({
        $: { 'android:name': 'android.permission.BIND_NOTIFICATION_LISTENER_SERVICE' },
      });
    }

    // Add service declaration if missing
    if (!app.service) app.service = [];
    const hasService = app.service.some(
      s => s.$?.['android:name']?.includes('NotificationService')
    );
    if (!hasService) {
      app.service.push({
        $: {
          'android:name':       '.NotificationService',
          'android:label':      'GastoTrack Notification Listener',
          'android:exported':   'true',
          'android:permission': 'android.permission.BIND_NOTIFICATION_LISTENER_SERVICE',
        },
        'intent-filter': [{
          action: [{
            $: { 'android:name': 'android.service.notification.NotificationListenerService' },
          }],
        }],
      });
      console.log('[withNotificationService] Registered service in AndroidManifest.xml');
    }

    return config;
  });
}

module.exports = function withNotificationService(config) {
  config = withKotlinService(config);
  config = withManifestService(config);
  return config;
};
