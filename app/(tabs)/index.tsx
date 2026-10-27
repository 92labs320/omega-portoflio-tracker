import React, { useMemo } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CoinRow } from '@/components/CoinRow';
import { Colors } from '@/constants/Colors';
import { formatPct, formatTime } from '@/lib/format';
import { useMarkets } from '@/hooks/useMarkets';
import { useWatchlistStore } from '@/store/watchlistStore';
import { useCurrencyStore } from '@/store/currencyStore';

const WATCHLIST_IDS = [
  'bitcoin',
  'ethereum',
  'solana',
  'binancecoin',
  'ripple',
  'cardano',
  'dogecoin',
  'avalanche-2',
  'polkadot',
  'chainlink',
];

export default function HomeScreen() {
  const currencyCode = useCurrencyStore((st) => st.code);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { coins, loading, error, updatedAt, refresh } = useMarkets();

  const followed = useWatchlistStore((s) => s.ids);
  const usingFollowed = followed.length > 0 && coins.some((c) => followed.includes(c.id));
  const assets = useMemo(() => {
    const ids = usingFollowed ? followed : WATCHLIST_IDS;
    const order = new Map(ids.map((id, i) => [id, i]));
    return coins.filter((c) => order.has(c.id)).sort((a, b) => (order.get(a.id) ?? 99) - (order.get(b.id) ?? 99));
  }, [coins, followed, usingFollowed]);

  const withChange = assets.filter((a) => a.price_change_percentage_24h !== null);
  const topGainer = withChange.reduce<(typeof assets)[number] | null>(
    (best, a) => (!best || (a.price_change_percentage_24h ?? 0) > (best.price_change_percentage_24h ?? 0) ? a : best),
    null,
  );
  const topLoser = withChange.reduce<(typeof assets)[number] | null>(
    (worst, a) => (!worst || (a.price_change_percentage_24h ?? 0) < (worst.price_change_percentage_24h ?? 0) ? a : worst),
    null,
  );
  const hasData = assets.length > 0;

  const openAsset = (id: string) => router.push({ pathname: '/asset/[key]', params: { key: `crypto:${id}` } });

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={loading && hasData} onRefresh={refresh} tintColor={Colors.accent} />
        }
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.brand}>Omega</Text>
            <Text style={styles.subtitle}>Markets at a glance</Text>
          </View>
          <Text style={styles.labs}>92LABS</Text>
        </View>

        <View style={styles.statusRow}>
          <View style={[styles.statusDot, (error || !hasData) && styles.statusDotFallback]} />
          <Text style={styles.statusText}>
            {error
              ? hasData
                ? `Offline · last update ${formatTime(updatedAt)}`
                : 'Live prices unavailable'
              : hasData
                ? `Live · updated ${formatTime(updatedAt)} · CoinGecko`
                : 'Loading live prices…'}
          </Text>
          {loading && <ActivityIndicator size="small" color={Colors.accent} />}
        </View>

        {!hasData && !loading ? (
          <View style={styles.errorCard}>
            <MaterialCommunityIcons name="wifi-off" size={28} color={Colors.textTertiary} />
            <Text style={styles.errorTitle}>Can't reach market data</Text>
            <Text style={styles.errorText}>{error ?? 'Check your connection and try again.'}</Text>
            <Pressable style={styles.retryBtn} onPress={refresh} accessibilityRole="button">
              <Text style={styles.retryText}>Try again</Text>
            </Pressable>
          </View>
        ) : null}

        {hasData && (
          <>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.summaryRow}>
              <View style={styles.summaryCard}>
                <View style={styles.summaryIcon}>
                  <MaterialCommunityIcons name="chart-line" size={19} color={Colors.accent} />
                </View>
                <Text style={styles.summaryLabel}>Crypto Market</Text>
                <Text style={styles.summaryValue}>{coins.length} assets</Text>
                <Text style={styles.summaryMeta}>
                  {coins.filter((c) => (c.price_change_percentage_24h ?? 0) >= 0).length} up in 24h
                </Text>
              </View>

              {topGainer && (
                <View style={styles.summaryCard}>
                  <View style={styles.summaryIcon}>
                    <MaterialCommunityIcons name="trending-up" size={19} color={Colors.accent} />
                  </View>
                  <Text style={styles.summaryLabel}>Top gainer 24h</Text>
                  <Text style={styles.summaryValue}>{topGainer.symbol.toUpperCase()}</Text>
                  <Text style={[styles.summaryMeta, { color: Colors.accent }]}>
                    {formatPct(topGainer.price_change_percentage_24h)}
                  </Text>
                </View>
              )}

              {topLoser && (
                <View style={styles.summaryCard}>
                  <View style={[styles.summaryIcon, { backgroundColor: 'rgba(255,68,68,0.11)' }]}>
                    <MaterialCommunityIcons name="trending-down" size={19} color={Colors.red} />
                  </View>
                  <Text style={styles.summaryLabel}>
                    {(topLoser.price_change_percentage_24h ?? 0) < 0 ? 'Top loser 24h' : 'Weakest 24h'}
                  </Text>
                  <Text style={styles.summaryValue}>{topLoser.symbol.toUpperCase()}</Text>
                  <Text
                    style={[
                      styles.summaryMeta,
                      { color: (topLoser.price_change_percentage_24h ?? 0) < 0 ? Colors.red : Colors.accent },
                    ]}
                  >
                    {formatPct(topLoser.price_change_percentage_24h)}
                  </Text>
                </View>
              )}
            </ScrollView>

            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{usingFollowed ? 'Your watchlist' : 'Market Watch'}</Text>
              <Text style={styles.sectionCaption}>PRICE / 24H</Text>
            </View>

            <View style={styles.assetCard}>
              {assets.map((a, i) => (
                <CoinRow
                  key={a.id}
                  symbol={a.symbol}
                  name={a.name}
                  image={a.image}
                  price={a.current_price}
                  change24h={a.price_change_percentage_24h}
                  divider={i < assets.length - 1}
                  onPress={() => openAsset(a.id)}
                />
              ))}
            </View>
            <Text style={styles.hint}>
              {usingFollowed
                ? 'Tap an asset for charts and details.'
                : 'Tap an asset for charts. Use the star to build your watchlist.'}
            </Text>
          </>
        )}

        <Text style={styles.disclaimer}>
          Prices may be delayed. Omega is a tracking tool, not a broker, exchange or financial advisor.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 18,
  },
  brand: {
    color: Colors.accent,
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -0.8,
  },
  subtitle: {
    color: Colors.textSecondary,
    fontSize: 15,
    marginTop: 3,
  },
  labs: {
    color: Colors.textTertiary,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.5,
    marginTop: 8,
  },
  statusRow: {
    minHeight: 22,
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    marginBottom: 18,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: Colors.accent,
    marginRight: 8,
  },
  statusDotFallback: {
    backgroundColor: Colors.orange,
  },
  statusText: {
    flex: 1,
    color: Colors.textTertiary,
    fontSize: 12,
  },
  summaryRow: {
    paddingHorizontal: 20,
    paddingBottom: 28,
    gap: 10,
  },
  summaryCard: {
    width: 158,
    minHeight: 152,
    padding: 16,
    backgroundColor: Colors.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  summaryIcon: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    backgroundColor: 'rgba(0,217,100,0.11)',
    marginBottom: 16,
  },
  summaryLabel: {
    color: Colors.textSecondary,
    fontSize: 12,
    marginBottom: 6,
  },
  summaryValue: {
    color: Colors.text,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 5,
  },
  summaryMeta: {
    color: Colors.textTertiary,
    fontSize: 11,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  sectionTitle: {
    color: Colors.text,
    fontSize: 19,
    fontWeight: '700',
  },
  sectionCaption: {
    color: Colors.textTertiary,
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.8,
  },
  assetCard: {
    marginHorizontal: 20,
    backgroundColor: Colors.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    overflow: 'hidden',
  },
  assetRow: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
  },
  assetDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderLight,
  },
  assetIdentity: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  assetBadge: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
    marginRight: 12,
  },
  assetBadgeText: {
    color: Colors.accent,
    fontSize: 12,
    fontWeight: '800',
  },
  assetSymbol: {
    color: Colors.text,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 3,
  },
  assetName: {
    color: Colors.textTertiary,
    fontSize: 12,
  },
  assetValues: {
    alignItems: 'flex-end',
    marginLeft: 12,
  },
  assetPrice: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  assetChange: {
    fontSize: 12,
    fontWeight: '700',
  },
  errorCard: {
    alignItems: 'center',
    marginHorizontal: 20,
    marginTop: 12,
    padding: 24,
    backgroundColor: Colors.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  errorTitle: { color: Colors.text, fontSize: 17, fontWeight: '700', marginTop: 12 },
  errorText: { color: Colors.textSecondary, fontSize: 13, textAlign: 'center', marginTop: 6 },
  retryBtn: {
    marginTop: 16,
    paddingHorizontal: 22,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: Colors.accent,
  },
  retryText: { color: Colors.background, fontWeight: '700', fontSize: 14 },
  hint: {
    color: Colors.textTertiary,
    fontSize: 11,
    marginHorizontal: 24,
    marginTop: 10,
    textAlign: 'center',
  },
  dataNote: {
    color: Colors.orange,
    fontSize: 11,
    lineHeight: 16,
    marginHorizontal: 24,
    marginTop: 14,
    textAlign: 'center',
  },
  disclaimer: {
    color: Colors.textTertiary,
    fontSize: 11,
    lineHeight: 16,
    marginHorizontal: 28,
    marginTop: 18,
    textAlign: 'center',
  },
});
