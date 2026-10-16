import React from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AppHeader, PrimaryButton, SecondaryButton } from '../components/ui.js';
import { MapCanvas } from '../components/map/MapCanvas.js';
import theme from '../theme.js';

export function MapScreen({ navigation, session }) {
  return (
    <SafeAreaView style={styles.screen}>
      <AppHeader title="Mano Amiga App" subtitle="Mapa de la instalación" rightAction={<PrimaryButton title="Salir" onPress={() => navigation.replace('Login')} style={styles.logoutButton} textStyle={styles.logoutText} />} />

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.topBar}>
          <Text style={styles.title}>Planta 1</Text>
          <View style={styles.chipsRow}>
            <Text style={styles.chip}>P1</Text>
            <Text style={styles.chipInactive}>P2</Text>
          </View>
        </View>

        <View style={styles.card}>
          <MapCanvas />
        </View>

        <View style={styles.filtersRow}>
          <SecondaryButton title="Extintores" onPress={() => null} style={styles.filterButton} textStyle={styles.filterText} />
          <SecondaryButton title="Botiquines" onPress={() => null} style={styles.filterButton} textStyle={styles.filterText} />
          <SecondaryButton title="Salidas" onPress={() => null} style={styles.filterButton} textStyle={styles.filterText} />
        </View>
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
    paddingTop: 20,
    paddingBottom: 28,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: theme.colors.text,
  },
  chipsRow: {
    flexDirection: 'row',
  },
  chip: {
    backgroundColor: theme.colors.navy,
    color: theme.colors.white,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    fontWeight: '700',
    marginRight: 8,
  },
  chipInactive: {
    backgroundColor: '#E6EBF3',
    color: theme.colors.textSecondary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    fontWeight: '700',
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: theme.colors.border,
    overflow: 'hidden',
    shadowColor: theme.colors.text,
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  filtersRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 18,
    gap: 8,
  },
  filterButton: {
    minHeight: 38,
    paddingHorizontal: 12,
    backgroundColor: theme.colors.surface,
  },
  filterText: {
    fontSize: 12,
  },
  logoutButton: {
    minHeight: 36,
    backgroundColor: '#2D4A75',
    paddingHorizontal: 14,
  },
  logoutText: {
    fontSize: 12,
  },
});
