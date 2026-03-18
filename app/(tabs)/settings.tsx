// Powered by OnSpace.AI — Settings screen with enterprise UI
import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable,
  Modal, TouchableOpacity, Switch, TextInput,
  ActivityIndicator, Platform, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useWallet } from '../../hooks/useWallet';
import { GlassCard } from '../../components/ui/GlassCard';
import { LockScreen } from '../../components/feature/LockScreen';
import { SeedPhraseGrid } from '../../components/feature/SeedPhraseGrid';
import { Colors, Spacing, Radii } from '../../constants/theme';
import { NETWORKS, NetworkId, USE_TESTNETS } from '../../constants/config';
import { savePinataCredentials, isPinataConfiguredViaEnv, getPinataCredentials } from '../../services/pinataService';
import { autoFetchTokenMetadata, fetchTokenFromPinataCID, sourceLabelFor, FetchSource } from '../../services/tokenImportService';
import {
  parseWCUri, savePendingRequest, loadSessions,
  approveConnection, disconnectSession, WCSession, WCConnectionRequest,
} from '../../services/walletConnectService';
import { CustomToken } from '../../services/customTokenService';

const NETWORK_ICONS: Record<NetworkId, string> = {
  ethereum: 'Ξ', bsc: '⬡', polygon: '⬟', solana: '◎',
};
const KEYPAD = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'];

// ── Inline keypad PIN verify ───────────────────────────────────────────────────
function PinVerify({
  title, subtitle, onSuccess, onCancel,
}: {
  title: string; subtitle: string;
  onSuccess: () => void; onCancel: () => void;
}) {
  const { unlockWithPIN } = useWallet();
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const verifyPin = useCallback(async (entered: string) => {
    setLoading(true); setError('');
    try {
      const valid = await unlockWithPIN(entered);
      if (valid) { onSuccess(); }
      else { setError('Incorrect PIN. Try again.'); setPin(''); }
    } catch { setError('Verification failed.'); setPin(''); }
    finally { setLoading(false); }
  }, [unlockWithPIN, onSuccess]);

  const handleDigit = useCallback((digit: string) => {
    if (loading) return;
    setError('');
    setPin(prev => {
      if (prev.length >= 6) return prev;
      const next = prev + digit;
      if (next.length === 6) setTimeout(() => verifyPin(next), 50);
      return next;
    });
  }, [loading, verifyPin]);

  const handleDelete = useCallback(() => { setError(''); setPin(p => p.slice(0, -1)); }, []);

  return (
    <View style={pinS.container}>
      <View style={pinS.iconBg}>
        <MaterialIcons name="lock" size={30} color={Colors.primary} />
      </View>
      <Text style={pinS.title}>{title}</Text>
      <Text style={pinS.subtitle}>{subtitle}</Text>

      <View style={pinS.dotsRow}>
        {Array.from({ length: 6 }).map((_, i) => (
          <View key={i} style={[pinS.dot, i < pin.length && pinS.dotFilled]} />
        ))}
      </View>

      {error
        ? <View style={pinS.errorRow}><MaterialIcons name="error-outline" size={13} color={Colors.error} /><Text style={pinS.errorText}>{error}</Text></View>
        : <Text style={pinS.hint}>Enter your 6-digit PIN</Text>
      }

      <View style={pinS.keypad}>
        {KEYPAD.map((key, idx) => {
          if (key === '') return <View key={idx} style={pinS.keyEmpty} />;
          if (key === 'del') return (
            <Pressable key={idx} onPress={handleDelete}
              style={({ pressed }) => [pinS.keyBtn, pressed && pinS.keyPressed]} disabled={loading} hitSlop={6}>
              <MaterialIcons name="backspace" size={20} color={Colors.textSecondary} />
            </Pressable>
          );
          return (
            <Pressable key={idx} onPress={() => handleDigit(key)}
              style={({ pressed }) => [pinS.keyBtn, pressed && pinS.keyPressed]} disabled={loading}>
              <Text style={pinS.keyText}>{key}</Text>
            </Pressable>
          );
        })}
      </View>

      {loading && <ActivityIndicator size="small" color={Colors.primary} style={{ marginTop: 6 }} />}
      <Pressable onPress={onCancel} style={pinS.cancelBtn}>
        <Text style={pinS.cancelText}>Cancel</Text>
      </Pressable>
    </View>
  );
}

const pinS = StyleSheet.create({
  container: { alignItems: 'center', gap: 12, width: '100%', paddingVertical: 8 },
  iconBg: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: Colors.primaryDim, borderWidth: 1, borderColor: Colors.primary + '44',
    alignItems: 'center', justifyContent: 'center',
  },
  title: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary },
  subtitle: { fontSize: 13, color: Colors.textMuted, textAlign: 'center', lineHeight: 18 },
  dotsRow: { flexDirection: 'row', gap: 12, marginVertical: 4 },
  dot: { width: 13, height: 13, borderRadius: 7, borderWidth: 2, borderColor: Colors.surfaceBorder },
  dotFilled: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  hint: { fontSize: 12, color: Colors.textMuted },
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  errorText: { fontSize: 12, color: Colors.error },
  keypad: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', width: '100%', maxWidth: 260, gap: 10 },
  keyBtn: {
    width: 70, height: 70, borderRadius: 35,
    backgroundColor: Colors.surfaceElevated, borderWidth: 1, borderColor: Colors.surfaceBorder,
    alignItems: 'center', justifyContent: 'center',
  },
  keyEmpty: { width: 70, height: 70 },
  keyPressed: { backgroundColor: Colors.primaryDim, borderColor: Colors.primary },
  keyText: { fontSize: 22, fontWeight: '600', color: Colors.textPrimary },
  cancelBtn: { paddingVertical: 10, paddingHorizontal: 20 },
  cancelText: { fontSize: 14, color: Colors.textMuted, fontWeight: '500' },
});

