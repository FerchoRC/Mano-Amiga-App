import React, { useState } from 'react';
import { Alert, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { AppHeader, PrimaryButton, RoleChip, SecondaryButton, Toggle } from '../components/ui.js';
import { canManageUsers, ROLES } from '../permissions.js';
import { createInvitation, getCompanyUsers, updateUserAccess } from '../mockApi.js';
import theme from '../theme.js';

export function UsersScreen({ navigation, session, setSession, markActivity }) {
  if (!session?.user || !session?.company) {
    return null;
  }

  const [users, setUsers] = useState(getCompanyUsers(session.company.id));
  const [inviteEmail, setInviteEmail] = useState('');
  const [selectedRole, setSelectedRole] = useState(ROLES.BRIGADISTA);

  if (!canManageUsers(session.user.role)) {
    return (
      <SafeAreaView style={styles.screen}>
        <AppHeader title="Mano Amiga App" subtitle="Acceso" />
        <View style={styles.emptyWrap}>
          <Text style={styles.title}>Sin acceso</Text>
          <Text style={styles.subtitle}>Solo el administrador puede gestionar usuarios.</Text>
          <PrimaryButton title="Volver" onPress={() => navigation.navigate('Home')} style={styles.inlineButton} />
        </View>
      </SafeAreaView>
    );
  }

  const refreshUsers = () => setUsers(getCompanyUsers(session.company.id));

  const applyUpdate = (userId, role, active) => {
    const result = updateUserAccess({ userId, role, active, currentUserId: session.user.id });
    if (!result.ok) {
      Alert.alert('Acción no permitida', result.message);
      return;
    }
    refreshUsers();
    Alert.alert('Usuario actualizado', 'Los cambios se guardaron correctamente.');
  };

  const inviteUser = () => {
    if (!inviteEmail.trim()) {
      Alert.alert('Correo requerido', 'Debes ingresar un correo para la invitación.');
      return;
    }

    const result = createInvitation({ companyId: session.company.id, email: inviteEmail, role: selectedRole });
    setInviteEmail('');
    refreshUsers();
    Alert.alert('Invitación creada', `Contraseña temporal: ${result.temporaryPassword}`);
  };

  return (
    <SafeAreaView style={styles.screen}>
      <AppHeader
        title="Mano Amiga App"
        subtitle="Usuarios"
        rightAction={<PrimaryButton title="Salir" onPress={() => { markActivity(); setSession(null); navigation.replace('Login'); }} style={styles.logoutButton} textStyle={styles.logoutText} />}
      />

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Usuarios y roles</Text>

        <View style={styles.inviteBox}>
          <TextInput
            style={styles.input}
            value={inviteEmail}
            onChangeText={setInviteEmail}
            placeholder="usuario@empresa.co"
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <View style={styles.chipRow}>
            {[ROLES.ADMIN, ROLES.BRIGADISTA, ROLES.EMPLEADO].map((role) => (
              <RoleChip key={role} label={role} active={selectedRole === role} onPress={() => setSelectedRole(role)} />
            ))}
          </View>

          <PrimaryButton title="Invitar usuario" onPress={inviteUser} style={styles.primaryAction} />
        </View>

        <Text style={styles.sectionTitle}>Miembros de la empresa</Text>

        {users.map((user) => (
          <View key={user.id} style={[styles.userCard, !user.active && styles.userCardInactive]}>
            <View style={styles.userHead}>
              <View style={styles.avatarWrap}>
                <Text style={styles.avatar}>{user.name.split(' ').map((part) => part[0]).slice(0, 2).join('')}</Text>
              </View>
              <View style={styles.userInfo}>
                <Text style={styles.userName}>{user.name}</Text>
                <Text style={styles.userEmail}>{user.email}</Text>
              </View>
              <Toggle active={user.active} onToggle={() => applyUpdate(user.id, user.role, !user.active)} />
            </View>

            <View style={styles.chipRow}>
              {[ROLES.ADMIN, ROLES.BRIGADISTA, ROLES.EMPLEADO].map((role) => (
                <RoleChip key={`${user.id}-${role}`} label={role} active={user.role === role} onPress={() => applyUpdate(user.id, role, user.active)} />
              ))}
            </View>
          </View>
        ))}
      </ScrollView>

      <PrimaryButton title=" + Invitar usuario" onPress={inviteUser} style={styles.fab} textStyle={styles.fabText} />
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
    paddingBottom: 90,
  },
  title: {
    color: theme.colors.text,
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 16,
  },
  subtitle: {
    color: theme.colors.textSecondary,
    fontSize: 14,
    marginBottom: 20,
  },
  inviteBox: {
    backgroundColor: theme.colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 16,
    shadowColor: theme.colors.text,
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
    marginBottom: 18,
  },
  input: {
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: 12,
    color: theme.colors.text,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 12,
    marginBottom: 8,
  },
  primaryAction: {
    marginTop: 8,
    backgroundColor: theme.colors.navy,
  },
  sectionTitle: {
    color: theme.colors.text,
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 12,
  },
  userCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 14,
    shadowColor: theme.colors.text,
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    marginBottom: 12,
  },
  userCardInactive: {
    opacity: 0.55,
  },
  userHead: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatarWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: theme.colors.navy,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatar: {
    color: theme.colors.white,
    fontWeight: '700',
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    color: theme.colors.text,
    fontWeight: '700',
    fontSize: 15,
  },
  userEmail: {
    color: theme.colors.textSecondary,
    fontSize: 12,
    marginTop: 3,
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 24,
    width: 180,
    backgroundColor: theme.colors.navy,
    borderRadius: 999,
    shadowColor: theme.colors.text,
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 5,
  },
  fabText: {
    color: theme.colors.white,
  },
  logoutButton: {
    minHeight: 36,
    backgroundColor: '#2D4A75',
    paddingHorizontal: 14,
  },
  logoutText: {
    fontSize: 12,
  },
  emptyWrap: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  inlineButton: {
    marginTop: 16,
  },
});
