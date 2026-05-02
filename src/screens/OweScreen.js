import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Platform, Keyboard } from 'react-native';
import { formatAmount, formatDate, generateId } from '../utils/helpers';
import { addDebt, removeDebt, updateDebt, toggleDebtSettled } from '../utils/storage';

export default function OweScreen({ debts, setDebts, onBack }) {
  const [input, setInput] = useState('');
  const [direction, setDirection] = useState('owed'); // 'owed'=they owe me, 'owe'=I owe them

  const parseDebt = (raw) => {
    const match = raw.trim().match(/(\d+\.?\d*)/);
    if (!match) return null;
    const amount = parseFloat(match[1]);
    if (isNaN(amount) || amount <= 0) return null;
    const rest = raw.trim().replace(match[0], '').trim();
    const words = rest.split(/\s+/);
    return { amount, person: words[0] || 'someone', note: words.slice(1).join(' ') || '' };
  };

  const handleAdd = useCallback(async () => {
    const parsed = parseDebt(input);
    if (!parsed) return;
    const debt = { id: generateId(), ...parsed, direction, settled: false, date: new Date().toISOString() };
    setDebts(await addDebt(debt, debts));
    setInput(''); Keyboard.dismiss();
  }, [input, direction, debts]);

  const handleToggle = useCallback(async (id) => {
    setDebts(await toggleDebtSettled(id, debts));
  }, [debts]);

  const handleDelete = useCallback(async (id) => {
    setDebts(await removeDebt(id, debts));
  }, [debts]);

  const summary = useMemo(() => {
    const u = debts.filter((d) => !d.settled);
    return {
      theyOweMe: u.filter((d) => d.direction === 'owed').reduce((s, d) => s + d.amount, 0),
      iOweThem: u.filter((d) => d.direction === 'owe').reduce((s, d) => s + d.amount, 0),
    };
  }, [debts]);

  const unsettled = debts.filter((d) => !d.settled);
  const settled = debts.filter((d) => d.settled);

  const renderDebt = (d, isSettled) => (
    <View key={d.id} style={[s.row, isSettled && { opacity: 0.5 }]}>
      <TouchableOpacity onPress={() => handleToggle(d.id)} style={s.checkbox} activeOpacity={0.6}>
        <Text style={isSettled ? s.checked : s.unchecked}>{isSettled ? '☑' : '☐'}</Text>
      </TouchableOpacity>
      <View style={s.info}>
        <Text style={[s.personTxt, isSettled && s.strikethrough]}>
          {d.direction === 'owed' ? `${d.person} owes you` : `You owe ${d.person}`}
        </Text>
        <Text style={s.metaTxt}>{d.note ? `${d.note} · ` : ''}{formatDate(d.date)}</Text>
      </View>
      <Text style={[s.amtTxt, { color: d.direction === 'owed' ? '#4ECDC4' : '#FF6B6B' }]}>
        {isSettled ? '' : (d.direction === 'owed' ? '+' : '-')}{formatAmount(d.amount)}
      </Text>
      <TouchableOpacity onPress={() => handleDelete(d.id)} style={s.delBtn}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
        <Text style={s.delTxt}>✕</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={onBack} activeOpacity={0.7}>
          <Text style={s.backTxt}>← Back</Text>
        </TouchableOpacity>
        <Text style={s.title}>💸 Owe Tracker</Text>
        <Text style={s.subtitle}>Track who owes who</Text>
      </View>

      <View style={s.summaryRow}>
        <View style={s.card}>
          <Text style={s.cardLabel}>They Owe Me</Text>
          <Text style={[s.cardAmt, { color: '#4ECDC4' }]}>{formatAmount(summary.theyOweMe)}</Text>
        </View>
        <View style={s.card}>
          <Text style={s.cardLabel}>I Owe Them</Text>
          <Text style={[s.cardAmt, { color: '#FF6B6B' }]}>{formatAmount(summary.iOweThem)}</Text>
        </View>
      </View>

      <View style={s.dirRow}>
        <TouchableOpacity style={[s.dirBtn, direction === 'owed' && s.dirBtnActive]} onPress={() => setDirection('owed')} activeOpacity={0.7}>
          <Text style={[s.dirTxt, direction === 'owed' && s.dirTxtActive]}>They owe me</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.dirBtn, direction === 'owe' && s.dirBtnActiveRed]} onPress={() => setDirection('owe')} activeOpacity={0.7}>
          <Text style={[s.dirTxt, direction === 'owe' && s.dirTxtActive]}>I owe them</Text>
        </TouchableOpacity>
      </View>

      <View style={s.inputRow}>
        <TextInput
          style={s.input}
          placeholder='"ali 20 lunch" or "sarah 50"'
          placeholderTextColor="#666"
          value={input}
          onChangeText={setInput}
          onSubmitEditing={handleAdd}
          returnKeyType="done"
          autoCorrect={false}
          autoCapitalize="none"
        />
        <TouchableOpacity style={[s.addBtn, !input.trim() && s.addBtnOff]}
          onPress={handleAdd} disabled={!input.trim()} activeOpacity={0.7}>
          <Text style={s.addBtnTxt}>+</Text>
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 100 }}>
        {unsettled.length > 0 && (
          <View>
            <Text style={s.secTitle}>Unsettled ({unsettled.length})</Text>
            {unsettled.map((d) => renderDebt(d, false))}
          </View>
        )}
        {settled.length > 0 && (
          <View style={{ marginTop: 20 }}>
            <Text style={[s.secTitle, { color: '#555' }]}>Settled ✓ ({settled.length})</Text>
            {settled.map((d) => renderDebt(d, true))}
          </View>
        )}
        {debts.length === 0 && (
          <View style={s.empty}>
            <Text style={s.emptyEmoji}>🤝</Text>
            <Text style={s.emptyTxt}>No debts tracked</Text>
            <Text style={s.emptyHint}>Type "ali 20 lunch" above</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, paddingTop: Platform.OS === 'ios' ? 60 : 44, paddingHorizontal: 20 },
  header: { marginBottom: 16 },
  backTxt: { fontSize: 15, color: '#6C5CE7', fontWeight: '700', marginBottom: 10 },
  title: { fontSize: 26, fontWeight: '800', color: '#FFF', letterSpacing: -0.5 },
  subtitle: { fontSize: 13, color: '#666', marginTop: 2 },
  summaryRow: { flexDirection: 'row', gap: 12, marginBottom: 14 },
  card: { flex: 1, backgroundColor: '#1A1A2E', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: '#2A2A4A' },
  cardLabel: { fontSize: 11, color: '#888', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 },
  cardAmt: { fontSize: 20, fontWeight: '800', letterSpacing: -0.5 },
  dirRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  dirBtn: { flex: 1, paddingVertical: 11, borderRadius: 12, backgroundColor: '#1A1A2E', alignItems: 'center', borderWidth: 1.5, borderColor: '#2A2A4A' },
  dirBtnActive: { borderColor: '#4ECDC4', backgroundColor: '#1A2E2E' },
  dirBtnActiveRed: { borderColor: '#FF6B6B', backgroundColor: '#2E1A1A' },
  dirTxt: { fontSize: 13, fontWeight: '600', color: '#666' },
  dirTxtActive: { color: '#FFF' },
  inputRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1A1A2E', borderRadius: 14, borderWidth: 1.5, borderColor: '#333366', paddingLeft: 14, paddingRight: 6, height: 52, marginBottom: 14 },
  input: { flex: 1, fontSize: 15, color: '#FFF', fontWeight: '500' },
  addBtn: { width: 40, height: 40, borderRadius: 11, backgroundColor: '#6C5CE7', justifyContent: 'center', alignItems: 'center' },
  addBtnOff: { backgroundColor: '#333' },
  addBtnTxt: { fontSize: 22, color: '#FFF', fontWeight: '700' },
  secTitle: { fontSize: 15, fontWeight: '700', color: '#FFF', marginBottom: 8 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 13, paddingHorizontal: 12, backgroundColor: '#12121F', borderRadius: 14, marginBottom: 8, borderWidth: 1, borderColor: '#1E1E35' },
  checkbox: { marginRight: 10 },
  unchecked: { fontSize: 22, color: '#6C5CE7' },
  checked: { fontSize: 22, color: '#4ECDC4' },
  info: { flex: 1 },
  personTxt: { fontSize: 14, fontWeight: '600', color: '#FFF', textTransform: 'capitalize' },
  strikethrough: { textDecorationLine: 'line-through', color: '#555' },
  metaTxt: { fontSize: 11, color: '#666', marginTop: 2, textTransform: 'capitalize' },
  amtTxt: { fontSize: 14, fontWeight: '700', marginRight: 6 },
  delBtn: { width: 30, height: 30, borderRadius: 8, backgroundColor: '#1E1E35', justifyContent: 'center', alignItems: 'center' },
  delTxt: { fontSize: 12, color: '#666', fontWeight: '700' },
  empty: { alignItems: 'center', paddingVertical: 40 },
  emptyEmoji: { fontSize: 40, marginBottom: 10 },
  emptyTxt: { fontSize: 15, color: '#666', fontWeight: '600' },
  emptyHint: { fontSize: 12, color: '#444', marginTop: 4 },
});
