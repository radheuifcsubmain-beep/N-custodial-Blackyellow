// Powered by OnSpace.AI
import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, TextInput, Pressable, ScrollView,
  KeyboardAvoidingView, Platform, Alert, Modal, TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useWallet } from '../../hooks/useWallet';
import { NetworkSelector } from '../../components/feature/NetworkSelector';
import { GlassCard } from '../../components/ui/GlassCard';
import { LockScreen } from '../../components/feature/LockScreen';
import { Colors, Spacing, Radii } from '../../constants/theme';
import { NETWORKS, NetworkId } from '../../constants/config';
import { estimateGas, GasEstimate } from '../../services/blockchainService';

type GasSpeed = 'low' | 'medium' | 'high';

export default function SendScreen() {
  const insets = useSafeAreaInsets();
  const { selectedNetwork, balances, getCurrentAddress, sendTransaction, isLocked } = useWallet();
  const network = NETWORKS[selectedNetwork];
  const balance = balances[selectedNetwork];

  const [toAddress, setToAddress] = useState('');
  const [amount, setAmount] = useState('');
  const [gasSpeed, setGasSpeed] = useState<GasSpeed>('medium');
  const [gasEstimate, setGasEstimate] = useState<GasEstimate | null>(null);
  const [loading, setLoading] = useState(false);
  const [estimatingGas, setEstimatingGas] = useState(false);
  const [txSuccess, setTxSuccess] = useState(false);
  const [txHash, setTxHash] = useState('');
  const [alertConfig, setAlertConfig] = useState({ visible: false, title: '', message: '' });

  useEffect(() => {
    (async () => {
      setEstimatingGas(true);
      const est = await estimateGas(selectedNetwork);
      setGasEstimate(est);
      setEstimatingGas(false);
    })();
  }, [selectedNetwork]);

  const showAlert = useCallback((title: string, message: string) => {
    if (Platform.OS === 'web') {
      setAlertConfig({ visible: true, title, message });
    } else {
      Alert.alert(title, message);
    }
  }, []);

  const isValidAddress = (addr: string): boolean => {
    if (selectedNetwork === 'solana') return addr.length >= 32 && addr.length <= 44;
    return /^0x[0-9a-fA-F]{40}$/.test(addr);
  };

  const handleSend = useCallback(async () => {
    if (!toAddress.trim()) { showAlert('Missing Address', 'Please enter a recipient address'); return; }
    if (!isValidAddress(toAddress)) { showAlert('Invalid Address', `Please enter a valid ${network.name} address`); return; }
    if (!amount || parseFloat(amount) <= 0) { showAlert('Invalid Amount', 'Please enter a valid amount'); return; }

    const bal = parseFloat(balance?.balance || '0');
    const gas = parseFloat(gasEstimate?.[gasSpeed] || '0');
    if (parseFloat(amount) + gas > bal) {
      showAlert('Insufficient Balance', 'You do not have enough balance to cover this transaction and gas fees');
      return;
    }
    if (selectedNetwork === 'solana') {
      showAlert('Solana', 'Solana transaction signing coming soon. Use a Solana-native wallet for now.');
      return;
    }

    setLoading(true);
    const result = await sendTransaction(toAddress, amount, gasSpeed);
    setLoading(false);

    if (result.success && result.hash) {
      setTxHash(result.hash);
      setTxSuccess(true);
      setToAddress('');
      setAmount('');
    } else {
      showAlert('Transaction Failed', result.error ?? 'Unknown error. Please try again.');
    }
  }, [toAddress, amount, balance, gasEstimate, gasSpeed, network, selectedNetwork, sendTransaction]);

  if (isLocked) return <LockScreen onUnlocked={() => {}} />; // Lock screen handles unlock via context

  if (txSuccess) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }, styles.successContainer]}>
        <View style={styles.successIcon}>
          <MaterialIcons name="check-circle" size={64} color={Colors.accent} />
        </View>
        <Text style={styles.successTitle}>Transaction Sent!</Text>
        <Text style={styles.successSubtitle}>
          Your transaction has been signed with your private key and broadcast to {network.name}.
        </Text>
        {txHash ? (
          <View style={styles.hashBox}>
            <MaterialIcons name="tag" size={14} color={Colors.textMuted} />
            <Text style={styles.hashText} numberOfLines={1} ellipsizeMode="middle">
              {txHash}
            </Text>
          </View>
        ) : null}
        <View style={styles.successNote}>
          <MaterialIcons name="lock" size={14} color={Colors.textMuted} />
          <Text style={styles.successNoteText}>
            Signed on-device with ethers.js — private key never left your device
          </Text>
        </View>
        <Pressable
          onPress={() => { setTxSuccess(false); setTxHash(''); }}
          style={({ pressed }) => [styles.doneBtn, pressed && { opacity: 0.8 }]}
        >
          <Text style={styles.doneBtnText}>Send Another</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Send</Text>
          <View style={styles.ethersbadge}>
            <MaterialIcons name="verified" size={12} color={Colors.accent} />
            <Text style={styles.ethersText}>ethers.js signed</Text>
          </View>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 100 }]}
          keyboardShouldPersistTaps="handled"
        >
          <NetworkSelector />

          <GlassCard>
            <View style={styles.balanceRow}>
              <Text style={styles.balanceLabel}>Available Balance</Text>
              <Text style={styles.balanceValue}>{balance?.balance || '0.000000'} {network.symbol}</Text>
            </View>
            <Text style={styles.balanceUSD}>≈ ${balance?.usdValue || '0.00'} USD</Text>
          </GlassCard>

          {/* Recipient */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Recipient Address</Text>
            <View style={[
              styles.inputWrapper,
              !toAddress ? null : isValidAddress(toAddress) ? styles.inputValid : styles.inputInvalid,
            ]}>
              <MaterialIcons name="account-balance-wallet" size={18} color={Colors.textMuted} />
              <TextInput
                value={toAddress}
                onChangeText={setToAddress}
                placeholder={selectedNetwork === 'solana' ? 'Solana address...' : '0x...'}
                placeholderTextColor={Colors.textMuted}
                style={styles.textInput}
                autoCapitalize="none"
                autoCorrect={false}
              />
              {toAddress.length > 0 && (
                <Pressable onPress={() => setToAddress('')} hitSlop={8}>
                  <MaterialIcons name="close" size={16} color={Colors.textMuted} />
                </Pressable>
              )}
            </View>
            {toAddress.length > 0 && !isValidAddress(toAddress) && (
              <View style={styles.fieldError}>
                <MaterialIcons name="error-outline" size={12} color={Colors.error} />
                <Text style={styles.fieldErrorText}>Invalid {network.name} address</Text>
              </View>
            )}
          </View>

          {/* Amount */}
          <View style={styles.fieldGroup}>
            <View style={styles.amountLabelRow}>
              <Text style={styles.fieldLabel}>Amount ({network.symbol})</Text>
              <Pressable
                onPress={() => setAmount(
                  Math.max(0, parseFloat(balance?.balance || '0') - parseFloat(gasEstimate?.medium || '0')).toFixed(6)
                )}
                hitSlop={8}
              >
                <Text style={styles.maxBtn}>MAX</Text>
              </Pressable>
            </View>
            <View style={styles.inputWrapper}>
              <TextInput
                value={amount}
                onChangeText={setAmount}
                placeholder="0.00"
                placeholderTextColor={Colors.textMuted}
                style={[styles.textInput, styles.amountInput]}
                keyboardType="decimal-pad"
              />
              <Text style={styles.symbolHint}>{network.symbol}</Text>
            </View>
          </View>

          {/* Gas fee */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Network Fee</Text>
            <View style={styles.gasRow}>
              {(['low', 'medium', 'high'] as GasSpeed[]).map((speed) => (
                <Pressable
                  key={speed}
                  onPress={() => setGasSpeed(speed)}
                  style={[styles.gasOption, gasSpeed === speed && styles.gasOptionSelected]}
                >
                  <Text style={[styles.gasSpeedLabel, gasSpeed === speed && { color: Colors.primary }]}>
                    {speed.charAt(0).toUpperCase() + speed.slice(1)}
                  </Text>
                  {estimatingGas ? (
                    <ActivityIndicator size="small" color={Colors.primary} />
                  ) : (
                    <Text style={[styles.gasValue, gasSpeed === speed && { color: Colors.primary }]}>
                      {gasEstimate?.[speed] || '---'} {network.symbol}
                    </Text>
                  )}
                </Pressable>
              ))}
            </View>
          </View>

          {/* Summary */}
          {amount && toAddress && (
            <GlassCard>
              <Text style={styles.summaryTitle}>Transaction Summary</Text>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Send</Text>
                <Text style={styles.summaryValue}>{amount} {network.symbol}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Gas Fee</Text>
                <Text style={styles.summaryValue}>{gasEstimate?.[gasSpeed] || '---'} {network.symbol}</Text>
              </View>
              <View style={styles.divider} />
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabelBold}>Network</Text>
                <Text style={[styles.summaryValue, { color: network.color }]}>{network.name}</Text>
              </View>
            </GlassCard>
          )}

          {/* Send button */}
          <Pressable
            onPress={handleSend}
            disabled={loading}
            style={({ pressed }) => [styles.sendBtn, pressed && { opacity: 0.8 }, loading && { opacity: 0.6 }]}
          >
            {loading ? (
              <>
                <ActivityIndicator color={Colors.textInverse} />
                <Text style={styles.sendBtnText}>Signing & Broadcasting...</Text>
              </>
            ) : (
              <>
                <MaterialIcons name="send" size={18} color={Colors.textInverse} />
                <Text style={styles.sendBtnText}>Sign & Send Transaction</Text>
              </>
            )}
          </Pressable>

          <View style={styles.securityNote}>
            <MaterialIcons name="lock" size={12} color={Colors.textMuted} />
            <Text style={styles.securityNoteText}>
              Signed locally with ethers.js · Private key never leaves device
            </Text>
          </View>
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
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: { fontSize: 22, fontWeight: '700', color: Colors.textPrimary },
  ethersbadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.accentDim,
    borderRadius: Radii.full,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: Colors.accent + '44',
  },
  ethersText: { fontSize: 10, color: Colors.accent, fontWeight: '600' },
  scrollContent: { gap: Spacing.md },
  balanceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 },
  balanceLabel: { fontSize: 13, color: Colors.textMuted },
  balanceValue: { fontSize: 16, fontWeight: '600', color: Colors.textPrimary },
  balanceUSD: { fontSize: 12, color: Colors.textMuted },
  fieldGroup: { paddingHorizontal: Spacing.md, gap: 8 },
  fieldLabel: { fontSize: 13, fontWeight: '500', color: Colors.textSecondary },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.surfaceElevated,
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    paddingHorizontal: Spacing.sm,
    height: 48,
  },
  inputValid: { borderColor: Colors.accent + '88' },
  inputInvalid: { borderColor: Colors.error + '88' },
  textInput: { flex: 1, color: Colors.textPrimary, fontSize: 14 },
  amountInput: { fontSize: 20, fontWeight: '600' },
  symbolHint: { fontSize: 13, color: Colors.textMuted, fontWeight: '500' },
  amountLabelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  maxBtn: { fontSize: 12, fontWeight: '700', color: Colors.primary },
  fieldError: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  fieldErrorText: { fontSize: 11, color: Colors.error },
  gasRow: { flexDirection: 'row', gap: 8 },
  gasOption: {
    flex: 1,
    backgroundColor: Colors.surfaceElevated,
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    padding: 10,
    alignItems: 'center',
    gap: 4,
  },
  gasOptionSelected: { borderColor: Colors.primary, backgroundColor: Colors.primaryDim },
  gasSpeedLabel: { fontSize: 12, fontWeight: '600', color: Colors.textSecondary },
  gasValue: { fontSize: 10, color: Colors.textMuted, textAlign: 'center' },
  summaryTitle: { fontSize: 14, fontWeight: '600', color: Colors.textPrimary, marginBottom: Spacing.sm },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  summaryLabel: { fontSize: 13, color: Colors.textSecondary },
  summaryLabelBold: { fontSize: 13, fontWeight: '600', color: Colors.textPrimary },
  summaryValue: { fontSize: 13, fontWeight: '500', color: Colors.textPrimary },
  divider: { height: 1, backgroundColor: Colors.surfaceBorder, marginVertical: Spacing.xs },
  sendBtn: {
    height: 52,
    backgroundColor: Colors.primary,
    borderRadius: Radii.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginHorizontal: Spacing.md,
  },
  sendBtnText: { fontSize: 16, fontWeight: '600', color: Colors.textInverse },
  securityNote: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: Spacing.md,
  },
  securityNoteText: { fontSize: 11, color: Colors.textMuted },
  successContainer: { justifyContent: 'center', alignItems: 'center', padding: Spacing.xl },
  successIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: Colors.accentDim,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
  },
  successTitle: { fontSize: 26, fontWeight: '700', color: Colors.textPrimary, marginBottom: 8 },
  successSubtitle: { fontSize: 15, color: Colors.textSecondary, textAlign: 'center', lineHeight: 22, marginBottom: Spacing.md },
  hashBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.surfaceElevated,
    borderRadius: Radii.sm,
    padding: Spacing.sm,
    marginBottom: Spacing.sm,
    width: '100%',
  },
  hashText: { fontSize: 11, color: Colors.textMuted, fontFamily: 'monospace', flex: 1 },
  successNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.surfaceElevated,
    borderRadius: Radii.sm,
    padding: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  successNoteText: { fontSize: 12, color: Colors.textMuted, flex: 1 },
  doneBtn: { backgroundColor: Colors.primary, borderRadius: Radii.md, paddingHorizontal: 32, paddingVertical: 14 },
  doneBtnText: { fontSize: 16, fontWeight: '600', color: Colors.textInverse },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center' },
  modalCard: { backgroundColor: Colors.surfaceElevated, borderRadius: Radii.lg, padding: Spacing.lg, width: 300, borderWidth: 1, borderColor: Colors.surfaceBorder },
  modalTitle: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary, marginBottom: 8 },
  modalMessage: { fontSize: 14, color: Colors.textSecondary, lineHeight: 20, marginBottom: 16 },
  modalBtn: { backgroundColor: Colors.primary, borderRadius: Radii.md, padding: 12, alignItems: 'center' },
  modalBtnText: { color: Colors.textInverse, fontWeight: '600', fontSize: 15 },
});
