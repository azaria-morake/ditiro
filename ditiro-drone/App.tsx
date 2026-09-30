import './src/services/cryptoPolyfill';
import React, { useState, useEffect } from 'react';
import { StyleSheet, View, ActivityIndicator } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, initialWindowMetrics } from 'react-native-safe-area-context';
import { onAuthStateChanged, User } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { auth } from './src/services/firebase';
import { HomeScreen } from './src/screens/HomeScreen';
import { LoginScreen } from './src/screens/LoginScreen';
import { OnboardingSplashScreen } from './src/screens/OnboardingSplashScreen';
import { COLORS } from './src/constants/theme';
import { setupBackgroundSyncTasks } from './src/services/notifications';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authChecking, setAuthChecking] = useState(true);
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    setupBackgroundSyncTasks();

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser?.uid) {
        await AsyncStorage.setItem('@ditiro_active_uid', currentUser.uid);
      } else {
        await AsyncStorage.removeItem('@ditiro_active_uid');
      }
      setAuthChecking(false);
    });

    return () => unsubscribe();
  }, []);

  return (
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
      <View style={styles.container}>
        <StatusBar style="light" backgroundColor={COLORS.background} />
        {authChecking ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color={COLORS.primaryAccent} />
          </View>
        ) : user ? (
          <HomeScreen
            user={user}
            onSignOut={() => {
              setUser(null);
              setShowSplash(false);
            }}
          />
        ) : showSplash ? (
          <OnboardingSplashScreen onFinish={() => setShowSplash(false)} />
        ) : (
          <LoginScreen onOpenOnboarding={() => setShowSplash(true)} />
        )}
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  centerContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
