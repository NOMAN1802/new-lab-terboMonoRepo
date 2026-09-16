const DIST = require('path').join(__dirname, '..', 'dist', 'app');
const { computeTotals, derivePaymentStatus } = require(
  `${DIST}/modules/Invoice/invoice.totals`
);
const { startOfDhakaDay, endOfDhakaDay, parseDhakaDate } = require(
  `${DIST}/utils/dateRange`
);

let failures = 0;

const check = (label, actual, expected) => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures += 1;
  console.log(
    `${ok ? 'PASS' : 'FAIL'}  ${label}` +
      (ok
        ? ''
        : `\n        expected ${JSON.stringify(expected)}\n        got      ${JSON.stringify(actual)}`)
  );
};

const items = (...prices) => prices.map((price) => ({ price }));

console.log("\n--- 0: the centre's worked example: 2000 bill, 25% discount ---");
const ex = computeTotals(items(2000), 25, 'percent', 0, 0);
check('gross', ex.grossAmount, 2000);
check('patient saves 500', ex.discountAmount, 500);
check('patient pays 1500', ex.netPayable, 1500);

console.log('\n--- 0b: commission as a flat amount, independent of discount ---');
const flat = computeTotals(items(2000), 25, 'fixed', 300, 0);
check('patient still pays 1500', flat.netPayable, 1500);
check('commission is the flat figure', flat.commissionAmount, 300);

console.log('\n--- 0c: commission as a percent of what the patient pays ---');
const pct = computeTotals(items(2000), 25, 'percent', 20, 0);
check('patient pays 1500', pct.netPayable, 1500);
check('commission is 20% of 1500', pct.commissionAmount, 300);
check(
    'a discount lowers the commission with it',
    computeTotals(items(2000), 0, 'percent', 20, 0).commissionAmount,
    400
);

console.log('\n--- 1: 3 tests = 2000, referrer 10% discount / 15% commission ---');
const s1 = computeTotals(items(800, 700, 500), 10, 'percent', 15, 0);
check('gross', s1.grossAmount, 2000);
check('discount (10% of gross)', s1.discountAmount, 200);
check('net payable', s1.netPayable, 1800);
check('commission (15% of NET, not gross)', s1.commissionAmount, 270);
check('due', s1.dueAmount, 1800);
check('status', s1.paymentStatus, 'unpaid');

console.log('\n--- 2: partial payment of 1000 ---');
const s2 = computeTotals(items(800, 700, 500), 10, 'percent', 15, 1000);
check('due', s2.dueAmount, 800);
check('status', s2.paymentStatus, 'partial');

console.log('\n--- 3: settled in full ---');
const s3 = computeTotals(items(800, 700, 500), 10, 'percent', 15, 1800);
check('due', s3.dueAmount, 0);
check('status', s3.paymentStatus, 'paid');

console.log('\n--- 4: walk-in, no referrer (0% / 0%) ---');
const s4 = computeTotals(items(1200), 0, 'percent', 0, 0);
check('discount', s4.discountAmount, 0);
check('net equals gross', s4.netPayable, s4.grossAmount);
check('commission', s4.commissionAmount, 0);

console.log('\n--- 5: 100% discount (camp / staff case) ---');
const s5 = computeTotals(items(500), 100, 'percent', 10, 0);
check('net payable', s5.netPayable, 0);
check('commission on zero net', s5.commissionAmount, 0);
check('status is paid, not unpaid', s5.paymentStatus, 'paid');

console.log('\n--- 6: rounding stays self-consistent ---');
const s6 = computeTotals(items(333.33, 333.33, 333.33), 12.5, 'percent', 7.5, 0);
check('gross', s6.grossAmount, 999.99);
check('discount rounded to paisa', s6.discountAmount, 125);
check('net', s6.netPayable, 874.99);
check(
  'gross - discount === net (no drift)',
  Math.round((s6.grossAmount - s6.discountAmount) * 100) / 100,
  s6.netPayable
);

console.log('\n--- 7: overpayment cannot drive due negative ---');
const s7 = computeTotals(items(100), 0, 'percent', 0, 150);
check('due floors at 0', s7.dueAmount, 0);
check('status', s7.paymentStatus, 'paid');

console.log('\n--- 8: derivePaymentStatus edges ---');
check('zero-value invoice is paid', derivePaymentStatus(0, 0), 'paid');
check('nothing paid is unpaid', derivePaymentStatus(100, 0), 'unpaid');
check('part paid is partial', derivePaymentStatus(100, 40), 'partial');
check('sub-paisa remainder is paid', derivePaymentStatus(100, 99.999), 'paid');

console.log('\n--- 9: Dhaka day boundaries (UTC+6) ---');
const at2amDhaka = new Date('2026-03-10T02:00:00+06:00');
const dayStart = startOfDhakaDay(at2amDhaka);
const dayEnd = endOfDhakaDay(at2amDhaka);
check(
  '02:00 Dhaka falls inside its own Dhaka day',
  at2amDhaka >= dayStart && at2amDhaka < dayEnd,
  true
);
check(
  'Dhaka day starts 18:00 UTC previous date',
  dayStart.toISOString(),
  '2026-03-09T18:00:00.000Z'
);
check(
  'naive UTC grouping WOULD have misfiled it to the 9th',
  at2amDhaka.toISOString().slice(0, 10),
  '2026-03-09'
);
check(
  'parseDhakaDate anchors correctly',
  parseDhakaDate('2026-03-10').toISOString(),
  '2026-03-09T18:00:00.000Z'
);

console.log(
  `\n${failures === 0 ? '*** ALL CHECKS PASSED ***' : `*** ${failures} CHECK(S) FAILED ***`}\n`
);
process.exit(failures === 0 ? 0 : 1);
