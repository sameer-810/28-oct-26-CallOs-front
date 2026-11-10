package expo.modules.calltracker

import android.Manifest
import android.annotation.SuppressLint
import android.app.Activity
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.provider.CallLog
import android.provider.OpenableColumns
import android.telecom.PhoneAccountHandle
import android.telecom.TelecomManager
import android.telephony.SubscriptionManager
import android.telephony.TelephonyManager
import androidx.core.content.ContextCompat
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File

/**
 * The phone side of call tracking: the SIMs, the call log, where the dialler
 * left its recording, WhatsApp calls, follow-up reminders, and the phone
 * settings that keep it all running. Nothing here blocks or records a call;
 * the only call it places is one the rep tapped.
 */
class CallTrackerModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  private var folderPromise: Promise? = null

  private fun granted(permission: String) =
    ContextCompat.checkSelfPermission(context, permission) == PackageManager.PERMISSION_GRANTED

  override fun definition() = ModuleDefinition {
    Name("CallTracker")

    Events("onSharedAudio", "onCallEnded")

    // the receiver tells a running app the moment a call ends, so it syncs at once
    OnCreate { CallEvents.listener = { sendEvent("onCallEnded", mapOf("at" to System.currentTimeMillis().toDouble())) } }
    OnDestroy { CallEvents.listener = null }

    /** Starts the background-sync service and its ongoing notification; false if Android refused. */
    Function("startSyncService") { text: String? ->
      SyncService.start(context, text)
    }

    Function("stopSyncService") {
      SyncService.stop(context)
    }

    /** New text for the ongoing notification ("Last synced 7:42 pm · 2 recordings waiting"). */
    Function("updateSyncNotice") { text: String ->
      SyncService.update(context, text)
    }

    /** A notification of the app's own: kind "coaching" or "setup". */
    Function("notify") { kind: String, id: Int, title: String, text: String, url: String? ->
      AppNotices.post(context, kind, id, title, text, url)
    }

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
        "notifications" to if (Build.VERSION.SDK_INT >= 33) granted(Manifest.permission.POST_NOTIFICATIONS) else true,
        "contacts" to granted(Manifest.permission.READ_CONTACTS),
        "callPhone" to granted(Manifest.permission.CALL_PHONE)
      )
    }

    /** The settings that aren't runtime permissions, and the battery. */
    Function("getHealth") {
      mapOf(
        "battery" to PhoneChecks.batteryUnrestricted(context),
        "overlay" to PhoneChecks.overlay(context),
        "whatsapp" to PhoneChecks.notificationListener(context),
        "autostartNeeded" to PhoneChecks.autostartNeeded(),
        "recordingFolder" to RecordingFolder.readable(context),
        "power" to PhoneChecks.battery(context)
      )
    }

    /** Opens the system screen for one setting: battery, overlay, whatsapp, autostart, notifications, defaultDialer. */
    Function("openSetting") { what: String ->
      PhoneChecks.open(context, what)
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

    /**
     * The recording the dialler saved for this call, or null when there isn't a
     * confident match: the media index first, then the folder the rep picked.
     */
    AsyncFunction("findRecording") { number: String, startedAtMs: Double, durationSec: Int, contactName: String? ->
      RecordingFinder(context).find(number, startedAtMs.toLong(), durationSec, contactName)
        ?: RecordingFolder.find(context, number, startedAtMs.toLong(), durationSec, contactName)
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

    /** The folder the rep picked for recordings, or null. */
    Function("getRecordingFolder") {
      RecordingFolder.saved(context)?.let {
        mapOf("uri" to it, "label" to RecordingFolder.label(it), "readable" to RecordingFolder.readable(context))
      }
    }

    /** The system folder picker; resolves the folder chosen, or null if the rep backed out. */
    AsyncFunction("pickRecordingFolder") { promise: Promise ->
      val activity = appContext.currentActivity ?: throw Exceptions.MissingActivity()
      folderPromise?.resolve(null)
      folderPromise = promise
      val intent = Intent(Intent.ACTION_OPEN_DOCUMENT_TREE).addFlags(
        Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION
      )
      activity.startActivityForResult(intent, PICK_FOLDER)
    }

    OnActivityResult { _, payload ->
      if (payload.requestCode != PICK_FOLDER) return@OnActivityResult
      val promise = folderPromise ?: return@OnActivityResult
      folderPromise = null
      val uri = payload.data?.data
      if (payload.resultCode != Activity.RESULT_OK || uri == null) {
        promise.resolve(null)
        return@OnActivityResult
      }
      try {
        context.contentResolver.takePersistableUriPermission(uri, Intent.FLAG_GRANT_READ_URI_PERMISSION)
      } catch (_: SecurityException) {
      }
      // one folder is kept; let go of the old one's grant
      RecordingFolder.saved(context)?.takeIf { it != uri.toString() }?.let { old ->
        try {
          context.contentResolver.releasePersistableUriPermission(Uri.parse(old), Intent.FLAG_GRANT_READ_URI_PERMISSION)
        } catch (_: Exception) {
        }
      }
      RecordingFolder.save(context, uri.toString())
      promise.resolve(mapOf("uri" to uri.toString(), "label" to RecordingFolder.label(uri.toString()), "readable" to true))
    }

    /** Whether a call ending should prompt for a status; mirrors the company setting. */
    Function("setAfterCallPrompt") { enabled: Boolean ->
      Prefs.of(context).edit().putBoolean(Prefs.PROMPT_ENABLED, enabled).apply()
    }

    /** When the last call ended, as the receiver saw it (0 if never). */
    Function("lastCallEndedAt") {
      Prefs.of(context).getLong(Prefs.LAST_ENDED_AT, 0L).toDouble()
    }

    /** WhatsApp calls finished since the last send, with the number found in contacts when WhatsApp showed a name. */
    Function("pendingWhatsAppCalls") {
      WhatsAppCallListener.pending(Prefs.of(context)).map { call ->
        val title = (call["title"] as? String).orEmpty()
        val looksLikeNumber = title.count(Char::isDigit) >= 7 && title.all { it.isDigit() || it in "+ -()" }
        val number = if (looksLikeNumber) title.filter { it.isDigit() || it == '+' } else Contacts.numberFor(context, title)
        call + mapOf("number" to number, "name" to if (looksLikeNumber) "" else title)
      }
    }

    Function("ackWhatsAppCalls") { ids: List<String> ->
      WhatsAppCallListener.ack(Prefs.of(context), ids)
    }

    /** Replaces every armed follow-up reminder with this list; returns how many are armed. */
    Function("setFollowups") { list: List<Map<String, Any?>> ->
      FollowupAlarms.replaceAll(
        context,
        list.mapNotNull { m ->
          val id = m["id"] as? String ?: return@mapNotNull null
          val at = (m["at"] as? Number)?.toLong() ?: return@mapNotNull null
          FollowupAlarms.Followup(
            id, at, (m["title"] as? String).orEmpty(), (m["text"] as? String).orEmpty(), (m["phone"] as? String).orEmpty()
          )
        }
      )
      FollowupAlarms.count(context)
    }

    /**
     * Calls a number. With the call permission it rings straight out — on the
     * given SIM, which is how a SIM proves its number — otherwise it opens the
     * dialler with the number typed in. Returns whether it rang out directly.
     */
    Function("placeCall") { number: String, simSlot: Int? ->
      val uri = Uri.fromParts("tel", number, null)
      val direct = granted(Manifest.permission.CALL_PHONE)
      val intent = Intent(if (direct) Intent.ACTION_CALL else Intent.ACTION_DIAL, uri).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      if (direct && simSlot != null) {
        handleForSlot(simSlot)?.let { intent.putExtra(TelecomManager.EXTRA_PHONE_ACCOUNT_HANDLE, it) }
      }
      context.startActivity(intent)
      direct
    }

    /** An audio file shared into the app ("Share → Ringwise"), once; null when there is none. */
    Function("takeSharedAudio") {
      val activity = appContext.currentActivity ?: return@Function null
      val shared = sharedAudio(activity.intent) ?: return@Function null
      // read once: coming back to the app mustn't offer it again
      activity.intent = Intent(activity.intent).setAction(Intent.ACTION_MAIN).apply { removeExtra(Intent.EXTRA_STREAM) }
      shared
    }

    OnNewIntent { intent ->
      sharedAudio(intent)?.let { sendEvent("onSharedAudio", it) }
    }
  }

  private fun sharedAudio(intent: Intent?): Map<String, Any?>? {
    if (intent?.action != Intent.ACTION_SEND) return null
    val type = intent.type.orEmpty()
    if (!type.startsWith("audio/") && type != "application/octet-stream") return null
    val uri: Uri = (
      if (Build.VERSION.SDK_INT >= 33) intent.getParcelableExtra(Intent.EXTRA_STREAM, Uri::class.java)
      else @Suppress("DEPRECATION") intent.getParcelableExtra<Uri>(Intent.EXTRA_STREAM)
      ) ?: return null
    var name = ""
    var size = 0L
    try {
      context.contentResolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME, OpenableColumns.SIZE), null, null, null)?.use { c ->
        if (c.moveToFirst()) {
          name = c.getString(0).orEmpty()
          size = c.getLong(1)
        }
      }
    } catch (_: Exception) {
    }
    return mapOf("uri" to uri.toString(), "name" to name.ifBlank { "recording" }, "mime" to type, "bytes" to size.toDouble())
  }

  @SuppressLint("MissingPermission")
  private fun handleForSlot(slot: Int): PhoneAccountHandle? {
    val sub = sims().firstOrNull { it["slot"] == slot }?.get("subscriptionId") as? Int ?: return null
    val telecom = context.getSystemService(TelecomManager::class.java) ?: return null
    val tm = context.getSystemService(TelephonyManager::class.java)
    return try {
      telecom.callCapablePhoneAccounts.firstOrNull { handle ->
        if (Build.VERSION.SDK_INT >= 30) tm?.getSubscriptionId(handle) == sub else handle.id == sub.toString()
      }
    } catch (_: SecurityException) {
      null
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
        val number = c.getString(1).orEmpty()
        rows += mapOf(
          "id" to c.getLong(0).toString(),
          "number" to number,
          "type" to c.getInt(2),
          "date" to c.getLong(3).toDouble(),
          "duration" to c.getLong(4).toInt(),
          // the dialler caches a name only if the contact existed at call time
          "name" to (c.getString(5)?.takeIf { it.isNotBlank() } ?: Contacts.nameFor(context, number).orEmpty()),
          "phoneAccountId" to account.orEmpty(),
          // one SIM: every call is on it, whatever the account id says
          "simSlot" to (account?.let { slots[it] } ?: if (single) slots.values.firstOrNull() ?: 0 else null)
        )
      }
    }
    return rows
  }
}

private const val PICK_FOLDER = 4121

class MissingPermission(name: String) :
  expo.modules.kotlin.exception.CodedException("ERR_PERMISSION", "Permission $name is not granted", null)