// ── WalletConnect Connection Request modal ─────────────────────────────────────
function WCRequestModal({
  request, onApprove, onReject,
}: {
  request: WCConnectionRequest;
  onApprove: () => void;
  onReject: () => void;
}) {
  return (
    <View style={styles.modalOverlay}>
      <Pressable style={styles.backdrop} onPress={onReject} />
      <GlassCard style={styles.wcCard}>
        <View style={styles.wcHeader}>
          <View style={styles.wcIconBg}>
            <MaterialIcons name="link" size={28} color={Colors.primary} />
          </View>
          <Text style={styles.wcTitle}>Connection Request</Text>
          <Text style={styles.wcSubtitle}>A dApp wants to connect to your wallet</Text>
        </View>

        <View style={styles.wcDappInfo}>
          <Text style={styles.wcDappName}>{request.dAppName || 'Unknown DApp'}</Text>
          {request.dAppUrl ? (
            <Text style={styles.wcDappUrl} numberOfLines={1}>{request.dAppUrl}</Text>
          ) : null}
          <View style={styles.wcNetworkRow}>
            <MaterialIcons name="language" size={13} color={Colors.textMuted} />
            <Text style={styles.wcNetworkText}>Chain ID: {request.chainId}</Text>
          </View>
        </View>

        <View style={styles.wcWarning}>
          <MaterialIcons name="info-outline" size={14} color={Colors.warning} />
          <Text style={styles.wcWarningText}>
            Only approve connections to sites you trust. Your private keys will never be shared.
          </Text>
        </View>

        <View style={styles.wcActions}>
          <Pressable style={styles.wcRejectBtn} onPress={onReject}>
            <MaterialIcons name="close" size={16} color={Colors.error} />
            <Text style={styles.wcRejectText}>Reject</Text>
          </Pressable>
          <Pressable style={styles.wcApproveBtn} onPress={onApprove}>
            <MaterialIcons name="check" size={16} color={Colors.textInverse} />
            <Text style={styles.wcApproveText}>Approve</Text>
          </Pressable>
        </View>
      </GlassCard>
    </View>
  );
}

