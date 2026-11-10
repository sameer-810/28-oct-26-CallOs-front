package expo.modules.calltracker

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.telephony.TelephonyManager
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat

object Prefs {
  const val FILE = "callos.calltracker"
  const val PROMPT_ENABLED = "promptEnabled"
  const val LAST_STATE = "lastState"
  const val LAST_ENDED_AT = "lastEndedAt"
  fun of(context: Context): SharedPreferences = context.getSharedPreferences(FILE, Context.MODE_PRIVATE)
}

/**
 * Watches the phone's call state. When an answered call ends, the app opens
 * on the after-call sheet — status, notes, follow-up — while the call is
 * fresh. Android 10+ only lets a background app open a screen if the rep
 * allowed "Display over other apps"; without that, a quiet notification asks
 * instead.
 */
class CallStateReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    if (intent.action != TelephonyManager.ACTION_PHONE_STATE_CHANGED) return
    val state = intent.getStringExtra(TelephonyManager.EXTRA_STATE) ?: return
    val prefs = Prefs.of(context)
    val previous = prefs.getString(Prefs.LAST_STATE, TelephonyManager.EXTRA_STATE_IDLE)
    prefs.edit().putString(Prefs.LAST_STATE, state).apply()

    // only a call that was answered (OFFHOOK) then ended is worth asking about;
    // RINGING → IDLE is a missed call, which shows up in the call log as such
    if (state == TelephonyManager.EXTRA_STATE_IDLE && previous == TelephonyManager.EXTRA_STATE_OFFHOOK) {
      prefs.edit().putLong(Prefs.LAST_ENDED_AT, System.currentTimeMillis()).apply()
      if (prefs.getBoolean(Prefs.PROMPT_ENABLED, true) && !openSheet(context)) notify(context)
    }
  }

  private fun afterCallIntent(context: Context) =
    Intent(Intent.ACTION_VIEW, Uri.parse("callos://after-call")).setPackage(context.packageName)
      .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)

  /** Straight to the sheet, when the phone allows it. */
  private fun openSheet(context: Context): Boolean {
    if (!PhoneChecks.overlay(context)) return false
    return try {
      context.startActivity(afterCallIntent(context))
      true
    } catch (_: Exception) {
      false
    }
  }

  private fun notify(context: Context) {
    if (Build.VERSION.SDK_INT >= 33 &&
      ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
    ) return

    val nm = context.getSystemService(NotificationManager::class.java) ?: return
    if (Build.VERSION.SDK_INT >= 26 && nm.getNotificationChannel(CHANNEL) == null) {
      nm.createNotificationChannel(
        NotificationChannel(CHANNEL, "After a call", NotificationManager.IMPORTANCE_DEFAULT).apply {
          description = "Asks how a work call went, so the status is set while you remember."
          setSound(null, null)
        }
      )
    }

    val open = afterCallIntent(context)
    val pending = PendingIntent.getActivity(
      context, 0, open, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )
    val icon = context.applicationInfo.icon.takeIf { it != 0 } ?: android.R.drawable.sym_action_call

    val n = NotificationCompat.Builder(context, CHANNEL)
      .setSmallIcon(icon)
      .setContentTitle("How did the call go?")
      .setContentText("Tap to set a status and notes while it's fresh.")
      .setContentIntent(pending)
      .setAutoCancel(true)
      .setCategory(NotificationCompat.CATEGORY_REMINDER)
      .setTimeoutAfter(15 * 60 * 1000L)
      .build()
    try {
      NotificationManagerCompat.from(context).notify(NOTIFICATION_ID, n)
    } catch (_: SecurityException) {
    }
  }

  companion object {
    const val CHANNEL = "after-call"
    const val NOTIFICATION_ID = 4120
  }
}
