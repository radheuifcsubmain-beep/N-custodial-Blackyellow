// Powered by OnSpace.AI
// Biometric/PIN lock screen — shown when wallet is locked
import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, Pressable, ActivityIndicator,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useWallet } from '../../hooks/useWallet';
import { Colors, Spacing, Radii } from '../../constants/theme';

interface LockScreenProps {
  onUnlocked: () => void;
}

const KEYPAD = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'];

export function LockScreen({ onUnlocked }: LockScreenProps) {
  const insets = useSafeAreaInsets();
  const { unlockWithBiometrics, unlockWithPIN, biometricAvailable, biometricEnabled } = useWallet();

  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPin, setShowPin] = useState(false);

  // ─── Biometric unlock ─────────────────────────────────────────────────────
  const handleBiometric = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const success = await unlockWithBiometrics();
      if (success) {
        onUnlocked();
      } else {
        setShowPin(true);
      }
    } catch {
      setShowPin(true);
    } finally {
      setLoading(false);
    }
  }, [unlockWithBiometrics, onUnlocked]);

  // Auto-trigger biometric on mount if available
  useEffect(() => {
    if (biometricAvailable && biometricEnabled) {
      // Small delay to let the screen render first
      const timer = setTimeout(() => {
        handleBiometric();
      }, 300);
      return () => clearTimeout(timer);
    } else {
      setShowPin(true);
    }
  }, []); // run once on mount only

  // ─── PIN verify ───────────────────────────────────────────────────────────
  const handleVerifyPin = useCallback(async (enteredPin: string) => {
    setLoading(true);
    setError('');
    try {
      const success = await unlockWithPIN(enteredPin);
      if (success) {
        onUnlocked();
      } else {
        setError('Incorrect PIN. Please try again.');
        setPin('');
      }
    } catch {
      setError('Verification failed. Please try again.');
      setPin('');
    } finally {
      setLoading(false);
    }
  }, [unlockWithPIN, onUnlocked]);

  // ─── PIN digit press ──────────────────────────────────────────────────────
  const handleDigit = useCallback((digit: string) => {
    if (loading) return;
    setError('');
    setPin(prev => {
      if (prev.length >= 6) return prev;
      const next = prev + digit;
      if (next.length === 6) {
        // Trigger verification on next tick
        setTimeout(() => handleVerifyPin(next), 50);
      }
      return next;
    });
  }, [loading, handleVerifyPin]);

  const handleDelete = useCallback(() => {
    setError('');
    setPin(p => p.slice(0, -1));
  }, []);

  return (
    <View style={[styles.container, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 20 }]}>
      {/* Logo */}
      <View style={styles.logoArea}>
        <View style={styles.shieldBg}>
          <MaterialIcons name="shield" size={40} color={Colors.primary} />
        </View>
        <Text style={styles.appName}>XU Wallet</Text>
        <Text style={styles.subtitle}>Your wallet is locked</Text>
      </View>

      {/* PIN dots */}
      <View style={styles.dotsRow}>
        {Array.from({ length: 6 }).map((_, i) => (
          <View key={i} style={[styles.dot, i < pin.length && styles.dotFilled]} />
        ))}
      </View>

      {/* Error / hint */}
      {error ? (
        <View style={styles.errorRow}>
          <MaterialIcons name="error-outline" size={14} color={Colors.error} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : (
        <Text style={styles.pinHint}>
          {showPin ? 'Enter your 6-digit PIN' : 'Waiting for biometrics...'}
        </Text>
      )}

      {/* Keypad — only shown in PIN mode */}
      {showPin ? (
        <View style={styles.keypad}>
          {KEYPAD.map((key, idx) => {
            if (key === '') return <View key={idx} style={styles.keyEmpty} />;
            if (key === 'del') {
              return (
                <Pressable
                  key={idx}
                  onPress={handleDelete}
                  style={({ pressed }) => [styles.keyBtn, pressed && styles.keyPressed]}
                  hitSlop={8}
                  disabled={loading}
                >
                  <MaterialIcons name="backspace" size={22} color={Colors.textSecondary} />
                </Pressable>
              );
            }
            return (
              <Pressable
                key={idx}
                onPress={() => handleDigit(key)}
                style={({ pressed }) => [styles.keyBtn, pressed && styles.keyPressed]}
                disabled={loading}
              >
                <Text style={styles.keyText}>{key}</Text>
              </Pressable>
            );
          })}
        </View>
      ) : (
        <View style={styles.biometricWaiting}>
          {loading ? (
            <ActivityIndicator size="large" color={Colors.primary} />
          ) : (
            <Pressable onPress={handleBiometric} style={styles.retryBioBtn}>
              <MaterialIcons name="fingerprint" size={48} color={Colors.primary} />
              <Text style={styles.retryBioText}>Tap to authenticate</Text>
            </Pressable>
          )}
        </View>
      )}

      {/* Loading overlay when verifying PIN */}
      {loading && showPin && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      )}

      {/* Switch mode button */}
      {biometricAvailable && biometricEnabled && (
        <Pressable
          onPress={() => {
            if (showPin) {
              setShowPin(false);
              setPin('');
              setError('');
              handleBiometric();
            } else {
              setShowPin(true);
            }
          }}
          style={({ pressed }) => [styles.switchBtn, pressed && { opacity: 0.7 }]}
        >
          <MaterialIcons
            name={showPin ? 'fingerprint' : 'dialpad'}
            size={20}
            color={Colors.primary}
          />
          <Text style={styles.switchText}>
            {showPin ? 'Use Biometrics' : 'Use PIN instead'}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'space-evenly',
    paddingHorizontal: Spacing.xl,
  },
  logoArea: { alignItems: 'center', gap: 12 },
  shieldBg: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.primaryDim,
    borderWidth: 1,
    borderColor: Colors.primary + '44',
    alignItems: 'center',
    justifyContent: 'center',
  },
  appName: { fontSize: 26, fontWeight: '700', color: Colors.textPrimary },
  subtitle: { fontSize: 14, color: Colors.textMuted },
  dotsRow: { flexDirection: 'row', gap: 16 },
  dot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: Colors.surfaceBorder,
    backgroundColor: 'transparent',
  },
  dotFilled: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  pinHint: { fontSize: 13, color: Colors.textMuted },
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  errorText: { fontSize: 13, color: Colors.error },
  keypad: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    width: '100%',
    maxWidth: 300,
    gap: 12,
  },
  keyBtn: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyEmpty: { width: 80, height: 80 },
  keyPressed: { backgroundColor: Colors.primaryDim, borderColor: Colors.primary },
  keyText: { fontSize: 24, fontWeight: '600', color: Colors.textPrimary },
  biometricWaiting: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 180,
  },
  retryBioBtn: { alignItems: 'center', gap: 12 },
  retryBioText: { fontSize: 14, color: Colors.primary, fontWeight: '500' },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(8,11,20,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  switchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: Radii.md,
    backgroundColor: Colors.primaryDim,
    borderWidth: 1,
    borderColor: Colors.primary + '44',
  },
  switchText: { fontSize: 14, fontWeight: '600', color: Colors.primary },
});
