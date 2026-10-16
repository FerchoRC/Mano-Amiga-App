import React from 'react';
import { Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import theme from '../theme';

export function AppHeader({ title, subtitle, rightAction }) {
  return (
    <View style={styles.header}>
      <View style={styles.logoWrap}>
        <View style={styles.logoBadge}>
          <Image source={require('../../assets/brand/mano-amiga-logo.png')} style={styles.logoImage} resizeMode="contain" />
        </View>
        <View>
          <Text style={styles.headerTitle}>Mano Amiga App</Text>
          {subtitle ? <Text style={styles.headerSubtitle}>{subtitle}</Text> : null}
        </View>
      </View>
      {rightAction ? <View>{rightAction}</View> : null}
    </View>
  );
}

export function InputField({ label, value, onChangeText, placeholder, secureTextEntry, keyboardType, error, onBlur, autoCapitalize, editable, rightElement }) {
  return (
    <View style={styles.fieldWrap}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={[styles.inputContainer, error && styles.inputError]}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={theme.colors.placeholder}
          secureTextEntry={secureTextEntry}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize || 'none'}
          editable={editable !== false}
          onBlur={onBlur}
          style={styles.input}
        />
        {rightElement ? <View style={styles.rightElement}>{rightElement}</View> : null}
      </View>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}

export function PrimaryButton({ title, onPress, style, textStyle }) {
  return (
    <Pressable style={[styles.primaryButton, style]} onPress={onPress}>
      <Text style={[styles.primaryButtonText, textStyle]}>{title}</Text>
    </Pressable>
  );
}

export function SecondaryButton({ title, onPress, style, textStyle }) {
  return (
    <Pressable style={[styles.secondaryButton, style]} onPress={onPress}>
      <Text style={[styles.secondaryButtonText, textStyle]}>{title}</Text>
    </Pressable>
  );
}

export function TextButton({ title, onPress, style, textStyle }) {
  return (
    <Pressable style={[styles.textButton, style]} onPress={onPress}>
      <Text style={[styles.textButtonText, textStyle]}>{title}</Text>
    </Pressable>
  );
}

export function RoleChip({ label, active, onPress }) {
  return (
    <Pressable style={[styles.roleChip, active && styles.roleChipActive]} onPress={onPress}>
      <Text style={[styles.roleChipText, active && styles.roleChipTextActive]}>{label}</Text>
    </Pressable>
  );
}

export function Toast({ title, onClose, visible }) {
  if (!visible) return null;

  return (
    <View style={styles.toast}>
      <Text style={styles.toastIcon}>!</Text>
      <View style={styles.toastBody}>
        <Text style={styles.toastTitle}>{title}</Text>
      </View>
      <Pressable onPress={onClose} style={styles.toastClose}>
        <Text style={styles.toastCloseText}>×</Text>
      </Pressable>
    </View>
  );
}

export function Toggle({ active, onToggle }) {
  return (
    <Pressable style={[styles.toggle, active && styles.toggleActive]} onPress={onToggle}>
      <View style={[styles.toggleThumb, active && styles.toggleThumbActive]} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 8,
    backgroundColor: theme.colors.navy,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  logoWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  logoBadge: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: 'transparent',
  },
  logoImage: {
    width: 42,
    height: 42,
  },
  logoText: {
    color: theme.colors.white,
    fontSize: theme.typography.md,
    fontWeight: theme.typography.weight.bold,
  },
  headerTitle: {
    color: theme.colors.white,
    fontSize: theme.typography.md,
    fontWeight: theme.typography.weight.bold,
  },
  headerSubtitle: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: theme.typography.xs,
  },
  fieldWrap: {
    marginBottom: 16,
  },
  label: {
    color: theme.colors.text,
    fontSize: theme.typography.sm,
    fontWeight: theme.typography.weight.semibold,
    marginBottom: 8,
  },
  inputContainer: {
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  inputError: {
    borderColor: theme.colors.error,
    backgroundColor: theme.colors.errorBg,
  },
  input: {
    flex: 1,
    color: theme.colors.text,
    fontSize: theme.typography.sm,
    minHeight: 48,
    paddingVertical: 0,
  },
  rightElement: {
    marginLeft: 8,
  },
  errorText: {
    color: theme.colors.error,
    fontSize: theme.typography.xs,
    marginTop: 8,
    lineHeight: 18,
  },
  primaryButton: {
    minHeight: 52,
    borderRadius: 12,
    backgroundColor: theme.colors.navy,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  primaryButtonText: {
    color: theme.colors.white,
    fontSize: theme.typography.sm,
    fontWeight: theme.typography.weight.bold,
  },
  secondaryButton: {
    minHeight: 52,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  secondaryButtonText: {
    color: theme.colors.text,
    fontSize: theme.typography.sm,
    fontWeight: theme.typography.weight.bold,
  },
  textButton: {
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  textButtonText: {
    color: theme.colors.navy,
    fontSize: theme.typography.sm,
    fontWeight: theme.typography.weight.semibold,
  },
  roleChip: {
    minHeight: 36,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: '#F0F4F9',
    borderWidth: 1,
    borderColor: theme.colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
    marginBottom: 8,
  },
  roleChipActive: {
    backgroundColor: theme.colors.navy,
    borderColor: theme.colors.navy,
  },
  roleChipText: {
    color: theme.colors.text,
    fontSize: theme.typography.xs,
    fontWeight: theme.typography.weight.semibold,
  },
  roleChipTextActive: {
    color: theme.colors.white,
  },
  toast: {
    position: 'absolute',
    top: 24,
    left: 16,
    right: 16,
    backgroundColor: theme.colors.errorBg,
    borderColor: '#F0B6B6',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 10,
  },
  toastBody: {
    flex: 1,
    marginLeft: 10,
  },
  toastTitle: {
    color: theme.colors.text,
    fontSize: theme.typography.sm,
    fontWeight: theme.typography.weight.semibold,
  },
  toastIcon: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: theme.colors.error,
    color: theme.colors.white,
    textAlign: 'center',
    textAlignVertical: 'center',
    fontWeight: '700',
  },
  toastClose: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  toastCloseText: {
    color: theme.colors.textSecondary,
    fontSize: 18,
    fontWeight: '600',
  },
  toggle: {
    width: 50,
    height: 30,
    borderRadius: 999,
    backgroundColor: '#CBD5DF',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  toggleActive: {
    backgroundColor: theme.colors.success,
  },
  toggleThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: theme.colors.white,
    marginLeft: 0,
    shadowColor: theme.colors.text,
    shadowOpacity: 0.12,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  toggleThumbActive: {
    marginLeft: 20,
  },
});
