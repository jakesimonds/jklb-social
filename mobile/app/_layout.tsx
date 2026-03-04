import '../lib/polyfills';
import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StyleSheet } from 'react-native';
import { AuthProvider } from '../lib/AuthContext';
import { ActionLogProvider } from '../lib/ActionLogContext';
import { setupCallbackListener } from '../lib/auth';

export default function RootLayout() {
  // Capture OAuth callback deep links before Expo Router processes them
  useEffect(() => {
    const cleanup = setupCallbackListener();
    return cleanup;
  }, []);

  return (
    <GestureHandlerRootView style={styles.container}>
      <SafeAreaProvider>
        <AuthProvider>
          <ActionLogProvider>
            <StatusBar style="light" />
            <Stack
              screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: '#1a1a2e' },
              }}
            >
              <Stack.Screen name="index" />
              <Stack.Screen name="login" />
              <Stack.Screen name="+not-found" />
              <Stack.Screen name="settings" options={{ presentation: 'modal' }} />
              <Stack.Screen name="end" options={{ presentation: 'modal' }} />
            </Stack>
          </ActionLogProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
});
