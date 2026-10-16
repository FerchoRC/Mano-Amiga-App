export const theme = {
  colors: {
    navy: '#1B2F52',
    navySoft: '#243B63',
    background: '#F3F6FA',
    surface: '#FFFFFF',
    border: '#DDE3EC',
    text: '#14213D',
    textSecondary: '#5F6B7F',
    placeholder: '#9AA6B8',
    accent: '#EF6C3E',
    error: '#D93B3B',
    errorBg: '#FDECEC',
    success: '#1E9E5A',
    warning: '#E9A31A',
    info: '#2F6FDB',
    shadow: 'rgba(20, 33, 61, 0.06)',
    panel: '#EAF0F7',
    white: '#FFFFFF',
    greenSoft: '#EAF7F0',
    redSoft: '#FDECEC',
  },
  typography: {
    xs: 12,
    sm: 14,
    md: 16,
    lg: 20,
    xl: 28,
    fontFamily: 'Inter',
    weight: {
      regular: '400',
      semibold: '600',
      bold: '700',
    },
  },
  spacing: {
    xxs: 4,
    xs: 8,
    sm: 12,
    md: 16,
    lg: 20,
    xl: 24,
    xxl: 28,
  },
  radius: {
    sm: 12,
    md: 16,
    pill: 999,
  },
  shadow: {
    card: {
      shadowColor: '#14213D',
      shadowOpacity: 0.06,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 4 },
      elevation: 3,
    },
  },
};

export const globalStyles = {
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  screen: {
    flex: 1,
    backgroundColor: theme.colors.background,
    paddingHorizontal: 20,
    paddingVertical: 24,
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 16,
    shadowColor: theme.colors.text,
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  title: {
    fontFamily: theme.typography.fontFamily,
    fontSize: theme.typography.xl,
    fontWeight: theme.typography.weight.bold,
    color: theme.colors.text,
  },
  subtitle: {
    fontFamily: theme.typography.fontFamily,
    fontSize: theme.typography.sm,
    color: theme.colors.textSecondary,
    lineHeight: 20,
  },
};

export default theme;
