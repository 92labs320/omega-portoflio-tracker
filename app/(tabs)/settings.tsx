import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors, Typography } from '@/constants/Colors';
import { Config } from '@/constants/Config';
import { wipeLocalData } from '@/lib/db';
import { formatDateTime } from '@/lib/format';
import {
  deleteCloudData,
  getLastSync,
  isCloudAvailable,
  isSyncEnabled,
  setSyncEnabled,
} from '@/lib/sync';
import { usePortfolioStore } from '@/store/portfolioStore';

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

function Row({
  icon,
  label,
  value,
  onPress,
  right,
  destructive,
}: {
  icon: IconName;
  label: string;
  value?: string;
  onPress?: () => void;
  right?: React.ReactNode;
  destructive?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [styles.card, pressed && onPress ? { opacity: 0.7 } : null]}
      accessibilityRole={onPress ? 'button' : undefined}
    >
      <View style={styles.cardRow}>
        <View style={[styles.iconWrap, destructive && { backgroundColor: 'rgba(255,68,68,0.1)' }]}>
          <MaterialCommunityIcons name={icon} size={21} color={destructive ? Colors.red : Colors.accent} />
        </View>
        <View style={styles.cardContent}>
          <Text style={[styles.cardLabel, destructive && { color: Colors.red }]}>{label}</Text>
          {value ? <Text style={styles.cardValue}>{value}</Text> : null}
        </View>
        {right ?? (onPress ? <MaterialCommunityIcons name="chevron-right" size={20} color={Colors.textTertiary} /> : null)}
      </View>
    </Pressable>
  );
}

