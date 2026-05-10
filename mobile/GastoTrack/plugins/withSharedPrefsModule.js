/**
 * Expo Config Plugin — SharedPrefs Native Module
 *
 * Writes SharedPrefsModule.kt + SharedPrefsPackage.kt into the Android project.
 * These let JS write the JWT token to SharedPreferences so
 * NotificationService.kt can read it without a JS bridge.
 *
 * NOTE: We do NOT modify MainApplication.kt here because Expo SDK 54+
 * uses the new React Native architecture where packages are auto-registered
 * via the package list. We register via withMainApplication instead.
 */
const {
  withDangerousMod,
  withMainApplication,
} = require('@expo/config-plugins');
const fs   = require('fs');
const path = require('path');

// ── SharedPrefsModule.kt ──────────────────────────────────────────────────────
const KOTLIN_MODULE = `package com.gastotrack.app

import android.content.Context
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

/**
 * Native module that lets React Native JS write values to Android SharedPreferences.
 * Used to store the JWT auth token so NotificationService.kt can read it.
 *
 * Usage in JS:
 *   import { NativeModules } from 'react-native';
 *   NativeModules.SharedPrefs.setString('auth_token', token);
 */
class SharedPrefsModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "SharedPrefs"

    @ReactMethod
    fun setString(key: String, value: String) {
        reactApplicationContext
            .getSharedPreferences("gastotrack_prefs", Context.MODE_PRIVATE)
            .edit()
            .putString(key, value)
            .apply()
    }

    @ReactMethod
    fun remove(key: String) {
        reactApplicationContext
            .getSharedPreferences("gastotrack_prefs", Context.MODE_PRIVATE)
            .edit()
            .remove(key)
            .apply()
    }
}
`;

// ── SharedPrefsPackage.kt ─────────────────────────────────────────────────────
const KOTLIN_PACKAGE = `package com.gastotrack.app

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

class SharedPrefsPackage : ReactPackage {
    override fun createNativeModules(ctx: ReactApplicationContext): List<NativeModule> =
        listOf(SharedPrefsModule(ctx))

    override fun createViewManagers(ctx: ReactApplicationContext): List<ViewManager<*, *>> =
        emptyList()
}
`;

// ── Step 1: Write the Kotlin source files ─────────────────────────────────────
function withKotlinFiles(config) {
  return withDangerousMod(config, [
    'android',
    async (config) => {
      const platformRoot = config.modRequest.platformProjectRoot;
      const destDir = path.join(
        platformRoot, 'app', 'src', 'main', 'java', 'com', 'gastotrack', 'app'
      );
      fs.mkdirSync(destDir, { recursive: true });
      fs.writeFileSync(path.join(destDir, 'SharedPrefsModule.kt'),  KOTLIN_MODULE,  'utf8');
      fs.writeFileSync(path.join(destDir, 'SharedPrefsPackage.kt'), KOTLIN_PACKAGE, 'utf8');
      console.log('[withSharedPrefsModule] Wrote SharedPrefsModule.kt + SharedPrefsPackage.kt');
      return config;
    },
  ]);
}

// ── Step 2: Register the package in MainApplication.kt ───────────────────────
// withMainApplication gives us safe access to the generated Kotlin file
function withPackageRegistration(config) {
  return withMainApplication(config, (config) => {
    const contents = config.modResults.contents;

    // Already registered — skip
    if (contents.includes('SharedPrefsPackage')) {
      return config;
    }

    // Expo SDK 54 MainApplication.kt uses:
    //   override fun getPackages(): List<ReactPackage> =
    //     PackageList(this).packages.apply { ... }
    // We append our package inside the apply block.
    const patternApply = /PackageList\(this\)\.packages\.apply\s*\{/;
    if (patternApply.test(contents)) {
      config.modResults.contents = contents.replace(
        patternApply,
        `PackageList(this).packages.apply {\n      add(SharedPrefsPackage())`
      );
      console.log('[withSharedPrefsModule] Registered SharedPrefsPackage in MainApplication.kt');
      return config;
    }

    // Fallback: older pattern with explicit list
    const patternList = /return\s+PackageList\(this\)\.packages/;
    if (patternList.test(contents)) {
      config.modResults.contents = contents.replace(
        patternList,
        `return PackageList(this).packages.also { it.add(SharedPrefsPackage()) }`
      );
      console.log('[withSharedPrefsModule] Registered SharedPrefsPackage (fallback pattern)');
      return config;
    }

    // If neither pattern matched, log a warning but don't crash the build
    console.warn('[withSharedPrefsModule] Could not auto-register SharedPrefsPackage — add it manually to MainApplication.kt');
    return config;
  });
}

module.exports = function withSharedPrefsModule(config) {
  config = withKotlinFiles(config);
  config = withPackageRegistration(config);
  return config;
};
