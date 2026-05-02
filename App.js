import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  FlatList,
  Keyboard,
  Animated,
  Platform,
  KeyboardAvoidingView,
  SectionList,
  ScrollView,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { parseInput, detectCategory, getCategoryColor, getCategoryIcon } from './src/utils/parser';
import { loadTransactions, addTransaction, removeTransaction, loadDebts, addDebt, removeDebt, toggleDebtSettled } from './src/utils/storage';
import { isToday, isThisWeek, formatAmount, formatDate, generateId } from './src/utils/helpers';

export default function App() {
  const [input, setInput] = useState('');
  const [transactions, setTransactions] = useState([]);
  const [lastDeleted, setLastDeleted] = useState(null);
  const [screen, setScreen] = useState('home'); // 'home', 'history', or 'owe'
  const inputRef = useRef(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const undoAnim = useRef(new Animated.Value(0)).current;

  // Owe screen state
  const [debts, setDebts] = useState([]);
  const [debtInput, setDebtInput] = useState('');
  const [debtDirection, setDebtDirection] = useState('owed'); // 'owed' = they owe me, 'owe' = I owe them

  // Load transactions + debts on mount
  useEffect(() => {
    (async () => {
      const saved = await loadTransactions();
      setTransactions(saved);
      const savedDebts = await loadDebts();
      setDebts(savedDebts);
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }).start();
    })();
  }, []);

  // Calculate totals
  const todayTotal = useMemo(
    () =>
      transactions.filter((t) => isToday(t.date)).reduce((sum, t) => sum + t.amount, 0),
    [transactions]
  );

  const weekTotal = useMemo(
    () =>
      transactions.filter((t) => isThisWeek(t.date)).reduce((sum, t) => sum + t.amount, 0),
    [transactions]
  );

  // Weekly category breakdown
  const weeklyBreakdown = useMemo(() => {
    const weekTxns = transactions.filter((t) => isThisWeek(t.date));
    const breakdown = {};
    weekTxns.forEach((t) => {
      breakdown[t.category] = (breakdown[t.category] || 0) + t.amount;
    });
    return Object.entries(breakdown).sort((a, b) => b[1] - a[1]);
  }, [transactions]);

  // Submit handler
  const handleSubmit = useCallback(async () => {
    const parsed = parseInput(input);
    if (!parsed) return;

    const category = detectCategory(parsed.description);
    const transaction = {
      id: generateId(),
      amount: parsed.amount,
      description: parsed.description,
      category,
      date: new Date().toISOString(),
    };

    const updated = await addTransaction(transaction, transactions);
    setTransactions(updated);
    setInput('');
    Keyboard.dismiss();
  }, [input, transactions]);

  // Undo last delete
  const handleUndo = useCallback(async () => {
    if (!lastDeleted) return;
    const updated = await addTransaction(lastDeleted, transactions);
    updated.sort((a, b) => new Date(b.date) - new Date(a.date));
    setTransactions(updated);
    setLastDeleted(null);
    Animated.timing(undoAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [lastDeleted, transactions]);

  // Delete a transaction (instant, no confirmation — undo available)
  const handleDelete = useCallback(
    async (transaction) => {
      const updated = await removeTransaction(transaction.id, transactions);
      setTransactions(updated);
      setLastDeleted(transaction);
      Animated.timing(undoAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
      setTimeout(() => {
        Animated.timing(undoAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }).start(() => setLastDeleted(null));
      }, 5000);
    },
    [transactions]
  );

  // Live preview of what will be logged
  const preview = useMemo(() => {
    if (!input.trim()) return null;
    const parsed = parseInput(input);
    if (!parsed) return null;
    const category = detectCategory(parsed.description);
    return { ...parsed, category };
  }, [input]);

  // Today's transactions only
  const todayTransactions = useMemo(
    () => transactions.filter((t) => isToday(t.date)),
    [transactions]
  );

  // Group all transactions by date for history view
  const groupedTransactions = useMemo(() => {
    const groups = {};
    transactions.forEach((t) => {
      const dateKey = new Date(t.date).toLocaleDateString('en-MY', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
      if (!groups[dateKey]) {
        groups[dateKey] = { title: dateKey, data: [], total: 0 };
      }
      groups[dateKey].data.push(t);
      groups[dateKey].total += t.amount;
    });
    return Object.values(groups);
  }, [transactions]);

  // Render a single transaction row
  const renderTransaction = useCallback(
    ({ item }) => (
      <View style={styles.transactionRow}>
        <View style={styles.transactionLeft}>
          <View
            style={[
              styles.categoryDot,
              { backgroundColor: getCategoryColor(item.category) },
            ]}
          >
            <Text style={styles.categoryEmoji}>{getCategoryIcon(item.category)}</Text>
          </View>
          <View style={styles.transactionInfo}>
            <Text style={styles.transactionDesc}>{item.description}</Text>
            <Text style={styles.transactionMeta}>
              {item.category} · {formatDate(item.date)}
            </Text>
          </View>
        </View>
        <Text style={styles.transactionAmount}>
          -{formatAmount(item.amount)}
        </Text>
        <TouchableOpacity
          onPress={() => handleDelete(item)}
          activeOpacity={0.6}
          style={styles.deleteBtn}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Text style={styles.deleteBtnText}>✕</Text>
        </TouchableOpacity>
      </View>
    ),
    [handleDelete]
  );

  // ==================== OWE HANDLERS ====================
  const handleAddDebt = useCallback(async () => {
    const trimmed = debtInput.trim();
    if (!trimmed) return;
    // Parse: "ali 20 lunch" or "20 ali lunch"
    const match = trimmed.match(/(\d+\.?\d*)/);
    if (!match) return;
    const amount = parseFloat(match[1]);
    if (isNaN(amount) || amount <= 0) return;
    const rest = trimmed.replace(match[0], '').trim();
    const words = rest.split(/\s+/);
    const person = words[0] || 'someone';
    const note = words.slice(1).join(' ') || '';
    const debt = {
      id: generateId(),
      person,
      amount,
      note,
      direction: debtDirection,
      settled: false,
      date: new Date().toISOString(),
    };
    const updated = await addDebt(debt, debts);
    setDebts(updated);
    setDebtInput('');
    Keyboard.dismiss();
  }, [debtInput, debtDirection, debts]);

  const handleToggleDebt = useCallback(async (id) => {
    const updated = await toggleDebtSettled(id, debts);
    setDebts(updated);
  }, [debts]);

  const handleDeleteDebt = useCallback(async (id) => {
    const updated = await removeDebt(id, debts);
    setDebts(updated);
  }, [debts]);

  // Owe summary
  const oweSummary = useMemo(() => {
    const unsettled = debts.filter((d) => !d.settled);
    const theyOweMe = unsettled.filter((d) => d.direction === 'owed').reduce((s, d) => s + d.amount, 0);
    const iOweThem = unsettled.filter((d) => d.direction === 'owe').reduce((s, d) => s + d.amount, 0);
    return { theyOweMe, iOweThem, net: theyOweMe - iOweThem };
  }, [debts]);

  // ==================== OWE SCREEN ====================
  if (screen === 'owe') {
    const unsettledDebts = debts.filter((d) => !d.settled);
    const settledDebts = debts.filter((d) => d.settled);
    return (
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <StatusBar style="light" />
        <View style={styles.inner}>
          <View style={styles.historyHeader}>
            <TouchableOpacity onPress={() => setScreen('home')} activeOpacity={0.7} style={styles.backBtn}>
              <Text style={styles.backBtnText}>← Back</Text>
            </TouchableOpacity>
            <Text style={styles.historyTitle}>💸 Owe Tracker</Text>
            <Text style={styles.historySubtitle}>Track who owes who</Text>
          </View>

          {/* Owe Summary Cards */}
          <View style={styles.summaryRow}>
            <View style={[styles.summaryCard, styles.todayCard]}>
              <Text style={styles.summaryLabel}>They Owe Me</Text>
              <Text style={[styles.summaryAmount, { color: '#4ECDC4' }]}>{formatAmount(oweSummary.theyOweMe)}</Text>
            </View>
            <View style={[styles.summaryCard, styles.weekCard]}>
              <Text style={styles.summaryLabel}>I Owe Them</Text>
              <Text style={[styles.summaryAmount, { color: '#FF6B6B' }]}>{formatAmount(oweSummary.iOweThem)}</Text>
            </View>
          </View>

          {/* Direction Toggle */}
          <View style={styles.oweToggleRow}>
            <TouchableOpacity
              style={[styles.oweToggleBtn, debtDirection === 'owed' && styles.oweToggleActive]}
              onPress={() => setDebtDirection('owed')}
              activeOpacity={0.7}
            >
              <Text style={[styles.oweToggleText, debtDirection === 'owed' && styles.oweToggleTextActive]}>They owe me</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.oweToggleBtn, debtDirection === 'owe' && styles.oweToggleActiveRed]}
              onPress={() => setDebtDirection('owe')}
              activeOpacity={0.7}
            >
              <Text style={[styles.oweToggleText, debtDirection === 'owe' && styles.oweToggleTextActive]}>I owe them</Text>
            </TouchableOpacity>
          </View>

          {/* Debt Input */}
          <View style={styles.inputSection}>
            <View style={styles.inputWrapper}>
              <TextInput
                style={styles.input}
                placeholder='e.g. "ali 20 lunch" or "sarah 50"'
                placeholderTextColor="#666"
                value={debtInput}
                onChangeText={setDebtInput}
                onSubmitEditing={handleAddDebt}
                returnKeyType="done"
                autoCorrect={false}
                autoCapitalize="none"
              />
              <TouchableOpacity
                style={[styles.submitBtn, !debtInput.trim() && styles.submitBtnDisabled]}
                onPress={handleAddDebt}
                disabled={!debtInput.trim()}
                activeOpacity={0.7}
              >
                <Text style={styles.submitBtnText}>+</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Debt List */}
          <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 40 }}>
            {unsettledDebts.length > 0 && (
              <View>
                <Text style={styles.sectionTitle}>Unsettled ({unsettledDebts.length})</Text>
                {unsettledDebts.map((d) => (
                  <View key={d.id} style={styles.oweRow}>
                    <TouchableOpacity onPress={() => handleToggleDebt(d.id)} style={styles.oweCheckbox} activeOpacity={0.6}>
                      <Text style={styles.oweCheckboxText}>☐</Text>
                    </TouchableOpacity>
                    <View style={styles.oweInfo}>
                      <Text style={styles.owePersonText}>
                        {d.direction === 'owed' ? `${d.person} owes you` : `You owe ${d.person}`}
                      </Text>
                      {d.note ? <Text style={styles.oweNoteText}>{d.note} · {formatDate(d.date)}</Text> : <Text style={styles.oweNoteText}>{formatDate(d.date)}</Text>}
                    </View>
                    <Text style={[styles.oweAmount, { color: d.direction === 'owed' ? '#4ECDC4' : '#FF6B6B' }]}>
                      {formatAmount(d.amount)}
                    </Text>
                    <TouchableOpacity onPress={() => handleDeleteDebt(d.id)} style={styles.deleteBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                      <Text style={styles.deleteBtnText}>✕</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
            {settledDebts.length > 0 && (
              <View style={{ marginTop: 20 }}>
                <Text style={[styles.sectionTitle, { color: '#555' }]}>Settled ✓ ({settledDebts.length})</Text>
                {settledDebts.map((d) => (
                  <View key={d.id} style={[styles.oweRow, { opacity: 0.5 }]}>
                    <TouchableOpacity onPress={() => handleToggleDebt(d.id)} style={styles.oweCheckbox} activeOpacity={0.6}>
                      <Text style={styles.oweCheckboxChecked}>☑</Text>
                    </TouchableOpacity>
                    <View style={styles.oweInfo}>
                      <Text style={[styles.owePersonText, styles.oweSettledText]}>
                        {d.direction === 'owed' ? `${d.person} owes you` : `You owe ${d.person}`}
                      </Text>
                      {d.note ? <Text style={styles.oweNoteText}>{d.note}</Text> : null}
                    </View>
                    <Text style={[styles.oweAmount, { color: '#555' }]}>{formatAmount(d.amount)}</Text>
                    <TouchableOpacity onPress={() => handleDeleteDebt(d.id)} style={styles.deleteBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                      <Text style={styles.deleteBtnText}>✕</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
            {debts.length === 0 && (
              <View style={styles.emptyState}>
                <Text style={styles.emptyEmoji}>🤝</Text>
                <Text style={styles.emptyText}>No debts tracked</Text>
                <Text style={styles.emptyHint}>Type "ali 20 lunch" to add one</Text>
              </View>
            )}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    );
  }

  // ==================== HISTORY SCREEN ====================
  if (screen === 'history') {
    return (
      <View style={styles.container}>
        <StatusBar style="light" />
        <View style={styles.inner}>
          <View style={styles.historyHeader}>
            <TouchableOpacity onPress={() => setScreen('home')} activeOpacity={0.7} style={styles.backBtn}>
              <Text style={styles.backBtnText}>← Back</Text>
            </TouchableOpacity>
            <Text style={styles.historyTitle}>Transaction History</Text>
            <Text style={styles.historySubtitle}>
              {transactions.length} total transaction{transactions.length !== 1 ? 's' : ''}{' · '}{formatAmount(transactions.reduce((s, t) => s + t.amount, 0))}
            </Text>
          </View>
          {transactions.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyEmoji}>📭</Text>
              <Text style={styles.emptyText}>No transaction history</Text>
            </View>
          ) : (
            <SectionList
              sections={groupedTransactions}
              renderItem={renderTransaction}
              renderSectionHeader={({ section }) => (
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionHeaderText}>{section.title}</Text>
                  <Text style={styles.sectionHeaderTotal}>{formatAmount(section.total)}</Text>
                </View>
              )}
              keyExtractor={(item) => item.id}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.historyListContent}
              stickySectionHeadersEnabled={true}
            />
          )}
          {lastDeleted && (
            <Animated.View style={[styles.undoBar, { opacity: undoAnim }]}>
              <Text style={styles.undoText}>Deleted {formatAmount(lastDeleted.amount)} {lastDeleted.description}</Text>
              <TouchableOpacity onPress={handleUndo} activeOpacity={0.7}>
                <Text style={styles.undoBtn}>UNDO</Text>
              </TouchableOpacity>
            </Animated.View>
          )}
        </View>
      </View>
    );
  }

  // ==================== HOME SCREEN ====================
  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <StatusBar style="light" />

      <Animated.View style={[styles.inner, { opacity: fadeAnim }]}>
        {/* ===== HEADER / SUMMARY ===== */}
        <View style={styles.header}>
          <Text style={styles.appTitle}>💸 Tracker17</Text>
          <Text style={styles.appSubtitle}>Personal Money Tracker</Text>
        </View>

        {/* Summary Cards */}
        <View style={styles.summaryRow}>
          <View style={[styles.summaryCard, styles.todayCard]}>
            <Text style={styles.summaryLabel}>Today</Text>
            <Text style={styles.summaryAmount}>{formatAmount(todayTotal)}</Text>
            <Text style={styles.summaryCount}>
              {todayTransactions.length} transaction{todayTransactions.length !== 1 ? 's' : ''}
            </Text>
          </View>
          <View style={[styles.summaryCard, styles.weekCard]}>
            <Text style={styles.summaryLabel}>This Week</Text>
            <Text style={styles.summaryAmount}>{formatAmount(weekTotal)}</Text>
            {weeklyBreakdown.length > 0 && (
              <Text style={styles.summaryCount} numberOfLines={1}>
                Top: {getCategoryIcon(weeklyBreakdown[0][0])} {weeklyBreakdown[0][0]}
              </Text>
            )}
          </View>
        </View>

        {/* ===== INPUT SECTION ===== */}
        <View style={styles.inputSection}>
          <View style={styles.inputWrapper}>
            <TextInput
              ref={inputRef}
              style={styles.input}
              placeholder='e.g. "12 chicken rice" or "5 grab"'
              placeholderTextColor="#666"
              value={input}
              onChangeText={setInput}
              onSubmitEditing={handleSubmit}
              returnKeyType="done"
              autoCorrect={false}
              autoCapitalize="none"
            />
            <TouchableOpacity
              style={[styles.submitBtn, !input.trim() && styles.submitBtnDisabled]}
              onPress={handleSubmit}
              disabled={!input.trim()}
              activeOpacity={0.7}
            >
              <Text style={styles.submitBtnText}>+</Text>
            </TouchableOpacity>
          </View>

          {/* Live Preview */}
          {preview && (
            <View style={styles.previewBar}>
              <Text style={styles.previewText}>
                {getCategoryIcon(preview.category)}{' '}
                <Text style={styles.previewAmount}>{formatAmount(preview.amount)}</Text>
                {' → '}
                {preview.description}
                <Text style={[styles.previewCategory, { color: getCategoryColor(preview.category) }]}>
                  {' '}({preview.category})
                </Text>
              </Text>
            </View>
          )}
        </View>

        {/* ===== WEEKLY BREAKDOWN ===== */}
        {weeklyBreakdown.length > 0 && (
          <View style={styles.breakdownSection}>
            <Text style={styles.sectionTitle}>Weekly Breakdown</Text>
            <View style={styles.breakdownRow}>
              {weeklyBreakdown.map(([cat, total]) => (
                <View key={cat} style={styles.breakdownChip}>
                  <Text style={styles.breakdownEmoji}>{getCategoryIcon(cat)}</Text>
                  <Text style={styles.breakdownChipText}>
                    {formatAmount(total)}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* ===== TODAY'S TRANSACTIONS ===== */}
        <View style={styles.listSection}>
          <Text style={styles.sectionTitle}>
            Today's Transactions
            {todayTransactions.length > 0 && (
              <Text style={styles.sectionCount}> ({todayTransactions.length})</Text>
            )}
          </Text>

          {todayTransactions.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyEmoji}>📝</Text>
              <Text style={styles.emptyText}>No transactions today</Text>
              <Text style={styles.emptyHint}>
                Type something like "12 chicken rice" above
              </Text>
            </View>
          ) : (
            <FlatList
              data={todayTransactions}
              renderItem={renderTransaction}
              keyExtractor={(item) => item.id}
              showsVerticalScrollIndicator={false}
              style={styles.list}
              contentContainerStyle={styles.listContent}
            />
          )}
        </View>

        {/* ===== BOTTOM BUTTONS ===== */}
        <View style={styles.bottomBtnsRow}>
          <TouchableOpacity
            style={styles.bottomBtn}
            onPress={() => setScreen('history')}
            activeOpacity={0.7}
          >
            <Text style={styles.historyBtnIcon}>📋</Text>
            <Text style={styles.historyBtnText}>History</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.bottomBtn}
            onPress={() => setScreen('owe')}
            activeOpacity={0.7}
          >
            <Text style={styles.historyBtnIcon}>🤝</Text>
            <Text style={styles.historyBtnText}>Owe</Text>
          </TouchableOpacity>
        </View>

        {/* ===== UNDO BAR ===== */}
        {lastDeleted && (
          <Animated.View style={[styles.undoBar, { opacity: undoAnim }]}>
            <Text style={styles.undoText}>
              Deleted {formatAmount(lastDeleted.amount)} {lastDeleted.description}
            </Text>
            <TouchableOpacity onPress={handleUndo} activeOpacity={0.7}>
              <Text style={styles.undoBtn}>UNDO</Text>
            </TouchableOpacity>
          </Animated.View>
        )}
      </Animated.View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0F',
  },
  inner: {
    flex: 1,
    paddingTop: Platform.OS === 'ios' ? 60 : 44,
    paddingHorizontal: 20,
  },

  // Header
  header: {
    marginBottom: 20,
  },
  appTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  appSubtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },

  // Summary Cards
  summaryRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  summaryCard: {
    flex: 1,
    borderRadius: 16,
    padding: 16,
    paddingVertical: 18,
  },
  todayCard: {
    backgroundColor: '#1A1A2E',
    borderWidth: 1,
    borderColor: '#2A2A4A',
  },
  weekCard: {
    backgroundColor: '#1A1A2E',
    borderWidth: 1,
    borderColor: '#2A2A4A',
  },
  summaryLabel: {
    fontSize: 13,
    color: '#888',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 6,
  },
  summaryAmount: {
    fontSize: 24,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  summaryCount: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },

  // Input
  inputSection: {
    marginBottom: 20,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1A2E',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#333366',
    paddingLeft: 16,
    paddingRight: 6,
    height: 56,
  },
  input: {
    flex: 1,
    fontSize: 17,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  submitBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#6C5CE7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  submitBtnDisabled: {
    backgroundColor: '#333',
  },
  submitBtnText: {
    fontSize: 24,
    color: '#FFFFFF',
    fontWeight: '700',
  },

  // Preview
  previewBar: {
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#14142A',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#222244',
  },
  previewText: {
    fontSize: 13,
    color: '#999',
  },
  previewAmount: {
    fontWeight: '700',
    color: '#FFFFFF',
  },
  previewCategory: {
    fontWeight: '600',
  },

  // Weekly Breakdown
  breakdownSection: {
    marginBottom: 20,
  },
  breakdownRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  breakdownChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1A2E',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 4,
    borderWidth: 1,
    borderColor: '#2A2A4A',
  },
  breakdownEmoji: {
    fontSize: 14,
  },
  breakdownChipText: {
    fontSize: 13,
    color: '#CCC',
    fontWeight: '600',
  },

  // Section Title
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
  sectionCount: {
    color: '#666',
    fontWeight: '500',
  },

  // Transactions List
  listSection: {
    flex: 1,
  },
  list: {
    marginTop: 12,
  },
  listContent: {
    paddingBottom: 20,
  },
  transactionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 12,
    backgroundColor: '#12121F',
    borderRadius: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#1E1E35',
  },
  transactionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 12,
  },
  categoryDot: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  categoryEmoji: {
    fontSize: 18,
  },
  transactionInfo: {
    flex: 1,
  },
  transactionDesc: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
    textTransform: 'capitalize',
  },
  transactionMeta: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  transactionAmount: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FF6B6B',
  },
  deleteBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#1E1E35',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 10,
  },
  deleteBtnText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '700',
  },

  // Empty State
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    fontWeight: '600',
  },
  emptyHint: {
    fontSize: 13,
    color: '#444',
    marginTop: 4,
  },

  // Bottom Buttons Row
  bottomBtnsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: Platform.OS === 'ios' ? 36 : 24,
  },
  bottomBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1A1A2E',
    borderRadius: 14,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: '#2A2A4A',
    gap: 8,
  },
  historyBtnIcon: {
    fontSize: 16,
  },
  historyBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // Owe Screen
  oweToggleRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  oweToggleBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#1A1A2E',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#2A2A4A',
  },
  oweToggleActive: {
    borderColor: '#4ECDC4',
    backgroundColor: '#1A2E2E',
  },
  oweToggleActiveRed: {
    borderColor: '#FF6B6B',
    backgroundColor: '#2E1A1A',
  },
  oweToggleText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  oweToggleTextActive: {
    color: '#FFFFFF',
  },
  oweRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 12,
    backgroundColor: '#12121F',
    borderRadius: 14,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#1E1E35',
  },
  oweCheckbox: {
    marginRight: 12,
  },
  oweCheckboxText: {
    fontSize: 22,
    color: '#6C5CE7',
  },
  oweCheckboxChecked: {
    fontSize: 22,
    color: '#4ECDC4',
  },
  oweInfo: {
    flex: 1,
  },
  owePersonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
    textTransform: 'capitalize',
  },
  oweNoteText: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
    textTransform: 'capitalize',
  },
  oweSettledText: {
    textDecorationLine: 'line-through',
    color: '#555',
  },
  oweAmount: {
    fontSize: 16,
    fontWeight: '700',
    marginRight: 4,
  },

  // History Screen
  historyHeader: {
    marginBottom: 20,
  },
  backBtn: {
    marginBottom: 12,
  },
  backBtnText: {
    fontSize: 16,
    color: '#6C5CE7',
    fontWeight: '700',
  },
  historyTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  historySubtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 4,
    backgroundColor: '#0A0A0F',
  },
  sectionHeaderText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionHeaderTotal: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FF6B6B',
  },
  historyListContent: {
    paddingBottom: 100,
  },

  // Undo Bar
  undoBar: {
    position: 'absolute',
    bottom: 40,
    left: 20,
    right: 20,
    backgroundColor: '#2A2A4A',
    borderRadius: 12,
    padding: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#3A3A5A',
  },
  undoText: {
    color: '#CCC',
    fontSize: 14,
    flex: 1,
  },
  undoBtn: {
    color: '#6C5CE7',
    fontWeight: '800',
    fontSize: 14,
    letterSpacing: 1,
    marginLeft: 12,
  },
});
