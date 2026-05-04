import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import AppIcon from './src/components/AppIcon';

import HomeScreen from './src/screens/HomeScreen';
import HistoryScreen from './src/screens/HistoryScreen';
import SummaryScreen from './src/screens/SummaryScreen';
import RecurringScreen from './src/screens/RecurringScreen';
import OweScreen from './src/screens/OweScreen';

import {
  loadTransactions, loadDebts, loadRecurring, processRecurring,
} from './src/utils/storage';

const TABS = [
  { key: 'home',      label: 'Home',      icon: 'home-outline',      iconActive: 'home' },
  { key: 'summary',   label: 'Summary',   icon: 'chart-bar',         iconActive: 'chart-bar' },
  { key: 'recurring', label: 'Recurring', icon: 'refresh',           iconActive: 'refresh' },
  { key: 'history',   label: 'History',   icon: 'history',           iconActive: 'history' },
];

export default function App() {
  const [tab, setTab] = useState('home');
  const [overlay, setOverlay] = useState(null); // 'owe' | null — overlays on top of tab bar
  const [transactions, setTransactions] = useState([]);
  const [debts, setDebts] = useState([]);
  const [recurring, setRecurring] = useState([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      const [savedTxns, savedDebts, savedRecurring] = await Promise.all([
        loadTransactions(),
        loadDebts(),
        loadRecurring(),
      ]);
      // Auto-add any recurring expenses due today
      const { updatedTransactions, updatedRecurring } = await processRecurring(savedTxns, savedRecurring);
      setTransactions(updatedTransactions);
      setDebts(savedDebts);
      setRecurring(updatedRecurring);
      setReady(true);
    })();
  }, []);

  if (!ready) {
    return (
      <View style={styles.loading}>
        <StatusBar style="light" />
        <View style={styles.loadingIconWrap}>
          <AppIcon name="wallet-outline" size={40} color="#4FD1C5" />
        </View>
        <Text style={styles.loadingText}>Tracker17</Text>
      </View>
    );
  }

  const renderScreen = () => {
    // Owe is a full-screen overlay
    if (overlay === 'owe') {
      return (
        <OweScreen
          debts={debts}
          setDebts={setDebts}
          onBack={() => setOverlay(null)}
        />
      );
    }
    switch (tab) {
      case 'home':
        return (
          <HomeScreen
            transactions={transactions}
            setTransactions={setTransactions}
            recurring={recurring}
            setRecurring={setRecurring}
            onNavigate={(screen) => setOverlay(screen)}
          />
        );
      case 'summary':
        return <SummaryScreen transactions={transactions} />;
      case 'recurring':
        return (
          <RecurringScreen
            recurring={recurring}
            setRecurring={setRecurring}
            onBack={() => setTab('home')}
          />
        );
      case 'history':
        return (
          <HistoryScreen
            transactions={transactions}
            setTransactions={setTransactions}
            onBack={() => setTab('home')}
          />
        );
      default:
        return null;
    }
  };

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar style="light" />

      {/* Screen content */}
      <View style={styles.screenArea}>
        {renderScreen()}
      </View>

      {/* Bottom tab bar — hidden when owe overlay is open */}
      {!overlay && (
        <View style={styles.tabBar}>
          {TABS.map((t) => {
            const isActive = tab === t.key;
            return (
              <TouchableOpacity
                key={t.key}
                style={styles.tabItem}
                onPress={() => setTab(t.key)}
                activeOpacity={0.7}
              >
                <AppIcon
                  name={isActive ? t.iconActive : t.icon}
                  size={22}
                  color={isActive ? '#4FD1C5' : '#4A4A6A'}
                />
                <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>
                  {t.label}
                </Text>
                {isActive && <View style={styles.tabIndicator} />}
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0A0A0F',
  },
  loading: {
    flex: 1,
    backgroundColor: '#0A0A0F',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingIconWrap: { width: 72, height: 72, borderRadius: 20, backgroundColor: 'rgba(79,209,197,0.12)', justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  loadingText: { fontSize: 22, fontWeight: '800', color: '#FFF', letterSpacing: -0.5 },
  screenArea: {
    flex: 1,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#12121F',
    borderTopWidth: 1,
    borderTopColor: '#1E1E35',
    paddingBottom: Platform.OS === 'ios' ? 24 : 10,
    paddingTop: 10,
    paddingHorizontal: 8,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    paddingVertical: 4,
  },
  tabLabel: { fontSize: 10, color: '#4A4A6A', fontWeight: '600', marginTop: 3 },
  tabLabelActive: { color: '#4FD1C5' },
  tabIndicator: {
    position: 'absolute',
    top: -10,
    width: 20,
    height: 3,
    backgroundColor: '#4FD1C5',
    borderRadius: 2,
  },
});