function toCsv(rows: ReturnType<typeof usePortfolioStore.getState>['transactions']): string {
  const esc = (v: string | number) => {
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const header = ['date', 'category', 'type', 'symbol', 'name', 'asset_id', 'quantity', 'price_usd', 'fee_usd', 'platform', 'notes'];
  const lines = rows.map((t) =>
    [t.executedAt, t.category, t.type, t.symbol, t.name, t.assetId, t.quantity, t.priceUsd, t.feeUsd, t.exchange, t.notes]
      .map(esc)
      .join(','),
  );
  return [header.join(','), ...lines].join('\n');
}

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const transactions = usePortfolioStore((s) => s.transactions);
  const sync = usePortfolioStore((s) => s.sync);
  const load = usePortfolioStore((s) => s.load);
  const reset = usePortfolioStore((s) => s.reset);
  const syncError = usePortfolioStore((s) => s.syncError);

  const cloud = isCloudAvailable();
  const [enabled, setEnabled] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refreshState = useCallback(async () => {
    setEnabled(await isSyncEnabled());
    setLastSync(await getLastSync());
  }, []);

  useFocusEffect(
    useCallback(() => {
      refreshState().catch(() => {});
    }, [refreshState]),
  );

  const runSync = async () => {
    setBusy(true);
    try {
      await sync();
    } catch (e) {
      Alert.alert('Backup failed', e instanceof Error ? e.message : 'Try again later.');
    } finally {
      await refreshState();
      setBusy(false);
    }
  };

  const toggleBackup = async (on: boolean) => {
    if (on) {
      Alert.alert(
        'Turn on cloud backup?',
        'Your transactions will be copied to Omega’s secure server, linked only to an anonymous key stored in this iPhone’s Keychain. No account, email or name is collected.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Turn on',
            onPress: async () => {
              await setSyncEnabled(true);
              setEnabled(true);
              await runSync();
            },
          },
        ],
      );
    } else {
      await setSyncEnabled(false);
      setEnabled(false);
    }
  };

  const exportCsv = async () => {
    if (transactions.length === 0) {
      Alert.alert('Nothing to export', 'Add a transaction first.');
      return;
    }
    await Share.share({ title: 'Omega transactions', message: toCsv(transactions) });
  };

  const deleteCloud = () =>
    Alert.alert(
      'Delete cloud backup?',
      'All transactions stored on Omega’s server for this device will be permanently deleted. Data on this iPhone is kept.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setBusy(true);
            try {
              await deleteCloudData();
              await setSyncEnabled(false);
              await refreshState();
              Alert.alert('Deleted', 'Your cloud backup has been deleted.');
            } catch (e) {
              Alert.alert('Could not delete', e instanceof Error ? e.message : 'Try again later.');
            } finally {
              setBusy(false);
            }
          },
        },
      ],
    );

  const eraseLocal = () =>
    Alert.alert(
      'Erase all data on this iPhone?',
      enabled
        ? 'Every transaction on this device will be removed. Your cloud backup is not affected and will be restored on the next sync. Turn off and delete the backup first to remove everything.'
        : 'Every transaction on this device will be permanently removed. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Erase',
          style: 'destructive',
          onPress: async () => {
            await wipeLocalData();
            reset();
            await load();
            await refreshState();
          },
        },
      ],
    );

  const open = (url: string) => Linking.openURL(url).catch(() => Alert.alert('Could not open link', url));

  const version = Constants.expoConfig?.version ?? '1.0.0';

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>Settings</Text>
          <Text style={styles.subtitle}>No account needed · your data stays yours</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Your data</Text>
          <Row
            icon="database-outline"
            label="Stored on this iPhone"
            value={`${transactions.length} transaction${transactions.length === 1 ? '' : 's'}`}
          />
          {cloud && (
            <Row
              icon="cloud-outline"
              label="Cloud backup"
              value={
                enabled
                  ? syncError
                    ? `Last attempt failed · ${syncError}`
                    : `Last backup: ${formatDateTime(lastSync)}`
                  : 'Off · data is only on this iPhone'
              }
              right={
                <Switch
                  value={enabled}
                  onValueChange={toggleBackup}
                  disabled={busy}
                  trackColor={{ true: Colors.accent, false: '#3A3A44' }}
                />
              }
            />
          )}
          {cloud && enabled && (
            <Row
              icon="cloud-sync-outline"
              label="Back up now"
              onPress={busy ? undefined : runSync}
              right={busy ? <ActivityIndicator color={Colors.accent} /> : undefined}
            />
          )}
          <Row icon="file-delimited-outline" label="Export transactions (CSV)" onPress={exportCsv} />
          {cloud && <Row icon="cloud-remove-outline" label="Delete cloud backup" onPress={deleteCloud} destructive />}
          <Row icon="delete-outline" label="Erase data on this iPhone" onPress={eraseLocal} destructive />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Market data</Text>
          <Row icon="chart-line" label="Crypto prices" value="Provided by CoinGecko" onPress={() => open('https://www.coingecko.com')} />
          {cloud && <Row icon="finance" label="Stock prices" value="Provided by Finnhub" onPress={() => open('https://finnhub.io')} />}
          <Row icon="clock-outline" label="Timing" value="Quotes may be delayed and can differ from other sources." />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>About</Text>
          <Row icon="shield-lock-outline" label="Privacy Policy" onPress={() => open(Config.privacyUrl)} />
          <Row icon="file-document-outline" label="Terms of Use" onPress={() => open(Config.termsUrl)} />
          <Row icon="lifebuoy" label="Support" onPress={() => open(Config.supportUrl)} />
          <Row icon="cellphone" label="Version" value={version} />
        </View>

        <View style={styles.notice}>
          <MaterialCommunityIcons name="shield-check-outline" size={22} color={Colors.accent} />
          <View style={styles.noticeContent}>
            <Text style={styles.noticeTitle}>Tracking only</Text>
            <Text style={styles.noticeText}>
              Omega records the transactions you enter and shows market prices. It is not a broker, an exchange or
              financial advice, and it never holds or moves your assets.
            </Text>
          </View>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerBrand}>OMEGA</Text>
          <Text style={styles.footerText}>A 92labs product</Text>
          <Text style={styles.footerText}>© 2026 92labs</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  container: { flex: 1 },
  content: { paddingBottom: 36 },
  header: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 10 },
  title: { ...Typography.largeTitle, color: Colors.text },
  subtitle: { ...Typography.footnote, color: Colors.textSecondary, marginTop: 5 },
  section: { marginTop: 16 },
  sectionTitle: { ...Typography.headline, color: Colors.text, paddingHorizontal: 20, marginBottom: 10 },
  card: {
    marginHorizontal: 16,
    marginBottom: 8,
    paddingHorizontal: 14,
    paddingVertical: 13,
    backgroundColor: Colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  cardRow: { flexDirection: 'row', alignItems: 'center' },
  iconWrap: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    backgroundColor: 'rgba(0,217,100,0.1)',
  },
  cardContent: { flex: 1, marginLeft: 12, marginRight: 8 },
  cardLabel: { ...Typography.subheadline, color: Colors.text },
  cardValue: { ...Typography.caption1, color: Colors.textSecondary, marginTop: 3, lineHeight: 17 },
  notice: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 20,
    padding: 16,
    backgroundColor: 'rgba(0,217,100,0.07)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(0,217,100,0.18)',
  },
  noticeContent: { flex: 1, marginLeft: 12 },
  noticeTitle: { ...Typography.subheadline, color: Colors.text, marginBottom: 5 },
  noticeText: { ...Typography.caption1, color: Colors.textSecondary, lineHeight: 18 },
  footer: { alignItems: 'center', paddingTop: 32, paddingBottom: 12 },
  footerBrand: { color: Colors.accent, fontSize: 12, fontWeight: '800', letterSpacing: 2, marginBottom: 8 },
  footerText: { ...Typography.caption1, color: Colors.textTertiary, marginBottom: 3 },
});
