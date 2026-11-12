import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Share, Switch } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';

import { Group, NavRow, SettingsPage } from '@/components/settings/SettingsUI';
import { Colors } from '@/constants/Colors';
import { wipeLocalData } from '@/lib/db';
import { formatDateTime } from '@/lib/format';
import { deleteCloudData, getLastSync, isCloudAvailable, isSyncEnabled, setSyncEnabled } from '@/lib/sync';
import type { Transaction } from '@/lib/types';
import { usePortfolioStore } from '@/store/portfolioStore';

function toCsv(rows: Transaction[]): string {
  const esc = (v: string | number) => {
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const header = ['date', 'category', 'type', 'symbol', 'name', 'asset_id', 'quantity', 'price_usd', 'fee_usd', 'platform', 'notes'];
  const lines = rows
    .filter((t) => !t.deleted)
    .map((t) =>
      [t.executedAt, t.category, t.type, t.symbol, t.name, t.assetId, t.quantity, t.priceUsd, t.feeUsd, t.exchange, t.notes]
        .map(esc)
        .join(','),
    );
  return [header.join(','), ...lines].join('\n');
}

const IMPORT_FORMAT =
  'Make sure your file uses the Omega CSV format, with these columns:\n\nDate, Way, Base amount, Base currency (name), Base type, Quote amount, Quote currency, Exchange, Sent/Received from, Sent to, Fee amount, Fee currency (name), Notes\n\nFiles with other columns cannot be imported.';

export default function DataSettings() {
  const router = useRouter();
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

  const toggleBackup = (on: boolean) => {
    if (!on) {
      setSyncEnabled(false).then(() => setEnabled(false));
      return;
    }
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
  };

  const exportCsv = async () => {
    if (!transactions.some((t) => !t.deleted)) {
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

  const count = transactions.filter((t) => !t.deleted).length;

  return (
    <SettingsPage title="Data & Backup">
      <Group title="On this iPhone">
        <NavRow icon="database-outline" label="Stored transactions" value={String(count)} />
        <NavRow
          icon="file-import-outline"
          label="Import transactions (CSV)"
          onPress={() =>
            Alert.alert('Import a CSV file', IMPORT_FORMAT, [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Continue', onPress: () => router.push('/import') },
            ])
          }
        />
        <NavRow icon="file-export-outline" label="Export transactions (CSV)" onPress={exportCsv} />
      </Group>

      {cloud ? (
        <Group
          title="Cloud backup"
          footer="Anonymous: linked to a key stored in your iPhone’s Keychain. No account, email or name."
        >
          <NavRow
            icon="cloud-outline"
            label="Cloud backup"
            detail={
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
          {enabled ? (
            <NavRow
              icon="cloud-sync-outline"
              label="Back up now"
              onPress={busy ? undefined : runSync}
              right={busy ? <ActivityIndicator color={Colors.accent} /> : undefined}
            />
          ) : null}
        </Group>
      ) : null}

      <Group title="Danger zone">
        {cloud ? <NavRow icon="cloud-remove-outline" label="Delete cloud backup" onPress={deleteCloud} destructive /> : null}
        <NavRow icon="delete-outline" label="Erase data on this iPhone" onPress={eraseLocal} destructive />
      </Group>
    </SettingsPage>
  );
}
