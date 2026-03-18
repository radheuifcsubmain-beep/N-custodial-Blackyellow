// Powered by OnSpace.AI — Activity screen powered by Alchemy
import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, Pressable, Linking,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useWallet } from '../../hooks/useWallet';
import { NetworkSelector } from '../../components/feature/NetworkSelector';
import { LockScreen } from '../../components/feature/LockScreen';
import { GlassCard } from '../../components/ui/GlassCard';
import { Colors, Spacing, Radii } from '../../constants/theme';
import { getNetworks, NetworkId } from '../../constants/config';
import { fetchAlchemyTransactions, AlchemyTransaction } from '../../services/alchemyService';
import { getMockTransactions } from '../../services/blockchainService';

type AnyTransaction = AlchemyTransaction;

function formatDate(timestamp: number): string {
  const now = new Date();
  const diff = now.getTime() - timestamp;
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  if (diff < 604800000) return new Date(timestamp).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  return new Date(timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function shortenAddress(addr: string): string {
  if (!addr || addr.length < 12) return addr;
  return `${addr.slice(0, 8)}...${addr.slice(-6)}`;
}

function statusColor(status: AnyTransaction['status']): string {
  if (status === 'confirmed') return Colors.success;
  if (status === 'failed') return Colors.error;
  return Colors.warning;
}

interface TxRowProps {
  tx: AnyTransaction;
  onPress: (tx: AnyTransaction) => void;
}

const TxRow = React.memo(({ tx, onPress }: TxRowProps) => {
  const isSend = tx.type === 'send';
  const networks = getNetworks(false);
  const network = (networks as any)[tx.network] ?? (networks as any).ethereum;

  return (
    <Pressable
      onPress={() => onPress(tx)}
      style={({ pressed }) => [styles.txRow, pressed && styles.txRowPressed]}
    >
      <View style={[
        styles.txIcon,
        { backgroundColor: isSend ? Colors.error + '22' : Colors.accent + '22' }
      ]}>
        <MaterialIcons
          name={isSend ? 'arrow-upward' : 'arrow-downward'}
          size={20}
          color={isSend ? Colors.error : Colors.accent}
        />
      </View>

      <View style={styles.txInfo}>
        <View style={styles.txTitleRow}>
          <Text style={styles.txType}>{isSend ? 'Sent' : 'Received'}</Text>
          {tx.isToken && (
            <View style={styles.tokenBadge}>
              <Text style={styles.tokenBadgeText}>Token</Text>
            </View>
          )}
        </View>
        <Text style={styles.txAddr} numberOfLines={1}>
          {isSend ? `To: ${shortenAddress(tx.to)}` : `From: ${shortenAddress(tx.from)}`}
        </Text>
        <View style={styles.txMeta}>
          <View style={[styles.networkDot, { backgroundColor: network.color }]} />
          <Text style={styles.txNetworkName}>{network.name}</Text>
          <Text style={styles.txDot}>·</Text>
          <Text style={styles.txTime}>{formatDate(tx.timestamp)}</Text>
          <View style={[styles.statusBadge, { backgroundColor: statusColor(tx.status) + '22' }]}>
            <Text style={[styles.statusText, { color: statusColor(tx.status) }]}>
              {tx.status}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.txRight}>
        <Text style={[styles.txAmount, { color: isSend ? Colors.error : Colors.accent }]}>
          {isSend ? '−' : '+'}{parseFloat(tx.value) > 0 ? tx.value : '0.000000'}
        </Text>
        <Text style={styles.txSymbol}>{tx.symbol}</Text>
        <MaterialIcons name="chevron-right" size={14} color={Colors.textMuted} style={{ marginTop: 4 }} />
      </View>
    </Pressable>
  );
});

export default function HistoryScreen() {
  const insets = useSafeAreaInsets();
  const { selectedNetwork, getCurrentAddress, isLocked, refreshBalances, isTestnet } = useWallet();
  const [transactions, setTransactions] = useState<AnyTransaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [usingMock, setUsingMock] = useState(false);
  const [selectedTx, setSelectedTx] = useState<AnyTransaction | null>(null);
  const fetchedForRef = useRef<string>('');

  const activeNetworks = getNetworks(isTestnet);

  const loadTransactions = useCallback(async () => {
    const address = getCurrentAddress();
    const key = `${address}_${selectedNetwork}_${isTestnet ? 'test' : 'main'}`;
    if (!address || fetchedForRef.current === key) return;
    fetchedForRef.current = key;

    setLoading(true);
    try {
      const txs = await fetchAlchemyTransactions(address, selectedNetwork, isTestnet, 30);
      if (txs.length === 0) {
        const mocks = getMockTransactions(address, selectedNetwork);
        setTransactions(mocks as AnyTransaction[]);
        setUsingMock(true);
      } else {
        setTransactions(txs);
        setUsingMock(false);
      }
    } catch {
      const mocks = getMockTransactions(address, selectedNetwork);
      setTransactions(mocks as AnyTransaction[]);
      setUsingMock(true);
    } finally {
      setLoading(false);
    }
  }, [selectedNetwork, getCurrentAddress, isTestnet]);

  const handleRefresh = useCallback(async () => {
    fetchedForRef.current = '';
    await loadTransactions();
  }, [loadTransactions]);

  useEffect(() => {
    if (!isLocked) {
      fetchedForRef.current = '';
      loadTransactions();
    }
  }, [selectedNetwork, isLocked, isTestnet, loadTransactions]);

  const handleTxPress = useCallback((tx: AnyTransaction) => {
    setSelectedTx(tx);
  }, []);

  const handleOpenExplorer = useCallback((tx: AnyTransaction) => {
    const network = (activeNetworks as any)[tx.network] ?? (activeNetworks as any).ethereum;
    const hash = tx.hash.replace('_token', '');
    const url = `${network.explorerUrl}/tx/${hash}`;
    Linking.openURL(url).catch(() => {});
  }, [activeNetworks]);

  if (isLocked) return <LockScreen onUnlocked={() => refreshBalances()} />;

  const currentNetwork = (activeNetworks as any)[selectedNetwork];

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Activity</Text>
          <Text style={styles.headerSub}>
            {currentNetwork?.name ?? selectedNetwork}
            {isTestnet && <Text style={styles.testnetLabel}> · Testnet</Text>}
            {usingMock && <Text style={styles.mockLabel}> · Demo data</Text>}
          </Text>
        </View>
        <Pressable
          onPress={handleRefresh}
          disabled={loading}
          style={({ pressed }) => [styles.refreshBtn, pressed && { opacity: 0.7 }]}
          hitSlop={8}
        >
          {loading
            ? <ActivityIndicator size="small" color={Colors.primary} />
            : <MaterialIcons name="refresh" size={22} color={Colors.textSecondary} />
          }
        </Pressable>
      </View>

      <NetworkSelector />

      {loading && transactions.length === 0 ? (
        <View style={styles.loadingState}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Fetching transactions via Alchemy...</Text>
        </View>
      ) : transactions.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={styles.emptyIconBg}>
            <MaterialIcons name="history" size={36} color={Colors.textMuted} />
          </View>
          <Text style={styles.emptyTitle}>No Transactions</Text>
          <Text style={styles.emptySubtitle}>
            Your {currentNetwork?.name ?? selectedNetwork} transactions will appear here.
          </Text>
          <Pressable onPress={handleRefresh} style={styles.retryBtn}>
            <MaterialIcons name="refresh" size={16} color={Colors.primary} />
            <Text style={styles.retryBtnText}>Refresh</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={transactions}
          keyExtractor={(item) => item.hash + item.timestamp}
          renderItem={({ item }) => <TxRow tx={item} onPress={handleTxPress} />}
          contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 100 }]}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={loading}
              onRefresh={handleRefresh}
              tintColor={Colors.primary}
            />
          }
          ListHeaderComponent={
            <View style={styles.listHeaderRow}>
              <Text style={styles.listHeader}>
                {transactions.length} Transaction{transactions.length !== 1 ? 's' : ''}
              </Text>
              {usingMock && (
                <View style={styles.demoChip}>
                  <MaterialIcons name="info-outline" size={11} color={Colors.warning} />
                  <Text style={styles.demoChipText}>Demo</Text>
                </View>
              )}
              {!usingMock && (
                <View style={styles.alchemyChip}>
                  <Text style={styles.alchemyChipText}>Alchemy</Text>
                </View>
              )}
            </View>
          }
        />
      )}

      {selectedTx ? (
        <View style={styles.modalOverlay}>
          <Pressable style={styles.modalBackdrop} onPress={() => setSelectedTx(null)} />
          <GlassCard style={styles.detailCard}>
            <View style={styles.detailHeader}>
              <Text style={styles.detailTitle}>Transaction Details</Text>
              <Pressable onPress={() => setSelectedTx(null)} hitSlop={12}>
                <MaterialIcons name="close" size={22} color={Colors.textSecondary} />
              </Pressable>
            </View>

            <View style={[
              styles.detailIcon,
              { backgroundColor: selectedTx.type === 'send' ? Colors.error + '22' : Colors.accent + '22' }
            ]}>
              <MaterialIcons
                name={selectedTx.type === 'send' ? 'arrow-upward' : 'arrow-downward'}
                size={28}
                color={selectedTx.type === 'send' ? Colors.error : Colors.accent}
              />
            </View>

            <Text style={[
              styles.detailAmount,
              { color: selectedTx.type === 'send' ? Colors.error : Colors.accent }
            ]}>
              {selectedTx.type === 'send' ? '−' : '+'}{selectedTx.value} {selectedTx.symbol}
            </Text>

            <View style={styles.detailRows}>
              {[
                {
                  label: 'Status',
                  value: selectedTx.status.charAt(0).toUpperCase() + selectedTx.status.slice(1),
                  color: statusColor(selectedTx.status),
                },
                { label: 'Network', value: (activeNetworks as any)[selectedTx.network]?.name ?? selectedTx.network },
                { label: 'From', value: shortenAddress(selectedTx.from) },
                { label: 'To', value: shortenAddress(selectedTx.to) },
                { label: 'Date', value: new Date(selectedTx.timestamp).toLocaleString() },
                ...(selectedTx.gasUsed && parseFloat(selectedTx.gasUsed) > 0
                  ? [{ label: 'Gas Fee', value: `${selectedTx.gasUsed} ${(activeNetworks as any)[selectedTx.network]?.symbol ?? ''}` }]
                  : []),
                ...(selectedTx.tokenName ? [{ label: 'Token', value: selectedTx.tokenName }] : []),
                ...(selectedTx.blockNumber ? [{ label: 'Block', value: `#${selectedTx.blockNumber}` }] : []),
                ...(selectedTx.asset ? [{ label: 'Asset', value: selectedTx.asset }] : []),
              ].map(({ label, value, color }: any) => (
                <View key={label} style={styles.detailRow}>
                  <Text style={styles.detailLabel}>{label}</Text>
                  <Text style={[styles.detailValue, color ? { color } : null]}>{value}</Text>
                </View>
              ))}
            </View>

            <Pressable
              onPress={() => handleOpenExplorer(selectedTx)}
              style={({ pressed }) => [styles.explorerBtn, pressed && { opacity: 0.7 }]}
            >
              <MaterialIcons name="open-in-new" size={16} color={Colors.primary} />
              <Text style={styles.explorerBtnText}>View on Explorer</Text>
            </Pressable>
          </GlassCard>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.md,
  },
  headerTitle: { fontSize: 22, fontWeight: '700', color: Colors.textPrimary },
  headerSub: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  testnetLabel: { color: Colors.warning, fontSize: 11 },
  mockLabel: { color: Colors.warning, fontSize: 11 },
  refreshBtn: {
    width: 40, height: 40, borderRadius: Radii.full,
    backgroundColor: Colors.surfaceElevated, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.surfaceBorder,
  },
  loadingState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.md },
  loadingText: { fontSize: 14, color: Colors.textMuted },
  emptyState: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    gap: Spacing.md, paddingHorizontal: Spacing.xl,
  },
  emptyIconBg: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: Colors.surfaceElevated, borderWidth: 1, borderColor: Colors.surfaceBorder,
    alignItems: 'center', justifyContent: 'center',
  },
  emptyTitle: { fontSize: 20, fontWeight: '600', color: Colors.textSecondary },
  emptySubtitle: { fontSize: 14, color: Colors.textMuted, textAlign: 'center', lineHeight: 20 },
  retryBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: Spacing.md, paddingVertical: 8,
    backgroundColor: Colors.primaryDim, borderRadius: Radii.full,
    borderWidth: 1, borderColor: Colors.primary + '44',
  },
  retryBtnText: { fontSize: 13, color: Colors.primary, fontWeight: '600' },
  listContent: { padding: Spacing.md, paddingTop: 4 },
  listHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: Spacing.sm },
  listHeader: { fontSize: 13, color: Colors.textMuted },
  demoChip: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: 7, paddingVertical: 2,
    backgroundColor: Colors.warning + '20', borderRadius: Radii.full,
    borderWidth: 1, borderColor: Colors.warning + '40',
  },
  demoChipText: { fontSize: 10, color: Colors.warning, fontWeight: '600' },
  alchemyChip: {
    paddingHorizontal: 7, paddingVertical: 2,
    backgroundColor: Colors.primary + '20', borderRadius: Radii.full,
    borderWidth: 1, borderColor: Colors.primary + '40',
  },
  alchemyChipText: { fontSize: 10, color: Colors.primary, fontWeight: '600' },
  separator: { height: 1, backgroundColor: Colors.surfaceBorder },
  txRow: {
    flexDirection: 'row', alignItems: 'center',
    gap: Spacing.md, paddingVertical: 14, paddingHorizontal: 4,
  },
  txRowPressed: { backgroundColor: Colors.surfaceElevated, borderRadius: Radii.sm },
  txIcon: { width: 44, height: 44, borderRadius: Radii.full, alignItems: 'center', justifyContent: 'center' },
  txInfo: { flex: 1, gap: 3 },
  txTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  txType: { fontSize: 14, fontWeight: '600', color: Colors.textPrimary },
  tokenBadge: {
    paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4,
    backgroundColor: Colors.secondary + '22', borderWidth: 1, borderColor: Colors.secondary + '44',
  },
  tokenBadgeText: { fontSize: 9, color: Colors.secondary, fontWeight: '700' },
  txAddr: { fontSize: 12, color: Colors.textMuted, fontFamily: 'monospace' },
  txMeta: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 1 },
  networkDot: { width: 6, height: 6, borderRadius: 3 },
  txNetworkName: { fontSize: 10, color: Colors.textMuted, fontWeight: '500' },
  txDot: { fontSize: 10, color: Colors.textMuted },
  txTime: { fontSize: 10, color: Colors.textMuted, flex: 1 },
  statusBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  statusText: { fontSize: 9, fontWeight: '700' },
  txRight: { alignItems: 'flex-end', gap: 2 },
  txAmount: { fontSize: 14, fontWeight: '700' },
  txSymbol: { fontSize: 10, color: Colors.textMuted },
  modalOverlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'flex-end', zIndex: 100 },
  modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.75)' },
  detailCard: { margin: Spacing.md, borderRadius: Radii.xl, gap: Spacing.md, borderColor: Colors.surfaceBorder },
  detailHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  detailTitle: { fontSize: 17, fontWeight: '700', color: Colors.textPrimary },
  detailIcon: {
    width: 64, height: 64, borderRadius: 32,
    alignItems: 'center', justifyContent: 'center', alignSelf: 'center',
  },
  detailAmount: { fontSize: 28, fontWeight: '700', textAlign: 'center' },
  detailRows: { gap: 10 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  detailLabel: { fontSize: 13, color: Colors.textMuted },
  detailValue: { fontSize: 13, fontWeight: '500', color: Colors.textPrimary, maxWidth: '65%', textAlign: 'right' },
  explorerBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 14,
    backgroundColor: Colors.primaryDim, borderRadius: Radii.md,
    borderWidth: 1, borderColor: Colors.primary + '44',
  },
  explorerBtnText: { fontSize: 14, fontWeight: '600', color: Colors.primary },
});
