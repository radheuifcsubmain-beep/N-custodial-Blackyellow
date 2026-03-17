// Powered by OnSpace.AI
import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, Pressable, ScrollView,
  Platform, Alert, Share,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useWallet } from '../../hooks/useWallet';
import { NetworkSelector } from '../../components/feature/NetworkSelector';
import { GlassCard } from '../../components/ui/GlassCard';
import { Colors, Spacing, Radii } from '../../constants/theme';
import { NETWORKS, NetworkId } from '../../constants/config';
import * as Clipboard from 'expo-clipboard';

// Safely import QRCode — falls back to a text display if the package is not available
let QRCode: React.ComponentType<{ value: string; size: number; color: string; backgroundColor: string }> | null = null;
try {
  QRCode = require('react-native-qrcode-svg').default;
} catch {
  QRCode = null;
}

const NETWORK_ICONS: Record<NetworkId, string> = {
  ethereum: 'Ξ',
  bsc: '⬡',
  polygon: '⬟',
  solana: '◎',
};

function QRDisplay({ value }: { value: string }) {
  if (!value) {
    return (
      <View style={styles.qrPlaceholder}>
        <MaterialIcons name="qr-code-2" size={100} color={Colors.textMuted} />
        <Text style={styles.qrPlaceholderText}>No address</Text>
      </View>
    );
  }

  if (QRCode) {
    return (
      <View style={styles.qrBackground}>
        <QRCode
          value={value}
          size={180}
          color="#000000"
          backgroundColor="#FFFFFF"
        />
      </View>
    );
  }

  // Fallback when QR library not available
  return (
    <View style={styles.qrFallback}>
      <MaterialIcons name="qr-code-2" size={60} color={Colors.primary} />
      <Text style={styles.qrFallbackLabel}>Address</Text>
      <Text style={styles.qrFallbackAddress} selectable numberOfLines={4}>
        {value}
      </Text>
    </View>
  );
}

