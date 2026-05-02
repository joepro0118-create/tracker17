/**
 * Date and formatting helpers for the money tracker.
 */

/**
 * Check if a date string is from today.
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

/**
 * Check if a date string is from this week (Monday–Sunday).
 */
export function isThisWeek(dateString) {
  const date = new Date(dateString);
  const now = new Date();

  // Get start of this week (Monday)
  const startOfWeek = new Date(now);
  const day = startOfWeek.getDay();
  const diff = day === 0 ? 6 : day - 1; // adjust for Monday start
  startOfWeek.setDate(now.getDate() - diff);
  startOfWeek.setHours(0, 0, 0, 0);

  return date >= startOfWeek;
}

/**
 * Format amount as currency string (RM).
 */
export function formatAmount(amount) {
  return `RM ${amount.toFixed(2)}`;
}

/**
 * Format a date string for display.
 */
export function formatDate(dateString) {
  const date = new Date(dateString);
  const now = new Date();

  if (isToday(dateString)) {
    return date.toLocaleTimeString('en-MY', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  }

  // If this year, show "2 May"
  if (date.getFullYear() === now.getFullYear()) {
    return date.toLocaleDateString('en-MY', {
      day: 'numeric',
      month: 'short',
    });
  }

  return date.toLocaleDateString('en-MY', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * Generate a unique ID.
 */
export function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
}
