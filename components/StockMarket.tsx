import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { AssetBadge, CoinRow } from '@/components/CoinRow';
import { Colors } from '@/constants/Colors';
import { useStocks } from '@/hooks/useStocks';
import { POPULAR_STOCKS, searchStocks, type StockHit } from '@/services/marketService';
import { useCurrencyStore } from '@/store/currencyStore';
import { usePullRefresh } from '@/hooks/usePullRefresh';

type Filter = 'all' | 'gainers' | 'losers';
const FILTERS: { id: Filter; label: string; icon?: React.ComponentProps<typeof MaterialCommunityIcons>['name'] }[] = [
  { id: 'all', label: 'Popular' },
  { id: 'gainers', label: 'Top gainers', icon: 'trending-up' },
  { id: 'losers', label: 'Top losers', icon: 'trending-down' },
];

interface Props {
  query: string;
  active: boolean;
  onStatus: (s: { updatedAt: number | null; error: string | null }) => void;
}

/** Markets → Stocks: popular US tickers with live quotes, plus search across all US stocks & ETFs. */
export function StockMarket({ query, active, onStatus }: Props) {
  const router = useRouter();
  const currencyCode = useCurrencyStore((s) => s.code);
  const [filter, setFilter] = useState<Filter>('all');
  const [hits, setHits] = useState<StockHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const seq = useRef(0);

  const q = query.trim();

  // Tickers we want live quotes for: the popular list + the first search results.
  const extraSymbols = useMemo(
    () => hits.filter((h) => !POPULAR_STOCKS.includes(h.symbol)).slice(0, 10).map((h) => h.symbol),
    [hits],
  );
  const symbols = useMemo(() => [...POPULAR_STOCKS, ...extraSymbols], [extraSymbols]);
  const { quotes, profiles, loading, error, updatedAt, refresh } = useStocks(symbols, active);

  useEffect(() => {
    onStatus({ updatedAt, error });
  }, [updatedAt, error, onStatus]);

  useEffect(() => {
    if (q.length < 1) {
      setHits([]);
      setSearching(false);
      setSearchError(null);
      return;
    }
    const id = ++seq.current;
    setSearching(true);
    const t = setTimeout(() => {
      searchStocks(q)
        .then((r) => {
          if (id !== seq.current) return;
          setHits(r);
          setSearchError(null);
        })
        .catch((e) => {
          if (id !== seq.current) return;
          setHits([]);
          setSearchError(e instanceof Error ? e.message : 'Search unavailable');
        })
        .finally(() => id === seq.current && setSearching(false));
    }, 350);
    return () => clearTimeout(t);
  }, [q]);

  const popular = useMemo(() => {
    const upper = q.toUpperCase();
    let out = POPULAR_STOCKS.map((s) => ({ symbol: s, name: profiles[s]?.name ?? s }));
    if (upper) out = out.filter((x) => x.symbol.includes(upper) || x.name.toUpperCase().includes(upper));
    if (filter !== 'all') {
      out = out
        .filter((x) => quotes[x.symbol]?.change24h != null)
        .sort((a, b) => {
          const da = quotes[a.symbol].change24h as number;
          const db = quotes[b.symbol].change24h as number;
          return filter === 'gainers' ? db - da : da - db;
        });
    }
    return out;
  }, [q, filter, profiles, quotes]);

  const inPopular = new Set(popular.map((p) => p.symbol));
  const others = hits.filter((h) => !inPopular.has(h.symbol));

  const open = (symbol: string, name?: string) =>
    router.push({ pathname: '/asset/[key]', params: { key: `stock:${symbol}`, name: name ?? '' } });

  const header = (
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
            <MaterialCommunityIcons name={f.icon} size={14} color={filter === f.id ? Colors.background : Colors.textSecondary} />
          ) : null}
          <Text style={[styles.filterText, filter === f.id && styles.filterTextOn]}>{f.label}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );

  const searchSection =
    q.length >= 1 ? (
      <View style={styles.moreSection}>
        <View style={styles.moreHeader}>
          <Text style={styles.moreTitle}>All US stocks & ETFs</Text>
          {searching ? <ActivityIndicator size="small" color={Colors.accent} /> : null}
        </View>
        {searchError ? (
          <Text style={styles.moreEmpty}>{searchError}</Text>
        ) : others.length === 0 && !searching ? (
          <Text style={styles.moreEmpty}>
            {popular.length ? 'No other matches.' : `No stock found for "${q}". Try the ticker (e.g. AAPL).`}
          </Text>
        ) : (
          others.map((h) => {
            const quote = quotes[h.symbol];
            return quote ? (
              <CoinRow
                key={h.symbol}
                symbol={h.symbol}
                name={profiles[h.symbol]?.name ?? h.name}
                image={profiles[h.symbol]?.logo ?? undefined}
                plate
                price={quote.price}
                change24h={quote.change24h}
                divider
                onPress={() => open(h.symbol, h.name)}
              />
            ) : (
              <Pressable
                key={h.symbol}
                onPress={() => open(h.symbol, h.name)}
                style={({ pressed }) => [styles.moreRow, pressed && { opacity: 0.6 }]}
                accessibilityRole="button"
              >
                <AssetBadge symbol={h.symbol} image={profiles[h.symbol]?.logo ?? undefined} size={32} plate />
                <View style={{ flex: 1 }}>
                  <Text style={styles.moreSymbol}>
                    {h.symbol}
                    {h.type && h.type !== 'Common Stock' ? <Text style={styles.typeTag}>  {h.type}</Text> : null}
                  </Text>
                  <Text style={styles.moreName} numberOfLines={1}>
                    {h.name}
                  </Text>
                </View>
                <MaterialCommunityIcons name="chevron-right" size={20} color={Colors.textTertiary} />
              </Pressable>
            );
          })
        )}
      </View>
    ) : null;

  const pull = usePullRefresh(refresh);
  return (
    <FlatList
      data={popular}
      extraData={`${currencyCode}|${Object.keys(quotes).length}|${Object.keys(profiles).length}`}
      keyExtractor={(item) => item.symbol}
      renderItem={({ item, index }) => (
        <CoinRow
          rank={index + 1}
          symbol={item.symbol}
          name={item.name}
          image={profiles[item.symbol]?.logo ?? undefined}
          plate
          price={quotes[item.symbol]?.price ?? null}
          change24h={quotes[item.symbol]?.change24h ?? null}
          divider
          onPress={() => open(item.symbol, item.name)}
        />
      )}
      ListHeaderComponent={header}
      ListFooterComponent={
        <>
          {searchSection}
          <Text style={styles.footer}>
            US stocks & ETFs · prices by Finnhub, may be delayed. Search by ticker or company name.
          </Text>
        </>
      }
      keyboardDismissMode="on-drag"
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={styles.list}
      refreshControl={<RefreshControl refreshing={pull.refreshing} onRefresh={pull.onRefresh} tintColor={Colors.accent} />}
    />
  );
}

const styles = StyleSheet.create({
  list: { paddingBottom: 32 },
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
  moreSymbol: { color: Colors.text, fontSize: 15, fontWeight: '700' },
  typeTag: { color: Colors.textTertiary, fontSize: 11, fontWeight: '700' },
  moreName: { color: Colors.textTertiary, fontSize: 12, marginTop: 2 },
  footer: { color: Colors.textTertiary, fontSize: 11, textAlign: 'center', marginTop: 18, paddingHorizontal: 24 },
});
