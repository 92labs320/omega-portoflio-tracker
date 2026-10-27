import { Config } from '@/constants/Config';
import { txFingerprint, type DraftTx } from '@/lib/csvImport';
import type { Transaction, TransactionInput } from '@/lib/types';

async function postJson<T>(path: string, body: unknown, timeoutMs = 60_000): Promise<T> {
  if (!Config.apiUrl) throw new Error('Import needs the Omega service.');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${Config.apiUrl}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) {
      const err = (await res.json().catch(() => null)) as { error?: string } | null;
      throw new Error(err?.error ?? `Service error (${res.status})`);
    }
    return (await res.json()) as T;
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') throw new Error('The service took too long. Try again.');
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

export interface AssetResolution {
  assetKey: string;
  category: 'crypto' | 'stock';
  rawSymbol: string;
  name: string;
  rows: number;
  /** CoinGecko id (crypto) or ticker (stock); null = not found → rows skipped. */
  assetId: string | null;
  resolvedName: string | null;
  confidence: 'high' | 'low' | 'stock' | 'none';
}

/** One entry per distinct asset in the file, crypto mapped to CoinGecko ids. */
export async function resolveAssets(drafts: DraftTx[]): Promise<AssetResolution[]> {
  const groups = new Map<string, AssetResolution>();
  for (const d of drafts) {
    const g = groups.get(d.assetKey);
    if (g) g.rows++;
    else
      groups.set(d.assetKey, {
        assetKey: d.assetKey,
        category: d.category,
        rawSymbol: d.rawSymbol,
        name: d.name,
        rows: 1,
        assetId: d.category === 'stock' ? d.symbol : null,
        resolvedName: d.category === 'stock' ? d.name : null,
        confidence: d.category === 'stock' ? 'stock' : 'none',
      });
  }
  const crypto = Array.from(groups.values()).filter((g) => g.category === 'crypto');
  if (crypto.length) {
    const { matches } = await postJson<{
      matches: ({ id: string; name: string; confidence: 'high' | 'low' } | null)[];
    }>('/api/search', { assets: crypto.map((g) => ({ symbol: g.rawSymbol, name: g.name })) });
    crypto.forEach((g, i) => {
      const m = matches[i];
      if (m) {
        g.assetId = m.id;
        g.resolvedName = m.name;
        g.confidence = m.confidence;
      }
    });
  }
  return Array.from(groups.values()).sort((a, b) => b.rows - a.rows);
}

export interface BuildResult {
  inputs: TransactionInput[];
  duplicates: number;
  unresolved: number;
  unconverted: { line: number; currency: string }[];
}

/** Converts drafts to transactions in USD (historical rates for non-USD prices). */
export async function buildTransactions(
  drafts: DraftTx[],
  assets: AssetResolution[],
  existing: Transaction[],
): Promise<BuildResult> {
  const byKey = new Map(assets.map((a) => [a.assetKey, a]));
  const seen = new Set(existing.filter((t) => !t.deleted).map(txFingerprint));

  const ready: { d: DraftTx; a: AssetResolution }[] = [];
  let unresolved = 0;
  let duplicates = 0;
  for (const d of drafts) {
    const a = byKey.get(d.assetKey);
    if (!a?.assetId) {
      unresolved++;
      continue;
    }
    const fp = txFingerprint({ category: d.category, assetId: a.assetId, type: d.type, quantity: d.quantity, executedAt: d.executedAt });
    if (seen.has(fp)) {
      duplicates++;
      continue;
    }
    seen.add(fp);
    ready.push({ d, a });
  }

  // One batch request for every currency/date we need in USD.
  const needs: { currency: string; ts: number }[] = [];
  const idx = (currency: string, ts: number) => {
    needs.push({ currency, ts });
    return needs.length - 1;
  };
  const plan = ready.map(({ d }) => ({
    price: d.quoteAmount > 0 ? idx(d.quoteCurrency, Date.parse(d.executedAt)) : -1,
    fee: d.feeAmount > 0 ? idx(d.feeCurrency === d.rawSymbol.toUpperCase() ? 'USD' : d.feeCurrency, Date.parse(d.executedAt)) : -1,
  }));
  const usd: (number | null)[] = needs.length
    ? (await postJson<{ usd: (number | null)[] }>('/api/price-at', { quotes: needs }, 120_000)).usd
    : [];

  const inputs: TransactionInput[] = [];
  const unconverted: { line: number; currency: string }[] = [];
  ready.forEach(({ d, a }, i) => {
    const p = plan[i];
    const rate = p.price >= 0 ? usd[p.price] : 1;
    if (rate == null) {
      unconverted.push({ line: d.line, currency: d.quoteCurrency });
      return;
    }
    const priceQuote = d.quantity > 0 ? d.quoteAmount / d.quantity : 0;
    let feeUsd = 0;
    if (p.fee >= 0) {
      const fr = usd[p.fee];
      // Fee paid in the asset itself: value it at the trade price.
      feeUsd = d.feeCurrency === d.rawSymbol.toUpperCase() ? d.feeAmount * priceQuote * rate : fr != null ? d.feeAmount * fr : 0;
    }
    inputs.push({
      assetId: a.assetId as string,
      symbol: d.symbol,
      name: a.resolvedName || d.name,
      category: d.category,
      type: d.type,
      quantity: d.quantity,
      priceUsd: priceQuote * rate,
      feeUsd,
      exchange: d.exchange,
      notes: d.notes,
      executedAt: d.executedAt,
      exchangeId: d.exchangeId,
      pair: d.quoteAmount > 0 ? `${d.symbol}/${d.quoteCurrency}` : '',
      quoteCurrency: d.quoteAmount > 0 ? d.quoteCurrency : 'USD',
      priceQuote: d.quoteAmount > 0 ? priceQuote : null,
      feeQuote: d.feeAmount > 0 ? d.feeAmount : null,
    });
  });

  return { inputs, duplicates, unresolved, unconverted };
}
