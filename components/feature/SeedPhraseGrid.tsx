// Powered by OnSpace.AI
import React, { memo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, Radii, Spacing } from '../../constants/theme';

interface SeedPhraseGridProps {
  mnemonic: string;
  obscured?: boolean;
}

export const SeedPhraseGrid = memo(({ mnemonic, obscured = false }: SeedPhraseGridProps) => {
  const words = mnemonic.trim().split(' ').filter(Boolean);

  return (
    <View style={styles.grid}>
      {words.map((word, idx) => (
        <View key={idx} style={styles.wordCard}>
          <Text style={styles.index}>{idx + 1}</Text>
          <Text style={styles.word}>{obscured ? '••••' : word}</Text>
        </View>
      ))}
    </View>
  );
});

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    justifyContent: 'center',
  },
  wordCard: {
    width: '30%',
    backgroundColor: Colors.surface,
    borderRadius: Radii.sm,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.xs,
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
  },
  index: {
    fontSize: 10,
    color: Colors.textMuted,
    minWidth: 14,
  },
  word: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.primary,
    fontFamily: 'monospace',
    flex: 1,
  },
});
