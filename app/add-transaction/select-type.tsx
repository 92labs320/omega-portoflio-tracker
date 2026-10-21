import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
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
    description: 'Stake your assets',
    color: Colors.blue,
  },
  {
    id: 'unstake',
    label: 'Unstake',
    icon: 'lock-open-outline',
    description: 'Unstake your assets',
    color: Colors.orange,
  },
  {
    id: 'reward',
    label: 'Reward',
    icon: 'gift-outline',
    description: 'Received reward',
    color: Colors.green,
  },
  {
    id: 'airdrop',
    label: 'Airdrop',
    icon: 'parachute',
    description: 'Received airdrop',
    color: Colors.blue,
  },
];

export default function SelectTypeScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ category?: string }>();
  const category = params?.category || 'crypto';

  const handleSelectType = (typeId: string) => {
    router.push({
      pathname: '/add-transaction',
      params: { type: typeId, category },
    });
  };

  return (
    <ScrollView style={styles.container}>
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
        {TRANSACTION_TYPES.map((type) => (
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
                size={32}
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
    paddingHorizontal: 8,
    marginBottom: 16,
  },
  iconContainer: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 16,
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


