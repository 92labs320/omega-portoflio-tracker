import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors, Typography } from '@/constants/Colors';
import { createTransaction } from '@/services/supabase';
import { usePortfolioStore } from '@/store/portfolioStore';

export default function AddTransactionScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    category?: 'crypto' | 'stock';
    type?: string;
  }>();
  
  const [asset, setAsset] = useState('');
  const [amount, setAmount] = useState('');
  const [price, setPrice] = useState('');
  const [exchange, setExchange] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const { addTransaction } = usePortfolioStore();

  const category = (params?.category || 'crypto') as 'crypto' | 'stock';
  const type = (params?.type || 'buy') as any;

  const handleSubmit = async () => {
    if (!asset || !amount || !price) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    try {
      setLoading(true);
      const txData = {
        asset,
        type,
        amount: parseFloat(amount),
        price: parseFloat(price),
        exchange: exchange || 'Manual',
        notes: notes || undefined,
        category,
      };

      // Save to Supabase
      await createTransaction(txData);

      // Add to portfolio store
      addTransaction({
        assetId: asset.toLowerCase(),
        symbol: asset.toUpperCase(),
        name: asset,
        type,
        quantity: parseFloat(amount),
        priceUsd: parseFloat(price),
        date: new Date().toISOString(),
      });

      Alert.alert('Success', 'Transaction added!', [
        {
          text: 'OK',
          onPress: () => router.back(),
        },
      ]);
    } catch (error) {
      Alert.alert('Error', (error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <MaterialCommunityIcons
              name="chevron-left"
              size={28}
              color={Colors.text}
            />
          </TouchableOpacity>
          <Text style={styles.title}>Add Transaction</Text>
          <View style={{ width: 28 }} />
        </View>

        {/* Transaction Type & Category Info */}
        <View style={styles.infoCard}>
          <View style={styles.infoBadges}>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{type.toUpperCase()}</Text>
            </View>
            <View style={[styles.badge, { backgroundColor: Colors.textSecondary }]}>
              <Text style={styles.badgeText}>{category.toUpperCase()}</Text>
            </View>
          </View>
        </View>

        {/* Form */}
        <View style={styles.form}>
          <Text style={styles.label}>Asset Symbol *</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g., BTC, AAPL"
            placeholderTextColor={Colors.textTertiary}
            value={asset}
            onChangeText={setAsset}
            editable={!loading}
            autoCapitalize="characters"
          />

          <Text style={[styles.label, { marginTop: 16 }]}>Amount *</Text>
          <TextInput
            style={styles.input}
            placeholder="Quantity"
            placeholderTextColor={Colors.textTertiary}
            value={amount}
            onChangeText={setAmount}
            editable={!loading}
            keyboardType="decimal-pad"
          />

          <Text style={[styles.label, { marginTop: 16 }]}>Price (USD) *</Text>
          <TextInput
            style={styles.input}
            placeholder="Price per unit"
            placeholderTextColor={Colors.textTertiary}
            value={price}
            onChangeText={setPrice}
            editable={!loading}
            keyboardType="decimal-pad"
          />

          <Text style={[styles.label, { marginTop: 16 }]}>Exchange</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g., Kraken, Coinbase, Manual"
            placeholderTextColor={Colors.textTertiary}
            value={exchange}
            onChangeText={setExchange}
            editable={!loading}
          />

          <Text style={[styles.label, { marginTop: 16 }]}>Notes</Text>
          <TextInput
            style={[styles.input, styles.multilineInput]}
            placeholder="Add notes about this transaction..."
            placeholderTextColor={Colors.textTertiary}
            value={notes}
            onChangeText={setNotes}
            editable={!loading}
            multiline
            numberOfLines={4}
          />
        </View>

        {/* Action Buttons */}
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.button, styles.cancelButton]}
            onPress={() => router.back()}
            disabled={loading}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.submitButton, loading && styles.buttonDisabled]}
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={Colors.background} />
            ) : (
              <Text style={styles.submitButtonText}>Add Transaction</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingBottom: 20,
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
  infoCard: {
    marginHorizontal: 16,
    marginBottom: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: Colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  infoBadges: {
    flexDirection: 'row',
    gap: 8,
  },
  badge: {
    backgroundColor: Colors.accent,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  badgeText: {
    ...Typography.caption1,
    color: Colors.background,
    fontWeight: '600',
  },
  form: {
    paddingHorizontal: 16,
  },
  label: {
    ...Typography.subheadline,
    color: Colors.text,
    marginBottom: 8,
  },
  input: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: Colors.text,
    ...Typography.body,
  },
  multilineInput: {
    textAlignVertical: 'top',
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    marginTop: 24,
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  cancelButton: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cancelButtonText: {
    ...Typography.headline,
    color: Colors.text,
  },
  submitButton: {
    backgroundColor: Colors.accent,
  },
  submitButtonText: {
    ...Typography.headline,
    color: Colors.background,
  },
});


