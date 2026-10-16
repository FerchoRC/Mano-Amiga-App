import React, { useState } from 'react';
import { Alert, Image, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { loginUser } from '../mockApi.js';
import { AppHeader, InputField, PrimaryButton, SecondaryButton, TextButton, Toast } from '../components/ui.js';
import theme from '../theme.js';

export function LoginScreen({ navigation, onLogin, markActivity }) {
  const [email, setEmail] = useState('admin@demo.co');
  const [password, setPassword] = useState('Demo1234');
  const [showPassword, setShowPassword] = useState(false);
  const [toast, setToast] = useState('');

  const handleLogin = () => {
    markActivity();
    const result = loginUser(email, password);

    if (!result.ok) {
      setToast(result.message || 'Correo o contraseña incorrectos');
      return;
    }

    onLogin({ user: result.user, company: result.company });
    navigation.replace('Home');
  };

  return (
    <SafeAreaView style={styles.screen}>
      <AppHeader title="Mano Amiga App" subtitle="Control de seguridad" />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.logoWrap}>
          <View style={styles.logoBadge}>
            <Image source={require('../../assets/brand/mano-amiga-logo.png')} style={styles.logoImage} resizeMode="contain" />
          </View>
        </View>

        <Text style={styles.title}>Inicia sesión</Text>

        <View style={styles.card}>
          <InputField
            label="Correo"
            value={email}
            onChangeText={(value) => {
              markActivity();
              setEmail(value);
            }}
            placeholder="usuario@empresa.co"
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <InputField
            label="Contraseña"
            value={password}
            onChangeText={(value) => {
              markActivity();
              setPassword(value);
            }}
            placeholder="••••••••"
            secureTextEntry={!showPassword}
            rightElement={
              <TextButton
                title={showPassword ? 'Ocultar' : 'Mostrar'}
                onPress={() => setShowPassword((value) => !value)}
                textStyle={styles.inlineLink}
              />
            }
          />

          <TextButton
            title="Olvidé mi contraseña"
            onPress={() => Alert.alert('Recuperación', 'Contacta con el administrador de la empresa.')}
            style={styles.forgotLink}
            textStyle={styles.linkText}
          />

          <PrimaryButton title="Iniciar sesión" onPress={handleLogin} style={styles.primaryAction} />
        </View>

        <SecondaryButton title="Registrar empresa" onPress={() => navigation.navigate('Register')} style={styles.registerButton} />
      </ScrollView>

      <Text style={styles.version}>v1.0.1</Text>
      <Toast title={toast} visible={Boolean(toast)} onClose={() => setToast('')} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoWrap: {
    alignItems: 'center',
    marginBottom: 20,
  },
  logoBadge: {
    width: 180,
    height: 180,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  logoImage: {
    width: 180,
    height: 180,
  },
  logoText: {
    color: theme.colors.white,
    fontSize: 42,
    fontWeight: '700',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: 16,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: theme.colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 18,
    shadowColor: theme.colors.text,
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  forgotLink: {
    alignItems: 'flex-end',
    marginBottom: 16,
  },
  linkText: {
    color: theme.colors.navy,
    fontSize: 13,
    fontWeight: '600',
  },
  inlineLink: {
    color: theme.colors.navy,
    fontSize: 12,
    fontWeight: '600',
  },
  primaryAction: {
    width: '100%',
    marginTop: 8,
  },
  registerButton: {
    width: '100%',
    maxWidth: 420,
    marginTop: 16,
  },
  version: {
    position: 'absolute',
    bottom: 18,
    alignSelf: 'center',
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
});
