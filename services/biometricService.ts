// Powered by OnSpace.AI
// Biometric authentication — platform-safe (no crash on web)
import { Platform } from 'react-native';

const BIOMETRIC_ENABLED_KEY = 'nw_biometric_enabled';
const BIOMETRIC_PIN_KEY = 'nw_biometric_pin';

// ─── Platform-safe secure storage ────────────────────────────────────────────

async function safeGet(key: string): Promise<string | null> {
  try {
    if (Platform.OS === 'web') {
      return localStorage.getItem(key);
    }
    const SecureStore = await import('expo-secure-store');
    return await SecureStore.getItemAsync(key);
  } catch {
    try { return localStorage.getItem(key); } catch { return null; }
  }
}

async function safeSet(key: string, value: string): Promise<void> {
  try {
    if (Platform.OS === 'web') {
      localStorage.setItem(key, value);
      return;
    }
    const SecureStore = await import('expo-secure-store');
    await SecureStore.setItemAsync(key, value);
  } catch {
    try { localStorage.setItem(key, value); } catch { /* ignore */ }
  }
}

// ─── Device biometric capability ─────────────────────────────────────────────

export async function isBiometricAvailable(): Promise<boolean> {
  // Web doesn't support expo-local-authentication
  if (Platform.OS === 'web') return false;
  try {
    const LA = await import('expo-local-authentication');
    const compatible = await LA.hasHardwareAsync();
    const enrolled = await LA.isEnrolledAsync();
    return compatible && enrolled;
  } catch {
    return false;
  }
}

// ─── Enable / disable ────────────────────────────────────────────────────────

export async function setBiometricEnabled(enabled: boolean): Promise<void> {
  await safeSet(BIOMETRIC_ENABLED_KEY, enabled ? 'true' : 'false');
}

export async function isBiometricEnabled(): Promise<boolean> {
  const val = await safeGet(BIOMETRIC_ENABLED_KEY);
  return val === 'true';
}

// ─── PIN ─────────────────────────────────────────────────────────────────────

export async function savePIN(pin: string): Promise<void> {
  await safeSet(BIOMETRIC_PIN_KEY, pin);
}

export async function verifyPIN(pin: string): Promise<boolean> {
  const stored = await safeGet(BIOMETRIC_PIN_KEY);
  return !!stored && stored === pin;
}

export async function hasPIN(): Promise<boolean> {
  const pin = await safeGet(BIOMETRIC_PIN_KEY);
  return !!pin && pin.length >= 4;
}

// ─── Authentication ───────────────────────────────────────────────────────────

export interface AuthResult {
  success: boolean;
  error?: string;
}

export async function authenticateWithBiometrics(
  promptMessage = 'Unlock XU Wallet'
): Promise<AuthResult> {
  if (Platform.OS === 'web') return { success: false, error: 'Not supported on web' };
  try {
    const LA = await import('expo-local-authentication');
    const available = await isBiometricAvailable();
    if (!available) return { success: false, error: 'Biometrics not available' };

    const result = await LA.authenticateAsync({
      promptMessage,
      fallbackLabel: 'Use PIN',
      cancelLabel: 'Cancel',
      disableDeviceFallback: false,
    });

    if (result.success) return { success: true };
    return { success: false, error: result.error };
  } catch (err: any) {
    return { success: false, error: err?.message ?? 'Authentication error' };
  }
}
