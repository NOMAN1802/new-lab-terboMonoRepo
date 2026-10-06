/**
 * Verifies refunds: a negative entry in the payment ledger that hands money
 * back, nets out of every cash total, and is refused when it would break
 * something (more than was paid, commission already paid out, a receipt that
 * has been refunded). Also the appointment path: cancel and refund in one step.
 * Needs a replica set: payments run in transactions.
 */
process.env.NODE_ENV = 'development';

const mongoose = require('mongoose');
const { MongoMemoryReplSet } = require('mongodb-memory-server');

const DIST = require('path').join(__dirname, '..', 'dist', 'app');
const { User } = require(`${DIST}/modules/User/user.model`);
const { Patient } = require(`${DIST}/modules/Patient/patient.model`);
const { TestCategory } = require(`${DIST}/modules/TestCategory/test-category.model`);
const { Test } = require(`${DIST}/modules/Test/test.model`);
const { Invoice } = require(`${DIST}/modules/Invoice/invoice.model`);
const { Payment } = require(`${DIST}/modules/Payment/payment.model`);
const { Appointment } = require(`${DIST}/modules/Appointment/appointment.model`);
const { DoctorServices } = require(`${DIST}/modules/Doctor/doctor.service`);
const { DoctorScheduleServices } = require(`${DIST}/modules/DoctorSchedule/doctor-schedule.service`);
const { AppointmentServices } = require(`${DIST}/modules/Appointment/appointment.service`);
const { InvoiceServices } = require(`${DIST}/modules/Invoice/invoice.service`);
const { PaymentServices } = require(`${DIST}/modules/Payment/payment.service`);
const { ReportsServices } = require(`${DIST}/modules/Reports/reports.service`);
const { DashboardServices } = require(`${DIST}/modules/Dashboard/dashboard.service`);
const { resolveDateRange } = require(`${DIST}/utils/dateRange`);

let failures = 0;
const check = (label, actual, expected) => {
    const ok = JSON.stringify(actual) === JSON.stringify(expected);
    if (!ok) failures += 1;
    console.log(
        `${ok ? 'PASS' : 'FAIL'}  ${label}` +
            (ok ? '' : `\n      expected ${JSON.stringify(expected)}\n      actual   ${JSON.stringify(actual)}`)
    );
};

const rejectsWith = async (label, status, fn) => {
    try {
        await fn();
        check(label, 'resolved', `rejected with ${status}`);
    } catch (error) {
        check(label, error.statusCode, status);
    }
};

const dhakaDay = (offsetDays) =>
    new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Dhaka' }).format(new Date(Date.now() + offsetDays * 864e5));

