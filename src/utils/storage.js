/**
 * AsyncStorage wrapper for the money tracker.
 *
 * How AsyncStorage works:
 * - AsyncStorage is a simple, unencrypted, asynchronous, persistent key-value store.
 * - Data is stored locally on the device (not in the cloud).
 * - It works like localStorage in web, but is async (returns Promises).
 * - Data persists across app restarts.
 * - API: getItem(key), setItem(key, value), removeItem(key)
 * - Values must be strings, so we JSON.stringify/parse objects.
 *
 * Storage structure:
 * Key: "moneyApp"
 * Value: {
 *   transactions: [
 *     { id, amount, category, description, date }
 *   ]
 * }
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'moneyApp';

/**
 * Load all transactions from AsyncStorage.
 * Returns an array of transaction objects.
 */
export async function loadTransactions() {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      return data.transactions || [];
    }
    return [];
  } catch (error) {
    console.error('Failed to load transactions:', error);
    return [];
  }
}

/**
 * Save the full transactions array to AsyncStorage.
 */
export async function saveTransactions(transactions) {
  try {
    const data = { transactions };
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    console.error('Failed to save transactions:', error);
  }
}

/**
 * Add a single transaction and persist.
 * Returns the updated transactions array.
 */
export async function addTransaction(transaction, currentTransactions) {
  const updated = [transaction, ...currentTransactions];
  await saveTransactions(updated);
  return updated;
}

/**
 * Remove a transaction by ID and persist.
 * Returns the updated transactions array.
 */
export async function removeTransaction(id, currentTransactions) {
  const updated = currentTransactions.filter((t) => t.id !== id);
  await saveTransactions(updated);
  return updated;
}
