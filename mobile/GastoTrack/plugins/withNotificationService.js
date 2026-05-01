/**
 * Expo Config Plugin — GastoTrack Notification Listener
 *
 * This plugin:
 * 1. Copies NotificationService.kt into the Android project
 * 2. Adds the service declaration to AndroidManifest.xml
 * 3. Adds the BIND_NOTIFICATION_LISTENER_SERVICE permission
 */
const {
  withAndroidManifest,
  withDangerousMod,
} = require('@expo/config-plugins');
const fs   = require('fs');
const path = require('path');

// ── Step 1: Copy the Kotlin file into the Android project ────────────────────
function withKotlinService(config) {
  return withDangerousMod(config, [
    'android',
    async (config) => {
      const projectRoot = config.modRequest.projectRoot;
      const platformRoot = config.modRequest.platformProjectRoot; // android/

      // Source: our Kotlin file in the repo
      const src = path.join(projectRoot, '..', 'app', 'java', 'com', 'gastotrack', 'NotificationService.kt');

      // Destination: inside the generated Android project
      // Package is com.gastotrack.app (matches app.json android.package)
      const destDir = path.join(platformRoot, 'app', 'src', 'main', 'java', 'com', 'gastotrack', 'app');
      const dest    = path.join(destDir, 'NotificationService.kt');

      if (!fs.existsSync(src)) {
        console.warn('[withNotificationService] Source file not found:', src);
        return config;
      }

      // Create destination directory
      fs.mkdirSync(destDir, { recursive: true });

      // Read source and fix the package declaration to match the Expo app package
      let content = fs.readFileSync(src, 'utf8');
      content = content.replace(
        /^package com\.gastotrack$/m,
        'package com.gastotrack.app'
      );

      fs.writeFileSync(dest, content, 'utf8');
      console.log('[withNotificationService] Copied NotificationService.kt to', dest);

      return config;
    },
  ]);
}

// ── Step 2: Add service + permission to AndroidManifest.xml ─────────────────
function withManifestService(config) {
  return withAndroidManifest(config, async (config) => {
    const manifest = config.modResults;
    const app = manifest.manifest.application[0];

    // Add BIND_NOTIFICATION_LISTENER_SERVICE permission if not present
    const permissions = manifest.manifest['uses-permission'] || [];
    const hasPermission = permissions.some(
      (p) => p.$?.['android:name'] === 'android.permission.BIND_NOTIFICATION_LISTENER_SERVICE'
    );
    if (!hasPermission) {
      if (!manifest.manifest['uses-permission']) {
        manifest.manifest['uses-permission'] = [];
      }
      manifest.manifest['uses-permission'].push({
        $: { 'android:name': 'android.permission.BIND_NOTIFICATION_LISTENER_SERVICE' },
      });
    }

    // Add the service declaration if not already present
    if (!app.service) app.service = [];

    const serviceExists = app.service.some(
      (s) => s.$?.['android:name'] === '.NotificationService'
    );

    if (!serviceExists) {
      app.service.push({
        $: {
          'android:name': '.NotificationService',
          'android:label': 'GastoTrack SMS Listener',
          'android:exported': 'true',
          'android:permission': 'android.permission.BIND_NOTIFICATION_LISTENER_SERVICE',
        },
        'intent-filter': [
          {
            action: [
              {
                $: {
                  'android:name':
                    'android.service.notification.NotificationListenerService',
                },
              },
            ],
          },
        ],
      });
      console.log('[withNotificationService] Added NotificationService to AndroidManifest.xml');
    }

    return config;
  });
}

// ── Compose both modifications ────────────────────────────────────────────────
module.exports = function withNotificationService(config) {
  config = withKotlinService(config);
  config = withManifestService(config);
  return config;
};
