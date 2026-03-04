// Catch-all for unmatched routes — primarily handles OAuth callback deep links
// that Expo Router intercepts before expo-web-browser can capture them.

import { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';

export default function NotFound() {
  const router = useRouter();

  useEffect(() => {
    // The OAuth callback URL is captured by the Linking listener in auth.ts.
    // Just navigate back to login so the signIn flow can complete.
    const timer = setTimeout(() => {
      router.replace('/login');
    }, 100);
    return () => clearTimeout(timer);
  }, [router]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#e94560" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
