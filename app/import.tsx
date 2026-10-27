import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors } from '@/constants/Colors';
import { parseImport, type ParsedImport } from '@/lib/csvImport';
import { formatNumber } from '@/lib/format';
import { buildTransactions, resolveAssets, type AssetResolution } from '@/services/importService';
import { usePortfolioStore } from '@/store/portfolioStore';

type Phase = 'pick' | 'reading' | 'review' | 'importing' | 'done';

const TYPE_NAMES: Record<string, string> = {
  buy: 'Buys',
  sell: 'Sells',
  reward: 'Rewards / staking',
  airdrop: 'Airdrops',
  transfer_in: 'Deposits',
  transfer_out: 'Withdrawals',
};

export default function ImportScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const transactions = usePortfolioStore((s) => s.transactions);
  const addMany = usePortfolioStore((s) => s.addMany);

  const [phase, setPhase] = useState<Phase>('pick');
  const [fileName, setFileName] = useState('');
  const [parsed, setParsed] = useState<ParsedImport | null>(null);
  const [assets, setAssets] = useState<AssetResolution[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    imported: number;
    duplicates: number;
    unresolved: number;
    unconverted: number;
    skipped: number;
  } | null>(null);

  const pickFile = async () => {
    setError(null);
    const res = await DocumentPicker.getDocumentAsync({
      type: ['text/csv', 'text/comma-separated-values', 'public.comma-separated-values-text', 'text/plain', '*/*'],
      copyToCacheDirectory: true,
      multiple: false,
    });
    if (res.canceled || !res.assets?.[0]) return;
    const file = res.assets[0];
    setFileName(file.name);
    setPhase('reading');
    try {
      const text = await new File(file.uri).text();
      const p = parseImport(text);
      if (p.drafts.length === 0) throw new Error('No transactions found in this file.');
      setParsed(p);
      setAssets(await resolveAssets(p.drafts));
      setPhase('review');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not read the file.');
      setPhase('pick');
    }
  };

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const d of parsed?.drafts ?? []) m.set(d.type, (m.get(d.type) ?? 0) + 1);
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
  }, [parsed]);

  const skippedReasons = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of parsed?.skipped ?? []) m.set(s.reason, (m.get(s.reason) ?? 0) + 1);
    return Array.from(m.entries());
  }, [parsed]);

  const unresolvedRows = assets.filter((a) => !a.assetId).reduce((s, a) => s + a.rows, 0);
  const importable = (parsed?.drafts.length ?? 0) - unresolvedRows;

  const runImport = async () => {
    if (!parsed) return;
    setPhase('importing');
    setError(null);
    try {
      const built = await buildTransactions(parsed.drafts, assets, transactions);
      if (built.inputs.length) await addMany(built.inputs);
      setResult({
        imported: built.inputs.length,
        duplicates: built.duplicates,
        unresolved: built.unresolved,
        unconverted: built.unconverted.length,
        skipped: parsed.skipped.length,
      });
      setPhase('done');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Import failed.');
      setPhase('review');
    }
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityLabel="Close">
          <MaterialCommunityIcons name="close" size={26} color={Colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Import CSV</Text>
        <View style={{ width: 26 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 140 + insets.bottom }}>
        {phase === 'pick' || phase === 'reading' ? (
          <View style={styles.hero}>
            <MaterialCommunityIcons name="file-upload-outline" size={56} color={Colors.accent} />
            <Text style={styles.heroTitle}>Bring your history</Text>
            <Text style={styles.heroText}>
              Import a CSV exported from Delta (Settings → Export portfolio). Buys, sells, staking rewards, airdrops,
              deposits and withdrawals are converted to USD using the rate of each transaction’s date.
            </Text>
            {phase === 'reading' ? (
              <View style={styles.readingRow}>
                <ActivityIndicator color={Colors.accent} />
                <Text style={styles.muted}>Reading {fileName} and matching assets…</Text>
              </View>
            ) : null}
            {error ? <Text style={styles.error}>{error}</Text> : null}
          </View>
        ) : null}

        {(phase === 'review' || phase === 'importing') && parsed ? (
          <>
            <Text style={styles.fileName}>{fileName}</Text>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>{formatNumber(parsed.drafts.length, 0, 0)} transactions found</Text>
              {counts.map(([t, n]) => (
                <View key={t} style={styles.line}>
                  <Text style={styles.lineLabel}>{TYPE_NAMES[t] ?? t}</Text>
                  <Text style={styles.lineValue}>{formatNumber(n, 0, 0)}</Text>
                </View>
              ))}
              {skippedReasons.map(([reason, n]) => (
                <View key={reason} style={styles.line}>
                  <Text style={[styles.lineLabel, { color: Colors.textTertiary }]}>Skipped · {reason}</Text>
                  <Text style={[styles.lineValue, { color: Colors.textTertiary }]}>{n}</Text>
                </View>
              ))}
            </View>

            <Text style={styles.section}>Assets ({assets.length})</Text>
            <View style={[styles.card, { paddingVertical: 4 }]}>
              {assets.map((a, i) => (
                <View key={a.assetKey} style={[styles.assetRow, i < assets.length - 1 && styles.divider]}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.assetSymbol}>
                      {a.rawSymbol}
                      <Text style={styles.assetRows}>  {a.rows} rows</Text>
                    </Text>
                    <Text style={styles.assetName} numberOfLines={1}>
                      {a.name}
                      {a.assetId && a.category === 'crypto' && a.resolvedName && a.resolvedName !== a.name
                        ? ` → ${a.resolvedName}`
                        : ''}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.chip,
                      {
                        backgroundColor: !a.assetId
                          ? 'rgba(255,68,68,0.15)'
                          : a.confidence === 'low'
                            ? 'rgba(255,170,0,0.15)'
                            : 'rgba(0,217,100,0.14)',
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        { color: !a.assetId ? Colors.red : a.confidence === 'low' ? Colors.orange : Colors.green },
                      ]}
                    >
                      {!a.assetId ? 'Not found' : a.category === 'stock' ? 'Stock/ETF' : a.confidence === 'low' ? 'Check' : 'Matched'}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
            {unresolvedRows > 0 ? (
              <Text style={styles.note}>
                {unresolvedRows} rows for assets not found on CoinGecko will be skipped.
              </Text>
            ) : null}
            {assets.some((a) => a.confidence === 'low') ? (
              <Text style={styles.note}>“Check” = matched by ticker only; verify the asset after import.</Text>
            ) : null}
            {assets.some((a) => a.category === 'stock' && /\.[A-Z]+$/.test(a.assetId ?? '')) ? (
              <Text style={styles.note}>
                Non-US listings (e.g. .TO) are imported, but live prices are only available for US stocks for now.
              </Text>
            ) : null}
            {error ? <Text style={styles.error}>{error}</Text> : null}
          </>
        ) : null}

        {phase === 'done' && result ? (
          <View style={styles.hero}>
            <MaterialCommunityIcons name="check-circle-outline" size={60} color={Colors.green} />
            <Text style={styles.heroTitle}>{formatNumber(result.imported, 0, 0)} transactions imported</Text>
            {result.duplicates ? <Text style={styles.muted}>{result.duplicates} already in Omega, skipped.</Text> : null}
            {result.unresolved ? <Text style={styles.muted}>{result.unresolved} for unknown assets, skipped.</Text> : null}
            {result.unconverted ? (
              <Text style={styles.muted}>{result.unconverted} without a USD rate for their date, skipped.</Text>
            ) : null}
            {result.skipped ? <Text style={styles.muted}>{result.skipped} lines not applicable (cash, internal moves).</Text> : null}
          </View>
        ) : null}
      </ScrollView>

      <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        {phase === 'pick' || phase === 'reading' ? (
          <Pressable style={[styles.submit, phase === 'reading' && { opacity: 0.5 }]} onPress={pickFile} disabled={phase === 'reading'}>
            <Text style={styles.submitText}>Choose CSV file</Text>
          </Pressable>
        ) : phase === 'review' || phase === 'importing' ? (
          <Pressable
            style={[styles.submit, (phase === 'importing' || importable <= 0) && { opacity: 0.5 }]}
            onPress={runImport}
            disabled={phase === 'importing' || importable <= 0}
          >
            {phase === 'importing' ? (
              <ActivityIndicator color={Colors.background} />
            ) : (
              <Text style={styles.submitText}>Import {formatNumber(importable, 0, 0)} transactions</Text>
            )}
          </Pressable>
        ) : (
          <Pressable
            style={styles.submit}
            onPress={() => {
              router.back();
              router.navigate('/(tabs)/portfolio');
            }}
          >
            <Text style={styles.submitText}>View portfolio</Text>
          </Pressable>
        )}
        {phase === 'importing' ? (
          <Text style={styles.progress}>Converting historical prices to USD… this can take a few seconds.</Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingVertical: 12 },
  headerTitle: { flex: 1, textAlign: 'center', color: Colors.text, fontSize: 20, fontWeight: '800' },
  hero: { alignItems: 'center', paddingTop: 40, paddingHorizontal: 8, gap: 10 },
  heroTitle: { color: Colors.text, fontSize: 22, fontWeight: '800', textAlign: 'center', marginTop: 6 },
  heroText: { color: Colors.textSecondary, fontSize: 15, lineHeight: 21, textAlign: 'center' },
  readingRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 16 },
  muted: { color: Colors.textSecondary, fontSize: 14, textAlign: 'center' },
  error: { color: Colors.red, fontSize: 14, textAlign: 'center', marginTop: 12 },
  fileName: { color: Colors.textTertiary, fontSize: 13, marginBottom: 10 },
  card: { backgroundColor: Colors.card, borderRadius: 16, padding: 16 },
  cardTitle: { color: Colors.text, fontSize: 18, fontWeight: '800', marginBottom: 8 },
  line: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5 },
  lineLabel: { color: Colors.textSecondary, fontSize: 14, flexShrink: 1, marginRight: 12 },
  lineValue: { color: Colors.text, fontSize: 14, fontWeight: '700' },
  section: { color: Colors.text, fontSize: 18, fontWeight: '800', marginTop: 22, marginBottom: 10 },
  assetRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 11 },
  divider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.borderLight },
  assetSymbol: { color: Colors.text, fontSize: 16, fontWeight: '700' },
  assetRows: { color: Colors.textTertiary, fontSize: 12, fontWeight: '600' },
  assetName: { color: Colors.textSecondary, fontSize: 13, marginTop: 2 },
  chip: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 8, marginLeft: 10 },
  chipText: { fontSize: 12, fontWeight: '800' },
  note: { color: Colors.textTertiary, fontSize: 12, marginTop: 10, lineHeight: 17 },
  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 18,
    paddingTop: 12,
    backgroundColor: Colors.background,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.borderLight,
  },
  submit: { height: 56, borderRadius: 12, backgroundColor: Colors.accent, alignItems: 'center', justifyContent: 'center' },
  submitText: { color: Colors.background, fontSize: 18, fontWeight: '800' },
  progress: { color: Colors.textTertiary, fontSize: 12, textAlign: 'center', marginTop: 8 },
});
