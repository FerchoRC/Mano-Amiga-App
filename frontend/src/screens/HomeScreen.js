import React, { useMemo } from 'react';
import { Alert, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { getAllowedModules } from '../permissions.js';
import { AppHeader, PrimaryButton } from '../components/ui.js';
import theme from '../theme.js';

const alerts = [
  { title: 'Extintor 2A', detail: 'Vence en 9 días', tone: 'error' },
  { title: 'Seguro del edificio', detail: 'Renovación en 18 días', tone: 'warning' },
  { title: 'Norma OSHA', detail: 'Revisión obligatoria este mes', tone: 'info' },
];

export function HomeScreen({ navigation, session, setSession, markActivity }) {
  if (!session?.user || !session?.company) {
    return null;
  }

  const allowedModules = useMemo(() => getAllowedModules(session.user.role), [session.user.role]);

  const logout = () => {
    markActivity();
    setSession(null);
    navigation.replace('Login');
  };

  return (
    <SafeAreaView style={styles.screen}>
      <AppHeader
        title="Mano Amiga App"
        subtitle={session.company.businessName}
        rightAction={<PrimaryButton title="Salir" onPress={logout} style={styles.logoutButton} textStyle={styles.logoutText} />}
      />

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Usuario</Text>
          <Text style={styles.summaryValue}>{session.user.name}</Text>
          <Text style={styles.summaryMeta}>{session.user.role}</Text>
        </View>

        <Text style={styles.sectionTitle}>Módulos permitidos</Text>
        <View style={styles.grid}>
          {allowedModules.map((module) => (
            <View key={module.id} style={styles.moduleCard}>
              <Text style={styles.moduleIcon}>{module.icon}</Text>
              <Text style={styles.moduleTitle}>{module.label}</Text>
              <Text
                style={styles.moduleLink}
                onPress={() => {
                  markActivity();
                  if (module.id === 'users') {
                    navigation.navigate('Users');
                  } else if (module.id === 'map') {
                    navigation.navigate('Map');
                  } else {
                    Alert.alert(module.label, 'Este módulo está disponible en la versión institucional.');
                  }
                }}
              >
                Abrir
              </Text>
            </View>
          ))}
        </View>

        <Text style={styles.sectionTitle}>Alertas y vencimientos</Text>
        {alerts.map((alert, index) => (
          <View key={`${alert.title}-${index}`} style={[styles.alertRow, alert.tone === 'error' && styles.alertError, alert.tone === 'warning' && styles.alertWarning, alert.tone === 'info' && styles.alertInfo]}>
            <Text style={styles.alertTitle}>{alert.title}</Text>
            <Text style={styles.alertDetail}>{alert.detail}</Text>
          </View>
        ))}
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
    paddingBottom: 36,
  },
  logoutButton: {
    minHeight: 36,
    backgroundColor: '#2D4A75',
    paddingHorizontal: 14,
  },
  logoutText: {
    fontSize: 12,
  },
  summaryCard: {
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
    marginBottom: 18,
  },
  summaryLabel: {
    color: theme.colors.textSecondary,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  summaryValue: {
    color: theme.colors.text,
    fontSize: 24,
    fontWeight: '700',
    marginTop: 6,
  },
  summaryMeta: {
    color: theme.colors.success,
    marginTop: 6,
    fontWeight: '600',
  },
  sectionTitle: {
    color: theme.colors.text,
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 12,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  moduleCard: {
    width: '48%',
    backgroundColor: theme.colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 16,
    marginBottom: 12,
    shadowColor: theme.colors.text,
    shadowOpacity: 0.04,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  moduleIcon: {
    fontSize: 26,
    marginBottom: 10,
  },
  moduleTitle: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  moduleLink: {
    color: theme.colors.navy,
    fontSize: 12,
    fontWeight: '700',
  },
  alertRow: {
    borderLeftWidth: 4,
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
    backgroundColor: theme.colors.surface,
  },
  alertError: { borderLeftColor: theme.colors.error },
  alertWarning: { borderLeftColor: theme.colors.warning },
  alertInfo: { borderLeftColor: theme.colors.info },
  alertTitle: { color: theme.colors.text, fontWeight: '700', marginBottom: 4 },
  alertDetail: { color: theme.colors.textSecondary, fontSize: 12 },
});
