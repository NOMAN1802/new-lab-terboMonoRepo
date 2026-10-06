/**
 * End-to-end verification of appointment booking against an in-memory MongoDB.
 * The point of this one is the double-booking guard: the unique index has to
 * hold when two bookings really do race, which only a real database proves.
 */
process.env.NODE_ENV = 'development';

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

const DIST = require('path').join(__dirname, '..', 'dist', 'app');
const { User } = require(`${DIST}/modules/User/user.model`);
const { Patient } = require(`${DIST}/modules/Patient/patient.model`);
const { Appointment } = require(`${DIST}/modules/Appointment/appointment.model`);
const { DoctorServices } = require(`${DIST}/modules/Doctor/doctor.service`);
const {
    DoctorScheduleServices,
} = require(`${DIST}/modules/DoctorSchedule/doctor-schedule.service`);
const {
    AppointmentServices,
} = require(`${DIST}/modules/Appointment/appointment.service`);

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

const dhakaParts = (offsetDays = 0) => {
    const moved = new Date(Date.now() + offsetDays * 24 * 60 * 60 * 1000);
    const get = (options) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Dhaka', ...options }).format(moved);
    return {
        day: get({ year: 'numeric', month: '2-digit', day: '2-digit' }),
        hour: Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Dhaka', hour: '2-digit', hour12: false }).format(moved)),
    };
};

