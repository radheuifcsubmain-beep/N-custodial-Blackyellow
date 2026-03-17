// Powered by OnSpace.AI
import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useWallet } from '../hooks/useWallet';
import { Colors, Spacing, Radii } from '../constants/theme';
import { MaterialIcons } from '@expo/vector-icons';

export default function OnboardingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isLoaded, hasWallet } = useWallet();

  useEffect(() => {
    if (isLoaded && hasWallet) {
      router.replace('/(tabs)');
    }
  }, [isLoaded, hasWallet]);

  if (!isLoaded) return null;

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom + Spacing.lg }]}>
      {/* Hero Image */}
      <View style={styles.heroContainer}>
        <Image
          source={require('../assets/images/onboarding-hero.png')}
          style={styles.heroImage}
          contentFit="cover"
          transition={300}
        />
        {/* Gradient overlay */}
        <View style={styles.heroOverlay} />
      </View>

      {/* Content */}
      <View style={styles.content}>
        {/* Shield icon */}
        <View style={styles.iconBadge}>
          <MaterialIcons name="shield" size={28} color={Colors.primary} />
        </View>

        <Text style={styles.title}>Your Keys,{'\n'}Your Crypto</Text>
        <Text style={styles.subtitle}>
          A non-custodial wallet where your private keys never leave your device.
          Supporting Ethereum, BSC, Polygon & Solana.
        </Text>

        {/* Feature pills */}
        <View style={styles.features}>
          {['BIP39 Seed Phrase', 'Multi-Chain', 'Self-Custody', 'Secure Storage'].map((f) => (
            <View key={f} style={styles.featurePill}>
              <Text style={styles.featureText}>{f}</Text>
            </View>
          ))}
        </View>

        {/* Actions */}
        <View style={styles.actions}>
          <Pressable
            onPress={() => router.push('/create')}
            style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]}
          >
            <MaterialIcons name="add-circle-outline" size={20} color={Colors.textInverse} />
            <Text style={styles.primaryBtnText}>Create New Wallet</Text>
          </Pressable>

          <Pressable
            onPress={() => router.push('/import')}
            style={({ pressed }) => [styles.secondaryBtn, pressed && styles.pressed]}
          >
            <MaterialIcons name="file-download" size={20} color={Colors.primary} />
            <Text style={styles.secondaryBtnText}>Import with Seed Phrase</Text>
          </Pressable>
        </View>

        <Text style={styles.disclaimer}>
          🔒 Private keys are stored securely on your device only
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  heroContainer: {
    flex: 1,
    position: 'relative',
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  heroOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 120,
    backgroundColor: Colors.background,
    opacity: 0.9,
  },
  content: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
  },
  iconBadge: {
    width: 52,
    height: 52,
    borderRadius: Radii.lg,
    backgroundColor: Colors.primaryDim,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.primary + '44',
  },
  title: {
    fontSize: 34,
    fontWeight: '700',
    color: Colors.textPrimary,
    lineHeight: 42,
    marginBottom: Spacing.sm,
  },
  subtitle: {
    fontSize: 15,
    color: Colors.textSecondary,
    lineHeight: 22,
    marginBottom: Spacing.md,
  },
  features: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    marginBottom: Spacing.lg,
  },
  featurePill: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: Radii.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
  },
  featureText: {
    fontSize: 11,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  actions: {
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  primaryBtn: {
    height: 52,
    backgroundColor: Colors.primary,
    borderRadius: Radii.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textInverse,
  },
  secondaryBtn: {
    height: 52,
    backgroundColor: Colors.primaryDim,
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: Colors.primary + '44',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  secondaryBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.primary,
  },
  pressed: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },
  disclaimer: {
    fontSize: 12,
    color: Colors.textMuted,
    textAlign: 'center',
  },
});
