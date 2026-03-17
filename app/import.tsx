// Powered by OnSpace.AI
import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, Pressable, ScrollView,
  TextInput, Alert, Platform, Modal, TouchableOpacity,
  KeyboardAvoidingView, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useWallet } from '../hooks/useWallet';
import { Colors, Spacing, Radii } from '../constants/theme';

type Step = 'phrase' | 'pin';

export default function ImportWalletScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { importWallet, setupPIN } = useWallet();

  const [step, setStep] = useState<Step>('phrase');
  const [inputMnemonic, setInputMnemonic] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [alertConfig, setAlertConfig] = useState({ visible: false, title: '', message: '' });

  // PIN state
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [showConfirmPin, setShowConfirmPin] = useState(false);

  const showAlert = useCallback((title: string, message: string) => {
    if (Platform.OS === 'web') {
      setAlertConfig({ visible: true, title, message });
    } else {
      Alert.alert(title, message);
    }
  }, []);

  const wordCount = inputMnemonic.trim() ? inputMnemonic.trim().split(/\s+/).length : 0;

  // Step 1 — validate mnemonic and advance to PIN
  const handleValidatePhrase = useCallback(async () => {
    if (!inputMnemonic.trim()) { setError('Please enter your seed phrase'); return; }
    if (wordCount !== 12 && wordCount !== 24) {
      setError(`Please enter exactly 12 words (currently ${wordCount})`);
      return;
    }
    setError('');
    setStep('pin');
    setPin('');
    setConfirmPin('');
    setPinError('');
  }, [inputMnemonic, wordCount]);

  // Step 2 — set PIN and finish import
  const handleImport = useCallback(async () => {
    const trimmedPin = pin.trim();
    const trimmedConfirm = confirmPin.trim();

    if (trimmedPin.length < 6) { setPinError('PIN must be at least 6 digits'); return; }
    if (!/^\d+$/.test(trimmedPin)) { setPinError('PIN must contain only numbers'); return; }
    if (trimmedPin !== trimmedConfirm) { setPinError('PINs do not match. Please try again.'); return; }

    if (loading) return;
    setPinError('');
    setLoading(true);
    try {
      const success = await importWallet(inputMnemonic);
      if (success) {
        await setupPIN(trimmedPin);
        router.replace('/(tabs)');
      } else {
        setStep('phrase');
        setError('Invalid seed phrase. Please check your words and try again.');
      }
    } catch {
      showAlert('Error', 'Failed to import wallet. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [pin, confirmPin, inputMnemonic, importWallet, setupPIN, loading, showAlert, router]);

  const wordChips = inputMnemonic.trim() ? inputMnemonic.trim().split(/\s+/) : [];

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1 }}
    >
      <View style={[styles.container, { paddingTop: insets.top }]}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable
            onPress={() => {
              if (step === 'pin') setStep('phrase');
              else router.back();
            }}
            style={styles.backBtn}
            hitSlop={8}
          >
            <MaterialIcons name="arrow-back" size={24} color={Colors.textPrimary} />
          </Pressable>
          <Text style={styles.headerTitle}>Import Wallet</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Step indicator */}
        <View style={styles.stepRow}>
          {(['phrase', 'pin'] as Step[]).map((s, idx) => {
            const steps: Step[] = ['phrase', 'pin'];
            const isDone = steps.indexOf(step) > idx;
            const isActive = step === s;
            return (
              <React.Fragment key={s}>
                <View style={[styles.stepDot, isActive && styles.stepDotActive, isDone && styles.stepDotDone]}>
                  {isDone
                    ? <MaterialIcons name="check" size={12} color={Colors.background} />
                    : <Text style={styles.stepDotText}>{idx + 1}</Text>
                  }
                </View>
                {idx < 1 && <View style={[styles.stepLine, isDone && styles.stepLineDone]} />}
              </React.Fragment>
            );
          })}
        </View>
        <Text style={styles.stepLabel}>{step === 'phrase' ? 'Seed Phrase' : 'Set PIN'}</Text>

        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 40 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* ── Step 1: Seed phrase ── */}
          {step === 'phrase' && (
            <>
              <View style={styles.securityBanner}>
                <MaterialIcons name="lock" size={18} color={Colors.accent} />
                <Text style={styles.securityText}>
                  Your seed phrase stays on your device. We never have access to it.
                </Text>
              </View>

              <Text style={styles.title}>Enter Seed Phrase</Text>
              <Text style={styles.subtitle}>
                Enter your 12 or 24-word recovery phrase separated by spaces.
              </Text>

              <View style={styles.wordCountRow}>
                <Text style={styles.wordCountLabel}>Words entered:</Text>
                <View style={[styles.wordCountBadge, (wordCount === 12 || wordCount === 24) ? styles.wordCountValid : null]}>
                  <Text style={[styles.wordCountNum, (wordCount === 12 || wordCount === 24) ? { color: Colors.accent } : null]}>
                    {wordCount} / 12
                  </Text>
                </View>
              </View>

              <View style={[styles.inputCard, error ? styles.inputCardError : null]}>
                <TextInput
                  value={inputMnemonic}
                  onChangeText={(t) => { setInputMnemonic(t.toLowerCase()); setError(''); }}
                  placeholder="Enter word1 word2 word3..."
                  placeholderTextColor={Colors.textMuted}
                  multiline
                  numberOfLines={4}
                  style={styles.textInput}
                  autoCapitalize="none"
                  autoCorrect={false}
                  spellCheck={false}
                />
              </View>

              {error ? (
                <View style={styles.errorRow}>
                  <MaterialIcons name="error-outline" size={14} color={Colors.error} />
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              ) : null}

              {wordChips.length > 0 && (
                <View style={styles.chipGrid}>
                  {wordChips.map((word, idx) => (
                    <View key={idx} style={styles.wordChip}>
                      <Text style={styles.chipNum}>{idx + 1}</Text>
                      <Text style={styles.chipWord}>{word}</Text>
                    </View>
                  ))}
                </View>
              )}

              <View style={styles.warningBox}>
                <MaterialIcons name="warning-amber" size={16} color={Colors.warning} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.warningTitle}>Security Warnings:</Text>
                  <Text style={styles.warningItem}>• Only import on trusted devices</Text>
                  <Text style={styles.warningItem}>• Clear clipboard after pasting</Text>
                  <Text style={styles.warningItem}>• Never import on public/shared devices</Text>
                </View>
              </View>

              <Pressable
                onPress={handleValidatePhrase}
                disabled={wordCount === 0}
                style={({ pressed }) => [
                  styles.primaryBtn, pressed && styles.pressed,
                  wordCount === 0 && styles.primaryBtnDisabled,
                ]}
              >
                <MaterialIcons name="arrow-forward" size={20} color={Colors.textInverse} />
                <Text style={styles.primaryBtnText}>Continue to Set PIN</Text>
              </Pressable>
            </>
          )}

          {/* ── Step 2: PIN setup ── */}
          {step === 'pin' && (
            <>
              <View style={styles.pinHeaderCard}>
                <View style={styles.pinIconBg}>
                  <MaterialIcons name="lock" size={32} color={Colors.primary} />
                </View>
                <Text style={styles.stepTitle}>Set Your Wallet PIN</Text>
                <Text style={styles.stepSubtitle}>
                  This PIN protects your wallet every time you open the app.
                </Text>
              </View>

              <View style={styles.pinFieldGroup}>
                <Text style={styles.pinFieldLabel}>Create PIN (6+ digits)</Text>
                <View style={[styles.pinInputWrapper, pinError && pin.length > 0 ? styles.inputError : null]}>
                  <MaterialIcons name="lock-outline" size={18} color={Colors.textMuted} />
                  <TextInput
                    value={pin}
                    onChangeText={(t) => { setPin(t); setPinError(''); }}
                    placeholder="Enter 6-digit PIN"
                    placeholderTextColor={Colors.textMuted}
                    style={styles.pinTextInput}
                    keyboardType="number-pad"
                    secureTextEntry={!showPin}
                    maxLength={12}
                  />
                  <Pressable onPress={() => setShowPin(!showPin)} hitSlop={8}>
                    <MaterialIcons name={showPin ? 'visibility-off' : 'visibility'} size={18} color={Colors.textMuted} />
                  </Pressable>
                </View>
                <View style={styles.pinDots}>
                  {Array.from({ length: 6 }).map((_, i) => (
                    <View key={i} style={[styles.pinDot, i < pin.length && styles.pinDotFilled, pin.length >= 6 && styles.pinDotComplete]} />
                  ))}
                </View>
              </View>

              <View style={styles.pinFieldGroup}>
                <Text style={styles.pinFieldLabel}>Confirm PIN</Text>
                <View style={[
                  styles.pinInputWrapper,
                  confirmPin.length > 0 && confirmPin === pin ? styles.inputSuccess : null,
                  confirmPin.length > 0 && confirmPin !== pin && confirmPin.length >= pin.length ? styles.inputError : null,
                ]}>
                  <MaterialIcons name="lock-outline" size={18} color={Colors.textMuted} />
                  <TextInput
                    value={confirmPin}
                    onChangeText={(t) => { setConfirmPin(t); setPinError(''); }}
                    placeholder="Re-enter your PIN"
                    placeholderTextColor={Colors.textMuted}
                    style={styles.pinTextInput}
                    keyboardType="number-pad"
                    secureTextEntry={!showConfirmPin}
                    maxLength={12}
                  />
                  <Pressable onPress={() => setShowConfirmPin(!showConfirmPin)} hitSlop={8}>
                    <MaterialIcons name={showConfirmPin ? 'visibility-off' : 'visibility'} size={18} color={Colors.textMuted} />
                  </Pressable>
                </View>
                {confirmPin.length > 0 && confirmPin === pin && (
                  <View style={styles.matchRow}>
                    <MaterialIcons name="check-circle" size={14} color={Colors.accent} />
                    <Text style={styles.matchText}>PINs match</Text>
                  </View>
                )}
              </View>

              {pinError ? (
                <View style={styles.errorRow}>
                  <MaterialIcons name="error-outline" size={14} color={Colors.error} />
                  <Text style={styles.errorText}>{pinError}</Text>
                </View>
              ) : null}

              <View style={styles.pinNote}>
                <MaterialIcons name="info-outline" size={14} color={Colors.textMuted} />
                <Text style={styles.pinNoteText}>
                  Store your PIN safely. It cannot be recovered but you can restore the wallet with your seed phrase.
                </Text>
              </View>

              <Pressable
                onPress={handleImport}
                disabled={loading || pin.length < 6 || confirmPin.length < 6}
                style={({ pressed }) => [
                  styles.primaryBtn, pressed && styles.pressed,
                  (loading || pin.length < 6 || confirmPin.length < 6) && styles.primaryBtnDisabled,
                ]}
              >
                {loading ? (
                  <ActivityIndicator color={Colors.textInverse} />
                ) : (
                  <>
                    <MaterialIcons name="file-download" size={20} color={Colors.textInverse} />
                    <Text style={styles.primaryBtnText}>Import Wallet</Text>
                  </>
                )}
              </Pressable>
            </>
          )}
        </ScrollView>

        {Platform.OS === 'web' && (
          <Modal visible={alertConfig.visible} transparent animationType="fade">
            <View style={styles.modalOverlay}>
              <View style={styles.modalCard}>
                <Text style={styles.modalTitle}>{alertConfig.title}</Text>
                <Text style={styles.modalMessage}>{alertConfig.message}</Text>
                <TouchableOpacity
                  style={styles.modalBtn}
                  onPress={() => setAlertConfig(prev => ({ ...prev, visible: false }))}
                >
                  <Text style={styles.modalBtnText}>OK</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '600', color: Colors.textPrimary },

  stepRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: Spacing.xl, paddingTop: Spacing.sm, paddingBottom: 4, gap: 4,
  },
  stepDot: {
    width: 28, height: 28, borderRadius: Radii.full,
    backgroundColor: Colors.surfaceElevated, borderWidth: 1.5, borderColor: Colors.surfaceBorder,
    alignItems: 'center', justifyContent: 'center',
  },
  stepDotActive: { borderColor: Colors.primary, backgroundColor: Colors.primaryDim },
  stepDotDone: { borderColor: Colors.accent, backgroundColor: Colors.accent },
  stepDotText: { fontSize: 11, fontWeight: '600', color: Colors.textSecondary },
  stepLine: { flex: 1, height: 2, backgroundColor: Colors.surfaceBorder, borderRadius: 1 },
  stepLineDone: { backgroundColor: Colors.accent },
  stepLabel: { textAlign: 'center', fontSize: 12, color: Colors.textMuted, fontWeight: '500', marginBottom: Spacing.xs, letterSpacing: 0.5 },

  scrollContent: { padding: Spacing.md, gap: Spacing.md },
  securityBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.accentDim, borderRadius: Radii.sm,
    borderWidth: 1, borderColor: Colors.accent + '44', padding: Spacing.sm,
  },
  securityText: { flex: 1, fontSize: 12, color: Colors.accent, lineHeight: 18 },
  title: { fontSize: 22, fontWeight: '700', color: Colors.textPrimary },
  subtitle: { fontSize: 14, color: Colors.textSecondary, lineHeight: 20 },
  wordCountRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  wordCountLabel: { fontSize: 13, color: Colors.textMuted },
  wordCountBadge: {
    paddingHorizontal: 10, paddingVertical: 3, backgroundColor: Colors.surfaceElevated,
    borderRadius: Radii.full, borderWidth: 1, borderColor: Colors.surfaceBorder,
  },
  wordCountValid: { borderColor: Colors.accent },
  wordCountNum: { fontSize: 12, fontWeight: '600', color: Colors.textSecondary },
  inputCard: {
    backgroundColor: Colors.surfaceElevated, borderRadius: Radii.md,
    borderWidth: 1, borderColor: Colors.surfaceBorder, padding: Spacing.sm,
  },
  inputCardError: { borderColor: Colors.error },
  textInput: { color: Colors.textPrimary, fontSize: 15, lineHeight: 22, minHeight: 100, textAlignVertical: 'top', fontFamily: 'monospace' },
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  errorText: { fontSize: 13, color: Colors.error, flex: 1 },
  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  wordChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Colors.surfaceElevated, borderRadius: Radii.sm,
    paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderColor: Colors.surfaceBorder,
  },
  chipNum: { fontSize: 10, color: Colors.textMuted, minWidth: 12 },
  chipWord: { fontSize: 12, color: Colors.primary, fontFamily: 'monospace' },
  warningBox: {
    flexDirection: 'row', gap: 8, backgroundColor: Colors.warning + '15',
    borderRadius: Radii.sm, borderWidth: 1, borderColor: Colors.warning + '44', padding: Spacing.md,
  },
  warningTitle: { fontSize: 13, fontWeight: '600', color: Colors.warning, marginBottom: 4 },
  warningItem: { fontSize: 12, color: Colors.warning, lineHeight: 18 },

  primaryBtn: {
    height: 52, backgroundColor: Colors.primary, borderRadius: Radii.md,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  primaryBtnDisabled: { opacity: 0.5 },
  primaryBtnText: { fontSize: 16, fontWeight: '600', color: Colors.textInverse },
  pressed: { opacity: 0.8, transform: [{ scale: 0.98 }] },

  // PIN step styles
  pinHeaderCard: { alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.sm },
  pinIconBg: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: Colors.primaryDim, borderWidth: 1, borderColor: Colors.primary + '44',
    alignItems: 'center', justifyContent: 'center', marginBottom: 4,
  },
  stepTitle: { fontSize: 20, fontWeight: '700', color: Colors.textPrimary },
  stepSubtitle: { fontSize: 14, color: Colors.textSecondary, lineHeight: 20, textAlign: 'center' },
  pinFieldGroup: { gap: 8 },
  pinFieldLabel: { fontSize: 13, fontWeight: '500', color: Colors.textSecondary },
  pinInputWrapper: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: Colors.surfaceElevated, borderRadius: Radii.md,
    borderWidth: 1.5, borderColor: Colors.surfaceBorder,
    paddingHorizontal: Spacing.sm, height: 52,
  },
  inputError: { borderColor: Colors.error + '99' },
  inputSuccess: { borderColor: Colors.accent + '99' },
  pinTextInput: { flex: 1, color: Colors.textPrimary, fontSize: 20, letterSpacing: 6, textAlign: 'center', includeFontPadding: false },
  pinDots: { flexDirection: 'row', justifyContent: 'center', gap: 10, paddingVertical: 4 },
  pinDot: { width: 10, height: 10, borderRadius: 5, borderWidth: 1.5, borderColor: Colors.surfaceBorder, backgroundColor: 'transparent' },
  pinDotFilled: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  pinDotComplete: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  matchRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  matchText: { fontSize: 12, color: Colors.accent, fontWeight: '500' },
  pinNote: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: Colors.surfaceElevated, borderRadius: Radii.sm,
    borderWidth: 1, borderColor: Colors.surfaceBorder, padding: Spacing.sm,
  },
  pinNoteText: { flex: 1, fontSize: 12, color: Colors.textMuted, lineHeight: 18 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center' },
  modalCard: {
    backgroundColor: Colors.surfaceElevated, borderRadius: Radii.lg,
    padding: Spacing.lg, width: 300, borderWidth: 1, borderColor: Colors.surfaceBorder,
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary, marginBottom: 8 },
  modalMessage: { fontSize: 14, color: Colors.textSecondary, lineHeight: 20, marginBottom: 16 },
  modalBtn: { backgroundColor: Colors.primary, borderRadius: Radii.md, padding: 12, alignItems: 'center' },
  modalBtnText: { color: Colors.textInverse, fontWeight: '600', fontSize: 15 },
});
