import React from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity } from 'react-native';
import { Colors, Typography } from '@/constants/Colors';

export interface AssetRowProps {
  symbol: string;
  name: string;
  quantity: number;
  currentPrice: number;
  avgCostUsd: number;
  change24h?: number;
  icon?: string;
  onPress?: () => void;
}

export function AssetRow({
  symbol,
  name,
  quantity,
  currentPrice,
  avgCostUsd,
  change24h = 0,
  icon,
  onPress,
}: AssetRowProps) {
  const totalValue = quantity * currentPrice;
  const totalCost = quantity * avgCostUsd;
  const totalGain = totalValue - totalCost;
  const totalGainPercent = totalCost > 0 ? (totalGain / totalCost) * 100 : 0;
  
  const isPositive = totalGain >= 0;
  const gainColor = isPositive ? Colors.green : Colors.red;

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {/* Left: Icon + Symbol */}
      <View style={styles.leftSection}>
        {icon && (
          <Image source={{ uri: icon }} style={styles.icon} />
        )}
        <View>
          <Text style={styles.symbol}>{symbol.toUpperCase()}</Text>
          <Text style={styles.name}>{name}</Text>
        </View>
      </View>

      {/* Right: Value + Change */}
      <View style={styles.rightSection}>
        <Text style={styles.value}>{`$${totalValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}</Text>
        <View style={styles.changeRow}>
          <Text style={[styles.change, { color: gainColor }]}>
            {isPositive ? '+' : '-'}{`$${Math.abs(totalGain).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          </Text>
          <Text style={[styles.changePercent, { color: gainColor }]}>
            ({isPositive ? '+' : ''}{totalGainPercent.toFixed(2)}%)
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: Colors.card,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 8,
    marginRight: 12,
  },
  symbol: {
    ...Typography.subheadline,
    color: Colors.text,
    marginBottom: 4,
  },
  name: {
    ...Typography.caption1,
    color: Colors.textSecondary,
  },
  rightSection: {
    alignItems: 'flex-end',
  },
  value: {
    ...Typography.subheadline,
    color: Colors.text,
    marginBottom: 4,
  },
  changeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  change: {
    ...Typography.caption1,
    marginRight: 6,
  },
  changePercent: {
    ...Typography.caption2,
  },
});


