import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DonutChart } from '@/components/DonutChart';
import { PickerModal } from '@/components/PickerModal';
import { PriceChart, type ScrubPoint } from '@/components/PriceChart';
import { Colors } from '@/constants/Colors';
import { useMarkets } from '@/hooks/useMarkets';
import { usePortfolioHistory } from '@/hooks/usePortfolioHistory';
import { assetColor } from '@/lib/colors';
import { CURRENCIES } from '@/lib/currency';
import {
  formatAmount,
  formatPct,
  formatQty,
  formatShortDateTime,
  formatSignedNumber,
  formatTime,
  formatUsd,
} from '@/lib/format';
import { PORTFOLIO_RANGES, RANGE_LABEL, type PortfolioRange } from '@/lib/history';
import { quoteKey, summarize } from '@/lib/portfolio';
import type { AssetCategory } from '@/lib/types';
import { useCurrencyStore } from '@/store/currencyStore';
import { usePortfolioStore } from '@/store/portfolioStore';
import { fetchStockProfiles, type StockProfile } from '@/services/marketService';
import { usePullRefresh } from '@/hooks/usePullRefresh';

type Filter = 'all' | AssetCategory;
const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'crypto', label: 'Crypto' },
  { id: 'stock', label: 'Stocks' },
];

type Sort = 'value_desc' | 'value_asc' | 'perf_desc' | 'perf_asc' | 'name';
const SORT_LABEL: Record<Sort, string> = {
  value_desc: 'Highest Holdings',
  value_asc: 'Lowest Holdings',
  perf_desc: 'Best Performance',
  perf_asc: 'Worst Performance',
  name: 'Name (A–Z)',
};

const QUOTE_REFRESH_MS = 60_000;

function ChangeLine({ abs, pct, size = 'md' }: { abs: number | null; pct: number | null; size?: 'md' | 'sm' }) {
  if (abs === null && pct === null) return <Text style={styles.muted}>—</Text>;
  const up = (pct ?? abs ?? 0) >= 0;
  const color = up ? Colors.green : Colors.red;
  return (
    <View style={styles.changeLine}>
      {abs !== null ? (
        <Text style={[size === 'md' ? styles.changeAbs : styles.changeAbsSm, { color }]}>{formatSignedNumber(abs)}</Text>
      ) : null}
      {pct !== null ? (
        <View style={[styles.badge, { backgroundColor: up ? 'rgba(0,217,100,0.16)' : 'rgba(255,68,68,0.18)' }]}>
          <Text style={[size === 'md' ? styles.badgeText : styles.badgeTextSm, { color }]}>{formatPct(pct)}</Text>
        </View>
      ) : null}
    </View>
  );
}

