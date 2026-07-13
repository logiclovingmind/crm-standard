// Normalize any Indian phone input to +91XXXXXXXXXX, or null if invalid.
function normalizePhone(raw) {
  if (!raw) return null;
  let digits = String(raw).replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) digits = digits.slice(2);
  if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);
  if (digits.length !== 10) return null;
  return '+91' + digits;
}

module.exports = { normalizePhone };
