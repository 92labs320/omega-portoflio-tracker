import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AssetBadge, CoinRow } from '@/components/CoinRow';
import { Colors } from '@/constants/Colors';
import { useMarkets } from '@/hooks/useMarkets';
import { usePullRefresh } from '@/hooks/usePullRefresh';
import { useStocks } from '@/hooks/useStocks';
import { formatAmount, formatPct, formatSignedNumber, formatTime, formatUsd } from '@/lib/format';
import { quoteKey, summarize } from '@/lib/portfolio';
import { fetchNews, fetchTrendingCoins, timeAgo, type NewsItem, type TrendingCoin } from '@/services/discoverService';
import { fetchStockProfiles, POPULAR_STOCKS, type StockProfile } from '@/services/marketService';
import { useCurrencyStore } from '@/store/currencyStore';
import { usePortfolioStore } from '@/store/portfolioStore';
import { usePrefsStore } from '@/store/prefsStore';
import { useWatchlistStore } from '@/store/watchlistStore';

const BAR_MAX = 150;

function greeting(d = new Date()) {
  const h = d.getHours();
  return h < 5 ? 'Good night' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

function SectionHeader({
  kicker,
  title,
  right,
}: {
  kicker: string;
  title: string;
  right?: React.ReactNode;
}) {
  return (
    <View style={styles.sectionHeader}>
      <View style={{ flex: 1 }}>
        <Text style={styles.kicker}>{kicker}</Text>
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      {right}
    </View>
  );
}

function Toggle<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { id: T; icon?: React.ComponentProps<typeof MaterialCommunityIcons>['name']; label?: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <View style={styles.toggle}>
      {options.map((o) => (
        <Pressable
          key={o.id}
          onPress={() => onChange(o.id)}
          style={[styles.toggleBtn, value === o.id && styles.toggleBtnOn]}
          accessibilityRole="button"
          accessibilityState={{ selected: value === o.id }}
          accessibilityLabel={o.label ?? o.id}
          hitSlop={4}
        >
          {o.icon ? (
            <MaterialCommunityIcons
              name={o.icon}
              size={18}
              color={value === o.id ? (o.id === 'down' ? Colors.red : Colors.green) : Colors.textTertiary}
            />
          ) : (
            <Text style={[styles.toggleText, value === o.id && styles.toggleTextOn]}>{o.label}</Text>
          )}
        </Pressable>
      ))}
    </View>
  );
}

const pctColor = (v: number | null | undefined) => ((v ?? 0) >= 0 ? Colors.green : Colors.red);

