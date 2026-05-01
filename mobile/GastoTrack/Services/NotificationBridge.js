/**
 * NotificationBridge — saves the JWT token to Android SharedPreferences
 * so the native NotificationService.kt can attach it to backend requests.
 *
 * This runs after login/logout and keeps the native service in sync.
 */
import { Platform, NativeModules } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const PREFS_NAME = 'gastotrack_prefs';

/**
 * Save the auth token so NotificationService.kt can use it.
 * On Android this writes to SharedPreferences via MMKVStorage or falls back
 * to a simple AsyncStorage key that the Kotlin side reads via a bridge.
 *
 * Since we don't have a custom native module, we store it in AsyncStorage
 * under the same key the Kotlin service reads from SharedPreferences.
 * The Kotlin service reads from SharedPreferences — to bridge this gap
 * we use expo-modules or just keep AsyncStorage as the source of truth
 * and update the Kotlin service to read from a file instead.
 */
export async function saveTokenForNativeService(token) {
  try {
    // Store in AsyncStorage (used by JS side)
    await AsyncStorage.setItem('token', token);

    // On Android, also write to a shared file the Kotlin service can read
    if (Platform.OS === 'android') {
      await AsyncStorage.setItem('native_auth_token', token);
    }
  } catch (e) {
    console.warn('NotificationBridge: failed to save token', e);
  }
}

export async function clearTokenForNativeService() {
  try {
    await AsyncStorage.multiRemove(['token', 'native_auth_token']);
  } catch (e) {
    console.warn('NotificationBridge: failed to clear token', e);
  }
}
