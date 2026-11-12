import React, { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { NavRow, type IconName } from '@/components/settings/SettingsUI';
import { Colors } from '@/constants/Colors';
import { lockSupport } from '@/lib/biometrics';
import { formatDateTime } from '@/lib/format';
import { getLastSync, isCloudAvailable, isSyncEnabled } from '@/lib/sync';
import { useCurrencyStore } from '@/store/currencyStore';
import { usePortfolioStore } from '@/store/portfolioStore';
import { usePrefsStore } from '@/store/prefsStore';

export default function SettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const currency = useCurrencyStore((s) => s.code);
  const transactions = usePortfolioStore((s) => s.transactions);
  const holdings = usePortfolioStore((s) => s.holdings);
  const appLock = usePrefsStore((s) => s.appLock);

  const [backup, setBackup] = useState<{ on: boolean; last: string | null }>({ on: false, last: null });
  const [lockLabel, setLockLabel] = useState('Face ID');
  useFocusEffect(
    useCallback(() => {
      (async () => {
        setBackup({ on: await isSyncEnabled(), last: await getLastSync() });
        setLockLabel((await lockSupport()).label);
      })().catch(() => {});
    }, []),
  );

  const txCount = transactions.filter((t) => !t.deleted).length;
  const assetCount = holdings.filter((h) => h.quantity > 0).length;
  const version = Constants.expoConfig?.version ?? '1.0.0';

  const items: { icon: IconName; label: string; value?: string; href: Href }[] = [
    { icon: 'cog-outline', label: 'General', value: currency, href: '/preferences/general' },
    { icon: 'briefcase-outline', label: 'Portfolio', href: '/preferences/portfolio' },
    { icon: 'lock-outline', label: 'Security', value: appLock ? `${lockLabel} on` : 'Off', href: '/preferences/security' },
    { icon: 'sync', label: 'Data & Backup', href: '/preferences/data' },
    { icon: 'help-circle-outline', label: 'Support & About', href: '/preferences/about' },
  ];

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Settings</Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        {/* Status card */}
        <Pressable style={styles.hero} onPress={() => router.push('/preferences/data')} accessibilityRole="button">
          <View style={styles.heroTop}>
            <View style={styles.logo}>
              <Text style={styles.logoText}>Ω</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.heroTitle}>Omega</Text>
              <Text style={styles.heroSub}>No account · your data stays on your iPhone</Text>
            </View>
          </View>
          <View style={styles.stats}>
            <View style={styles.stat}>
              <Text style={styles.statValue}>{txCount}</Text>
              <Text style={styles.statLabel}>transactions</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statValue}>{assetCount}</Text>
              <Text style={styles.statLabel}>assets</Text>
            </View>
            <View style={[styles.stat, { flex: 1.6 }]}>
              <View style={styles.backupRow}>
                <View style={[styles.dot, { backgroundColor: backup.on ? Colors.green : Colors.textTertiary }]} />
                <Text style={styles.statValue}>{isCloudAvailable() && backup.on ? 'Backed up' : 'Backup off'}</Text>
              </View>
              <Text style={styles.statLabel} numberOfLines={1}>
                {backup.on && backup.last ? formatDateTime(backup.last) : 'Tap to set up'}
              </Text>
            </View>
          </View>
        </Pressable>

        {/* Sections */}
        <View style={styles.list}>
          {items.map((it, i) => (
            <View key={it.label} style={i < items.length - 1 ? styles.divider : undefined}>
              <NavRow icon={it.icon} label={it.label} value={it.value} onPress={() => router.push(it.href)} />
            </View>
          ))}
        </View>

        <View style={styles.footer}>
          <MaterialCommunityIcons name="shield-check-outline" size={20} color={Colors.textTertiary} />
          <Text style={styles.footerText}>Tracking only · not a broker or financial advice</Text>
          <Text style={styles.footerText}>Omega {version} · a 92labs product</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  header: { paddingVertical: 10 },
  title: { textAlign: 'center', color: Colors.text, fontSize: 22, fontWeight: '800' },

  hero: {
    marginHorizontal: 16,
    marginTop: 10,
    padding: 18,
    borderRadius: 20,
    backgroundColor: '#0E2A1B',
    borderWidth: 1,
    borderColor: 'rgba(0,217,100,0.25)',
  },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  logo: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: { color: Colors.background, fontSize: 28, fontWeight: '900' },
  heroTitle: { color: Colors.text, fontSize: 24, fontWeight: '800' },
  heroSub: { color: Colors.textSecondary, fontSize: 13, marginTop: 2 },
  stats: { flexDirection: 'row', marginTop: 18, gap: 10 },
  stat: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', borderRadius: 12, padding: 12 },
  statValue: { color: Colors.text, fontSize: 16, fontWeight: '800' },
  statLabel: { color: Colors.textSecondary, fontSize: 12, marginTop: 2 },
  backupRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },

  list: { marginTop: 22, marginHorizontal: 16, backgroundColor: '#17171C', borderRadius: 16, overflow: 'hidden' },
  divider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(255,255,255,0.1)' },

  footer: { alignItems: 'center', gap: 4, marginTop: 30 },
  footerText: { color: Colors.textTertiary, fontSize: 12 },
});
