/**
 * Expo Config Plugin — GastoTrack Notification Listener
 *
 * Adds the NotificationService to the Android build by:
 * 1. Writing the Kotlin source file into the generated Android project
 * 2. Adding the service + permission to AndroidManifest.xml
 */
const { withAndroidManifest, withDangerousMod } = require('@expo/config-plugins');
const fs   = require('fs');
const path = require('path');

const KOTLIN_SERVICE = `package com.gastotrack.app

import android.app.Notification
import android.content.SharedPreferences
import android.os.Bundle
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import android.util.Log
import org.json.JSONObject
import java.io.BufferedReader
import java.io.InputStreamReader
import java.net.HttpURLConnection
import java.net.URL

class NotificationService : NotificationListenerService() {

    companion object {
        private const val TAG        = "GastoTrack"
        private const val PREFS_NAME = "gastotrack_prefs"
        private const val PREF_TOKEN = "auth_token"
        private const val BACKEND_URL = "http://192.168.0.11:3000/transactions/raw"

        private val FINANCIAL_PACKAGES = setOf(
            "com.globe.gcash.android",
            "com.bdo.mobile",
            "com.metrobank.mobilebanking",
            "com.unionbankph.corporate",
            "ph.bpi.mobile",
            "com.landbank.mobile",
            "com.rcbc.mobile",
            "com.pnb.mobile",
            "com.maya.app",
            "com.coins.ph",
        )

        private val SMS_PACKAGES = setOf(
            "com.android.mms",
            "com.google.android.apps.messaging",
            "com.samsung.android.messaging",
            "com.miui.sms",
            "com.oneplus.mms",
        )

        private val TRANSACTION_KEYWORDS = listOf(
            "sent", "received", "paid", "payment", "transferred",
            "gcash", "gcredit", "cash in", "cash out",
            "debited", "credited", "withdrawn", "deposited",
            "\\u20b1", "php", "peso", "transaction", "purchase", "bought",
        )

        private val IGNORE_KEYWORDS = listOf(
            "otp", "one-time", "one time", "verification code",
            "promo", "subscribe", "offer", "discount", "voucher",
        )
    }

    override fun onNotificationPosted(sbn: StatusBarNotification) {
        val packageName = sbn.packageName ?: return
        val extras: Bundle = sbn.notification.extras ?: return
        val text     = extras.getCharSequence(Notification.EXTRA_TEXT)?.toString() ?: ""
        val bigText  = extras.getCharSequence(Notification.EXTRA_BIG_TEXT)?.toString() ?: text
        val fullText = if (bigText.isNotBlank()) bigText else text
        if (fullText.isBlank()) return
        val isFinancialApp = packageName in FINANCIAL_PACKAGES
        val isSmsApp       = packageName in SMS_PACKAGES
        if (!isFinancialApp && !isSmsApp) return
        if (isSmsApp && !isFinancialTransaction(fullText)) return
        Log.d(TAG, "Financial notification from $packageName: $fullText")
        sendToBackend(fullText.trim())
    }

    private fun isFinancialTransaction(text: String): Boolean {
        val lower = text.lowercase()
        if (IGNORE_KEYWORDS.any { lower.contains(it) }) return false
        return TRANSACTION_KEYWORDS.any { lower.contains(it) }
    }

    private fun getToken(): String? = try {
        applicationContext.getSharedPreferences(PREFS_NAME, MODE_PRIVATE)
            .getString(PREF_TOKEN, null)
    } catch (e: Exception) { null }

    private fun sendToBackend(text: String) {
        Thread {
            var conn: HttpURLConnection? = null
            try {
                conn = (URL(BACKEND_URL).openConnection() as HttpURLConnection).apply {
                    requestMethod  = "POST"
                    doOutput       = true
                    doInput        = true
                    connectTimeout = 10_000
                    readTimeout    = 10_000
                    setRequestProperty("Content-Type", "application/json")
                    setRequestProperty("Accept", "application/json")
                    getToken()?.let { setRequestProperty("Authorization", "Bearer $it") }
                }
                val body = JSONObject().apply { put("text", text) }.toString()
                conn.outputStream.use { it.write(body.toByteArray(Charsets.UTF_8)) }
                val code = conn.responseCode
                if (code == HTTP_OK || code == HTTP_CREATED) {
                    val resp = BufferedReader(InputStreamReader(conn.inputStream)).use { it.readText() }
                    Log.d(TAG, "Saved: $resp")
                } else {
                    Log.w(TAG, "HTTP $code for: $text")
                }
            } catch (e: Exception) {
                Log.e(TAG, "Failed to send", e)
            } finally {
                conn?.disconnect()
            }
        }.start()
    }
}
`;

function withKotlinService(config) {
  return withDangerousMod(config, [
    'android',
    async (config) => {
      const platformRoot = config.modRequest.platformProjectRoot;
      const pkg = (config.android?.package || 'com.gastotrack.app').replace(/\./g, '/');
      const destDir = path.join(platformRoot, 'app', 'src', 'main', 'java', ...pkg.split('/'));
      fs.mkdirSync(destDir, { recursive: true });
      fs.writeFileSync(path.join(destDir, 'NotificationService.kt'), KOTLIN_SERVICE, 'utf8');
      console.log('[withNotificationService] Wrote NotificationService.kt');
      return config;
    },
  ]);
}

function withManifestService(config) {
  return withAndroidManifest(config, async (config) => {
    const manifest = config.modResults;
    const app = manifest.manifest.application[0];

    // Add permission
    if (!manifest.manifest['uses-permission']) manifest.manifest['uses-permission'] = [];
    const hasPerm = manifest.manifest['uses-permission'].some(
      p => p.$?.['android:name'] === 'android.permission.BIND_NOTIFICATION_LISTENER_SERVICE'
    );
    if (!hasPerm) {
      manifest.manifest['uses-permission'].push({
        $: { 'android:name': 'android.permission.BIND_NOTIFICATION_LISTENER_SERVICE' },
      });
    }

    // Add service
    if (!app.service) app.service = [];
    const hasService = app.service.some(s => s.$?.['android:name']?.includes('NotificationService'));
    if (!hasService) {
      app.service.push({
        $: {
          'android:name': '.NotificationService',
          'android:label': 'GastoTrack Notification Listener',
          'android:exported': 'true',
          'android:permission': 'android.permission.BIND_NOTIFICATION_LISTENER_SERVICE',
        },
        'intent-filter': [{
          action: [{ $: { 'android:name': 'android.service.notification.NotificationListenerService' } }],
        }],
      });
      console.log('[withNotificationService] Added service to AndroidManifest.xml');
    }
    return config;
  });
}

module.exports = function withNotificationService(config) {
  config = withKotlinService(config);
  config = withManifestService(config);
  return config;
};
