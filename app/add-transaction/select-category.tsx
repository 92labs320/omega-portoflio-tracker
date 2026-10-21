import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors, Typography } from '@/constants/Colors';

const CATEGORIES = [
  {
    id: 'crypto',
    label: 'Cryptocurrency',
    icon: 'bitcoin',
    description: 'Bitcoin, Ethereum, etc.',
    color: Colors.orange,
  },
  {
    id: 'stock',
    label: 'Stocks',
    icon: 'chart-line',
    description: 'AAPL, GOOG, etc.',
    color: Colors.blue,
  },
];

export default function SelectCategoryScreen() {
  const router = useRouter();

  const handleSelectCategory = (categoryId: string) => {
    router.push({
      pathname: '/add-transaction/select-type',
      params: { category: categoryId },
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Add Transaction</Text>
        <Text style={styles.subtitle}>What are you adding?</Text>
      </View>

      <View style={styles.content}>
        {CATEGORIES.map((category) => (
          <TouchableOpacity
            key={category.id}
            style={styles.card}
            onPress={() => handleSelectCategory(category.id)}
            activeOpacity={0.7}
          >
            <View
              style={[styles.iconBox, { backgroundColor: category.color }]}
            >
              <MaterialCommunityIcons
                name={category.icon as any}
                size={48}
                color={Colors.background}
              />
            </View>
            <View style={styles.cardContent}>
              <Text style={styles.cardLabel}>{category.label}</Text>
              <Text style={styles.cardDescription}>{category.description}</Text>
            </View>
            <MaterialCommunityIcons
              name="chevron-right"
              size={24}
              color={Colors.textSecondary}
            />
          </TouchableOpacity>
        ))}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  title: {
    ...Typography.largeTitle,
    color: Colors.text,
    marginBottom: 8,
  },
  subtitle: {
    ...Typography.body,
    color: Colors.textSecondary,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 24,
    gap: 12,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 12,
    backgroundColor: Colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  iconBox: {
    width: 64,
    height: 64,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  cardContent: {
    flex: 1,
  },
  cardLabel: {
    ...Typography.headline,
    color: Colors.text,
    marginBottom: 4,
  },
  cardDescription: {
    ...Typography.caption1,
    color: Colors.textSecondary,
  },
});


