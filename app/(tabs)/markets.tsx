import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
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
import { formatCompactUsd, formatTime } from '@/lib/format';
import { useMarkets } from '@/hooks/useMarkets';
import type { CoinMarket } from '@/services/marketService';
import { useWatchlistStore } from '@/store/watchlistStore';

type Filter = 'all' | 'following' | 'gainers' | 'losers';
const FILTERS: { id: Filter; label: string; icon?: React.ComponentProps<typeof MaterialCommunityIcons>['name'] }[] = [
  { id: 'all', label: 'All' },
  { id: 'following', label: 'Following', icon: 'star' },
  { id: 'gainers', label: 'Top gainers', icon: 'trending-up' },
  { id: 'losers', label: 'Top losers', icon: 'trending-down' },
];

export default function MarketsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { coins, loading, error, updatedAt, refresh } = useMarkets();
  const followed = useWatchlistStore((s) => s.ids);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');

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

  const open = (c: CoinMarket) => router.push({ pathname: '/asset/[key]', params: { key: `crypto:${c.id}` } });

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
              <Text style={styles.statValue}>{totals.btcDom.toFixed(1)}%</Text>
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
          placeholder="Search coins"
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
            <View style={styles.emptyList}>
              {filter === 'following' && !query ? (
                <>
                  <MaterialCommunityIcons name="star-outline" size={30} color={Colors.textTertiary} />
                  <Text style={styles.noMatch}>
                    No followed assets yet. Open a coin and tap the star to follow it.
                  </Text>
                </>
              ) : (
                <Text style={styles.noMatch}>No coin matches "{query}" in the top 250.</Text>
              )}
            </View>
          }
          ListFooterComponent={
            list.length ? (
              <Text style={styles.footer}>Market data provided by CoinGecko. Tap a coin for charts and details.</Text>
            ) : null
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
  footer: { color: Colors.textTertiary, fontSize: 11, textAlign: 'center', marginTop: 18, paddingHorizontal: 24 },
});
