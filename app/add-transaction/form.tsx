import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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

import { DateTimeSheet } from '@/components/DateTimeSheet';
import { PickerModal, type PickerItem } from '@/components/PickerModal';
import { Colors } from '@/constants/Colors';
import { getKv, setKv } from '@/lib/db';
import {
  TYPE_LABELS,
  formatQty,
  formatShortDateTime,
  formatTradeDate,
  formatUsd,
  parseDecimal,
  toInputNumber,
} from '@/lib/format';
import type { AssetCategory, TransactionType } from '@/lib/types';
import {
  fetchCryptoQuotes,
  fetchStockProfiles,
  fetchStockQuotes,
  searchCoins,
  searchStocks,
  shortExchange,
  stockQuotesAvailable,
  type CoinSearchResult,
  type StockHit,
  type StockProfile,
  type StockQuote,
} from '@/services/marketService';
import { AssetBadge } from '@/components/CoinRow';
import { formatPct } from '@/lib/format';
import {
  BROKERS,
  GLOBAL_EXCHANGE,
  exchangesFrom,
  fetchPriceAt,
  fetchTickers,
  pairsFor,
  type Ticker,
} from '@/services/tradeService';
import { usePortfolioStore } from '@/store/portfolioStore';
import { useCurrencyStore } from '@/store/currencyStore';

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

const USD_LIKE = new Set(['USD', 'USDT', 'USDC', 'BUSD', 'FDUSD', 'TUSD', 'DAI', 'USDP', 'PYUSD', 'USDE', 'USD1', 'USDS']);
const OTHER_TYPES: TransactionType[] = ['reward', 'airdrop', 'stake', 'unstake'];
const LAST_EXCHANGE_KEY = 'trade.lastExchange';
const NOW_WINDOW = 3 * 60_000;

function Row({
  label,
  value,
  onPress,
  right,
  disabled,
}: {
  label: string;
  value: string;
  onPress?: () => void;
  right?: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || !onPress}
      style={({ pressed }) => [styles.row, pressed && { opacity: 0.6 }]}
      accessibilityRole={onPress ? 'button' : undefined}
    >
      <View style={{ flex: 1 }}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={[styles.rowValue, disabled && { color: Colors.textTertiary }]} numberOfLines={1}>
          {value}
        </Text>
      </View>
      {right ?? (onPress ? <MaterialCommunityIcons name="chevron-right" size={24} color={Colors.text} /> : null)}
    </Pressable>
  );
}

