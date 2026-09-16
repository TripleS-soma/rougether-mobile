package com.triples.rougether.installreferrer

import android.content.Context
import com.android.installreferrer.api.InstallReferrerClient
import com.android.installreferrer.api.InstallReferrerClient.InstallReferrerResponse
import com.android.installreferrer.api.InstallReferrerStateListener
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.util.concurrent.atomic.AtomicBoolean

// Reads the Play Install Referrer once per call. Play keeps the value for 90 days after
// install, so callers decide (in JS) when it has been consumed. No runtime permission.
class RougetherInstallReferrerModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("RougetherInstallReferrer")

    // Resolves the raw referrer string ("invite_type=friend&invite_code=…" from our landing,
    // "utm_source=google-play&utm_medium=organic" for organic installs) or null when the
    // device/store cannot answer (sideload, no Play, old Play). Rejects only on transient
    // failures so JS can retry on the next launch.
    AsyncFunction("getInstallReferrer") { promise: Promise ->
      val context = requireNotNull(appContext.reactContext).applicationContext
      readReferrer(context, promise)
    }
  }

  private fun readReferrer(context: Context, promise: Promise) {
    val client = InstallReferrerClient.newBuilder(context).build()
    val settled = AtomicBoolean(false)
    fun settle(block: () -> Unit) {
      if (settled.compareAndSet(false, true)) {
        try {
          block()
        } finally {
          runCatching { client.endConnection() }
        }
      }
    }
    try {
      client.startConnection(object : InstallReferrerStateListener {
        override fun onInstallReferrerSetupFinished(responseCode: Int) {
          settle {
            when (responseCode) {
              InstallReferrerResponse.OK -> {
                val referrer = runCatching { client.installReferrer.installReferrer }.getOrNull()
                promise.resolve(referrer)
              }
              InstallReferrerResponse.SERVICE_UNAVAILABLE ->
                promise.reject("ERR_INSTALL_REFERRER_UNAVAILABLE", "Play Store service unavailable", null)
              // FEATURE_NOT_SUPPORTED / DEVELOPER_ERROR / PERMISSION_ERROR — retrying won't help.
              else -> promise.resolve(null)
            }
          }
        }

        override fun onInstallReferrerServiceDisconnected() {
          settle { promise.reject("ERR_INSTALL_REFERRER_DISCONNECTED", "Play Store service disconnected", null) }
        }
      })
    } catch (e: Exception) {
      // SecurityException etc. from startConnection — treat as "cannot answer on this device".
      settle { promise.resolve(null) }
    }
  }
}
