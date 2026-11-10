package expo.modules.calltracker

import android.Manifest
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.content.pm.ServiceInfo
import android.net.Uri
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat

/**
 * Keeps the app's process alive while call tracking is on — the "Background
 * sync" notification callos shows too. With the process alive, the app's own
 * sync loop keeps running and a call is sent the moment it ends, rather than
 * whenever Android next wakes the background task.
 *
 * Started only from the foreground (Android refuses otherwise). Android 15
 * caps this kind of service at six hours a day; when it says time is up the
 * service stops, and the periodic background task carries on.
 */
class SyncService : Service() {
  override fun onBind(intent: Intent?): IBinder? = null

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    val text = intent?.getStringExtra(EXTRA_TEXT) ?: Prefs.of(this).getString(KEY_TEXT, null) ?: "Call tracking is on"
    Prefs.of(this).edit().putString(KEY_TEXT, text).apply()
    val n = build(this, text)
    try {
      if (Build.VERSION.SDK_INT >= 29) {
        startForeground(ID, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC)
      } else {
        startForeground(ID, n)
      }
    } catch (_: Exception) {
      // refused (started from the background, or the daily allowance is spent)
      stopSelf()
    }
    return START_STICKY
  }

  override fun onTimeout(startId: Int) {
    stopSelf()
  }

  override fun onTimeout(startId: Int, fgsType: Int) {
    stopSelf()
  }

  companion object {
    const val CHANNEL = "background-sync"
    const val ID = 4122
    const val EXTRA_TEXT = "text"
    const val KEY_TEXT = "syncServiceText"

    fun channel(context: Context) {
      val nm = context.getSystemService(NotificationManager::class.java) ?: return
      if (Build.VERSION.SDK_INT >= 26 && nm.getNotificationChannel(CHANNEL) == null) {
        nm.createNotificationChannel(
          NotificationChannel(CHANNEL, "Background sync", NotificationManager.IMPORTANCE_LOW).apply {
            description = "Shown while calls are being sent in the background."
            setShowBadge(false)
          }
        )
      }
    }

    fun build(context: Context, text: String): Notification {
      channel(context)
      val open = PendingIntent.getActivity(
        context, ID,
        Intent(Intent.ACTION_VIEW, Uri.parse("callos://calls")).setPackage(context.packageName)
          .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP),
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
      )
      val icon = context.applicationInfo.icon.takeIf { it != 0 } ?: android.R.drawable.stat_notify_sync
      return NotificationCompat.Builder(context, CHANNEL)
        .setSmallIcon(icon)
        .setContentTitle("Call tracking is on")
        .setContentText(text)
        .setContentIntent(open)
        .setOngoing(true)
        .setOnlyAlertOnce(true)
        .setSilent(true)
        .setPriority(NotificationCompat.PRIORITY_LOW)
        .setCategory(NotificationCompat.CATEGORY_SERVICE)
        .build()
    }

    fun start(context: Context, text: String?): Boolean = try {
      val i = Intent(context, SyncService::class.java).apply { if (text != null) putExtra(EXTRA_TEXT, text) }
      ContextCompat.startForegroundService(context, i)
      true
    } catch (_: Exception) {
      false
    }

    fun stop(context: Context) {
      context.stopService(Intent(context, SyncService::class.java))
    }

    /** New text on the running notification, without restarting the service. */
    fun update(context: Context, text: String) {
      Prefs.of(context).edit().putString(KEY_TEXT, text).apply()
      if (!canNotify(context)) return
      try {
        NotificationManagerCompat.from(context).notify(ID, build(context, text))
      } catch (_: SecurityException) {
      }
    }

    fun canNotify(context: Context) = Build.VERSION.SDK_INT < 33 ||
      ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED
  }
}

/** Ordinary notifications the app posts itself: coaching comments, a SIM change. */
object AppNotices {
  private fun channel(context: Context, id: String, name: String, description: String) {
    val nm = context.getSystemService(NotificationManager::class.java) ?: return
    if (Build.VERSION.SDK_INT >= 26 && nm.getNotificationChannel(id) == null) {
      nm.createNotificationChannel(
        NotificationChannel(id, name, NotificationManager.IMPORTANCE_HIGH).apply { this.description = description }
      )
    }
  }

  fun post(context: Context, kind: String, id: Int, title: String, text: String, url: String?) {
    if (!SyncService.canNotify(context)) return
    when (kind) {
      "coaching" -> channel(context, "coaching", "Comments from your manager", "When someone comments on one of your calls, or replies.")
      else -> channel(context, "phone-setup", "Phone setup", "When something stops calls being tracked, like a SIM change.")
    }
    val chan = if (kind == "coaching") "coaching" else "phone-setup"
    val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url ?: "callos://")).setPackage(context.packageName)
      .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
    val open = PendingIntent.getActivity(context, id, intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
    val icon = context.applicationInfo.icon.takeIf { it != 0 } ?: android.R.drawable.ic_dialog_info
    val n = NotificationCompat.Builder(context, chan)
      .setSmallIcon(icon)
      .setContentTitle(title)
      .setContentText(text)
      .setStyle(NotificationCompat.BigTextStyle().bigText(text))
      .setContentIntent(open)
      .setAutoCancel(true)
      .setPriority(NotificationCompat.PRIORITY_HIGH)
      .build()
    try {
      NotificationManagerCompat.from(context).notify(id, n)
    } catch (_: SecurityException) {
    }
  }
}
