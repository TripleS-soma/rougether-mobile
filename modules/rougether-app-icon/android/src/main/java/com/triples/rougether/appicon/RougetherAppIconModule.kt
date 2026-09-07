package com.triples.rougether.appicon

import android.content.ComponentName
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

// Keep MainActivity enabled for deep links; only launcher aliases are switched.
class RougetherAppIconModule : Module() {
  private val names = listOf("Default", "MissingYou", "Teary", "Sobbing", "DailySuccess", "StreakChampion")

  override fun definition() = ModuleDefinition {
    Name("RougetherAppIcon")
    Function("getAppIconName") { currentName(context()) }
    AsyncFunction("setAlternateAppIcon") { name: String? ->
      synchronized(RougetherAppIconModule::class.java) {
        val context = context()
        val target = name ?: "Default"
        require(target in names) { "Unknown app icon" }
        val pm = context.packageManager
        val desired = component(context, target)
        // Validate all aliases before changing anything so a bad bundle leaves a working launcher.
        names.forEach { pm.getActivityInfo(component(context, it), PackageManager.MATCH_DISABLED_COMPONENTS) }
        if (Build.VERSION.SDK_INT >= 33) {
          pm.setComponentEnabledSettings(names.map {
            PackageManager.ComponentEnabledSetting(component(context, it),
              if (it == target) PackageManager.COMPONENT_ENABLED_STATE_ENABLED
              else PackageManager.COMPONENT_ENABLED_STATE_DISABLED,
              PackageManager.DONT_KILL_APP)
          })
        } else {
          // Enable first: an interrupted switch must never leave the app without a launcher.
          pm.setComponentEnabledSetting(desired, PackageManager.COMPONENT_ENABLED_STATE_ENABLED, PackageManager.DONT_KILL_APP)
          names.filter { it != target }.forEach {
            pm.setComponentEnabledSetting(component(context, it), PackageManager.COMPONENT_ENABLED_STATE_DISABLED, PackageManager.DONT_KILL_APP)
          }
        }
        name
      }
    }
  }

  private fun context(): Context = requireNotNull(appContext.reactContext).applicationContext
  private fun component(context: Context, name: String) = ComponentName(context.packageName, "${context.packageName}.MainActivity$name")
  private fun currentName(context: Context): String? {
    val pm = context.packageManager
    return names.firstOrNull { name ->
      when (pm.getComponentEnabledSetting(component(context, name))) {
        PackageManager.COMPONENT_ENABLED_STATE_ENABLED -> true
        PackageManager.COMPONENT_ENABLED_STATE_DEFAULT -> name == "Default"
        else -> false
      }
    }?.takeUnless { it == "Default" }
  }
}
