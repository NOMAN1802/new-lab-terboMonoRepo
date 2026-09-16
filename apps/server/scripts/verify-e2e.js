/**
 * End-to-end verification against a real MongoDB (in-memory replica set, so
 * the payment transactions actually run). Exercises the service layer the API
 * calls, not reimplementations of it.
 */
process.env.NODE_ENV = 'development';


const mongoose = require('mongoose');
const {
    MongoMemoryReplSet,
} = require('mongodb-memory-server');

const DIST = require('path').join(__dirname, '..', 'dist', 'app');
const { User } = require(`${DIST}/modules/User/user.model`);
const { Patient } = require(`${DIST}/modules/Patient/patient.model`);
const { TestCategory } = require(`${DIST}/modules/TestCategory/test-category.model`);
const { Test } = require(`${DIST}/modules/Test/test.model`);
const { Referrer } = require(`${DIST}/modules/Referrer/referrer.model`);
const { Invoice } = require(`${DIST}/modules/Invoice/invoice.model`);
const { Payment } = require(`${DIST}/modules/Payment/payment.model`);

const { InvoiceServices } = require(`${DIST}/modules/Invoice/invoice.service`);
const { PaymentServices } = require(`${DIST}/modules/Payment/payment.service`);
const {
    CommissionPayoutServices,
} = require(`${DIST}/modules/CommissionPayout/commission-payout.service`);
const { serializeInvoice } = require(`${DIST}/modules/Invoice/invoice.serializer`);
const { ReportsServices } = require(`${DIST}/modules/Reports/reports.service`);
const { DashboardServices } = require(`${DIST}/modules/Dashboard/dashboard.service`);
const { resolveDateRange } = require(`${DIST}/utils/dateRange`);

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
const rejects = async (label, fn, matcher) => {
    try {
        await fn();
        failures += 1;
        console.log(`FAIL  ${label}\n        expected a rejection, but it succeeded`);
    } catch (error) {
        const ok = !matcher || String(error.message).includes(matcher);
        if (!ok) failures += 1;
        console.log(
            `${ok ? 'PASS' : 'FAIL'}  ${label}` +
                (ok ? '' : `\n        message was: ${error.message}`)
        );
    }
};