(async () => {
    const mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri());
    // Unique indexes are built asynchronously; the guard is under test, so wait.
    await Appointment.init();

    const admin = await User.create({ name: 'Admin', role: 'admin', email: 'admin@test.local', mobileNumber: '01700000000', password: 'secret123' });
    const reception = await User.create({ name: 'Desk', role: 'receptionist', email: 'desk@test.local', mobileNumber: '01700000001', password: 'secret123' });
    const adminId = String(admin._id);
    const asDesk = { _id: String(reception._id), role: 'receptionist' };
    const asAdmin = { _id: adminId, role: 'admin' };

    const makePatient = (n) =>
        Patient.create({ patientId: `PT-00000${n}`, name: `Patient ${n}`, age: 30 + n, gender: 'female', phone: `0180000000${n}` });
    const [p1, p2, p3, p4] = await Promise.all([1, 2, 3, 4].map(makePatient));

    const drA = await DoctorServices.createDoctor({ name: 'Dr A', specialty: 'Medicine', phone: '01711111111', consultationFee: 500, email: 'a@test.local', password: 'secret123' }, adminId);
    const drB = await DoctorServices.createDoctor({ name: 'Dr B', specialty: 'ENT', phone: '01722222222', consultationFee: 400, email: 'b@test.local', password: 'secret123' }, adminId);
    const asDrA = { _id: String(drA.user), role: 'doctor' };
    const asDrB = { _id: String(drB.user), role: 'doctor' };

    const { day } = dhakaParts(2);
    const proposed = await DoctorScheduleServices.createSchedule({ doctor: String(drA._id), date: day, startTime: '09:00', endTime: '10:00', slotMinutes: 15 }, adminId);
    const scheduleId = String(proposed._id);

    // ── Only an approved schedule can be booked ───────────────────────────
    await rejectsWith('a pending schedule cannot be booked', 409, () =>
        AppointmentServices.createAppointment({ schedule: scheduleId, slotIndex: 0, patient: String(p1._id) }, String(reception._id))
    );
    check('a pending schedule offers no availability', (await AppointmentServices.getAvailability({ date: day })).length, 0);

    await DoctorScheduleServices.approveSchedule(scheduleId, asDrA);
    const open = await AppointmentServices.getAvailability({ date: day });
    check('an approved schedule appears with all slots free', [open.length, open[0].freeCount, open[0].slots.length], [1, 4, 4]);
    check('availability can be narrowed to another doctor', (await AppointmentServices.getAvailability({ date: day, doctor: String(drB._id) })).length, 0);

    // ── Booking ───────────────────────────────────────────────────────────
    const first = await AppointmentServices.createAppointment({ schedule: scheduleId, slotIndex: 0, patient: String(p1._id), notes: 'follow-up' }, String(reception._id));
    check('first booking gets serial 1 at the slot time', [first.serialNo, first.startTime, first.endTime, first.status], [1, '09:00', '09:15', 'booked']);
    check('the fee is frozen from the schedule', first.fee, 500);
    check('the patient is snapshotted', [first.patientInfo.name, first.patientInfo.phone], ['Patient 1', '01800000001']);
    check('appointment number is dated and sequential', first.appointmentNumber, `APT-${day.slice(2).replace(/-/g, '')}-001`);

    await rejectsWith('the same slot cannot be booked twice', 409, () =>
        AppointmentServices.createAppointment({ schedule: scheduleId, slotIndex: 0, patient: String(p2._id) }, String(reception._id))
    );
    await rejectsWith('the same patient cannot hold two slots in one schedule', 409, () =>
        AppointmentServices.createAppointment({ schedule: scheduleId, slotIndex: 1, patient: String(p1._id) }, String(reception._id))
    );
    await rejectsWith('a slot beyond the schedule does not exist', 400, () =>
        AppointmentServices.createAppointment({ schedule: scheduleId, slotIndex: 9, patient: String(p2._id) }, String(reception._id))
    );

    // ── The race the unique index exists for ──────────────────────────────
    const race = await Promise.allSettled([
        AppointmentServices.createAppointment({ schedule: scheduleId, slotIndex: 1, patient: String(p2._id) }, String(reception._id)),
        AppointmentServices.createAppointment({ schedule: scheduleId, slotIndex: 1, patient: String(p3._id) }, String(admin._id)),
    ]);
    check('two bookings racing for one slot: exactly one wins', race.filter((r) => r.status === 'fulfilled').length, 1);
    const loser = race.find((r) => r.status === 'rejected');
    check('the loser is told the slot was taken', loser.reason.statusCode, 409);
    check('only one appointment holds that slot', await Appointment.countDocuments({ schedule: scheduleId, slotIndex: 1, holdsSlot: true }), 1);

    const afterBooking = (await AppointmentServices.getAvailability({ date: day }))[0];
    check('availability shows booked slots as taken', afterBooking.slots.map((s) => s.state), ['taken', 'taken', 'free', 'free']);
    check('free count follows', afterBooking.freeCount, 2);

    // ── Cancelling gives the slot back ────────────────────────────────────
    await rejectsWith('cancelling an unknown appointment is a 404', 404, () =>
        AppointmentServices.cancel('64b000000000000000000000', 'x', asAdmin)
    );
    const cancelled = await AppointmentServices.cancel(String(first._id), 'Patient called to cancel', asAdmin);
    check('a booked appointment can be cancelled', [cancelled.status, cancelled.holdsSlot, cancelled.cancelReason], ['cancelled', false, 'Patient called to cancel']);
    await rejectsWith('a cancelled appointment cannot be cancelled again', 409, () =>
        AppointmentServices.cancel(String(first._id), 'again', asAdmin)
    );
    const rebooked = await AppointmentServices.createAppointment({ schedule: scheduleId, slotIndex: 0, patient: String(p4._id) }, String(reception._id));
    check('the freed slot can be booked again, keeping its serial', [rebooked.serialNo, rebooked.patientInfo.name], [1, 'Patient 4']);
    check('the cancelled record is kept', await Appointment.countDocuments({ schedule: scheduleId, slotIndex: 0 }), 2);

    // ── Day of visit ──────────────────────────────────────────────────────
    await rejectsWith('completing before check-in is refused', 409, () =>
        AppointmentServices.complete(String(rebooked._id), asDrA)
    );
    await rejectsWith('no-show before the time has come is refused', 409, () =>
        AppointmentServices.markNoShow(String(rebooked._id), asDesk)
    );
    const checkedIn = await AppointmentServices.checkIn(String(rebooked._id), asDesk);
    check('the desk can check a patient in', [checkedIn.status, Boolean(checkedIn.checkedInAt)], ['checked_in', true]);
    await rejectsWith("another doctor cannot complete my patient's appointment", 404, () =>
        AppointmentServices.complete(String(rebooked._id), asDrB)
    );
    const done = await AppointmentServices.complete(String(rebooked._id), asDrA);
    check('the owning doctor completes it', [done.status, Boolean(done.completedAt)], ['completed', true]);
    await rejectsWith('a completed appointment cannot be cancelled', 409, () =>
        AppointmentServices.cancel(String(rebooked._id), 'too late', asAdmin)
    );

    // ── Visibility ────────────────────────────────────────────────────────
    check('a doctor sees only their own appointments', (await AppointmentServices.getAppointments({}, asDrA)).meta.total, 3);
    check('another doctor sees none of them', (await AppointmentServices.getAppointments({}, asDrB)).meta.total, 0);
    check('a doctor cannot widen the list with ?doctor=', (await AppointmentServices.getAppointments({ doctor: String(drA._id) }, asDrB)).meta.total, 0);
    check('the desk can filter by day and status', (await AppointmentServices.getAppointments({ date: day, status: 'completed' }, asDesk)).meta.total, 1);
    check('the desk can search by patient phone', (await AppointmentServices.getAppointments({ searchTerm: '01800000001' }, asDesk)).meta.total, 1);
    check('search treats punctuation literally', (await AppointmentServices.getAppointments({ searchTerm: '.*' }, asDesk)).meta.total, 0);

    // ── A slot that has already ended ─────────────────────────────────────
    if (dhakaParts(0).hour >= 1) {
        const today = dhakaParts(0).day;
        const early = await DoctorScheduleServices.createSchedule({ doctor: String(drB._id), date: today, startTime: '00:00', endTime: '00:30', slotMinutes: 15 }, adminId);
        await DoctorScheduleServices.approveSchedule(String(early._id), asDrB);
        await rejectsWith('a slot that has already ended cannot be booked', 409, () =>
            AppointmentServices.createAppointment({ schedule: String(early._id), slotIndex: 0, patient: String(p1._id) }, String(reception._id))
        );
        const states = (await AppointmentServices.getAvailability({ date: today, doctor: String(drB._id) }))[0].slots.map((s) => s.state);
        check('ended slots show as past', states, ['past', 'past']);
        await DoctorScheduleServices.cancelSchedule(String(early._id), 'test cleanup', asAdmin);
    }

    // ── Cancelling a schedule releases its bookings ───────────────────────
    const second = await AppointmentServices.createAppointment({ schedule: scheduleId, slotIndex: 2, patient: String(p1._id) }, String(reception._id));
    const released = await DoctorScheduleServices.cancelSchedule(scheduleId, 'Doctor on leave', asAdmin);
    const names = released.cancelledAppointments.map((a) => a.patientName);
    check('cancelling a schedule reports who to call (live bookings only)', [names.length, names.includes('Patient 1')], [2, true]);
    check('the released appointments are cancelled and free their slots', await Appointment.countDocuments({ schedule: scheduleId, holdsSlot: true, status: { $in: ['booked', 'checked_in'] } }), 0);
    check('the completed visit is left alone', (await Appointment.findById(rebooked._id)).status, 'completed');
    check('a cancelled schedule offers no availability', (await AppointmentServices.getAvailability({ date: day })).length, 0);
    await rejectsWith('a cancelled schedule cannot be booked', 409, () =>
        AppointmentServices.createAppointment({ schedule: scheduleId, slotIndex: 3, patient: String(p1._id) }, String(reception._id))
    );
    check('the second booking was among those released', (await Appointment.findById(second._id)).status, 'cancelled');

    await mongoose.disconnect();
    await mongod.stop();

    console.log(failures === 0 ? '\nAll checks passed' : `\n${failures} check(s) FAILED`);
    process.exit(failures === 0 ? 0 : 1);
})().catch((error) => {
    console.error(error);
    process.exit(1);
});