// ── Main Settings Screen ──────────────────────────────────────────────────────
export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const {
    mnemonic, addresses, removeWallet, selectedNetwork,
    biometricEnabled, biometricAvailable, enableBiometric, disableBiometric,
    lockWallet, isLocked, customTokens, importCustomToken, deleteCustomToken,
    refreshCustomTokens, getCurrentAddress, refreshBalances, isTestnet,
  } = useWallet();

  // Modal toggles
  const [showSeedPhrase, setShowSeedPhrase] = useState(false);
  const [showPinForSeed, setShowPinForSeed] = useState(false);
  const [showPinForDelete, setShowPinForDelete] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showAddresses, setShowAddresses] = useState(false);
  const [showPinSetup, setShowPinSetup] = useState(false);
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [pinError, setPinError] = useState('');

  // Pinata state
  const [showPinataSetup, setShowPinataSetup] = useState(false);
  const [pinataKey, setPinataKey] = useState('');
  const [pinataSecret, setPinataSecret] = useState('');
  const [pinataConfigured, setPinataConfigured] = useState(false);
  const [pinataViaEnv] = useState(() => isPinataConfiguredViaEnv());
  const [supabaseViaEnv] = useState(() => !!(process.env.EXPO_PUBLIC_SUPABASE_URL && process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY));
  const [etherscanViaEnv] = useState(() => !!(process.env.EXPO_PUBLIC_ETHERSCAN_API_KEY));

  // Token import state — supports both CID/URL and contract address
  const [showTokenImport, setShowTokenImport] = useState(false);
  const [importMode, setImportMode] = useState<'pinata' | 'contract'>('contract');
  const [tokenCid, setTokenCid] = useState('');
  const [contractAddress, setContractAddress] = useState('');
  const [tokenNetwork, setTokenNetwork] = useState<Exclude<NetworkId, 'solana'>>('ethereum');
  const [tokenImporting, setTokenImporting] = useState(false);
  const [tokenImportError, setTokenImportError] = useState('');
  const [tokenImportSuccess, setTokenImportSuccess] = useState('');
  const [importSource, setImportSource] = useState<FetchSource | null>(null);
  const [showCustomTokens, setShowCustomTokens] = useState(false);

  // WalletConnect state
  const [showWCInput, setShowWCInput] = useState(false);
  const [wcUri, setWcUri] = useState('');
  const [wcRequest, setWcRequest] = useState<WCConnectionRequest | null>(null);
  const [wcSessions, setWcSessions] = useState<WCSession[]>([]);
  const [showWCSessions, setShowWCSessions] = useState(false);

  useEffect(() => {
    getPinataCredentials().then(c => setPinataConfigured(!!c));
    refreshCustomTokens();
    loadSessions().then(setWcSessions);
  }, []);

  // ─── Wallet Removal with PIN ─────────────────────────────────────────────────

  const handleDeleteWallet = useCallback(async () => {
    await removeWallet();
    router.replace('/');
  }, [removeWallet, router]);

  // ─── Biometric ───────────────────────────────────────────────────────────────

  const handleBiometricToggle = useCallback(async (value: boolean) => {
    if (value) {
      if (!biometricAvailable) {
        Alert.alert('Not Available', 'Biometric authentication is not available on this device.');
        return;
      }
      setShowPinSetup(true);
    } else {
      await disableBiometric();
    }
  }, [biometricAvailable, disableBiometric]);

  const handleSavePIN = useCallback(async () => {
    if (newPin.length < 6) { setPinError('PIN must be 6 digits'); return; }
    if (newPin !== confirmPin) { setPinError('PINs do not match'); return; }
    await enableBiometric(newPin);
    setShowPinSetup(false); setNewPin(''); setConfirmPin(''); setPinError('');
  }, [newPin, confirmPin, enableBiometric]);

  // ─── Pinata config ───────────────────────────────────────────────────────────

  const handleSavePinata = useCallback(async () => {
    if (!pinataKey.trim() || !pinataSecret.trim()) return;
    await savePinataCredentials(pinataKey.trim(), pinataSecret.trim());
    setPinataConfigured(true); setShowPinataSetup(false);
    setPinataKey(''); setPinataSecret('');
  }, [pinataKey, pinataSecret]);

  // ─── Token Import ────────────────────────────────────────────────────────────

  const handleImportByPinata = useCallback(async () => {
    if (!tokenCid.trim()) return;
    setTokenImporting(true); setTokenImportError(''); setTokenImportSuccess(''); setImportSource(null);
    try {
      const result = await fetchTokenFromPinataCID(tokenCid.trim());
      await importCustomToken(result.metadata);
      setImportSource(result.source);
      setTokenImportSuccess(`✓ ${result.metadata.name} (${result.metadata.symbol}) imported via ${sourceLabelFor(result.source)}!`);
      setTokenCid('');
    } catch (e: any) {
      setTokenImportError(e?.message ?? 'Failed to fetch from Pinata. Check the CID.');
    } finally { setTokenImporting(false); }
  }, [tokenCid, importCustomToken]);

  const handleImportByContract = useCallback(async () => {
    const addr = contractAddress.trim();
    if (!addr || addr.length < 40) {
      setTokenImportError('Please enter a valid contract address (42 chars, starting with 0x).');
      return;
    }
    setTokenImporting(true); setTokenImportError(''); setTokenImportSuccess(''); setImportSource(null);
    try {
      // Auto-fetch: Supabase → Etherscan API → Blockchain RPC
      // Pass isTestnet so the correct RPC/explorer endpoints are used
      const result = await autoFetchTokenMetadata(addr, tokenNetwork, isTestnet);
      await importCustomToken(result.metadata);
      setImportSource(result.source);
      setTokenImportSuccess(`✓ ${result.metadata.name} (${result.metadata.symbol}) imported via ${sourceLabelFor(result.source)}!`);
      setContractAddress('');
    } catch (e: any) {
      setTokenImportError(e?.message ?? 'Could not fetch token metadata. Check the address and network.');
    } finally { setTokenImporting(false); }
  }, [contractAddress, tokenNetwork, importCustomToken, isTestnet]);

  // ─── WalletConnect ───────────────────────────────────────────────────────────

  const handleConnectWC = useCallback(() => {
    const uri = wcUri.trim();
    if (!uri.startsWith('wc:')) {
      Alert.alert('Invalid URI', 'Please paste a valid WalletConnect URI starting with "wc:"');
      return;
    }
    const parsed = parseWCUri(uri);
    if (!parsed) {
      Alert.alert('Parse Error', 'Could not parse the WalletConnect URI.');
      return;
    }
    const req: WCConnectionRequest = {
      id: parsed.id ?? `wc_${Date.now()}`,
      topic: parsed.topic ?? '',
      dAppName: parsed.dAppName ?? 'Unknown DApp',
      dAppUrl: parsed.dAppUrl ?? '',
      dAppIcon: parsed.dAppIcon,
      chainId: parsed.chainId ?? 1,
      requestedAt: Date.now(),
      rawUri: uri,
    };
    setWcRequest(req);
    setWcUri('');
    setShowWCInput(false);
  }, [wcUri]);

  const handleApproveWC = useCallback(async () => {
    if (!wcRequest) return;
    const address = getCurrentAddress();
    const session = await approveConnection(wcRequest, address);
    setWcSessions(prev => [session, ...prev.filter(s => s.topic !== session.topic)]);
    setWcRequest(null);
    Alert.alert('Connected!', `Successfully connected to ${session.dAppName}`);
  }, [wcRequest, getCurrentAddress]);

  const handleRejectWC = useCallback(() => {
    setWcRequest(null);
    Alert.alert('Rejected', 'Connection request rejected.');
  }, []);

  const handleDisconnectWC = useCallback(async (sessionId: string) => {
    await disconnectSession(sessionId);
    setWcSessions(prev => prev.filter(s => s.id !== sessionId));
  }, []);

  const currentNetwork = NETWORKS[selectedNetwork];

  if (isLocked) return <LockScreen onUnlocked={() => refreshBalances()} />;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Settings</Text>
          {USE_TESTNETS && (
            <View style={styles.testnetBanner}>
              <MaterialIcons name="science" size={11} color={Colors.warning} />
              <Text style={styles.testnetText}>Testnet Mode</Text>
            </View>
          )}
        </View>
        <Pressable
          onPress={lockWallet}
          style={({ pressed }) => [styles.lockBtn, pressed && { opacity: 0.7 }]}
          hitSlop={8}
        >
          <MaterialIcons name="lock" size={18} color={Colors.textSecondary} />
        </Pressable>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 100 }]}
      >
        {/* ── Wallet Info ── */}
        <GlassCard style={styles.walletCard}>
          <View style={[styles.walletIconBg, { backgroundColor: currentNetwork.color + '22' }]}>
            <Text style={[styles.walletIcon, { color: currentNetwork.color }]}>
              {NETWORK_ICONS[selectedNetwork]}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.walletTitle}>My Wallet</Text>
            <Text style={styles.walletSubtitle}>Non-Custodial · Multi-Chain · {USE_TESTNETS ? 'Testnet' : 'Mainnet'}</Text>
          </View>
          <View style={[styles.statusDot, { backgroundColor: Colors.success }]} />
        </GlassCard>

        {/* ── Security ── */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Security</Text>
          <GlassCard padding={0}>
            {/* Biometric */}
            <View style={styles.settingRow}>
              <View style={[styles.settingIconBg, { backgroundColor: Colors.primary + '22' }]}>
                <MaterialIcons name="fingerprint" size={18} color={Colors.primary} />
              </View>
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>Biometric Lock</Text>
                <Text style={styles.settingSubtitle}>
                  {biometricAvailable ? 'Fingerprint / Face ID' : 'Not available on this device'}
                </Text>
              </View>
              <Switch
                value={biometricEnabled}
                onValueChange={handleBiometricToggle}
                disabled={!biometricAvailable}
                trackColor={{ false: Colors.surfaceBorder, true: Colors.primary + '88' }}
                thumbColor={biometricEnabled ? Colors.primary : Colors.textMuted}
              />
            </View>

            <View style={styles.rowDivider} />

            {/* Lock now */}
            <Pressable
              style={({ pressed }) => [styles.settingRow, pressed && styles.settingRowPressed]}
              onPress={lockWallet}
            >
              <View style={[styles.settingIconBg, { backgroundColor: Colors.warning + '22' }]}>
                <MaterialIcons name="lock" size={18} color={Colors.warning} />
              </View>
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>Lock Wallet Now</Text>
                <Text style={styles.settingSubtitle}>Require PIN to re-open</Text>
              </View>
              <MaterialIcons name="chevron-right" size={20} color={Colors.textMuted} />
            </Pressable>

            <View style={styles.rowDivider} />

            <View style={styles.settingRow}>
              <View style={[styles.settingIconBg, { backgroundColor: Colors.accent + '22' }]}>
                <MaterialIcons name="verified-user" size={18} color={Colors.accent} />
              </View>
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>Non-Custodial</Text>
                <Text style={styles.settingSubtitle}>Keys never leave this device</Text>
              </View>
              <View style={styles.verifiedBadge}>
                <MaterialIcons name="check" size={12} color={Colors.accent} />
              </View>
            </View>
          </GlassCard>
        </View>

        {/* ── Wallet ── */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Wallet</Text>
          <GlassCard padding={0}>
            {/* Backup seed */}
            <Pressable
              style={({ pressed }) => [styles.settingRow, pressed && styles.settingRowPressed]}
              onPress={() => setShowPinForSeed(true)}
            >
              <View style={[styles.settingIconBg, { backgroundColor: Colors.warning + '22' }]}>
                <MaterialIcons name="vpn-key" size={18} color={Colors.warning} />
              </View>
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>Backup Seed Phrase</Text>
                <Text style={styles.settingSubtitle}>PIN required · Never share with anyone</Text>
              </View>
              <MaterialIcons name="chevron-right" size={20} color={Colors.textMuted} />
            </Pressable>

            <View style={styles.rowDivider} />

            {/* Addresses */}
            <Pressable
              style={({ pressed }) => [styles.settingRow, pressed && styles.settingRowPressed]}
              onPress={() => setShowAddresses(!showAddresses)}
            >
              <View style={[styles.settingIconBg, { backgroundColor: Colors.primary + '22' }]}>
                <MaterialIcons name="account-box" size={18} color={Colors.primary} />
              </View>
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>Wallet Addresses</Text>
                <Text style={styles.settingSubtitle}>View all network addresses</Text>
              </View>
              <MaterialIcons name={showAddresses ? 'expand-less' : 'expand-more'} size={20} color={Colors.textMuted} />
            </Pressable>

            {showAddresses && addresses && (
              <View style={styles.addressesContainer}>
                {(Object.keys(NETWORKS) as NetworkId[]).map((networkId) => (
                  <View key={networkId} style={styles.addressItem}>
                    <View style={[styles.smallBadge, { backgroundColor: NETWORKS[networkId].color + '22' }]}>
                      <Text style={[styles.networkIconText, { color: NETWORKS[networkId].color }]}>
                        {NETWORK_ICONS[networkId]}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.addressNetworkName}>{NETWORKS[networkId].name}</Text>
                      <Text style={styles.addressValue} numberOfLines={1} ellipsizeMode="middle">
                        {addresses[networkId]}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </GlassCard>
        </View>

        {/* ── API Status ── */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Connected APIs</Text>
          <GlassCard padding={0}>
            {[
              { label: 'Supabase', sub: 'Token metadata database', active: supabaseViaEnv, icon: 'storage' as const },
              { label: 'Pinata IPFS', sub: 'Decentralised token metadata', active: pinataViaEnv, icon: 'cloud' as const },
              { label: 'Etherscan', sub: 'On-chain token lookup', active: etherscanViaEnv, icon: 'search' as const },
            ].map(({ label, sub, active, icon }, idx) => (
              <React.Fragment key={label}>
                <View style={styles.settingRow}>
                  <View style={[styles.settingIconBg, { backgroundColor: active ? Colors.primary + '22' : Colors.surfaceElevated }]}>
                    <MaterialIcons name={icon} size={18} color={active ? Colors.primary : Colors.textMuted} />
                  </View>
                  <View style={styles.settingInfo}>
                    <Text style={styles.settingLabel}>{label}</Text>
                    <Text style={styles.settingSubtitle}>{sub}</Text>
                  </View>
                  <View style={[styles.apiBadge, { backgroundColor: active ? Colors.success + '22' : Colors.error + '22' }]}>
                    <View style={[styles.apiDot, { backgroundColor: active ? Colors.success : Colors.error }]} />
                    <Text style={[styles.apiBadgeText, { color: active ? Colors.success : Colors.error }]}>
                      {active ? 'Live' : 'No key'}
                    </Text>
                  </View>
                </View>
                {idx < 2 && <View style={styles.rowDivider} />}
              </React.Fragment>
            ))}
          </GlassCard>
        </View>

        {/* ── Token Management ── */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Token Management</Text>
          <GlassCard padding={0}>

            {/* Import token */}
            <Pressable
              style={({ pressed }) => [styles.settingRow, pressed && styles.settingRowPressed]}
              onPress={() => setShowTokenImport(!showTokenImport)}
            >
              <View style={[styles.settingIconBg, { backgroundColor: Colors.primary + '22' }]}>
                <MaterialIcons name="add-circle-outline" size={18} color={Colors.primary} />
              </View>
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>Import Token</Text>
                <Text style={styles.settingSubtitle}>By contract address or Pinata CID</Text>
              </View>
              <MaterialIcons name={showTokenImport ? 'expand-less' : 'expand-more'} size={20} color={Colors.textMuted} />
            </Pressable>

            {showTokenImport && (
              <View style={styles.importTokenSection}>
                {/* Mode toggle */}
                <View style={styles.importModeRow}>
                  <Pressable
                    onPress={() => setImportMode('contract')}
                    style={[styles.importModeBtn, importMode === 'contract' && styles.importModeBtnActive]}
                  >
                    <MaterialIcons name="code" size={13} color={importMode === 'contract' ? Colors.primary : Colors.textMuted} />
                    <Text style={[styles.importModeBtnText, importMode === 'contract' && styles.importModeBtnTextActive]}>
                      Contract
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setImportMode('pinata')}
                    style={[styles.importModeBtn, importMode === 'pinata' && styles.importModeBtnActive]}
                  >
                    <MaterialIcons name="cloud" size={13} color={importMode === 'pinata' ? Colors.primary : Colors.textMuted} />
                    <Text style={[styles.importModeBtnText, importMode === 'pinata' && styles.importModeBtnTextActive]}>
                      Pinata CID
                    </Text>
                  </Pressable>
                </View>

                {importMode === 'contract' ? (
                  <>
                    <Text style={styles.importHint}>
                      Enter the ERC-20 / BEP-20 contract address. Metadata is fetched directly from the blockchain.
                    </Text>

                    {/* Network selector for import */}
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.networkPickerScroll}>
                      <View style={styles.networkPickerRow}>
                        {(['ethereum', 'bsc', 'polygon'] as Exclude<NetworkId, 'solana'>[]).map(nid => (
                          <Pressable
                            key={nid}
                            onPress={() => setTokenNetwork(nid)}
                            style={[styles.networkPickerBtn, tokenNetwork === nid && { borderColor: NETWORKS[nid].color, backgroundColor: NETWORKS[nid].color + '22' }]}
                          >
                            <Text style={[styles.networkPickerIcon, { color: NETWORKS[nid].color }]}>{NETWORK_ICONS[nid]}</Text>
                            <Text style={[styles.networkPickerText, tokenNetwork === nid && { color: NETWORKS[nid].color }]}>
                              {NETWORKS[nid].symbol}
                            </Text>
                          </Pressable>
                        ))}
                      </View>
                    </ScrollView>

                    <View style={styles.inputWrapper}>
                      <MaterialIcons name="code" size={16} color={Colors.textMuted} style={styles.inputIcon} />
                      <TextInput
                        value={contractAddress}
                        onChangeText={(t) => { setContractAddress(t); setTokenImportError(''); setTokenImportSuccess(''); }}
                        placeholder="0x... contract address"
                        placeholderTextColor={Colors.textMuted}
                        style={styles.tokenInput}
                        autoCapitalize="none"
                        autoCorrect={false}
                      />
                    </View>
                  </>
                ) : (
                  <>
                    <Text style={styles.importHint}>
                      Paste the Pinata CID or full gateway URL for the token metadata JSON.
                    </Text>
                    <View style={styles.inputWrapper}>
                      <MaterialIcons name="cloud" size={16} color={Colors.textMuted} style={styles.inputIcon} />
                      <TextInput
                        value={tokenCid}
                        onChangeText={(t) => { setTokenCid(t); setTokenImportError(''); setTokenImportSuccess(''); }}
                        placeholder="QmXxx... or https://gateway.pinata.cloud/..."
                        placeholderTextColor={Colors.textMuted}
                        style={styles.tokenInput}
                        autoCapitalize="none"
                        autoCorrect={false}
                      />
                    </View>
                  </>
                )}

                {tokenImportError ? (
                  <View style={styles.importFeedback}>
                    <MaterialIcons name="error-outline" size={13} color={Colors.error} />
                    <Text style={styles.importErrorText}>{tokenImportError}</Text>
                  </View>
                ) : null}
                {tokenImportSuccess ? (
                  <View style={styles.importFeedback}>
                    <MaterialIcons name="check-circle" size={13} color={Colors.accent} />
                    <Text style={styles.importSuccessText}>{tokenImportSuccess}</Text>
                  </View>
                ) : null}

                <Pressable
                  onPress={importMode === 'contract' ? handleImportByContract : handleImportByPinata}
                  disabled={tokenImporting || (importMode === 'contract' ? !contractAddress.trim() : !tokenCid.trim())}
                  style={({ pressed }) => [
                    styles.importBtn,
                    pressed && { opacity: 0.8 },
                    (tokenImporting || (importMode === 'contract' ? !contractAddress.trim() : !tokenCid.trim())) && styles.importBtnDisabled,
                  ]}
                >
                  {tokenImporting
                    ? <ActivityIndicator size="small" color={Colors.textInverse} />
                    : <>
                      <MaterialIcons name="download" size={16} color={Colors.textInverse} />
                      <Text style={styles.importBtnText}>Import Token</Text>
                    </>
                  }
                </Pressable>
              </View>
            )}

            <View style={styles.rowDivider} />

            {/* Custom tokens list */}
            <Pressable
              style={({ pressed }) => [styles.settingRow, pressed && styles.settingRowPressed]}
              onPress={() => setShowCustomTokens(!showCustomTokens)}
            >
              <View style={[styles.settingIconBg, { backgroundColor: Colors.secondary + '22' }]}>
                <MaterialIcons name="token" size={18} color={Colors.secondary} />
              </View>
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>My Custom Tokens</Text>
                <Text style={styles.settingSubtitle}>{customTokens.length} token{customTokens.length !== 1 ? 's' : ''} imported</Text>
              </View>
              {customTokens.length > 0 && (
                <View style={styles.countBadge}>
                  <Text style={styles.countBadgeText}>{customTokens.length}</Text>
                </View>
              )}
              <MaterialIcons name={showCustomTokens ? 'expand-less' : 'expand-more'} size={20} color={Colors.textMuted} />
            </Pressable>

            {showCustomTokens && (
              <View style={styles.customTokensContainer}>
                {customTokens.length === 0 ? (
                  <Text style={styles.noTokensText}>No custom tokens imported yet</Text>
                ) : (
                  customTokens.map((token: CustomToken) => (
                    <View key={token.id} style={styles.customTokenItem}>
                      <View style={[styles.tokenIconBg, { backgroundColor: token.color + '33' }]}>
                        <Text style={[styles.tokenIconText, { color: token.color }]}>
                          {token.symbol[0]}
                        </Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <View style={styles.tokenNameRow}>
                          <Text style={styles.tokenName}>{token.symbol}</Text>
                          {token.isOwnToken && (
                            <View style={styles.ownBadge}>
                              <Text style={styles.ownBadgeText}>My Token</Text>
                            </View>
                          )}
                        </View>
                        <Text style={styles.tokenNetwork}>{token.name} · {NETWORKS[token.network]?.name ?? token.network}</Text>
                        <Text style={styles.tokenAddr} numberOfLines={1} ellipsizeMode="middle">
                          {token.contractAddress}
                        </Text>
                      </View>
                      <Pressable onPress={() => deleteCustomToken(token.id)} hitSlop={8} style={styles.deleteTokenBtn}>
                        <MaterialIcons name="delete-outline" size={18} color={Colors.error} />
                      </Pressable>
                    </View>
                  ))
                )}
              </View>
            )}
          </GlassCard>
        </View>

        {/* ── WalletConnect ── */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>WalletConnect</Text>
          <GlassCard padding={0}>
            <Pressable
              style={({ pressed }) => [styles.settingRow, pressed && styles.settingRowPressed]}
              onPress={() => setShowWCInput(!showWCInput)}
            >
              <View style={[styles.settingIconBg, { backgroundColor: Colors.primary + '22' }]}>
                <MaterialIcons name="link" size={18} color={Colors.primary} />
              </View>
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>Connect DApp</Text>
                <Text style={styles.settingSubtitle}>Paste a WalletConnect URI</Text>
              </View>
              <MaterialIcons name={showWCInput ? 'expand-less' : 'expand-more'} size={20} color={Colors.textMuted} />
            </Pressable>

            {showWCInput && (
              <View style={styles.wcInputSection}>
                <View style={styles.inputWrapper}>
                  <MaterialIcons name="link" size={16} color={Colors.textMuted} style={styles.inputIcon} />
                  <TextInput
                    value={wcUri}
                    onChangeText={setWcUri}
                    placeholder="wc:..."
                    placeholderTextColor={Colors.textMuted}
                    style={styles.tokenInput}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>
                <Pressable
                  onPress={handleConnectWC}
                  disabled={!wcUri.trim()}
                  style={({ pressed }) => [styles.importBtn, pressed && { opacity: 0.8 }, !wcUri.trim() && styles.importBtnDisabled]}
                >
                  <MaterialIcons name="link" size={16} color={Colors.textInverse} />
                  <Text style={styles.importBtnText}>Connect</Text>
                </Pressable>
              </View>
            )}

            {wcSessions.length > 0 && (
              <>
                <View style={styles.rowDivider} />
                <Pressable
                  style={({ pressed }) => [styles.settingRow, pressed && styles.settingRowPressed]}
                  onPress={() => setShowWCSessions(!showWCSessions)}
                >
                  <View style={[styles.settingIconBg, { backgroundColor: Colors.accent + '22' }]}>
                    <MaterialIcons name="device-hub" size={18} color={Colors.accent} />
                  </View>
                  <View style={styles.settingInfo}>
                    <Text style={styles.settingLabel}>Active Sessions</Text>
                    <Text style={styles.settingSubtitle}>{wcSessions.length} dApp{wcSessions.length !== 1 ? 's' : ''} connected</Text>
                  </View>
                  <View style={styles.countBadge}>
                    <Text style={styles.countBadgeText}>{wcSessions.length}</Text>
                  </View>
                  <MaterialIcons name={showWCSessions ? 'expand-less' : 'expand-more'} size={20} color={Colors.textMuted} />
                </Pressable>

                {showWCSessions && (
                  <View style={styles.customTokensContainer}>
                    {wcSessions.map(session => (
                      <View key={session.id} style={styles.customTokenItem}>
                        <View style={[styles.tokenIconBg, { backgroundColor: Colors.primary + '22' }]}>
                          <MaterialIcons name="language" size={18} color={Colors.primary} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.tokenName}>{session.dAppName}</Text>
                          <Text style={styles.tokenNetwork} numberOfLines={1}>{session.dAppUrl || 'No URL'}</Text>
                          <Text style={styles.tokenAddr}>
                            Chain {session.chainId} · Connected {new Date(session.connectedAt).toLocaleDateString()}
                          </Text>
                        </View>
                        <Pressable onPress={() => handleDisconnectWC(session.id)} hitSlop={8} style={styles.deleteTokenBtn}>
                          <MaterialIcons name="power-settings-new" size={18} color={Colors.error} />
                        </Pressable>
                      </View>
                    ))}
                  </View>
                )}
              </>
            )}
          </GlassCard>
        </View>

        {/* ── Connected Networks ── */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>
            {USE_TESTNETS ? 'Testnet Networks' : 'Mainnet Networks'}
          </Text>
          <GlassCard padding={0}>
            {(Object.keys(NETWORKS) as NetworkId[]).map((networkId, idx) => (
              <React.Fragment key={networkId}>
                <View style={styles.settingRow}>
                  <View style={[styles.settingIconBg, { backgroundColor: NETWORKS[networkId].color + '22' }]}>
                    <Text style={[styles.networkIconText, { color: NETWORKS[networkId].color }]}>
                      {NETWORK_ICONS[networkId]}
                    </Text>
                  </View>
                  <View style={styles.settingInfo}>
                    <Text style={styles.settingLabel}>{NETWORKS[networkId].name}</Text>
                    <Text style={styles.settingSubtitle} numberOfLines={1}>
                      {NETWORKS[networkId].rpcUrl.replace('https://', '').split('/')[0]}
                    </Text>
                  </View>
                  <View style={styles.chainIdBadge}>
                    <Text style={styles.chainIdText}>
                      {NETWORKS[networkId].chainId > 0 ? `Chain ${NETWORKS[networkId].chainId}` : 'Mainnet'}
                    </Text>
                  </View>
                </View>
                {idx < Object.keys(NETWORKS).length - 1 && <View style={styles.rowDivider} />}
              </React.Fragment>
            ))}
          </GlassCard>
        </View>

        {/* ── Danger Zone ── */}
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: Colors.error }]}>Danger Zone</Text>
          <GlassCard padding={0} style={{ borderColor: Colors.error + '33', borderWidth: 1 }}>
            <Pressable
              style={({ pressed }) => [styles.settingRow, pressed && styles.settingRowPressed]}
              onPress={() => setShowPinForDelete(true)}
            >
              <View style={[styles.settingIconBg, { backgroundColor: Colors.error + '22' }]}>
                <MaterialIcons name="delete-forever" size={18} color={Colors.error} />
              </View>
              <View style={styles.settingInfo}>
                <Text style={[styles.settingLabel, { color: Colors.error }]}>Remove Wallet</Text>
                <Text style={styles.settingSubtitle}>PIN required · Permanently deletes wallet</Text>
              </View>
              <MaterialIcons name="chevron-right" size={20} color={Colors.error + '88'} />
            </Pressable>
          </GlassCard>
        </View>

        <View style={styles.appInfo}>
          <Text style={styles.appInfoText}>OnSpace Wallet v1.0.0</Text>
          <Text style={styles.appInfoText}>
            {USE_TESTNETS ? '⚗️ Testnet Mode' : '🌐 Mainnet'} · ethers.js · BIP39/44 · Pinata IPFS
          </Text>
        </View>
      </ScrollView>

      {/* ── PIN for seed phrase ── */}
      {showPinForSeed && (
        <View style={styles.modalOverlay}>
          <Pressable style={styles.backdrop} onPress={() => setShowPinForSeed(false)} />
          <GlassCard style={styles.pinModalCard}>
            <PinVerify
              title="Verify Identity"
              subtitle="Enter your PIN to view your seed phrase"
              onSuccess={() => { setShowPinForSeed(false); setShowSeedPhrase(true); }}
              onCancel={() => setShowPinForSeed(false)}
            />
          </GlassCard>
        </View>
      )}

      {/* ── PIN for wallet removal ── */}
      {showPinForDelete && (
        <View style={styles.modalOverlay}>
          <Pressable style={styles.backdrop} onPress={() => setShowPinForDelete(false)} />
          <GlassCard style={styles.pinModalCard}>
            <PinVerify
              title="Confirm Removal"
              subtitle="Enter your PIN to permanently remove your wallet from this device"
              onSuccess={() => { setShowPinForDelete(false); setShowDeleteConfirm(true); }}
              onCancel={() => setShowPinForDelete(false)}
            />
          </GlassCard>
        </View>
      )}

      {/* ── Seed phrase display ── */}
      {showSeedPhrase && mnemonic && (
        <View style={styles.modalOverlay}>
          <Pressable style={styles.backdrop} onPress={() => setShowSeedPhrase(false)} />
          <GlassCard style={styles.seedCard}>
            <View style={styles.seedHeader}>
              <Text style={styles.seedTitle}>Your Seed Phrase</Text>
              <Pressable onPress={() => setShowSeedPhrase(false)} hitSlop={8}>
                <MaterialIcons name="close" size={22} color={Colors.textSecondary} />
              </Pressable>
            </View>
            <View style={styles.warningBanner}>
              <MaterialIcons name="warning" size={14} color={Colors.warning} />
              <Text style={styles.warningText}>Never share this with anyone! Store it safely offline.</Text>
            </View>
            <SeedPhraseGrid mnemonic={mnemonic} />
          </GlassCard>
        </View>
      )}

      {/* ── PIN setup (biometric) ── */}
      {showPinSetup && (
        <View style={styles.modalOverlay}>
          <Pressable style={styles.backdrop} onPress={() => setShowPinSetup(false)} />
          <GlassCard style={styles.confirmCard}>
            <MaterialIcons name="fingerprint" size={32} color={Colors.primary} />
            <Text style={styles.confirmTitle}>Set Wallet PIN</Text>
            <Text style={styles.confirmText}>A PIN is needed as fallback for biometrics.</Text>
            <TextInput
              value={newPin}
              onChangeText={setNewPin}
              placeholder="Enter 6-digit PIN"
              placeholderTextColor={Colors.textMuted}
              style={styles.pinInput}
              keyboardType="number-pad"
              secureTextEntry
              maxLength={6}
            />
            <TextInput
              value={confirmPin}
              onChangeText={setConfirmPin}
              placeholder="Confirm PIN"
              placeholderTextColor={Colors.textMuted}
              style={styles.pinInput}
              keyboardType="number-pad"
              secureTextEntry
              maxLength={6}
            />
            {pinError ? <Text style={styles.pinError}>{pinError}</Text> : null}
            <View style={styles.confirmActions}>
              <Pressable style={styles.confirmCancelBtn} onPress={() => setShowPinSetup(false)}>
                <Text style={styles.confirmCancelText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.confirmOkBtn} onPress={handleSavePIN}>
                <Text style={styles.confirmOkText}>Enable</Text>
              </Pressable>
            </View>
          </GlassCard>
        </View>
      )}

      {/* ── Pinata Setup ── */}
      {showPinataSetup && (
        <View style={styles.modalOverlay}>
          <Pressable style={styles.backdrop} onPress={() => setShowPinataSetup(false)} />
          <GlassCard style={styles.confirmCard}>
            <MaterialIcons name="cloud" size={32} color="#E8431B" />
            <Text style={styles.confirmTitle}>Pinata IPFS</Text>
            <Text style={styles.confirmText}>Enter Pinata API credentials to import token metadata from IPFS.</Text>
            <TextInput value={pinataKey} onChangeText={setPinataKey} placeholder="API Key" placeholderTextColor={Colors.textMuted} style={styles.pinInput} autoCapitalize="none" autoCorrect={false} />
            <TextInput value={pinataSecret} onChangeText={setPinataSecret} placeholder="Secret API Key" placeholderTextColor={Colors.textMuted} style={styles.pinInput} autoCapitalize="none" autoCorrect={false} secureTextEntry />
            <View style={styles.confirmActions}>
              <Pressable style={styles.confirmCancelBtn} onPress={() => setShowPinataSetup(false)}>
                <Text style={styles.confirmCancelText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.confirmOkBtn} onPress={handleSavePinata}>
                <Text style={styles.confirmOkText}>Save</Text>
              </Pressable>
            </View>
          </GlassCard>
        </View>
      )}

      {/* ── Delete final confirmation ── */}
      {showDeleteConfirm && (
        <View style={styles.modalOverlay}>
          <Pressable style={styles.backdrop} onPress={() => setShowDeleteConfirm(false)} />
          <GlassCard style={styles.confirmCard}>
            <View style={[styles.deleteIconBg]}>
              <MaterialIcons name="delete-forever" size={36} color={Colors.error} />
            </View>
            <Text style={[styles.confirmTitle, { color: Colors.error }]}>Remove Wallet</Text>
            <Text style={styles.confirmText}>
              This will permanently delete your wallet from this device. Ensure your seed phrase is backed up before continuing.
            </Text>
            <View style={styles.warningBanner}>
              <MaterialIcons name="warning" size={14} color={Colors.warning} />
              <Text style={styles.warningText}>This action cannot be undone!</Text>
            </View>
            <View style={styles.confirmActions}>
              <Pressable style={styles.confirmCancelBtn} onPress={() => setShowDeleteConfirm(false)}>
                <Text style={styles.confirmCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.confirmOkBtn, { backgroundColor: Colors.error }]}
                onPress={() => { setShowDeleteConfirm(false); handleDeleteWallet(); }}
              >
                <Text style={styles.confirmOkText}>Delete</Text>
              </Pressable>
            </View>
          </GlassCard>
        </View>
      )}

      {/* ── WalletConnect request modal ── */}
      {wcRequest && (
        <WCRequestModal
          request={wcRequest}
          onApprove={handleApproveWC}
          onReject={handleRejectWC}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.md,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  headerTitle: { fontSize: 22, fontWeight: '700', color: Colors.textPrimary },
  testnetBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3,
  },
  testnetText: { fontSize: 11, color: Colors.warning, fontWeight: '600' },
  lockBtn: {
    width: 40, height: 40, borderRadius: Radii.full,
    backgroundColor: Colors.surfaceElevated, borderWidth: 1, borderColor: Colors.surfaceBorder,
    alignItems: 'center', justifyContent: 'center',
  },
  scrollContent: { gap: Spacing.md, padding: Spacing.md },
  walletCard: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, borderColor: Colors.primary + '33' },
  walletIconBg: { width: 52, height: 52, borderRadius: Radii.lg, alignItems: 'center', justifyContent: 'center' },
  walletIcon: { fontSize: 22, fontWeight: '700' },
  walletTitle: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary },
  walletSubtitle: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  section: { gap: 8 },
  sectionLabel: { fontSize: 11, fontWeight: '700', color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.8 },
  settingRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    paddingHorizontal: Spacing.md, paddingVertical: 14,
  },
  settingRowPressed: { backgroundColor: Colors.surface },
  settingIconBg: { width: 36, height: 36, borderRadius: Radii.sm, alignItems: 'center', justifyContent: 'center' },
  settingInfo: { flex: 1 },
  settingLabel: { fontSize: 15, fontWeight: '500', color: Colors.textPrimary },
  settingSubtitle: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  rowDivider: { height: 1, backgroundColor: Colors.surfaceBorder, marginLeft: 68 },
  networkIconText: { fontSize: 16, fontWeight: '700' },
  verifiedBadge: { width: 24, height: 24, borderRadius: 12, backgroundColor: Colors.accentDim, alignItems: 'center', justifyContent: 'center' },
  chainIdBadge: {
    backgroundColor: Colors.surfaceElevated, borderRadius: Radii.full,
    paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: Colors.surfaceBorder,
  },
  chainIdText: { fontSize: 10, color: Colors.textMuted, fontWeight: '600' },
  addressesContainer: { paddingHorizontal: Spacing.md, paddingBottom: Spacing.sm, gap: 10 },
  addressItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  smallBadge: { width: 30, height: 30, borderRadius: Radii.full, alignItems: 'center', justifyContent: 'center' },
  addressNetworkName: { fontSize: 12, fontWeight: '600', color: Colors.textSecondary },
  addressValue: { fontSize: 11, color: Colors.textMuted, fontFamily: 'monospace', marginTop: 1 },
  configBadge: {
    paddingHorizontal: 10, paddingVertical: 3, borderRadius: Radii.full,
    borderWidth: 1, borderColor: Colors.surfaceBorder,
  },
  configBadgeText: { fontSize: 11, fontWeight: '600' },
  countBadge: {
    minWidth: 22, height: 22, borderRadius: 11,
    backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5,
  },
  countBadgeText: { fontSize: 11, fontWeight: '700', color: Colors.textInverse },
  importTokenSection: { paddingHorizontal: Spacing.md, paddingBottom: Spacing.md, gap: 10 },
  importModeRow: {
    flexDirection: 'row', gap: 8,
  },
  importModeBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5,
    paddingVertical: 8, borderRadius: Radii.md,
    backgroundColor: Colors.surfaceElevated, borderWidth: 1, borderColor: Colors.surfaceBorder,
  },
  importModeBtnActive: { backgroundColor: Colors.primaryDim, borderColor: Colors.primary },
  importModeBtnText: { fontSize: 12, fontWeight: '600', color: Colors.textMuted },
  importModeBtnTextActive: { color: Colors.primary },
  importHint: { fontSize: 12, color: Colors.textMuted, lineHeight: 18 },
  networkPickerScroll: { marginVertical: 2 },
  networkPickerRow: { flexDirection: 'row', gap: 8 },
  networkPickerBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: Radii.full,
    backgroundColor: Colors.surfaceElevated, borderWidth: 1, borderColor: Colors.surfaceBorder,
  },
  networkPickerIcon: { fontSize: 13, fontWeight: '700' },
  networkPickerText: { fontSize: 12, fontWeight: '600', color: Colors.textMuted },
  inputWrapper: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.surfaceElevated, borderRadius: Radii.md,
    borderWidth: 1, borderColor: Colors.surfaceBorder,
    paddingHorizontal: Spacing.sm,
  },
  inputIcon: { marginRight: 4 },
  tokenInput: {
    flex: 1, color: Colors.textPrimary, fontSize: 13,
    paddingVertical: 12, fontFamily: 'monospace',
  },
  importFeedback: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  importErrorText: { flex: 1, fontSize: 12, color: Colors.error, lineHeight: 18 },
  importSuccessText: { flex: 1, fontSize: 12, color: Colors.accent, lineHeight: 18 },
  importBtn: {
    height: 46, backgroundColor: Colors.primary, borderRadius: Radii.md,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
  },
  importBtnDisabled: { opacity: 0.4 },
  importBtnText: { fontSize: 14, fontWeight: '700', color: Colors.textInverse },
  wcInputSection: { paddingHorizontal: Spacing.md, paddingBottom: Spacing.md, gap: 10 },
  customTokensContainer: { paddingHorizontal: Spacing.md, paddingBottom: Spacing.sm, gap: 10 },
  noTokensText: { fontSize: 13, color: Colors.textMuted, paddingVertical: 8, textAlign: 'center' },
  customTokenItem: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: 6 },
  tokenIconBg: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  tokenIconText: { fontSize: 16, fontWeight: '700' },
  tokenNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  tokenName: { fontSize: 14, fontWeight: '600', color: Colors.textPrimary },
  ownBadge: {
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: Radii.full,
    backgroundColor: Colors.primaryDim, borderWidth: 1, borderColor: Colors.primary + '44',
  },
  ownBadgeText: { fontSize: 9, fontWeight: '700', color: Colors.primary },
  tokenNetwork: { fontSize: 11, color: Colors.textMuted, marginTop: 1 },
  tokenAddr: { fontSize: 10, color: Colors.textMuted, fontFamily: 'monospace', marginTop: 1 },
  deleteTokenBtn: { padding: 6 },
  appInfo: { alignItems: 'center', gap: 4, paddingBottom: 8 },
  appInfoText: { fontSize: 11, color: Colors.textMuted },

  // Modals
  modalOverlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'flex-end', zIndex: 100, padding: Spacing.md },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.8)' },
  pinModalCard: { gap: 0, borderRadius: Radii.xl, paddingVertical: Spacing.md },
  confirmCard: { gap: Spacing.md, alignItems: 'center', borderRadius: Radii.xl },
  confirmTitle: { fontSize: 20, fontWeight: '700', color: Colors.textPrimary, textAlign: 'center' },
  confirmText: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  confirmActions: { flexDirection: 'row', gap: Spacing.sm, width: '100%' },
  confirmCancelBtn: {
    flex: 1, height: 48, backgroundColor: Colors.surfaceElevated,
    borderRadius: Radii.md, borderWidth: 1, borderColor: Colors.surfaceBorder,
    alignItems: 'center', justifyContent: 'center',
  },
  confirmCancelText: { fontSize: 15, fontWeight: '500', color: Colors.textSecondary },
  confirmOkBtn: { flex: 1, height: 48, backgroundColor: Colors.primary, borderRadius: Radii.md, alignItems: 'center', justifyContent: 'center' },
  confirmOkText: { fontSize: 15, fontWeight: '700', color: Colors.textInverse },
  deleteIconBg: {
    width: 70, height: 70, borderRadius: 35,
    backgroundColor: Colors.error + '22', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.error + '44',
  },
  pinInput: {
    width: '100%', height: 50, backgroundColor: Colors.surfaceElevated,
    borderRadius: Radii.md, borderWidth: 1, borderColor: Colors.surfaceBorder,
    paddingHorizontal: Spacing.md, color: Colors.textPrimary,
    fontSize: 18, letterSpacing: 8, textAlign: 'center',
  },
  pinError: { fontSize: 13, color: Colors.error, textAlign: 'center' },
  seedCard: { gap: Spacing.md, borderRadius: Radii.xl },
  seedHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  seedTitle: { fontSize: 17, fontWeight: '700', color: Colors.textPrimary },
  warningBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.warning + '15', borderRadius: Radii.sm, padding: Spacing.sm,
  },
  warningText: { flex: 1, fontSize: 12, color: Colors.warning, fontWeight: '500' },

  // WalletConnect
  wcCard: { gap: Spacing.md, borderRadius: Radii.xl, borderColor: Colors.primary + '44' },
  wcHeader: { alignItems: 'center', gap: 8 },
  wcIconBg: {
    width: 60, height: 60, borderRadius: 30,
    backgroundColor: Colors.primaryDim, borderWidth: 1, borderColor: Colors.primary + '44',
    alignItems: 'center', justifyContent: 'center',
  },
  wcTitle: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary },
  wcSubtitle: { fontSize: 13, color: Colors.textMuted, textAlign: 'center' },
  wcDappInfo: {
    alignItems: 'center', gap: 4,
    backgroundColor: Colors.surfaceElevated, borderRadius: Radii.md, padding: Spacing.md,
    borderWidth: 1, borderColor: Colors.surfaceBorder,
  },
  wcDappName: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary },
  wcDappUrl: { fontSize: 12, color: Colors.textMuted },
  wcNetworkRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 },
  wcNetworkText: { fontSize: 11, color: Colors.textMuted },
  wcWarning: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: Colors.warning + '15', borderRadius: Radii.sm, padding: Spacing.sm,
  },
  wcWarningText: { flex: 1, fontSize: 12, color: Colors.warning, lineHeight: 18 },
  wcActions: { flexDirection: 'row', gap: Spacing.sm },
  wcRejectBtn: {
    flex: 1, height: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: Colors.error + '22', borderRadius: Radii.md, borderWidth: 1, borderColor: Colors.error + '44',
  },
  wcRejectText: { fontSize: 15, fontWeight: '700', color: Colors.error },
  wcApproveBtn: {
    flex: 1, height: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: Colors.primary, borderRadius: Radii.md,
  },
  wcApproveText: { fontSize: 15, fontWeight: '700', color: Colors.textInverse },
});