export default function ReceiveScreen() {
  const insets = useSafeAreaInsets();
  const { selectedNetwork, getCurrentAddress, addresses } = useWallet();
  const network = NETWORKS[selectedNetwork];
  const address = getCurrentAddress();
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    if (!address) return;
    try {
      await Clipboard.setStringAsync(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      if (Platform.OS === 'web') {
        try {
          await (navigator as any).clipboard.writeText(address);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch {
          Alert.alert('Address', address);
        }
      }
    }
  }, [address]);

  const handleShare = useCallback(async () => {
    if (!address) return;
    try {
      await Share.share({
        message: `My ${network.name} address: ${address}`,
        title: `${network.name} Address`,
      });
    } catch {
      // ignore
    }
  }, [address, network]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Receive</Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 100 }]}
      >
        <NetworkSelector />

        {/* QR Card */}
        <GlassCard style={styles.qrCard}>
          {/* Network badge */}
          <View style={[styles.networkBadge, { backgroundColor: network.color + '22', borderColor: network.color + '44' }]}>
            <Text style={[styles.networkIcon, { color: network.color }]}>
              {NETWORK_ICONS[selectedNetwork]}
            </Text>
            <Text style={[styles.networkName, { color: network.color }]}>
              {network.name}
            </Text>
          </View>

          {/* QR Code */}
          <View style={styles.qrWrapper}>
            <QRDisplay value={address} />
          </View>

          {/* Address */}
          <Text style={styles.addressLabel}>Your {network.symbol} Address</Text>
          <Pressable onPress={handleCopy} style={styles.addressBox}>
            <Text style={styles.addressText} selectable numberOfLines={2}>
              {address || 'Loading address...'}
            </Text>
            <MaterialIcons
              name={copied ? 'check-circle' : 'content-copy'}
              size={18}
              color={copied ? Colors.accent : Colors.textMuted}
            />
          </Pressable>

          {copied ? (
            <View style={styles.copiedBadge}>
              <MaterialIcons name="check" size={12} color={Colors.accent} />
              <Text style={styles.copiedText}>Address copied to clipboard</Text>
            </View>
          ) : null}
        </GlassCard>

        {/* Actions */}
        <View style={styles.actions}>
          <Pressable
            onPress={handleCopy}
            style={({ pressed }) => [styles.actionBtn, pressed && { opacity: 0.7 }]}
          >
            <MaterialIcons name="content-copy" size={20} color={Colors.primary} />
            <Text style={styles.actionText}>Copy Address</Text>
          </Pressable>

          <Pressable
            onPress={handleShare}
            style={({ pressed }) => [styles.actionBtn, pressed && { opacity: 0.7 }]}
          >
            <MaterialIcons name="share" size={20} color={Colors.primary} />
            <Text style={styles.actionText}>Share Address</Text>
          </Pressable>
        </View>

        {/* Warning */}
        <GlassCard style={{ marginHorizontal: Spacing.md }}>
          <View style={styles.warningHeader}>
            <MaterialIcons name="info-outline" size={16} color={Colors.info} />
            <Text style={styles.warningTitle}>Important</Text>
          </View>
          <Text style={styles.warningText}>
            Only send <Text style={{ color: network.color, fontWeight: '600' }}>{network.symbol}</Text> and {network.name} compatible tokens to this address.
          </Text>
          <Text style={styles.warningText}>
            Sending assets from other networks may result in permanent loss.
          </Text>
        </GlassCard>

        {/* All network addresses */}
        <View style={styles.allAddressesTitle}>
          <Text style={styles.sectionTitle}>All Network Addresses</Text>
        </View>
        {(Object.keys(NETWORKS) as NetworkId[]).map((networkId) => {
          const net = NETWORKS[networkId];
          const addr = addresses ? addresses[networkId] : '';
          return (
            <GlassCard key={networkId} style={styles.networkAddressCard} padding={Spacing.sm}>
              <View style={styles.networkAddressHeader}>
                <View style={[styles.smallBadge, { backgroundColor: net.color + '22' }]}>
                  <Text style={[styles.smallBadgeText, { color: net.color }]}>
                    {NETWORK_ICONS[networkId]}
                  </Text>
                </View>
                <Text style={styles.networkAddressName}>{net.name}</Text>
                <Text style={styles.networkAddressSymbol}>{net.symbol}</Text>
              </View>
              <Text style={styles.networkAddressText} numberOfLines={1} ellipsizeMode="middle">
                {addr || 'Deriving address...'}
              </Text>
            </GlassCard>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.md },
  headerTitle: { fontSize: 22, fontWeight: '700', color: Colors.textPrimary },
  scrollContent: { gap: Spacing.md },
  qrCard: { marginHorizontal: Spacing.md, alignItems: 'center', gap: Spacing.md },
  networkBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radii.full,
    borderWidth: 1,
  },
  networkIcon: { fontSize: 16, fontWeight: '700' },
  networkName: { fontSize: 13, fontWeight: '600' },
  qrWrapper: {
    padding: 4,
    backgroundColor: Colors.surfaceBorder,
    borderRadius: Radii.md,
  },
  qrBackground: {
    backgroundColor: '#FFFFFF',
    padding: 12,
    borderRadius: Radii.sm,
  },
  qrPlaceholder: {
    width: 200,
    height: 200,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surfaceElevated,
    borderRadius: Radii.sm,
    gap: 8,
  },
  qrPlaceholderText: { fontSize: 12, color: Colors.textMuted },
  qrFallback: {
    width: 200,
    minHeight: 160,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surfaceElevated,
    borderRadius: Radii.sm,
    padding: Spacing.md,
    gap: 6,
  },
  qrFallbackLabel: { fontSize: 11, color: Colors.textMuted },
  qrFallbackAddress: {
    fontSize: 9,
    color: Colors.primary,
    fontFamily: 'monospace',
    textAlign: 'center',
    lineHeight: 14,
    letterSpacing: 0.5,
  },
  addressLabel: { fontSize: 13, color: Colors.textMuted, alignSelf: 'flex-start' },
  addressBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.surface,
    borderRadius: Radii.sm,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    padding: Spacing.sm,
    width: '100%',
  },
  addressText: {
    flex: 1,
    fontSize: 11,
    color: Colors.textSecondary,
    fontFamily: 'monospace',
    lineHeight: 18,
  },
  copiedBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  copiedText: { fontSize: 12, color: Colors.accent },
  actions: {
    flexDirection: 'row',
    gap: Spacing.md,
    paddingHorizontal: Spacing.md,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.surfaceElevated,
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: Colors.primary + '44',
    paddingVertical: 14,
  },
  actionText: { fontSize: 14, fontWeight: '600', color: Colors.primary },
  warningHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  warningTitle: { fontSize: 14, fontWeight: '600', color: Colors.info },
  warningText: { fontSize: 13, color: Colors.textSecondary, lineHeight: 20, marginBottom: 4 },
  allAddressesTitle: { paddingHorizontal: Spacing.md },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: Colors.textPrimary },
  networkAddressCard: { marginHorizontal: Spacing.md, gap: 6 },
  networkAddressHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  smallBadge: {
    width: 28,
    height: 28,
    borderRadius: Radii.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  smallBadgeText: { fontSize: 13, fontWeight: '700' },
  networkAddressName: { flex: 1, fontSize: 13, fontWeight: '600', color: Colors.textPrimary },
  networkAddressSymbol: { fontSize: 12, color: Colors.textMuted },
  networkAddressText: { fontSize: 11, color: Colors.textMuted, fontFamily: 'monospace' },
});