(async () => {
    console.log('Starting in-memory MongoDB replica set (transactions need one)...');
    const replSet = await MongoMemoryReplSet.create({
        replSet: { count: 1, storageEngine: 'wiredTiger' },
    });
    await mongoose.connect(replSet.getUri(), { dbName: 'newlab_verify' });
    console.log('connected\n');

    try {
        // ---- seed ----
        const admin = await User.create({
            name: 'Dr Admin', email: 'admin@newlab.test', role: 'admin',
            mobileNumber: '01700000000', password: 'secret123',
        });
        const reception = await User.create({
            name: 'Reception One', email: 'front@newlab.test', role: 'receptionist',
            mobileNumber: '01700000001', password: 'secret123',
        });

        const dept = await TestCategory.create({ name: 'Pathology' });
        const [cbc, lipid, xray] = await Test.create([
            { testCode: 'CBC', name: 'Complete Blood Count', price: 800, category: dept._id, categoryName: 'Pathology' },
            { testCode: 'LIPID', name: 'Lipid Profile', price: 700, category: dept._id, categoryName: 'Pathology' },
            { testCode: 'XRC', name: 'X-Ray Chest', price: 500, category: dept._id, categoryName: 'Pathology' },
        ]);

        const referrer = await Referrer.create({
            referrerCode: 'RFE-001', name: 'Dr. Rakesh Shaha', phone: '01711111111',
            defaultDiscountPercent: 10,
            defaultCommissionType: 'percent', defaultCommissionValue: 15,
        });

        // Through the service, not the model, so patient numbering and the
        // audit entry are both exercised.
        const { PatientServices } = require(`${DIST}/modules/Patient/patient.service`);
        const patient = await PatientServices.createPatient(
            { name: 'Ayesha Rahman', age: 34, gender: 'female', phone: '01911111111' },
            String(reception._id)
        );
        check('patient id assigned', patient.patientId, 'PT-000001');

        console.log('--- 1: booking 3 tests (2000) with 10% discount / 15% commission ---');
        let invoice = await InvoiceServices.createInvoice(
            { patient: String(patient._id), referrer: String(referrer._id),
              testIds: [String(cbc._id), String(lipid._id), String(xray._id)] },
            String(reception._id)
        );
        const { dhakaDateParts } = require(`${DIST}/utils/dateRange`);
        const { mm, dd, yy } = dhakaDateParts(new Date());
        check('invoice number is NLDC-MM-DD-YY-NNN',
            invoice.invoiceNumber, `NLDC-${mm}-${dd}-${yy}-001`);
        check('gross', invoice.grossAmount, 2000);
        check('discount', invoice.discountAmount, 200);
        check('net payable', invoice.netPayable, 1800);
        check('commission (15% of net)', invoice.commissionAmount, 270);
        check('due', invoice.dueAmount, 1800);
        check('status', invoice.paymentStatus, 'unpaid');
        check('terms frozen onto invoice',
            [invoice.discountPercent, invoice.commissionType, invoice.commissionValue],
            [10, 'percent', 15]);
        check('patient snapshot taken', invoice.patientInfo.patientId, 'PT-000001');

        console.log('\n--- 2: prices come from the catalogue, not the request ---');
        // A tampered payload carrying its own prices must have no effect.
        const tampered = await InvoiceServices.createInvoice(
            { patient: String(patient._id), testIds: [String(cbc._id)],
              grossAmount: 1, netPayable: 1, paidAmount: 999,
              items: [{ price: 1 }], discountPercent: 0 },
            String(reception._id)
        );
        check('price taken from Test collection', tampered.items[0].price, 800);
        check('client-sent grossAmount ignored', tampered.grossAmount, 800);
        check('client-sent paidAmount ignored', tampered.paidAmount, 0);
        check('due derived, not accepted', tampered.dueAmount, 800);

        console.log('\n--- 3: partial then full payment ---');
        const first = await PaymentServices.createPayment(
            { invoice: String(invoice._id), amount: 1000 }, String(reception._id)
        );
        check('receipt issued', first.payment.receiptNumber, 'RCP-000001');
        check('paid cached on invoice', first.invoice.paidAmount, 1000);
        check('due', first.invoice.dueAmount, 800);
        check('status', first.invoice.paymentStatus, 'partial');

        await rejects(
            'overpayment rejected (900 on an 800 due)',
            () => PaymentServices.createPayment(
                { invoice: String(invoice._id), amount: 900 }, String(reception._id)
            ),
            'exceeds the outstanding due'
        );

        const second = await PaymentServices.createPayment(
            { invoice: String(invoice._id), amount: 800 }, String(reception._id)
        );
        check('due settled', second.invoice.dueAmount, 0);
        check('status', second.invoice.paymentStatus, 'paid');

        console.log('\n--- 4: voiding a payment reverses it ---');
        const voided = await PaymentServices.voidPayment(
            String(second.payment._id), String(admin._id), 'entered twice'
        );
        check('due goes back up', voided.invoice.dueAmount, 800);
        check('status reverts to partial', voided.invoice.paymentStatus, 'partial');
        check('voided payment kept for audit', voided.payment.isVoided, true);
        check('void reason recorded', voided.payment.voidReason, 'entered twice');

        const ledger = await PaymentServices.getInvoicePayments(String(invoice._id));
        check('all receipts retained (none deleted)', ledger.length, 2);

        console.log('\n--- 4b: same-day invoice numbers stay unique ---');
        // invoiceNumber is uniquely indexed, so the per-day counter is what
        // stops the second booking of a day colliding with the first.
        const sameDay = await InvoiceServices.createInvoice(
            { patient: String(patient._id), testIds: [String(cbc._id)] },
            String(reception._id)
        );
        check('second booking today increments the tail',
            sameDay.invoiceNumber, `NLDC-${mm}-${dd}-${yy}-003`);
        check('numbers are distinct',
            sameDay.invoiceNumber !== invoice.invoiceNumber, true);

        console.log('\n--- 4c: collect full payment at booking ---');
        const settledAtCounter = await InvoiceServices.createInvoice(
            { patient: String(patient._id), testIds: [String(lipid._id)],
              collectFullPayment: true },
            String(reception._id)
        );
        check('paid in one step', settledAtCounter.paidAmount, 700);
        check('nothing left due', settledAtCounter.dueAmount, 0);
        check('status', settledAtCounter.paymentStatus, 'paid');

        const counterReceipts = await PaymentServices.getInvoicePayments(
            String(settledAtCounter._id)
        );
        check('a receipt was issued with the booking', counterReceipts.length, 1);
        check('receipt amount', counterReceipts[0].amount, 700);

        // A fully discounted visit has nothing to collect and must not create a
        // zero-value receipt.
        const fullyWaived = await Referrer.create({
            referrerCode: 'RFE-FREE', name: 'Camp Discount', phone: '01722222222',
            defaultDiscountPercent: 100,
            defaultCommissionType: 'percent', defaultCommissionValue: 0,
        });
        const freeVisit = await InvoiceServices.createInvoice(
            { patient: String(patient._id), referrer: String(fullyWaived._id),
              testIds: [String(xray._id)], collectFullPayment: true },
            String(reception._id)
        );
        check('fully discounted invoice is already paid', freeVisit.paymentStatus, 'paid');
        check('no zero-value receipt created',
            (await PaymentServices.getInvoicePayments(String(freeVisit._id))).length, 0);

        console.log('\n--- 5: walk-in with no referrer ---');
        const walkIn = await InvoiceServices.createInvoice(
            { patient: String(patient._id), testIds: [String(xray._id)] },
            String(reception._id)
        );
        check('no discount', walkIn.discountAmount, 0);
        check('net equals gross', walkIn.netPayable, walkIn.grossAmount);
        check('no commission accrues', walkIn.commissionAmount, 0);
        check('no referrer attached', walkIn.referrer, undefined);

        console.log('\n--- 6: role-based field restriction ---');
        // Re-read: `invoice` is the object createInvoice returned, so its
        // cached totals predate the payments above.
        const current = await Invoice.findById(invoice._id);
        const asAdmin = serializeInvoice(current, 'admin');
        const asReception = serializeInvoice(current, 'receptionist');

        // The commission line prints on the invoice, and a receptionist is the
        // one printing it, so per-invoice figures are returned to both roles.
        check('admin sees commission', typeof asAdmin.commissionAmount, 'number');
        check('receptionist: commission retained for the invoice', asReception.commissionAmount, 270);
        check('receptionist: gross retained', asReception.grossAmount, 2000);
        check('receptionist: discount retained', asReception.discountAmount, 200);
        check('receptionist: net retained', asReception.netPayable, 1800);
        check('receptionist: due retained', asReception.dueAmount, 800);

        // The referrer's standing rate card is a commercial term across all
        // their patients, not a figure on this invoice.
        const populated = await Invoice.findById(invoice._id).populate('referrer');
        const withReferrer = serializeInvoice(populated, 'receptionist');
        check('receptionist: referrer default discount withheld',
            'defaultDiscountPercent' in withReferrer.referrer, false);
        check('receptionist: referrer default commission withheld',
            'defaultCommissionValue' in withReferrer.referrer, false);

        console.log('\n--- 7: invoice edits respect the ledger ---');
        await rejects(
            'cannot reduce net below what was already collected',
            () => InvoiceServices.updateInvoiceItems(
                String(invoice._id), [String(xray._id)]
            ),
            'below the amount already collected'
        );
        await rejects(
            'cannot cancel an invoice that has payments',
            () => InvoiceServices.cancelInvoice(String(invoice._id), String(admin._id), 'oops'),
            'payments recorded'
        );

        console.log('\n--- 8: commission payout settles accrued commission ---');
        const pendingBefore = await CommissionPayoutServices.getPendingCommission(
            String(referrer._id)
        );
        check('one invoice pending', pendingBefore.invoices.length, 1);
        check('pending total', pendingBefore.totalPending, 270);

        const payout = await CommissionPayoutServices.createPayout(
            { referrer: String(referrer._id) }, String(admin._id)
        );
        check('payout numbered', payout.payoutNumber, 'CPO-000001');
        check('payout amount', payout.amount, 270);

        const pendingAfter = await CommissionPayoutServices.getPendingCommission(
            String(referrer._id)
        );
        check('nothing pending after payout', pendingAfter.totalPending, 0);

        const settled = await Invoice.findById(invoice._id);
        check('invoice marked commission-paid', settled.commissionStatus, 'paid');

        await rejects(
            'cannot pay out twice',
            () => CommissionPayoutServices.createPayout(
                { referrer: String(referrer._id) }, String(admin._id)
            ),
            'No pending commission'
        );

        console.log('\n--- 9: reports reconcile with the ledger ---');
        const wide = resolveDateRange({ startDate: '2020-01-01', endDate: '2030-12-31' });
        const financial = await ReportsServices.getFinancialSummary(wide);

        const ledgerTotal = (await Payment.aggregate([
            { $match: { isVoided: false } },
            { $group: { _id: null, total: { $sum: '$amount' } } },
        ]))[0].total;

        check('cash collected matches the payment ledger', financial.cashCollected, ledgerTotal);
        // 1000 on the first invoice (800 of it voided) + 700 taken at the counter
        check('cash collected excludes the voided receipt', financial.cashCollected, 1700);
        // invoice, tampered, same-day, counter-settled, fully-discounted, walk-in
        check('invoices counted', financial.invoiceCount, 6);
        check('gross billed', financial.grossBilled, 2000 + 800 + 800 + 700 + 500 + 500);
        check('discount given', financial.discountGiven, 200 + 500);

        const dues = await ReportsServices.getDuesReport(wide);
        const outstandingSum = (await Invoice.aggregate([
            { $match: { isCancelled: { $ne: true }, dueAmount: { $gt: 0 } } },
            { $group: { _id: null, total: { $sum: '$dueAmount' } } },
        ]))[0].total;
        check('dues report matches invoice balances', dues.summary.totalDue, outstandingSum);

        const commissionReport = await ReportsServices.getReferralCommissionReport(wide);
        check('commission accrued', commissionReport.summary.commissionAccrued, 270);
        check('commission paid', commissionReport.summary.commissionPaid, 270);
        check('commission pending', commissionReport.summary.commissionPending, 0);

        console.log('\n--- 10: dashboards differ by role ---');
        const adminView = await DashboardServices.getAdminDashboard(wide, 'daily');
        const receptionView = await DashboardServices.getReceptionistDashboard(
            reception._id
        );

        check('admin payload carries commission', typeof adminView.commission.accrued, 'number');
        check('admin payload carries revenue', typeof adminView.period.collected, 'number');
        check('receptionist payload has NO commission key', 'commission' in receptionView, false);
        check('receptionist payload has NO period revenue', 'period' in receptionView, false);
        check('receptionist sees report workload', typeof receptionView.reports.pending, 'number');
        check('receptionist sees outstanding to collect', Array.isArray(receptionView.pendingPayments), true);

        console.log('\n--- 11: activity is audited ---');
        const { ActivityLogServices } = require(
            `${DIST}/modules/ActivityLog/activity-log.service`
        );
        const { ActivityLog } = require(`${DIST}/modules/ActivityLog/activity-log.model`);

        const actions = await ActivityLog.distinct('action');
        for (const expected of [
            'patient.registered',
            'invoice.created',
            'payment.recorded',
            'payment.voided',
            'commission.paid_out',
        ]) {
            check(`${expected} is logged`, actions.includes(expected), true);
        }

        const voidEntry = await ActivityLog.findOne({ action: 'payment.voided' });
        check('void entry names the actor', voidEntry.actorName, 'Dr Admin');
        check('void entry keeps the reason', voidEntry.meta.reason, 'entered twice');

        const perUser = await ActivityLogServices.getActivityByUser(wide);
        check('activity is attributed per user', perUser.length >= 2, true);
        check('every entry has a readable summary',
            (await ActivityLog.find()).every((e) => typeof e.summary === 'string' && e.summary.length > 0),
            true);

        console.log('\n--- 12: report upload status transitions ---');
        const withReport = await Invoice.findById(walkIn._id);
        check('report starts pending', withReport.items[0].reportStatus, 'pending');
        await rejects(
            'cannot mark delivered before upload',
            () => InvoiceServices.markReportDelivered(
                String(walkIn._id), String(withReport.items[0]._id), String(reception._id)
            ),
            'must be uploaded'
        );
    } catch (error) {
        failures += 1;
        console.error('\nUNEXPECTED ERROR:', error);
    } finally {
        await mongoose.disconnect();
        await replSet.stop();
        console.log(
            `\n${failures === 0 ? '*** ALL END-TO-END CHECKS PASSED ***' : `*** ${failures} CHECK(S) FAILED ***`}\n`
        );
        process.exit(failures === 0 ? 0 : 1);
    }
})();
