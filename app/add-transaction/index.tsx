import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
    description: 'AAPL, MSFT, etc.',
    color: Colors.blue,
  },
];

export default function SelectCategoryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const handleSelectCategory = (categoryId: string) => {
    router.push({
      pathname: '/add-transaction/select-type',
      params: { category: categoryId },
    });
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Close">
            <MaterialCommunityIcons name="close" size={26} color={Colors.text} />
          </TouchableOpacity>
        </View>
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
    </View>
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
  topBar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 8,
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


