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
  Alert,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { parseInput, detectCategory, getCategoryColor, getCategoryIcon } from './src/utils/parser';
import { loadTransactions, addTransaction, removeTransaction } from './src/utils/storage';
import { isToday, isThisWeek, formatAmount, formatDate, generateId } from './src/utils/helpers';

export default function App() {
  const [input, setInput] = useState('');
  const [transactions, setTransactions] = useState([]);
  const [lastDeleted, setLastDeleted] = useState(null);
  const inputRef = useRef(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const undoAnim = useRef(new Animated.Value(0)).current;

  // Load transactions on mount
  useEffect(() => {
    (async () => {
      const saved = await loadTransactions();
      setTransactions(saved);
      // Fade in animation
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
    if (!parsed) {
      // Subtle shake or just ignore
      return;
    }

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
    // Re-sort by date
    updated.sort((a, b) => new Date(b.date) - new Date(a.date));
    setTransactions(updated);
    setLastDeleted(null);
    // Hide undo bar
    Animated.timing(undoAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [lastDeleted, transactions]);

  // Delete a transaction
  const handleDelete = useCallback(
    (transaction) => {
      Alert.alert(
        'Delete Transaction',
        `Remove ${formatAmount(transaction.amount)} ${transaction.description}?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              const updated = await removeTransaction(transaction.id, transactions);
              setTransactions(updated);
              setLastDeleted(transaction);
              // Show undo bar
              Animated.timing(undoAnim, {
                toValue: 1,
                duration: 200,
                useNativeDriver: true,
              }).start();
              // Auto-hide undo after 5 seconds
              setTimeout(() => {
                Animated.timing(undoAnim, {
                  toValue: 0,
                  duration: 200,
                  useNativeDriver: true,
                }).start(() => setLastDeleted(null));
              }, 5000);
            },
          },
        ]
      );
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

  // Today's transactions
  const todayTransactions = useMemo(
    () => transactions.filter((t) => isToday(t.date)),
    [transactions]
  );

  const renderTransaction = useCallback(
    ({ item, index }) => (
      <TouchableOpacity
        onLongPress={() => handleDelete(item)}
        activeOpacity={0.7}
        style={styles.transactionRow}
      >
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
      </TouchableOpacity>
    ),
    [handleDelete]
  );

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

        {/* ===== TRANSACTIONS LIST ===== */}
        <View style={styles.listSection}>
          <Text style={styles.sectionTitle}>
            Recent Transactions
            {transactions.length > 0 && (
              <Text style={styles.sectionCount}> ({transactions.length})</Text>
            )}
          </Text>

          {transactions.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyEmoji}>📝</Text>
              <Text style={styles.emptyText}>No transactions yet</Text>
              <Text style={styles.emptyHint}>
                Type something like "12 chicken rice" above
              </Text>
            </View>
          ) : (
            <FlatList
              data={transactions}
              renderItem={renderTransaction}
              keyExtractor={(item) => item.id}
              showsVerticalScrollIndicator={false}
              style={styles.list}
              contentContainerStyle={styles.listContent}
            />
          )}
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
    paddingBottom: 100,
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
