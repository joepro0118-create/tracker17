/**
 * Input parser and auto-categorizer for money tracker.
 *
 * Parses inputs like "12 chicken rice" → { amount: 12, description: "chicken rice" }
 * Auto-detects category from keyword rules.
 */

const CATEGORY_KEYWORDS = {
  Food: ['rice', 'mcd', 'kfc', 'drink', 'coffee', 'tea', 'nasi', 'mee', 'chicken', 'burger', 'pizza', 'roti', 'mamak', 'lunch', 'dinner', 'breakfast', 'snack', 'cake', 'bread', 'juice', 'milk', 'starbucks', 'boba', 'teh', 'food', 'eat', 'makan'],
  Transport: ['grab', 'lrt', 'mrt', 'bus', 'taxi', 'fuel', 'petrol', 'parking', 'toll', 'train', 'gojek', 'uber', 'indriver'],
  Shopping: ['clothes', 'shoes', 'shirt', 'pants', 'bag', 'watch', 'shopee', 'lazada', 'uniqlo', 'h&m', 'zara'],
  Bills: ['wifi', 'electric', 'water', 'phone', 'bill', 'rent', 'subscription', 'netflix', 'spotify'],
  Health: ['doctor', 'medicine', 'pharmacy', 'gym', 'clinic', 'hospital'],
};

const CATEGORY_COLORS = {
  Food: '#FF6B6B',
  Transport: '#4ECDC4',
  Shopping: '#FFD93D',
  Bills: '#6C5CE7',
  Health: '#A8E6CF',
  Others: '#95A5A6',
};

const CATEGORY_ICONS = {
  Food: '🍜',
  Transport: '🚗',
  Shopping: '🛍️',
  Bills: '📄',
  Health: '💊',
  Others: '💰',
};

/**
 * Parse a raw input string into amount + description.
 * Expects the first number in the string to be the amount.
 * Examples:
 *   "12 chicken rice"  → { amount: 12, description: "chicken rice" }
 *   "chicken rice 12"  → { amount: 12, description: "chicken rice" }
 *   "5.50 grab"        → { amount: 5.5, description: "grab" }
 */
export function parseInput(raw) {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  // Match the first number (int or decimal)
  const match = trimmed.match(/(\d+\.?\d*)/);
  if (!match) return null;

  const amount = parseFloat(match[1]);
  if (isNaN(amount) || amount <= 0) return null;

  // Description is everything except the matched number
  const description = trimmed.replace(match[0], '').trim().toLowerCase();

  return {
    amount,
    description: description || 'expense',
  };
}

/**
 * Auto-detect category from a description string using keyword matching.
 */
export function detectCategory(description) {
  const lower = description.toLowerCase();
  const words = lower.split(/\s+/);

  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    for (const keyword of keywords) {
      // Check if any word starts with or matches the keyword
      if (words.some((w) => w.includes(keyword) || keyword.includes(w))) {
        return category;
      }
    }
  }

  return 'Others';
}

export function getCategoryColor(category) {
  return CATEGORY_COLORS[category] || CATEGORY_COLORS.Others;
}

export function getCategoryIcon(category) {
  return CATEGORY_ICONS[category] || CATEGORY_ICONS.Others;
}
