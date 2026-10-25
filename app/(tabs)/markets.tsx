import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
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
import { formatTime } from '@/lib/format';
import { useMarkets } from '@/hooks/useMarkets';
import type { CoinMarket } from '@/services/marketService';

export default function MarketsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { coins, loading, error, updatedAt, refresh } = useMarkets();
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toUpperCase();
    if (!q) return coins;
    return coins.filter((c) => c.symbol.toUpperCase().includes(q) || c.name.toUpperCase().includes(q));
  }, [coins, query]);

  const renderItem = ({ item, index }: { item: CoinMarket; index: number }) => (
    <CoinRow
      rank={index + 1}
      symbol={item.symbol}
      name={item.name}
      image={item.image}
      price={item.current_price}
      change24h={item.price_change_percentage_24h}
      divider
      onPress={() =>
        router.push({
          pathname: '/add-transaction/form',
          params: {
            category: 'crypto',
            type: 'buy',
            assetId: item.id,
            symbol: item.symbol.toUpperCase(),
            name: item.name,
          },
        })
      }
    />
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
            : `Top 250 crypto by market cap · ${updatedAt ? `updated ${formatTime(updatedAt)}` : 'loading…'}`}
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
          data={filtered}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={Colors.accent} />}
          ListEmptyComponent={
            <Text style={styles.noMatch}>No coin matches "{query}" in the top 250.</Text>
          }
          ListFooterComponent={
            <Text style={styles.footer}>Market data provided by CoinGecko. Tap a coin to record a transaction.</Text>
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
    marginBottom: 12,
    paddingHorizontal: 12,
    height: 44,
    backgroundColor: Colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, color: Colors.text, fontSize: 16 },
  list: { paddingBottom: 32 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  emptyTitle: { color: Colors.text, fontSize: 17, fontWeight: '700', marginTop: 12 },
  emptyText: { color: Colors.textSecondary, fontSize: 13, textAlign: 'center', marginTop: 6 },
  retryBtn: {
    marginTop: 16,
    paddingHorizontal: 22,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: Colors.accent,
  },
  retryText: { color: Colors.background, fontWeight: '700', fontSize: 14 },
  noMatch: { color: Colors.textSecondary, textAlign: 'center', marginTop: 32, paddingHorizontal: 24 },
  footer: {
    color: Colors.textTertiary,
    fontSize: 11,
    textAlign: 'center',
    marginTop: 18,
    paddingHorizontal: 24,
  },
});
