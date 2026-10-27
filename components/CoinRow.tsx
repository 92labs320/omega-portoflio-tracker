import React, { memo, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors } from '@/constants/Colors';
import { formatPct, formatSignedNumber, formatUsd } from '@/lib/format';
import { useCurrencyStore } from '@/store/currencyStore';

export interface CoinRowProps {
  symbol: string;
  name: string;
  image?: string;
  price: number | null;
  change24h: number | null;
  rank?: number;
  divider?: boolean;
  onPress?: () => void;
}

export function AssetBadge({ symbol, image, size = 38 }: { symbol: string; image?: string; size?: number }) {
  const [failed, setFailed] = useState(false);
  if (image && !failed) {
    return (
      <Image
        source={{ uri: image }}
        onError={() => setFailed(true)}
        style={{ width: size, height: size, borderRadius: size / 2, marginRight: 12 }}
      />
    );
  }
  return (
    <View style={[styles.badge, { width: size, height: size, borderRadius: size / 3 }]}>
      <Text style={styles.badgeText}>{symbol.slice(0, 3).toUpperCase()}</Text>
    </View>
  );
}

function CoinRowBase({ symbol, name, image, price, change24h, rank, divider, onPress }: CoinRowProps) {
  const currencyCode = useCurrencyStore((st) => st.code);
  const has = price !== null && change24h !== null && Number.isFinite(change24h);
  const positive = (change24h ?? 0) >= 0;
  const color = !has ? Colors.textTertiary : positive ? Colors.accent : Colors.red;
  const abs = has && price !== null ? price - price / (1 + (change24h as number) / 100) : null;
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [styles.row, divider && styles.divider, pressed && styles.pressed]}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={`${name}, ${price !== null ? formatUsd(price) : 'no price'}, ${formatPct(change24h)} today`}
    >
      {rank !== undefined && <Text style={styles.rank}>{rank}</Text>}
      <AssetBadge symbol={symbol} image={image} />
      <View style={styles.identity}>
        <Text style={styles.symbol}>{symbol.toUpperCase()}</Text>
        <Text style={styles.name} numberOfLines={1}>
          {name}
        </Text>
      </View>
      <View style={styles.values}>
        <Text style={styles.price}>{price !== null ? formatUsd(price) : '—'}</Text>
        <View style={styles.changeRow}>
          {abs !== null ? <Text style={[styles.changeAbs, { color }]}>{formatSignedNumber(abs)}</Text> : null}
          <View
            style={[
              styles.changeBadge,
              { backgroundColor: !has ? 'transparent' : positive ? 'rgba(0,217,100,0.16)' : 'rgba(255,68,68,0.16)' },
            ]}
          >
            <Text style={[styles.change, { color }]}>{formatPct(change24h)}</Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

export const CoinRow = memo(CoinRowBase);

const styles = StyleSheet.create({
  row: {
    minHeight: 70,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  pressed: { backgroundColor: 'rgba(255,255,255,0.04)' },
  divider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderLight,
  },
  rank: {
    width: 24,
    color: Colors.textTertiary,
    fontSize: 12,
    fontWeight: '600',
  },
  badge: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    marginRight: 12,
  },
  badgeText: { color: Colors.accent, fontSize: 11, fontWeight: '800' },
  identity: { flex: 1 },
  symbol: { color: Colors.text, fontSize: 15, fontWeight: '700', marginBottom: 3 },
  name: { color: Colors.textTertiary, fontSize: 12 },
  values: { alignItems: 'flex-end', marginLeft: 12 },
  price: { color: Colors.text, fontSize: 14, fontWeight: '600', marginBottom: 4 },
  changeRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  changeAbs: { fontSize: 12, fontWeight: '500' },
  changeBadge: { paddingHorizontal: 5, paddingVertical: 1, borderRadius: 5 },
  change: { fontSize: 12, fontWeight: '700' },
});
