import React, { useMemo } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors } from '@/constants/Colors';
import {
  TYPE_LABELS,
  formatDate,
  formatPct,
  formatQty,
  formatSignedUsd,
  formatUsd,
} from '@/lib/format';
import { quoteKey } from '@/lib/portfolio';
import type { Transaction } from '@/lib/types';
import { usePortfolioStore } from '@/store/portfolioStore';

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, color ? { color } : null]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
    </View>
  );
}

export default function AssetDetailScreen() {
  const { key } = useLocalSearchParams<{ key: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const transactions = usePortfolioStore((s) => s.transactions);
  const holdings = usePortfolioStore((s) => s.holdings);
  const quotes = usePortfolioStore((s) => s.quotes);
  const remove = usePortfolioStore((s) => s.remove);

  const sep = (key ?? '').indexOf(':');
  const category = (key ?? '').slice(0, sep);
  const assetId = (key ?? '').slice(sep + 1);

  const holding = holdings.find((h) => h.category === category && h.assetId === assetId);
  const txs = useMemo(
    () => transactions.filter((t) => t.category === category && t.assetId === assetId),
    [transactions, category, assetId],
  );
  const quote = quotes[quoteKey(category, assetId)];

  const value = holding && quote ? holding.quantity * quote.price : null;
  const unrealized = value !== null && holding ? value - holding.costBasis : null;
  const unrealizedPct =
    unrealized !== null && holding && holding.costBasis > 0 ? (unrealized / holding.costBasis) * 100 : null;

  const confirmDelete = (tx: Transaction) => {
    Alert.alert(
      'Delete transaction?',
      `${TYPE_LABELS[tx.type]} ${formatQty(tx.quantity)} ${tx.symbol} on ${formatDate(tx.executedAt)}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => remove(tx.id).catch((e) => Alert.alert('Error', String(e))),
        },
      ],
    );
  };

  const title = holding?.symbol ?? txs[0]?.symbol ?? assetId.toUpperCase();
  const name = holding?.name ?? txs[0]?.name ?? '';

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={10} accessibilityRole="button" accessibilityLabel="Back">
          <MaterialCommunityIcons name="chevron-left" size={30} color={Colors.text} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.title}>{title}</Text>
          {name ? <Text style={styles.subtitle}>{name}</Text> : null}
        </View>
        <Pressable
          onPress={() =>
            router.push({
              pathname: '/add-transaction/form',
              params: { category, type: 'buy', assetId, symbol: title, name },
            })
          }
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Add transaction for this asset"
        >
          <MaterialCommunityIcons name="plus" size={26} color={Colors.accent} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Text style={styles.price}>{quote ? formatUsd(quote.price) : 'Price unavailable'}</Text>
          {quote?.change24h !== undefined && quote?.change24h !== null && (
            <Text style={{ color: quote.change24h >= 0 ? Colors.green : Colors.red, fontWeight: '600' }}>
              {formatPct(quote.change24h)} 24h
            </Text>
          )}
          <View style={styles.statsGrid}>
            <Stat label="Quantity" value={formatQty(holding?.quantity ?? 0)} />
            <Stat label="Value" value={value !== null ? formatUsd(value) : '—'} />
            <Stat label="Avg. cost" value={holding && holding.quantity > 0 ? formatUsd(holding.avgCost) : '—'} />
            <Stat label="Cost basis" value={formatUsd(holding?.costBasis ?? 0)} />
            <Stat
              label="Unrealized"
              value={unrealized !== null ? `${formatSignedUsd(unrealized)} (${formatPct(unrealizedPct)})` : '—'}
              color={unrealized === null ? undefined : unrealized >= 0 ? Colors.green : Colors.red}
            />
            <Stat
              label="Realized"
              value={formatSignedUsd(holding?.realizedPnl ?? 0)}
              color={(holding?.realizedPnl ?? 0) >= 0 ? Colors.green : Colors.red}
            />
          </View>
        </View>

        <Text style={styles.sectionTitle}>Transactions</Text>
        {txs.length === 0 ? (
          <Text style={styles.empty}>No transactions for this asset.</Text>
        ) : (
          <View style={styles.list}>
            {txs.map((tx, i) => (
              <Pressable
                key={tx.id}
                style={({ pressed }) => [styles.txRow, i < txs.length - 1 && styles.divider, pressed && { opacity: 0.7 }]}
                onPress={() => router.push({ pathname: '/add-transaction/form', params: { id: tx.id } })}
                accessibilityRole="button"
                accessibilityHint="Opens the transaction for editing"
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.txType}>
                    {TYPE_LABELS[tx.type]} · {formatQty(tx.quantity)}
                  </Text>
                  <Text style={styles.txMeta}>
                    {formatDate(tx.executedAt)} · {formatUsd(tx.priceUsd)}
                    {tx.feeUsd ? ` · fee ${formatUsd(tx.feeUsd)}` : ''}
                    {tx.exchange ? ` · ${tx.exchange}` : ''}
                  </Text>
                </View>
                <Text style={styles.txTotal}>{formatUsd(tx.quantity * tx.priceUsd)}</Text>
                <Pressable
                  onPress={() => confirmDelete(tx)}
                  hitSlop={10}
                  style={styles.trash}
                  accessibilityRole="button"
                  accessibilityLabel="Delete transaction"
                >
                  <MaterialCommunityIcons name="trash-can-outline" size={20} color={Colors.textTertiary} />
                </Pressable>
              </Pressable>
            ))}
          </View>
        )}
        <Text style={styles.footnote}>
          Cost basis uses the average-cost method. Tap a transaction to edit it.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10 },
  headerCenter: { flex: 1, alignItems: 'center' },
  title: { color: Colors.text, fontSize: 18, fontWeight: '700' },
  subtitle: { color: Colors.textTertiary, fontSize: 12, marginTop: 2 },
  content: { padding: 16, paddingBottom: 40 },
  card: {
    backgroundColor: Colors.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    padding: 16,
  },
  price: { color: Colors.text, fontSize: 30, fontWeight: '700', marginBottom: 4 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 16 },
  stat: { width: '50%', paddingVertical: 8, paddingRight: 8 },
  statLabel: { color: Colors.textTertiary, fontSize: 12, marginBottom: 4 },
  statValue: { color: Colors.text, fontSize: 15, fontWeight: '600' },
  sectionTitle: { color: Colors.text, fontSize: 19, fontWeight: '700', marginTop: 26, marginBottom: 12 },
  list: {
    backgroundColor: Colors.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    overflow: 'hidden',
  },
  txRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 13 },
  divider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.borderLight },
  txType: { color: Colors.text, fontSize: 15, fontWeight: '600', marginBottom: 3 },
  txMeta: { color: Colors.textTertiary, fontSize: 12 },
  txTotal: { color: Colors.text, fontSize: 14, fontWeight: '600', marginLeft: 8 },
  trash: { marginLeft: 12, padding: 2 },
  empty: { color: Colors.textSecondary, textAlign: 'center', marginTop: 12 },
  footnote: { color: Colors.textTertiary, fontSize: 11, textAlign: 'center', marginTop: 16 },
});
