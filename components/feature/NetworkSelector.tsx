// Powered by OnSpace.AI
import React, { memo } from 'react';
import { ScrollView, Pressable, Text, View, StyleSheet } from 'react-native';
import { NETWORKS, NetworkId } from '../../constants/config';
import { Colors, Radii, Spacing } from '../../constants/theme';
import { useWallet } from '../../hooks/useWallet';

const NETWORK_ICONS: Record<NetworkId, string> = {
  ethereum: 'Ξ',
  bsc: '⬡',
  polygon: '⬟',
  solana: '◎',
};

export const NetworkSelector = memo(() => {
  const { selectedNetwork, setSelectedNetwork } = useWallet();

  return (
    <View style={styles.wrapper}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.container}
      >
        {(Object.keys(NETWORKS) as NetworkId[]).map((networkId) => {
          const network = NETWORKS[networkId];
          const isSelected = selectedNetwork === networkId;
          return (
            <Pressable
              key={networkId}
              onPress={() => setSelectedNetwork(networkId)}
              style={({ pressed }) => [
                styles.chip,
                isSelected && { backgroundColor: network.color + '22', borderColor: network.color },
                pressed && styles.pressed,
              ]}
            >
              <Text style={[styles.icon, { color: network.color }]}>
                {NETWORK_ICONS[networkId]}
              </Text>
              <Text style={[styles.label, isSelected && { color: network.color }]}>
                {network.name}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
});

const styles = StyleSheet.create({
  wrapper: {
    minHeight: 52,
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    gap: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    borderRadius: Radii.full,
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    height: 40,
  },
  pressed: {
    opacity: 0.7,
  },
  icon: {
    fontSize: 14,
    fontWeight: '700',
  },
  label: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.textSecondary,
  },
});
