/**
 * Verifies the doctor controls over their own schedule: blocking and reopening
 * single slots, editing and cancelling an approved schedule, and the follow-up
 * that tells the desk which patients have to be phoned. Needs a replica set:
 * payments run in transactions.
 */
process.env.NODE_ENV = 'development';

const mongoose = require('mongoose');
const { MongoMemoryReplSet } = require('mongodb-memory-server');

const DIST = require('path').join(__dirname, '..', 'dist', 'app');
const { User } = require(`${DIST}/modules/User/user.model`);
const { Patient } = require(`${DIST}/modules/Patient/patient.model`);
const { Invoice } = require(`${DIST}/modules/Invoice/invoice.model`);
const { Appointment } = require(`${DIST}/modules/Appointment/appointment.model`);
const { DoctorServices } = require(`${DIST}/modules/Doctor/doctor.service`);
const { DoctorScheduleServices } = require(`${DIST}/modules/DoctorSchedule/doctor-schedule.service`);
const { AppointmentServices } = require(`${DIST}/modules/Appointment/appointment.service`);

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
    await mongoose.connect(replSet.getUri(), { dbName: 'newlab_verify_slots' });
    await Appointment.init();

    try {
        const admin = await User.create({ name: 'Admin One', role: 'admin', email: 'admin@t.local', mobileNumber: '017', password: 'secret123' });
        const reception = await User.create({ name: 'Desk One', role: 'receptionist', email: 'desk@t.local', mobileNumber: '018', password: 'secret123' });
        const adminId = String(admin._id);
        const asAdmin = { _id: adminId, role: 'admin' };
        const asDesk = { _id: String(reception._id), role: 'receptionist' };

        const [p1, p2, p3, p4] = await Promise.all(
            [1, 2, 3, 4].map((n) =>
                Patient.create({ patientId: `PT-00000${n}`, name: `Patient ${n}`, age: 20 + n, gender: 'female', phone: `0180000000${n}` })
            )
        );

        const drA = await DoctorServices.createDoctor({ name: 'Dr A', specialty: 'Medicine', phone: '01711111111', consultationFee: 500, email: 'a@t.local', password: 'secret123' }, adminId);
        const drB = await DoctorServices.createDoctor({ name: 'Dr B', specialty: 'ENT', phone: '01722222222', consultationFee: 400, email: 'b@t.local', password: 'secret123' }, adminId);
        const asDrA = { _id: String(drA.user), role: 'doctor' };
        const asDrB = { _id: String(drB.user), role: 'doctor' };

        const makeSchedule = async (doctor, asDoctor, day, startTime, endTime, slotMinutes = 15) => {
            const created = await DoctorScheduleServices.createSchedule({ doctor: String(doctor._id), date: day, startTime, endTime, slotMinutes }, adminId);
            await DoctorScheduleServices.approveSchedule(String(created._id), asDoctor);
            return String(created._id);
        };
        const book = (sid, patient, slotIndex, extra = {}) =>
            AppointmentServices.createAppointment({ schedule: sid, slotIndex, patient: String(patient._id), ...extra }, asDesk._id);

        const sid = await makeSchedule(drA, asDrA, dhaka(2).day, '09:00', '10:00');

        // ── The schedule, slot by slot ────────────────────────────────────
        console.log('--- slot by slot ---');
        const view = await DoctorScheduleServices.getScheduleSlots(sid, asDrA);
        check('the doctor sees every slot, all free', view.slots.map((s) => [s.startTime, s.state]), [['09:00', 'free'], ['09:15', 'free'], ['09:30', 'free'], ['09:45', 'free']]);
        await rejectsWith('another doctor cannot see them', 404, () => DoctorScheduleServices.getScheduleSlots(sid, asDrB));

        const a1 = await book(sid, p1, 0);
        const a2 = await book(sid, p2, 1, { collectFullPayment: true });
        const withPeople = await DoctorScheduleServices.getScheduleSlots(sid, asDrA);
        check('booked slots name the patient', [withPeople.slots[0].state, withPeople.slots[0].appointment.patientName, withPeople.slots[1].appointment.patientAge], ['booked', 'Patient 1', 22]);

        // ── Blocking a free slot ──────────────────────────────────────────
        console.log('\n--- blocking a free slot ---');
        const blocked = await DoctorScheduleServices.blockSlot(sid, 3, 'Tea break', asDrA);
        check('a free slot can be blocked with a reason', [blocked.blockedSlots.length, blocked.blockedSlots[0].reason, blocked.blockedSlots[0].blockedByName], [1, 'Tea break', 'Dr A']);
        check('nobody was released', blocked.cancelledAppointments, []);
        check('the slot view marks it blocked with the reason', (await DoctorScheduleServices.getScheduleSlots(sid, asDrA)).slots[3].blocked.reason, 'Tea break');
        const avail = (await AppointmentServices.getAvailability({ date: dhaka(2).day }))[0];
        check('the desk sees it as blocked, not free', [avail.slots[3].state, avail.freeCount], ['blocked', 1]);
        await rejectsWith('it cannot be booked', 409, () => book(sid, p3, 3));
        await rejectsWith('blocking it again is refused', 409, () => DoctorScheduleServices.blockSlot(sid, 3, 'again', asDrA));
        await rejectsWith('a slot that does not exist is refused', 400, () => DoctorScheduleServices.blockSlot(sid, 99, 'x', asDrA));
        await rejectsWith('another doctor cannot block my slots', 404, () => DoctorScheduleServices.blockSlot(sid, 2, 'x', asDrB));
        check('the schedule list counts blocked slots', (await DoctorScheduleServices.getSchedules({ status: 'approved' }, asDrA)).result[0].blockedCount, 1);

        // ── Blocking a booked slot ────────────────────────────────────────
        console.log('\n--- blocking a slot with a patient in it ---');
        const unpaid = await DoctorScheduleServices.blockSlot(sid, 0, 'Emergency surgery', asDrA);
        check('the booked patient is released and named for the desk', unpaid.cancelledAppointments.map((c) => [c.patientName, c.patientPhone, c.refundDue]), [['Patient 1', '01800000001', 0]]);
        const after1 = await Appointment.findById(a1._id);
        check('their appointment is cancelled and the slot freed', [after1.status, after1.holdsSlot, after1.cancelReason], ['cancelled', false, 'The 09:00 slot was blocked: Emergency surgery']);
        check('and is marked for the desk to phone them', [after1.callback.reason, Boolean(after1.callback.requestedAt), after1.callback.doneAt], ['The 09:00 slot was blocked: Emergency surgery', true, undefined]);
        check('an unpaid invoice goes with it', (await Invoice.findById(a1.invoice._id)).isCancelled, true);

        const paid = await DoctorScheduleServices.blockSlot(sid, 1, 'Emergency surgery', asDrA);
        check('a paid patient is flagged for a refund', paid.cancelledAppointments.map((c) => [c.patientName, c.refundDue]), [['Patient 2', 500]]);
        check('and the paid invoice is left open for the refund', (await Invoice.findById(a2.invoice._id)).isCancelled, false);

        // ── The desk follow-up ────────────────────────────────────────────
        console.log('\n--- the desk follow-up ---');
        const toPhone = await AppointmentServices.getAppointments({ callback: 'pending' }, asDesk);
        check('the desk sees both patients to phone', toPhone.result.map((a) => a.patientInfo.name).sort(), ['Patient 1', 'Patient 2']);
        check('an admin sees the same list', (await AppointmentServices.getAppointments({ callback: 'pending' }, asAdmin)).meta.total, 2);
        check('marking one informed clears just that one', (await AppointmentServices.markInformed([String(a1._id)], asDesk)).informed, 1);
        const doneRow = await Appointment.findById(a1._id);
        check('and records who did it', [Boolean(doneRow.callback.doneAt), doneRow.callback.doneByName], [true, 'Desk One']);
        check('one is left', (await AppointmentServices.getAppointments({ callback: 'pending' }, asDesk)).meta.total, 1);
        check('marking with no list clears the rest', (await AppointmentServices.markInformed(undefined, asDesk)).informed, 1);
        check('nothing left to phone', (await AppointmentServices.getAppointments({ callback: 'pending' }, asDesk)).meta.total, 0);
        check('marking again changes nothing', (await AppointmentServices.markInformed(undefined, asDesk)).informed, 0);

        // ── Reopening ─────────────────────────────────────────────────────
        console.log('\n--- reopening a slot ---');
        const reopened = await DoctorScheduleServices.unblockSlot(sid, 0, asDrA);
        check('a blocked slot can be reopened', reopened.blockedSlots.map((b) => b.slotIndex).sort(), [1, 3]);
        const rebooked = await book(sid, p4, 0);
        check('and booked again', [rebooked.serialNo, rebooked.status], [1, 'booked']);
        await rejectsWith('reopening a slot that is not blocked is refused', 404, () => DoctorScheduleServices.unblockSlot(sid, 2, asDrA));
        await rejectsWith('another doctor cannot reopen my slots', 404, () => DoctorScheduleServices.unblockSlot(sid, 3, asDrB));

        // ── Editing ───────────────────────────────────────────────────────
        console.log('\n--- editing an approved schedule ---');
        await rejectsWith('not while a patient is booked in it', 409, () => DoctorScheduleServices.updateSchedule(sid, { endTime: '11:00' }, asDrA));
        await rejectsWith('an admin cannot change what a doctor approved', 409, () => DoctorScheduleServices.updateSchedule(sid, { endTime: '11:00' }, asAdmin));

        const free = await makeSchedule(drA, asDrA, dhaka(3).day, '14:00', '15:00');
        await DoctorScheduleServices.blockSlot(free, 1, 'Meeting', asDrA);
        await rejectsWith('a doctor cannot change the fee', 403, () => DoctorScheduleServices.updateSchedule(free, { fee: 1 }, asDrA));
        const edited = await DoctorScheduleServices.updateSchedule(free, { startTime: '14:00', endTime: '16:00', slotMinutes: 20 }, asDrA);
        check('with nobody booked the doctor can reshape it', [edited.startTime, edited.endTime, edited.slotMinutes, edited.slotCount, edited.status], ['14:00', '16:00', 20, 6, 'approved']);
        check('and the blocked slots start clear for the new layout', edited.blockedSlots, []);
        await DoctorScheduleServices.blockSlot(free, 2, 'Break', asDrA);
        const same = await DoctorScheduleServices.updateSchedule(free, { slotMinutes: 20 }, asDrA);
        check('an edit that changes nothing keeps its blocks', [same.slotCount, same.blockedSlots.length], [6, 1]);
        await rejectsWith('it cannot be moved into the past', 400, () => DoctorScheduleServices.updateSchedule(free, { date: dhaka(-1).day }, asDrA));
        const other = await makeSchedule(drA, asDrA, dhaka(3).day, '17:00', '18:00');
        await rejectsWith('nor onto another of their own schedules', 409, () => DoctorScheduleServices.updateSchedule(other, { startTime: '15:30', endTime: '17:30' }, asDrA));
        await rejectsWith('another doctor cannot edit it', 404, () => DoctorScheduleServices.updateSchedule(free, { endTime: '16:30' }, asDrB));

        const proposed = await DoctorScheduleServices.createSchedule({ doctor: String(drA._id), date: dhaka(4).day, startTime: '09:00', endTime: '10:00', slotMinutes: 15 }, adminId);
        check('a doctor can also adjust a proposal before answering it', (await DoctorScheduleServices.updateSchedule(String(proposed._id), { endTime: '10:30' }, asDrA)).slotCount, 6);
        check('and the admin still can too', (await DoctorScheduleServices.updateSchedule(String(proposed._id), { endTime: '10:00' }, asAdmin)).slotCount, 4);

        // ── Cancelling ────────────────────────────────────────────────────
        console.log('\n--- the doctor cancels their own schedule ---');
        const a5 = await book(free, p3, 0);
        await rejectsWith('another doctor cannot cancel it', 404, () => DoctorScheduleServices.cancelSchedule(free, 'x', asDrB));
        await rejectsWith('a reason is required', 400, () => DoctorScheduleServices.cancelSchedule(free, undefined, asDrA));
        const cancelled = await DoctorScheduleServices.cancelSchedule(free, 'Family emergency', asDrA);
        check('the doctor can cancel it', cancelled.status, 'cancelled');
        check('the booked patient is released and named', cancelled.cancelledAppointments.map((c) => c.patientName), ['Patient 3']);
        const after5 = await Appointment.findById(a5._id);
        check('they are marked for the desk to phone', [after5.status, Boolean(after5.callback.requestedAt)], ['cancelled', true]);
        check('and their invoice is cancelled', (await Invoice.findById(a5.invoice._id)).isCancelled, true);

        // ── A slot that has passed ────────────────────────────────────────
        if (dhaka(0).hour >= 1) {
            const early = await makeSchedule(drB, asDrB, dhaka(0).day, '00:00', '00:30');
            await rejectsWith('a slot that has already passed cannot be blocked', 409, () => DoctorScheduleServices.blockSlot(early, 0, 'x', asDrB));
        } else {
            console.log('SKIP  just after midnight: no earlier slot today to test');
        }

        await rejectsWith('only an approved schedule has slots to block', 409, () => DoctorScheduleServices.blockSlot(String(proposed._id), 0, 'x', asDrA));

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