export default function TransactionFormScreen() {
  const currencyCode = useCurrencyStore((st) => st.code);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<Params>();
  const transactions = usePortfolioStore((s) => s.transactions);
  const holdings = usePortfolioStore((s) => s.holdings);
  const add = usePortfolioStore((s) => s.add);
  const update = usePortfolioStore((s) => s.update);

  const editing = params.id ? transactions.find((t) => t.id === params.id) : undefined;
  const isEdit = Boolean(params.id);
  const category: AssetCategory = editing?.category ?? (params.category === 'stock' ? 'stock' : 'crypto');
  const isCrypto = category === 'crypto';

  // ---------- type ----------
  const [type, setType] = useState<TransactionType>(
    (editing?.type ??
      (['buy', 'sell', ...OTHER_TYPES].includes(params.type ?? '') ? params.type : 'buy')) as TransactionType,
  );

  // ---------- asset ----------
  const [asset, setAsset] = useState<SelectedAsset | null>(() => {
    if (editing) return { assetId: editing.assetId, symbol: editing.symbol, name: editing.name };
    if (params.assetId && params.symbol) {
      return { assetId: params.assetId, symbol: params.symbol.toUpperCase(), name: params.name ?? params.symbol };
    }
    return null;
  });
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<CoinSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const presetStock = !editing && !isCrypto && params.symbol ? params.symbol.toUpperCase() : '';
  const [ticker, setTickerSymbol] = useState(editing && !isCrypto ? editing.symbol : presetStock);
  const [stockName, setStockName] = useState(editing && !isCrypto ? editing.name : presetStock ? params.name ?? '' : '');
  const [stockPicked, setStockPicked] = useState(Boolean(editing && !isCrypto) || Boolean(presetStock));
  const [stockQuery, setStockQuery] = useState('');
  const [stockHits, setStockHits] = useState<StockHit[]>([]);
  const [stockSearching, setStockSearching] = useState(false);
  const [stockProfile, setStockProfile] = useState<StockProfile | null>(null);
  const [stockLive, setStockLive] = useState<StockQuote | null>(null);

  // ---------- venue ----------
  const [tickers, setTickers] = useState<Ticker[]>([]);
  const [tickersLoading, setTickersLoading] = useState(false);
  const [exchangeId, setExchangeId] = useState<string>(
    (editing?.exchangeId && editing.exchangeId !== '') ? editing.exchangeId : isCrypto ? GLOBAL_EXCHANGE : '',
  );
  const [exchangeName, setExchangeName] = useState<string>(
    editing?.exchange || (isCrypto ? 'Global avg.' : ''),
  );
  const [pairBase, setPairBase] = useState<string>(editing?.pair?.split('/')[0] || editing?.symbol || asset?.symbol || '');
  const [quote, setQuote] = useState<string>(editing?.quoteCurrency || 'USD');
  const [targetCoinId, setTargetCoinId] = useState<string | null>(null);
  const [exchangePicker, setExchangePicker] = useState(false);
  const [pairPicker, setPairPicker] = useState(false);

  // ---------- date ----------
  const [ts, setTs] = useState<number>(editing ? Date.parse(editing.executedAt) : Date.now());
  const [dateSheet, setDateSheet] = useState(false);

  // ---------- price ----------
  const [price, setPrice] = useState(
    editing ? toInputNumber(editing.priceQuote ?? editing.priceUsd) : '',
  );
  const [usdPerQuote, setUsdPerQuote] = useState<number | null>(
    editing ? (editing.priceQuote && editing.priceQuote > 0 ? editing.priceUsd / editing.priceQuote : USD_LIKE.has(editing.quoteCurrency) ? 1 : null) : 1,
  );
  const [priceSource, setPriceSource] = useState<string | null>(editing ? 'Saved price' : null);
  const [priceNote, setPriceNote] = useState<string | null>(null);
  const [priceLoading, setPriceLoading] = useState(false);
  const priceSeq = useRef(0);

  // ---------- amounts ----------
  const [quantity, setQuantity] = useState(editing ? toInputNumber(editing.quantity) : '');
  const [fee, setFee] = useState(
    editing ? toInputNumber(editing.feeQuote ?? editing.feeUsd) === '0' ? '' : toInputNumber(editing.feeQuote ?? editing.feeUsd) : '',
  );
  const [notes, setNotes] = useState(editing?.notes ?? '');
  const [saving, setSaving] = useState(false);

  const symbol = (isCrypto ? asset?.symbol : ticker.trim().toUpperCase()) ?? '';
  const pairLabel = isCrypto ? `${pairBase || symbol}/${quote}` : `${symbol || '—'}/USD`;

  // ---------- coin search ----------
  const searchSeq = useRef(0);
  useEffect(() => {
    if (!isCrypto || asset) return;
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
  }, [query, isCrypto, asset]);

  // ---------- stock search ----------
  const stockSeq = useRef(0);
  useEffect(() => {
    if (isCrypto || stockPicked) return;
    const q = stockQuery.trim();
    if (q.length < 1) {
      setStockHits([]);
      setStockSearching(false);
      return;
    }
    const seq = ++stockSeq.current;
    setStockSearching(true);
    const t = setTimeout(() => {
      searchStocks(q)
        .then((r) => seq === stockSeq.current && setStockHits(r))
        .catch(() => seq === stockSeq.current && setStockHits([]))
        .finally(() => seq === stockSeq.current && setStockSearching(false));
    }, 300);
    return () => clearTimeout(t);
  }, [stockQuery, isCrypto, stockPicked]);

  // Selected stock: company profile (logo, exchange) + live quote; prefill today's price.
  const stockAutoPriced = useRef<string | null>(null);
  useEffect(() => {
    if (isCrypto || !stockPicked || !ticker) return;
    let alive = true;
    const sym = ticker.toUpperCase();
    fetchStockProfiles([sym])
      .then((p) => {
        if (!alive) return;
        const prof = p[sym] ?? null;
        setStockProfile(prof);
        if (prof?.name) setStockName((n) => n || prof.name);
      })
      .catch(() => {});
    const loadQuote = () =>
      fetchStockQuotes([sym])
        .then((q) => {
          if (!alive) return;
          const live = q[sym] ?? null;
          setStockLive(live);
          if (live && !isEdit && stockAutoPriced.current !== sym && Math.abs(Date.now() - ts) < NOW_WINDOW) {
            stockAutoPriced.current = sym;
            setPrice(toInputNumber(live.price));
            setUsdPerQuote(1);
            setPriceSource('Finnhub · latest price');
          }
        })
        .catch(() => {});
    loadQuote();
    const t = setInterval(loadQuote, 60_000);
    return () => {
      alive = false;
      clearInterval(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCrypto, stockPicked, ticker]);

  const pickStock = (h: { symbol: string; name: string }) => {
    setTickerSymbol(h.symbol.toUpperCase());
    setStockName(h.name);
    setStockProfile(null);
    setStockLive(null);
    setStockPicked(true);
    setStockQuery('');
    setStockHits([]);
  };

  const changeStock = () => {
    setStockPicked(false);
    setTickerSymbol('');
    setStockName('');
    setStockProfile(null);
    setStockLive(null);
    stockAutoPriced.current = null;
    setPrice('');
    setPriceSource(null);
  };

  // ---------- price lookup ----------
  const refreshPrice = useCallback(
    async (opts: { exchangeId: string; base: string; quote: string; targetCoinId: string | null; ts: number }) => {
      if (!isCrypto || !asset) return;
      const seq = ++priceSeq.current;
      setPriceLoading(true);
      setPriceNote(null);
      const isNow = Math.abs(Date.now() - opts.ts) < NOW_WINDOW;
      try {
        // Right now on an exchange: use its live ticker.
        const live = tickers.find(
          (t) => t.exchangeId === opts.exchangeId && t.base === opts.base && t.target === opts.quote,
        );
        if (isNow && live?.last) {
          if (seq !== priceSeq.current) return;
          setPrice(toInputNumber(live.last));
          setUsdPerQuote(live.usdPerQuote ?? (USD_LIKE.has(opts.quote) ? 1 : null));
          setPriceSource(`${live.exchange} · live price`);
          return;
        }
        // Right now, global average.
        if (isNow && opts.exchangeId === GLOBAL_EXCHANGE && opts.quote === 'USD') {
          const q = await fetchCryptoQuotes([asset.assetId]);
          if (seq !== priceSeq.current) return;
          const p = q[asset.assetId]?.price;
          if (p) {
            setPrice(toInputNumber(p));
            setUsdPerQuote(1);
            setPriceSource('Global average · live price');
            return;
          }
        }
        // Any other time: exact historical price.
        const r = await fetchPriceAt({
          id: asset.assetId,
          ts: opts.ts,
          exchangeId: opts.exchangeId,
          base: opts.base,
          target: opts.quote,
          targetCoinId: opts.targetCoinId,
        });
        if (seq !== priceSeq.current) return;
        if (r.quote !== opts.quote) {
          // Server could only price it in USD.
          setQuote(r.quote);
        }
        setPrice(toInputNumber(r.price));
        setUsdPerQuote(r.usdPerQuote);
        const where = r.source.kind === 'exchange' ? r.source.exchange : 'Global average';
        const granularity =
          r.source.interval === '1m' ? '1-min candle' : r.source.interval === '1h' ? 'hourly' : r.source.interval === '1d' ? 'daily' : 'hourly';
        setPriceSource(`${where} · ${granularity} ${formatShortDateTime(r.source.at)}`);
        setPriceNote(r.note);
      } catch (e) {
        if (seq !== priceSeq.current) return;
        setPriceSource(null);
        setPriceNote(`${e instanceof Error ? e.message : 'Price unavailable'} You can type the price you paid.`);
      } finally {
        if (seq === priceSeq.current) setPriceLoading(false);
      }
    },
    [isCrypto, asset, tickers],
  );

  // Load exchanges for the coin, preselect the last platform used, then fetch the price.
  const initialisedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!isCrypto || !asset) return;
    let alive = true;
    setTickersLoading(true);
    (async () => {
      let list: Ticker[] = [];
      try {
        list = await fetchTickers(asset.assetId);
      } catch {
        list = [];
      }
      if (!alive) return;
      setTickers(list);
      setTickersLoading(false);
      if (isEdit || initialisedFor.current === asset.assetId) return;
      initialisedFor.current = asset.assetId;

      let exId = GLOBAL_EXCHANGE;
      let exName = 'Global avg.';
      let base = asset.symbol;
      let q = 'USD';
      let tcid: string | null = null;
      try {
        const raw = await getKv(LAST_EXCHANGE_KEY);
        const last = raw ? (JSON.parse(raw) as { id: string; name: string }) : null;
        const pairs = last ? pairsFor(list, last.id) : [];
        if (last && pairs.length) {
          exId = last.id;
          exName = last.name;
          base = pairs[0].base;
          q = pairs[0].target;
          tcid = pairs[0].targetCoinId;
        }
      } catch {
        // ignore
      }
      if (!alive) return;
      setExchangeId(exId);
      setExchangeName(exName);
      setPairBase(base);
      setQuote(q);
      setTargetCoinId(tcid);
      // tickers state isn't updated yet inside this closure; pass the live value directly
      const live = list.find((t) => t.exchangeId === exId && t.base === base && t.target === q);
      if (live?.last) {
        setPrice(toInputNumber(live.last));
        setUsdPerQuote(live.usdPerQuote ?? (USD_LIKE.has(q) ? 1 : null));
        setPriceSource(`${live.exchange} · live price`);
      } else {
        refreshPrice({ exchangeId: exId, base, quote: q, targetCoinId: tcid, ts });
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asset?.assetId, isCrypto]);

  // ---------- pickers ----------
  const exchangeItems: PickerItem[] = useMemo(() => {
    if (!isCrypto) {
      return BROKERS.map((b) => ({ key: b, label: b }));
    }
    return [
      { key: GLOBAL_EXCHANGE, label: 'Global avg.', sublabel: 'Average price across exchanges (CoinGecko)', pinned: true },
      ...exchangesFrom(tickers).map((e) => ({
        key: e.id,
        label: e.name,
        sublabel: e.history ? 'Exact historical price' : undefined,
      })),
    ];
  }, [tickers, isCrypto]);

  const pairItems: PickerItem[] = useMemo(() => {
    if (exchangeId === GLOBAL_EXCHANGE) return [{ key: 'USD', label: `${symbol}/USD` }];
    return pairsFor(tickers, exchangeId).map((t) => ({
      key: `${t.base}/${t.target}`,
      label: `${t.base}/${t.target}`,
      sublabel: t.last ? `Last ${toInputNumber(t.last)} ${t.target}` : undefined,
    }));
  }, [tickers, exchangeId, symbol]);

  const onPickExchange = (item: PickerItem) => {
    setExchangePicker(false);
    if (!isCrypto) {
      const name = item.key.startsWith('custom:') ? item.key.slice(7) : item.label;
      setExchangeName(name);
      setExchangeId('');
      return;
    }
    if (item.key === GLOBAL_EXCHANGE) {
      setExchangeId(GLOBAL_EXCHANGE);
      setExchangeName('Global avg.');
      setPairBase(symbol);
      setQuote('USD');
      setTargetCoinId(null);
      refreshPrice({ exchangeId: GLOBAL_EXCHANGE, base: symbol, quote: 'USD', targetCoinId: null, ts });
      return;
    }
    const pairs = pairsFor(tickers, item.key);
    const first = pairs[0];
    if (!first) return;
    setExchangeId(item.key);
    setExchangeName(item.label);
    setPairBase(first.base);
    setQuote(first.target);
    setTargetCoinId(first.targetCoinId);
    setKv(LAST_EXCHANGE_KEY, JSON.stringify({ id: item.key, name: item.label })).catch(() => {});
    refreshPrice({ exchangeId: item.key, base: first.base, quote: first.target, targetCoinId: first.targetCoinId, ts });
  };

  const onPickPair = (item: PickerItem) => {
    setPairPicker(false);
    if (exchangeId === GLOBAL_EXCHANGE) return;
    const t = pairsFor(tickers, exchangeId).find((p) => `${p.base}/${p.target}` === item.key);
    if (!t) return;
    setPairBase(t.base);
    setQuote(t.target);
    setTargetCoinId(t.targetCoinId);
    refreshPrice({ exchangeId, base: t.base, quote: t.target, targetCoinId: t.targetCoinId, ts });
  };

  const onPickDate = (next: number) => {
    setTs(next);
    if (isCrypto && asset) {
      refreshPrice({ exchangeId, base: pairBase || symbol, quote, targetCoinId, ts: next });
    } else if (!isCrypto) {
      setPriceSource(null);
    }
  };

  const chooseOtherType = () =>
    Alert.alert('Transaction type', undefined, [
      ...OTHER_TYPES.map((t) => ({ text: TYPE_LABELS[t], onPress: () => setType(t) })),
      { text: 'Cancel', style: 'cancel' as const },
    ]);

  // ---------- stock live price ----------
  const useCurrentStockPrice = async () => {
    if (!symbol) return;
    setPriceLoading(true);
    try {
      const q = await fetchStockQuotes([symbol]);
      const p = q[symbol]?.price;
      if (p) {
        setPrice(toInputNumber(p));
        setUsdPerQuote(1);
        setPriceSource('Finnhub · latest price');
      } else {
        Alert.alert('Price unavailable', 'No live price was found for this ticker. Enter it manually.');
      }
    } catch (e) {
      Alert.alert('Price unavailable', e instanceof Error ? e.message : 'Enter the price manually.');
    } finally {
      setPriceLoading(false);
    }
  };

  // ---------- derived ----------
  const qty = parseDecimal(quantity);
  const unitPrice = parseDecimal(price);
  const feeValue = fee.trim() ? parseDecimal(fee) : 0;
  const totalQuote = Number.isFinite(qty) && Number.isFinite(unitPrice) ? qty * unitPrice : NaN;
  const rate = usdPerQuote ?? (USD_LIKE.has(quote) ? 1 : null);

  const held = useMemo(() => {
    if (!symbol) return 0;
    const id = isCrypto ? asset?.assetId : symbol;
    const h = holdings.find((x) => x.category === category && x.assetId === id);
    let q = h?.quantity ?? 0;
    if (editing && editing.type === 'sell' && editing.assetId === id) q += editing.quantity;
    return q;
  }, [holdings, symbol, isCrypto, asset, category, editing]);

  const close = () => {
    if (isEdit) router.back();
    else router.dismissTo('/(tabs)/portfolio');
  };

  // ---------- save ----------
  const handleSave = async () => {
    const assetId = isCrypto ? asset?.assetId : symbol;
    if (!assetId) {
      Alert.alert('Missing asset', isCrypto ? 'Search and select a coin.' : 'Enter a ticker symbol.');
      return;
    }
    if (!isCrypto && !/^[A-Z0-9.\-]{1,12}$/.test(symbol)) {
      Alert.alert('Invalid ticker', 'Use the exchange ticker, e.g. AAPL or SHOP.TO.');
      return;
    }
    if (!Number.isFinite(qty) || qty <= 0) {
      Alert.alert('Invalid amount', 'Enter an amount greater than 0.');
      return;
    }
    const needsPrice = type === 'buy' || type === 'sell';
    if (!Number.isFinite(unitPrice) || unitPrice < 0 || (needsPrice && unitPrice === 0)) {
      Alert.alert('Invalid price', needsPrice ? `Enter the price per coin in ${quote}.` : 'Enter 0 or the value per unit.');
      return;
    }
    if (!Number.isFinite(feeValue) || feeValue < 0) {
      Alert.alert('Invalid fee', 'Enter a fee of 0 or more, or leave it empty.');
      return;
    }

    let usd = rate;
    if (usd === null && isCrypto && asset) {
      try {
        const r = await fetchPriceAt({ id: asset.assetId, ts, exchangeId, base: pairBase || symbol, target: quote, targetCoinId });
        usd = r.usdPerQuote;
      } catch {
        usd = null;
      }
    }
    if (usd === null || !Number.isFinite(usd)) {
      Alert.alert('Conversion unavailable', `Couldn't convert ${quote} to USD for that date. Choose a USD/USDT pair or try again.`);
      return;
    }

    const doSave = async () => {
      setSaving(true);
      try {
        const input = {
          assetId,
          symbol: (isCrypto ? asset!.symbol : symbol).toUpperCase(),
          name: isCrypto ? asset!.name : stockName.trim() || symbol,
          category,
          type,
          quantity: qty,
          priceUsd: unitPrice * (usd as number),
          feeUsd: feeValue * (usd as number),
          exchange: exchangeName === 'Global avg.' ? '' : exchangeName.trim(),
          notes: notes.trim(),
          executedAt: new Date(Math.min(ts, Date.now())).toISOString(),
          exchangeId: isCrypto ? exchangeId : '',
          pair: isCrypto ? pairLabel : '',
          quoteCurrency: quote,
          priceQuote: unitPrice,
          feeQuote: feeValue,
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
        `You currently hold ${formatQty(held)} ${symbol}. Only that amount will be counted as sold.`,
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
        <Text style={styles.rowValue}>This transaction no longer exists.</Text>
        <Pressable onPress={() => router.back()} style={{ marginTop: 12 }}>
          <Text style={styles.link}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  // ---------- coin selection step ----------
  if (isCrypto && !asset) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={12} accessibilityLabel="Back">
            <MaterialCommunityIcons name="arrow-left" size={26} color={Colors.text} />
          </Pressable>
          <Text style={styles.headerTitle}>Select coin</Text>
          <View style={{ width: 26 }} />
        </View>
        <View style={styles.search}>
          <MaterialCommunityIcons name="magnify" size={22} color={Colors.textSecondary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search Bitcoin, ETH, Realio…"
            placeholderTextColor={Colors.textTertiary}
            value={query}
            onChangeText={setQuery}
            autoCorrect={false}
            autoCapitalize="none"
            autoFocus
          />
        </View>
        {searching && <ActivityIndicator style={{ marginTop: 12 }} color={Colors.accent} />}
        {searchError && <Text style={styles.error}>{searchError}</Text>}
        <ScrollView keyboardShouldPersistTaps="handled">
          {results.map((r) => (
            <Pressable
              key={r.id}
              style={({ pressed }) => [styles.resultRow, pressed && { opacity: 0.6 }]}
              onPress={() => {
                setAsset({ assetId: r.id, symbol: r.symbol.toUpperCase(), name: r.name, thumb: r.thumb });
                setPairBase(r.symbol.toUpperCase());
              }}
            >
              {r.thumb ? <Image source={{ uri: r.thumb }} style={styles.thumb} /> : <View style={styles.thumb} />}
              <View style={{ flex: 1 }}>
                <Text style={styles.resultSymbol}>{r.symbol.toUpperCase()}</Text>
                <Text style={styles.resultName} numberOfLines={1}>
                  {r.name}
                </Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={22} color={Colors.textSecondary} />
            </Pressable>
          ))}
          {query.trim().length < 2 ? <Text style={styles.hint}>Type at least 2 letters.</Text> : null}
        </ScrollView>
      </View>
    );
  }

  const isOther = OTHER_TYPES.includes(type);
  const priceLabel =
    type === 'reward' || type === 'airdrop'
      ? `Value in ${quote}`
      : type === 'sell'
        ? `Sell Price in ${quote}`
        : `Buy Price in ${quote}`;

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={{ paddingTop: insets.top }}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={12} accessibilityLabel="Back">
            <MaterialCommunityIcons name="arrow-left" size={26} color={Colors.text} />
          </Pressable>
          <View style={styles.headerCenter}>
            {asset?.thumb ? <Image source={{ uri: asset.thumb }} style={styles.headerLogo} /> : null}
            <Text style={styles.headerTitle} numberOfLines={1}>
              {isCrypto ? asset?.name : stockPicked && (stockName || ticker) ? stockName || ticker : isEdit ? 'Edit stock' : 'Add stock'}
            </Text>
          </View>
          {isCrypto && !isEdit ? (
            <Pressable onPress={() => setAsset(null)} hitSlop={12} accessibilityLabel="Change coin">
              <MaterialCommunityIcons name="swap-horizontal" size={24} color={Colors.textSecondary} />
            </Pressable>
          ) : (
            <View style={{ width: 24 }} />
          )}
        </View>

        {/* Buy / Sell / Other */}
        <View style={styles.segments}>
          {(['buy', 'sell'] as TransactionType[]).map((t) => (
            <Pressable
              key={t}
              onPress={() => setType(t)}
              style={[styles.segment, type === t && styles.segmentOn]}
              accessibilityRole="button"
              accessibilityState={{ selected: type === t }}
            >
              <Text style={[styles.segmentText, type === t && styles.segmentTextOn]}>{TYPE_LABELS[t]}</Text>
            </Pressable>
          ))}
          {isCrypto ? (
            <Pressable
              onPress={chooseOtherType}
              style={[styles.segment, isOther && styles.segmentOn]}
              accessibilityRole="button"
            >
              <Text style={[styles.segmentText, isOther && styles.segmentTextOn]}>
                {isOther ? TYPE_LABELS[type] : 'Other'} ▾
              </Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 120 + insets.bottom }}
        keyboardShouldPersistTaps="handled"
      >
        {!isCrypto && stockPicked ? (
          <View style={styles.stockCard}>
            <AssetBadge symbol={ticker} image={stockProfile?.logo ?? undefined} size={44} />
            <View style={{ flex: 1 }}>
              <Text style={styles.stockSymbol}>
                {ticker}
                {shortExchange(stockProfile?.exchange) ? (
                  <Text style={styles.stockExchange}>  {shortExchange(stockProfile?.exchange)}</Text>
                ) : null}
              </Text>
              <Text style={styles.stockName} numberOfLines={1}>
                {stockName || stockProfile?.name || ' '}
              </Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.stockPrice}>{stockLive ? formatUsd(stockLive.price) : '—'}</Text>
              {stockLive?.change24h != null ? (
                <Text style={[styles.stockChange, { color: stockLive.change24h >= 0 ? Colors.green : Colors.red }]}>
                  {formatPct(stockLive.change24h)}
                </Text>
              ) : null}
            </View>
            {!isEdit ? (
              <Pressable onPress={changeStock} hitSlop={10} style={{ marginLeft: 10 }} accessibilityLabel="Change stock">
                <MaterialCommunityIcons name="swap-horizontal" size={22} color={Colors.textSecondary} />
              </Pressable>
            ) : null}
          </View>
        ) : null}

        {!isCrypto && !stockPicked ? (
          <View style={{ marginTop: 8 }}>
            <View style={[styles.search, { marginHorizontal: 0 }]}>
              <MaterialCommunityIcons name="magnify" size={20} color={Colors.textSecondary} style={{ marginRight: 8 }} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search stock · Apple, TSLA, SPY…"
                placeholderTextColor={Colors.textTertiary}
                value={stockQuery}
                onChangeText={setStockQuery}
                autoCorrect={false}
                autoCapitalize="none"
                autoFocus
                returnKeyType="search"
              />
              {stockSearching ? <ActivityIndicator size="small" color={Colors.accent} /> : null}
            </View>
            {stockHits.map((h) => (
              <Pressable
                key={h.symbol}
                style={({ pressed }) => [styles.resultRow, pressed && { opacity: 0.6 }]}
                onPress={() => pickStock(h)}
                accessibilityRole="button"
              >
                <AssetBadge symbol={h.symbol} size={32} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.resultSymbol}>{h.symbol}</Text>
                  <Text style={styles.resultName} numberOfLines={1}>
                    {h.name}
                    {h.type && h.type !== 'Common Stock' ? ` · ${h.type}` : ''}
                  </Text>
                </View>
              </Pressable>
            ))}
            {stockQuery.trim().length >= 1 && !stockSearching && stockHits.length === 0 ? (
              <Pressable
                style={styles.resultRow}
                onPress={() => /^[A-Za-z0-9.\-]{1,12}$/.test(stockQuery.trim()) && pickStock({ symbol: stockQuery.trim(), name: '' })}
              >
                <Text style={styles.resultName}>
                  No match. Tap to use “{stockQuery.trim().toUpperCase()}” as the ticker.
                </Text>
              </Pressable>
            ) : null}
            {stockQuery.trim().length === 0 ? (
              <Text style={styles.hint}>Search US stocks & ETFs by name or ticker.</Text>
            ) : null}
          </View>
        ) : null}

        <Row
          label={isCrypto ? 'Exchange' : 'Platform'}
          value={exchangeName || (isCrypto ? 'Global avg.' : 'Choose your broker')}
          onPress={() => setExchangePicker(true)}
          right={
            tickersLoading ? <ActivityIndicator color={Colors.accent} /> : undefined
          }
        />

        {isCrypto ? (
          <Row
            label="Trading Pair"
            value={pairLabel}
            onPress={exchangeId === GLOBAL_EXCHANGE ? undefined : () => setPairPicker(true)}
          />
        ) : null}

        <Row label="Date & time" value={formatTradeDate(ts)} onPress={() => setDateSheet(true)} />

        {/* Price */}
        <View style={styles.inputRow}>
          <Text style={styles.rowLabel}>{priceLabel}</Text>
          <View style={styles.inputLine}>
            <TextInput
              style={[styles.input, { flex: 1 }]}
              placeholder="0.00"
              placeholderTextColor={Colors.textTertiary}
              value={price}
              onChangeText={(v) => {
                setPrice(v);
                setPriceSource('Entered manually');
              }}
              keyboardType="decimal-pad"
            />
            {priceLoading ? (
              <ActivityIndicator color={Colors.accent} />
            ) : isCrypto ? (
              <Pressable
                onPress={() => refreshPrice({ exchangeId, base: pairBase || symbol, quote, targetCoinId, ts })}
                hitSlop={10}
                accessibilityLabel="Refresh price"
              >
                <MaterialCommunityIcons name="refresh" size={22} color={Colors.accent} />
              </Pressable>
            ) : stockQuotesAvailable() && Math.abs(Date.now() - ts) < NOW_WINDOW && symbol ? (
              <Pressable onPress={useCurrentStockPrice} hitSlop={10}>
                <Text style={styles.link}>Current price</Text>
              </Pressable>
            ) : null}
            <Text style={styles.perCoin}>per {isCrypto ? 'coin' : 'share'}</Text>
          </View>
          {priceSource ? <Text style={styles.source}>{priceSource}</Text> : null}
          {priceNote ? <Text style={styles.note}>{priceNote}</Text> : null}
          {!isCrypto && Math.abs(Date.now() - ts) >= NOW_WINDOW ? (
            <Text style={styles.source}>Enter the price you paid on that date.</Text>
          ) : null}
        </View>

        {/* Amount */}
        <View style={styles.inputRow}>
          <Text style={styles.rowLabel}>{type === 'sell' ? 'Amount Sold' : type === 'buy' ? 'Amount Bought' : 'Amount'}</Text>
          <TextInput
            style={styles.input}
            placeholder="0"
            placeholderTextColor={Colors.textTertiary}
            value={quantity}
            onChangeText={setQuantity}
            keyboardType="decimal-pad"
          />
          {type === 'sell' && symbol ? (
            <Text style={styles.source}>
              You hold {formatQty(held)} {symbol}.
            </Text>
          ) : null}
        </View>

        {/* Fee */}
        <View style={styles.inputRow}>
          <Text style={styles.rowLabel}>Exchange/Transaction Fee ({quote})</Text>
          <TextInput
            style={styles.input}
            placeholder="0"
            placeholderTextColor={Colors.textTertiary}
            value={fee}
            onChangeText={setFee}
            keyboardType="decimal-pad"
          />
        </View>

        {/* Notes */}
        <View style={styles.inputRow}>
          <Text style={styles.rowLabel}>Notes</Text>
          <TextInput
            style={[styles.input, { minHeight: 44 }]}
            placeholder="Optional"
            placeholderTextColor={Colors.textTertiary}
            value={notes}
            onChangeText={setNotes}
            multiline
            maxLength={500}
          />
        </View>

        {Number.isFinite(totalQuote) && totalQuote > 0 ? (
          <View style={styles.summary}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Total</Text>
              <Text style={styles.summaryValue}>
                {toInputNumber(totalQuote + (type === 'sell' ? -(feeValue || 0) : feeValue || 0))} {quote}
              </Text>
            </View>
            {rate !== null && !USD_LIKE.has(quote) ? (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>≈ USD</Text>
                <Text style={styles.summaryValue}>{formatUsd(totalQuote * rate)}</Text>
              </View>
            ) : null}
          </View>
        ) : null}
      </ScrollView>

      <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <Pressable
          style={({ pressed }) => [styles.submit, (saving || pressed) && { opacity: 0.8 }]}
          onPress={handleSave}
          disabled={saving}
          accessibilityRole="button"
        >
          {saving ? (
            <ActivityIndicator color={Colors.background} />
          ) : (
            <Text style={styles.submitText}>{isEdit ? 'Save Transaction' : 'Add Transaction'}</Text>
          )}
        </Pressable>
      </View>

      <PickerModal
        visible={exchangePicker}
        title={isCrypto ? 'Change exchange' : 'Choose platform'}
        searchPlaceholder={isCrypto ? 'Search Exchange' : 'Search platform'}
        items={exchangeItems}
        selectedKey={isCrypto ? exchangeId : exchangeName}
        alphabetical
        allowCustom={!isCrypto}
        emptyText={
          isCrypto
            ? tickersLoading
              ? 'Loading exchanges…'
              : 'No exchange found for this coin. Use Global avg.'
            : 'No platform found'
        }
        onSelect={onPickExchange}
        onClose={() => setExchangePicker(false)}
      />
      <PickerModal
        visible={pairPicker}
        title="Change trading pair"
        searchPlaceholder="Search Trading Pair"
        items={pairItems}
        selectedKey={`${pairBase}/${quote}`}
        onSelect={onPickPair}
        onClose={() => setPairPicker(false)}
      />
      <DateTimeSheet visible={dateSheet} value={ts} onChange={onPickDate} onClose={() => setDateSheet(false)} />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingTop: 10, paddingBottom: 14 },
  headerCenter: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  headerLogo: { width: 28, height: 28, borderRadius: 14 },
  headerTitle: { color: Colors.text, fontSize: 22, fontWeight: '800', flexShrink: 1, textAlign: 'center' },

  segments: { flexDirection: 'row', gap: 10, paddingHorizontal: 18, paddingBottom: 6 },
  segment: {
    flex: 1,
    height: 48,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentOn: { borderColor: Colors.accent, backgroundColor: 'rgba(0,217,100,0.12)' },
  segmentText: { color: Colors.textSecondary, fontSize: 16, fontWeight: '700' },
  segmentTextOn: { color: Colors.text },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.18)',
  },
  rowLabel: { color: Colors.textSecondary, fontSize: 13, marginBottom: 3 },
  rowValue: { color: Colors.text, fontSize: 18 },

  inputRow: {
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.18)',
  },
  inputLine: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  input: { color: Colors.text, fontSize: 18, paddingVertical: 4 },
  perCoin: { color: Colors.text, fontSize: 15, fontWeight: '700' },
  source: { color: Colors.textTertiary, fontSize: 12, marginTop: 4 },
  note: { color: Colors.orange, fontSize: 12, marginTop: 4, lineHeight: 17 },
  link: { color: Colors.accent, fontSize: 14, fontWeight: '700' },

  summary: {
    marginTop: 18,
    padding: 14,
    borderRadius: 14,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    gap: 6,
  },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between' },
  summaryLabel: { color: Colors.textSecondary, fontSize: 15 },
  summaryValue: { color: Colors.text, fontSize: 16, fontWeight: '800' },

  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 18,
    paddingTop: 10,
    backgroundColor: 'rgba(0,0,0,0.94)',
  },
  submit: { height: 56, borderRadius: 12, backgroundColor: Colors.accent, alignItems: 'center', justifyContent: 'center' },
  submitText: { color: Colors.background, fontSize: 18, fontWeight: '800' },

  stockCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    padding: 14,
    borderRadius: 14,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  stockSymbol: { color: Colors.text, fontSize: 18, fontWeight: '800' },
  stockExchange: { color: Colors.textTertiary, fontSize: 12, fontWeight: '700' },
  stockName: { color: Colors.textSecondary, fontSize: 13, marginTop: 2 },
  stockPrice: { color: Colors.text, fontSize: 16, fontWeight: '700' },
  stockChange: { fontSize: 13, fontWeight: '700', marginTop: 2 },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginBottom: 8,
    paddingHorizontal: 12,
    height: 46,
    borderRadius: 12,
    backgroundColor: '#1C1C22',
  },
  searchInput: { flex: 1, color: Colors.text, fontSize: 17 },
  error: { color: Colors.red, textAlign: 'center', marginTop: 8 },
  hint: { color: Colors.textTertiary, textAlign: 'center', marginTop: 24 },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderLight,
  },
  thumb: { width: 32, height: 32, borderRadius: 16, marginRight: 12, backgroundColor: 'rgba(255,255,255,0.06)' },
  resultSymbol: { color: Colors.text, fontSize: 16, fontWeight: '700' },
  resultName: { color: Colors.textSecondary, fontSize: 13, marginTop: 2 },
});
