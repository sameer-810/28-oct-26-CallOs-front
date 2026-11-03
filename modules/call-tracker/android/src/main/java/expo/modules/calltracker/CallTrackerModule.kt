package expo.modules.calltracker

import android.Manifest
import android.annotation.SuppressLint
import android.content.Context
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.provider.CallLog
import android.telecom.TelecomManager
import android.telephony.SubscriptionManager
import android.telephony.TelephonyManager
import androidx.core.content.ContextCompat
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File

/**
 * The phone side of call tracking: the SIMs, the call log, and where the
 * dialler left its recording. Everything is read-only; nothing here places,
 * blocks or records a call.
 */
class CallTrackerModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  private fun granted(permission: String) =
    ContextCompat.checkSelfPermission(context, permission) == PackageManager.PERMISSION_GRANTED

  override fun definition() = ModuleDefinition {
    Name("CallTracker")

    Function("getDeviceInfo") {
      mapOf(
        "brand" to Build.BRAND,
        "manufacturer" to Build.MANUFACTURER,
        "model" to Build.MODEL,
        "androidVersion" to Build.VERSION.RELEASE,
        "sdkInt" to Build.VERSION.SDK_INT
      )
    }

    Function("getPermissions") {
      mapOf(
        "callLog" to granted(Manifest.permission.READ_CALL_LOG),
        "phoneState" to granted(Manifest.permission.READ_PHONE_STATE),
        "phoneNumbers" to granted(Manifest.permission.READ_PHONE_NUMBERS),
        "recordings" to if (Build.VERSION.SDK_INT >= 33) granted(Manifest.permission.READ_MEDIA_AUDIO)
          else granted(Manifest.permission.READ_EXTERNAL_STORAGE),
        "notifications" to if (Build.VERSION.SDK_INT >= 33) granted(Manifest.permission.POST_NOTIFICATIONS) else true
      )
    }

    /** Active SIMs. The number is often blank: many Indian SIMs don't expose it to apps. */
    Function("getSims") {
      if (!granted(Manifest.permission.READ_PHONE_STATE)) return@Function emptyList<Map<String, Any?>>()
      sims()
    }

    /** Call-log rows after `sinceMs`, oldest first, each tagged with its SIM slot when Android says. */
    AsyncFunction("readCallLog") { sinceMs: Double, limit: Int ->
      if (!granted(Manifest.permission.READ_CALL_LOG)) throw MissingPermission("READ_CALL_LOG")
      readCallLog(sinceMs.toLong(), limit.coerceIn(1, 2000))
    }

    /** The recording the dialler saved for this call, or null when there isn't a confident match. */
    AsyncFunction("findRecording") { number: String, startedAtMs: Double, durationSec: Int, contactName: String? ->
      RecordingFinder(context).find(number, startedAtMs.toLong(), durationSec, contactName)
    }

    /** Copies a content:// recording into the app's cache so it can be uploaded as a file. */
    AsyncFunction("copyToCache") { uri: String, fileName: String ->
      val safe = fileName.replace(Regex("[^A-Za-z0-9._-]"), "_")
      val out = File(context.cacheDir, "recordings").apply { mkdirs() }.resolve(safe)
      context.contentResolver.openInputStream(Uri.parse(uri)).use { input ->
        requireNotNull(input) { "Recording could not be opened" }
        out.outputStream().use { input.copyTo(it) }
      }
      "file://${out.absolutePath}"
    }

    /** Whether a call ending should prompt for a status; mirrors the company setting. */
    Function("setAfterCallPrompt") { enabled: Boolean ->
      Prefs.of(context).edit().putBoolean(Prefs.PROMPT_ENABLED, enabled).apply()
    }

    /** When the last call ended, as the receiver saw it (0 if never). */
    Function("lastCallEndedAt") {
      Prefs.of(context).getLong(Prefs.LAST_ENDED_AT, 0L).toDouble()
    }
  }

  @SuppressLint("MissingPermission")
  private fun sims(): List<Map<String, Any?>> {
    val sm = context.getSystemService(SubscriptionManager::class.java) ?: return emptyList()
    val list = sm.activeSubscriptionInfoList ?: return emptyList()
    return list.map { info ->
      val number = try {
        if (Build.VERSION.SDK_INT >= 33 && granted(Manifest.permission.READ_PHONE_NUMBERS)) {
          sm.getPhoneNumber(info.subscriptionId)
        } else {
          @Suppress("DEPRECATION") info.number
        }
      } catch (_: SecurityException) {
        null
      }
      mapOf(
        "slot" to info.simSlotIndex,
        "subscriptionId" to info.subscriptionId,
        "carrier" to info.carrierName?.toString().orEmpty(),
        "displayName" to info.displayName?.toString().orEmpty(),
        "number" to number?.takeIf { it.isNotBlank() }
      )
    }
  }

  /**
   * phone-account id (as stored in the call log) → SIM slot. On Android 11+
   * Telecom maps each account to its subscription exactly; before that, the
   * account id is usually the subscription id itself, which is tried as a
   * fallback.
   */
  @SuppressLint("MissingPermission")
  private fun accountSlots(): Map<String, Int> {
    if (!granted(Manifest.permission.READ_PHONE_STATE)) return emptyMap()
    val subSlot = sims().associate { (it["subscriptionId"] as Int) to (it["slot"] as Int) }
    val out = mutableMapOf<String, Int>()
    subSlot.forEach { (sub, slot) -> out[sub.toString()] = slot }
    if (Build.VERSION.SDK_INT >= 30) {
      val telecom = context.getSystemService(TelecomManager::class.java)
      val tm = context.getSystemService(TelephonyManager::class.java)
      try {
        telecom?.callCapablePhoneAccounts?.forEach { handle ->
          val sub = tm?.getSubscriptionId(handle) ?: return@forEach
          subSlot[sub]?.let { out[handle.id] = it }
        }
      } catch (_: SecurityException) {
      }
    }
    return out
  }

  private fun readCallLog(since: Long, limit: Int): List<Map<String, Any?>> {
    val slots = accountSlots()
    val single = slots.values.toSet().size <= 1
    val cols = arrayOf(
      CallLog.Calls._ID,
      CallLog.Calls.NUMBER,
      CallLog.Calls.TYPE,
      CallLog.Calls.DATE,
      CallLog.Calls.DURATION,
      CallLog.Calls.CACHED_NAME,
      CallLog.Calls.PHONE_ACCOUNT_ID
    )
    val rows = mutableListOf<Map<String, Any?>>()
    context.contentResolver.query(
      CallLog.Calls.CONTENT_URI,
      cols,
      "${CallLog.Calls.DATE} > ?",
      arrayOf(since.toString()),
      "${CallLog.Calls.DATE} ASC"
    )?.use { c ->
      while (c.moveToNext() && rows.size < limit) {
        val account = c.getString(6)
        rows += mapOf(
          "id" to c.getLong(0).toString(),
          "number" to c.getString(1).orEmpty(),
          "type" to c.getInt(2),
          "date" to c.getLong(3).toDouble(),
          "duration" to c.getLong(4).toInt(),
          "name" to c.getString(5).orEmpty(),
          "phoneAccountId" to account.orEmpty(),
          // one SIM: every call is on it, whatever the account id says
          "simSlot" to (account?.let { slots[it] } ?: if (single) slots.values.firstOrNull() ?: 0 else null)
        )
      }
    }
    return rows
  }
}

class MissingPermission(name: String) :
  expo.modules.kotlin.exception.CodedException("ERR_PERMISSION", "Permission $name is not granted", null)
