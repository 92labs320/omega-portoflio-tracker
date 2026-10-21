import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Typography } from '@/constants/Colors';

const TRANSACTION_TYPES = [
  {
    id: 'buy',
    label: 'Buy',
    icon: 'plus-circle',
    description: 'Purchase an asset',
    color: Colors.green,
  },
  {
    id: 'sell',
    label: 'Sell',
    icon: 'minus-circle',
    description: 'Sell an asset',
    color: Colors.red,
  },
  {
    id: 'stake',
    label: 'Stake',
    icon: 'lock-outline',
    description: 'Lock assets for staking (quantity unchanged)',
    color: Colors.blue,
  },
  {
    id: 'unstake',
    label: 'Unstake',
    icon: 'lock-open-outline',
    description: 'Unlock staked assets (quantity unchanged)',
    color: Colors.orange,
  },
  {
    id: 'reward',
    label: 'Reward',
    icon: 'gift-outline',
    description: 'Staking or interest reward received',
    color: Colors.green,
  },
  {
    id: 'airdrop',
    label: 'Airdrop',
    icon: 'parachute',
    description: 'Tokens received for free',
    color: Colors.blue,
  },
];

export default function SelectTypeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ category?: string }>();
  const category = params?.category || 'crypto';

  const handleSelectType = (typeId: string) => {
    router.push({
      pathname: '/add-transaction/form',
      params: { type: typeId, category },
    });
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingTop: insets.top }}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <MaterialCommunityIcons
            name="chevron-left"
            size={28}
            color={Colors.text}
          />
        </TouchableOpacity>
        <Text style={styles.title}>Select Type</Text>
        <View style={{ width: 28 }} />
      </View>

      <Text style={styles.subtitle}>Choose transaction type</Text>

      <View style={styles.grid}>
        {TRANSACTION_TYPES.filter((t) => category === 'crypto' || t.id === 'buy' || t.id === 'sell').map((type) => (
          <TouchableOpacity
            key={type.id}
            style={styles.card}
            onPress={() => handleSelectType(type.id)}
            activeOpacity={0.7}
          >
            <View
              style={[styles.iconContainer, { backgroundColor: type.color }]}
            >
              <MaterialCommunityIcons
                name={type.icon as any}
                size={28}
                color={Colors.background}
              />
            </View>
            <Text style={styles.cardLabel}>{type.label}</Text>
            <Text style={styles.cardDescription}>{type.description}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
  },
  title: {
    ...Typography.headline,
    color: Colors.text,
  },
  subtitle: {
    ...Typography.body,
    color: Colors.textSecondary,
    marginHorizontal: 16,
    marginBottom: 20,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 12,
    paddingBottom: 20,
  },
  card: {
    width: '50%',
    paddingHorizontal: 6,
    marginBottom: 12,
  },
  iconContainer: {
    width: 52,
    height: 52,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardLabel: {
    ...Typography.subheadline,
    color: Colors.text,
    marginBottom: 4,
  },
  cardDescription: {
    ...Typography.caption1,
    color: Colors.textSecondary,
  },
});


