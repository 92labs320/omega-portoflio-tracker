import React, { useMemo } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors } from '@/constants/Colors';
import { useMarkets } from '@/hooks/useMarkets';
import type { CoinMarket } from '@/services/marketService';

const WATCHLIST = [
  { id: 'bitcoin', symbol: 'BTC', name: 'Bitcoin', price: 68240.12, change: 2.41 },
  { id: 'ethereum', symbol: 'ETH', name: 'Ethereum', price: 3548.76, change: 1.83 },
  { id: 'solana', symbol: 'SOL', name: 'Solana', price: 148.32, change: 4.26 },
  { id: 'binancecoin', symbol: 'BNB', name: 'BNB', price: 596.44, change: -0.72 },
  { id: 'ripple', symbol: 'XRP', name: 'XRP', price: 0.5264, change: 0.94 },
  { id: 'cardano', symbol: 'ADA', name: 'Cardano', price: 0.4321, change: -1.18 },
  { id: 'dogecoin', symbol: 'DOGE', name: 'Dogecoin', price: 0.1428, change: 2.07 },
  { id: 'avalanche-2', symbol: 'AVAX', name: 'Avalanche', price: 35.82, change: -0.46 },
  { id: 'polkadot', symbol: 'DOT', name: 'Polkadot', price: 6.54, change: 1.12 },
  { id: 'chainlink', symbol: 'LINK', name: 'Chainlink', price: 14.76, change: 3.38 },
] as const;

type DisplayAsset = {
  id: string;
  symbol: string;
  name: string;
  price: number;
  change: number;
  isLive: boolean;
};

function formatPrice(price: number): string {
  const maximumFractionDigits = price < 1 ? 4 : price < 100 ? 2 : 2;
  return price.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: price < 1 ? 4 : 2,
    maximumFractionDigits,
  });
}

function getDisplayAssets(coins: CoinMarket[]): DisplayAsset[] {
  const liveById = new Map(coins.map((coin) => [coin.id, coin]));

  return WATCHLIST.map((fallback) => {
    const live = liveById.get(fallback.id);
    return {
      id: fallback.id,
      symbol: fallback.symbol,
      name: fallback.name,
      price: live?.current_price ?? fallback.price,
      change: live?.price_change_percentage_24h ?? fallback.change,
      isLive: Boolean(live),
    };
  });
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { coins, loading, error, refresh } = useMarkets();

  const assets = useMemo(() => getDisplayAssets(coins), [coins]);
  const allLive = assets.every((asset) => asset.isLive);
  const gainers = assets.filter((asset) => asset.change >= 0).length;
  const topMover = assets.reduce((leader, asset) =>
    Math.abs(asset.change) > Math.abs(leader.change) ? asset : leader
  );

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={loading && coins.length > 0}
            onRefresh={refresh}
            tintColor={Colors.accent}
          />
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
          <View style={[styles.statusDot, !allLive && styles.statusDotFallback]} />
          <Text style={styles.statusText}>
            {allLive ? 'Live market data' : 'Demo data shown while live prices are unavailable'}
          </Text>
          {loading && <ActivityIndicator size="small" color={Colors.accent} />}
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.summaryRow}
        >
          <View style={styles.summaryCard}>
            <View style={styles.summaryIcon}>
              <MaterialCommunityIcons name="chart-line" size={19} color={Colors.accent} />
            </View>
            <Text style={styles.summaryLabel}>Crypto Market</Text>
            <Text style={styles.summaryValue}>10 assets</Text>
            <Text style={styles.summaryMeta}>{gainers} positive today</Text>
          </View>

          <View style={styles.summaryCard}>
            <View style={styles.summaryIcon}>
              <MaterialCommunityIcons name="star-outline" size={19} color={Colors.accent} />
            </View>
            <Text style={styles.summaryLabel}>Stocks Watchlist</Text>
            <Text style={styles.summaryValue}>Coming soon</Text>
            <Text style={styles.summaryMeta}>Market tracking only</Text>
          </View>

          <View style={styles.summaryCard}>
            <View style={styles.summaryIcon}>
              <MaterialCommunityIcons name="swap-vertical" size={19} color={Colors.accent} />
            </View>
            <Text style={styles.summaryLabel}>24h Movers</Text>
            <Text style={styles.summaryValue}>{topMover.symbol}</Text>
            <Text
              style={[
                styles.summaryMeta,
                { color: topMover.change >= 0 ? Colors.accent : Colors.red },
              ]}
            >
              {topMover.change >= 0 ? '+' : ''}
              {topMover.change.toFixed(2)}%
            </Text>
          </View>
        </ScrollView>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Market Watch</Text>
          <Text style={styles.sectionCaption}>PRICE / 24H</Text>
        </View>

        <View style={styles.assetCard}>
          {assets.map((asset, index) => {
            const positive = asset.change >= 0;
            return (
              <View
                key={asset.id}
                style={[styles.assetRow, index < assets.length - 1 && styles.assetDivider]}
              >
                <View style={styles.assetIdentity}>
                  <View style={styles.assetBadge}>
                    <Text style={styles.assetBadgeText}>{asset.symbol.slice(0, 2)}</Text>
                  </View>
                  <View>
                    <Text style={styles.assetSymbol}>{asset.symbol}</Text>
                    <Text style={styles.assetName}>{asset.name}</Text>
                  </View>
                </View>

                <View style={styles.assetValues}>
                  <Text style={styles.assetPrice}>{formatPrice(asset.price)}</Text>
                  <Text
                    style={[
                      styles.assetChange,
                      { color: positive ? Colors.accent : Colors.red },
                    ]}
                  >
                    {positive ? '+' : ''}
                    {asset.change.toFixed(2)}%
                  </Text>
                </View>
              </View>
            );
          })}
        </View>

        {error && (
          <Text style={styles.dataNote}>
            Live data could not be refreshed. Displayed fallback prices are examples only.
          </Text>
        )}
        <Text style={styles.disclaimer}>
          Market information is provided for informational portfolio tracking only.
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
