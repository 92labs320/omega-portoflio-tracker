import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PriceChart, type ScrubPoint } from '@/components/PriceChart';
import { Colors } from '@/constants/Colors';
import { useMarkets } from '@/hooks/useMarkets';
import {
  TYPE_LABELS,
  formatCompactNumber,
  formatCompactUsd,
  formatDate,
  formatPct,
  formatQty,
  formatShortDateTime,
  toInputNumber,
  formatSignedNumber,
  formatSignedUsd,
  formatTime,
  formatUsd,
} from '@/lib/format';
import { quoteKey } from '@/lib/portfolio';
import type { Transaction } from '@/lib/types';
import {
  RANGES,
  fetchChart,
  fetchCoinDetail,
  type ChartData,
  type ChartType,
  type CoinDetail,
  type Range,
} from '@/services/coinService';
import { fetchStockQuotes } from '@/services/marketService';
import { usePortfolioStore } from '@/store/portfolioStore';
import { useWatchlistStore } from '@/store/watchlistStore';
import { useCurrencyStore } from '@/store/currencyStore';

type Tab = 'general' | 'transactions';

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

function DataRow({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <View style={styles.dataRow}>
      <Text style={styles.dataLabel}>{label}</Text>
      <View style={{ alignItems: 'flex-end', flexShrink: 1 }}>
        <Text style={styles.dataValue} numberOfLines={1}>
          {value}
        </Text>
        {sub ? <Text style={styles.dataSub}>{sub}</Text> : null}
      </View>
    </View>
  );
}

function ChangeBadge({ pct, abs }: { pct: number | null; abs?: number | null }) {
  if (pct === null || !Number.isFinite(pct)) return null;
  const up = pct >= 0;
  const color = up ? Colors.green : Colors.red;
  return (
    <View style={styles.changeRow}>
      {abs !== undefined && abs !== null && Number.isFinite(abs) ? (
        <Text style={[styles.changeAbs, { color }]}>{formatSignedNumber(abs)}</Text>
      ) : null}
      <View style={[styles.badge, { backgroundColor: up ? 'rgba(0,217,100,0.16)' : 'rgba(255,68,68,0.16)' }]}>
        <Text style={[styles.badgeText, { color }]}>{formatPct(pct)}</Text>
      </View>
    </View>
  );
}

