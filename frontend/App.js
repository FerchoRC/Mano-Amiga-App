import { StatusBar } from 'expo-status-bar';
import { Image, SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function App() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />

      <View style={styles.container}>
        <View style={styles.backgroundMap} />
        <View style={styles.overlay} />

        <View style={styles.content}>
          <View style={styles.logoContainer}>
            <Image
              source={require('./assets/brand/mano-amiga-logo.png')}
              style={styles.logo}
              resizeMode="cover"
            />
          </View>

          <Text style={styles.title}>Mano Amiga</Text>
          <Text style={styles.subtitle}>
            Encuentra dónde entregar lo que quieres donar y qué necesita cada punto de acopio de Medellín ahora mismo.
          </Text>

          <View style={styles.infoCard}>
            <Text style={styles.infoBadge}>📍</Text>
            <Text style={styles.infoText}>
              Usamos tu ubicación para ordenar los puntos por cercanía. No guardamos tu recorrido.
            </Text>
          </View>

          <TouchableOpacity style={styles.primaryButton} activeOpacity={0.9}>
            <Text style={styles.primaryButtonText}>Activar ubicación</Text>
          </TouchableOpacity>

          <TouchableOpacity activeOpacity={0.8}>
            <Text style={styles.secondaryText}>Buscar la ciudad manualmente</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0F3B2E',
  },
  container: {
    flex: 1,
    backgroundColor: '#0F3B2E',
    position: 'relative',
  },
  backgroundMap: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#e7eadf',
    opacity: 0.18,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#0F3B2E',
    opacity: 0.86,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingBottom: 32,
    zIndex: 1,
  },
  logoContainer: {
    width: 58,
    height: 58,
    borderRadius: 19,
    backgroundColor: '#F3B23F',
    overflow: 'hidden',
    marginBottom: 24,
    alignSelf: 'flex-start',
  },
  logo: {
    width: '100%',
    height: '100%',
  },
  title: {
    color: '#FFFFFF',
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: -0.5,
    lineHeight: 38,
    marginBottom: 12,
  },
  subtitle: {
    color: '#C3D6CC',
    fontSize: 14.5,
    lineHeight: 22,
    maxWidth: 340,
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderRadius: 14,
    padding: 14,
    marginTop: 28,
    marginBottom: 20,
  },
  infoBadge: {
    fontSize: 16,
    marginRight: 10,
    marginTop: 2,
  },
  infoText: {
    flex: 1,
    color: '#C3D6CC',
    fontSize: 12,
    lineHeight: 18,
  },
  primaryButton: {
    backgroundColor: '#F3B23F',
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    marginBottom: 16,
  },
  primaryButtonText: {
    color: '#3A2A08',
    fontSize: 14.5,
    fontWeight: '700',
  },
  secondaryText: {
    color: '#9DBFB0',
    textAlign: 'center',
    fontSize: 12.5,
  },
});
