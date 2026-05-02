/**
 * AsyncStorage wrapper for Tracker17.
 *
 * Keys:
 *  "moneyApp"           → { transactions: [...] }
 *  "moneyApp_debts"     → [ ...debts ]
 *  "moneyApp_budget"    → { weekly: number, monthly: number }
 *  "moneyApp_recurring" → [ ...recurringItems ]
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY   = 'moneyApp';
const DEBTS_KEY     = 'moneyApp_debts';
const BUDGET_KEY    = 'moneyApp_budget';
const RECURRING_KEY = 'moneyApp_recurring';

// ==================== TRANSACTIONS ====================

export async function loadTransactions() {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      return data.transactions || [];
    }
    return [];
  } catch (e) {
    console.error('loadTransactions:', e);
    return [];
  }
}

export async function saveTransactions(transactions) {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ transactions }));
  } catch (e) {
    console.error('saveTransactions:', e);
  }
}

export async function addTransaction(transaction, currentTransactions) {
  const updated = [transaction, ...currentTransactions];
  await saveTransactions(updated);
  return updated;
}

export async function removeTransaction(id, currentTransactions) {
  const updated = currentTransactions.filter((t) => t.id !== id);
  await saveTransactions(updated);
  return updated;
}

export async function updateTransaction(id, changes, currentTransactions) {
  const updated = currentTransactions.map((t) =>
    t.id === id ? { ...t, ...changes } : t
  );
  await saveTransactions(updated);
  return updated;
}

// ==================== DEBTS / OWE ====================

export async function loadDebts() {
  try {
    const raw = await AsyncStorage.getItem(DEBTS_KEY);
    return raw ? JSON.parse(raw) || [] : [];
  } catch (e) {
    console.error('loadDebts:', e);
    return [];
  }
}

export async function saveDebts(debts) {
  try {
    await AsyncStorage.setItem(DEBTS_KEY, JSON.stringify(debts));
  } catch (e) {
    console.error('saveDebts:', e);
  }
}

export async function addDebt(debt, currentDebts) {
  const updated = [debt, ...currentDebts];
  await saveDebts(updated);
  return updated;
}

export async function removeDebt(id, currentDebts) {
  const updated = currentDebts.filter((d) => d.id !== id);
  await saveDebts(updated);
  return updated;
}

export async function updateDebt(id, changes, currentDebts) {
  const updated = currentDebts.map((d) =>
    d.id === id ? { ...d, ...changes } : d
  );
  await saveDebts(updated);
  return updated;
}

export async function toggleDebtSettled(id, currentDebts) {
  const updated = currentDebts.map((d) =>
    d.id === id ? { ...d, settled: !d.settled } : d
  );
  await saveDebts(updated);
  return updated;
}

// ==================== BUDGET ====================

export async function loadBudget() {
  try {
    const raw = await AsyncStorage.getItem(BUDGET_KEY);
    return raw ? JSON.parse(raw) : { weekly: 0, monthly: 0 };
  } catch (e) {
    console.error('loadBudget:', e);
    return { weekly: 0, monthly: 0 };
  }
}

export async function saveBudget(budget) {
  try {
    await AsyncStorage.setItem(BUDGET_KEY, JSON.stringify(budget));
  } catch (e) {
    console.error('saveBudget:', e);
  }
}

// ==================== RECURRING EXPENSES ====================
// Each item: { id, amount, description, category, frequency ('daily'|'weekly'|'monthly'),
//              dayOfWeek (0-6 for weekly), dayOfMonth (1-31 for monthly),
//              lastRun (ISO date string or null), active (bool) }

export async function loadRecurring() {
  try {
    const raw = await AsyncStorage.getItem(RECURRING_KEY);
    return raw ? JSON.parse(raw) || [] : [];
  } catch (e) {
    console.error('loadRecurring:', e);
    return [];
  }
}

export async function saveRecurring(items) {
  try {
    await AsyncStorage.setItem(RECURRING_KEY, JSON.stringify(items));
  } catch (e) {
    console.error('saveRecurring:', e);
  }
}

export async function addRecurring(item, currentItems) {
  const updated = [item, ...currentItems];
  await saveRecurring(updated);
  return updated;
}

export async function removeRecurring(id, currentItems) {
  const updated = currentItems.filter((r) => r.id !== id);
  await saveRecurring(updated);
  return updated;
}

export async function toggleRecurringActive(id, currentItems) {
  const updated = currentItems.map((r) =>
    r.id === id ? { ...r, active: !r.active } : r
  );
  await saveRecurring(updated);
  return updated;
}

/**
 * Check recurring expenses and auto-insert any that are due today.
 * Called on every app launch.
 * Returns { updatedTransactions, updatedRecurring, newlyAdded[] }
 */
export async function processRecurring(currentTransactions, currentRecurring) {
  const now = new Date();
  const todayStr = now.toDateString();
  const newlyAdded = [];
  let updatedRecurring = [...currentRecurring];

  for (let i = 0; i < updatedRecurring.length; i++) {
    const item = updatedRecurring[i];
    if (!item.active) continue;

    // Check if already ran today
    if (item.lastRun && new Date(item.lastRun).toDateString() === todayStr) continue;

    let isDue = false;

    if (item.frequency === 'daily') {
      isDue = true;
    } else if (item.frequency === 'weekly') {
      // dayOfWeek: 0=Sun, 1=Mon, ... 6=Sat
      isDue = now.getDay() === (item.dayOfWeek ?? 1);
    } else if (item.frequency === 'monthly') {
      isDue = now.getDate() === (item.dayOfMonth ?? 1);
    }

    if (isDue) {
      const transaction = {
        id: `rec_${item.id}_${Date.now()}`,
        amount: item.amount,
        description: item.description,
        category: item.category,
        date: now.toISOString(),
        isRecurring: true,
      };
      newlyAdded.push(transaction);
      updatedRecurring[i] = { ...item, lastRun: now.toISOString() };
    }
  }

  let updatedTransactions = currentTransactions;
  if (newlyAdded.length > 0) {
    updatedTransactions = [...newlyAdded, ...currentTransactions];
    await saveTransactions(updatedTransactions);
    await saveRecurring(updatedRecurring);
  }

  return { updatedTransactions, updatedRecurring, newlyAdded };
}
