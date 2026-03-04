// Login screen — handle entry + OAuth sign-in via system browser

import { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useAuth } from '../lib/AuthContext';
import { STORAGE_KEYS } from '../lib/types';

export default function LoginScreen() {
  const { login, isLoading, error, clearError } = useAuth();
  const router = useRouter();
  const [handle, setHandle] = useState('');

  // Pre-fill with last-used handle (from session expiry, not explicit logout)
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEYS.LAST_HANDLE).then(saved => {
      if (saved) setHandle(saved);
    });
  }, []);

  const handleSubmit = async () => {
    if (!handle.trim() || isLoading) return;
    clearError();
    try {
      await login(handle.trim());
      router.replace('/');
    } catch {
      // Error is set in AuthContext
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <View style={styles.inner}>
        <Text style={styles.title}>
          <Text style={{ color: '#e94560' }}>j</Text>
          <Text style={{ color: '#0f9b8e' }}>k</Text>
          <Text style={{ color: '#e94560' }}>l</Text>
          <Text style={{ color: '#f5c542' }}>b</Text>
        </Text>

        <Text style={styles.subtitle}>Swipe through your Bluesky feed</Text>

        {error && <Text style={styles.error}>{error}</Text>}

        <TextInput
          value={handle}
          onChangeText={setHandle}
          placeholder="your.handle.com"
          placeholderTextColor="rgba(255,255,255,0.3)"
          style={styles.input}
          autoCapitalize="none"
          autoCorrect={false}
          autoFocus
          onSubmitEditing={handleSubmit}
          keyboardType="url"
          returnKeyType="go"
        />

        <TouchableOpacity
          onPress={handleSubmit}
          disabled={!handle.trim() || isLoading}
          style={[styles.button, (!handle.trim() || isLoading) && styles.buttonDisabled]}
        >
          <Text style={styles.buttonText}>
            {isLoading ? 'Signing in...' : 'Sign in with Bluesky'}
          </Text>
        </TouchableOpacity>

        <Text style={styles.hint}>
          You'll be redirected to authorize via your Bluesky PDS
        </Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
  inner: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  title: { fontSize: 36, fontWeight: 'bold', color: 'white', marginBottom: 8 },
  subtitle: { color: 'rgba(255,255,255,0.4)', fontSize: 14, marginBottom: 32 },
  error: { color: '#e94560', fontSize: 14, marginBottom: 16, textAlign: 'center' },
  input: {
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    borderRadius: 8,
    padding: 12,
    color: 'white',
    fontSize: 16,
    marginBottom: 16,
  },
  button: {
    width: '100%',
    backgroundColor: '#e94560',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonDisabled: { opacity: 0.3 },
  buttonText: { color: 'white', fontWeight: '600', fontSize: 16 },
  hint: { color: 'rgba(255,255,255,0.2)', fontSize: 12, marginTop: 16, textAlign: 'center' },
});
