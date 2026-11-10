package expo.modules.calltracker

import android.Manifest
import android.app.AlarmManager
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import org.json.JSONObject

/**
 * Reminders for lead follow-ups, rung by the phone itself at the set time —
 * so they arrive with no internet and with the app closed. The app hands over
 * the whole list on every sync; Android forgets alarms on reboot, so the list
 * is kept and set again by [FollowupBootReceiver].
 */
object FollowupAlarms {
  private const val KEY = "followups"
  const val CHANNEL = "lead-followups"

  data class Followup(val id: String, val at: Long, val title: String, val text: String, val phone: String)

  private fun read(context: Context): MutableMap<String, Followup> {
    val o = JSONObject(Prefs.of(context).getString(KEY, "{}") ?: "{}")
    val out = mutableMapOf<String, Followup>()
    o.keys().forEach { id ->
      val f = o.getJSONObject(id)
      out[id] = Followup(id, f.getLong("at"), f.optString("title"), f.optString("text"), f.optString("phone"))
    }
    return out
  }

  private fun write(context: Context, all: Map<String, Followup>) {
    val o = JSONObject()
    all.values.forEach {
      o.put(it.id, JSONObject().put("at", it.at).put("title", it.title).put("text", it.text).put("phone", it.phone))
    }
    Prefs.of(context).edit().putString(KEY, o.toString()).apply()
  }

  private fun pending(context: Context, id: String, flags: Int): PendingIntent? {
    val intent = Intent(context, FollowupAlarmReceiver::class.java).setAction("callos.followup.$id").putExtra("id", id)
    return PendingIntent.getBroadcast(context, id.hashCode(), intent, flags or PendingIntent.FLAG_IMMUTABLE)
  }

  private fun arm(context: Context, f: Followup) {
    val am = context.getSystemService(AlarmManager::class.java) ?: return
    val pi = pending(context, f.id, PendingIntent.FLAG_UPDATE_CURRENT) ?: return
    // exact when the phone allows it; otherwise Android may run it a few minutes late in deep sleep
    if (Build.VERSION.SDK_INT < 31 || am.canScheduleExactAlarms()) {
      am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, f.at, pi)
    } else {
      am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, f.at, pi)
    }
  }

  private fun disarm(context: Context, id: String) {
    val pi = pending(context, id, PendingIntent.FLAG_NO_CREATE) ?: return
    context.getSystemService(AlarmManager::class.java)?.cancel(pi)
    pi.cancel()
  }

  /**
   * Makes the set of armed reminders exactly `list`: new ones armed, changed
   * ones moved, gone ones cancelled. Past times are dropped.
   */
  fun replaceAll(context: Context, list: List<Followup>) {
    val now = System.currentTimeMillis()
    val next = list.filter { it.at > now }.associateBy { it.id }
    val prev = read(context)
    prev.keys.filter { it !in next }.forEach { disarm(context, it) }
    next.values.forEach { f -> if (prev[f.id] != f) arm(context, f) }
    write(context, next)
  }

  /** After a reboot: every reminder still ahead, armed again. */
  fun rearm(context: Context) {
    val now = System.currentTimeMillis()
    val live = read(context).filterValues { it.at > now }
    live.values.forEach { arm(context, it) }
    write(context, live)
  }

  fun count(context: Context) = read(context).size

  fun fire(context: Context, id: String) {
    val all = read(context)
    val f = all.remove(id) ?: return
    write(context, all)
    notify(context, f)
  }

  private fun notify(context: Context, f: Followup) {
    if (Build.VERSION.SDK_INT >= 33 &&
      ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
    ) return
    val nm = context.getSystemService(NotificationManager::class.java) ?: return
    if (Build.VERSION.SDK_INT >= 26 && nm.getNotificationChannel(CHANNEL) == null) {
      nm.createNotificationChannel(
        NotificationChannel(CHANNEL, "Lead follow-ups", NotificationManager.IMPORTANCE_HIGH).apply {
          description = "Reminders for scheduled lead follow-ups"
        }
      )
    }
    val flags = PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    val open = PendingIntent.getActivity(
      context, f.id.hashCode(),
      Intent(Intent.ACTION_VIEW, Uri.parse("callos://calls?open=${Uri.encode(f.id)}"))
        .setPackage(context.packageName)
        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP),
      flags
    )
    val icon = context.applicationInfo.icon.takeIf { it != 0 } ?: android.R.drawable.sym_action_call
    val builder = NotificationCompat.Builder(context, CHANNEL)
      .setSmallIcon(icon)
      .setContentTitle(f.title)
      .setContentText(f.text)
      .setStyle(NotificationCompat.BigTextStyle().bigText(f.text))
      .setContentIntent(open)
      .setAutoCancel(true)
      .setPriority(NotificationCompat.PRIORITY_HIGH)
      .setCategory(NotificationCompat.CATEGORY_REMINDER)
    if (f.phone.isNotBlank()) {
      // the dialler with the number typed in: the rep presses call, on the SIM they choose
      val dial = PendingIntent.getActivity(
        context, f.id.hashCode() + 1,
        Intent(Intent.ACTION_DIAL, Uri.parse("tel:${f.phone}")).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
        flags
      )
      builder.addAction(android.R.drawable.sym_action_call, "Call now", dial)
    }
    builder.addAction(android.R.drawable.ic_menu_view, "Open", open)
    try {
      NotificationManagerCompat.from(context).notify(f.id.hashCode(), builder.build())
    } catch (_: SecurityException) {
    }
  }
}

class FollowupAlarmReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    val id = intent.getStringExtra("id") ?: return
    FollowupAlarms.fire(context, id)
  }
}

/** Android drops every alarm on reboot; this sets the follow-ups again. */
class FollowupBootReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    if (intent.action != Intent.ACTION_BOOT_COMPLETED && intent.action != Intent.ACTION_MY_PACKAGE_REPLACED) return
    FollowupAlarms.rearm(context)
  }
}