(async () => {
    const replSet = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } });
    await mongoose.connect(replSet.getUri(), { dbName: 'newlab_verify_refunds' });
    await Appointment.init();

    try {
        const admin = await User.create({ name: 'Admin One', role: 'admin', email: 'admin@t.local', mobileNumber: '017', password: 'secret123' });
        const reception = await User.create({ name: 'Desk One', role: 'receptionist', email: 'desk@t.local', mobileNumber: '018', password: 'secret123' });
        const adminId = String(admin._id);
        const deskId = String(reception._id);
        const asAdmin = { _id: adminId, role: 'admin' };

        const dept = await TestCategory.create({ name: 'Pathology' });
        const cbc = await Test.create({ testCode: 'CBC', name: 'Complete Blood Count', price: 800, category: dept._id, categoryName: 'Pathology' });
        const [p1, p2, p3] = await Promise.all(
            [1, 2, 3].map((n) =>
                Patient.create({ patientId: `PT-00000${n}`, name: `Patient ${n}`, age: 30, gender: 'female', phone: `0180000000${n}` })
            )
        );

        const lab = await InvoiceServices.createInvoice({ patient: String(p1._id), testIds: [String(cbc._id)], collectFullPayment: true }, deskId);
        const labId = String(lab._id);
        check('the invoice is paid in full to start with', [lab.paidAmount, lab.paymentStatus], [800, 'paid']);

        // ── A partial refund ──────────────────────────────────────────────
        console.log('--- refunding part of a payment ---');
        const first = await PaymentServices.refundPayment({ invoice: labId, amount: 300, reason: 'One test not done' }, adminId);
        check('the refund is a negative ledger entry with its own number', [first.payment.kind, first.payment.amount, first.payment.receiptNumber], ['refund', -300, 'RFD-000001']);
        check('it records who handed the money back and why', [first.payment.receivedByName, first.payment.note], ['Admin One', 'One test not done']);
        check('the invoice shows what is left paid and what is owed again', [first.invoice.paidAmount, first.invoice.dueAmount, first.invoice.paymentStatus], [500, 300, 'partial']);
        const ledger = await PaymentServices.getInvoicePayments(labId);
        check('the receipt and the refund both stay on record', ledger.map((p) => [p.kind ?? 'payment', p.amount]), [['payment', 800], ['refund', -300]]);

        await rejectsWith('more than was paid cannot be refunded', 400, () => PaymentServices.refundPayment({ invoice: labId, amount: 500.01, reason: 'too much' }, adminId));
        await rejectsWith('nor a zero amount', 400, () => PaymentServices.refundPayment({ invoice: labId, amount: 0, reason: 'nothing' }, adminId));
        const unpaid = await InvoiceServices.createInvoice({ patient: String(p2._id), testIds: [String(cbc._id)] }, deskId);
        await rejectsWith('an unpaid invoice has nothing to refund', 400, () => PaymentServices.refundPayment({ invoice: String(unpaid._id), amount: 100, reason: 'none' }, adminId));
        await rejectsWith('an unknown invoice is a 404', 404, () => PaymentServices.refundPayment({ invoice: '64b000000000000000000000', amount: 1, reason: 'none' }, adminId));

        // ── Books and reports ─────────────────────────────────────────────
        console.log('\n--- the books ---');
        const wide = resolveDateRange({ startDate: '2020-01-01', endDate: '2030-12-31' });
        const financial = await ReportsServices.getFinancialSummary(wide);
        check('cash collected is net of the refund', financial.cashCollected, 500);
        check('and the refund is reported on its own', financial.cashRefunded, 300);
        const till = await ReportsServices.getCollectionByUserReport(wide);
        const byName = Object.fromEntries(till.rows.map((r) => [r.name, [r.collected, r.receipts]]));
        check('the till shows the cash taken by the desk and the cash paid out by the admin', byName, { 'Desk One': [800, 1], 'Admin One': [-300, 0] });
        const revenue = await ReportsServices.getRevenueReport(wide, 'daily');
        check('a refund is not counted as a receipt', [revenue.summary.collected, revenue.summary.receipts], [500, 1]);
        const adminView = await DashboardServices.getAdminDashboard(wide, 'daily');
        check('the dashboard collected figure is net', adminView.period.collected, 500);

        // ── Paying again after a refund ───────────────────────────────────
        console.log('\n--- paying again, and correcting entries ---');
        const repaid = await PaymentServices.createPayment({ invoice: labId, amount: 300 }, deskId);
        check('the patient can pay the refunded part again', [repaid.invoice.paidAmount, repaid.invoice.paymentStatus], [800, 'paid']);
        await rejectsWith('a receipt with refunds against it cannot be voided', 409, async () => {
            const original = ledger.find((p) => (p.kind ?? 'payment') === 'payment');
            await PaymentServices.voidPayment(String(original._id), adminId, 'entered twice');
        });
        check('and nothing changed', (await Invoice.findById(labId)).paidAmount, 800);
        await rejectsWith('a refund cannot be voided if the patient has since paid again', 409, () =>
            PaymentServices.voidPayment(String(first.payment._id), adminId, 'wrong'));

        const second = await PaymentServices.refundPayment({ invoice: labId, amount: 100, reason: 'Courtesy' }, adminId);
        check('a second refund is numbered in sequence', second.payment.receiptNumber, 'RFD-000002');
        const undone = await PaymentServices.voidPayment(String(second.payment._id), adminId, 'entered by mistake');
        check('a refund entered by mistake can be voided, restoring the amount', [undone.invoice.paidAmount, undone.invoice.paymentStatus], [800, 'paid']);

        // ── Commission ────────────────────────────────────────────────────
        await Invoice.updateOne({ _id: labId }, { $set: { commissionStatus: 'paid' } });
        await rejectsWith('no refund once the commission has been paid out', 409, () => PaymentServices.refundPayment({ invoice: labId, amount: 50, reason: 'x y z' }, adminId));
        await Invoice.updateOne({ _id: labId }, { $set: { commissionStatus: 'pending' } });

        // ── Refund everything, then cancel the invoice ────────────────────
        const all = await PaymentServices.refundPayment({ invoice: labId, amount: 800, reason: 'Patient left' }, adminId);
        check('refunding everything leaves the invoice unpaid', [all.invoice.paidAmount, all.invoice.dueAmount, all.invoice.paymentStatus], [0, 800, 'unpaid']);
        const cancelled = await InvoiceServices.cancelInvoice(labId, adminId, 'Patient left');
        check('and an invoice with no money on it can then be cancelled', cancelled.isCancelled, true);

        // ── An appointment: cancel and refund in one step ─────────────────
        console.log('\n--- cancelling a paid appointment ---');
        const doctor = await DoctorServices.createDoctor({ name: 'Dr A', specialty: 'Medicine', phone: '01711111111', consultationFee: 500, email: 'a@t.local', password: 'secret123' }, adminId);
        const asDoctor = { _id: String(doctor.user), role: 'doctor' };
        const schedule = await DoctorScheduleServices.createSchedule({ doctor: String(doctor._id), date: dhakaDay(2), startTime: '09:00', endTime: '10:00', slotMinutes: 15 }, adminId);
        const sid = String(schedule._id);
        await DoctorScheduleServices.approveSchedule(sid, asDoctor);
        const book = (patient, slotIndex) =>
            AppointmentServices.createAppointment({ schedule: sid, slotIndex, patient: String(patient._id), collectFullPayment: true }, deskId);

        const a1 = await book(p1, 0);
        await rejectsWith('cancelling without a refund is still refused while it is paid', 409, () => AppointmentServices.cancel(String(a1._id), 'patient called', asAdmin));
        check('and nothing changed', (await Appointment.findById(a1._id)).status, 'booked');
        const done = await AppointmentServices.cancel(String(a1._id), 'patient called', asAdmin, true);
        check('with a refund it cancels', [done.status, done.holdsSlot], ['cancelled', false]);
        const invoice1 = await Invoice.findById(a1.invoice._id);
        check('the money went back and the invoice is cancelled', [invoice1.paidAmount, invoice1.isCancelled], [0, true]);
        const refunds = await Payment.find({ invoice: a1.invoice._id, kind: 'refund' });
        check('through a refund that says why', refunds.map((r) => [r.amount, r.note]), [[-500, 'Appointment cancelled: patient called']]);

        const a2 = await book(p2, 1);
        await AppointmentServices.requestCancel(String(a2._id), 'Wrong doctor', { _id: deskId, role: 'receptionist' });
        await rejectsWith('approving a paid request without a refund is refused', 409, () => AppointmentServices.approveCancel(String(a2._id), undefined, asAdmin));
        const approved = await AppointmentServices.approveCancel(String(a2._id), undefined, asAdmin, true);
        check('approving with a refund cancels and pays back', [approved.status, (await Invoice.findById(a2.invoice._id)).paidAmount], ['cancelled', 0]);

        const a3 = await book(p3, 2);
        await Invoice.updateOne({ _id: a3.invoice._id }, { $set: { commissionStatus: 'paid' } });
        await rejectsWith('a refused refund stops the cancellation', 409, () => AppointmentServices.cancel(String(a3._id), 'cancel it', asAdmin, true));
        const kept = await Appointment.findById(a3._id);
        check('the appointment and its payment are untouched', [kept.status, (await Invoice.findById(a3.invoice._id)).paidAmount], ['booked', 500]);

        await mongoose.disconnect();
        await replSet.stop();
        console.log(failures === 0 ? '\nAll checks passed' : `\n${failures} check(s) FAILED`);
        process.exit(failures === 0 ? 0 : 1);
    } catch (error) {
        console.error(error);
        await mongoose.disconnect().catch(() => undefined);
        await replSet.stop().catch(() => undefined);
        process.exit(1);
    }
})();
