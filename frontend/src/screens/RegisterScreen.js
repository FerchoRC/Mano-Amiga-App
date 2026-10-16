import React, { useState } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { registerCompany } from '../mockApi.js';
import { AppHeader, InputField, PrimaryButton, SecondaryButton, TextButton } from '../components/ui.js';
import theme from '../theme.js';
import { validateNIT } from '../nit.js';

const sectors = ['Construcción', 'Manufactura', 'Logística', 'Retail', 'Servicios'];

export function RegisterScreen({ navigation, onLogin, markActivity }) {
  const [nit, setNit] = useState('9001234566');
  const [businessName, setBusinessName] = useState('Constructora Demo S.A.S.');
  const [sector, setSector] = useState('Construcción');
  const [employees, setEmployees] = useState('180');
  const [adminName, setAdminName] = useState('Ana Torres');
  const [adminEmail, setAdminEmail] = useState('admin@demo.co');
  const [adminPassword, setAdminPassword] = useState('Demo1234');
  const [error, setError] = useState('');

  const handleRegister = () => {
    markActivity();

    if (!validateNIT(nit)) {
      setError('NIT ya registrado');
      return;
    }

    const result = registerCompany({
      nit,
      businessName,
      sector,
      employees,
      adminName,
      adminEmail,
      adminPassword,
    });

    if (!result.ok) {
      setError(result.message || 'No fue posible registrar la empresa.');
      return;
    }

    onLogin({ user: result.user, company: result.company });
    navigation.replace('Home');
  };

  return (
    <SafeAreaView style={styles.screen}>
      <AppHeader title="Mano Amiga App" subtitle="Alta de empresa" />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Registrar empresa</Text>

        <View style={styles.card}>
          <InputField label="Razón social" value={businessName} onChangeText={setBusinessName} placeholder="Empresa S.A.S." />
          <InputField
            label="NIT"
            value={nit}
            onChangeText={(value) => setNit(value.replace(/[^0-9]/g, '').slice(0, 10))}
            placeholder="9001234566"
            keyboardType="numeric"
            error={error === 'NIT ya registrado' ? 'NIT ya registrado' : undefined}
          />
          <InputField
            label="Sector"
            value={sector}
            onChangeText={setSector}
            placeholder="Selecciona un sector"
            rightElement={<Text style={styles.selectArrow}>▾</Text>}
          />
          <InputField label="Empleados" value={employees} onChangeText={(value) => setEmployees(value.replace(/[^0-9]/g, ''))} placeholder="180" keyboardType="numeric" />

          <Text style={styles.sectionTitle}>Cuenta del administrador</Text>
          <InputField label="Nombre completo" value={adminName} onChangeText={setAdminName} placeholder="Ana Torres" />
          <InputField label="Correo" value={adminEmail} onChangeText={setAdminEmail} placeholder="correo@empresa.co" keyboardType="email-address" autoCapitalize="none" />
          <InputField label="Contraseña" value={adminPassword} onChangeText={setAdminPassword} placeholder="••••••••" secureTextEntry />

          {error && error !== 'NIT ya registrado' ? <Text style={styles.inlineError}>{error}</Text> : null}

          <PrimaryButton title="Registrar empresa" onPress={handleRegister} style={styles.primaryAction} />
        </View>

        <Text style={styles.footerText}>Digitaliza tu seguridad</Text>
        <SecondaryButton title="Volver al login" onPress={() => navigation.navigate('Login')} style={styles.bottomButton} />
      </ScrollView>
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
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: 16,
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 18,
    shadowColor: '#14213D',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.text,
    marginTop: 10,
    marginBottom: 10,
  },
  primaryAction: {
    marginTop: 18,
    backgroundColor: theme.colors.accent,
  },
  footerText: {
    marginTop: 18,
    textAlign: 'center',
    color: theme.colors.textSecondary,
    fontSize: 14,
  },
  inlineError: {
    color: theme.colors.error,
    marginBottom: 8,
    fontSize: 12,
  },
  selectArrow: {
    color: theme.colors.textSecondary,
    fontSize: 16,
    paddingHorizontal: 8,
  },
  bottomButton: {
    marginTop: 14,
  },
});
