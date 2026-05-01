package com.gastotrack

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

/**
 * NotificationService — listens for GCash / bank app notifications
 * and automatically sends them to the GastoTrack backend as transactions.
 *
 * SETUP (done automatically by the Expo config plugin):
 *   AndroidManifest.xml gets the service declaration + permission.
 *
 * USER SETUP REQUIRED (one-time):
 *   Settings → Apps → Special app access → Notification access → GastoTrack → Enable
 *
 * TOKEN SYNC:
 *   After login, the JS side stores the JWT in SharedPreferences under
 *   key "auth_token" in the "gastotrack_prefs" file.
 *   This service reads it automatically on each notification.
 */
class NotificationService : NotificationListenerService() {

    companion object {
        private const val TAG        = "GastoTrack"
        private const val PREFS_NAME = "gastotrack_prefs"
        private const val PREF_TOKEN = "auth_token"

        // ── Server config — updated by the Expo config plugin ──────────────
        // For local dev: use your PC's IP
        // For production: use your Railway URL
        private const val BACKEND_URL = "http://192.168.0.11:3000/transactions/raw"

        // GCash and Philippine bank app package names
        private val FINANCIAL_PACKAGES = setOf(
            "com.globe.gcash.android",       // GCash
            "com.bdo.mobile",                // BDO
            "com.metrobank.mobilebanking",   // Metrobank
            "com.unionbankph.corporate",     // UnionBank
            "ph.bpi.mobile",                 // BPI
            "com.landbank.mobile",           // Landbank
            "com.rcbc.mobile",               // RCBC
            "com.pnb.mobile",                // PNB
            "com.maya.app",                  // Maya (PayMaya)
            "com.coins.ph",                  // Coins.ph
        )

        // SMS app packages — filtered by keywords
        private val SMS_PACKAGES = setOf(
            "com.android.mms",
            "com.google.android.apps.messaging",
            "com.samsung.android.messaging",
            "com.miui.sms",
            "com.oneplus.mms",
        )

        // Keywords that indicate a financial transaction
        private val TRANSACTION_KEYWORDS = listOf(
            "sent", "received", "paid", "payment", "transferred",
            "gcash", "gcredit", "cash in", "cash out",
            "debited", "credited", "withdrawn", "deposited",
            "₱", "php", "peso",
            "transaction", "purchase", "bought",
        )

        // Keywords to skip (OTPs, promos, etc.)
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

    /**
     * Read the JWT token saved by the JS side after login.
     * The React Native AsyncStorage on Android stores data in SharedPreferences
     * under the app's package name. We read from our own prefs file.
     */
    private fun getToken(): String? {
        return try {
            // Try our own prefs first (set by a native module or direct write)
            val prefs: SharedPreferences = applicationContext
                .getSharedPreferences(PREFS_NAME, MODE_PRIVATE)
            prefs.getString(PREF_TOKEN, null)
        } catch (e: Exception) {
            Log.w(TAG, "Could not read auth token", e)
            null
        }
    }

    private fun sendToBackend(text: String) {
        Thread {
            var connection: HttpURLConnection? = null
            try {
                val url = URL(BACKEND_URL)
                connection = url.openConnection() as HttpURLConnection
                connection.requestMethod  = "POST"
                connection.doOutput       = true
                connection.doInput        = true
                connection.connectTimeout = 10_000
                connection.readTimeout    = 10_000
                connection.setRequestProperty("Content-Type", "application/json")
                connection.setRequestProperty("Accept", "application/json")

                val token = getToken()
                if (!token.isNullOrBlank()) {
                    connection.setRequestProperty("Authorization", "Bearer $token")
                }

                val body = JSONObject().apply { put("text", text) }.toString()
                connection.outputStream.use { it.write(body.toByteArray(Charsets.UTF_8)) }

                val code = connection.responseCode
                if (code == HttpURLConnection.HTTP_OK || code == HttpURLConnection.HTTP_CREATED) {
                    val response = BufferedReader(InputStreamReader(connection.inputStream))
                        .use { it.readText() }
                    Log.d(TAG, "Transaction saved from notification: $response")
                } else {
                    Log.w(TAG, "Backend returned HTTP $code for: $text")
                }
            } catch (e: Exception) {
                Log.e(TAG, "Failed to send notification to backend", e)
            } finally {
                connection?.disconnect()
            }
        }.start()
    }
}
