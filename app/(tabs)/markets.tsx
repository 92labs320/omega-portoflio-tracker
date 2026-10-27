import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CoinRow } from '@/components/CoinRow';
import { Colors, Typography } from '@/constants/Colors';
import { formatCompactUsd, formatNumber, formatTime } from '@/lib/format';
import { useMarkets } from '@/hooks/useMarkets';
import { searchCoins, type CoinMarket, type CoinSearchResult } from '@/services/marketService';
import { useWatchlistStore } from '@/store/watchlistStore';
import { useCurrencyStore } from '@/store/currencyStore';

type Filter = 'all' | 'following' | 'gainers' | 'losers';
const FILTERS: { id: Filter; label: string; icon?: React.ComponentProps<typeof MaterialCommunityIcons>['name'] }[] = [
  { id: 'all', label: 'All' },
  { id: 'following', label: 'Following', icon: 'star' },
  { id: 'gainers', label: 'Top gainers', icon: 'trending-up' },
  { id: 'losers', label: 'Top losers', icon: 'trending-down' },
];

export default function MarketsScreen() {
  const currencyCode = useCurrencyStore((st) => st.code);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { coins, loading, error, updatedAt, refresh } = useMarkets();
  const followed = useWatchlistStore((s) => s.ids);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [more, setMore] = useState<CoinSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const seq = useRef(0);

  // Search every coin listed on CoinGecko (not just the top 250) once 2+ characters are typed.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setMore([]);
      setSearching(false);
      return;
    }
    const id = ++seq.current;
    setSearching(true);
    const t = setTimeout(() => {
      searchCoins(q)
        .then((r) => id === seq.current && setMore(r))
        .catch(() => id === seq.current && setMore([]))
        .finally(() => id === seq.current && setSearching(false));
    }, 350);
    return () => clearTimeout(t);
  }, [query]);

  const totals = useMemo(() => {
    const cap = coins.reduce((s, c) => s + (c.market_cap || 0), 0);
    const vol = coins.reduce((s, c) => s + (c.total_volume || 0), 0);
    const btc = coins.find((c) => c.id === 'bitcoin');
    return { cap, vol, btcDom: btc && cap > 0 ? (btc.market_cap / cap) * 100 : null };
  }, [coins]);

  const list = useMemo(() => {
    let out = coins.map((c, i) => ({ coin: c, rank: i + 1 }));
    const q = query.trim().toUpperCase();
    if (q) out = out.filter(({ coin }) => coin.symbol.toUpperCase().includes(q) || coin.name.toUpperCase().includes(q));
    if (filter === 'following') out = out.filter(({ coin }) => followed.includes(coin.id));
    if (filter === 'gainers' || filter === 'losers') {
      out = out
        .filter(({ coin }) => coin.price_change_percentage_24h !== null)
        .sort((a, b) =>
          filter === 'gainers'
            ? (b.coin.price_change_percentage_24h ?? 0) - (a.coin.price_change_percentage_24h ?? 0)
            : (a.coin.price_change_percentage_24h ?? 0) - (b.coin.price_change_percentage_24h ?? 0),
        )
        .slice(0, 50);
    }
    return out;
  }, [coins, query, filter, followed]);

  const open = (c: { id: string }) => router.push({ pathname: '/asset/[key]', params: { key: `crypto:${c.id}` } });

  const inList = useMemo(() => new Set(list.map((x) => x.coin.id)), [list]);
  const extra = filter === 'all' ? more.filter((c) => !inList.has(c.id)) : [];

  const moreSection =
    query.trim().length >= 2 && filter === 'all' ? (
      <View style={styles.moreSection}>
        <View style={styles.moreHeader}>
          <Text style={styles.moreTitle}>All coins</Text>
          {searching ? <ActivityIndicator size="small" color={Colors.accent} /> : null}
        </View>
        {extra.length === 0 && !searching ? (
          <Text style={styles.moreEmpty}>
            {list.length ? 'No other matches outside the top 250.' : `No coin found for "${query.trim()}".`}
          </Text>
        ) : (
          extra.map((c) => (
            <Pressable
              key={c.id}
              onPress={() => open(c)}
              style={({ pressed }) => [styles.moreRow, pressed && { opacity: 0.6 }]}
              accessibilityRole="button"
            >
              {c.thumb ? <Image source={{ uri: c.thumb }} style={styles.moreThumb} /> : <View style={styles.moreThumb} />}
              <View style={{ flex: 1 }}>
                <Text style={styles.moreSymbol}>{c.symbol.toUpperCase()}</Text>
                <Text style={styles.moreName} numberOfLines={1}>
                  {c.name}
                </Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={20} color={Colors.textTertiary} />
            </Pressable>
          ))
        )}
      </View>
    ) : null;

  const renderItem = ({ item }: { item: { coin: CoinMarket; rank: number } }) => (
    <CoinRow
      rank={item.rank}
      symbol={item.coin.symbol}
      name={item.coin.name}
      image={item.coin.image}
      price={item.coin.current_price}
      change24h={item.coin.price_change_percentage_24h}
      divider
      onPress={() => open(item.coin)}
    />
  );

  const header = (
    <>
      {coins.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Market cap · top 250</Text>
            <Text style={styles.statValue}>{formatCompactUsd(totals.cap)}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Volume 24h</Text>
            <Text style={styles.statValue}>{formatCompactUsd(totals.vol)}</Text>
          </View>
          {totals.btcDom !== null && (
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>BTC dominance</Text>
              <Text style={styles.statValue}>{formatNumber(totals.btcDom, 1, 1)}%</Text>
            </View>
          )}
        </ScrollView>
      )}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
        {FILTERS.map((f) => (
          <Pressable
            key={f.id}
            onPress={() => setFilter(f.id)}
            style={[styles.filterChip, filter === f.id && styles.filterChipOn]}
            accessibilityRole="button"
            accessibilityState={{ selected: filter === f.id }}
          >
            {f.icon ? (
              <MaterialCommunityIcons
                name={f.icon}
                size={14}
                color={filter === f.id ? Colors.background : f.id === 'following' ? Colors.orange : Colors.textSecondary}
              />
            ) : null}
            <Text style={[styles.filterText, filter === f.id && styles.filterTextOn]}>
              {f.label}
              {f.id === 'following' && followed.length ? ` (${followed.length})` : ''}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Markets</Text>
        <Text style={styles.subtitle}>
          {error
            ? coins.length
              ? `Offline · last update ${formatTime(updatedAt)}`
              : 'Live prices unavailable'
            : `Top 250 crypto · ${updatedAt ? `updated ${formatTime(updatedAt)}` : 'loading…'} · CoinGecko`}
        </Text>
      </View>

      <View style={styles.searchContainer}>
        <MaterialCommunityIcons name="magnify" size={20} color={Colors.textSecondary} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search any coin"
          placeholderTextColor={Colors.textTertiary}
          value={query}
          onChangeText={setQuery}
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="search"
          clearButtonMode="while-editing"
        />
      </View>

      {loading && coins.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.accent} />
        </View>
      ) : coins.length === 0 ? (
        <View style={styles.center}>
          <MaterialCommunityIcons name="wifi-off" size={32} color={Colors.textTertiary} />
          <Text style={styles.emptyTitle}>Can't reach market data</Text>
          <Text style={styles.emptyText}>{error ?? 'Check your connection.'}</Text>
          <Pressable style={styles.retryBtn} onPress={refresh} accessibilityRole="button">
            <Text style={styles.retryText}>Try again</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={list}
          extraData={currencyCode}
          renderItem={renderItem}
          keyExtractor={(item) => item.coin.id}
          ListHeaderComponent={header}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.list}
          initialNumToRender={15}
          windowSize={10}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={Colors.accent} />}
          ListEmptyComponent={
            filter === 'all' && query.trim().length >= 2 ? null : (
            <View style={styles.emptyList}>
              {filter === 'following' && !query ? (
                <>
                  <MaterialCommunityIcons name="star-outline" size={30} color={Colors.textTertiary} />
                  <Text style={styles.noMatch}>
                    No followed assets yet. Open a coin and tap the star to follow it.
                  </Text>
                </>
              ) : (
                <Text style={styles.noMatch}>No coin matches "{query}".</Text>
              )}
            </View>
            )
          }
          ListFooterComponent={
            <>
              {moreSection}
              {list.length || extra.length ? (
                <Text style={styles.footer}>
                  Market data provided by CoinGecko. Search finds any listed coin. Tap a coin for charts and details.
                </Text>
              ) : null}
            </>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 12 },
  title: { ...Typography.largeTitle, color: Colors.text },
  subtitle: { ...Typography.footnote, color: Colors.textTertiary, marginTop: 4 },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 4,
    paddingHorizontal: 12,
    height: 44,
    backgroundColor: Colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, color: Colors.text, fontSize: 16 },
  statsRow: { paddingHorizontal: 16, paddingTop: 12, gap: 10 },
  statCard: {
    minWidth: 130,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: Colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  statLabel: { color: Colors.textTertiary, fontSize: 11, marginBottom: 4 },
  statValue: { color: Colors.text, fontSize: 17, fontWeight: '800' },
  filters: { paddingHorizontal: 16, paddingVertical: 12, gap: 8 },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 18,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  filterChipOn: { backgroundColor: Colors.text, borderColor: Colors.text },
  filterText: { color: Colors.textSecondary, fontSize: 13, fontWeight: '700' },
  filterTextOn: { color: Colors.background },
  list: { paddingBottom: 32 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  emptyTitle: { color: Colors.text, fontSize: 17, fontWeight: '700', marginTop: 12 },
  emptyText: { color: Colors.textSecondary, fontSize: 13, textAlign: 'center', marginTop: 6 },
  retryBtn: { marginTop: 16, paddingHorizontal: 22, paddingVertical: 10, borderRadius: 20, backgroundColor: Colors.accent },
  retryText: { color: Colors.background, fontWeight: '700', fontSize: 14 },
  emptyList: { alignItems: 'center', marginTop: 32, paddingHorizontal: 32, gap: 10 },
  noMatch: { color: Colors.textSecondary, textAlign: 'center' },
  moreSection: { marginTop: 18, paddingHorizontal: 16 },
  moreHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  moreTitle: { color: Colors.text, fontSize: 17, fontWeight: '800' },
  moreEmpty: { color: Colors.textTertiary, fontSize: 13, paddingVertical: 8 },
  moreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderLight,
  },
  moreThumb: { width: 30, height: 30, borderRadius: 15, marginRight: 12, backgroundColor: 'rgba(255,255,255,0.06)' },
  moreSymbol: { color: Colors.text, fontSize: 15, fontWeight: '700' },
  moreName: { color: Colors.textTertiary, fontSize: 12, marginTop: 2 },
  footer: { color: Colors.textTertiary, fontSize: 11, textAlign: 'center', marginTop: 18, paddingHorizontal: 24 },
});