export default function PortfolioScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const transactions = usePortfolioStore((s) => s.transactions);
  const holdings = usePortfolioStore((s) => s.holdings);
  const quotes = usePortfolioStore((s) => s.quotes);
  const ready = usePortfolioStore((s) => s.ready);
  const quotesLoading = usePortfolioStore((s) => s.quotesLoading);
  const quotesError = usePortfolioStore((s) => s.quotesError);
  const quotesUpdatedAt = usePortfolioStore((s) => s.quotesUpdatedAt);
  const refreshQuotes = usePortfolioStore((s) => s.refreshQuotes);
  const currency = useCurrencyStore((s) => s.code);
  const setCurrency = useCurrencyStore((s) => s.setCode);
  const rates = useCurrencyStore((s) => s.rates);
  const { coins } = useMarkets();

  const [filter, setFilter] = useState<Filter>('all');
  const [range, setRange] = useState<PortfolioRange>('ALL');
  const [sort, setSort] = useState<Sort>('value_desc');
  const [scrub, setScrub] = useState<ScrubPoint | null>(null);
  const [currencyPicker, setCurrencyPicker] = useState(false);

  useFocusEffect(
    useCallback(() => {
      refreshQuotes();
      const t = setInterval(refreshQuotes, QUOTE_REFRESH_MS);
      return () => clearInterval(t);
    }, [refreshQuotes]),
  );

  const assetKeys = holdings
    .filter((h) => h.quantity > 0)
    .map((h) => `${h.category}:${h.assetId}`)
    .sort()
    .join('|');
  useEffect(() => {
    if (assetKeys) refreshQuotes();
  }, [assetKeys, refreshQuotes]);

  const images = useMemo(() => new Map(coins.map((c) => [c.id, c.image])), [coins]);
  const stockSymbols = holdings
    .filter((h) => h.category === 'stock' && h.quantity > 0)
    .map((h) => h.assetId.toUpperCase())
    .sort()
    .join(',');
  const [stockProfiles, setStockProfiles] = useState<Record<string, StockProfile>>({});
  useEffect(() => {
    if (!stockSymbols) return;
    let alive = true;
    fetchStockProfiles(stockSymbols.split(','))
      .then((p) => alive && setStockProfiles(p))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [stockSymbols]);
  const filtered = useMemo(
    () => holdings.filter((h) => filter === 'all' || h.category === filter),
    [holdings, filter],
  );
  const summary = useMemo(() => summarize(filtered, quotes), [filtered, quotes]);
  const history = usePortfolioHistory(transactions, quotes, range, filter);

  // Headline numbers for the selected range (ALL = unrealized P&L like Delta).
  const headAbs = range === 'ALL' ? summary.unrealizedPnl : history?.change ?? null;
  const headPct = range === 'ALL' ? summary.unrealizedPnlPct : history?.changePct ?? null;
  const shownValue = scrub ? scrub.v : summary.totalValue;
  const scrubChange =
    scrub && history?.points.length ? scrub.v - history.points[0].v : null;
  const positive = (headPct ?? headAbs ?? 0) >= 0;

  const rows = useMemo(() => {
    const out = filtered
      .filter((h) => h.quantity > 0)
      .map((h) => {
        const key = quoteKey(h.category, h.assetId);
        const q = quotes[key];
        const value = q ? h.quantity * q.price : null;
        const allPnl = value !== null ? value - h.costBasis : null;
        const allPct = allPnl !== null && h.costBasis > 0 ? (allPnl / h.costBasis) * 100 : null;
        const per = history?.perAsset[key];
        return {
          h,
          key,
          q,
          value,
          change: range === 'ALL' ? allPnl : per?.change ?? null,
          changePct: range === 'ALL' ? allPct : per?.changePct ?? null,
        };
      });
    const by: Record<Sort, (a: (typeof out)[number], b: (typeof out)[number]) => number> = {
      value_desc: (a, b) => (b.value ?? -1) - (a.value ?? -1),
      value_asc: (a, b) => (a.value ?? Infinity) - (b.value ?? Infinity),
      perf_desc: (a, b) => (b.changePct ?? -Infinity) - (a.changePct ?? -Infinity),
      perf_asc: (a, b) => (a.changePct ?? Infinity) - (b.changePct ?? Infinity),
      name: (a, b) => a.h.symbol.localeCompare(b.h.symbol),
    };
    return out.sort(by[sort]);
  }, [filtered, quotes, history, range, sort]);

  const donut = rows
    .filter((r) => r.value !== null && r.value > 0)
    .map((r) => ({ value: r.value as number, label: r.h.symbol, color: assetColor(r.h.symbol) }));

  const hasAnyHolding = holdings.some((h) => h.quantity > 0);
  const closedOnly = !hasAnyHolding && holdings.length > 0;

  const chooseSort = () =>
    Alert.alert('Sort holdings', undefined, [
      ...(Object.keys(SORT_LABEL) as Sort[]).map((s) => ({ text: SORT_LABEL[s], onPress: () => setSort(s) })),
      { text: 'Cancel', style: 'cancel' as const },
    ]);

  const chartData = history && history.points.length > 1 ? { type: 'line' as const, points: history.points } : null;

  const pull = usePullRefresh(refreshQuotes);
  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={{ width: 72 }} />
        <Text style={styles.headerTitle}>Portfolio</Text>
        <Pressable
          style={styles.currencyBtn}
          onPress={() => setCurrencyPicker(true)}
          accessibilityRole="button"
          accessibilityLabel={`Display currency ${currency}`}
        >
          <Text style={styles.currencyBtnText}>{currency}</Text>
          <MaterialCommunityIcons name="swap-vertical" size={16} color={Colors.text} />
        </Pressable>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        scrollEnabled={!scrub}
        refreshControl={<RefreshControl refreshing={pull.refreshing} onRefresh={pull.onRefresh} tintColor={Colors.accent} />}
      >
        {hasAnyHolding ? (
          <>
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

            {/* Total */}
            <View style={styles.worthSection}>
              <View style={styles.worthRow}>
                <Text style={styles.worthValue} numberOfLines={1} adjustsFontSizeToFit>
                  {formatAmount(shownValue)}
                </Text>
                <Pressable onPress={() => setCurrencyPicker(true)} style={styles.worthCurrency} hitSlop={8}>
                  <Text style={styles.worthCurrencyText}>{currency}</Text>
                  <MaterialCommunityIcons name="swap-horizontal" size={16} color={Colors.textSecondary} />
                </Pressable>
              </View>
              {scrub ? (
                <>
                  <ChangeLine
                    abs={scrubChange}
                    pct={scrubChange !== null && history?.points[0].v ? (scrubChange / history.points[0].v) * 100 : null}
                  />
                  <Text style={styles.updated}>{formatShortDateTime(scrub.t)}</Text>
                </>
              ) : (
                <>
                  <ChangeLine abs={headAbs} pct={headPct} />
                  <Text style={styles.updated}>
                    {RANGE_LABEL[range]}
                    {range !== 'ALL' ? ' · net of deposits' : ' · unrealized'}
                    {summary.realizedPnl !== 0 && range === 'ALL'
                      ? ` · realized ${formatSignedNumber(summary.realizedPnl)}`
                      : ''}
                  </Text>
                </>
              )}
            </View>

            {/* Evolution chart */}
            <View style={styles.chartWrap}>
              {chartData ? (
                <PriceChart data={chartData} range={range} positive={positive} onScrub={setScrub} height={230} />
              ) : (
                <View style={styles.chartPlaceholder}>
                  <ActivityIndicator color={Colors.accent} />
                </View>
              )}
              {history?.loading && chartData ? (
                <ActivityIndicator style={styles.chartSpinner} size="small" color={Colors.accent} />
              ) : null}
            </View>

            <View style={styles.periodRow}>
              {PORTFOLIO_RANGES.map((p) => (
                <Pressable
                  key={p}
                  style={[styles.periodBtn, range === p && styles.periodBtnOn]}
                  onPress={() => setRange(p)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: range === p }}
                >
                  <Text style={[styles.periodText, range === p && styles.periodTextOn]}>{p}</Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.chartNote}>
              {quotesError
                ? `${quotesError}${quotesUpdatedAt ? ` · last update ${formatTime(quotesUpdatedAt)}` : ''}`
                : quotesUpdatedAt
                  ? `Prices updated ${formatTime(quotesUpdatedAt)}`
                  : 'Fetching live prices…'}
              {history?.truncated ? ' · history limited to the past year' : ''}
              {filter !== 'crypto' && holdings.some((h) => h.category === 'stock' && h.quantity > 0)
                ? ' · stocks shown at today’s price'
                : ''}
            </Text>

            {/* Holdings */}
            <View style={styles.toolbar}>
              <Text style={styles.sectionTitle}>Holdings</Text>
              <Pressable style={styles.sortBtn} onPress={chooseSort} accessibilityRole="button">
                <Text style={styles.sortText}>{SORT_LABEL[sort]}</Text>
                <MaterialCommunityIcons name="chevron-down" size={18} color={Colors.text} />
              </Pressable>
            </View>

            {rows.length > 0 ? (
              <View style={styles.holdingsList}>
                {rows.map(({ h, key, q, value, change, changePct }, idx) => {
                  const img =
                    h.category === 'crypto'
                      ? images.get(h.assetId) ?? quotes[quoteKey(h.category, h.assetId)]?.image ?? undefined
                      : stockProfiles[h.assetId.toUpperCase()]?.logo ?? undefined;
                  const ac = assetColor(h.symbol);
                  return (
                    <Pressable
                      key={key}
                      style={({ pressed }) => [
                        styles.holdingRow,
                        idx < rows.length - 1 && styles.holdingDivider,
                        pressed && { opacity: 0.7 },
                      ]}
                      onPress={() => router.push({ pathname: '/asset/[key]', params: { key } })}
                      accessibilityRole="button"
                    >
                      {img ? (
                        <Image
                          source={{ uri: img }}
                          resizeMode={h.category === 'stock' ? 'contain' : 'cover'}
                          style={[styles.logo, h.category === 'stock' && styles.logoPlate]}
                        />
                      ) : (
                        <View style={[styles.circle, { backgroundColor: ac + '26' }]}>
                          <Text style={[styles.circleText, { color: ac }]}>{h.symbol.slice(0, 3).toUpperCase()}</Text>
                        </View>
                      )}
                      <View style={styles.assetMeta}>
                        <Text style={styles.assetSymbol}>{h.symbol.toUpperCase()}</Text>
                        <Text style={styles.assetSub} numberOfLines={1}>
                          {formatQty(h.quantity)} | {q ? formatUsd(q.price) : 'no price'}
                        </Text>
                      </View>
                      <View style={styles.holdingRight}>
                        <Text style={styles.holdingVal}>{value !== null ? formatUsd(value) : '—'}</Text>
                        <ChangeLine abs={change} pct={changePct} size="sm" />
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            ) : (
              <Text style={styles.noFilter}>No {filter === 'stock' ? 'stock' : 'crypto'} holdings.</Text>
            )}

            {donut.length > 1 ? (
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { paddingHorizontal: 20, marginBottom: 12 }]}>Allocation</Text>
                <DonutChart data={donut} centerLabel={`${donut.length} assets`} />
              </View>
            ) : null}
          </>
        ) : null}

        {ready && !hasAnyHolding && (
          <View style={styles.empty}>
            <MaterialCommunityIcons name="briefcase-outline" size={56} color={Colors.textTertiary} />
            <Text style={styles.emptyTitle}>{closedOnly ? 'No open positions' : 'No holdings yet'}</Text>
            <Text style={styles.emptySub}>
              {closedOnly
                ? 'All your positions are closed. Add a transaction to open a new one.'
                : 'Record your first buy to start tracking your portfolio. Everything stays on your iPhone.'}
            </Text>
            <Pressable style={styles.emptyBtn} onPress={() => router.push('/add-transaction')} accessibilityRole="button">
              <Text style={styles.emptyBtnText}>Add Transaction</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>

      {hasAnyHolding && (
        <Pressable
          style={({ pressed }) => [styles.fab, pressed && { opacity: 0.85 }]}
          onPress={() => router.push('/add-transaction')}
          accessibilityRole="button"
          accessibilityLabel="Add transaction"
        >
          <MaterialCommunityIcons name="plus" size={30} color={Colors.background} />
        </Pressable>
      )}

      <PickerModal
        visible={currencyPicker}
        title="Display currency"
        searchPlaceholder="Search currency"
        items={CURRENCIES.filter((c) => rates[c.code]).map((c) => ({ key: c.code, label: c.code, sublabel: c.name }))}
        selectedKey={currency}
        emptyText="Exchange rates unavailable right now."
        onSelect={(i) => {
          setCurrency(i.key);
          setCurrencyPicker(false);
        }}
        onClose={() => setCurrencyPicker(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8 },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 22, fontWeight: '800', color: Colors.text },
  currencyBtn: {
    width: 72,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  currencyBtnText: { color: Colors.text, fontSize: 13, fontWeight: '800' },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 120 },

  filterRow: { flexDirection: 'row', paddingHorizontal: 16, marginTop: 8, marginBottom: 14, gap: 8 },
  filterPill: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
  },
  filterPillOn: { borderColor: Colors.text, backgroundColor: 'rgba(255,255,255,0.1)' },
  filterPillText: { fontSize: 14, fontWeight: '600', color: Colors.textSecondary },
  filterPillTextOn: { color: Colors.text },

  worthSection: { paddingHorizontal: 18 },
  worthRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  worthValue: { flexShrink: 1, fontSize: 34, fontWeight: '700', color: Colors.text, letterSpacing: -0.5 },
  worthCurrency: { flexDirection: 'row', alignItems: 'center', gap: 2, marginBottom: 5 },
  worthCurrencyText: { fontSize: 17, fontWeight: '600', color: Colors.textSecondary },
  changeLine: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  changeAbs: { fontSize: 16, fontWeight: '500' },
  changeAbsSm: { fontSize: 13, fontWeight: '500' },
  badge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5 },
  badgeText: { fontSize: 15, fontWeight: '700' },
  badgeTextSm: { fontSize: 13, fontWeight: '700' },
  updated: { marginTop: 6, fontSize: 12, color: Colors.textTertiary },
  muted: { color: Colors.textTertiary },

  chartWrap: { paddingLeft: 8, paddingRight: 4, marginTop: 14 },
  chartPlaceholder: { height: 230, alignItems: 'center', justifyContent: 'center' },
  chartSpinner: { position: 'absolute', top: 4, right: 80 },

  periodRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 12, paddingTop: 14 },
  periodBtn: { paddingHorizontal: 10, paddingVertical: 7, borderRadius: 16 },
  periodBtnOn: { backgroundColor: '#2A2A30' },
  periodText: { fontSize: 14, fontWeight: '700', color: Colors.textTertiary },
  periodTextOn: { color: Colors.text },
  chartNote: { color: Colors.textTertiary, fontSize: 11, paddingHorizontal: 18, marginTop: 10 },

  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    marginTop: 22,
    marginBottom: 12,
  },
  sectionTitle: { fontSize: 19, fontWeight: '800', color: Colors.text },
  sortBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  sortText: { fontSize: 14, fontWeight: '700', color: Colors.text },

  holdingsList: {
    marginHorizontal: 16,
    backgroundColor: Colors.card,
    borderRadius: 18,
    overflow: 'hidden',
  },
  holdingRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 14 },
  holdingDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.borderLight },
  logo: { width: 40, height: 40, borderRadius: 20, marginRight: 12 },
  logoPlate: { backgroundColor: '#FFFFFF', borderWidth: 5, borderColor: '#FFFFFF' },
  circle: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  circleText: { fontSize: 12, fontWeight: '800' },
  assetMeta: { flex: 1, marginRight: 10 },
  assetSymbol: { fontSize: 17, fontWeight: '700', color: Colors.text, marginBottom: 3 },
  assetSub: { fontSize: 13, color: Colors.textSecondary },
  holdingRight: { alignItems: 'flex-end' },
  holdingVal: { fontSize: 16, fontWeight: '700', color: Colors.text },

  section: { marginTop: 26 },
  noFilter: { color: Colors.textSecondary, textAlign: 'center', marginTop: 24 },

  empty: { alignItems: 'center', paddingVertical: 72, paddingHorizontal: 32 },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: Colors.text, marginTop: 20, marginBottom: 8 },
  emptySub: { fontSize: 15, color: Colors.textSecondary, textAlign: 'center', marginBottom: 24, lineHeight: 21 },
  emptyBtn: { backgroundColor: Colors.accent, paddingHorizontal: 28, paddingVertical: 12, borderRadius: 24 },
  emptyBtnText: { fontSize: 15, fontWeight: '700', color: Colors.background },

  fab: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: Colors.text,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 8,
  },
});
