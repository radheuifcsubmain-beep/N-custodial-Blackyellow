// Powered by OnSpace.AI
import React, { useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, RefreshControl } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useWallet } from '../../hooks/useWallet';
import { NetworkSelector } from '../../components/feature/NetworkSelector';
import { BalanceCard } from '../../components/feature/BalanceCard';
import { AssetRow } from '../../components/feature/AssetRow';
import { TokenList } from '../../components/feature/TokenList';
import { LockScreen } from '../../components/feature/LockScreen';
import { GlassCard } from '../../components/ui/GlassCard';
import { Colors, Spacing, Radii } from '../../constants/theme';
import { NETWORKS, NetworkId, USE_TESTNETS } from '../../constants/config';

export default function PortfolioScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const {
    isLoadingBalances, refreshBalances, setSelectedNetwork,
    totalUSD, isLocked, biometricEnabled,
  } = useWallet();

  const handleAssetPress = useCallback((networkId: NetworkId) => {
    setSelectedNetwork(networkId);
  }, [setSelectedNetwork]);

  // Show lock screen if wallet is locked
  if (isLocked) {
    return <LockScreen onUnlocked={() => refreshBalances()} />;
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <View style={styles.headerLabelRow}>
            <Text style={styles.headerLabel}>Portfolio Value</Text>
            {USE_TESTNETS && (
              <View style={styles.testnetChip}>
                <MaterialIcons name="science" size={10} color={Colors.warning} />
                <Text style={styles.testnetChipText}>Testnet</Text>
              </View>
            )}
          </View>
          <Text style={styles.headerValue}>
            ${totalUSD} <Text style={styles.headerCurrency}>USD</Text>
          </Text>
        </View>
        <View style={styles.headerActions}>
          {biometricEnabled && (
            <View style={styles.lockBadge}>
              <MaterialIcons name="fingerprint" size={14} color={Colors.accent} />
            </View>
          )}
          <Pressable
            onPress={() => refreshBalances()}
            style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.6 }]}
            hitSlop={8}
          >
            <MaterialIcons name="refresh" size={22} color={Colors.textSecondary} />
          </Pressable>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isLoadingBalances}
            onRefresh={refreshBalances}
            tintColor={Colors.primary}
          />
        }
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 80 }]}
      >
        {/* Network selector */}
        <NetworkSelector />

        {/* Balance card */}
        <BalanceCard onRefresh={refreshBalances} />

        {/* Quick Actions */}
        <View style={styles.quickActions}>
          <Pressable
            onPress={() => router.push('/(tabs)/send')}
            style={({ pressed }) => [styles.actionBtn, pressed && styles.pressed]}
          >
            <View style={[styles.actionIcon, { backgroundColor: Colors.primaryDim }]}>
              <MaterialIcons name="send" size={20} color={Colors.primary} />
            </View>
            <Text style={styles.actionLabel}>Send</Text>
          </Pressable>

          <Pressable
            onPress={() => router.push('/(tabs)/receive')}
            style={({ pressed }) => [styles.actionBtn, pressed && styles.pressed]}
          >
            <View style={[styles.actionIcon, { backgroundColor: Colors.accentDim }]}>
              <MaterialIcons name="qr-code" size={20} color={Colors.accent} />
            </View>
            <Text style={styles.actionLabel}>Receive</Text>
          </Pressable>

          <Pressable
            onPress={() => router.push('/(tabs)/history')}
            style={({ pressed }) => [styles.actionBtn, pressed && styles.pressed]}
          >
            <View style={[styles.actionIcon, { backgroundColor: Colors.secondaryDim }]}>
              <MaterialIcons name="history" size={20} color={Colors.secondary} />
            </View>
            <Text style={styles.actionLabel}>Activity</Text>
          </Pressable>

          <Pressable
            onPress={() => router.push('/(tabs)/settings')}
            style={({ pressed }) => [styles.actionBtn, pressed && styles.pressed]}
          >
            <View style={[styles.actionIcon, { backgroundColor: Colors.surfaceElevated }]}>
              <MaterialIcons name="settings" size={20} color={Colors.textSecondary} />
            </View>
            <Text style={styles.actionLabel}>Settings</Text>
          </Pressable>

          <Pressable
            onPress={() => router.push('/(tabs)/settings')}
            style={({ pressed }) => [styles.actionBtn, pressed && styles.pressed]}
          >
            <View style={[styles.actionIcon, { backgroundColor: Colors.primary + '22' }]}>
              <MaterialIcons name="add-circle-outline" size={20} color={Colors.primary} />
            </View>
            <Text style={styles.actionLabel}>Import</Text>
          </Pressable>
        </View>

        {/* Assets list (native) */}
        <GlassCard style={styles.assetsCard} padding={0}>
          <View style={styles.assetsHeader}>
            <Text style={styles.assetsTitle}>My Assets</Text>
            <Text style={styles.assetsCount}>{Object.keys(NETWORKS).length} Networks</Text>
          </View>
          <View style={styles.assetsList}>
            {(Object.keys(NETWORKS) as NetworkId[]).map((networkId, idx) => (
              <React.Fragment key={networkId}>
                <AssetRow networkId={networkId} onPress={handleAssetPress} />
                {idx < Object.keys(NETWORKS).length - 1 && (
                  <View style={styles.assetDivider} />
                )}
              </React.Fragment>
            ))}
          </View>

          {/* ERC-20 / BEP-20 tokens */}
          <View style={styles.tokenDivider} />
          <TokenList />
        </GlassCard>

        {/* Security notice */}
        <View style={styles.securityNote}>
          <MaterialIcons name="security" size={14} color={Colors.textMuted} />
          <Text style={styles.securityNoteText}>
            Non-custodial · Your keys, your crypto · Keys never leave your device
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
  },
  headerLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  headerLabel: { fontSize: 12, color: Colors.textMuted },
  testnetChip: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: Colors.warning + '20', borderRadius: Radii.full,
    paddingHorizontal: 6, paddingVertical: 2, borderWidth: 1, borderColor: Colors.warning + '40',
  },
  testnetChipText: { fontSize: 9, color: Colors.warning, fontWeight: '700' },
  headerValue: { fontSize: 26, fontWeight: '700', color: Colors.textPrimary },
  headerCurrency: { fontSize: 14, fontWeight: '400', color: Colors.textSecondary },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  lockBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.accentDim,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.accent + '44',
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: Radii.full,
    backgroundColor: Colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
  },
  scrollContent: { gap: Spacing.md, paddingBottom: 20 },
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: Spacing.md,
  },
  actionBtn: {
    alignItems: 'center',
    gap: 6,
    minWidth: 60,
    paddingVertical: 4,
  },
  actionIcon: {
    width: 52,
    height: 52,
    borderRadius: Radii.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionLabel: { fontSize: 12, color: Colors.textSecondary, fontWeight: '500' },
  pressed: { opacity: 0.7, transform: [{ scale: 0.96 }] },
  assetsCard: { marginHorizontal: Spacing.md },
  assetsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  assetsTitle: { fontSize: 16, fontWeight: '600', color: Colors.textPrimary },
  assetsCount: { fontSize: 12, color: Colors.textMuted },
  assetsList: { paddingBottom: Spacing.xs },
  assetDivider: { height: 1, backgroundColor: Colors.surfaceBorder, marginHorizontal: Spacing.md },
  tokenDivider: { height: 1, backgroundColor: Colors.surfaceBorder, marginHorizontal: Spacing.md, marginTop: Spacing.xs },
  securityNote: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: Spacing.md,
  },
  securityNoteText: { fontSize: 11, color: Colors.textMuted, textAlign: 'center', flex: 1 },
});
