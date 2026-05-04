import React, { useState, useCallback, useMemo, useRef } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, SectionList, Animated, Platform, Modal, ScrollView } from 'react-native';
import { getCategoryColor, getCategoryIcon } from '../utils/parser';
import { removeTransaction, updateTransaction } from '../utils/storage';
import { formatAmount, formatDate } from '../utils/helpers';
import AppIcon from '../components/AppIcon';

const CATEGORIES = ['Food', 'Transport', 'Shopping', 'Bills', 'Health', 'Others'];

export default function HistoryScreen({ transactions, setTransactions, onBack }) {
  const [search, setSearch] = useState('');
  const [lastDeleted, setLastDeleted] = useState(null);
  const [editModal, setEditModal] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [editAmt, setEditAmt] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editCat, setEditCat] = useState('');
  const undoAnim = useRef(new Animated.Value(0)).current;

  const filtered = useMemo(() => {
    if (!search.trim()) return transactions;
    const q = search.toLowerCase();
    return transactions.filter((t) =>
      t.description.toLowerCase().includes(q) ||
      t.category.toLowerCase().includes(q) ||
      String(t.amount).includes(q)
    );
  }, [transactions, search]);

  const grouped = useMemo(() => {
    const groups = {};
    filtered.forEach((t) => {
      const key = new Date(t.date).toLocaleDateString('en-MY', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
      if (!groups[key]) groups[key] = { title: key, data: [], total: 0 };
      groups[key].data.push(t);
      groups[key].total += t.amount;
    });
    return Object.values(groups);
  }, [filtered]);

  const totalSpent = useMemo(() => transactions.reduce((s, t) => s + t.amount, 0), [transactions]);

  const showUndo = useCallback((txn) => {
    setLastDeleted(txn);
    Animated.timing(undoAnim, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    setTimeout(() => Animated.timing(undoAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => setLastDeleted(null)), 5000);
  }, []);

  const handleDelete = useCallback(async (item) => {
    setTransactions(await removeTransaction(item.id, transactions));
    showUndo(item);
  }, [transactions]);

  const handleUndo = useCallback(async () => {
    if (!lastDeleted) return;
    const { addTransaction } = await import('../utils/storage');
    const updated = await addTransaction(lastDeleted, transactions);
    updated.sort((a, b) => new Date(b.date) - new Date(a.date));
    setTransactions(updated); setLastDeleted(null);
    Animated.timing(undoAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start();
  }, [lastDeleted, transactions]);

  const openEdit = (item) => { setEditItem(item); setEditAmt(String(item.amount)); setEditDesc(item.description); setEditCat(item.category); setEditModal(true); };

  const handleSaveEdit = useCallback(async () => {
    const amount = parseFloat(editAmt);
    if (!editItem || isNaN(amount) || amount <= 0) return;
    setTransactions(await updateTransaction(editItem.id, { amount, description: editDesc.trim() || editItem.description, category: editCat }, transactions));
    setEditModal(false); setEditItem(null);
  }, [editItem, editAmt, editDesc, editCat, transactions]);

  const renderItem = useCallback(({ item }) => (
    <View style={s.txnRow}>
      <TouchableOpacity onPress={() => openEdit(item)} style={s.txnLeft} activeOpacity={0.7}>
        <View style={[s.catDot, { backgroundColor: getCategoryColor(item.category) + '22' }]}>
          <AppIcon name={getCategoryIcon(item.category)} size={20} color={getCategoryColor(item.category)} />
        </View>
        <View style={s.txnInfo}>
          <View style={s.txnDescRow}>
            <Text style={s.txnDesc}>{item.description}</Text>
            {item.isRecurring && <AppIcon name="refresh" size={12} color="#4FD1C5" style={{ marginLeft: 4, marginTop: 1 }} />}
          </View>
          <Text style={s.txnMeta}>{item.category} · {formatDate(item.date)}</Text>
        </View>
      </TouchableOpacity>
      <Text style={s.txnAmt}>-{formatAmount(item.amount)}</Text>
      <TouchableOpacity onPress={() => handleDelete(item)} style={s.delBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
        <AppIcon name="close" size={13} color="#666" />
      </TouchableOpacity>
    </View>
  ), [handleDelete]);

  return (
    <View style={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={onBack} style={s.backBtn} activeOpacity={0.7}>
          <Text style={s.backTxt}>← Back</Text>
        </TouchableOpacity>
        <Text style={s.titleTxt}>Transaction History</Text>
        <Text style={s.subtitleTxt}>{transactions.length} transactions · {formatAmount(totalSpent)}</Text>
      </View>

      {/* Search Bar */}
      <View style={s.searchRow}>
        <AppIcon name="magnify" size={18} color="#555" />
        <TextInput
          style={s.searchInput}
          placeholder="Search by name, category, amount..."
          placeholderTextColor="#555"
          value={search}
          onChangeText={setSearch}
          autoCorrect={false}
          autoCapitalize="none"
          clearButtonMode="while-editing"
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')} style={s.clearBtn}>
            <AppIcon name="close-circle" size={16} color="#666" />
          </TouchableOpacity>
        )}
      </View>
      {search.length > 0 && (
        <Text style={s.searchResults}>{filtered.length} result{filtered.length !== 1 ? 's' : ''} for "{search}"</Text>
      )}

      {grouped.length === 0 ? (
        <View style={s.empty}>
          <AppIcon name={search ? 'magnify' : 'email-outline'} size={40} color="#333" />
          <Text style={s.emptyTxt}>{search ? 'No results found' : 'No transaction history'}</Text>
        </View>
      ) : (
        <SectionList
          sections={grouped}
          renderItem={renderItem}
          renderSectionHeader={({ section }) => (
            <View style={s.secHeader}>
              <Text style={s.secHeaderTxt}>{section.title}</Text>
              <Text style={s.secHeaderTotal}>{formatAmount(section.total)}</Text>
            </View>
          )}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 100 }}
          stickySectionHeadersEnabled
        />
      )}

      {lastDeleted && (
        <Animated.View style={[s.undoBar, { opacity: undoAnim }]}>
          <Text style={s.undoTxt}>Deleted {formatAmount(lastDeleted.amount)} {lastDeleted.description}</Text>
          <TouchableOpacity onPress={handleUndo}><Text style={s.undoBtn}>UNDO</Text></TouchableOpacity>
        </Animated.View>
      )}

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
  header: { marginBottom: 16 },
  backBtn: { marginBottom: 10 }, backTxt: { fontSize: 15, color: '#6C5CE7', fontWeight: '700' },
  titleTxt: { fontSize: 26, fontWeight: '800', color: '#FFF', letterSpacing: -0.5 },
  subtitleTxt: { fontSize: 13, color: '#666', marginTop: 4 },
  searchRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1A1A2E', borderRadius: 14, paddingHorizontal: 14, height: 48, marginBottom: 8, borderWidth: 1, borderColor: '#2A2A4A' },
  searchIcon: { fontSize: 16, marginRight: 8 },
  searchInput: { flex: 1, fontSize: 15, color: '#FFF' },
  clearBtn: { padding: 4 }, clearTxt: { color: '#666', fontSize: 14, fontWeight: '700' },
  searchResults: { fontSize: 12, color: '#666', marginBottom: 8 },
  txnRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 12, backgroundColor: '#12121F', borderRadius: 14, marginBottom: 8, borderWidth: 1, borderColor: '#1E1E35' },
  txnLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 8 },
  catDot: { width: 38, height: 38, borderRadius: 11, justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  txnInfo: { flex: 1 }, txnDescRow: { flexDirection: 'row', alignItems: 'center' },
  txnDesc: { fontSize: 14, fontWeight: '600', color: '#FFF', textTransform: 'capitalize' },
  txnMeta: { fontSize: 11, color: '#666', marginTop: 2 },
  txnAmt: { fontSize: 14, fontWeight: '700', color: '#FF6B6B' },
  delBtn: { width: 30, height: 30, borderRadius: 8, backgroundColor: '#1E1E35', justifyContent: 'center', alignItems: 'center', marginLeft: 6 },
  delTxt: { fontSize: 12, color: '#666', fontWeight: '700' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  emptyTxt: { fontSize: 15, color: '#666', fontWeight: '600' },
  secHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 4, backgroundColor: '#0A0A0F' },
  secHeaderTxt: { fontSize: 12, fontWeight: '700', color: '#888', textTransform: 'uppercase', letterSpacing: 0.5 },
  secHeaderTotal: { fontSize: 13, fontWeight: '700', color: '#FF6B6B' },
  undoBar: { position: 'absolute', bottom: 40, left: 20, right: 20, backgroundColor: '#2A2A4A', borderRadius: 12, padding: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: '#3A3A5A' },
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
