import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import { Colors } from '@/constants/Colors';

export default function Index() {
  const router = useRouter();

  useEffect(() => {
    const timeout = setTimeout(() => {
      router.replace('/(tabs)');
    }, 1200);

    return () => clearTimeout(timeout);
  }, [router]);

  return (
    <View style={styles.container}>
      <View style={styles.logoBlock}>
        <Text style={styles.title}>Omega Portfolio Tracker</Text>
        <Text style={styles.subtitle}>by 92labs</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background,
  },
  logoBlock: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    color: Colors.accent,
    fontSize: 42,
    fontWeight: '800',
    letterSpacing: 0,
    lineHeight: 50,
    textAlign: 'center',
  },
  subtitle: {
    color: Colors.accent,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1.4,
    lineHeight: 18,
    marginTop: 10,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
});
