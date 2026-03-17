// Powered by OnSpace.AI
import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, Pressable, ScrollView,
  Alert, Platform, Modal, TouchableOpacity, TextInput,
  KeyboardAvoidingView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useWallet } from '../hooks/useWallet';
import { PrimaryButton } from '../components/ui/PrimaryButton';
import { Colors, Spacing, Radii } from '../constants/theme';

type Step = 'generate' | 'backup' | 'pin';

export default function CreateWalletScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { createWallet, confirmWalletCreation, setupPIN } = useWallet();

  const [step, setStep] = useState<Step>('generate');
  const [mnemonic, setMnemonic] = useState('');
  const [obscured, setObscured] = useState(true);
  const [backedUp, setBackedUp] = useState(false);
  const [loading, setLoading] = useState(false);

  // PIN state
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [showConfirmPin, setShowConfirmPin] = useState(false);

  // Alert state
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertTitle, setAlertTitle] = useState('');
  const [alertMsg, setAlertMsg] = useState('');

  const showAlert = useCallback((title: string, msg: string) => {
    if (Platform.OS === 'web') {
      setAlertTitle(title);
      setAlertMsg(msg);
      setAlertVisible(true);
    } else {
      Alert.alert(title, msg);
    }
  }, []);

  // Step 1: Generate mnemonic
  const handleGenerate = useCallback(async () => {
    if (loading) return;
    setLoading(true);
    try {
      const newMnemonic = await createWallet();
      const wordCount = newMnemonic.trim().split(/\s+/).length;
      if (wordCount !== 12) {
        throw new Error(`Expected 12 words, got ${wordCount}. Please try again.`);
      }
      setMnemonic(newMnemonic);
      setStep('backup');
      setObscured(true);
      setBackedUp(false);
    } catch (err) {
      showAlert('Generation Failed', String(err));
    } finally {
      setLoading(false);
    }
  }, [createWallet, loading, showAlert]);

  // Step 2: Backup confirmed → go to PIN setup
  const handleBackupConfirm = useCallback(() => {
    if (!backedUp) {
      showAlert('Backup Required', 'Please confirm you have written down your seed phrase before continuing.');
      return;
    }
    setPin('');
    setConfirmPin('');
    setPinError('');
    setStep('pin');
  }, [backedUp, showAlert]);

  // Step 3: Set PIN and create wallet
  const handleCreateWallet = useCallback(async () => {
    // Validate PIN
    const trimmedPin = pin.trim();
    const trimmedConfirm = confirmPin.trim();

    if (trimmedPin.length < 6) {
      setPinError('PIN must be at least 6 digits');
      return;
    }
    if (!/^\d+$/.test(trimmedPin)) {
      setPinError('PIN must contain only numbers');
      return;
    }
    if (trimmedPin !== trimmedConfirm) {
      setPinError('PINs do not match. Please try again.');
      return;
    }
    if (!mnemonic) {
      showAlert('Error', 'No seed phrase found. Please go back and generate a new one.');
      return;
    }
    if (loading) return;

    setPinError('');
    setLoading(true);
    try {
      // Save wallet first
      await confirmWalletCreation(mnemonic);
      // Then save PIN (sets PIN for lock screen)
      await setupPIN(trimmedPin);
      router.replace('/(tabs)');
    } catch (err) {
      showAlert('Error', 'Could not create wallet. Please try again.\n\n' + String(err));
    } finally {
      setLoading(false);
    }
  }, [pin, confirmPin, mnemonic, confirmWalletCreation, setupPIN, loading, showAlert, router]);

  const words = mnemonic ? mnemonic.trim().split(/\s+/) : [];
  const STEPS: Step[] = ['generate', 'backup', 'pin'];
  const stepLabels = ['Generate', 'Backup', 'Set PIN'];

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
              if (step === 'pin') setStep('backup');
              else if (step === 'backup') setStep('generate');
              else router.back();
            }}
            style={styles.backBtn}
            hitSlop={8}
          >
            <MaterialIcons name="arrow-back" size={24} color={Colors.textPrimary} />
          </Pressable>
          <Text style={styles.headerTitle}>New Wallet</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Step indicator */}
        <View style={styles.stepRow}>
          {STEPS.map((s, idx) => {
            const isDone = STEPS.indexOf(step) > idx;
            const isActive = step === s;
            return (
              <React.Fragment key={s}>
                <View style={[
                  styles.stepDot,
                  isActive && styles.stepDotActive,
                  isDone && styles.stepDotDone,
                ]}>
                  {isDone
                    ? <MaterialIcons name="check" size={12} color={Colors.background} />
                    : <Text style={styles.stepDotText}>{idx + 1}</Text>
                  }
                </View>
                {idx < STEPS.length - 1 && (
                  <View style={[styles.stepLine, isDone && styles.stepLineDone]} />
                )}
              </React.Fragment>
            );
          })}
        </View>
        {/* Step label */}
        <Text style={styles.stepLabel}>{stepLabels[STEPS.indexOf(step)]}</Text>

        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 40 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* ── Step 1: Generate ── */}
          {step === 'generate' && (
            <View style={styles.section}>
              <View style={styles.infoCard}>
                <View style={styles.infoIconBg}>
                  <MaterialIcons name="security" size={32} color={Colors.primary} />
                </View>
                <Text style={styles.infoTitle}>Non-Custodial Wallet</Text>
                <Text style={styles.infoText}>
                  A 12-word seed phrase will be generated on your device using cryptographically secure randomness. This phrase is the ONLY way to recover your wallet.
                </Text>
                <View style={styles.bulletList}>
                  {[
                    'Write it on paper, not digitally',
                    'Never share it with anyone',
                    'Never enter it on a website',
                    'Keep it offline and secure',
                  ].map((item) => (
                    <View key={item} style={styles.bullet}>
                      <MaterialIcons name="check-circle" size={14} color={Colors.accent} />
                      <Text style={styles.bulletText}>{item}</Text>
                    </View>
                  ))}
                </View>
              </View>
              <PrimaryButton
                title={loading ? 'Generating...' : 'Generate Seed Phrase'}
                onPress={handleGenerate}
                loading={loading}
              />
            </View>
          )}

          {/* ── Step 2: Backup ── */}
          {step === 'backup' && words.length === 12 && (
            <View style={styles.section}>
              <Text style={styles.stepTitle}>Your 12-Word Seed Phrase</Text>
              <Text style={styles.stepSubtitle}>
                Write down all 12 words in order. You will need them to restore your wallet.
              </Text>

              {/* Word grid */}
              <View style={styles.seedCard}>
                <View style={styles.grid}>
                  {words.map((word, idx) => (
                    <View key={idx} style={styles.wordCell}>
                      <Text style={styles.wordIdx}>{idx + 1}</Text>
                      <Text style={styles.wordText}>{obscured ? '••••' : word}</Text>
                    </View>
                  ))}
                </View>
                <Pressable onPress={() => setObscured(!obscured)} style={styles.revealBtn}>
                  <MaterialIcons
                    name={obscured ? 'visibility' : 'visibility-off'}
                    size={16}
                    color={Colors.textSecondary}
                  />
                  <Text style={styles.revealText}>{obscured ? 'Reveal' : 'Hide'} words</Text>
                </Pressable>
              </View>

              <View style={styles.warnBanner}>
                <MaterialIcons name="warning" size={16} color={Colors.warning} />
                <Text style={styles.warnText}>
                  Never screenshot or store this digitally. Anyone with these words controls your funds.
                </Text>
              </View>

              <Pressable onPress={() => setBackedUp(!backedUp)} style={styles.checkRow} hitSlop={4}>
                <View style={[styles.checkbox, backedUp && styles.checkboxChecked]}>
                  {backedUp && <MaterialIcons name="check" size={14} color={Colors.background} />}
                </View>
                <Text style={styles.checkLabel}>
                  I have written down my seed phrase and stored it securely offline
                </Text>
              </Pressable>

              <PrimaryButton
                title="Continue to Set PIN"
                onPress={handleBackupConfirm}
                disabled={!backedUp}
              />
            </View>
          )}

          {/* ── Step 3: PIN Setup ── */}
          {step === 'pin' && (
            <View style={styles.section}>
              <View style={styles.pinHeaderCard}>
                <View style={styles.pinIconBg}>
                  <MaterialIcons name="lock" size={32} color={Colors.primary} />
                </View>
                <Text style={styles.stepTitle}>Set Your Wallet PIN</Text>
                <Text style={styles.stepSubtitle}>
                  This PIN will be used to unlock your wallet. Use it whenever you open the app.
                </Text>
              </View>

              {/* PIN input */}
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
                    accessibilityLabel="Create PIN"
                  />
                  <Pressable onPress={() => setShowPin(!showPin)} hitSlop={8}>
                    <MaterialIcons
                      name={showPin ? 'visibility-off' : 'visibility'}
                      size={18}
                      color={Colors.textMuted}
                    />
                  </Pressable>
                </View>

                {/* PIN strength dots */}
                <View style={styles.pinDots}>
                  {Array.from({ length: 6 }).map((_, i) => (
                    <View
                      key={i}
                      style={[
                        styles.pinDot,
                        i < pin.length && styles.pinDotFilled,
                        pin.length >= 6 && styles.pinDotComplete,
                      ]}
                    />
                  ))}
                </View>
              </View>

              {/* Confirm PIN */}
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
                    accessibilityLabel="Confirm PIN"
                  />
                  <Pressable onPress={() => setShowConfirmPin(!showConfirmPin)} hitSlop={8}>
                    <MaterialIcons
                      name={showConfirmPin ? 'visibility-off' : 'visibility'}
                      size={18}
                      color={confirmPin === pin && confirmPin.length > 0 ? Colors.accent : Colors.textMuted}
                    />
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
                  Store your PIN somewhere safe. It cannot be recovered — but you can always restore your wallet using the seed phrase.
                </Text>
              </View>

              <PrimaryButton
                title={loading ? 'Creating Wallet...' : 'Create Wallet'}
                onPress={handleCreateWallet}
                loading={loading}
                disabled={pin.length < 6 || confirmPin.length < 6}
              />
            </View>
          )}
        </ScrollView>

        {/* Web Alert Modal */}
        {Platform.OS === 'web' && (
          <Modal visible={alertVisible} transparent animationType="fade">
            <View style={styles.modalOverlay}>
              <View style={styles.modalCard}>
                <Text style={styles.modalTitle}>{alertTitle}</Text>
                <Text style={styles.modalMsg}>{alertMsg}</Text>
                <TouchableOpacity style={styles.modalBtn} onPress={() => setAlertVisible(false)}>
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
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1.5, borderColor: Colors.surfaceBorder,
    alignItems: 'center', justifyContent: 'center',
  },
  stepDotActive: { borderColor: Colors.primary, backgroundColor: Colors.primaryDim },
  stepDotDone: { borderColor: Colors.accent, backgroundColor: Colors.accent },
  stepDotText: { fontSize: 11, fontWeight: '600', color: Colors.textSecondary },
  stepLine: { flex: 1, height: 2, backgroundColor: Colors.surfaceBorder, borderRadius: 1 },
  stepLineDone: { backgroundColor: Colors.accent },
  stepLabel: {
    textAlign: 'center', fontSize: 12, color: Colors.textMuted,
    fontWeight: '500', marginBottom: Spacing.xs, letterSpacing: 0.5,
  },

  scroll: { padding: Spacing.md, gap: Spacing.md },
  section: { gap: Spacing.md },

  // Generate step
  infoCard: {
    backgroundColor: Colors.surfaceElevated, borderRadius: Radii.lg,
    borderWidth: 1, borderColor: Colors.primary + '33',
    padding: Spacing.lg, alignItems: 'center', gap: Spacing.sm,
  },
  infoIconBg: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: Colors.primaryDim,
    borderWidth: 1, borderColor: Colors.primary + '44',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 4,
  },
  infoTitle: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary, textAlign: 'center' },
  infoText: { fontSize: 14, color: Colors.textSecondary, lineHeight: 22, textAlign: 'center' },
  bulletList: { width: '100%', gap: 6, marginTop: 4 },
  bullet: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  bulletText: { fontSize: 13, color: Colors.textSecondary, flex: 1 },

  // Backup step
  stepTitle: { fontSize: 20, fontWeight: '700', color: Colors.textPrimary },
  stepSubtitle: { fontSize: 14, color: Colors.textSecondary, lineHeight: 20 },
  seedCard: {
    backgroundColor: Colors.surfaceElevated, borderRadius: Radii.lg,
    borderWidth: 1, borderColor: Colors.surfaceBorder, padding: Spacing.md, gap: Spacing.md,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  wordCell: {
    width: '30%', flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Colors.surface, borderRadius: Radii.sm,
    borderWidth: 1, borderColor: Colors.surfaceBorder,
    paddingVertical: 8, paddingHorizontal: 6,
  },
  wordIdx: { fontSize: 10, color: Colors.textMuted, minWidth: 14, textAlign: 'right' },
  wordText: { fontSize: 12, fontWeight: '600', color: Colors.primary, fontFamily: 'monospace', flex: 1 },
  revealBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 4 },
  revealText: { fontSize: 13, color: Colors.textSecondary },
  warnBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: Colors.warning + '15', borderRadius: Radii.sm,
    borderWidth: 1, borderColor: Colors.warning + '44', padding: Spacing.sm,
  },
  warnText: { fontSize: 12, color: Colors.warning, flex: 1, lineHeight: 18 },
  checkRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm },
  checkbox: {
    width: 22, height: 22, borderRadius: 6, borderWidth: 2,
    borderColor: Colors.surfaceBorder, backgroundColor: Colors.surfaceElevated,
    alignItems: 'center', justifyContent: 'center', marginTop: 1,
  },
  checkboxChecked: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  checkLabel: { flex: 1, fontSize: 14, color: Colors.textSecondary, lineHeight: 20 },

  // PIN step
  pinHeaderCard: { alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.sm },
  pinIconBg: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: Colors.primaryDim,
    borderWidth: 1, borderColor: Colors.primary + '44',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 4,
  },
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
  pinTextInput: {
    flex: 1, color: Colors.textPrimary, fontSize: 20,
    letterSpacing: 6, textAlign: 'center', includeFontPadding: false,
  },
  pinDots: { flexDirection: 'row', justifyContent: 'center', gap: 10, paddingVertical: 4 },
  pinDot: {
    width: 10, height: 10, borderRadius: 5,
    borderWidth: 1.5, borderColor: Colors.surfaceBorder, backgroundColor: 'transparent',
  },
  pinDotFilled: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  pinDotComplete: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  matchRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  matchText: { fontSize: 12, color: Colors.accent, fontWeight: '500' },
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  errorText: { fontSize: 13, color: Colors.error },
  pinNote: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: Colors.surfaceElevated, borderRadius: Radii.sm,
    borderWidth: 1, borderColor: Colors.surfaceBorder,
    padding: Spacing.sm,
  },
  pinNoteText: { flex: 1, fontSize: 12, color: Colors.textMuted, lineHeight: 18 },

  // Alert modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center' },
  modalCard: {
    backgroundColor: Colors.surfaceElevated, borderRadius: Radii.lg,
    padding: Spacing.lg, width: 300, borderWidth: 1, borderColor: Colors.surfaceBorder,
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary, marginBottom: 8 },
  modalMsg: { fontSize: 14, color: Colors.textSecondary, lineHeight: 20, marginBottom: 16 },
  modalBtn: { backgroundColor: Colors.primary, borderRadius: Radii.md, padding: 12, alignItems: 'center' },
  modalBtnText: { color: Colors.textInverse, fontWeight: '600', fontSize: 15 },
});
