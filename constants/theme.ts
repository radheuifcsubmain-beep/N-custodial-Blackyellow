// XU Wallet — Black & Dark Gold Theme
export const Colors = {
  // Base — Pure black foundation
  background: '#000000',
  surface: '#0D0D0D',
  surfaceElevated: '#161200',
  surfaceBorder: '#2C2500',
  cardGlass: 'rgba(13, 13, 0, 0.92)',

  // Brand — Dark golden yellow
  primary: '#E8B800',
  primaryDim: 'rgba(232, 184, 0, 0.15)',
  secondary: '#C98F00',
  secondaryDim: 'rgba(201, 143, 0, 0.15)',
  accent: '#FFD84D',
  accentDim: 'rgba(255, 216, 77, 0.15)',

  // Semantic
  success: '#22C55E',
  error: '#EF4444',
  warning: '#F59E0B',
  info: '#E8B800',

  // Text
  textPrimary: '#FFFFFF',
  textSecondary: '#A89060',
  textMuted: '#5C4E28',
  textInverse: '#000000',

  // Networks — kept recognizable
  ethereum: '#627EEA',
  bsc: '#F3BA2F',
  polygon: '#8247E5',
  solana: '#9945FF',
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const Radii = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 999,
};

export const Typography = {
  h1: { fontSize: 32, fontWeight: '700' as const, color: Colors.textPrimary, letterSpacing: -0.5 },
  h2: { fontSize: 24, fontWeight: '700' as const, color: Colors.textPrimary },
  h3: { fontSize: 20, fontWeight: '600' as const, color: Colors.textPrimary },
  h4: { fontSize: 18, fontWeight: '600' as const, color: Colors.textPrimary },
  body: { fontSize: 16, fontWeight: '400' as const, color: Colors.textPrimary, lineHeight: 24 },
  bodySmall: { fontSize: 14, fontWeight: '400' as const, color: Colors.textSecondary, lineHeight: 20 },
  caption: { fontSize: 12, fontWeight: '500' as const, color: Colors.textMuted },
  mono: { fontSize: 14, fontFamily: 'monospace', color: Colors.textPrimary },
};
