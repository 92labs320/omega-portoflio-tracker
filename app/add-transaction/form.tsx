import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors, Typography } from '@/constants/Colors';
import {
  TYPE_LABELS,
  formatQty,
  formatUsd,
  fromDateInput,
  parseDecimal,
  toDateInput,
} from '@/lib/format';
import type { AssetCategory, TransactionType } from '@/lib/types';
import { TRANSACTION_TYPES } from '@/lib/types';
import {
  fetchCryptoQuotes,
  fetchStockQuotes,
  searchCoins,
  stockQuotesAvailable,
  type CoinSearchResult,
} from '@/services/marketService';
import { usePortfolioStore } from '@/store/portfolioStore';

type Params = {
  id?: string;
  category?: string;
  type?: string;
  assetId?: string;
  symbol?: string;
  name?: string;
};

interface SelectedAsset {
  assetId: string;
  symbol: string;
  name: string;
  thumb?: string;
}

function numToInput(n: number): string {
  return n ? String(n) : '';
}

export default function TransactionFormScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<Params>();
  const transactions = usePortfolioStore((s) => s.transactions);
  const holdings = usePortfolioStore((s) => s.holdings);
  const add = usePortfolioStore((s) => s.add);
  const update = usePortfolioStore((s) => s.update);

  const editing = params.id ? transactions.find((t) => t.id === params.id) : undefined;
  const isEdit = Boolean(params.id);

  const category: AssetCategory =
    editing?.category ?? (params.category === 'stock' ? 'stock' : 'crypto');
  const initialType = (editing?.type ??
    (TRANSACTION_TYPES.includes(params.type as TransactionType) ? params.type : 'buy')) as TransactionType;

  const [type, setType] = useState<TransactionType>(initialType);
  const [asset, setAsset] = useState<SelectedAsset | null>(() => {
    if (editing) return { assetId: editing.assetId, symbol: editing.symbol, name: editing.name };
    if (params.assetId && params.symbol) {
      return { assetId: params.assetId, symbol: params.symbol, name: params.name ?? params.symbol };
    }
    return null;
  });
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<CoinSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const [ticker, setTicker] = useState(editing && category === 'stock' ? editing.symbol : '');
  const [stockName, setStockName] = useState(editing && category === 'stock' ? editing.name : '');

  const [quantity, setQuantity] = useState(numToInput(editing?.quantity ?? 0));
  const [price, setPrice] = useState(numToInput(editing?.priceUsd ?? 0));
  const [fee, setFee] = useState(numToInput(editing?.feeUsd ?? 0));
  const [date, setDate] = useState(toDateInput(editing?.executedAt ?? new Date().toISOString()));
  const [exchange, setExchange] = useState(editing?.exchange ?? '');
  const [notes, setNotes] = useState(editing?.notes ?? '');
  const [saving, setSaving] = useState(false);
  const [fetchingPrice, setFetchingPrice] = useState(false);

  // Debounced CoinGecko search
  const searchSeq = useRef(0);
  useEffect(() => {
    if (category !== 'crypto' || asset) return;
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setSearchError(null);
      return;
    }
    const seq = ++searchSeq.current;
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        const r = await searchCoins(q);
        if (seq === searchSeq.current) {
          setResults(r);
          setSearchError(null);
        }
      } catch (e) {
        if (seq === searchSeq.current) setSearchError(e instanceof Error ? e.message : 'Search failed');
      } finally {
        if (seq === searchSeq.current) setSearching(false);
      }
    }, 350);
    return () => clearTimeout(t);
  }, [query, category, asset]);

  const qty = parseDecimal(quantity);
  const unitPrice = parseDecimal(price);
  const feeValue = fee.trim() ? parseDecimal(fee) : 0;
  const total = Number.isFinite(qty) && Number.isFinite(unitPrice) ? qty * unitPrice : NaN;

  const resolvedAsset: SelectedAsset | null =
    category === 'crypto'
      ? asset
      : ticker.trim()
        ? {
            assetId: ticker.trim().toUpperCase(),
            symbol: ticker.trim().toUpperCase(),
            name: stockName.trim() || ticker.trim().toUpperCase(),
          }
        : null;

  const held = useMemo(() => {
    if (!resolvedAsset) return 0;
    const h = holdings.find((x) => x.category === category && x.assetId === resolvedAsset.assetId);
    let q = h?.quantity ?? 0;
    // When editing a sell, its own quantity is already deducted.
    if (editing && editing.type === 'sell' && editing.assetId === resolvedAsset.assetId) q += editing.quantity;
    return q;
  }, [holdings, resolvedAsset, category, editing]);

  const useCurrentPrice = async () => {
    if (!resolvedAsset) return;
    setFetchingPrice(true);
    try {
      const quotes =
        category === 'crypto'
          ? await fetchCryptoQuotes([resolvedAsset.assetId])
          : await fetchStockQuotes([resolvedAsset.assetId]);
      const q = quotes[resolvedAsset.assetId];
      if (q) setPrice(String(q.price));
      else Alert.alert('Price unavailable', 'No live price was found for this asset. Enter it manually.');
    } catch (e) {
      Alert.alert('Price unavailable', e instanceof Error ? e.message : 'Enter the price manually.');
    } finally {
      setFetchingPrice(false);
    }
  };

  const close = () => {
    if (isEdit) router.back();
    else router.dismissTo('/(tabs)/portfolio');
  };

  const handleSave = async () => {
    if (!resolvedAsset) {
      Alert.alert('Missing asset', category === 'crypto' ? 'Search and select a coin.' : 'Enter a ticker symbol.');
      return;
    }
    if (category === 'stock' && !/^[A-Z0-9.\-]{1,12}$/.test(resolvedAsset.symbol)) {
      Alert.alert('Invalid ticker', 'Use the exchange ticker, e.g. AAPL or SHOP.TO.');
      return;
    }
    if (!Number.isFinite(qty) || qty <= 0) {
      Alert.alert('Invalid quantity', 'Enter a quantity greater than 0.');
      return;
    }
    const needsPrice = type === 'buy' || type === 'sell';
    if (!Number.isFinite(unitPrice) || unitPrice < 0 || (needsPrice && unitPrice === 0)) {
      Alert.alert('Invalid price', needsPrice ? 'Enter the price per unit in USD.' : 'Enter 0 or the value per unit in USD.');
      return;
    }
    if (!Number.isFinite(feeValue) || feeValue < 0) {
      Alert.alert('Invalid fee', 'Enter a fee of 0 or more, or leave it empty.');
      return;
    }
    const executedAt = fromDateInput(date);
    if (!executedAt) {
      Alert.alert('Invalid date', 'Use the format YYYY-MM-DD.');
      return;
    }
    if (new Date(executedAt).getTime() > Date.now() + 24 * 3600 * 1000) {
      Alert.alert('Invalid date', 'The date cannot be in the future.');
      return;
    }

    const doSave = async () => {
      setSaving(true);
      try {
        const input = {
          assetId: resolvedAsset.assetId,
          symbol: resolvedAsset.symbol.toUpperCase(),
          name: resolvedAsset.name,
          category,
          type,
          quantity: qty,
          priceUsd: Number.isFinite(unitPrice) ? unitPrice : 0,
          feeUsd: feeValue,
          exchange: exchange.trim(),
          notes: notes.trim(),
          executedAt,
        };
        if (isEdit && params.id) await update(params.id, input);
        else await add(input);
        close();
      } catch (e) {
        Alert.alert('Could not save', e instanceof Error ? e.message : 'Unknown error');
      } finally {
        setSaving(false);
      }
    };

    if (type === 'sell' && qty > held + 1e-12) {
      Alert.alert(
        'Selling more than you hold',
        `You currently hold ${formatQty(held)} ${resolvedAsset.symbol}. Only that amount will be counted as sold.`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Save anyway', onPress: doSave },
        ],
      );
      return;
    }
    await doSave();
  };

  if (isEdit && !editing) {
    return (
      <View style={[styles.container, styles.center, { paddingTop: insets.top }]}>
        <Text style={styles.label}>This transaction no longer exists.</Text>
        <Pressable onPress={() => router.back()} style={styles.linkBtn}>
          <Text style={styles.linkText}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  const typeOptions = category === 'crypto' ? TRANSACTION_TYPES : (['buy', 'sell'] as TransactionType[]);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.content, { paddingTop: insets.top }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={10} accessibilityRole="button" accessibilityLabel="Back">
            <MaterialCommunityIcons name="chevron-left" size={28} color={Colors.text} />
          </Pressable>
          <Text style={styles.title}>{isEdit ? 'Edit Transaction' : 'Add Transaction'}</Text>
          <View style={{ width: 28 }} />
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.typeRow}>
          {typeOptions.map((t) => (
            <Pressable
              key={t}
              onPress={() => setType(t)}
              style={[styles.typePill, type === t && styles.typePillOn]}
              accessibilityRole="button"
              accessibilityState={{ selected: type === t }}
            >
              <Text style={[styles.typePillText, type === t && styles.typePillTextOn]}>{TYPE_LABELS[t]}</Text>
            </Pressable>
          ))}
        </ScrollView>

        <View style={styles.form}>
          {category === 'crypto' ? (
            <>
              <Text style={styles.label}>Coin *</Text>
              {asset ? (
                <View style={styles.selected}>
                  {asset.thumb ? <Image source={{ uri: asset.thumb }} style={styles.thumb} /> : null}
                  <View style={{ flex: 1 }}>
                    <Text style={styles.selectedSymbol}>{asset.symbol}</Text>
                    <Text style={styles.selectedName}>{asset.name}</Text>
                  </View>
                  {!isEdit && (
                    <Pressable
                      onPress={() => {
                        setAsset(null);
                        setQuery('');
                      }}
                      hitSlop={10}
                      accessibilityRole="button"
                      accessibilityLabel="Change coin"
                    >
                      <Text style={styles.linkText}>Change</Text>
                    </Pressable>
                  )}
                </View>
              ) : (
                <>
                  <TextInput
                    style={styles.input}
                    placeholder="Search Bitcoin, ETH, Solana…"
                    placeholderTextColor={Colors.textTertiary}
                    value={query}
                    onChangeText={setQuery}
                    autoCorrect={false}
                    autoCapitalize="none"
                    autoFocus={!params.assetId}
                  />
                  {searching && <ActivityIndicator style={{ marginTop: 10 }} color={Colors.accent} />}
                  {searchError && <Text style={styles.error}>{searchError}</Text>}
                  {results.length > 0 && (
                    <View style={styles.results}>
                      {results.map((r, i) => (
                        <Pressable
                          key={r.id}
                          style={({ pressed }) => [
                            styles.resultRow,
                            i < results.length - 1 && styles.resultDivider,
                            pressed && { opacity: 0.6 },
                          ]}
                          onPress={() => {
                            setAsset({ assetId: r.id, symbol: r.symbol.toUpperCase(), name: r.name, thumb: r.thumb });
                            setResults([]);
                          }}
                        >
                          {r.thumb ? <Image source={{ uri: r.thumb }} style={styles.thumb} /> : null}
                          <Text style={styles.resultSymbol}>{r.symbol.toUpperCase()}</Text>
                          <Text style={styles.resultName} numberOfLines={1}>
                            {r.name}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  )}
                </>
              )}
            </>
          ) : (
            <>
              <Text style={styles.label}>Ticker *</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. AAPL"
                placeholderTextColor={Colors.textTertiary}
                value={ticker}
                onChangeText={(v) => setTicker(v.toUpperCase())}
                autoCapitalize="characters"
                autoCorrect={false}
                editable={!isEdit}
              />
              <Text style={[styles.label, styles.spaced]}>Company name</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Apple Inc."
                placeholderTextColor={Colors.textTertiary}
                value={stockName}
                onChangeText={setStockName}
              />
              {!stockQuotesAvailable() && (
                <Text style={styles.help}>Live stock prices require the Omega cloud service.</Text>
              )}
            </>
          )}

          <Text style={[styles.label, styles.spaced]}>Quantity *</Text>
          <TextInput
            style={styles.input}
            placeholder="0"
            placeholderTextColor={Colors.textTertiary}
            value={quantity}
            onChangeText={setQuantity}
            keyboardType="decimal-pad"
          />
          {type === 'sell' && resolvedAsset && (
            <Text style={styles.help}>
              You hold {formatQty(held)} {resolvedAsset.symbol}.
            </Text>
          )}

          <View style={[styles.labelRow, styles.spaced]}>
            <Text style={styles.label}>
              {type === 'reward' || type === 'airdrop' ? 'Value per unit (USD)' : 'Price per unit (USD)'}
              {type === 'buy' || type === 'sell' ? ' *' : ''}
            </Text>
            {resolvedAsset && (category === 'crypto' || stockQuotesAvailable()) && (
              <Pressable onPress={useCurrentPrice} disabled={fetchingPrice} hitSlop={8}>
                {fetchingPrice ? (
                  <ActivityIndicator size="small" color={Colors.accent} />
                ) : (
                  <Text style={styles.linkText}>Use current price</Text>
                )}
              </Pressable>
            )}
          </View>
          <TextInput
            style={styles.input}
            placeholder="0.00"
            placeholderTextColor={Colors.textTertiary}
            value={price}
            onChangeText={setPrice}
            keyboardType="decimal-pad"
          />

          <Text style={[styles.label, styles.spaced]}>Fee (USD)</Text>
          <TextInput
            style={styles.input}
            placeholder="0.00"
            placeholderTextColor={Colors.textTertiary}
            value={fee}
            onChangeText={setFee}
            keyboardType="decimal-pad"
          />

          <Text style={[styles.label, styles.spaced]}>Date *</Text>
          <TextInput
            style={styles.input}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={Colors.textTertiary}
            value={date}
            onChangeText={setDate}
            keyboardType="numbers-and-punctuation"
            maxLength={10}
          />

          <Text style={[styles.label, styles.spaced]}>Platform</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Kraken, Coinbase, Wealthsimple"
            placeholderTextColor={Colors.textTertiary}
            value={exchange}
            onChangeText={setExchange}
            maxLength={60}
          />

          <Text style={[styles.label, styles.spaced]}>Notes</Text>
          <TextInput
            style={[styles.input, styles.multilineInput]}
            placeholder="Optional"
            placeholderTextColor={Colors.textTertiary}
            value={notes}
            onChangeText={setNotes}
            multiline
            maxLength={500}
          />

          {Number.isFinite(total) && total > 0 && (
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.totalValue}>
                {formatUsd(total + (type === 'sell' ? -(feeValue || 0) : feeValue || 0))}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.actions}>
          <Pressable style={[styles.button, styles.cancelButton]} onPress={() => router.back()} disabled={saving}>
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </Pressable>
          <Pressable
            style={[styles.button, styles.submitButton, saving && styles.buttonDisabled]}
            onPress={handleSave}
            disabled={saving}
            accessibilityRole="button"
          >
            {saving ? (
              <ActivityIndicator color={Colors.background} />
            ) : (
              <Text style={styles.submitButtonText}>{isEdit ? 'Save' : 'Add'}</Text>
            )}
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { alignItems: 'center', justifyContent: 'center' },
  scrollView: { flex: 1 },
  content: { paddingBottom: 40 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
  },
  title: { ...Typography.headline, color: Colors.text },
  typeRow: { paddingHorizontal: 16, gap: 8, paddingBottom: 16 },
  typePill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  typePillOn: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  typePillText: { color: Colors.textSecondary, fontSize: 14, fontWeight: '600' },
  typePillTextOn: { color: Colors.background },
  form: { paddingHorizontal: 16 },
  label: { ...Typography.subheadline, color: Colors.text, marginBottom: 8 },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  spaced: { marginTop: 18 },
  input: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: Colors.text,
    fontSize: 17,
  },
  multilineInput: { minHeight: 88, textAlignVertical: 'top' },
  help: { ...Typography.caption1, color: Colors.textTertiary, marginTop: 6 },
  error: { ...Typography.caption1, color: Colors.red, marginTop: 8 },
  selected: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(0,217,100,0.35)',
    padding: 12,
  },
  selectedSymbol: { color: Colors.text, fontSize: 16, fontWeight: '700' },
  selectedName: { color: Colors.textSecondary, fontSize: 13, marginTop: 2 },
  thumb: { width: 26, height: 26, borderRadius: 13, marginRight: 10 },
  results: {
    marginTop: 8,
    backgroundColor: Colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    overflow: 'hidden',
  },
  resultRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 11 },
  resultDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.borderLight },
  resultSymbol: { color: Colors.text, fontWeight: '700', fontSize: 14, width: 64 },
  resultName: { color: Colors.textSecondary, fontSize: 14, flex: 1 },
  linkBtn: { marginTop: 12 },
  linkText: { color: Colors.accent, fontSize: 14, fontWeight: '600' },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 22,
    paddingTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.borderLight,
  },
  totalLabel: { color: Colors.textSecondary, fontSize: 15 },
  totalValue: { color: Colors.text, fontSize: 17, fontWeight: '700' },
  actions: { flexDirection: 'row', gap: 12, paddingHorizontal: 16, marginTop: 28 },
  button: { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  buttonDisabled: { opacity: 0.6 },
  cancelButton: { backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.borderLight },
  cancelButtonText: { ...Typography.headline, color: Colors.text },
  submitButton: { backgroundColor: Colors.accent },
  submitButtonText: { ...Typography.headline, color: Colors.background },
});
