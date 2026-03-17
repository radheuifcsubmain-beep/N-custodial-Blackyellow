// Powered by OnSpace.AI
import React, { memo } from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { Colors, Radii, Spacing } from '../../constants/theme';

interface GlassCardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  padding?: number;
}

export const GlassCard = memo(({ children, style, padding = Spacing.md }: GlassCardProps) => (
  <View style={[styles.card, { padding }, style]}>
    {children}
  </View>
));

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: Radii.lg,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
  },
});
