/**
 * Verifies the appointment cancellation workflow (the desk requests, an admin
 * approves or refuses) and the doctor dashboard. The important case is the one
 * that used to fail silently: when the invoice cannot be cancelled, the
 * approval must fail loudly and leave the appointment, its slot and the
 * request exactly as they were. Needs a replica set: payments use transactions.
 */
process.env.NODE_ENV = 'development';

const mongoose = require('mongoose');
const { MongoMemoryReplSet } = require('mongodb-memory-server');

const DIST = require('path').join(__dirname, '..', 'dist', 'app');
const { User } = require(`${DIST}/modules/User/user.model`);
const { Patient } = require(`${DIST}/modules/Patient/patient.model`);
const { Invoice } = require(`${DIST}/modules/Invoice/invoice.model`);
const { Payment } = require(`${DIST}/modules/Payment/payment.model`);
const { Appointment } = require(`${DIST}/modules/Appointment/appointment.model`);
const { DoctorServices } = require(`${DIST}/modules/Doctor/doctor.service`);
const { DoctorScheduleServices } = require(`${DIST}/modules/DoctorSchedule/doctor-schedule.service`);
const { AppointmentServices } = require(`${DIST}/modules/Appointment/appointment.service`);
const { InvoiceServices } = require(`${DIST}/modules/Invoice/invoice.service`);
const { PaymentServices } = require(`${DIST}/modules/Payment/payment.service`);
const { DashboardServices } = require(`${DIST}/modules/Dashboard/dashboard.service`);

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

const dhaka = (offsetDays) => {
    const moved = new Date(Date.now() + offsetDays * 864e5);
    return {
        day: new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Dhaka' }).format(moved),
        hour: Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Dhaka', hour: '2-digit', hour12: false }).format(moved)),
    };
};

