import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Platform, Keyboard } from 'react-native';
import { detectCategory, getCategoryColor, getCategoryIcon } from '../utils/parser';
import { addRecurring, removeRecurring, toggleRecurringActive } from '../utils/storage';
import { formatAmount, generateId } from '../utils/helpers';
import AppIcon from '../components/AppIcon';

const FREQUENCIES = ['daily', 'weekly', 'monthly'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function RecurringScreen({ recurring, setRecurring, onBack }) {
  const [input, setInput] = useState('');
  const [frequency, setFrequency] = useState('monthly');
  const [dayOfWeek, setDayOfWeek] = useState(1); // Monday
  const [dayOfMonth, setDayOfMonth] = useState(1);

  // Parse: "spotify 15" or "grab 8 transport"
  const parseRecurringInput = (raw) => {
    const match = raw.trim().match(/(\d+\.?\d*)/);
    if (!match) return null;
    const amount = parseFloat(match[1]);
    if (isNaN(amount) || amount <= 0) return null;
    const rest = raw.trim().replace(match[0], '').trim();
    const words = rest.split(/\s+/);
    const description = words.join(' ').trim() || 'expense';
    return { amount, description };
  };

  const preview = useMemo(() => {
    if (!input.trim()) return null;
    return parseRecurringInput(input);
  }, [input]);

  const handleAdd = useCallback(async () => {
    const parsed = parseRecurringInput(input);
    if (!parsed) return;
    const item = {
      id: generateId(),
      amount: parsed.amount,
      description: parsed.description,
      category: detectCategory(parsed.description),
      frequency,
      dayOfWeek: frequency === 'weekly' ? dayOfWeek : undefined,
      dayOfMonth: frequency === 'monthly' ? dayOfMonth : undefined,
      lastRun: null,
      active: true,
    };
    setRecurring(await addRecurring(item, recurring));
    setInput(''); Keyboard.dismiss();
  }, [input, frequency, dayOfWeek, dayOfMonth, recurring]);

  const handleToggle = useCallback(async (id) => {
    setRecurring(await toggleRecurringActive(id, recurring));
  }, [recurring]);

  const handleDelete = useCallback(async (id) => {
    setRecurring(await removeRecurring(id, recurring));
  }, [recurring]);

  const activeItems = recurring.filter((r) => r.active);
  const inactiveItems = recurring.filter((r) => !r.active);

  const getScheduleText = (item) => {
    if (item.frequency === 'daily') return 'Every day';
    if (item.frequency === 'weekly') return `Every ${DAYS[item.dayOfWeek ?? 1]}`;
    if (item.frequency === 'monthly') return `Every month on day ${item.dayOfMonth ?? 1}`;
    return '';
  };

  return (
    <View style={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={onBack} activeOpacity={0.7}>
          <Text style={s.backTxt}>← Back</Text>
        </TouchableOpacity>
        <View style={s.titleRow}>
          <AppIcon name="refresh" size={22} color="#4FD1C5" />
          <Text style={s.title}> Recurring</Text>
        </View>
        <Text style={s.subtitle}>Auto-added on schedule</Text>
      </View>

      {/* Frequency toggle */}
      <View style={s.freqRow}>
        {FREQUENCIES.map((f) => (
          <TouchableOpacity key={f} onPress={() => setFrequency(f)}
            style={[s.freqBtn, frequency === f && s.freqBtnActive]} activeOpacity={0.7}>
            <Text style={[s.freqTxt, frequency === f && s.freqTxtActive]}>{f.charAt(0).toUpperCase() + f.slice(1)}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Day picker */}
      {frequency === 'weekly' && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.dayRow}>
          {DAYS.map((d, i) => (
            <TouchableOpacity key={d} onPress={() => setDayOfWeek(i)}
              style={[s.dayBtn, dayOfWeek === i && s.dayBtnActive]} activeOpacity={0.7}>
              <Text style={[s.dayTxt, dayOfWeek === i && s.dayTxtActive]}>{d}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
      {frequency === 'monthly' && (
        <View style={s.dayOfMonthRow}>
          <Text style={s.dayOfMonthLabel}>Day of month:</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
              <TouchableOpacity key={d} onPress={() => setDayOfMonth(d)}
                style={[s.domBtn, dayOfMonth === d && s.domBtnActive]} activeOpacity={0.7}>
                <Text style={[s.domTxt, dayOfMonth === d && s.domTxtActive]}>{d}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Input */}
      <View style={s.inputRow}>
        <TextInput
          style={s.input}
          placeholder='"spotify 15" or "grab 8"'
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
      {preview && (
        <View style={s.preview}>
          <View style={s.previewRow}>
            <AppIcon name={getCategoryIcon(detectCategory(preview.description))} size={14} color="#888" />
            <Text style={s.previewTxt}>
              {' '}<Text style={{ color: '#FFF', fontWeight: '700' }}>{formatAmount(preview.amount)}</Text>
              {' · '}{preview.description}{' · '}<Text style={{ color: '#6C5CE7' }}>{frequency}</Text>
            </Text>
          </View>
        </View>
      )}

      <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 100 }}>
        {activeItems.length > 0 && (
          <View>
            <Text style={s.secTitle}>Active ({activeItems.length})</Text>
            {activeItems.map((item) => (
              <View key={item.id} style={s.itemRow}>
                <View style={[s.catDot, { backgroundColor: getCategoryColor(item.category) + '22' }]}>
                  <AppIcon name={getCategoryIcon(item.category)} size={20} color={getCategoryColor(item.category)} />
                </View>
                <View style={s.itemInfo}>
                  <Text style={s.itemDesc}>{item.description}</Text>
                  <Text style={s.itemMeta}>{getScheduleText(item)} · {formatAmount(item.amount)}</Text>
                </View>
                <TouchableOpacity onPress={() => handleToggle(item.id)} style={s.pauseBtn} activeOpacity={0.7}>
                  <AppIcon name="pause" size={16} color="#888" />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleDelete(item.id)} style={s.delBtn}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <AppIcon name="close" size={13} color="#666" />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}
        {inactiveItems.length > 0 && (
          <View style={{ marginTop: 20 }}>
            <Text style={[s.secTitle, { color: '#555' }]}>Paused ({inactiveItems.length})</Text>
            {inactiveItems.map((item) => (
              <View key={item.id} style={[s.itemRow, { opacity: 0.5 }]}>
                <View style={[s.catDot, { backgroundColor: getCategoryColor(item.category) + '22' }]}>
                  <AppIcon name={getCategoryIcon(item.category)} size={20} color={getCategoryColor(item.category)} />
                </View>
                <View style={s.itemInfo}>
                  <Text style={s.itemDesc}>{item.description}</Text>
                  <Text style={s.itemMeta}>{getScheduleText(item)} · {formatAmount(item.amount)}</Text>
                </View>
                <TouchableOpacity onPress={() => handleToggle(item.id)} style={s.resumeBtn} activeOpacity={0.7}>
                  <AppIcon name="play" size={14} color="#4FD1C5" />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleDelete(item.id)} style={s.delBtn}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <AppIcon name="close" size={13} color="#666" />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}
        {recurring.length === 0 && (
          <View style={s.empty}>
            <AppIcon name="refresh" size={40} color="#333" />
            <Text style={s.emptyTxt}>No recurring expenses</Text>
            <Text style={s.emptyHint}>Add "spotify 15" as monthly above</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, paddingTop: Platform.OS === 'ios' ? 60 : 44, paddingHorizontal: 20 },
  header: { marginBottom: 16 },
  titleRow: { flexDirection: 'row', alignItems: 'center' },
  backTxt: { fontSize: 15, color: '#6C5CE7', fontWeight: '700', marginBottom: 10 },
  title: { fontSize: 26, fontWeight: '800', color: '#FFF', letterSpacing: -0.5 },
  subtitle: { fontSize: 13, color: '#666', marginTop: 2 },
  freqRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  freqBtn: { flex: 1, paddingVertical: 10, borderRadius: 12, backgroundColor: '#1A1A2E', alignItems: 'center', borderWidth: 1.5, borderColor: '#2A2A4A' },
  freqBtnActive: { borderColor: '#6C5CE7', backgroundColor: '#1E1A35' },
  freqTxt: { fontSize: 13, fontWeight: '600', color: '#666' },
  freqTxtActive: { color: '#FFF' },
  dayRow: { marginBottom: 12 },
  dayBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: '#1A1A2E', borderWidth: 1.5, borderColor: '#2A2A4A', marginRight: 8 },
  dayBtnActive: { borderColor: '#6C5CE7', backgroundColor: '#1E1A35' },
  dayTxt: { fontSize: 13, fontWeight: '600', color: '#666' },
  dayTxtActive: { color: '#FFF' },
  dayOfMonthRow: { marginBottom: 12 },
  dayOfMonthLabel: { fontSize: 12, color: '#888', fontWeight: '600', marginBottom: 8 },
  domBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#1A1A2E', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#2A2A4A', marginRight: 8 },
  domBtnActive: { borderColor: '#6C5CE7', backgroundColor: '#1E1A35' },
  domTxt: { fontSize: 12, color: '#666', fontWeight: '600' },
  domTxtActive: { color: '#FFF' },
  inputRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1A1A2E', borderRadius: 14, borderWidth: 1.5, borderColor: '#333366', paddingLeft: 14, paddingRight: 6, height: 52, marginBottom: 8 },
  input: { flex: 1, fontSize: 15, color: '#FFF', fontWeight: '500' },
  addBtn: { width: 40, height: 40, borderRadius: 11, backgroundColor: '#6C5CE7', justifyContent: 'center', alignItems: 'center' },
  addBtnOff: { backgroundColor: '#333' },
  addBtnTxt: { fontSize: 22, color: '#FFF', fontWeight: '700' },
  preview: { paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#14142A', borderRadius: 10, borderWidth: 1, borderColor: '#222244', marginBottom: 16 },
  previewRow: { flexDirection: 'row', alignItems: 'center' },
  previewTxt: { fontSize: 13, color: '#999', flex: 1 },
  secTitle: { fontSize: 15, fontWeight: '700', color: '#FFF', marginBottom: 8, marginTop: 4 },
  itemRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 12, backgroundColor: '#12121F', borderRadius: 14, marginBottom: 8, borderWidth: 1, borderColor: '#1E1E35' },
  catDot: { width: 38, height: 38, borderRadius: 11, justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  itemInfo: { flex: 1 },
  itemDesc: { fontSize: 14, fontWeight: '600', color: '#FFF', textTransform: 'capitalize' },
  itemMeta: { fontSize: 11, color: '#666', marginTop: 2 },
  pauseBtn: { width: 32, height: 32, borderRadius: 8, backgroundColor: '#1E1E35', justifyContent: 'center', alignItems: 'center', marginRight: 6 },
  resumeBtn: { width: 32, height: 32, borderRadius: 8, backgroundColor: '#1A2E1A', justifyContent: 'center', alignItems: 'center', marginRight: 6 },
  delBtn: { width: 30, height: 30, borderRadius: 8, backgroundColor: '#1E1E35', justifyContent: 'center', alignItems: 'center' },
  delTxt: { fontSize: 12, color: '#666', fontWeight: '700' },
  empty: { alignItems: 'center', paddingVertical: 40, gap: 10 },
  emptyTxt: { fontSize: 15, color: '#666', fontWeight: '600' },
  emptyHint: { fontSize: 12, color: '#444' },
});
