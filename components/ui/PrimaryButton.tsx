// Powered by OnSpace.AI
import React, { memo } from 'react';
import { Pressable, Text, StyleSheet, ActivityIndicator, ViewStyle } from 'react-native';
import { Colors, Radii, Spacing, Typography } from '../../constants/theme';

interface PrimaryButtonProps {
  title: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  style?: ViewStyle;
}

export const PrimaryButton = memo(({
  title,
  onPress,
  loading = false,
  disabled = false,
  variant = 'primary',
  style,
}: PrimaryButtonProps) => {
  const bgColor = {
    primary: Colors.primary,
    secondary: Colors.secondaryDim,
    ghost: 'transparent',
    danger: Colors.error,
  }[variant];

  const textColor = {
    primary: Colors.textInverse,
    secondary: Colors.secondary,
    ghost: Colors.textSecondary,
    danger: '#fff',
  }[variant];

  const borderColor = {
    primary: Colors.primary,
    secondary: Colors.secondary,
    ghost: Colors.surfaceBorder,
    danger: Colors.error,
  }[variant];

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: bgColor, borderColor },
        pressed && styles.pressed,
        (disabled || loading) && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={textColor} size="small" />
      ) : (
        <Text style={[styles.text, { color: textColor }]}>{title}</Text>
      )}
    </Pressable>
  );
});

const styles = StyleSheet.create({
  button: {
    height: 52,
    borderRadius: Radii.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.lg,
  },
  pressed: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },
  disabled: {
    opacity: 0.5,
  },
  text: {
    fontSize: 16,
    fontWeight: '600',
  },
});
