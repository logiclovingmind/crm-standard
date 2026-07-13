const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

function toIST(date) {
  return new Date(date.getTime() + IST_OFFSET_MS).toISOString().replace('Z', '+05:30');
}

function nowIST() {
  return toIST(new Date());
}

function istHoursAgo(hours) {
  return toIST(new Date(Date.now() - hours * 60 * 60 * 1000));
}

function istMonthPrefix(monthsBack = 0) {
  const now = new Date(Date.now() + IST_OFFSET_MS);
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - monthsBack, 1));
  return d.toISOString().slice(0, 7);
}

module.exports = { nowIST, istHoursAgo, istMonthPrefix };
