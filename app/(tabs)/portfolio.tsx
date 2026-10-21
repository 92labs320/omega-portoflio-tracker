import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DonutChart } from '@/components/DonutChart';
import { Colors } from '@/constants/Colors';
import { assetColor } from '@/lib/colors';
import { formatPct, formatQty, formatSignedUsd, formatTime, formatUsd } from '@/lib/format';
import { quoteKey, summarize } from '@/lib/portfolio';
import type { AssetCategory } from '@/lib/types';
import { usePortfolioStore } from '@/store/portfolioStore';

type Filter = 'all' | AssetCategory;
const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'crypto', label: 'Crypto' },
  { id: 'stock', label: 'Stocks' },
];

const QUOTE_REFRESH_MS = 60_000;

export default function PortfolioScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const holdings = usePortfolioStore((s) => s.holdings);
  const quotes = usePortfolioStore((s) => s.quotes);
  const ready = usePortfolioStore((s) => s.ready);
  const quotesLoading = usePortfolioStore((s) => s.quotesLoading);
  const quotesError = usePortfolioStore((s) => s.quotesError);
  const quotesUpdatedAt = usePortfolioStore((s) => s.quotesUpdatedAt);
  const refreshQuotes = usePortfolioStore((s) => s.refreshQuotes);
  const [filter, setFilter] = useState<Filter>('all');

  useFocusEffect(
    useCallback(() => {
      refreshQuotes();
      const t = setInterval(refreshQuotes, QUOTE_REFRESH_MS);
      return () => clearInterval(t);
    }, [refreshQuotes]),
  );

  // Fetch prices as soon as a new asset appears (e.g. right after the first load or a sync).
  const assetKeys = holdings
    .filter((h) => h.quantity > 0)
    .map((h) => `${h.category}:${h.assetId}`)
    .sort()
    .join('|');
  useEffect(() => {
    if (assetKeys) refreshQuotes();
  }, [assetKeys, refreshQuotes]);

  const open = useMemo(
    () => holdings.filter((h) => h.quantity > 0 && (filter === 'all' || h.category === filter)),
    [holdings, filter],
  );

  const rows = useMemo(
    () =>
      open
        .map((h) => {
          const q = quotes[quoteKey(h.category, h.assetId)];
          const value = q ? h.quantity * q.price : null;
          const pnl = value !== null ? value - h.costBasis : null;
          return {
            h,
            q,
            value,
            pnl,
            pnlPct: pnl !== null && h.costBasis > 0 ? (pnl / h.costBasis) * 100 : null,
          };
        })
        .sort((a, b) => (b.value ?? -1) - (a.value ?? -1)),
    [open, quotes],
  );

  const summary = useMemo(
    () => summarize(holdings.filter((h) => filter === 'all' || h.category === filter), quotes),
    [holdings, quotes, filter],
  );
  const gain = summary.unrealizedPnl >= 0;
  const pnlColor = gain ? Colors.green : Colors.red;

  const donut = rows
    .filter((r) => r.value !== null && r.value > 0)
    .map((r) => ({ value: r.value as number, label: r.h.symbol, color: assetColor(r.h.symbol) }));

  const hasAnyHolding = holdings.some((h) => h.quantity > 0);
  const closedOnly = !hasAnyHolding && holdings.length > 0;

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Portfolio</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={quotesLoading} onRefresh={refreshQuotes} tintColor={Colors.accent} />
        }
      >
        {hasAnyHolding && (
          <View style={styles.filterRow}>
            {FILTERS.map((f) => (
              <Pressable
                key={f.id}
                style={[styles.filterPill, filter === f.id && styles.filterPillOn]}
                onPress={() => setFilter(f.id)}
                accessibilityRole="button"
                accessibilityState={{ selected: filter === f.id }}
              >
                <Text style={[styles.filterPillText, filter === f.id && styles.filterPillTextOn]}>{f.label}</Text>
              </Pressable>
            ))}
          </View>
        )}

        {hasAnyHolding && (
          <View style={styles.worthSection}>
            <Text style={styles.worthLabel}>Total worth</Text>
            <View style={styles.worthRow}>
              <Text style={styles.worthValue} adjustsFontSizeToFit numberOfLines={1}>
                {formatUsd(summary.totalValue)}
              </Text>
              <Text style={styles.worthCurrency}>USD</Text>
            </View>
            <View style={styles.pnlRow}>
              <Text style={[styles.pnlAbs, { color: pnlColor }]}>{formatSignedUsd(summary.unrealizedPnl)}</Text>
              <View style={[styles.badge, { backgroundColor: gain ? 'rgba(0,217,100,0.15)' : 'rgba(255,68,68,0.15)' }]}>
                <Text style={[styles.badgeText, { color: pnlColor }]}>{formatPct(summary.unrealizedPnlPct)}</Text>
              </View>
              <Text style={styles.pnlCaption}>unrealized</Text>
            </View>
            {summary.realizedPnl !== 0 && (
              <Text style={styles.realized}>
                Realized P&L:{' '}
                <Text style={{ color: summary.realizedPnl >= 0 ? Colors.green : Colors.red }}>
                  {formatSignedUsd(summary.realizedPnl)}
                </Text>
              </Text>
            )}
            <Text style={styles.updated}>
              {quotesError
                ? `${quotesError}${quotesUpdatedAt ? ` · last update ${formatTime(quotesUpdatedAt)}` : ''}`
                : quotesUpdatedAt
                  ? `Prices updated ${formatTime(quotesUpdatedAt)}`
                  : 'Fetching live prices…'}
              {summary.unpricedCount > 0 ? ` · ${summary.unpricedCount} asset(s) without price excluded` : ''}
            </Text>
          </View>
        )}

        {donut.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Allocation</Text>
            <DonutChart data={donut} centerLabel={`${donut.length} asset${donut.length > 1 ? 's' : ''}`} />
          </View>
        )}

        {rows.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Holdings</Text>
            <View style={styles.holdingsList}>
              {rows.map(({ h, q, value, pnl, pnlPct }, idx) => {
                const pos = (pnl ?? 0) >= 0;
                const rowColor = pos ? Colors.green : Colors.red;
                const ac = assetColor(h.symbol);
                return (
                  <Pressable
                    key={`${h.category}:${h.assetId}`}
                    style={({ pressed }) => [
                      styles.holdingRow,
                      idx < rows.length - 1 && styles.holdingDivider,
                      pressed && { opacity: 0.7 },
                    ]}
                    onPress={() =>
                      router.push({
                        pathname: '/asset/[key]',
                        params: { key: `${h.category}:${h.assetId}` },
                      })
                    }
                    accessibilityRole="button"
                  >
                    <View style={styles.holdingLeft}>
                      <View style={[styles.circle, { backgroundColor: ac + '26' }]}>
                        <Text style={[styles.circleText, { color: ac }]}>{h.symbol.slice(0, 3).toUpperCase()}</Text>
                      </View>
                      <View style={styles.assetMeta}>
                        <Text style={styles.assetSymbol}>{h.symbol.toUpperCase()}</Text>
                        <Text style={styles.assetSub} numberOfLines={1}>
                          {formatQty(h.quantity)} · {q ? formatUsd(q.price) : 'no price'}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.holdingRight}>
                      <Text style={styles.holdingVal}>{value !== null ? formatUsd(value) : '—'}</Text>
                      {pnl !== null && (
                        <Text style={[styles.holdingPnl, { color: rowColor }]}>
                          {formatSignedUsd(pnl)} ({formatPct(pnlPct)})
                        </Text>
                      )}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}

        {ready && !hasAnyHolding && (
          <View style={styles.empty}>
            <MaterialCommunityIcons name="briefcase-outline" size={56} color={Colors.textTertiary} />
            <Text style={styles.emptyTitle}>{closedOnly ? 'No open positions' : 'No holdings yet'}</Text>
            <Text style={styles.emptySub}>
              {closedOnly
                ? 'All your positions are closed. Add a transaction to open a new one.'
                : 'Record your first buy to start tracking your portfolio. Everything stays on your iPhone.'}
            </Text>
            <Pressable
              style={styles.emptyBtn}
              onPress={() => router.push('/add-transaction')}
              accessibilityRole="button"
            >
              <Text style={styles.emptyBtnText}>Add Transaction</Text>
            </Pressable>
          </View>
        )}

        {hasAnyHolding && rows.length === 0 && (
          <Text style={styles.noFilter}>No {filter === 'stock' ? 'stock' : 'crypto'} holdings.</Text>
        )}
      </ScrollView>

      {hasAnyHolding && (
        <Pressable
          style={({ pressed }) => [styles.fab, pressed && { opacity: 0.85 }]}
          onPress={() => router.push('/add-transaction')}
          accessibilityRole="button"
          accessibilityLabel="Add transaction"
        >
          <MaterialCommunityIcons name="plus" size={28} color={Colors.background} />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  header: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 8 },
  headerTitle: { fontSize: 34, fontWeight: '700', color: Colors.text },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 120 },
  filterRow: { flexDirection: 'row', paddingHorizontal: 16, marginVertical: 12, gap: 8 },
  filterPill: {
    paddingHorizontal: 18,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  filterPillOn: { borderColor: Colors.text, backgroundColor: 'rgba(255,255,255,0.08)' },
  filterPillText: { fontSize: 13, fontWeight: '500', color: Colors.textSecondary },
  filterPillTextOn: { color: Colors.text },
  worthSection: { paddingHorizontal: 20, marginBottom: 8 },
  worthLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.5)',
    marginBottom: 6,
  },
  worthRow: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: 8, gap: 8 },
  worthValue: { flexShrink: 1, fontSize: 40, fontWeight: '700', color: Colors.text, lineHeight: 46 },
  worthCurrency: { fontSize: 14, fontWeight: '500', color: Colors.textSecondary, marginBottom: 7 },
  pnlRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pnlAbs: { fontSize: 15, fontWeight: '600' },
  pnlCaption: { fontSize: 12, color: Colors.textTertiary },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  badgeText: { fontSize: 12, fontWeight: '600' },
  realized: { marginTop: 8, fontSize: 13, color: Colors.textSecondary },
  updated: { marginTop: 10, fontSize: 11, color: Colors.textTertiary },
  section: { marginTop: 22 },
  sectionTitle: { fontSize: 19, fontWeight: '700', color: Colors.text, paddingHorizontal: 20, marginBottom: 12 },
  holdingsList: {
    marginHorizontal: 16,
    backgroundColor: Colors.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    overflow: 'hidden',
  },
  holdingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  holdingDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.borderLight },
  holdingLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 12 },
  circle: { width: 42, height: 42, borderRadius: 21, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  circleText: { fontSize: 12, fontWeight: '800' },
  assetMeta: { flex: 1 },
  assetSymbol: { fontSize: 15, fontWeight: '700', color: Colors.text, marginBottom: 3 },
  assetSub: { fontSize: 12, color: Colors.textSecondary },
  holdingRight: { alignItems: 'flex-end', gap: 4 },
  holdingVal: { fontSize: 15, fontWeight: '700', color: Colors.text },
  holdingPnl: { fontSize: 12, fontWeight: '600' },
  empty: { alignItems: 'center', paddingVertical: 72, paddingHorizontal: 32 },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: Colors.text, marginTop: 20, marginBottom: 8 },
  emptySub: { fontSize: 15, color: Colors.textSecondary, textAlign: 'center', marginBottom: 24, lineHeight: 21 },
  emptyBtn: { backgroundColor: Colors.accent, paddingHorizontal: 28, paddingVertical: 12, borderRadius: 24 },
  emptyBtnText: { fontSize: 15, fontWeight: '700', color: Colors.background },
  noFilter: { color: Colors.textSecondary, textAlign: 'center', marginTop: 32 },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 8,
  },
});
