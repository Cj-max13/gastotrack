package com.gastotrack.app

import android.app.Notification
import android.database.sqlite.SQLiteDatabase
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
 * GastoTrack NotificationListenerService
 *
 * Listens for GCash, Maya, and Philippine bank notifications,
 * filters for financial transactions, and sends them to the backend.
 *
 * ONE-TIME USER SETUP:
 *   Settings → Apps → Special app access → Notification access → GastoTrack → ON
 *
 * Token is read from SharedPreferences (written by JS after login),
 * with a fallback to AsyncStorage's SQLite database.
 */
class NotificationService : NotificationListenerService() {

    companion object {
        private const val TAG         = "GastoTrack"
        private const val PREFS_NAME  = "gastotrack_prefs"
        private const val PREF_TOKEN  = "auth_token"
        private const val BACKEND_URL = "https://gastotrack.onrender.com/transactions/raw"

        // GCash and Philippine bank/e-wallet package names
        private val FINANCIAL_PACKAGES = setOf(
            "com.globe.gcash.android",
            "com.maya.app",
            "com.bdo.mobile",
            "ph.bpi.mobile",
            "com.metrobank.mobilebanking",
            "com.unionbankph.corporate",
            "com.landbank.mobile",
            "com.rcbc.mobile",
            "com.pnb.mobile",
            "com.coins.ph",
            "com.grabpay.merchant"
        )

        // SMS apps — filtered by keyword
        private val SMS_PACKAGES = setOf(
            "com.android.mms",
            "com.google.android.apps.messaging",
            "com.samsung.android.messaging",
            "com.miui.sms",
            "com.oneplus.mms",
            "com.sonyericsson.conversations"
        )

        // Must contain at least one of these to be a transaction
        private val TRANSACTION_KEYWORDS = listOf(
            "sent", "received", "paid", "payment", "transferred",
            "gcash", "gcredit", "cash in", "cash out",
            "debited", "credited", "withdrawn", "deposited",
            "\u20b1", "php", "peso",
            "transaction", "purchase", "bought",
            "maya", "paymaya"
        )

        // Skip these — OTPs, promos, marketing
        private val IGNORE_KEYWORDS = listOf(
            "otp", "one-time", "one time", "verification code",
            "promo", "subscribe", "offer", "discount", "voucher",
            "congratulations", "you have won"
        )
    }

    override fun onNotificationPosted(sbn: StatusBarNotification) {
        val pkg    = sbn.packageName ?: return
        val extras = sbn.notification.extras ?: return

        val text    = extras.getCharSequence(Notification.EXTRA_TEXT)?.toString() ?: ""
        val bigText = extras.getCharSequence(Notification.EXTRA_BIG_TEXT)?.toString() ?: text
        val full    = if (bigText.isNotBlank()) bigText else text

        if (full.isBlank()) return

        val isFinancial = pkg in FINANCIAL_PACKAGES
        val isSms       = pkg in SMS_PACKAGES

        if (!isFinancial && !isSms) return
        if (isSms && !isFinancialTransaction(full)) return

        Log.d(TAG, "Captured from $pkg: $full")
        sendToBackend(full.trim())
    }

    private fun isFinancialTransaction(text: String): Boolean {
        val lower = text.lowercase()
        if (IGNORE_KEYWORDS.any { lower.contains(it) }) return false
        return TRANSACTION_KEYWORDS.any { lower.contains(it) }
    }

    // ── Token retrieval ───────────────────────────────────────────────────────
    private fun getToken(): String? {
        // Strategy 1: SharedPreferences (written by JS NativeModules.SharedPrefs)
        try {
            val prefs = applicationContext.getSharedPreferences(PREFS_NAME, MODE_PRIVATE)
            val token = prefs.getString(PREF_TOKEN, null)
            if (!token.isNullOrBlank()) return token
        } catch (e: Exception) {
            Log.w(TAG, "SharedPrefs read failed: ${e.message}")
        }

        // Strategy 2: AsyncStorage SQLite fallback
        return readTokenFromAsyncStorage()
    }

    private fun readTokenFromAsyncStorage(): String? {
        return try {
            val dbPath = applicationContext.getDatabasePath("RKStorage")
            if (!dbPath.exists()) return null

            val db = SQLiteDatabase.openDatabase(
                dbPath.absolutePath, null, SQLiteDatabase.OPEN_READONLY
            )
            db.use { database ->
                database.rawQuery(
                    "SELECT value FROM catalystLocalStorage WHERE key = ?",
                    arrayOf("token")
                ).use { cursor ->
                    if (cursor.moveToFirst()) {
                        cursor.getString(0)?.trim('"')
                    } else null
                }
            }
        } catch (e: Exception) {
            Log.w(TAG, "AsyncStorage read failed: ${e.message}")
            null
        }
    }

    // ── Send to backend ───────────────────────────────────────────────────────
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
                    setRequestProperty("Accept",       "application/json")
                    getToken()?.let { setRequestProperty("Authorization", "Bearer $it") }
                }

                val body = JSONObject().apply { put("text", text) }.toString()
                conn.outputStream.use { it.write(body.toByteArray(Charsets.UTF_8)) }

                val code = conn.responseCode
                if (code == HttpURLConnection.HTTP_OK || code == HttpURLConnection.HTTP_CREATED) {
                    val resp = BufferedReader(InputStreamReader(conn.inputStream)).use { it.readText() }
                    Log.d(TAG, "Transaction saved: $resp")
                } else {
                    Log.w(TAG, "Backend returned HTTP $code")
                }
            } catch (e: Exception) {
                Log.e(TAG, "Failed to send: ${e.message}")
            } finally {
                conn?.disconnect()
            }
        }.start()
    }
}