export default function AssetDetailScreen() {
  const currencyCode = useCurrencyStore((st) => st.code);
  const { key, tab: initialTab } = useLocalSearchParams<{ key: string; tab?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const sep = (key ?? '').indexOf(':');
  const category = (key ?? '').slice(0, sep) === 'stock' ? 'stock' : 'crypto';
  const assetId = (key ?? '').slice(sep + 1);
  const isCrypto = category === 'crypto';

  const [tab, setTab] = useState<Tab>(initialTab === 'transactions' ? 'transactions' : 'general');

  // ----- portfolio data -----
  const transactions = usePortfolioStore((s) => s.transactions);
  const holdings = usePortfolioStore((s) => s.holdings);
  const quotes = usePortfolioStore((s) => s.quotes);
  const remove = usePortfolioStore((s) => s.remove);
  const holding = holdings.find((h) => h.category === category && h.assetId === assetId);
  const txs = useMemo(
    () => transactions.filter((t) => t.category === category && t.assetId === assetId),
    [transactions, category, assetId],
  );

  // ----- market data -----
  const { coins } = useMarkets();
  const feedCoin = isCrypto ? coins.find((c) => c.id === assetId) : undefined;
  const [detail, setDetail] = useState<CoinDetail | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [stockQuote, setStockQuote] = useState<{ price: number; change24h: number | null } | null>(null);

  const followed = useWatchlistStore((s) => s.ids.includes(assetId));
  const toggleFollow = useWatchlistStore((s) => s.toggle);

  useEffect(() => {
    let alive = true;
    if (isCrypto) {
      fetchCoinDetail(assetId)
        .then((d) => alive && (setDetail(d), setDetailError(null)))
        .catch((e) => alive && setDetailError(e instanceof Error ? e.message : 'Unavailable'));
    } else {
      fetchStockQuotes([assetId])
        .then((q) => alive && setStockQuote(q[assetId] ?? null))
        .catch(() => {});
    }
    return () => {
      alive = false;
    };
  }, [assetId, isCrypto]);

  // ----- chart -----
  const [range, setRange] = useState<Range>('1D');
  const [chartType, setChartType] = useState<ChartType>('line');
  const [chart, setChart] = useState<ChartData | null>(null);
  const [chartLoading, setChartLoading] = useState(false);
  const [chartError, setChartError] = useState<string | null>(null);
  const [scrub, setScrub] = useState<ScrubPoint | null>(null);

  const loadChart = useCallback(() => {
    if (!isCrypto) return;
    let alive = true;
    setChartLoading(true);
    setChartError(null);
    fetchChart(assetId, range, chartType)
      .then((d) => alive && setChart(d))
      .catch((e) => alive && setChartError(e instanceof Error ? e.message : 'Chart unavailable'))
      .finally(() => alive && setChartLoading(false));
    return () => {
      alive = false;
    };
  }, [assetId, range, chartType, isCrypto]);

  useEffect(() => loadChart(), [loadChart]);

  // ----- derived numbers -----
  const symbol = (feedCoin?.symbol ?? detail?.symbol ?? holding?.symbol ?? txs[0]?.symbol ?? assetId).toUpperCase();
  const name = feedCoin?.name ?? detail?.name ?? holding?.name ?? txs[0]?.name ?? '';
  const image = feedCoin?.image ?? detail?.image ?? undefined;
  const portfolioQuote = quotes[quoteKey(category, assetId)];

  const livePrice =
    (isCrypto ? feedCoin?.current_price ?? detail?.market.price : stockQuote?.price) ?? portfolioQuote?.price ?? null;
  const liveChange24h =
    (isCrypto ? feedCoin?.price_change_percentage_24h ?? detail?.market.change24h : stockQuote?.change24h) ??
    portfolioQuote?.change24h ??
    null;

  const firstValue = useMemo(() => {
    if (!chart) return null;
    if (chart.type === 'line') return chart.points[0]?.v ?? null;
    return chart.candles[0]?.o ?? null;
  }, [chart]);

  const shownPrice = scrub ? scrub.v : livePrice;
  let rangeAbs: number | null = null;
  let rangePct: number | null = null;
  if (!scrub && range === '1D' && liveChange24h !== null && livePrice !== null) {
    // Same 24h figure as Markets and Performance, so numbers never disagree across screens.
    rangePct = liveChange24h;
    rangeAbs = livePrice - livePrice / (1 + liveChange24h / 100);
  } else if (shownPrice !== null && firstValue) {
    rangeAbs = shownPrice - firstValue;
    rangePct = (rangeAbs / firstValue) * 100;
  } else if (!scrub && range === '1D' && liveChange24h !== null && livePrice !== null) {
    rangePct = liveChange24h;
    rangeAbs = livePrice - livePrice / (1 + liveChange24h / 100);
  }
  const positive = (rangePct ?? 0) >= 0;

  const value = holding && portfolioQuote ? holding.quantity * portfolioQuote.price : null;
  const unrealized = value !== null && holding ? value - holding.costBasis : null;
  const unrealizedPct =
    unrealized !== null && holding && holding.costBasis > 0 ? (unrealized / holding.costBasis) * 100 : null;

  const addTransaction = () =>
    router.push({
      pathname: '/add-transaction/form',
      params: { category, type: 'buy', assetId, symbol, name },
    });

  const confirmDelete = (tx: Transaction) =>
    Alert.alert(
      'Delete transaction?',
      `${TYPE_LABELS[tx.type]} ${formatQty(tx.quantity)} ${tx.symbol} on ${formatDate(tx.executedAt)}`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => remove(tx.id).catch((e) => Alert.alert('Error', String(e))) },
      ],
    );

  const [aboutOpen, setAboutOpen] = useState(false);
  const m = detail?.market;

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityRole="button" accessibilityLabel="Back">
          <MaterialCommunityIcons name="arrow-left" size={26} color={Colors.text} />
        </Pressable>
        <View style={styles.headerCenter}>
          <View style={styles.headerTitleRow}>
            {image ? <Image source={{ uri: image }} style={styles.headerLogo} /> : null}
            <Text style={styles.headerSymbol}>{symbol}</Text>
          </View>
          {name ? (
            <Text style={styles.headerName} numberOfLines={1}>
              {name}
            </Text>
          ) : null}
        </View>
        {isCrypto ? (
          <Pressable
            onPress={() => toggleFollow(assetId)}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={followed ? 'Unfollow' : 'Follow'}
          >
            <MaterialCommunityIcons
              name={followed ? 'star' : 'star-outline'}
              size={26}
              color={followed ? Colors.orange : Colors.text}
            />
          </Pressable>
        ) : (
          <View style={{ width: 26 }} />
        )}
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        {(['general', 'transactions'] as Tab[]).map((t) => (
          <Pressable key={t} style={styles.tab} onPress={() => setTab(t)} accessibilityRole="tab">
            <Text style={[styles.tabText, tab === t && styles.tabTextOn]}>
              {t === 'general' ? 'General' : `Transactions${txs.length ? ` (${txs.length})` : ''}`}
            </Text>
            {tab === t ? <View style={styles.tabUnderline} /> : null}
          </Pressable>
        ))}
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 110 + insets.bottom }} showsVerticalScrollIndicator={false}>
        {tab === 'general' ? (
          <>
            {/* Price block */}
            <View style={styles.priceBlock}>
              <Text style={styles.price} adjustsFontSizeToFit numberOfLines={1}>
                {shownPrice !== null ? formatUsd(shownPrice) : '—'}
              </Text>
              <ChangeBadge pct={rangePct} abs={rangeAbs} />
              <Text style={styles.asOf}>
                {scrub
                  ? new Date(scrub.t).toLocaleString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: range === '1D' || range === '1W' ? undefined : 'numeric',
                      hour: range === '1D' || range === '1W' ? 'numeric' : undefined,
                      minute: range === '1D' || range === '1W' ? '2-digit' : undefined,
                    })
                  : isCrypto
                    ? `Live as of ${formatTime(m?.lastUpdated ?? feedCoin?.last_updated ?? null)} · CoinGecko`
                    : 'Delayed quote · Finnhub'}
              </Text>
              {scrub?.candle ? (
                <Text style={styles.ohlc}>
                  O {formatUsd(scrub.candle.o)}  H {formatUsd(scrub.candle.h)}  L {formatUsd(scrub.candle.l)}  C{' '}
                  {formatUsd(scrub.candle.c)}
                </Text>
              ) : null}
            </View>

            {isCrypto ? (
              <>
                {/* Ranges */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.ranges}>
                  {RANGES.map((r) => (
                    <Pressable
                      key={r}
                      onPress={() => setRange(r)}
                      style={[styles.rangeChip, range === r && styles.rangeChipOn]}
                      accessibilityRole="button"
                      accessibilityState={{ selected: range === r }}
                    >
                      <Text style={[styles.rangeText, range === r && styles.rangeTextOn]}>{r}</Text>
                    </Pressable>
                  ))}
                </ScrollView>

                {/* Chart */}
                <View style={styles.chartWrap}>
                  {chart && ((chart.type === 'line' && chart.points.length > 1) || (chart.type === 'candle' && chart.candles.length > 1)) ? (
                    <PriceChart data={chart} range={range} positive={positive} onScrub={setScrub} />
                  ) : chartError ? (
                    <View style={styles.chartState}>
                      <Text style={styles.chartStateText}>{chartError}</Text>
                      <Pressable onPress={loadChart} style={styles.retry}>
                        <Text style={styles.retryText}>Try again</Text>
                      </Pressable>
                    </View>
                  ) : (
                    <View style={styles.chartState}>
                      <ActivityIndicator color={Colors.accent} />
                    </View>
                  )}
                  {chartLoading && chart ? (
                    <ActivityIndicator style={styles.chartSpinner} size="small" color={Colors.accent} />
                  ) : null}
                </View>

                {/* Chart type */}
                <View style={styles.chartTypes}>
                  {(['line', 'candle'] as ChartType[]).map((t) => (
                    <Pressable
                      key={t}
                      onPress={() => setChartType(t)}
                      style={styles.chartTypeBtn}
                      accessibilityRole="button"
                      accessibilityLabel={t === 'line' ? 'Line chart' : 'Candlestick chart'}
                    >
                      <MaterialCommunityIcons
                        name={t === 'line' ? 'chart-areaspline' : 'finance'}
                        size={24}
                        color={chartType === t ? Colors.text : Colors.textTertiary}
                      />
                      {chartType === t ? <View style={styles.chartTypeUnderline} /> : null}
                    </Pressable>
                  ))}
                  <Text style={styles.chartHint}>Touch and drag the chart to see past prices</Text>
                </View>

                {/* Your position (if any) */}
                {holding && holding.quantity > 0 ? (
                  <Pressable style={styles.card} onPress={() => setTab('transactions')}>
                    <View style={styles.cardHeader}>
                      <Text style={styles.cardTitle}>Your position</Text>
                      <MaterialCommunityIcons name="chevron-right" size={20} color={Colors.textTertiary} />
                    </View>
                    <View style={styles.statsGrid}>
                      <Stat label="Holdings" value={`${formatQty(holding.quantity)} ${symbol}`} />
                      <Stat label="Value" value={value !== null ? formatUsd(value) : '—'} />
                      <Stat label="Avg. cost" value={formatUsd(holding.avgCost)} />
                      <Stat
                        label="Unrealized P&L"
                        value={unrealized !== null ? `${formatSignedUsd(unrealized)} (${formatPct(unrealizedPct)})` : '—'}
                        color={unrealized === null ? undefined : unrealized >= 0 ? Colors.green : Colors.red}
                      />
                    </View>
                  </Pressable>
                ) : null}

                {/* Performance */}
                {m ? (
                  <View style={styles.card}>
                    <Text style={styles.cardTitle}>Performance</Text>
                    <View style={styles.perfRow}>
                      {[
                        ['24H', m.change24h],
                        ['7D', m.change7d],
                        ['30D', m.change30d],
                        ['1Y', m.change1y],
                      ].map(([label, v]) => (
                        <View key={label as string} style={styles.perfCell}>
                          <Text style={styles.perfLabel}>{label as string}</Text>
                          <Text
                            style={[
                              styles.perfValue,
                              { color: v === null ? Colors.textTertiary : (v as number) >= 0 ? Colors.green : Colors.red },
                            ]}
                          >
                            {formatPct(v as number | null)}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </View>
                ) : null}

                {/* Market data */}
                <View style={styles.card}>
                  <View style={styles.cardHeader}>
                    <Text style={styles.cardTitle}>Market Data</Text>
                    {detail?.rank ? <Text style={styles.rank}>#{detail.rank}</Text> : null}
                  </View>
                  {m ? (
                    <>
                      <DataRow label="Market cap" value={formatCompactUsd(m.marketCap)} />
                      <DataRow label="Volume (24h)" value={formatCompactUsd(m.volume24h)} />
                      <DataRow
                        label="24h range"
                        value={m.low24h !== null && m.high24h !== null ? `${formatUsd(m.low24h)} – ${formatUsd(m.high24h)}` : '—'}
                      />
                      <DataRow label="Fully diluted valuation" value={formatCompactUsd(m.fdv)} />
                      <DataRow label="Circulating supply" value={`${formatCompactNumber(m.circulatingSupply)} ${symbol}`} />
                      <DataRow
                        label="Max supply"
                        value={m.maxSupply ? `${formatCompactNumber(m.maxSupply)} ${symbol}` : '∞'}
                      />
                      <DataRow
                        label="All-time high"
                        value={m.ath !== null ? formatUsd(m.ath) : '—'}
                        sub={m.athDate ? `${formatDate(m.athDate)} · ${formatPct(m.athChangePct)}` : undefined}
                      />
                      <DataRow
                        label="All-time low"
                        value={m.atl !== null ? formatUsd(m.atl) : '—'}
                        sub={m.atlDate ? formatDate(m.atlDate) : undefined}
                      />
                    </>
                  ) : detailError ? (
                    <Text style={styles.muted}>{detailError}</Text>
                  ) : (
                    <ActivityIndicator style={{ marginVertical: 16 }} color={Colors.accent} />
                  )}
                </View>

                {/* About */}
                {detail?.description ? (
                  <View style={styles.card}>
                    <Text style={styles.cardTitle}>About {name}</Text>
                    <Text style={styles.about} numberOfLines={aboutOpen ? undefined : 5}>
                      {detail.description}
                    </Text>
                    <Pressable onPress={() => setAboutOpen((v) => !v)} hitSlop={8}>
                      <Text style={styles.link}>{aboutOpen ? 'Show less' : 'Read more'}</Text>
                    </Pressable>
                    {detail.categories.length ? (
                      <View style={styles.tags}>
                        {detail.categories.map((c) => (
                          <View key={c} style={styles.tag}>
                            <Text style={styles.tagText}>{c}</Text>
                          </View>
                        ))}
                      </View>
                    ) : null}
                    {detail.homepage ? (
                      <Pressable
                        style={styles.website}
                        onPress={() => Linking.openURL(detail.homepage as string).catch(() => {})}
                        accessibilityRole="link"
                      >
                        <MaterialCommunityIcons name="web" size={18} color={Colors.accent} />
                        <Text style={styles.link}>{detail.homepage.replace(/^https?:\/\//, '').replace(/\/$/, '')}</Text>
                      </Pressable>
                    ) : null}
                  </View>
                ) : null}
              </>
            ) : (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Quote</Text>
                <DataRow label="Last price" value={livePrice !== null ? formatUsd(livePrice) : '—'} />
                <DataRow label="Change (day)" value={formatPct(liveChange24h)} />
                <Text style={[styles.muted, { marginTop: 10 }]}>
                  Interactive charts are available for crypto assets. Stock prices are provided by Finnhub and may be
                  delayed.
                </Text>
              </View>
            )}

            <Text style={styles.disclaimer}>
              Market data is for information only and is not investment advice.
            </Text>
          </>
        ) : (
          /* Transactions tab */
          <>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Your position</Text>
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

            {txs.length === 0 ? (
              <View style={styles.empty}>
                <MaterialCommunityIcons name="swap-vertical" size={40} color={Colors.textTertiary} />
                <Text style={styles.emptyTitle}>No transactions yet</Text>
                <Text style={styles.muted}>Record a buy to start tracking {symbol} in your portfolio.</Text>
              </View>
            ) : (
              <View style={[styles.card, { paddingHorizontal: 0, paddingVertical: 0, overflow: 'hidden' }]}>
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
                        {formatShortDateTime(Date.parse(tx.executedAt))} ·{' '}
                        {tx.priceQuote !== null && tx.quoteCurrency !== 'USD'
                          ? `${toInputNumber(tx.priceQuote)} ${tx.quoteCurrency}`
                          : formatUsd(tx.priceUsd)}
                        {tx.exchange ? ` · ${tx.exchange}` : ''}
                        {tx.pair ? ` · ${tx.pair}` : ''}
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
            <Text style={styles.disclaimer}>Cost basis uses the average-cost method. Tap a transaction to edit it.</Text>
          </>
        )}
      </ScrollView>

      {/* Sticky action */}
      <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <Pressable
          style={({ pressed }) => [styles.addBtn, pressed && { opacity: 0.85 }]}
          onPress={addTransaction}
          accessibilityRole="button"
        >
          <MaterialCommunityIcons name="plus" size={20} color={Colors.background} />
          <Text style={styles.addBtnText}>Add transaction</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10 },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerLogo: { width: 26, height: 26, borderRadius: 13 },
  headerSymbol: { color: Colors.text, fontSize: 20, fontWeight: '800' },
  headerName: { color: Colors.textSecondary, fontSize: 13, marginTop: 2 },

  tabs: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderLight,
  },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 12 },
  tabText: { color: Colors.textTertiary, fontSize: 15, fontWeight: '600' },
  tabTextOn: { color: Colors.text },
  tabUnderline: { position: 'absolute', bottom: -1, height: 3, left: 24, right: 24, borderRadius: 2, backgroundColor: Colors.text },

  priceBlock: { paddingHorizontal: 20, paddingTop: 18 },
  price: { color: Colors.text, fontSize: 38, fontWeight: '800', letterSpacing: -0.5 },
  changeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  changeAbs: { fontSize: 15, fontWeight: '600' },
  badge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
  badgeText: { fontSize: 14, fontWeight: '700' },
  asOf: { color: Colors.textTertiary, fontSize: 12, marginTop: 6 },
  ohlc: { color: Colors.textSecondary, fontSize: 11, marginTop: 4 },

  ranges: { paddingHorizontal: 12, paddingTop: 16, paddingBottom: 6, gap: 4 },
  rangeChip: { paddingHorizontal: 13, paddingVertical: 7, borderRadius: 16 },
  rangeChipOn: { backgroundColor: Colors.text },
  rangeText: { color: Colors.textSecondary, fontSize: 14, fontWeight: '700' },
  rangeTextOn: { color: Colors.background },

  chartWrap: { paddingLeft: 12, paddingRight: 8, marginTop: 8, minHeight: 260 },
  chartState: { height: 260, alignItems: 'center', justifyContent: 'center' },
  chartStateText: { color: Colors.textSecondary, fontSize: 13, textAlign: 'center', paddingHorizontal: 24 },
  chartSpinner: { position: 'absolute', top: 6, right: 80 },
  retry: { marginTop: 12, paddingHorizontal: 18, paddingVertical: 8, borderRadius: 16, backgroundColor: Colors.card },
  retryText: { color: Colors.accent, fontWeight: '700' },

  chartTypes: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 6, gap: 6 },
  chartTypeBtn: { paddingHorizontal: 8, paddingVertical: 6, alignItems: 'center' },
  chartTypeUnderline: { height: 2, width: 26, backgroundColor: Colors.text, borderRadius: 1, marginTop: 4 },
  chartHint: { flex: 1, textAlign: 'right', color: Colors.textTertiary, fontSize: 11 },

  card: {
    marginHorizontal: 16,
    marginTop: 16,
    padding: 16,
    backgroundColor: Colors.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { color: Colors.text, fontSize: 19, fontWeight: '800', marginBottom: 8 },
  rank: { color: Colors.text, fontSize: 19, fontWeight: '800', marginBottom: 8 },

  statsGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  stat: { width: '50%', paddingVertical: 8, paddingRight: 8 },
  statLabel: { color: Colors.textTertiary, fontSize: 12, marginBottom: 4 },
  statValue: { color: Colors.text, fontSize: 15, fontWeight: '700' },

  perfRow: { flexDirection: 'row' },
  perfCell: { flex: 1, alignItems: 'center', paddingVertical: 6 },
  perfLabel: { color: Colors.textTertiary, fontSize: 12, marginBottom: 4 },
  perfValue: { fontSize: 14, fontWeight: '700' },

  dataRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 11,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderLight,
    gap: 12,
  },
  dataLabel: { color: Colors.textSecondary, fontSize: 14 },
  dataValue: { color: Colors.text, fontSize: 14, fontWeight: '700' },
  dataSub: { color: Colors.textTertiary, fontSize: 11, marginTop: 2 },

  about: { color: Colors.textSecondary, fontSize: 14, lineHeight: 21 },
  link: { color: Colors.accent, fontSize: 14, fontWeight: '600', marginTop: 8 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12 },
  tag: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.06)' },
  tagText: { color: Colors.textSecondary, fontSize: 12 },
  website: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },

  muted: { color: Colors.textSecondary, fontSize: 13, lineHeight: 19, textAlign: 'center' },
  disclaimer: { color: Colors.textTertiary, fontSize: 11, textAlign: 'center', marginTop: 18, paddingHorizontal: 24 },

  empty: { alignItems: 'center', paddingVertical: 40, paddingHorizontal: 32, gap: 8 },
  emptyTitle: { color: Colors.text, fontSize: 17, fontWeight: '700' },

  txRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 13 },
  divider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.borderLight },
  txType: { color: Colors.text, fontSize: 15, fontWeight: '600', marginBottom: 3 },
  txMeta: { color: Colors.textTertiary, fontSize: 12 },
  txTotal: { color: Colors.text, fontSize: 14, fontWeight: '600', marginLeft: 8 },
  trash: { marginLeft: 12, padding: 2 },

  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingTop: 10,
    backgroundColor: 'rgba(0,0,0,0.92)',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.borderLight,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 50,
    borderRadius: 25,
    backgroundColor: Colors.accent,
  },
  addBtnText: { color: Colors.background, fontSize: 16, fontWeight: '800' },
});
