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
 * NotificationService — listens for GCash / bank SMS notifications
 * and automatically sends them to the GastoTrack backend as transactions.
 *
 * Setup required in AndroidManifest.xml:
 *   <service
 *       android:name=".NotificationService"
 *       android:label="GastoTrack SMS Listener"
 *       android:permission="android.permission.BIND_NOTIFICATION_LISTENER_SERVICE">
 *       <intent-filter>
 *           <action android:name="android.service.notification.NotificationListenerService" />
 *       </intent-filter>
 *   </service>
 *
 * User must also grant Notification Access in:
 *   Settings → Apps → Special app access → Notification access → GastoTrack
 */
class NotificationService : NotificationListenerService() {

    companion object {
        private const val TAG = "GastoTrack"
        private const val PREFS_NAME = "gastotrack_prefs"
        private const val PREF_HOST = "server_host"
        private const val PREF_PORT = "server_port"
        private const val PREF_TOKEN = "auth_token"
        private const val DEFAULT_HOST = "gastotrack-backend.railway.app"
        private const val DEFAULT_PORT = "443"

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

        // SMS app packages — filtered by keywords below
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

        val text    = extras.getCharSequence(Notification.EXTRA_TEXT)?.toString() ?: ""
        val bigText = extras.getCharSequence(Notification.EXTRA_BIG_TEXT)?.toString() ?: text
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

    private fun getPrefs(): SharedPreferences =
        applicationContext.getSharedPreferences(PREFS_NAME, MODE_PRIVATE)

    private fun buildUrl(): String {
        val prefs = getPrefs()
        val host  = prefs.getString(PREF_HOST, DEFAULT_HOST) ?: DEFAULT_HOST
        val port  = prefs.getString(PREF_PORT, DEFAULT_PORT) ?: DEFAULT_PORT
        val scheme = if (port == "443" || host.contains("railway") || host.contains("render")) "https" else "http"
        return "$scheme://$host${if (port == "443" || port == "80") "" else ":$port"}/transactions/raw"
    }

    private fun getToken(): String? =
        getPrefs().getString(PREF_TOKEN, null)

    private fun sendToBackend(text: String) {
        Thread {
            var connection: HttpURLConnection? = null
            try {
                val url = URL(buildUrl())
                connection = url.openConnection() as HttpURLConnection
                connection.requestMethod = "POST"
                connection.doOutput = true
                connection.doInput  = true
                connection.connectTimeout = 10_000
                connection.readTimeout    = 10_000
                connection.setRequestProperty("Content-Type", "application/json")
                connection.setRequestProperty("Accept", "application/json")

                // Attach JWT token if available (set after user logs in)
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
                    Log.d(TAG, "Transaction saved from SMS: $response")
                } else {
                    Log.w(TAG, "Backend returned HTTP $code for: $text")
                }
            } catch (e: Exception) {
                Log.e(TAG, "Failed to send SMS transaction to backend", e)
            } finally {
                connection?.disconnect()
            }
        }.start()
    }
}
