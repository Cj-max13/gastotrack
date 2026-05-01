/**
 * Expo Config Plugin — SharedPrefs Module
 * Copies the SharedPrefsModule.kt into the Android project so JS can
 * write the JWT token directly to SharedPreferences for the
 * NotificationService to read.
 */
const { withDangerousMod } = require('@expo/config-plugins');
const fs   = require('fs');
const path = require('path');

const KOTLIN_SOURCE = `package com.gastotrack.app

import android.content.Context
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class SharedPrefsModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName() = "SharedPrefs"

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

const PACKAGE_SOURCE = `package com.gastotrack.app

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

module.exports = function withSharedPrefsModule(config) {
  return withDangerousMod(config, [
    'android',
    async (config) => {
      const platformRoot = config.modRequest.platformProjectRoot;
      const destDir = path.join(
        platformRoot, 'app', 'src', 'main', 'java', 'com', 'gastotrack', 'app'
      );
      fs.mkdirSync(destDir, { recursive: true });

      fs.writeFileSync(path.join(destDir, 'SharedPrefsModule.kt'), KOTLIN_SOURCE);
      fs.writeFileSync(path.join(destDir, 'SharedPrefsPackage.kt'), PACKAGE_SOURCE);

      // Register the package in MainApplication if not already there
      const mainAppPath = path.join(
        platformRoot, 'app', 'src', 'main', 'java', 'com', 'gastotrack', 'app', 'MainApplication.kt'
      );
      if (fs.existsSync(mainAppPath)) {
        let content = fs.readFileSync(mainAppPath, 'utf8');
        if (!content.includes('SharedPrefsPackage')) {
          content = content.replace(
            'override fun getPackages()',
            `override fun getPackages()`
          );
          // Insert package registration
          content = content.replace(
            /packages\.add\(new MainReactPackage\(\)\)/,
            `packages.add(new MainReactPackage());\n            packages.add(new SharedPrefsPackage())`
          );
          fs.writeFileSync(mainAppPath, content);
        }
      }

      console.log('[withSharedPrefsModule] SharedPrefs native module added');
      return config;
    },
  ]);
};
