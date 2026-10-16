import React, { useEffect, useRef, useState } from 'react';
import { Alert, AppState } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { LoginScreen } from './src/screens/LoginScreen.js';
import { RegisterScreen } from './src/screens/RegisterScreen.js';
import { HomeScreen } from './src/screens/HomeScreen.js';
import { UsersScreen } from './src/screens/UsersScreen.js';
import { MapScreen } from './src/screens/MapScreen.js';

const Stack = createNativeStackNavigator();
const INACTIVITY_MS = 10 * 60 * 1000;

export default function App() {
  const [session, setSession] = useState(null);
  const [lastAction, setLastAction] = useState(Date.now());
  const appState = useRef(AppState.currentState);

  const markActivity = () => setLastAction(Date.now());

  useEffect(() => {
    if (!session) {
      return undefined;
    }

    const interval = setInterval(() => {
      const elapsed = Date.now() - lastAction;
      if (elapsed > INACTIVITY_MS) {
        setSession(null);
        Alert.alert('Sesión expirada', 'Se cerró la sesión por inactividad de 10 minutos.');
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [lastAction, session]);

  useEffect(() => {
    if (!session) {
      return undefined;
    }

    const handleAppStateChange = (nextState) => {
      appState.current = nextState;
      if (nextState === 'active') {
        const elapsed = Date.now() - lastAction;
        if (elapsed > INACTIVITY_MS) {
          setSession(null);
          Alert.alert('Sesión expirada', 'La sesión expiró al volver a la app.');
        }
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, [lastAction, session]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <NavigationContainer>
        <Stack.Navigator
          initialRouteName="Login"
          screenOptions={{ headerShown: false }}
        >
          <Stack.Screen name="Login">
            {(props) => <LoginScreen {...props} onLogin={setSession} markActivity={markActivity} />}
          </Stack.Screen>

          <Stack.Screen name="Register">
            {(props) => <RegisterScreen {...props} onLogin={setSession} markActivity={markActivity} />}
          </Stack.Screen>

          <Stack.Screen name="Home">
            {(props) => (
              <HomeScreen {...props} session={session} setSession={setSession} markActivity={markActivity} />
            )}
          </Stack.Screen>

          <Stack.Screen name="Map">
            {(props) => (
              <MapScreen {...props} session={session} setSession={setSession} markActivity={markActivity} />
            )}
          </Stack.Screen>

          <Stack.Screen name="Users">
            {(props) => (
              <UsersScreen {...props} session={session} setSession={setSession} markActivity={markActivity} />
            )}
          </Stack.Screen>
        </Stack.Navigator>
      </NavigationContainer>
    </GestureHandlerRootView>
  );
}
