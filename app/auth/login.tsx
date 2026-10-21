import React, { useState } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Colors, Typography } from '@/constants/Colors';
import { useAuthStore } from '@/store/authStore';

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { signIn, loading } = useAuthStore();

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }
    try {
      await signIn(email, password);
      router.replace('/(tabs)');
    } catch (error) {
      Alert.alert('Login Failed', (error as Error).message);
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.header}>
        <Text style={styles.title}>Omega</Text>
        <Text style={styles.subtitle}>Portfolio Tracker</Text>
        <Text style={styles.reassurance}>
          Track your crypto and stock portfolio in one place.
        </Text>
      </View>

      <View style={styles.form}>
        <Text style={styles.label}>Email</Text>
        <TextInput
          style={styles.input}
          placeholder="your@email.com"
          placeholderTextColor={Colors.textTertiary}
          value={email}
          onChangeText={setEmail}
          editable={!loading}
          keyboardType="email-address"
          autoCapitalize="none"
        />

        <Text style={[styles.label, { marginTop: 16 }]}>Password</Text>
        <TextInput
          style={styles.input}
          placeholder="••••••••"
          placeholderTextColor={Colors.textTertiary}
          value={password}
          onChangeText={setPassword}
          editable={!loading}
          secureTextEntry
        />

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleLogin}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={Colors.background} />
          ) : (
            <Text style={styles.buttonText}>Sign In</Text>
          )}
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={styles.signUpLink}
        onPress={() => router.push('/auth/register')}
      >
        <Text style={styles.link}>
          Don't have an account?{' '}
          <Text style={styles.linkBold}>Sign Up</Text>
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 108,
    paddingBottom: 36,
  },
  header: {
    alignItems: 'center',
    marginBottom: 42,
  },
  title: {
    ...Typography.largeTitle,
    color: Colors.accent,
    fontSize: 42,
    lineHeight: 48,
    fontWeight: '700',
    letterSpacing: -1,
    marginBottom: 4,
  },
  subtitle: {
    ...Typography.headline,
    color: Colors.textSecondary,
    letterSpacing: 0.3,
  },
  reassurance: {
    ...Typography.body,
    color: Colors.textTertiary,
    textAlign: 'center',
    lineHeight: 22,
    marginTop: 14,
    maxWidth: 300,
  },
  form: {
    width: '100%',
  },
  label: {
    ...Typography.subheadline,
    color: Colors.text,
    marginBottom: 8,
  },
  input: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 15,
    color: Colors.text,
    ...Typography.body,
  },
  button: {
    backgroundColor: Colors.accent,
    borderRadius: 14,
    paddingVertical: 16,
    marginTop: 28,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    ...Typography.headline,
    color: Colors.background,
  },
  signUpLink: {
    marginTop: 'auto',
    paddingTop: 40,
  },
  link: {
    ...Typography.body,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  linkBold: {
    color: Colors.accent,
    fontWeight: '600',
  },
});


