package expo.modules.calltracker

import android.app.Notification
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import org.json.JSONArray
import org.json.JSONObject

/**
 * Logs WhatsApp voice and video calls, which never reach the phone's call log.
 *
 * WhatsApp shows a notification for the whole life of a call: ringing (with a
 * full-screen intent when it's incoming), then a running timer once someone
 * answers, then it goes away. Reading those three moments tells us direction,
 * whether it connected and how long it ran — without reading any message
 * text, and the same in every language WhatsApp is set to.
 *
 * Only call notifications (category CALL) from WhatsApp and WhatsApp Business
 * are looked at; every other notification is ignored on arrival.
 */
class WhatsAppCallListener : NotificationListenerService() {

  override fun onNotificationPosted(sbn: StatusBarNotification) {
    if (sbn.packageName !in PACKAGES) return
    val n = sbn.notification ?: return
    if (n.category != Notification.CATEGORY_CALL) return

    val prefs = Prefs.of(this)
    val live = JSONObject(prefs.getString(LIVE, "{}") ?: "{}")
    val key = sbn.key
    val now = System.currentTimeMillis()
    val extras = n.extras
    val title = extras?.getCharSequence(Notification.EXTRA_TITLE)?.toString().orEmpty()
    val text = extras?.getCharSequence(Notification.EXTRA_TEXT)?.toString().orEmpty()
    val timer = extras?.getBoolean(Notification.EXTRA_SHOW_CHRONOMETER) == true

    val call = live.optJSONObject(key) ?: JSONObject().apply {
      put("id", "wa-${sbn.postTime}-${key.hashCode()}")
      put("startedAt", sbn.postTime)
      // a full-screen intent is the ringing screen: only an incoming call has one
      put("incoming", n.fullScreenIntent != null)
      put("video", text.contains("video", ignoreCase = true))
    }
    if (title.isNotBlank()) call.put("title", title)
    if (timer && !call.has("connectedAt")) {
      // WhatsApp dates the timer from the moment the call was answered
      call.put("connectedAt", if (n.`when` in 1..now) n.`when` else now)
    }
    live.put(key, call)
    prefs.edit().putString(LIVE, live.toString()).apply()
  }

  override fun onNotificationRemoved(sbn: StatusBarNotification) {
    if (sbn.packageName !in PACKAGES) return
    val prefs = Prefs.of(this)
    val live = JSONObject(prefs.getString(LIVE, "{}") ?: "{}")
    val call = live.optJSONObject(sbn.key) ?: return
    live.remove(sbn.key)

    val now = System.currentTimeMillis()
    val incoming = call.optBoolean("incoming")
    val connectedAt = call.optLong("connectedAt", 0L)
    val type = when {
      connectedAt > 0 -> if (incoming) "incoming" else "outgoing"
      incoming -> "missed"
      // an outgoing call nobody answered: "not picked up", as on the phone log
      else -> "outgoing"
    }
    val done = JSONObject()
      .put("id", call.getString("id"))
      .put("type", type)
      .put("video", call.optBoolean("video"))
      .put("title", call.optString("title"))
      .put("startedAt", call.optLong("startedAt", now))
      .put("durationSec", if (connectedAt > 0) ((now - connectedAt) / 1000).coerceAtLeast(0L) else 0L)

    val queue = JSONArray(prefs.getString(QUEUE, "[]") ?: "[]")
    queue.put(done)
    // a phone that never opens the app shouldn't grow this without bound
    val trimmed = JSONArray()
    val from = (queue.length() - MAX_QUEUE).coerceAtLeast(0)
    for (i in from until queue.length()) trimmed.put(queue.get(i))
    prefs.edit().putString(LIVE, live.toString()).putString(QUEUE, trimmed.toString()).apply()
  }

  companion object {
    val PACKAGES = setOf("com.whatsapp", "com.whatsapp.w4b")
    const val LIVE = "waLive"
    const val QUEUE = "waQueue"
    const val MAX_QUEUE = 500

    /** Finished WhatsApp calls not yet sent, oldest first. */
    fun pending(prefs: android.content.SharedPreferences): List<Map<String, Any?>> {
      val queue = JSONArray(prefs.getString(QUEUE, "[]") ?: "[]")
      return (0 until queue.length()).map { i ->
        val o = queue.getJSONObject(i)
        mapOf(
          "id" to o.getString("id"),
          "type" to o.getString("type"),
          "video" to o.optBoolean("video"),
          "title" to o.optString("title"),
          "startedAt" to o.optLong("startedAt").toDouble(),
          "durationSec" to o.optLong("durationSec").toInt()
        )
      }
    }

    /** Drops the calls the server has confirmed. */
    fun ack(prefs: android.content.SharedPreferences, ids: List<String>) {
      val done = ids.toSet()
      val queue = JSONArray(prefs.getString(QUEUE, "[]") ?: "[]")
      val keep = JSONArray()
      for (i in 0 until queue.length()) {
        val o = queue.getJSONObject(i)
        if (o.getString("id") !in done) keep.put(o)
      }
      prefs.edit().putString(QUEUE, keep.toString()).apply()
    }
  }
}
