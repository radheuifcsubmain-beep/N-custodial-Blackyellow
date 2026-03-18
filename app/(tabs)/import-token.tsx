// Powered by OnSpace.AI
import React, { useCallback, useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useWallet } from '../../hooks/useWallet';
import { Colors, Spacing, Radii } from '../../constants/theme';
import { fetchTokenMetadataFromChain, lookupTokenInSupabase } from '../../services/tokenContractService';
import { autoFetchTokenMetadata, fetchTokenFromPinataCID } from '../../services/tokenImportService';
import { getNetworks, NetworkId } from '../../constants/config';
import { TokenMetadata } from '../../services/pinataService';

const SUPPORTED_NETWORKS: Exclude<NetworkId, 'solana'>[] = ['ethereum', 'bsc', 'polygon'];

export default function TokenImportScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { importCustomToken, isTestnet } = useWallet();

  const [contractAddress, setContractAddress] = useState('');
  const [networkId, setNetworkId] = useState<Exclude<NetworkId, 'solana'>>('ethereum');
  const [loadingMetadata, setLoadingMetadata] = useState(false);
  const [metadata, setMetadata] = useState<TokenMetadata | null>(null);
  const [fetchError, setFetchError] = useState('');
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState('');

  const handleFetchMetadata = useCallback(async () => {
    const trimmed = contractAddress.trim();
    if (!trimmed || !trimmed.startsWith('0x') || trimmed.length !== 42) {
      setFetchError('Please enter a valid contract address (0x... 42 chars).');
      setMetadata(null);
      return;
    }
    setFetchError('');
    setImportResult('');
    setLoadingMetadata(true);
    try {
      const token = await fetchTokenMetadataFromChain(trimmed, networkId, getNetworks(isTestnet)[networkId].rpcUrl);
      setMetadata(token);
      setFetchError('');
    } catch (error: any) {
      setMetadata(null);
      setFetchError(error?.message ?? 'Could not fetch metadata from chain.');
    } finally {
      setLoadingMetadata(false);
    }
  }, [contractAddress, networkId, isTestnet]);

  const handleConfirmImport = useCallback(async () => {
    if (!metadata) return;
    setImporting(true);
    setImportResult('');
    try {
      // Check Supabase metadata lookup first (with Pinata CID if available)
      const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
      const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

      let importedMetadata: TokenMetadata | null = null;
      let source = 'RPC';

      if (supabaseUrl && supabaseKey) {
        const cid = await lookupTokenInSupabase(metadata.contractAddress, supabaseUrl, supabaseKey);
        if (cid) {
          try {
            const pinataResult = await fetchTokenFromPinataCID(cid);
            importedMetadata = {
              ...pinataResult.metadata,
              contractAddress: metadata.contractAddress,
              network: networkId,
            };
            source = 'Supabase→Pinata';
          } catch (err) {
            console.warn('[TokenImport]', 'Supabase CID found but Pinata fetch failed:', err);
          }
        }
      }

      if (!importedMetadata) {
        const autoResult = await autoFetchTokenMetadata(metadata.contractAddress, networkId, isTestnet);
        importedMetadata = autoResult.metadata;
        source = autoResult.source;
      }

      await importCustomToken(importedMetadata);
      setImportResult(`Token added: ${importedMetadata.name} (${importedMetadata.symbol}) via ${source}`);
      setFetchError('');
      setMetadata(importedMetadata);
    } catch (err: any) {
      setImportResult('');
      setFetchError(err?.message ?? 'Failed to import token.');
    } finally {
      setImporting(false);
    }
  }, [metadata, networkId, isTestnet, importCustomToken]);

  const onClose = useCallback(() => router.back(), [router]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}> 
      <View style={styles.header}>
        <Pressable onPress={onClose} style={styles.backBtn} hitSlop={8}>
          <MaterialIcons name="arrow-back" size={24} color={Colors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>Import Token</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.card}>
        <Text style={styles.hint}>Enter contract address to fetch name, symbol and decimals.</Text>

        <View style={styles.networkRow}>
          {SUPPORTED_NETWORKS.map((nid) => (
            <Pressable
              key={nid}
              onPress={() => setNetworkId(nid)}
              style={[styles.networkBtn, networkId === nid && styles.networkBtnActive]}
            >
              <Text style={[styles.networkText, networkId === nid && styles.networkTextActive]}>
                {nid.toUpperCase()}
              </Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.inputRow}>
          <MaterialIcons name="code" size={18} color={Colors.textMuted} />
          <TextInput
            style={styles.input}
            placeholder="0x... contract address"
            placeholderTextColor={Colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
            value={contractAddress}
            onChangeText={(text) => {
              setContractAddress(text.trim());
              setFetchError('');
              setImportResult('');
              setMetadata(null);
            }}
          />
        </View>

        <Pressable
          onPress={handleFetchMetadata}
          disabled={loadingMetadata || !contractAddress.trim()}
          style={({ pressed }) => [styles.fetchBtn, pressed && { opacity: 0.8 }, !contractAddress.trim() && styles.disabledBtn]}
        >
          {loadingMetadata ? <ActivityIndicator color={Colors.textInverse} /> : <Text style={styles.fetchBtnText}>Fetch Metadata</Text>}
        </Pressable>

        {fetchError ? <Text style={styles.errorText}>{fetchError}</Text> : null}

        {metadata ? (
          <View style={styles.previewBox}>
            <Text style={styles.previewTitle}>Token Preview</Text>
            <Text style={styles.previewLine}>Name: {metadata.name}</Text>
            <Text style={styles.previewLine}>Symbol: {metadata.symbol}</Text>
            <Text style={styles.previewLine}>Decimals: {metadata.decimals}</Text>
            <Text style={styles.previewLine}>Contract: {metadata.contractAddress}</Text>
            <Text style={styles.previewLine}>Network: {networkId.toUpperCase()} {isTestnet ? '(Testnet)' : '(Mainnet)'}</Text>
          </View>
        ) : null}

        <Pressable
          onPress={async () => {
            if (!metadata) {
              setFetchError('Please fetch token metadata first before importing.');
              return;
            }
            handleConfirmImport();
          }}
          disabled={!metadata || importing}
          style={({ pressed }) => [styles.importBtn, pressed && { opacity: 0.8 }, (!metadata || importing) && styles.disabledBtn]}
        >
          {importing ? <ActivityIndicator color={Colors.textInverse} /> : <Text style={styles.importBtnText}>Import Token</Text>}
        </Pressable>

        {importResult ? <Text style={styles.successText}>{importResult}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: Spacing.md, borderBottomWidth: 1, borderColor: Colors.surfaceBorder, backgroundColor: Colors.background },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary },
  card: { margin: Spacing.md, borderRadius: Radii.lg, backgroundColor: Colors.surfaceElevated, borderWidth: 1, borderColor: Colors.surfaceBorder, padding: Spacing.md, gap: Spacing.sm },
  hint: { fontSize: 13, color: Colors.textSecondary, marginBottom: Spacing.xs },
  networkRow: { flexDirection: 'row', gap: 8, marginBottom: Spacing.sm },
  networkBtn: { flex: 1, borderRadius: Radii.full, borderWidth: 1, borderColor: Colors.surfaceBorder, paddingVertical: 8, alignItems: 'center', backgroundColor: Colors.surfaceElevated },
  networkBtnActive: { borderColor: Colors.primary, backgroundColor: Colors.primary + '15' },
  networkText: { color: Colors.textSecondary, fontWeight: '600', fontSize: 12 },
  networkTextActive: { color: Colors.primary },
  inputRow: { flexDirection: 'row', alignItems: 'center', borderRadius: Radii.md, borderWidth: 1, borderColor: Colors.surfaceBorder, backgroundColor: Colors.background, paddingHorizontal: Spacing.sm, marginBottom: Spacing.sm, minHeight: 44 },
  input: { flex: 1, marginLeft: Spacing.xs, color: Colors.textPrimary, height: 42, fontSize: 14 },
  fetchBtn: { backgroundColor: Colors.primary, borderRadius: Radii.md, height: 44, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.sm },
  fetchBtnText: { color: Colors.textInverse, fontWeight: '700' },
  importBtn: { backgroundColor: Colors.accent, borderRadius: Radii.md, height: 44, alignItems: 'center', justifyContent: 'center', marginTop: Spacing.sm },
  importBtnText: { color: Colors.textInverse, fontWeight: '700' },
  disabledBtn: { opacity: 0.5 },
  previewBox: { backgroundColor: Colors.surface, borderRadius: Radii.md, borderWidth: 1, borderColor: Colors.surfaceBorder, padding: Spacing.sm, marginTop: Spacing.sm },
  previewTitle: { fontSize: 13, fontWeight: '700', color: Colors.textPrimary, marginBottom: 4 },
  previewLine: { fontSize: 12, color: Colors.textSecondary },
  errorText: { color: Colors.error, fontSize: 12, marginTop: Spacing.xs },
  successText: { color: Colors.success, fontSize: 12, marginTop: Spacing.xs },
});