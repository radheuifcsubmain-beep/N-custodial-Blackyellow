// Powered by OnSpace.AI
// ERC-20 / BEP-20 token list — standard + custom (Pinata-imported) tokens
import React, { memo, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, Pressable, ActivityIndicator,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, Spacing, Radii } from '../../constants/theme';
import { useWallet } from '../../hooks/useWallet';
import { TokenBalance } from '../../services/tokenService';
import { CustomToken, fetchCustomTokenBalance } from '../../services/customTokenService';
import { NETWORKS } from '../../constants/config';

// ── Standard token row ────────────────────────────────────────────────────────
const TokenRow = memo(({ item }: { item: TokenBalance }) => {
  const hasBalance = parseFloat(item.balance) > 0;
  return (
    <View style={styles.row}>
      <View style={[styles.iconBg, { backgroundColor: item.token.color + '22' }]}>
        <Text style={[styles.iconText, { color: item.token.color }]}>
          {item.token.symbol[0]}
        </Text>
      </View>
      <View style={styles.info}>
        <Text style={styles.symbol}>{item.token.symbol}</Text>
        <Text style={styles.name}>{item.token.name}</Text>
      </View>
      <View style={styles.right}>
        <Text style={[styles.balance, !hasBalance && styles.zeroBalance]}>
          {parseFloat(item.balance).toFixed(4)}
        </Text>
        <Text style={styles.usd}>
          ${parseFloat(item.usdValue) > 0 ? item.usdValue : '0.00'}
        </Text>
      </View>
    </View>
  );
});

// ── Custom token row ──────────────────────────────────────────────────────────
const CustomTokenRow = memo(({ token, walletAddress, rpcUrl }: {
  token: CustomToken;
  walletAddress: string;
  rpcUrl: string;
}) => {
  const [balance, setBalance] = useState<string>('...');

  useEffect(() => {
    if (token.network === 'solana' || !walletAddress) {
      setBalance('—');
      return;
    }
    let cancelled = false;
    fetchCustomTokenBalance(token, walletAddress, rpcUrl).then(b => {
      if (!cancelled) setBalance(parseFloat(b).toFixed(4));
    });
    return () => { cancelled = true; };
  }, [token.contractAddress, walletAddress, rpcUrl]);

  const hasBalance = balance !== '...' && balance !== '—' && parseFloat(balance) > 0;

  return (
    <View style={styles.row}>
      <View style={[styles.iconBg, { backgroundColor: token.color + '22' }]}>
        <Text style={[styles.iconText, { color: token.color }]}>{token.symbol[0]}</Text>
      </View>
      <View style={styles.info}>
        <View style={styles.symbolRow}>
          <Text style={styles.symbol}>{token.symbol}</Text>
          {token.isOwnToken && (
            <View style={styles.ownBadge}>
              <Text style={styles.ownBadgeText}>My Token</Text>
            </View>
          )}
          <View style={styles.customBadge}>
            <Text style={styles.customBadgeText}>Custom</Text>
          </View>
        </View>
        <Text style={styles.name}>{token.name}</Text>
      </View>
      <View style={styles.right}>
        <Text style={[styles.balance, !hasBalance && styles.zeroBalance]}>
          {balance}
        </Text>
        <Text style={styles.usd}>On-chain</Text>
      </View>
    </View>
  );
});

