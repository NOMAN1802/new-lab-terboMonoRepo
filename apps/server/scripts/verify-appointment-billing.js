/**
 * Verifies that a consultation fee flows through the existing billing: the
 * appointment gets its own invoice, payments and cancellations behave, the
 * reports reconcile, and nothing that assumes "every line is a lab test"
 * (report worklists, test counts, invoice editing, the public QR page) is
 * thrown off by a consultation line. Needs a replica set: payments run in
 * transactions.
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
    await mongoose.connect(replSet.getUri(), { dbName: 'newlab_verify_billing' });
    await Appointment.init();

    try {
        const admin = await User.create({ name: 'Admin', role: 'admin', email: 'admin@t.local', mobileNumber: '017', password: 'secret123' });
        const reception = await User.create({ name: 'Desk', role: 'receptionist', email: 'desk@t.local', mobileNumber: '018', password: 'secret123' });
        const adminId = String(admin._id);
        const deskId = String(reception._id);
        const asAdmin = { _id: adminId, role: 'admin' };

        const dept = await TestCategory.create({ name: 'Pathology' });
        const cbc = await Test.create({ testCode: 'CBC', name: 'Complete Blood Count', price: 800, category: dept._id, categoryName: 'Pathology' });
        const patients = await Promise.all(
            [1, 2, 3, 4].map((n) =>
                Patient.create({ patientId: `PT-00000${n}`, name: `Patient ${n}`, age: 30 + n, gender: 'female', phone: `0180000000${n}` })
            )
        );
        const [p1, p2, p3, p4] = patients;

        const drA = await DoctorServices.createDoctor({ name: 'Dr A', specialty: 'Medicine', phone: '01711111111', consultationFee: 500, email: 'a@t.local', password: 'secret123' }, adminId);
        const asDrA = { _id: String(drA.user), role: 'doctor' };
        const day = dhakaDay(2);
        const schedule = await DoctorScheduleServices.createSchedule({ doctor: String(drA._id), date: day, startTime: '09:00', endTime: '10:00', slotMinutes: 15 }, adminId);
        const sid = String(schedule._id);
        await DoctorScheduleServices.approveSchedule(sid, asDrA);

        const book = (patient, slotIndex, extra = {}) =>
            AppointmentServices.createAppointment({ schedule: sid, slotIndex, patient: String(patient._id), ...extra }, deskId);

        // ── Booking creates the invoice ───────────────────────────────────
        console.log('--- booking bills the consultation ---');
        const a1 = await book(p1, 0);
        check('the appointment is linked to an invoice', Boolean(a1.invoice && a1.invoiceNumber), true);
        const inv1 = await Invoice.findById(a1.invoice._id);
        check('invoice carries one consultation line at the schedule fee', [inv1.items.length, inv1.items[0].kind, inv1.items[0].price], [1, 'consultation', 500]);
        check('the line is labelled with the doctor', inv1.items[0].testName, 'Consultation — Dr A');
        check('no test reference, no referrer, no discount, no commission', [inv1.items[0].test, inv1.referrer, inv1.discountPercent, inv1.commissionAmount], [undefined, undefined, 0, 0]);
        check('unpaid by default', [inv1.netPayable, inv1.paidAmount, inv1.dueAmount, inv1.paymentStatus], [500, 0, 500, 'unpaid']);
        check('visit date is the appointment day', new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Dhaka' }).format(inv1.visitDate), day);
        check('no report QR token is minted for a consultation', inv1.publicToken, undefined);
        check('no payment warning when none was asked for', a1.paymentWarning, undefined);

        const a2 = await book(p2, 1, { collectFullPayment: true });
        const inv2 = await Invoice.findById(a2.invoice._id);
        check('paying in full at booking settles the invoice', [inv2.paidAmount, inv2.dueAmount, inv2.paymentStatus], [500, 0, 'paid']);
        check('a receipt was issued', await Payment.countDocuments({ invoice: inv2._id, isVoided: false }), 1);

        const a3 = await book(p3, 2, { advanceAmount: 200 });
        const inv3 = await Invoice.findById(a3.invoice._id);
        check('an advance leaves the rest due', [inv3.paidAmount, inv3.dueAmount, inv3.paymentStatus], [200, 300, 'partial']);

        const a4 = await book(p4, 3, { advanceAmount: 9999 });
        const inv4 = await Invoice.findById(a4.invoice._id);
        check('an oversized advance is clamped to the net', [inv4.paidAmount, inv4.paymentStatus], [500, 'paid']);

        // ── Existing flows cannot be turned on a consultation ─────────────
        console.log('\n--- consultation invoices are protected from lab-test flows ---');
        const itemId = String(inv1.items[0]._id);
        await rejectsWith('its lines cannot be replaced by a test list', 400, () =>
            InvoiceServices.updateInvoiceItems(String(inv1._id), [String(cbc._id)])
        );
        await rejectsWith('its line cannot be cancelled on its own', 400, () =>
            InvoiceServices.cancelInvoiceItem(String(inv1._id), itemId, deskId, 'oops')
        );
        await rejectsWith('no report can be uploaded to it', 400, () =>
            InvoiceServices.uploadItemReport(String(inv1._id), itemId, { buffer: Buffer.from('x'), mimetype: 'application/pdf', originalname: 'x.pdf', size: 1 }, deskId)
        );
        await rejectsWith('no report can be marked delivered on it', 400, () =>
            InvoiceServices.markReportDelivered(String(inv1._id), itemId, deskId)
        );
        await rejectsWith('the invoice cannot be cancelled while its appointment stands', 409, () =>
            InvoiceServices.cancelInvoice(String(inv1._id), deskId, 'no')
        );
        const opened = await InvoiceServices.getInvoice(String(inv1._id));
        check('opening it does not mint a report QR token', opened.publicToken, undefined);

        // ── Reports and dashboards ignore the consultation line ───────────
        console.log('\n--- reports and dashboards ---');
        await InvoiceServices.createInvoice({ patient: String(p1._id), testIds: [String(cbc._id)] }, deskId);
        const wide = resolveDateRange({ startDate: '2020-01-01', endDate: '2030-12-31' });

        const patientReport = await ReportsServices.getPatientReport(wide);
        check('every invoice is a visit', patientReport.summary.visits, 5);
        check('only lab tests count as tests performed', patientReport.summary.testsPerformed, 1);
        const consultRow = patientReport.rows.find((row) => row.invoiceNumber === a1.invoiceNumber);
        check('a consultation row lists no tests and no pending reports', [consultRow.tests, consultRow.testCount, consultRow.reportsPending], [[], 0, 0]);

        const adminView = await DashboardServices.getAdminDashboard(wide, 'daily');
        check('admin report workload counts only the lab test', adminView.period.reports, { pending: 1, uploaded: 0, delivered: 0 });
        const deskView = await DashboardServices.getReceptionistDashboard(reception._id);
        check('receptionist workload counts the lab test but not the consultations', deskView.reports.pending, 1);

        const financial = await ReportsServices.getFinancialSummary(wide);
        check('consultation fees are in gross billed', financial.grossBilled, 4 * 500 + 800);
        check('cash collected matches the ledger', financial.cashCollected, 500 + 200 + 500);
        check('invoices counted include consultations', financial.invoiceCount, 5);
        check('no commission accrues on consultations', (await ReportsServices.getReferralCommissionReport(wide)).summary.commissionAccrued, 0);

        // ── Cancelling an appointment ─────────────────────────────────────
        console.log('\n--- cancelling an appointment ---');
        await rejectsWith('a paid appointment cannot be cancelled until the money is voided', 409, () =>
            AppointmentServices.cancel(String(a2._id), 'patient called', asAdmin)
        );
        check('and it is still booked', (await Appointment.findById(a2._id)).status, 'booked');

        await AppointmentServices.cancel(String(a1._id), 'patient called', asAdmin);
        const inv1After = await Invoice.findById(inv1._id);
        check('cancelling an unpaid appointment cancels its invoice', [inv1After.isCancelled, inv1After.cancelReason], [true, 'Appointment cancelled: patient called']);
        check('the cancelled invoice drops out of the books', (await ReportsServices.getFinancialSummary(wide)).invoiceCount, 4);

        const receiptOnA2 = await Payment.findOne({ invoice: inv2._id });
        await PaymentServices.voidPayment(String(receiptOnA2._id), adminId, 'refunded at desk');
        await AppointmentServices.cancel(String(a2._id), 'patient called', asAdmin);
        check('after the payment is voided, the appointment can be cancelled', (await Appointment.findById(a2._id)).status, 'cancelled');
        check('and its invoice is cancelled with it', (await Invoice.findById(inv2._id)).isCancelled, true);

        // ── Cancelling the schedule ───────────────────────────────────────
        console.log('\n--- cancelling the schedule ---');
        const released = await DoctorScheduleServices.cancelSchedule(sid, 'Doctor on leave', asAdmin);
        const byPatient = Object.fromEntries(released.cancelledAppointments.map((a) => [a.patientName, a.refundDue]));
        check('the desk is told who to call and who is owed a refund', byPatient, { 'Patient 3': 200, 'Patient 4': 500 });
        check('the part-paid and fully paid invoices are left for a refund', [(await Invoice.findById(inv3._id)).isCancelled, (await Invoice.findById(inv4._id)).isCancelled], [false, false]);
        check('the appointments themselves are cancelled', await Appointment.countDocuments({ schedule: sid, status: { $in: ['booked', 'checked_in'] } }), 0);

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