(async () => {
    const replSet = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } });
    await mongoose.connect(replSet.getUri(), { dbName: 'newlab_verify_cancel' });
    await Appointment.init();

    try {
        const admin = await User.create({ name: 'Admin One', role: 'admin', email: 'admin@t.local', mobileNumber: '017', password: 'secret123' });
        const reception = await User.create({ name: 'Desk One', role: 'receptionist', email: 'desk@t.local', mobileNumber: '018', password: 'secret123' });
        const adminId = String(admin._id);
        const asAdmin = { _id: adminId, role: 'admin' };
        const asDesk = { _id: String(reception._id), role: 'receptionist' };

        const patients = await Promise.all(
            [1, 2, 3, 4, 5, 6].map((n) =>
                Patient.create({ patientId: `PT-00000${n}`, name: `Patient ${n}`, age: 20 + n, gender: n % 2 ? 'male' : 'female', phone: `0180000000${n}` })
            )
        );
        const [p1, p2, p3, p4, p5, p6] = patients;

        const drA = await DoctorServices.createDoctor({ name: 'Dr A', specialty: 'Medicine', phone: '01711111111', consultationFee: 500, email: 'a@t.local', password: 'secret123' }, adminId);
        const drB = await DoctorServices.createDoctor({ name: 'Dr B', specialty: 'ENT', phone: '01722222222', consultationFee: 400, email: 'b@t.local', password: 'secret123' }, adminId);
        const asDrA = { _id: String(drA.user), role: 'doctor' };
        const asDrB = { _id: String(drB.user), role: 'doctor' };

        const schedule = await DoctorScheduleServices.createSchedule({ doctor: String(drA._id), date: dhaka(2).day, startTime: '09:00', endTime: '10:00', slotMinutes: 15 }, adminId);
        const sid = String(schedule._id);
        await DoctorScheduleServices.approveSchedule(sid, asDrA);
        const book = (patient, slotIndex, extra = {}) =>
            AppointmentServices.createAppointment({ schedule: sid, slotIndex, patient: String(patient._id), ...extra }, asDesk._id);

        // ── Who may cancel ────────────────────────────────────────────────
        console.log('--- the desk asks, an admin decides ---');
        const a1 = await book(p1, 0);
        await rejectsWith('the desk cannot cancel outright', 403, async () => AppointmentServices.cancel(String(a1._id), 'patient called', asDesk));
        check('and the appointment is untouched', (await Appointment.findById(a1._id)).status, 'booked');

        const requested = await AppointmentServices.requestCancel(String(a1._id), 'Patient is travelling', asDesk);
        check('the desk can request a cancellation', [requested.status, requested.cancellation.status, requested.cancellation.reason, requested.cancellation.requestedByName], ['booked', 'pending', 'Patient is travelling', 'Desk One']);
        check('requesting changes nothing else: the slot is still held', (await Appointment.findById(a1._id)).holdsSlot, true);
        await rejectsWith('a second request while one is waiting is refused', 409, () => AppointmentServices.requestCancel(String(a1._id), 'again', asDesk));
        await rejectsWith('the invoice cannot be cancelled around the request', 409, () =>
            InvoiceServices.cancelInvoice(String(requested.invoice._id), adminId, 'sneaky')
        );

        const waiting = await AppointmentServices.getAppointments({ cancelRequest: 'pending' }, asAdmin);
        check('an admin can list requests waiting for an answer', [waiting.meta.total, waiting.result[0].appointmentNumber], [1, a1.appointmentNumber]);

        // ── Refusing ──────────────────────────────────────────────────────
        const refused = await AppointmentServices.rejectCancel(String(a1._id), 'Please call the patient first', asAdmin);
        check('an admin can refuse with a reason', [refused.status, refused.cancellation.status, refused.cancellation.reviewNote, refused.cancellation.reviewedByName], ['booked', 'rejected', 'Please call the patient first', 'Admin One']);
        check('a refusal leaves the booking and its slot alone', [(await Appointment.findById(a1._id)).holdsSlot, (await Appointment.findById(a1._id)).status], [true, 'booked']);
        check('nothing is waiting any more', (await AppointmentServices.getAppointments({ cancelRequest: 'pending' }, asAdmin)).meta.total, 0);
        await rejectsWith('refusing again has nothing to answer', 409, () => AppointmentServices.rejectCancel(String(a1._id), 'no', asAdmin));
        await rejectsWith('approving with no request waiting is refused', 409, () => AppointmentServices.approveCancel(String(a1._id), undefined, asAdmin));

        // ── Approving ─────────────────────────────────────────────────────
        const again = await AppointmentServices.requestCancel(String(a1._id), 'Patient insists', asDesk);
        check('after a refusal the desk can ask again', [again.cancellation.status, again.cancellation.reason], ['pending', 'Patient insists']);

        const approved = await AppointmentServices.approveCancel(String(a1._id), 'ok', asAdmin);
        check('approving cancels the appointment', [approved.status, approved.holdsSlot, approved.cancelReason], ['cancelled', false, 'Patient insists']);
        check('and records who answered', [approved.cancellation.status, approved.cancellation.reviewedByName, approved.cancellation.reviewNote], ['approved', 'Admin One', 'ok']);
        check('and cancels the invoice with it', (await Invoice.findById(a1.invoice._id)).isCancelled, true);
        const rebooked = await book(p2, 0);
        check('the freed slot can be booked again', rebooked.serialNo, 1);
        const listed = (await DoctorScheduleServices.getSchedules({ status: 'approved' }, asAdmin)).result.find((x) => String(x._id) === sid);
        check('the schedule list counts held slots, not cancelled ones', [listed.slotCount, listed.bookedCount], [4, 1]);
        await rejectsWith('a cancelled appointment cannot be asked to cancel again', 409, () => AppointmentServices.requestCancel(String(a1._id), 'x', asDesk));

        // ── The case that used to fail silently ───────────────────────────
        console.log('\n--- when the invoice cannot be cancelled, nothing is half-done ---');
        const a3 = await book(p3, 1);
        await AppointmentServices.requestCancel(String(a3._id), 'Wrong doctor', asDesk);
        // A paid-out commission is one thing that stops an invoice being cancelled.
        await Invoice.updateOne({ _id: a3.invoice._id }, { $set: { commissionStatus: 'paid' } });
        await rejectsWith('approval fails loudly', 400, () => AppointmentServices.approveCancel(String(a3._id), undefined, asAdmin));
        const stuck = await Appointment.findById(a3._id);
        check('the appointment is not cancelled', [stuck.status, stuck.holdsSlot], ['booked', true]);
        check('the request is still waiting for a retry', stuck.cancellation.status, 'pending');
        check('the invoice is untouched', (await Invoice.findById(a3.invoice._id)).isCancelled, false);
        await Invoice.updateOne({ _id: a3.invoice._id }, { $set: { commissionStatus: 'pending' } });
        check('once the obstacle is gone the same approval succeeds', (await AppointmentServices.approveCancel(String(a3._id), undefined, asAdmin)).status, 'cancelled');

        // ── Money already taken ───────────────────────────────────────────
        console.log('\n--- paid appointments ---');
        const a4 = await book(p4, 2, { collectFullPayment: true });
        const asked = await AppointmentServices.requestCancel(String(a4._id), 'Patient cancelled', asDesk);
        check('a paid appointment can still be asked about', asked.cancellation.status, 'pending');
        await rejectsWith('but approval waits until the money is voided', 409, () => AppointmentServices.approveCancel(String(a4._id), undefined, asAdmin));
        check('the request keeps waiting', (await Appointment.findById(a4._id)).cancellation.status, 'pending');
        const receipt = await Payment.findOne({ invoice: a4.invoice._id });
        await PaymentServices.voidPayment(String(receipt._id), adminId, 'refunded at desk');
        check('after the refund is recorded, approval goes through', (await AppointmentServices.approveCancel(String(a4._id), undefined, asAdmin)).status, 'cancelled');

        // ── An admin cancelling directly settles a waiting request ────────
        const a5 = await book(p5, 3);
        await AppointmentServices.requestCancel(String(a5._id), 'Asked at the desk', asDesk);
        const direct = await AppointmentServices.cancel(String(a5._id), 'Doctor unavailable', asAdmin);
        check('a direct admin cancel closes a waiting request as approved', [direct.status, direct.cancellation.status, direct.cancellation.reviewedByName], ['cancelled', 'approved', 'Admin One']);

        // ── The desk is told what happened to its requests ────────────────
        console.log(String.fromCharCode(10) + '--- answers reach the person who asked ---');
        const unseen = (actor) => AppointmentServices.getAppointments({ cancelOutcome: 'unseen' }, actor);
        const first4 = await unseen(asDesk);
        check('the desk has unseen answers: refused, approved and a direct cancel', first4.meta.total, 4);
        check('the admin raised none, so sees none', (await unseen(asAdmin)).meta.total, 0);

        const other = await User.create({ name: 'Desk Two', role: 'receptionist', email: 'desk2@t.local', mobileNumber: '019', password: 'secret123' });
        const asOtherDesk = { _id: String(other._id), role: 'receptionist' };
        check('another receptionist does not see them', (await unseen(asOtherDesk)).meta.total, 0);

        await AppointmentServices.requestCancel(String(rebooked._id), 'Changed mind', asDesk);
        check('a request still waiting is not an answer yet', (await unseen(asDesk)).meta.total, 4);
        await AppointmentServices.rejectCancel(String(rebooked._id), 'Doctor needs the slot kept', asAdmin);
        const withRefusal = await unseen(asDesk);
        check('a refusal arrives as a new answer', withRefusal.meta.total, 5);
        check('and carries the reason', withRefusal.result.find((a) => String(a._id) === String(rebooked._id)).cancellation.reviewNote, 'Doctor needs the slot kept');

        check('acknowledging one answer clears only that one', (await AppointmentServices.acknowledgeOutcomes([String(a1._id)], asDesk)).acknowledged, 1);
        check('so four remain', (await unseen(asDesk)).meta.total, 4);
        check('another receptionist cannot clear them', (await AppointmentServices.acknowledgeOutcomes(undefined, asOtherDesk)).acknowledged, 0);
        check('acknowledging with no list clears everything', (await AppointmentServices.acknowledgeOutcomes(undefined, asDesk)).acknowledged, 4);
        check('nothing is left unseen', (await unseen(asDesk)).meta.total, 0);

        await AppointmentServices.requestCancel(String(rebooked._id), 'Asking once more', asDesk);
        check('a fresh request after a refusal is not shown as answered', (await unseen(asDesk)).meta.total, 0);
        await AppointmentServices.approveCancel(String(rebooked._id), undefined, asAdmin);
        check('and its approval is a new unseen answer', (await unseen(asDesk)).meta.total, 1);
        await AppointmentServices.acknowledgeOutcomes(undefined, asDesk);

        // ── Doctor dashboard ──────────────────────────────────────────────
        console.log('\n--- doctor dashboard ---');
        const clock = dhaka(0);
        if (clock.hour < 22) {
            const todays = await DoctorScheduleServices.createSchedule({ doctor: String(drA._id), date: clock.day, startTime: '23:00', endTime: '23:45', slotMinutes: 15 }, adminId);
            await DoctorScheduleServices.approveSchedule(String(todays._id), asDrA);
            const t = (patient, slotIndex) =>
                AppointmentServices.createAppointment({ schedule: String(todays._id), slotIndex, patient: String(patient._id) }, asDesk._id);
            const t1 = await t(p1, 0);
            const t2 = await t(p2, 1);
            const t3 = await t(p6, 2);
            await AppointmentServices.checkIn(String(t1._id), asDesk);
            await AppointmentServices.complete(String(t1._id), asDrA);
            await AppointmentServices.checkIn(String(t3._id), asDesk);

            const pendingLater = await DoctorScheduleServices.createSchedule({ doctor: String(drA._id), date: dhaka(4).day, startTime: '14:00', endTime: '15:00', slotMinutes: 20 }, adminId);

            const view = await DashboardServices.getDoctorDashboard(asDrA);
            check('it names the doctor', [view.doctor.name, view.doctor.specialty], ['Dr A', 'Medicine']);
            check('today counts only this doctor live appointments', view.today.total, 3);
            check('and splits them by status', [view.today.booked, view.today.checkedIn, view.today.completed], [1, 1, 1]);
            check('the queue is in time order', view.queue.map((q) => q.serialNo), [1, 2, 3]);
            check('next up is the waiting patient, not the one merely booked', [view.nextUp.serialNo, view.nextUp.status], [3, 'checked_in']);
            check('the queue carries what the doctor needs to see', [view.queue[1].patientName, view.queue[1].age], ['Patient 2', 22]);
            check('a schedule awaiting an answer is listed', view.pendingSchedules.map((s) => String(s._id)), [String(pendingLater._id)]);
            check('its slot count is worked out', view.pendingSchedules[0].slotCount, 3);
            check('completed consultations are counted for the month', view.completedLast30, 1);

            const other = await DashboardServices.getDoctorDashboard(asDrB);
            check('another doctor sees none of it', [other.today.total, other.queue.length, other.pendingSchedules.length, other.nextUp], [0, 0, 0, null]);
            check('the dashboard no longer carries a week list: schedules come from the schedule list', 'upcoming' in view, false);

            const approvedMine = await DoctorScheduleServices.getSchedules({ status: 'approved' }, asDrA);
            check('a doctor lists every schedule they approved', approvedMine.meta.total, 2);
            check('each one says how many of its slots are taken', approvedMine.result.map((x) => [x.slotCount, x.bookedCount]).sort(), [[3, 3], [4, 0]]);
            check('another doctor has approved none', (await DoctorScheduleServices.getSchedules({ status: 'approved' }, asDrB)).meta.total, 0);
            check('pending schedules are not in the approved list', approvedMine.result.every((x) => x.status === 'approved'), true);
            const upcomingOnly = await DoctorScheduleServices.getSchedules({ status: 'approved', startDate: dhaka(1).day }, asDrA);
            check('the list can be narrowed to upcoming days', upcomingOnly.result.map((x) => String(x._id)), [sid]);
            const pastOnly = await DoctorScheduleServices.getSchedules({ status: 'approved', endDate: dhaka(0).day, sortBy: '-date -startTime' }, asDrA);
            check('or to past and present days', pastOnly.result.map((x) => String(x._id)), [String(todays._id)]);


            await AppointmentServices.cancel(String(t2._id), 'no show expected', asAdmin);
            check('a cancelled appointment leaves the queue and the count', (await DashboardServices.getDoctorDashboard(asDrA)).today.total, 2);
        } else {
            console.log('SKIP  late evening: the clinic slots for today would already have passed');
        }
        await rejectsWith('an admin has no doctor dashboard', 404, () => DashboardServices.getDoctorDashboard(asAdmin));

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
