// Powered by OnSpace.AI
import React, { memo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Colors, Spacing, Radii } from '../../constants/theme';
import { NETWORKS, NetworkId } from '../../constants/config';
import { useWallet } from '../../hooks/useWallet';

const NETWORK_ICONS: Record<NetworkId, string> = {
  ethereum: 'Ξ',
  bsc: '⬡',
  polygon: '⬟',
  solana: '◎',
};

interface AssetRowProps {
  networkId: NetworkId;
  onPress: (networkId: NetworkId) => void;
}

export const AssetRow = memo(({ networkId, onPress }: AssetRowProps) => {
  const { balances } = useWallet();
  const network = NETWORKS[networkId];
  const balance = balances[networkId];

  return (
    <Pressable
      onPress={() => onPress(networkId)}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <View style={[styles.iconBg, { backgroundColor: network.color + '22' }]}>
        <Text style={[styles.icon, { color: network.color }]}>
          {NETWORK_ICONS[networkId]}
        </Text>
      </View>
      <View style={styles.info}>
        <Text style={styles.name}>{network.symbol}</Text>
        <Text style={styles.network}>{network.name}</Text>
      </View>
      <View style={styles.right}>
        <Text style={styles.balance}>{balance?.balance || '0.000000'}</Text>
        <Text style={styles.usd}>${balance?.usdValue || '0.00'}</Text>
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    gap: Spacing.md,
    borderRadius: Radii.md,
  },
  pressed: {
    backgroundColor: Colors.surfaceElevated,
    opacity: 0.8,
  },
  iconBg: {
    width: 44,
    height: 44,
    borderRadius: Radii.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    fontSize: 18,
    fontWeight: '700',
  },
  info: {
    flex: 1,
  },
  name: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  network: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
  },
  right: {
    alignItems: 'flex-end',
  },
  balance: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  usd: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
  },
});