export default function HomeScreen() {
  useCurrencyStore((st) => st.code); // re-render on display-currency change
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const scrollRef = useRef<ScrollView>(null);

  const { coins, error: marketError, updatedAt, refresh: refreshMarkets } = useMarkets();
  const holdings = usePortfolioStore((s) => s.holdings);
  const quotes = usePortfolioStore((s) => s.quotes);
  const refreshQuotes = usePortfolioStore((s) => s.refreshQuotes);
  const followed = useWatchlistStore((s) => s.ids);
  const toggleFollow = useWatchlistStore((s) => s.toggle);

  const [focused, setFocused] = useState(false);
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      refreshQuotes().catch(() => {});
      return () => setFocused(false);
    }, [refreshQuotes]),
  );

  // ---------- privacy toggle ----------
  const hidden = usePrefsStore((s) => s.hideBalances);
  const setPref = usePrefsStore((s) => s.set);
  const toggleHidden = () => setPref('hideBalances', !hidden);
  const mask = (s: string) => (hidden ? '••••••' : s);

  // ---------- portfolio ----------
  const open = holdings.filter((h) => h.quantity > 0);
  const summary = useMemo(() => summarize(holdings, quotes), [holdings, quotes]);
  const dayChange = useMemo(() => {
    let abs = 0;
    let base = 0;
    for (const h of open) {
      const q = quotes[quoteKey(h.category, h.assetId)];
      if (!q || q.stale || q.change24h == null) continue;
      const value = h.quantity * q.price;
      const prev = value / (1 + q.change24h / 100);
      abs += value - prev;
      base += prev;
    }
    return { abs, pct: base > 0 ? (abs / base) * 100 : null };
  }, [open, quotes]);

  // Logos: crypto from the market feed / quotes, stocks from Finnhub profiles.
  const coinImages = useMemo(() => new Map(coins.map((c) => [c.id, c.image])), [coins]);
  const heldStocks = open.filter((h) => h.category === 'stock').map((h) => h.assetId.toUpperCase());
  const stockKey = Array.from(new Set([...heldStocks, ...POPULAR_STOCKS])).sort().join(',');
  const [profiles, setProfiles] = useState<Record<string, StockProfile>>({});
  useEffect(() => {
    fetchStockProfiles(stockKey.split(','))
      .then(setProfiles)
      .catch(() => {});
  }, [stockKey]);
  const logoFor = (category: string, assetId: string) =>
    category === 'crypto'
      ? coinImages.get(assetId) ?? quotes[quoteKey('crypto', assetId)]?.image ?? undefined
      : profiles[assetId.toUpperCase()]?.logo ?? undefined;

  // ---------- daily movers (your holdings) ----------
  const [moverDir, setMoverDir] = useState<'up' | 'down'>('up');
  const movers = useMemo(() => {
    const rows = open
      .map((h) => {
        const q = quotes[quoteKey(h.category, h.assetId)];
        return q && !q.stale && q.change24h != null ? { h, pct: q.change24h } : null;
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);
    const sorted = rows
      .filter((r) => (moverDir === 'up' ? r.pct > 0 : r.pct < 0))
      .sort((a, b) => (moverDir === 'up' ? b.pct - a.pct : a.pct - b.pct))
      .slice(0, 5);
    return { sorted, any: rows.length > 0 };
  }, [open, quotes, moverDir]);
  const maxAbs = Math.max(...movers.sorted.map((m) => Math.abs(m.pct)), 0.01);

  // ---------- market highlights ----------
  const highlights = useMemo(
    () =>
      coins
        .filter((c) => c.price_change_percentage_24h != null && c.current_price != null)
        .sort((a, b) => Math.abs(b.price_change_percentage_24h ?? 0) - Math.abs(a.price_change_percentage_24h ?? 0))
        .slice(0, 8),
    [coins],
  );

  // ---------- trending ----------
  const [trending, setTrending] = useState<TrendingCoin[]>([]);
  const loadTrending = useCallback(() => fetchTrendingCoins().then(setTrending).catch(() => {}), []);
  useEffect(() => {
    loadTrending();
  }, [loadTrending]);

  const { quotes: stockQuotes, refresh: refreshStocks } = useStocks(POPULAR_STOCKS, focused);
  const stockMovers = useMemo(
    () =>
      POPULAR_STOCKS.filter((s) => stockQuotes[s]?.change24h != null)
        .sort((a, b) => Math.abs(stockQuotes[b].change24h ?? 0) - Math.abs(stockQuotes[a].change24h ?? 0))
        .slice(0, 8),
    [stockQuotes],
  );

  // ---------- watchlist ----------
  const watch = useMemo(() => {
    const order = new Map(followed.map((id, i) => [id, i]));
    return coins.filter((c) => order.has(c.id)).sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
  }, [coins, followed]);

  // ---------- news ----------
  const [newsTab, setNewsTab] = useState<'crypto' | 'general'>('crypto');
  const [news, setNews] = useState<NewsItem[]>([]);
  const [newsLoading, setNewsLoading] = useState(false);
  const [newsMore, setNewsMore] = useState(false);
  const loadNews = useCallback(() => {
    setNewsLoading(true);
    return fetchNews(newsTab)
      .then(setNews)
      .catch(() => setNews([]))
      .finally(() => setNewsLoading(false));
  }, [newsTab]);
  useEffect(() => {
    setNewsMore(false);
    loadNews();
  }, [loadNews]);

  const pull = usePullRefresh(
    useCallback(
      () => Promise.all([refreshMarkets(), refreshQuotes(), refreshStocks(), loadTrending(), loadNews()]),
      [refreshMarkets, refreshQuotes, refreshStocks, loadTrending, loadNews],
    ),
  );

  const openAsset = (key: string, name?: string) =>
    router.push({ pathname: '/asset/[key]', params: name ? { key, name } : { key } });

  const now = new Date();

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.topBar}>
        <View style={{ width: 40 }} />
        <Text style={styles.topTitle}>Home</Text>
        <Pressable
          onPress={() => router.navigate('/(tabs)/markets')}
          hitSlop={10}
          style={{ width: 40, alignItems: 'flex-end' }}
          accessibilityRole="button"
          accessibilityLabel="Search markets"
        >
          <MaterialCommunityIcons name="magnify" size={26} color={Colors.text} />
        </Pressable>
      </View>

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={{ paddingBottom: 48 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={pull.refreshing} onRefresh={pull.onRefresh} tintColor={Colors.accent} />}
      >
        {/* Greeting */}
        <View style={styles.greeting}>
          <Text style={styles.greetTitle}>{greeting(now)}!</Text>
          <View style={styles.statusRow}>
            <View style={[styles.dot, marketError && { backgroundColor: Colors.orange }]} />
            <Text style={styles.greetSub}>
              {now.toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long' })}
              {updatedAt ? ` · ${marketError ? 'last update' : 'live'} ${formatTime(updatedAt)}` : ''}
            </Text>
          </View>
        </View>

        {/* Portfolio */}
        <SectionHeader
          kicker="GROWING WEALTH"
          title="Your Portfolio"
          right={
            open.length ? (
              <Pressable onPress={toggleHidden} hitSlop={10} accessibilityLabel={hidden ? 'Show amounts' : 'Hide amounts'}>
                <MaterialCommunityIcons name={hidden ? 'eye-off-outline' : 'eye-outline'} size={24} color={Colors.textSecondary} />
              </Pressable>
            ) : null
          }
        />
        {open.length ? (
          <Pressable
            style={({ pressed }) => [styles.card, styles.portfolioCard, pressed && { opacity: 0.85 }]}
            onPress={() => router.navigate('/(tabs)/portfolio')}
            accessibilityRole="button"
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.cardLabel}>Total worth</Text>
              <Text style={styles.worth} numberOfLines={1} adjustsFontSizeToFit>
                {mask(formatUsd(summary.totalValue))}
              </Text>
              <Text style={styles.cardMeta}>
                {open.length} assets · P&L{' '}
                <Text style={{ color: pctColor(summary.unrealizedPnl) }}>
                  {hidden ? '••••' : formatPct(summary.unrealizedPnlPct)}
                </Text>
              </Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.cardLabel}>1D</Text>
              <Text style={[styles.dayAbs, { color: pctColor(dayChange.abs) }]}>{mask(formatSignedNumber(dayChange.abs))}</Text>
              <View style={[styles.badge, { backgroundColor: dayChange.abs >= 0 ? 'rgba(0,217,100,0.16)' : 'rgba(255,68,68,0.18)' }]}>
                <Text style={[styles.badgeText, { color: pctColor(dayChange.abs) }]}>{formatPct(dayChange.pct)}</Text>
              </View>
            </View>
          </Pressable>
        ) : (
          <View style={[styles.card, styles.emptyCard]}>
            <MaterialCommunityIcons name="briefcase-plus-outline" size={34} color={Colors.accent} />
            <Text style={styles.emptyTitle}>Start tracking your portfolio</Text>
            <Text style={styles.emptyText}>Add a buy, or import your history from a CSV file.</Text>
            <View style={styles.emptyActions}>
              <Pressable style={styles.primaryBtn} onPress={() => router.push('/add-transaction')}>
                <Text style={styles.primaryBtnText}>Add transaction</Text>
              </Pressable>
              <Pressable style={styles.secondaryBtn} onPress={() => router.push('/import')}>
                <Text style={styles.secondaryBtnText}>Import CSV</Text>
              </Pressable>
            </View>
          </View>
        )}

        {/* Daily movers */}
        {movers.any ? (
          <>
            <SectionHeader
              kicker="STAY ON TOP"
              title="Your Daily Movers"
              right={
                <Toggle
                  value={moverDir}
                  onChange={setMoverDir}
                  options={[
                    { id: 'up', icon: 'arrow-top-right', label: 'Gainers' },
                    { id: 'down', icon: 'arrow-bottom-left', label: 'Losers' },
                  ]}
                />
              }
            />
            <View style={[styles.card, styles.moversCard]}>
              {movers.sorted.length ? (
                <View style={styles.bars}>
                  {movers.sorted.map(({ h, pct }) => {
                    const up = pct >= 0;
                    const height = 14 + (Math.abs(pct) / maxAbs) * BAR_MAX;
                    const key = quoteKey(h.category, h.assetId);
                    return (
                      <Pressable key={key} style={styles.barCol} onPress={() => openAsset(key)} accessibilityRole="button">
                        <Text style={[styles.barPct, { color: up ? Colors.green : Colors.red }]} numberOfLines={1}>
                          {formatPct(pct)}
                        </Text>
                        <LinearGradient
                          colors={up ? ['#2FD27A', 'rgba(47,210,122,0.05)'] : ['#FF5A5A', 'rgba(255,90,90,0.05)']}
                          style={[styles.bar, { height }]}
                        />
                        <AssetBadge
                          symbol={h.symbol}
                          image={logoFor(h.category, h.assetId)}
                          size={36}
                          gap={0}
                          plate={h.category === 'stock'}
                        />
                        <Text style={styles.barSymbol} numberOfLines={1}>
                          {h.symbol.toUpperCase()}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              ) : (
                <Text style={styles.muted}>
                  {moverDir === 'up' ? 'None of your assets is up in the last 24h.' : 'None of your assets is down in the last 24h. 🎉'}
                </Text>
              )}
            </View>
          </>
        ) : null}

        {/* Watchlist */}
        <SectionHeader
          kicker="KEEP AN EYE ON"
          title="Your Watchlist"
          right={
            watch.length ? (
              <Pressable style={styles.pill} onPress={() => router.navigate('/(tabs)/markets')}>
                <Text style={styles.pillText}>See all</Text>
              </Pressable>
            ) : null
          }
        />
        {watch.length ? (
          <View style={[styles.card, { paddingVertical: 2 }]}>
            {watch.slice(0, 6).map((c, i, arr) => (
              <CoinRow
                key={c.id}
                symbol={c.symbol}
                name={c.name}
                image={c.image}
                price={c.current_price}
                change24h={c.price_change_percentage_24h}
                divider={i < arr.length - 1}
                onPress={() => openAsset(`crypto:${c.id}`)}
              />
            ))}
          </View>
        ) : (
          <View style={[styles.card, styles.hintCard]}>
            <MaterialCommunityIcons name="star-outline" size={24} color={Colors.textSecondary} />
            <Text style={styles.hintText}>
              Tap the star on any asset to follow it here. Try one of the trending coins below.
            </Text>
          </View>
        )}

        {/* Market highlights */}
        {highlights.length ? (
          <>
            <SectionHeader kicker="LOOKING BACK" title="Price Highlights" />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hList}>
              {highlights.map((c) => {
                const pct = c.price_change_percentage_24h ?? 0;
                const price = c.current_price ?? 0;
                const abs = price - price / (1 + pct / 100);
                const up = pct >= 0;
                return (
                  <Pressable key={c.id} style={[styles.card, styles.hlCard]} onPress={() => openAsset(`crypto:${c.id}`)}>
                    <View style={styles.cardRow}>
                      <AssetBadge symbol={c.symbol} image={c.image} size={40} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.cardSymbol}>{c.symbol.toUpperCase()}</Text>
                        <Text style={styles.cardName} numberOfLines={1}>
                          {c.name}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.hlCaption}>In the last 24 hours</Text>
                    <View style={[styles.hlBand, { backgroundColor: up ? 'rgba(0,217,100,0.16)' : 'rgba(255,68,68,0.18)' }]}>
                      <Text style={[styles.hlPct, { color: up ? Colors.green : Colors.red }]}>
                        {up ? '▲' : '▼'} {formatPct(pct)}
                      </Text>
                    </View>
                    <Text style={styles.hlPrice} numberOfLines={1}>
                      {formatUsd(price)}{' '}
                      <Text style={{ color: up ? Colors.green : Colors.red }}>{formatSignedNumber(abs)}</Text>
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </>
        ) : null}

        {/* Trending crypto */}
        {trending.length ? (
          <>
            <SectionHeader kicker="DISCOVER WHAT'S HOT" title="Trending Crypto" />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hList}>
              {trending.map((t) => {
                const on = followed.includes(t.id);
                return (
                  <Pressable key={t.id} style={[styles.card, styles.trendCard]} onPress={() => openAsset(`crypto:${t.id}`)}>
                    <View style={styles.trendTop}>
                      <AssetBadge symbol={t.symbol} image={t.image ?? undefined} size={40} gap={0} />
                      <Pressable onPress={() => toggleFollow(t.id)} hitSlop={10} accessibilityLabel={on ? 'Unfollow' : 'Follow'}>
                        <MaterialCommunityIcons name={on ? 'star' : 'star-outline'} size={22} color={on ? Colors.orange : Colors.text} />
                      </Pressable>
                    </View>
                    <Text style={styles.cardSymbol}>{t.symbol.toUpperCase()}</Text>
                    <Text style={styles.cardName} numberOfLines={1}>
                      {t.name}
                    </Text>
                    <Text style={[styles.trendPct, { color: pctColor(t.change24h) }]}>{formatPct(t.change24h)}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </>
        ) : null}

        {/* Stocks moving */}
        {stockMovers.length ? (
          <>
            <SectionHeader kicker="DISCOVER WHAT'S HOT" title="Stocks on the Move" />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hList}>
              {stockMovers.map((s) => {
                const q = stockQuotes[s];
                return (
                  <Pressable
                    key={s}
                    style={[styles.card, styles.trendCard]}
                    onPress={() => openAsset(`stock:${s}`, profiles[s]?.name)}
                  >
                    <View style={styles.trendTop}>
                      <AssetBadge symbol={s} image={profiles[s]?.logo ?? undefined} size={40} gap={0} plate />
                    </View>
                    <Text style={styles.cardSymbol}>{s}</Text>
                    <Text style={styles.cardName} numberOfLines={1}>
                      {profiles[s]?.name ?? ' '}
                    </Text>
                    <Text style={[styles.trendPct, { color: pctColor(q.change24h) }]}>{formatPct(q.change24h)}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </>
        ) : null}

        {/* News */}
        <SectionHeader
          kicker="CURATED FOR YOU"
          title="News"
          right={
            <Toggle
              value={newsTab}
              onChange={setNewsTab}
              options={[
                { id: 'crypto', label: 'Crypto' },
                { id: 'general', label: 'Markets' },
              ]}
            />
          }
        />
        <View style={[styles.card, { paddingVertical: 4 }]}>
          {newsLoading && !news.length ? (
            <ActivityIndicator style={{ marginVertical: 24 }} color={Colors.accent} />
          ) : news.length ? (
            <>
              {news.slice(0, newsMore ? 15 : 5).map((n, i, arr) => (
                <Pressable
                  key={n.id}
                  style={({ pressed }) => [styles.newsRow, i < arr.length - 1 && styles.divider, pressed && { opacity: 0.6 }]}
                  onPress={() => Linking.openURL(n.url).catch(() => {})}
                  accessibilityRole="link"
                >
                  {n.image ? (
                    <Image source={{ uri: n.image }} style={styles.newsImg} />
                  ) : (
                    <View style={[styles.newsImg, styles.newsImgEmpty]}>
                      <MaterialCommunityIcons name="newspaper-variant-outline" size={26} color={Colors.textTertiary} />
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={styles.newsTitle} numberOfLines={3}>
                      {n.headline}
                    </Text>
                    <Text style={styles.newsMeta} numberOfLines={1}>
                      <Text style={{ color: Colors.textSecondary }}>{n.source}</Text> {timeAgo(n.time)}
                    </Text>
                  </View>
                </Pressable>
              ))}
              {news.length > 5 ? (
                <Pressable style={styles.moreBtn} onPress={() => setNewsMore((m) => !m)}>
                  <Text style={styles.pillText}>{newsMore ? 'Show less' : 'Show more'}</Text>
                </Pressable>
              ) : null}
            </>
          ) : (
            <Text style={[styles.muted, { margin: 18 }]}>News unavailable right now. Pull down to retry.</Text>
          )}
        </View>
        <Text style={styles.credit}>News by Finnhub · Trending by CoinGecko</Text>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerTitle}>You’re all caught up!</Text>
          <Pressable
            style={styles.topBtn}
            onPress={() => scrollRef.current?.scrollTo({ y: 0, animated: true })}
            accessibilityRole="button"
            accessibilityLabel="Back to top"
          >
            <MaterialCommunityIcons name="arrow-up" size={26} color={Colors.text} />
          </Pressable>
          <Text style={styles.muted}>Back to top</Text>
          <Text style={styles.disclaimer}>
            Prices may be delayed. Omega is a tracking tool, not a broker, exchange or financial advisor.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const CARD_W = 168;

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  topBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingVertical: 8 },
  topTitle: { flex: 1, textAlign: 'center', color: Colors.text, fontSize: 22, fontWeight: '800' },

  greeting: { paddingHorizontal: 20, paddingTop: 10 },
  greetTitle: { color: Colors.text, fontSize: 20, fontWeight: '800' },
  statusRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: Colors.green, marginRight: 7 },
  greetSub: { color: Colors.textSecondary, fontSize: 14 },

  sectionHeader: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 20, marginTop: 30, marginBottom: 12 },
  kicker: { color: Colors.textTertiary, fontSize: 12, fontWeight: '700', letterSpacing: 0.6 },
  sectionTitle: { color: Colors.text, fontSize: 24, fontWeight: '800', marginTop: 2 },

  card: { marginHorizontal: 16, backgroundColor: '#17171C', borderRadius: 18, overflow: 'hidden' },
  cardRow: { flexDirection: 'row', alignItems: 'center' },
  cardLabel: { color: Colors.textTertiary, fontSize: 13, fontWeight: '600' },
  cardMeta: { color: Colors.textSecondary, fontSize: 13, marginTop: 6 },
  cardSymbol: { color: Colors.text, fontSize: 18, fontWeight: '800' },
  cardName: { color: Colors.textSecondary, fontSize: 13, marginTop: 1 },
  muted: { color: Colors.textTertiary, fontSize: 13, textAlign: 'center' },
  divider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(255,255,255,0.1)' },

  portfolioCard: { flexDirection: 'row', alignItems: 'center', padding: 18 },
  worth: { color: Colors.text, fontSize: 28, fontWeight: '800', marginTop: 4, letterSpacing: -0.4 },
  dayAbs: { fontSize: 16, fontWeight: '600', marginTop: 4 },
  badge: { marginTop: 4, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5 },
  badgeText: { fontSize: 14, fontWeight: '800' },

  emptyCard: { alignItems: 'center', padding: 22 },
  emptyTitle: { color: Colors.text, fontSize: 17, fontWeight: '800', marginTop: 10 },
  emptyText: { color: Colors.textSecondary, fontSize: 14, textAlign: 'center', marginTop: 6 },
  emptyActions: { flexDirection: 'row', gap: 10, marginTop: 16 },
  primaryBtn: { backgroundColor: Colors.accent, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 20 },
  primaryBtnText: { color: Colors.background, fontWeight: '800', fontSize: 14 },
  secondaryBtn: { borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)', paddingHorizontal: 18, paddingVertical: 10, borderRadius: 20 },
  secondaryBtnText: { color: Colors.text, fontWeight: '700', fontSize: 14 },

  toggle: { flexDirection: 'row', backgroundColor: '#1F1F25', borderRadius: 22, padding: 3 },
  toggleBtn: { minWidth: 40, height: 34, paddingHorizontal: 10, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  toggleBtnOn: { backgroundColor: '#000', borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' },
  toggleText: { color: Colors.textTertiary, fontSize: 13, fontWeight: '700' },
  toggleTextOn: { color: Colors.text },

  moversCard: { paddingHorizontal: 10, paddingTop: 20, paddingBottom: 18, minHeight: 120, justifyContent: 'center' },
  bars: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-around' },
  barCol: { flex: 1, alignItems: 'center', maxWidth: 76 },
  barPct: { fontSize: 12, fontWeight: '800', marginBottom: 6 },
  bar: { width: 34, borderTopLeftRadius: 7, borderTopRightRadius: 7, marginBottom: 10 },
  barSymbol: { color: Colors.text, fontSize: 13, fontWeight: '800', marginTop: 6 },

  pill: { backgroundColor: '#24242A', paddingHorizontal: 14, paddingVertical: 7, borderRadius: 16 },
  pillText: { color: Colors.text, fontSize: 14, fontWeight: '700' },
  hintCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 },
  hintText: { flex: 1, color: Colors.textSecondary, fontSize: 14, lineHeight: 19 },

  hList: { paddingHorizontal: 16, gap: 10 },
  hlCard: { marginHorizontal: 0, width: 250, padding: 16 },
  hlCaption: { color: Colors.textSecondary, fontSize: 14, marginTop: 14 },
  hlBand: { alignItems: 'center', borderRadius: 7, paddingVertical: 6, marginTop: 8 },
  hlPct: { fontSize: 17, fontWeight: '800' },
  hlPrice: { color: Colors.text, fontSize: 15, fontWeight: '700', marginTop: 10 },

  trendCard: { marginHorizontal: 0, width: CARD_W, padding: 16 },
  trendTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12, minHeight: 40 },
  trendPct: { fontSize: 17, fontWeight: '800', marginTop: 12 },

  newsRow: { flexDirection: 'row', gap: 14, paddingHorizontal: 14, paddingVertical: 14 },
  newsImg: { width: 74, height: 74, borderRadius: 10, backgroundColor: '#24242A' },
  newsImgEmpty: { alignItems: 'center', justifyContent: 'center' },
  newsTitle: { color: Colors.text, fontSize: 15, fontWeight: '700', lineHeight: 20 },
  newsMeta: { color: Colors.textTertiary, fontSize: 12, marginTop: 6 },
  moreBtn: { alignSelf: 'center', backgroundColor: '#24242A', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 16, marginVertical: 12 },
  credit: { color: Colors.textTertiary, fontSize: 11, textAlign: 'center', marginTop: 8 },

  footer: { alignItems: 'center', paddingHorizontal: 28, marginTop: 36, gap: 8 },
  footerTitle: { color: Colors.text, fontSize: 17, fontWeight: '800' },
  topBtn: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#24242A', alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  disclaimer: { color: Colors.textTertiary, fontSize: 11, lineHeight: 16, textAlign: 'center', marginTop: 14 },
});
