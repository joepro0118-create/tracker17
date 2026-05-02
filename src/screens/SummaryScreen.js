import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Platform } from 'react-native';
import { getCategoryColor, getCategoryIcon } from '../utils/parser';
import { formatAmount, isThisMonth, isLastMonth, getWeeklyTotals, getMonthName } from '../utils/helpers';

export default function SummaryScreen({ transactions }) {
  const thisMonthTxns = useMemo(() => transactions.filter((t) => isThisMonth(t.date)), [transactions]);
  const lastMonthTxns = useMemo(() => transactions.filter((t) => isLastMonth(t.date)), [transactions]);

  const thisMonthTotal = useMemo(() => thisMonthTxns.reduce((s, t) => s + t.amount, 0), [thisMonthTxns]);
  const lastMonthTotal = useMemo(() => lastMonthTxns.reduce((s, t) => s + t.amount, 0), [lastMonthTxns]);

  const categoryBreakdown = useMemo(() => {
    const map = {};
    thisMonthTxns.forEach((t) => { map[t.category] = (map[t.category] || 0) + t.amount; });
    const entries = Object.entries(map).sort((a, b) => b[1] - a[1]);
    const max = entries.length > 0 ? entries[0][1] : 1;
    return entries.map(([cat, total]) => ({ cat, total, pct: total / max }));
  }, [thisMonthTxns]);

  const weeklyTotals = useMemo(() => getWeeklyTotals(transactions, 4), [transactions]);
  const maxWeekly = useMemo(() => Math.max(...weeklyTotals.map((w) => w.total), 1), [weeklyTotals]);

  const monthChange = lastMonthTotal > 0
    ? ((thisMonthTotal - lastMonthTotal) / lastMonthTotal * 100).toFixed(0)
    : null;

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
      <Text style={s.pageTitle}>📊 Summary</Text>
      <Text style={s.pageSubtitle}>{getMonthName()}</Text>

      {/* Month comparison */}
      <View style={s.monthRow}>
        <View style={s.monthCard}>
          <Text style={s.monthLabel}>This Month</Text>
          <Text style={s.monthAmt}>{formatAmount(thisMonthTotal)}</Text>
          {monthChange !== null && (
            <Text style={[s.monthChange, { color: parseFloat(monthChange) > 0 ? '#FF6B6B' : '#4ECDC4' }]}>
              {parseFloat(monthChange) > 0 ? '↑' : '↓'} {Math.abs(monthChange)}% vs last month
            </Text>
          )}
          <Text style={s.monthCount}>{thisMonthTxns.length} transactions</Text>
        </View>
        <View style={s.monthCard}>
          <Text style={s.monthLabel}>Last Month</Text>
          <Text style={[s.monthAmt, { color: '#888' }]}>{formatAmount(lastMonthTotal)}</Text>
          <Text style={s.monthCount}>{lastMonthTxns.length} transactions</Text>
        </View>
      </View>

      {/* Category breakdown bars */}
      <Text style={s.sectionTitle}>Category Breakdown</Text>
      {categoryBreakdown.length === 0 ? (
        <View style={s.empty}><Text style={s.emptyTxt}>No data this month</Text></View>
      ) : (
        <View style={s.barSection}>
          {categoryBreakdown.map(({ cat, total, pct }) => (
            <View key={cat} style={s.barRow}>
              <View style={s.barLabelRow}>
                <Text style={s.barCatText}>{getCategoryIcon(cat)} {cat}</Text>
                <Text style={s.barAmt}>{formatAmount(total)}</Text>
              </View>
              <View style={s.barTrack}>
                <View style={[s.barFill, { width: `${Math.round(pct * 100)}%`, backgroundColor: getCategoryColor(cat) }]} />
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Weekly trend */}
      <Text style={[s.sectionTitle, { marginTop: 24 }]}>Weekly Trend (Last 4 Weeks)</Text>
      <View style={s.weeklyChart}>
        {weeklyTotals.map((w, i) => {
          const barH = maxWeekly > 0 ? Math.max((w.total / maxWeekly) * 100, 4) : 4;
          return (
            <View key={i} style={s.weekBar}>
              <Text style={s.weekAmt}>{w.total > 0 ? `RM${Math.round(w.total)}` : ''}</Text>
              <View style={s.weekBarTrack}>
                <View style={[s.weekBarFill, { height: `${barH}%`, backgroundColor: i === 3 ? '#6C5CE7' : '#2A2A4A' }]} />
              </View>
              <Text style={[s.weekLabel, i === 3 && { color: '#6C5CE7' }]}>{w.label}</Text>
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingTop: Platform.OS === 'ios' ? 60 : 44, paddingHorizontal: 20, paddingBottom: 100 },
  pageTitle: { fontSize: 26, fontWeight: '800', color: '#FFF', letterSpacing: -0.5 },
  pageSubtitle: { fontSize: 14, color: '#666', marginTop: 2, marginBottom: 20 },
  monthRow: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  monthCard: { flex: 1, backgroundColor: '#1A1A2E', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#2A2A4A' },
  monthLabel: { fontSize: 11, color: '#888', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 },
  monthAmt: { fontSize: 20, fontWeight: '800', color: '#FFF', letterSpacing: -0.5 },
  monthChange: { fontSize: 12, fontWeight: '600', marginTop: 4 },
  monthCount: { fontSize: 11, color: '#555', marginTop: 4 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#FFF', letterSpacing: -0.3, marginBottom: 14 },
  barSection: { gap: 14 },
  barRow: {},
  barLabelRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  barCatText: { fontSize: 14, color: '#CCC', fontWeight: '600' },
  barAmt: { fontSize: 14, fontWeight: '700', color: '#FFF' },
  barTrack: { height: 8, backgroundColor: '#1A1A2E', borderRadius: 4, overflow: 'hidden' },
  barFill: { height: 8, borderRadius: 4 },
  weeklyChart: { flexDirection: 'row', alignItems: 'flex-end', height: 140, gap: 12, backgroundColor: '#12121F', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#1E1E35' },
  weekBar: { flex: 1, alignItems: 'center', height: '100%' },
  weekAmt: { fontSize: 9, color: '#888', marginBottom: 4, textAlign: 'center' },
  weekBarTrack: { flex: 1, width: '100%', backgroundColor: '#1A1A2E', borderRadius: 6, justifyContent: 'flex-end', overflow: 'hidden' },
  weekBarFill: { width: '100%', borderRadius: 6 },
  weekLabel: { fontSize: 10, color: '#666', marginTop: 6, textAlign: 'center' },
  empty: { alignItems: 'center', paddingVertical: 24 },
  emptyTxt: { color: '#555', fontSize: 14 },
});