// ── Main TokenList ────────────────────────────────────────────────────────────
export const TokenList = memo(() => {
  const {
    tokenBalances, isLoadingTokens, selectedNetwork,
    refreshTokenBalances, customTokens, addresses,
  } = useWallet();

  const networkCustomTokens = customTokens.filter(t => t.network === selectedNetwork);
  const walletAddress = addresses?.[selectedNetwork] ?? '';
  const rpcUrl = NETWORKS[selectedNetwork]?.rpcUrl ?? '';

  if (selectedNetwork === 'solana') {
    return (
      <View style={styles.container}>
        <View style={styles.unsupportedNote}>
          <MaterialIcons name="info-outline" size={14} color={Colors.textMuted} />
          <Text style={styles.unsupportedText}>SPL token support coming soon</Text>
        </View>
        {networkCustomTokens.length > 0 && (
          <View>
            <View style={styles.header}>
              <Text style={styles.headerTitle}>Custom Tokens</Text>
            </View>
            {networkCustomTokens.map((token, idx) => (
              <React.Fragment key={token.id}>
                <CustomTokenRow token={token} walletAddress={walletAddress} rpcUrl={rpcUrl} />
                {idx < networkCustomTokens.length - 1 && <View style={styles.divider} />}
              </React.Fragment>
            ))}
          </View>
        )}
      </View>
    );
  }

  if (isLoadingTokens) {
    return (
      <View style={styles.loadingRow}>
        <ActivityIndicator size="small" color={Colors.primary} />
        <Text style={styles.loadingText}>Fetching token balances...</Text>
      </View>
    );
  }

  const hasAnyTokens = tokenBalances.length > 0 || networkCustomTokens.length > 0;

  if (!hasAnyTokens) {
    return (
      <View style={styles.emptyRow}>
        <Text style={styles.emptyText}>No tokens found on this network</Text>
        <Pressable onPress={refreshTokenBalances} hitSlop={8}>
          <MaterialIcons name="refresh" size={18} color={Colors.textMuted} />
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Standard tokens */}
      {tokenBalances.length > 0 && (
        <View>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Tokens</Text>
            <Pressable onPress={refreshTokenBalances} hitSlop={8}>
              <MaterialIcons name="refresh" size={16} color={Colors.textMuted} />
            </Pressable>
          </View>
          {tokenBalances.map((item, idx) => (
            <React.Fragment key={item.token.symbol + item.networkId}>
              <TokenRow item={item} />
              {(idx < tokenBalances.length - 1 || networkCustomTokens.length > 0) && (
                <View style={styles.divider} />
              )}
            </React.Fragment>
          ))}
        </View>
      )}

      {/* Custom (Pinata-imported) tokens */}
      {networkCustomTokens.length > 0 && (
        <View>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Custom Tokens</Text>
            <View style={styles.pinataTag}>
              <Text style={styles.pinataTagText}>IPFS</Text>
            </View>
          </View>
          {networkCustomTokens.map((token, idx) => (
            <React.Fragment key={token.id}>
              <CustomTokenRow token={token} walletAddress={walletAddress} rpcUrl={rpcUrl} />
              {idx < networkCustomTokens.length - 1 && <View style={styles.divider} />}
            </React.Fragment>
          ))}
        </View>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  container: { gap: 0 },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: Spacing.md, paddingTop: Spacing.sm, paddingBottom: 4,
  },
  headerTitle: { fontSize: 13, fontWeight: '600', color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 12, paddingHorizontal: Spacing.md, gap: Spacing.md,
  },
  iconBg: { width: 38, height: 38, borderRadius: Radii.full, alignItems: 'center', justifyContent: 'center' },
  iconText: { fontSize: 16, fontWeight: '700' },
  info: { flex: 1, gap: 2 },
  symbolRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  symbol: { fontSize: 14, fontWeight: '600', color: Colors.textPrimary },
  name: { fontSize: 11, color: Colors.textMuted },
  ownBadge: {
    paddingHorizontal: 5, paddingVertical: 1, borderRadius: Radii.full,
    backgroundColor: Colors.primaryDim, borderWidth: 1, borderColor: Colors.primary + '44',
  },
  ownBadgeText: { fontSize: 8, fontWeight: '700', color: Colors.primary },
  customBadge: {
    paddingHorizontal: 5, paddingVertical: 1, borderRadius: Radii.full,
    backgroundColor: Colors.surfaceElevated, borderWidth: 1, borderColor: Colors.surfaceBorder,
  },
  customBadgeText: { fontSize: 8, fontWeight: '600', color: Colors.textMuted },
  right: { alignItems: 'flex-end' },
  balance: { fontSize: 13, fontWeight: '600', color: Colors.textPrimary },
  zeroBalance: { color: Colors.textMuted },
  usd: { fontSize: 11, color: Colors.textMuted, marginTop: 2 },
  divider: { height: 1, backgroundColor: Colors.surfaceBorder, marginHorizontal: Spacing.md },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
  loadingText: { fontSize: 13, color: Colors.textMuted },
  emptyRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
  emptyText: { fontSize: 13, color: Colors.textMuted },
  unsupportedNote: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
  unsupportedText: { fontSize: 12, color: Colors.textMuted },
  pinataTag: {
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: Radii.full,
    backgroundColor: '#E8431B22', borderWidth: 1, borderColor: '#E8431B44',
  },
  pinataTagText: { fontSize: 9, fontWeight: '700', color: '#E8431B' },
});
