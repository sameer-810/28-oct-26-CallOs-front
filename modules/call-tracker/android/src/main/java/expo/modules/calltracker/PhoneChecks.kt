package expo.modules.calltracker

import android.Manifest
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.net.Uri
import android.os.BatteryManager
import android.os.Build
import android.os.PowerManager
import android.provider.Settings
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat

/**
 * The phone settings that silently stop call tracking when they're off, and
 * the system screen that turns each one on. Each brand hides auto-start and
 * battery limits somewhere different, so those are a list of known screens
 * tried in turn, ending at the app's own settings page.
 */
object PhoneChecks {
  private fun granted(context: Context, permission: String) =
    ContextCompat.checkSelfPermission(context, permission) == PackageManager.PERMISSION_GRANTED

  fun batteryUnrestricted(context: Context): Boolean {
    val pm = context.getSystemService(PowerManager::class.java) ?: return true
    return pm.isIgnoringBatteryOptimizations(context.packageName)
  }

  fun overlay(context: Context): Boolean = Settings.canDrawOverlays(context)

  fun notificationListener(context: Context): Boolean =
    NotificationManagerCompat.getEnabledListenerPackages(context).contains(context.packageName)

  fun contacts(context: Context) = granted(context, Manifest.permission.READ_CONTACTS)

  fun callPhone(context: Context) = granted(context, Manifest.permission.CALL_PHONE)

  /** Brands known to kill background apps unless auto-start is switched on by hand. */
  fun autostartNeeded(): Boolean = autostartIntents(null).isNotEmpty()

  fun battery(context: Context): Map<String, Any?> {
    val status = context.registerReceiver(null, IntentFilter(Intent.ACTION_BATTERY_CHANGED))
    val level = status?.getIntExtra(BatteryManager.EXTRA_LEVEL, -1) ?: -1
    val scale = status?.getIntExtra(BatteryManager.EXTRA_SCALE, -1) ?: -1
    val plugged = status?.getIntExtra(BatteryManager.EXTRA_PLUGGED, 0) ?: 0
    val pm = context.getSystemService(PowerManager::class.java)
    return mapOf(
      "level" to if (level >= 0 && scale > 0) (level * 100 / scale) else null,
      "charging" to (plugged != 0),
      "powerSave" to (pm?.isPowerSaveMode ?: false)
    )
  }

  /**
   * The screen for one setting. "autostart" and "battery" try each brand's own
   * screen first; anything that doesn't exist on this phone is skipped.
   */
  fun open(context: Context, what: String): Boolean {
    val pkg = context.packageName
    val forSetting: List<Intent> = when (what) {
      "battery" -> listOf(
        Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, Uri.parse("package:$pkg")),
        Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS)
      ) + oemBatteryIntents()
      "overlay" -> listOf(Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, Uri.parse("package:$pkg")))
      "whatsapp" -> buildList {
        if (Build.VERSION.SDK_INT >= 30) {
          add(
            Intent(Settings.ACTION_NOTIFICATION_LISTENER_DETAIL_SETTINGS).putExtra(
              Settings.EXTRA_NOTIFICATION_LISTENER_COMPONENT_NAME,
              ComponentName(context, WhatsAppCallListener::class.java).flattenToString()
            )
          )
        }
        add(Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS))
      }
      "autostart" -> autostartIntents(context)
      "notifications" -> listOf(
        Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE, pkg)
      )
      "defaultDialer" -> listOf(Intent(Settings.ACTION_MANAGE_DEFAULT_APPS_SETTINGS))
      else -> emptyList()
    }
    // the app's own settings page is always the last resort
    val candidates = forSetting + Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:$pkg"))

    for (intent in candidates) {
      intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      try {
        if (intent.resolveActivity(context.packageManager) != null || intent.component != null) {
          context.startActivity(intent)
          return true
        }
      } catch (_: Exception) {
        // a brand's screen that exists but is not exported: try the next one
      }
    }
    return false
  }

  private fun brand() = (Build.MANUFACTURER + " " + Build.BRAND).lowercase()

  private fun component(pkg: String, cls: String) = Intent().setComponent(ComponentName(pkg, cls))

  /** This brand's auto-start screens; empty where the brand has none. */
  private fun autostartIntents(@Suppress("UNUSED_PARAMETER") context: Context?): List<Intent> {
    val b = brand()
    return when {
      "xiaomi" in b || "redmi" in b || "poco" in b -> listOf(
        component("com.miui.securitycenter", "com.miui.permcenter.autostart.AutoStartManagementActivity")
      )
      "oppo" in b || "realme" in b || "oneplus" in b -> listOf(
        component("com.coloros.safecenter", "com.coloros.safecenter.permission.startup.StartupAppListActivity"),
        component("com.coloros.safecenter", "com.coloros.safecenter.startupapp.StartupAppListActivity"),
        component("com.oplus.safecenter", "com.oplus.safecenter.permission.startup.StartupAppListActivity"),
        component("com.oppo.safe", "com.oppo.safe.permission.startup.StartupAppListActivity"),
        component("com.coloros.oppoguardelf", "com.coloros.powermanager.fuelgaue.PowerUsageModelActivity")
      )
      "vivo" in b || "iqoo" in b -> listOf(
        component("com.vivo.permissionmanager", "com.vivo.permissionmanager.activity.BgStartUpManagerActivity"),
        component("com.iqoo.secure", "com.iqoo.secure.ui.phoneoptimize.BgStartUpManager"),
        component("com.iqoo.secure", "com.iqoo.secure.ui.phoneoptimize.AddWhiteListActivity")
      )
      "huawei" in b || "honor" in b -> listOf(
        component("com.huawei.systemmanager", "com.huawei.systemmanager.startupmgr.ui.StartupNormalAppListActivity"),
        component("com.huawei.systemmanager", "com.huawei.systemmanager.optimize.process.ProtectActivity")
      )
      "samsung" in b -> listOf(
        component("com.samsung.android.lool", "com.samsung.android.sm.battery.ui.BatteryActivity"),
        component("com.samsung.android.sm", "com.samsung.android.sm.battery.ui.BatteryActivity")
      )
      "asus" in b -> listOf(
        component("com.asus.mobilemanager", "com.asus.mobilemanager.autostart.AutoStartActivity")
      )
      "letv" in b -> listOf(
        component("com.letv.android.letvsafe", "com.letv.android.letvsafe.AutobootManageActivity")
      )
      else -> emptyList()
    }
  }

  private fun oemBatteryIntents(): List<Intent> {
    val b = brand()
    return when {
      "xiaomi" in b || "redmi" in b || "poco" in b -> listOf(
        component("com.miui.powerkeeper", "com.miui.powerkeeper.ui.HiddenAppsConfigActivity")
      )
      "huawei" in b || "honor" in b -> listOf(
        component("com.huawei.systemmanager", "com.huawei.systemmanager.power.ui.HwPowerManagerActivity")
      )
      else -> emptyList()
    }
  }
}
