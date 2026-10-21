import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LineChart } from 'react-native-gifted-charts';
import { Colors } from '@/constants/Colors';
import { usePortfolioStore } from '@/store/portfolioStore';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const CHART_HEIGHT = 180;
const CHART_H_PAD = 16;

const PERIODS = ['1H', '1D', '1W', '1M', 'YTD', '1Y', 'ALL'] as const;
type Period = typeof PERIODS[number];

const ASSET_PALETTE = [
  '#00D964', '#00A3FF', '#FFA500', '#9B59B6',
  '#1ABC9C', '#E67E22', '#E91E63', '#3498DB',
];

function assetColor(symbol: string): string {
  let h = 0;
  for (let i = 0; i < symbol.length; i++) h = (h * 31 + symbol.charCodeAt(i)) % ASSET_PALETTE.length;
  return ASSET_PALETTE[h];
}

function initials(symbol: string): string {
  return symbol.slice(0, 2).toUpperCase();
}

function mockChartData(base: number, n = 40): Array<{ value: number }> {
  const pts: Array<{ value: number }> = [];
  let cur = base * (0.82 + Math.random() * 0.1);
  for (let i = 0; i < n - 1; i++) {
    cur += (Math.random() - 0.45) * base * 0.025;
    cur = Math.max(cur, base * 0.5);
    pts.push({ value: parseFloat(cur.toFixed(2)) });
  }
  pts.push({ value: parseFloat(base.toFixed(2)) });
  return pts;
}

