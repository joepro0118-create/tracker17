import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  FlatList, Keyboard, Animated, Platform, Modal, ScrollView,
} from 'react-native';
import { parseInput, detectCategory, getCategoryColor, getCategoryIcon } from '../utils/parser';
import AppIcon from '../components/AppIcon';
import {
  addTransaction, removeTransaction, updateTransaction,
  loadBudget, saveBudget,
} from '../utils/storage';
import { isToday, isThisWeek, formatAmount, formatDate, generateId } from '../utils/helpers';

const CATEGORIES = ['Food', 'Transport', 'Shopping', 'Bills', 'Health', 'Others'];

export default function HomeScreen({ transactions, setTransactions, onNavigate }) {
  const [input, setInput] = useState('');
  const [lastDeleted, setLastDeleted] = useState(null);
  const [budget, setBudget] = useState({ weekly: 0, monthly: 0 });
  const [budgetModal, setBudgetModal] = useState(false);
  const [budgetW, setBudgetW] = useState('');
  const [budgetM, setBudgetM] = useState('');
  const [editModal, setEditModal] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [editAmt, setEditAmt] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editCat, setEditCat] = useState('');
  const undoAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => { loadBudget().then(setBudget); }, []);

  const todayTotal = useMemo(
    () => transactions.filter((t) => isToday(t.date)).reduce((s, t) => s + t.amount, 0),
    [transactions]
  );
  const weekTotal = useMemo(
    () => transactions.filter((t) => isThisWeek(t.date)).reduce((s, t) => s + t.amount, 0),
    [transactions]
  );
  const monthTotal = useMemo(() => {
    const n = new Date();
    return transactions
      .filter((t) => { const d = new Date(t.date); return d.getMonth() === n.getMonth() && d.getFullYear() === n.getFullYear(); })
      .reduce((s, t) => s + t.amount, 0);
  }, [transactions]);
  const weeklyBreakdown = useMemo(() => {
    const map = {};
    transactions.filter((t) => isThisWeek(t.date)).forEach((t) => { map[t.category] = (map[t.category] || 0) + t.amount; });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [transactions]);
  const todayTxns = useMemo(() => transactions.filter((t) => isToday(t.date)), [transactions]);

  const weekPct = budget.weekly > 0 ? Math.min(weekTotal / budget.weekly, 1) : 0;
  const monthPct = budget.monthly > 0 ? Math.min(monthTotal / budget.monthly, 1) : 0;
  const getBudgetColor = (p) => p < 0.7 ? '#4ECDC4' : p < 0.9 ? '#FFD93D' : '#FF6B6B';

  const handleSubmit = useCallback(async () => {
    const parsed = parseInput(input);
    if (!parsed) return;
    const txn = { id: generateId(), amount: parsed.amount, description: parsed.description, category: detectCategory(parsed.description), date: new Date().toISOString(), isRecurring: false };
    setTransactions(await addTransaction(txn, transactions));
    setInput(''); Keyboard.dismiss();
  }, [input, transactions]);

  const showUndo = useCallback((txn) => {
    setLastDeleted(txn);
    Animated.timing(undoAnim, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    setTimeout(() => Animated.timing(undoAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => setLastDeleted(null)), 5000);
  }, []);

  const handleDelete = useCallback(async (txn) => {
    setTransactions(await removeTransaction(txn.id, transactions));
    showUndo(txn);
  }, [transactions]);

  const handleUndo = useCallback(async () => {
    if (!lastDeleted) return;
    const updated = await addTransaction(lastDeleted, transactions);
    updated.sort((a, b) => new Date(b.date) - new Date(a.date));
    setTransactions(updated); setLastDeleted(null);
    Animated.timing(undoAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start();
  }, [lastDeleted, transactions]);

  const openEdit = useCallback((item) => {
    setEditItem(item); setEditAmt(String(item.amount)); setEditDesc(item.description); setEditCat(item.category); setEditModal(true);
  }, []);

  const handleSaveEdit = useCallback(async () => {
    const amount = parseFloat(editAmt);
    if (!editItem || isNaN(amount) || amount <= 0) return;
    setTransactions(await updateTransaction(editItem.id, { amount, description: editDesc.trim() || editItem.description, category: editCat }, transactions));
    setEditModal(false); setEditItem(null);
  }, [editItem, editAmt, editDesc, editCat, transactions]);

  const handleSaveBudget = useCallback(async () => {
    const b = { weekly: parseFloat(budgetW) || 0, monthly: parseFloat(budgetM) || 0 };
    await saveBudget(b); setBudget(b); setBudgetModal(false);
  }, [budgetW, budgetM]);

  const preview = useMemo(() => {
    if (!input.trim()) return null;
    const p = parseInput(input); if (!p) return null;
    return { ...p, category: detectCategory(p.description) };
  }, [input]);

  const renderTxn = useCallback(({ item }) => (
    <View style={s.txnRow}>
      <TouchableOpacity onPress={() => openEdit(item)} style={s.txnLeft} activeOpacity={0.7}>
        <View style={[s.catDot, { backgroundColor: getCategoryColor(item.category) + '22' }]}>
          <AppIcon name={getCategoryIcon(item.category)} size={20} color={getCategoryColor(item.category)} />
        </View>
        <View style={s.txnInfo}>
          <View style={s.txnDescRow}>
            <Text style={s.txnDesc}>{item.description}</Text>
            {item.isRecurring && <AppIcon name="refresh" size={12} color="#4FD1C5" style={{ marginLeft: 4, marginTop: 2 }} />}
          </View>
          <Text style={s.txnMeta}>{item.category} · {formatDate(item.date)}</Text>
        </View>
      </TouchableOpacity>
      <Text style={s.txnAmt}>-{formatAmount(item.amount)}</Text>
      <TouchableOpacity onPress={() => handleDelete(item)} style={s.delBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
        <AppIcon name="close" size={13} color="#666" />
      </TouchableOpacity>
    </View>
  ), [handleDelete, openEdit]);

  return (
    <View style={s.container}>
      <View style={s.header}>
        <View style={s.titleRow}>
          <View style={s.logoWrap}>
            <AppIcon name="wallet-outline" size={20} color="#4FD1C5" />
          </View>
          <View>
            <Text style={s.title}>Tracker17</Text>
            <Text style={s.subtitle}>Personal Money Tracker</Text>
          </View>
        </View>
        <TouchableOpacity onPress={() => { setBudgetW(budget.weekly > 0 ? String(budget.weekly) : ''); setBudgetM(budget.monthly > 0 ? String(budget.monthly) : ''); setBudgetModal(true); }} style={s.settBtn}>
          <AppIcon name="cog-outline" size={22} color="#888" />
        </TouchableOpacity>
      </View>

      <View style={s.summaryRow}>
        <View style={s.card}>
          <Text style={s.cardLabel}>Today</Text>
          <Text style={s.cardAmt}>{formatAmount(todayTotal)}</Text>
          <Text style={s.cardSub}>{todayTxns.length} txn{todayTxns.length !== 1 ? 's' : ''}</Text>
        </View>
        <View style={s.card}>
          <Text style={s.cardLabel}>This Week</Text>
          <Text style={s.cardAmt}>{formatAmount(weekTotal)}</Text>
          {weeklyBreakdown.length > 0 && (
            <View style={s.cardSubRow}>
              <AppIcon name={getCategoryIcon(weeklyBreakdown[0][0])} size={11} color="#666" />
              <Text style={s.cardSub} numberOfLines={1}> {weeklyBreakdown[0][0]}</Text>
            </View>
          )}
        </View>
      </View>

      {(budget.weekly > 0 || budget.monthly > 0) && (
        <View style={s.budgetBox}>
          {budget.weekly > 0 && (
            <View style={s.budgetRow}>
              <View style={s.budgetTopRow}>
                <Text style={s.budgetLabel}>Weekly</Text>
                <Text style={[s.budgetVal, { color: getBudgetColor(weekPct) }]}>{formatAmount(weekTotal)} / {formatAmount(budget.weekly)}</Text>
              </View>
              <View style={s.track}><View style={[s.fill, { width: `${Math.round(weekPct * 100)}%`, backgroundColor: getBudgetColor(weekPct) }]} /></View>
            </View>
          )}
          {budget.monthly > 0 && (
            <View style={[s.budgetRow, budget.weekly > 0 && { marginTop: 10 }]}>
              <View style={s.budgetTopRow}>
                <Text style={s.budgetLabel}>Monthly</Text>
                <Text style={[s.budgetVal, { color: getBudgetColor(monthPct) }]}>{formatAmount(monthTotal)} / {formatAmount(budget.monthly)}</Text>
              </View>
              <View style={s.track}><View style={[s.fill, { width: `${Math.round(monthPct * 100)}%`, backgroundColor: getBudgetColor(monthPct) }]} /></View>
            </View>
          )}
        </View>
      )}

      <View style={s.inputSection}>
        <View style={s.inputRow}>
          <TextInput style={s.input} placeholder='"12 chicken rice" or "5 grab"' placeholderTextColor="#666" value={input} onChangeText={setInput} onSubmitEditing={handleSubmit} returnKeyType="done" autoCorrect={false} autoCapitalize="none" />
          <TouchableOpacity style={[s.addBtn, !input.trim() && s.addBtnOff]} onPress={handleSubmit} disabled={!input.trim()} activeOpacity={0.7}>
            <Text style={s.addBtnTxt}>+</Text>
          </TouchableOpacity>
        </View>
        {preview && (
          <View style={s.preview}>
            <View style={s.previewRow}>
              <AppIcon name={getCategoryIcon(preview.category)} size={14} color={getCategoryColor(preview.category)} />
              <Text style={s.previewTxt}> <Text style={s.previewAmt}>{formatAmount(preview.amount)}</Text>{' → '}{preview.description}<Text style={[s.previewCat, { color: getCategoryColor(preview.category) }]}> ({preview.category})</Text></Text>
            </View>
          </View>
        )}
      </View>

      {weeklyBreakdown.length > 0 && (
        <View style={s.bdSection}>
          <Text style={s.secTitle}>Weekly Breakdown</Text>
          <View style={s.chips}>
            {weeklyBreakdown.map(([cat, total]) => (
              <View key={cat} style={s.chip}>
                <AppIcon name={getCategoryIcon(cat)} size={13} color={getCategoryColor(cat)} />
                <Text style={s.chipTxt}>{formatAmount(total)}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      <View style={s.listSection}>
        <Text style={s.secTitle}>Today's Transactions{todayTxns.length > 0 && <Text style={s.secCount}> ({todayTxns.length})</Text>}</Text>
        {todayTxns.length === 0 ? (
          <View style={s.empty}>
            <AppIcon name="note-text-outline" size={36} color="#333" />
            <Text style={s.emptyTxt}>No transactions today</Text>
            <Text style={s.emptyHint}>Type "12 chicken rice" above</Text>
          </View>
        ) : (
          <FlatList data={todayTxns} renderItem={renderTxn} keyExtractor={(i) => i.id} showsVerticalScrollIndicator={false} style={s.list} contentContainerStyle={{ paddingBottom: 8 }} />
        )}
      </View>

      <TouchableOpacity style={s.oweBtn} onPress={() => onNavigate('owe')} activeOpacity={0.7}>
        <AppIcon name="handshake-outline" size={20} color="#4FD1C5" />
        <Text style={s.oweTxt}>Owe Tracker</Text>
        <AppIcon name="arrow-right" size={18} color="#6C5CE7" />
      </TouchableOpacity>

      {lastDeleted && (
        <Animated.View style={[s.undoBar, { opacity: undoAnim }]}>
          <Text style={s.undoTxt}>Deleted {formatAmount(lastDeleted.amount)} {lastDeleted.description}</Text>
          <TouchableOpacity onPress={handleUndo}><Text style={s.undoBtn}>UNDO</Text></TouchableOpacity>
        </Animated.View>
      )}

      <Modal visible={budgetModal} transparent animationType="slide">
        <View style={s.overlay}>
          <View style={s.modalBox}>
            <View style={s.modalTitleRow}><AppIcon name="currency-usd" size={20} color="#4FD1C5" /><Text style={s.modalTitle}> Set Budget</Text></View>
            <Text style={s.modalLbl}>Weekly Budget (RM)</Text>
            <TextInput style={s.modalInput} value={budgetW} onChangeText={setBudgetW} keyboardType="numeric" placeholder="e.g. 300" placeholderTextColor="#555" />
            <Text style={s.modalLbl}>Monthly Budget (RM)</Text>
            <TextInput style={s.modalInput} value={budgetM} onChangeText={setBudgetM} keyboardType="numeric" placeholder="e.g. 1200" placeholderTextColor="#555" />
            <View style={s.modalBtns}>
              <TouchableOpacity onPress={() => setBudgetModal(false)} style={s.cancelBtn}><Text style={s.cancelTxt}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity onPress={handleSaveBudget} style={s.saveBtn}><Text style={s.saveTxt}>Save</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={editModal} transparent animationType="slide">
        <View style={s.overlay}>
          <View style={s.modalBox}>
            <View style={s.modalTitleRow}><AppIcon name="pencil-outline" size={20} color="#6C5CE7" /><Text style={s.modalTitle}> Edit Transaction</Text></View>
            <Text style={s.modalLbl}>Amount (RM)</Text>
            <TextInput style={s.modalInput} value={editAmt} onChangeText={setEditAmt} keyboardType="numeric" placeholder="Amount" placeholderTextColor="#555" />
            <Text style={s.modalLbl}>Description</Text>
            <TextInput style={s.modalInput} value={editDesc} onChangeText={setEditDesc} placeholder="Description" placeholderTextColor="#555" autoCapitalize="none" />
            <Text style={s.modalLbl}>Category</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
              {CATEGORIES.map((cat) => (
                <TouchableOpacity key={cat} onPress={() => setEditCat(cat)} style={[s.catChip, editCat === cat && { borderColor: getCategoryColor(cat), backgroundColor: '#1E1E35' }]}>
                  <View style={s.catChipRow}>
                    <AppIcon name={getCategoryIcon(cat)} size={13} color={getCategoryColor(cat)} />
                    <Text style={s.catChipTxt}> {cat}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <View style={s.modalBtns}>
              <TouchableOpacity onPress={() => setEditModal(false)} style={s.cancelBtn}><Text style={s.cancelTxt}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity onPress={handleSaveEdit} style={s.saveBtn}><Text style={s.saveTxt}>Save</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, paddingTop: Platform.OS === 'ios' ? 60 : 44, paddingHorizontal: 20 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logoWrap: { width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(79,209,197,0.12)', justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 24, fontWeight: '800', color: '#FFF', letterSpacing: -0.5 },
  subtitle: { fontSize: 12, color: '#666', marginTop: 1 },
  settBtn: { padding: 8 },
  cardSubRow: { flexDirection: 'row', alignItems: 'center', marginTop: 3 },
  summaryRow: { flexDirection: 'row', gap: 12, marginBottom: 14 },
  card: { flex: 1, borderRadius: 16, padding: 14, paddingVertical: 16, backgroundColor: '#1A1A2E', borderWidth: 1, borderColor: '#2A2A4A' },
  cardLabel: { fontSize: 11, color: '#888', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 },
  cardAmt: { fontSize: 20, fontWeight: '800', color: '#FFF', letterSpacing: -0.5 },
  cardSub: { fontSize: 11, color: '#666' },
  budgetBox: { backgroundColor: '#12121F', borderRadius: 14, padding: 14, marginBottom: 14, borderWidth: 1, borderColor: '#1E1E35' },
  budgetRow: {},
  budgetTopRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  budgetLabel: { fontSize: 11, color: '#888', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  budgetVal: { fontSize: 12, fontWeight: '700' },
  track: { height: 6, backgroundColor: '#1E1E35', borderRadius: 3, overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3 },
  inputSection: { marginBottom: 14 },
  inputRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1A1A2E', borderRadius: 16, borderWidth: 1.5, borderColor: '#333366', paddingLeft: 16, paddingRight: 6, height: 54 },
  input: { flex: 1, fontSize: 16, color: '#FFF', fontWeight: '500' },
  addBtn: { width: 42, height: 42, borderRadius: 12, backgroundColor: '#6C5CE7', justifyContent: 'center', alignItems: 'center' },
  addBtnOff: { backgroundColor: '#333' },
  addBtnTxt: { fontSize: 22, color: '#FFF', fontWeight: '700' },
  preview: { marginTop: 8, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#14142A', borderRadius: 10, borderWidth: 1, borderColor: '#222244' },
  previewRow: { flexDirection: 'row', alignItems: 'center' },
  previewTxt: { fontSize: 13, color: '#999', flex: 1 }, previewAmt: { fontWeight: '700', color: '#FFF' }, previewCat: { fontWeight: '600' },
  bdSection: { marginBottom: 14 },
  secTitle: { fontSize: 15, fontWeight: '700', color: '#FFF', letterSpacing: -0.3 },
  secCount: { color: '#666', fontWeight: '500' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1A1A2E', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, gap: 6, borderWidth: 1, borderColor: '#2A2A4A' },
  chipTxt: { fontSize: 12, color: '#CCC', fontWeight: '600' },
  listSection: { flex: 1 }, list: { marginTop: 10 },
  txnRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 12, backgroundColor: '#12121F', borderRadius: 14, marginBottom: 8, borderWidth: 1, borderColor: '#1E1E35' },
  txnLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 8 },
  catDot: { width: 38, height: 38, borderRadius: 11, justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  txnInfo: { flex: 1 },
  txnDescRow: { flexDirection: 'row', alignItems: 'center' },
  txnDesc: { fontSize: 14, fontWeight: '600', color: '#FFF', textTransform: 'capitalize' },
  txnMeta: { fontSize: 11, color: '#666', marginTop: 2 },
  txnAmt: { fontSize: 14, fontWeight: '700', color: '#FF6B6B' },
  delBtn: { width: 30, height: 30, borderRadius: 8, backgroundColor: '#1E1E35', justifyContent: 'center', alignItems: 'center', marginLeft: 6 },
  delTxt: { fontSize: 12, color: '#666', fontWeight: '700' },
  empty: { alignItems: 'center', justifyContent: 'center', paddingVertical: 32 },
  emptyTxt: { fontSize: 15, color: '#666', fontWeight: '600', marginTop: 10 }, emptyHint: { fontSize: 12, color: '#444', marginTop: 4 },
  oweBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#1A1A2E', borderRadius: 14, paddingVertical: 13, marginBottom: 6, borderWidth: 1, borderColor: '#2A2A4A', gap: 8 },
  oweTxt: { fontSize: 14, fontWeight: '700', color: '#FFF' }, oweArrow: { fontSize: 15, color: '#6C5CE7', fontWeight: '700' },
  undoBar: { position: 'absolute', bottom: 80, left: 20, right: 20, backgroundColor: '#2A2A4A', borderRadius: 12, padding: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: '#3A3A5A' },
  undoTxt: { color: '#CCC', fontSize: 14, flex: 1 }, undoBtn: { color: '#6C5CE7', fontWeight: '800', fontSize: 14, letterSpacing: 1, marginLeft: 12 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalBox: { backgroundColor: '#12121F', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: Platform.OS === 'ios' ? 40 : 24, borderWidth: 1, borderColor: '#1E1E35' },
  modalTitleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 18 },
  modalTitle: { fontSize: 20, fontWeight: '800', color: '#FFF' },
  modalLbl: { fontSize: 11, color: '#888', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  modalInput: { backgroundColor: '#1A1A2E', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, fontSize: 16, color: '#FFF', borderWidth: 1, borderColor: '#2A2A4A', marginBottom: 14 },
  modalBtns: { flexDirection: 'row', gap: 12, marginTop: 4 },
  cancelBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: '#1A1A2E', alignItems: 'center', borderWidth: 1, borderColor: '#2A2A4A' },
  cancelTxt: { color: '#888', fontWeight: '700', fontSize: 15 },
  saveBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: '#6C5CE7', alignItems: 'center' },
  saveTxt: { color: '#FFF', fontWeight: '700', fontSize: 15 },
  catChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, backgroundColor: '#1A1A2E', borderWidth: 1.5, borderColor: '#2A2A4A', marginRight: 8 },
  catChipRow: { flexDirection: 'row', alignItems: 'center' },
  catChipTxt: { color: '#CCC', fontSize: 12, fontWeight: '600' },
});
