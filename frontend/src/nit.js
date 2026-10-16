export function normalizeNIT(value = '') {
  return String(value).replace(/[^0-9]/g, '').slice(0, 10);
}

export function validateNIT(value = '') {
  const raw = normalizeNIT(value);

  if (!/^\d{10}$/.test(raw)) {
    return false;
  }

  const baseDigits = raw.slice(0, 9).split('').map(Number);
  const checkDigit = Number(raw.slice(9));
  const weights = [3, 7, 13, 17, 19, 23, 29, 37, 41];
  const sum = baseDigits.reduce((total, digit, index) => total + digit * weights[index], 0);
  let expected = 11 - (sum % 11);

  if (expected === 10 || expected === 11) {
    expected = 0;
  }

  return checkDigit === expected;
}