function fmtUsd(v: number): string {
  return v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function PortfolioScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { holdings, totalValue, totalCost } = usePortfolioStore();

  const [period, setPeriod] = useState<Period>('1D');
  const [assetFilter, setAssetFilter] = useState<'Crypto' | 'Funds'>('Crypto');
  const [refreshing, setRefreshing] = useState(false);

  const pnl = totalValue - totalCost;
  const pnlPct = totalCost > 0 ? (pnl / totalCost) * 100 : 0;
  const gain = pnl >= 0;
  const pnlColor = gain ? Colors.green : Colors.red;
  const pnlBg = gain ? 'rgba(0,217,100,0.15)' : 'rgba(255,68,68,0.15)';

  const chartData = useMemo(
    () => mockChartData(totalValue > 0 ? totalValue : 12500),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [totalValue, period],
  );

  const chartMin = Math.min(...chartData.map((d) => d.value));
  const chartMax = Math.max(...chartData.map((d) => d.value));

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 900);
  }, []);

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.iconBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <MaterialCommunityIcons name="menu" size={24} color={Colors.text} />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>Portfolios</Text>

        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.iconBtn} hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}>
            <MaterialCommunityIcons name="briefcase-outline" size={22} color={Colors.text} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconBtn} hitSlop={{ top: 8, bottom: 8, left: 4, right: 8 }}>
            <MaterialCommunityIcons name="magnify" size={24} color={Colors.text} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.accent} />
        }
      >
        {/* ── Portfolio tabs (pill style) ── */}
        <View style={styles.tabsWrap}>
          <View style={styles.tabPill}>
            <TouchableOpacity style={styles.tabActive}>
              <Text style={styles.tabActiveText}>Main Portfolio</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.tabInactive}>
              <Text style={styles.tabInactiveText}>+ New</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Sub-filter pills ── */}
        <View style={styles.filterRow}>
          {(['Crypto', 'Funds'] as const).map((f) => (
            <TouchableOpacity
              key={f}
              style={[styles.filterPill, assetFilter === f && styles.filterPillOn]}
              onPress={() => setAssetFilter(f)}
            >
              <Text style={[styles.filterPillText, assetFilter === f && styles.filterPillTextOn]}>
                {f}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Total Worth ── */}
        <View style={styles.worthSection}>
          <Text style={styles.worthLabel}>TOTAL WORTH</Text>

          <View style={styles.worthRow}>
            <Text style={styles.worthValue}>${fmtUsd(totalValue)}</Text>
            <Text style={styles.worthCurrency}>USD</Text>
            <TouchableOpacity onPress={onRefresh} style={styles.refreshIcon}>
              <MaterialCommunityIcons name="refresh" size={18} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <View style={styles.pnlRow}>
            <Text style={[styles.pnlAbs, { color: pnlColor }]}>
              {gain ? '+' : '-'}${fmtUsd(Math.abs(pnl))}
            </Text>
            <View style={[styles.badge, { backgroundColor: pnlBg }]}>
              <Text style={[styles.badgeText, { color: pnlColor }]}>
                {gain ? '+' : ''}{pnlPct.toFixed(2)}%
              </Text>
            </View>
          </View>
        </View>

        {/* ── Line Chart ── */}
        <View style={styles.chartWrap}>
          <LineChart
            data={chartData}
            areaChart
            curved
            hideDataPoints
            color={Colors.green}
            thickness={2}
            startFillColor={Colors.green}
            endFillColor={Colors.background}
            startOpacity={0.4}
            endOpacity={0}
            width={SCREEN_WIDTH - CHART_H_PAD * 2}
            height={CHART_HEIGHT}
            hideAxesAndRules
            xAxisColor="transparent"
            yAxisColor="transparent"
            yAxisThickness={0}
            xAxisThickness={0}
            rulesColor="transparent"
            hideYAxisText
            noOfSections={4}
            initialSpacing={0}
            endSpacing={0}
            showReferenceLine1
            referenceLine1Position={chartMax}
            referenceLine1Config={{
              color: 'rgba(255,255,255,0.18)',
              dashWidth: 5,
              dashGap: 5,
              type: 'dashed',
              labelText: `$${Math.round(chartMax).toLocaleString()}`,
              labelTextStyle: { color: Colors.textSecondary, fontSize: 10 },
            }}
            showReferenceLine2
            referenceLine2Position={chartMin}
            referenceLine2Config={{
              color: 'rgba(255,255,255,0.18)',
              dashWidth: 5,
              dashGap: 5,
              type: 'dashed',
              labelText: `$${Math.round(chartMin).toLocaleString()}`,
              labelTextStyle: { color: Colors.textSecondary, fontSize: 10 },
            }}
          />
        </View>

        {/* ── Period selector ── */}
        <View style={styles.periodRow}>
          {PERIODS.map((p) => (
            <TouchableOpacity
              key={p}
              style={[styles.periodBtn, period === p && styles.periodBtnOn]}
              onPress={() => setPeriod(p)}
            >
              <Text style={[styles.periodText, period === p && styles.periodTextOn]}>{p}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Holdings toolbar ── */}
        <View style={styles.toolbar}>
          <TouchableOpacity style={styles.toolbarFilter}>
            <MaterialCommunityIcons name="filter-variant" size={20} color={Colors.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.toolbarSort}>
            <Text style={styles.toolbarSortText}>Highest Holdings</Text>
            <MaterialCommunityIcons name="chevron-down" size={16} color={Colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* ── Holdings list ── */}
        {holdings.length > 0 ? (
          <View style={styles.holdingsList}>
            {holdings.map((h, idx) => {
              const val = h.quantity * h.currentPrice;
              const cost = h.quantity * h.avgCostUsd;
              const rowPnl = val - cost;
              const rowPct = cost > 0 ? (rowPnl / cost) * 100 : 0;
              const pos = rowPnl >= 0;
              const rowColor = pos ? Colors.green : Colors.red;
              const rowBg = pos ? 'rgba(0,217,100,0.15)' : 'rgba(255,68,68,0.15)';
              const ac = assetColor(h.symbol);

              return (
                <TouchableOpacity
                  key={h.assetId}
                  style={[
                    styles.holdingRow,
                    idx < holdings.length - 1 && styles.holdingDivider,
                  ]}
                  activeOpacity={0.7}
                >
                  {/* Left */}
                  <View style={styles.holdingLeft}>
                    <View style={[styles.circle, { backgroundColor: ac + '26' }]}>
                      <Text style={[styles.circleText, { color: ac }]}>{initials(h.symbol)}</Text>
                    </View>
                    <View style={styles.assetMeta}>
                      <Text style={styles.assetSymbol}>{h.symbol.toUpperCase()}</Text>
                      <Text style={styles.assetSub} numberOfLines={1}>
                        {h.quantity.toFixed(4)} · ${h.currentPrice.toFixed(2)}
                      </Text>
                    </View>
                  </View>

                  {/* Right */}
                  <View style={styles.holdingRight}>
                    <Text style={styles.holdingVal}>${fmtUsd(val)}</Text>
                    <Text style={[styles.holdingPnl, { color: rowColor }]}>
                      {pos ? '+' : '-'}${fmtUsd(Math.abs(rowPnl))}
                    </Text>
                    <View style={[styles.badge, { backgroundColor: rowBg }]}>
                      <Text style={[styles.badgeText, { color: rowColor }]}>
                        {pos ? '+' : ''}{rowPct.toFixed(2)}%
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        ) : (
          /* ── Empty state ── */
          <View style={styles.empty}>
            <MaterialCommunityIcons name="briefcase-outline" size={56} color={Colors.textTertiary} />
            <Text style={styles.emptyTitle}>No holdings yet</Text>
            <Text style={styles.emptySub}>Add a transaction to get started</Text>
            <TouchableOpacity style={styles.emptyBtn} onPress={() => router.push('/add-transaction')}>
              <Text style={styles.emptyBtnText}>Add Transaction</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* ── FAB ── */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => router.push('/add-transaction')}
        activeOpacity={0.85}
      >
        <MaterialCommunityIcons name="plus" size={28} color={Colors.accent} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.background,
  },

  /* Header */
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  iconBtn: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
  },
  headerRight: {
    flexDirection: 'row',
  },

  /* Scroll */
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 120 },

  /* Portfolio tabs */
  tabsWrap: {
    paddingHorizontal: 16,
    marginBottom: 14,
  },
  tabPill: {
    flexDirection: 'row',
    backgroundColor: Colors.card,
    borderRadius: 24,
    padding: 4,
  },
  tabActive: {
    flex: 1,
    backgroundColor: Colors.text,
    borderRadius: 20,
    paddingVertical: 8,
    alignItems: 'center',
  },
  tabActiveText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.background,
  },
  tabInactive: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabInactiveText: {
    fontSize: 14,
    fontWeight: '400',
    color: Colors.textTertiary,
  },

  /* Sub-filter pills */
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 20,
    gap: 8,
  },
  filterPill: {
    paddingHorizontal: 18,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  filterPillOn: {
    borderColor: Colors.text,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  filterPillText: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.textSecondary,
  },
  filterPillTextOn: {
    color: Colors.text,
  },

  /* Total Worth */
  worthSection: {
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  worthLabel: {
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.5)',
    marginBottom: 6,
  },
  worthRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: 8,
    gap: 8,
  },
  worthValue: {
    fontSize: 40,
    fontWeight: '700',
    color: Colors.text,
    lineHeight: 44,
  },
  worthCurrency: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.textSecondary,
    marginBottom: 5,
  },
  refreshIcon: {
    marginBottom: 4,
    padding: 2,
  },
  pnlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pnlAbs: {
    fontSize: 15,
    fontWeight: '500',
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
  },

  /* Chart */
  chartWrap: {
    paddingHorizontal: CHART_H_PAD,
    marginTop: 4,
    overflow: 'hidden',
  },

  /* Period row */
  periodRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 14,
  },
  periodBtn: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 13,
  },
  periodBtnOn: {
    backgroundColor: Colors.text,
  },
  periodText: {
    fontSize: 13,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.4)',
  },
  periodTextOn: {
    color: Colors.background,
    fontWeight: '600',
  },

  /* Holdings toolbar */
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
  },
  toolbarFilter: {
    padding: 4,
  },
  toolbarSort: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  toolbarSortText: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.textSecondary,
  },

  /* Holdings list */
  holdingsList: {
    backgroundColor: Colors.card,
  },
  holdingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: Colors.card,
  },
  holdingDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  holdingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 12,
  },
  circle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  circleText: {
    fontSize: 14,
    fontWeight: '700',
  },
  assetMeta: {
    flex: 1,
  },
  assetSymbol: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 3,
  },
  assetSub: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  holdingRight: {
    alignItems: 'flex-end',
    gap: 3,
  },
  holdingVal: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
  },
  holdingPnl: {
    fontSize: 12,
    fontWeight: '500',
  },

  /* Empty state */
  empty: {
    alignItems: 'center',
    paddingVertical: 64,
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.text,
    marginTop: 20,
    marginBottom: 8,
  },
  emptySub: {
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
  },
  emptyBtn: {
    backgroundColor: Colors.accent,
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 24,
  },
  emptyBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.background,
  },

  /* FAB */
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.text,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 8,
  },
});
