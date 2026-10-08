/**
 * Verifies that every doctor is also on the Referrers list, that the admin's
 * discount and commission on that entry apply to lab bookings, and that each
 * appointment pays the doctor their share of the fee through the ordinary
 * commission payout. Needs a replica set: payments run in transactions.
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
const { Doctor } = require(`${DIST}/modules/Doctor/doctor.model`);
const { Referrer } = require(`${DIST}/modules/Referrer/referrer.model`);
const { Appointment } = require(`${DIST}/modules/Appointment/appointment.model`);
const { UserServices } = require(`${DIST}/modules/User/user.service`);
const { DoctorServices } = require(`${DIST}/modules/Doctor/doctor.service`);
const { ReferrerServices } = require(`${DIST}/modules/Referrer/referrer.service`);
const { DoctorScheduleServices } = require(`${DIST}/modules/DoctorSchedule/doctor-schedule.service`);
const { AppointmentServices } = require(`${DIST}/modules/Appointment/appointment.service`);
const { InvoiceServices } = require(`${DIST}/modules/Invoice/invoice.service`);
const { PaymentServices } = require(`${DIST}/modules/Payment/payment.service`);
const { CommissionPayoutServices } = require(`${DIST}/modules/CommissionPayout/commission-payout.service`);

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
    await mongoose.connect(replSet.getUri(), { dbName: 'bytespate_verify_doctor_referrers' });
    await Promise.all([Appointment.init(), Referrer.init(), Doctor.init()]);

    try {
        const admin = await User.create({ name: 'Admin One', role: 'admin', email: 'admin@t.local', mobileNumber: '017', password: 'secret123' });
        const reception = await User.create({ name: 'Desk One', role: 'receptionist', email: 'desk@t.local', mobileNumber: '018', password: 'secret123' });
        const adminId = String(admin._id);
        const deskId = String(reception._id);

        const dept = await TestCategory.create({ name: 'Pathology' });
        const cbc = await Test.create({ testCode: 'CBC', name: 'Complete Blood Count', price: 1000, category: dept._id, categoryName: 'Pathology' });
        const [p1, p2, p3] = await Promise.all(
            [1, 2, 3].map((n) => Patient.create({ patientId: `PT-00000${n}`, name: `Patient ${n}`, age: 30, gender: 'male', phone: `0180000000${n}` }))
        );

        // ── A doctor joins the Referrers list ─────────────────────────────
        console.log('--- creating a doctor ---');
        await UserServices.createUser(
            { name: 'Dr Nasrin', role: 'doctor', email: 'nasrin@t.local', mobileNumber: '01711111111', password: 'secret123', specialty: 'Medicine', degrees: 'MBBS', consultationFee: 500, appointmentShareType: 'percent', appointmentShareValue: 70 },
            adminId
        );
        const nasrin = await Doctor.findOne({ name: 'Dr Nasrin' });
        const entry = await Referrer.findById(nasrin.referrer);
        check('the doctor gets one Referrers entry, linked both ways', [Boolean(entry), String(entry.doctor), await Referrer.countDocuments({ doctor: nasrin._id })], [true, String(nasrin._id), 1]);
        check('it carries the doctor code, name, phone and specialty', [entry.referrerCode, entry.name, entry.phone, entry.designation], [nasrin.doctorCode, 'Dr Nasrin', '01711111111', 'Medicine']);
        check('discount and commission start at zero for the admin to set', [entry.defaultDiscountPercent, entry.defaultCommissionType, entry.defaultCommissionValue], [0, 'percent', 0]);
        check('the appointment share is stored on the doctor', [nasrin.appointmentShareType, nasrin.appointmentShareValue], ['percent', 70]);

        await DoctorServices.ensureReferrer(nasrin, adminId);
        check('ensuring again makes no second entry', await Referrer.countDocuments({ doctor: nasrin._id }), 1);

        const listed = await ReferrerServices.getReferrers({});
        check('the entry is on the Referrers list', listed.result.some((r) => String(r._id) === String(entry._id)), true);

        // A code clash with a hand-typed referrer is avoided.
        await ReferrerServices.createReferrer({ referrerCode: 'DR-0002', name: 'Outside Doc', phone: '01799999999' }, adminId);
        await UserServices.createUser(
            { name: 'Dr Karim', role: 'doctor', email: 'karim@t.local', mobileNumber: '01722222222', password: 'secret123', specialty: 'ENT', consultationFee: 400, appointmentShareType: 'fixed', appointmentShareValue: 300 },
            adminId
        );
        const karim = await Doctor.findOne({ name: 'Dr Karim' });
        const karimEntry = await Referrer.findById(karim.referrer);
        check('a clashing code gets a suffix instead of failing', [karim.doctorCode, karimEntry.referrerCode], ['DR-0002', 'DR-0002-1']);
        check('adding a referrer by hand still works', await Referrer.countDocuments({ name: 'Outside Doc', doctor: { $exists: false } }), 1);

        // ── The Referrers screen ──────────────────────────────────────────
        console.log('\n--- the Referrers screen ---');
        const terms = await ReferrerServices.updateReferrer(String(entry._id), { defaultDiscountPercent: 10, defaultCommissionType: 'percent', defaultCommissionValue: 15, name: 'Someone Else', phone: '000000' });
        check('the admin sets discount and commission there', [terms.defaultDiscountPercent, terms.defaultCommissionValue], [10, 15]);
        check('but name and phone follow the doctor', [terms.name, terms.phone], ['Dr Nasrin', '01711111111']);
        await rejectsWith('a doctor entry cannot be deleted from Referrers', 409, () => ReferrerServices.deleteReferrer(String(entry._id)));

        await DoctorServices.updateDoctor(String(nasrin._id), { name: 'Dr Nasrin Akter', phone: '01733333333' }, adminId);
        const renamed = await Referrer.findById(entry._id);
        check('renaming the doctor renames the entry', [renamed.name, renamed.phone], ['Dr Nasrin Akter', '01733333333']);
        check('without touching the terms', [renamed.defaultDiscountPercent, renamed.defaultCommissionValue], [10, 15]);

        // ── A lab booking referred by the doctor ──────────────────────────
        console.log('\n--- a lab booking referred by the doctor ---');
        const lab = await InvoiceServices.createInvoice({ patient: String(p1._id), referrer: String(entry._id), testIds: [String(cbc._id)], collectFullPayment: true }, deskId);
        check('their discount and commission apply', [lab.discountAmount, lab.netPayable, lab.commissionAmount, lab.referrerInfo.name], [100, 900, 135, 'Dr Nasrin Akter']);

        // ── Appointments pay the doctor a share ───────────────────────────
        console.log('\n--- appointment share ---');
        const makeSchedule = async (doctor, day, startTime, endTime) => {
            const created = await DoctorScheduleServices.createSchedule({ doctor: String(doctor._id), date: day, startTime, endTime, slotMinutes: 15 }, adminId);
            await DoctorScheduleServices.approveSchedule(String(created._id), { _id: String(doctor.user), role: 'doctor' });
            return String(created._id);
        };
        const sidN = await makeSchedule(nasrin, dhakaDay(2), '09:00', '10:00');
        const sidK = await makeSchedule(karim, dhakaDay(2), '09:00', '10:00');

        const a1 = await AppointmentServices.createAppointment({ schedule: sidN, slotIndex: 0, patient: String(p1._id) }, deskId);
        const inv1 = await Invoice.findById(a1.invoice._id);
        check('a 70% share on a 500 fee is owed to the doctor as 350', [String(inv1.referrer), inv1.commissionType, inv1.commissionValue, inv1.commissionAmount], [String(entry._id), 'percent', 70, 350]);
        check('the patient pays the full fee, no discount', [inv1.discountAmount, inv1.netPayable], [0, 500]);

        const a2 = await AppointmentServices.createAppointment({ schedule: sidK, slotIndex: 0, patient: String(p2._id) }, deskId);
        const inv2 = await Invoice.findById(a2.invoice._id);
        check('a fixed 300 share is owed as 300', [inv2.commissionType, inv2.commissionAmount], ['fixed', 300]);

        await DoctorServices.updateDoctor(String(karim._id), { appointmentShareType: 'fixed', appointmentShareValue: 900 }, adminId);
        const a3 = await AppointmentServices.createAppointment({ schedule: sidK, slotIndex: 1, patient: String(p3._id) }, deskId);
        check('a flat share is capped at the fee', (await Invoice.findById(a3.invoice._id)).commissionAmount, 400);
        check('changing the share leaves earlier bookings alone', (await Invoice.findById(inv2._id)).commissionAmount, 300);

        // ── Paid out only once the patient has paid ───────────────────────
        console.log('\n--- payout ---');
        await rejectsWith('nothing is payable while the patient still owes', 400, () =>
            CommissionPayoutServices.createPayout({ referrer: String(karimEntry._id), invoiceIds: [String(inv2._id)] }, adminId)
        );
        await PaymentServices.createPayment({ invoice: String(inv2._id), amount: 400 }, deskId);
        const payout = await CommissionPayoutServices.createPayout({ referrer: String(karimEntry._id), invoiceIds: [String(inv2._id)] }, adminId);
        check('once paid, the share is paid out like any commission', [payout.amount, payout.invoiceCount], [300, 1]);

        // Nasrin: her lab commission and appointment share settle together.
        await PaymentServices.createPayment({ invoice: String(inv1._id), amount: 500 }, deskId);
        const pending = await CommissionPayoutServices.getPendingCommission(String(entry._id));
        check('lab commission and appointment share are payable together (135 + 350)', [pending.totalPending, pending.invoices.length], [485, 2]);

        // Doctor Payment splits them: lab commission on one page, appointment fees on the other.
        const labOnly = await CommissionPayoutServices.getPendingCommission(String(entry._id), 'lab');
        const apptOnly = await CommissionPayoutServices.getPendingCommission(String(entry._id), 'appointment');
        check('the lab page shows only the lab commission', [labOnly.totalPending, labOnly.invoices.length], [135, 1]);
        check('the appointment page shows only the appointment share', [apptOnly.totalPending, apptOnly.invoices.length], [350, 1]);
        await rejectsWith('an appointment payout cannot sweep up a lab invoice', 400, () =>
            CommissionPayoutServices.createPayout({ referrer: String(entry._id), kind: 'appointment', invoiceIds: [String(lab._id)] }, adminId)
        );
        const apptPayout = await CommissionPayoutServices.createPayout({ referrer: String(entry._id), kind: 'appointment' }, adminId);
        check('paying appointment fees settles only those, and is marked as such', [apptPayout.amount, apptPayout.invoiceCount, apptPayout.kind], [350, 1, 'appointment']);
        check('the lab commission is still waiting', (await CommissionPayoutServices.getPendingCommission(String(entry._id), 'lab')).totalPending, 135);
        const histories = await Promise.all([
            CommissionPayoutServices.getPayouts({ kind: 'appointment' }),
            CommissionPayoutServices.getPayouts({ kind: 'lab' }),
        ]);
        check('each page lists only its own payouts', [
            histories[0].result.every((p) => p.kind === 'appointment'),
            histories[1].result.every((p) => p.kind !== 'appointment'),
            histories[0].result.length > 0,
        ], [true, true, true]);

        // A cancelled appointment drops its share.
        const a4 = await AppointmentServices.createAppointment({ schedule: sidN, slotIndex: 1, patient: String(p2._id) }, deskId);
        await AppointmentServices.cancel(String(a4._id), 'Patient travelling', { _id: adminId, role: 'admin' });
        const cancelledInv = await Invoice.findById(a4.invoice._id);
        check('a cancelled appointment cancels its invoice', cancelledInv.isCancelled, true);
        await rejectsWith('so its share cannot be paid out', 400, () =>
            CommissionPayoutServices.createPayout({ referrer: String(entry._id), invoiceIds: [String(cancelledInv._id)] }, adminId)
        );
        check('and the payable total is unchanged', (await CommissionPayoutServices.getPendingCommission(String(entry._id))).totalPending, 135);

        // ── A share set after bookings were made ──────────────────────────
        console.log('\n--- applying a share to past appointments ---');
        await UserServices.createUser(
            { name: 'Dr Late', role: 'doctor', email: 'late@t.local', mobileNumber: '01766666666', password: 'secret123', specialty: 'Skin', consultationFee: 300 },
            adminId
        );
        const late = await Doctor.findOne({ name: 'Dr Late' });
        const sidL = await makeSchedule(late, dhakaDay(3), '09:00', '10:00');
        const l1 = await AppointmentServices.createAppointment({ schedule: sidL, slotIndex: 0, patient: String(p1._id), collectFullPayment: true }, deskId);
        const l2 = await AppointmentServices.createAppointment({ schedule: sidL, slotIndex: 1, patient: String(p2._id), collectFullPayment: true }, deskId);
        const l3 = await AppointmentServices.createAppointment({ schedule: sidL, slotIndex: 2, patient: String(p3._id) }, deskId);
        check('booked with no share, nothing is owed', (await Invoice.findById(l1.invoice._id)).commissionAmount, 0);

        // One is cancelled; one is paid out at the old (zero) rate by hand.
        await AppointmentServices.cancel(String(l3._id), 'Not coming', { _id: adminId, role: 'admin' });
        await Invoice.updateOne({ _id: l2.invoice._id }, { $set: { commissionStatus: 'paid' } });

        await DoctorServices.updateDoctor(String(late._id), { appointmentShareType: 'percent', appointmentShareValue: 70 }, adminId);
        const applied = await DoctorServices.applyShareToPast(String(late._id), adminId);
        check('applying the share updates only the unpaid, live appointment', [applied.appointments, applied.updated, applied.total], [1, 1, 210]);
        const lateInv = await Invoice.findById(l1.invoice._id);
        check('it now owes 70% of 300 to the doctor', [lateInv.commissionType, lateInv.commissionValue, lateInv.commissionAmount, String(lateInv.referrer)], ['percent', 70, 210, String(late.referrer)]);
        check('an appointment already paid out is untouched', (await Invoice.findById(l2.invoice._id)).commissionAmount, 0);
        check('a cancelled appointment is untouched', (await Invoice.findById(l3.invoice._id)).commissionAmount, 0);
        const again = await DoctorServices.applyShareToPast(String(late._id), adminId);
        check('running it again changes nothing', [again.updated, (await Invoice.findById(l1.invoice._id)).commissionAmount], [0, 210]);
        const latePending = await CommissionPayoutServices.getPendingCommission(String(late.referrer));
        check("and it is payable on Doctor's Commission, marked as an appointment", [latePending.totalPending, latePending.invoices[0].items[0].kind], [210, 'consultation']);

        const listed2 = await AppointmentServices.getAppointment(String(l1._id), { _id: adminId, role: 'admin' });
        check('the appointment carries the share for the admin view', [listed2.invoice.commissionAmount, listed2.invoice.commissionStatus], [210, 'pending']);

        // ── Removing a doctor ─────────────────────────────────────────────
        console.log('\n--- removing a doctor ---');
        const tempLogin = await UserServices.createUser(
            { name: 'Dr Temp', role: 'doctor', email: 'temp@t.local', mobileNumber: '01755555555', password: 'secret123', specialty: 'Skin', consultationFee: 300 },
            adminId
        );
        const temp = await Doctor.findOne({ name: 'Dr Temp' });
        await UserServices.deleteUser(String(tempLogin._id), adminId);
        const gone = await Referrer.findById(temp.referrer);
        check('the entry leaves the Referrers list with the doctor', [gone.isDeleted, gone.isActive], [true, false]);
        check('past invoices keep their own copy of the name', (await Invoice.findById(inv2._id)).referrerInfo.name, 'Dr Karim');

        // ── Doctors from before the link ──────────────────────────────────
        console.log('\n--- older doctors ---');
        const oldUser = await User.create({ name: 'Dr Old', role: 'doctor', email: 'old@t.local', mobileNumber: '01744444444', password: 'secret123' });
        const old = await Doctor.create({ doctorCode: 'DR-0099', name: 'Dr Old', specialty: 'Skin', phone: '01744444444', consultationFee: 300, user: oldUser._id });
        check('an older doctor starts without an entry', Boolean(old.referrer), false);
        await DoctorServices.getDoctors({}, 'admin');
        await DoctorServices.getDoctors({}, 'admin');
        const healed = await Doctor.findById(old._id);
        check('listing doctors gives them exactly one entry', [Boolean(healed.referrer), await Referrer.countDocuments({ doctor: old._id })], [true, 1]);
    } finally {
        await mongoose.disconnect();
        await replSet.stop();
    }

    console.log(failures === 0 ? '\nAll checks passed' : `\n${failures} check(s) FAILED`);
    process.exit(failures === 0 ? 0 : 1);
})().catch((error) => {
    console.error(error);
    process.exit(1);
});
