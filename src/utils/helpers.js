/**
 * Date and formatting helpers for Tracker17.
 */

export function isToday(dateString) {
  const date = new Date(dateString);
  const today = new Date();
  return (
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear()
  );
}

export function isThisWeek(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const startOfWeek = new Date(now);
  const day = startOfWeek.getDay();
  const diff = day === 0 ? 6 : day - 1;
  startOfWeek.setDate(now.getDate() - diff);
  startOfWeek.setHours(0, 0, 0, 0);
  return date >= startOfWeek;
}

export function isThisMonth(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
}

export function isLastMonth(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return (
    date.getMonth() === lastMonth.getMonth() &&
    date.getFullYear() === lastMonth.getFullYear()
  );
}

export function formatAmount(amount) {
  return `RM ${amount.toFixed(2)}`;
}

export function formatDate(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  if (isToday(dateString)) {
    return date.toLocaleTimeString('en-MY', { hour: '2-digit', minute: '2-digit', hour12: true });
  }
  if (date.getFullYear() === now.getFullYear()) {
    return date.toLocaleDateString('en-MY', { day: 'numeric', month: 'short' });
  }
  return date.toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
}

export function getMonthName(date = new Date()) {
  return date.toLocaleDateString('en-MY', { month: 'long', year: 'numeric' });
}

/** Returns last N weeks' Monday dates + totals for sparkline */
export function getWeeklyTotals(transactions, numWeeks = 4) {
  const result = [];
  const now = new Date();
  for (let w = numWeeks - 1; w >= 0; w--) {
    const weekStart = new Date(now);
    const dayOfWeek = weekStart.getDay();
    const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    weekStart.setDate(now.getDate() - diffToMonday - w * 7);
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);
    const total = transactions
      .filter((t) => {
        const d = new Date(t.date);
        return d >= weekStart && d <= weekEnd;
      })
      .reduce((s, t) => s + t.amount, 0);
    result.push({
      label: w === 0 ? 'This week' : `${w}w ago`,
      total,
      weekStart,
    });
  }
  return result;
}
