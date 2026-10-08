/**
 * Verifies moving a booked patient to another slot, what a doctor may do to
 * their own appointments, and writing a prescription. Needs a replica set:
 * booking takes payments in transactions.
 */
process.env.NODE_ENV = 'development';

const mongoose = require('mongoose');
const { MongoMemoryReplSet } = require('mongodb-memory-server');

const DIST = require('path').join(__dirname, '..', 'dist', 'app');
const { User } = require(`${DIST}/modules/User/user.model`);
const { Patient } = require(`${DIST}/modules/Patient/patient.model`);
const { Appointment } = require(`${DIST}/modules/Appointment/appointment.model`);
const { Prescription } = require(`${DIST}/modules/Prescription/prescription.model`);
const { DoctorServices } = require(`${DIST}/modules/Doctor/doctor.service`);
const { DoctorScheduleServices } = require(`${DIST}/modules/DoctorSchedule/doctor-schedule.service`);
const { AppointmentServices } = require(`${DIST}/modules/Appointment/appointment.service`);
const { PrescriptionServices } = require(`${DIST}/modules/Prescription/prescription.service`);

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

const dayAhead = (offsetDays) =>
    new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Dhaka' }).format(new Date(Date.now() + offsetDays * 864e5));

(async () => {
    const replSet = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } });
    await mongoose.connect(replSet.getUri(), { dbName: 'newlab_verify_rx' });
    await Appointment.init();
    await Prescription.init();

    try {
        const admin = await User.create({ name: 'Admin One', role: 'admin', email: 'admin@t.local', mobileNumber: '017', password: 'secret123' });
        const reception = await User.create({ name: 'Desk One', role: 'receptionist', email: 'desk@t.local', mobileNumber: '018', password: 'secret123' });
        const adminId = String(admin._id);
        const asAdmin = { _id: adminId, role: 'admin' };
        const asDesk = { _id: String(reception._id), role: 'receptionist' };

        const [p1, p2] = await Promise.all(
            [1, 2].map((n) => Patient.create({ patientId: `PT-00000${n}`, name: `Patient ${n}`, age: 30 + n, gender: 'male', phone: `0190000000${n}` }))
        );

        const drA = await DoctorServices.createDoctor({ name: 'Dr A', specialty: 'Medicine', degrees: 'MBBS', phone: '01711111111', consultationFee: 500, email: 'a@t.local', password: 'secret123' }, adminId);
        const drB = await DoctorServices.createDoctor({ name: 'Dr B', specialty: 'ENT', phone: '01722222222', consultationFee: 400, email: 'b@t.local', password: 'secret123' }, adminId);
        const asDrA = { _id: String(drA.user), role: 'doctor' };
        const asDrB = { _id: String(drB.user), role: 'doctor' };

        const makeSchedule = async (doctor, asDoctor, day, startTime, endTime) => {
            const created = await DoctorScheduleServices.createSchedule({ doctor: String(doctor._id), date: day, startTime, endTime, slotMinutes: 15 }, adminId);
            await DoctorScheduleServices.approveSchedule(String(created._id), asDoctor);
            return String(created._id);
        };
        const book = (sid, patient, slotIndex) =>
            AppointmentServices.createAppointment({ schedule: sid, slotIndex, patient: String(patient._id) }, asDesk._id);

        const day = dayAhead(2);
        const sidA = await makeSchedule(drA, asDrA, day, '09:00', '10:00');
        const sidA2 = await makeSchedule(drA, asDrA, dayAhead(3), '09:00', '09:30');
        const sidB = await makeSchedule(drB, asDrB, day, '09:00', '10:00');

        // ── Rescheduling ──────────────────────────────────────────────────
        console.log('--- rescheduling ---');
        const a1 = await book(sidA, p1, 0);
        await book(sidA, p2, 1);

        const moved = await AppointmentServices.reschedule(String(a1._id), { schedule: sidA, slotIndex: 3 }, asDesk);
        check('the desk moves a patient to a free slot', [moved.slotIndex, moved.serialNo, moved.startTime, moved.status], [3, 4, '09:45', 'booked']);
        check('the old place is remembered', [moved.rescheduledFrom.startTime, moved.rescheduledFrom.serialNo, Boolean(moved.rescheduledAt)], ['09:00', 1, true]);
        check('the invoice and fee are untouched', [String(moved.invoice._id), moved.fee], [String(a1.invoice._id), 500]);

        const freed = (await AppointmentServices.getAvailability({ date: day }, asAdmin)).find((x) => String(x.schedule._id) === sidA);
        check('the old slot is free and the new one taken', [freed.slots[0].state, freed.slots[3].state], ['free', 'taken']);

        await rejectsWith('into a taken slot is refused', 409, () => AppointmentServices.reschedule(String(a1._id), { schedule: sidA, slotIndex: 1 }, asDesk));
        await rejectsWith('into the slot it already holds is refused', 400, () => AppointmentServices.reschedule(String(a1._id), { schedule: sidA, slotIndex: 3 }, asDesk));
        await rejectsWith('to another doctor is refused', 400, () => AppointmentServices.reschedule(String(a1._id), { schedule: sidB, slotIndex: 0 }, asDesk));
        await rejectsWith('to a slot that does not exist is refused', 400, () => AppointmentServices.reschedule(String(a1._id), { schedule: sidA, slotIndex: 40 }, asDesk));
        await rejectsWith('another doctor cannot move it', 404, () => AppointmentServices.reschedule(String(a1._id), { schedule: sidA, slotIndex: 2 }, asDrB));

        await DoctorScheduleServices.blockSlot(sidA, 2, 'Break', asDrA);
        await rejectsWith('into a blocked slot is refused', 409, () => AppointmentServices.reschedule(String(a1._id), { schedule: sidA, slotIndex: 2 }, asDrA));

        const nextDay = await AppointmentServices.reschedule(String(a1._id), { schedule: sidA2, slotIndex: 0 }, asDrA);
        check('the doctor moves their own patient to another day', [nextDay.startTime, String(nextDay.schedule)], ['09:00', sidA2]);

        // ── What the doctor may do ────────────────────────────────────────
        console.log('\n--- the doctor works their own list ---');
        const mine = await Appointment.findOne({ patient: p2._id, schedule: sidA, holdsSlot: true });
        const mineId = String(mine._id);
        const availA = await AppointmentServices.getAvailability({ date: day, doctor: String(drB._id) }, asDrA);
        check('availability is limited to their own schedules', availA.every((x) => String(x.schedule.doctor._id) === String(drA._id)), true);

        await rejectsWith('another doctor cannot call my patient in', 404, () => AppointmentServices.checkIn(mineId, asDrB));
        const calledIn = await AppointmentServices.checkIn(mineId, asDrA);
        check('the doctor calls the patient in', calledIn.status, 'checked_in');
        await rejectsWith('a patient who is being seen cannot be moved', 409, () => AppointmentServices.reschedule(mineId, { schedule: sidA, slotIndex: 0 }, asDrA));

        const requested = await AppointmentServices.requestCancel(mineId, 'Doctor called away', asDrA);
        check('the doctor can ask for a cancellation', [requested.cancellation.status, requested.cancellation.requestedByName], ['pending', 'Dr A']);
        await rejectsWith('and cannot cancel outright', 403, () => AppointmentServices.cancel(mineId, 'x', asDrA));
        await AppointmentServices.rejectCancel(mineId, 'Please stay', asAdmin);

        const other = await book(sidA, p1, 0);
        await AppointmentServices.requestCancel(String(other._id), 'Check', asDesk);
        await rejectsWith('a pending request blocks a move', 409, () => AppointmentServices.reschedule(String(other._id), { schedule: sidA, slotIndex: 5 }, asDesk));
        await AppointmentServices.rejectCancel(String(other._id), 'No', asAdmin);

        // ── Prescriptions ─────────────────────────────────────────────────
        console.log('\n--- prescriptions ---');
        const rx = {
            complaints: 'Fever for three days',
            diagnosis: 'Viral fever',
            medicines: [{ name: 'Paracetamol', dose: '500 mg', frequency: '1+1+1', duration: '5 days', instruction: 'after meals' }],
            investigations: ['CBC'],
            advice: 'Rest and fluids',
            followUpDate: dayAhead(9),
        };

        await rejectsWith('no prescription before the patient is called in', 409, () => PrescriptionServices.savePrescription(String(other._id), rx, asDrA));
        await rejectsWith('another doctor cannot write it', 404, () => PrescriptionServices.savePrescription(mineId, rx, asDrB));

        const first = await PrescriptionServices.savePrescription(mineId, rx, asDrA);
        check('the doctor writes one for a called-in patient', [/^RX-\d{6}-001$/.test(first.prescriptionNumber), first.medicines.length, first.patientInfo.name, first.doctorInfo.name], [true, 1, 'Patient 2', 'Dr A']);
        check('the follow-up date is kept', Boolean(first.followUpDate), true);
        const linked = await Appointment.findById(mineId);
        check('the appointment points at it', [String(linked.prescription), linked.prescriptionNumber], [String(first._id), first.prescriptionNumber]);

        const second = await PrescriptionServices.savePrescription(mineId, { ...rx, diagnosis: 'Dengue suspected', followUpDate: null }, asDrA);
        check('saving again edits the same prescription', [String(second._id), second.prescriptionNumber, second.diagnosis, second.followUpDate], [String(first._id), first.prescriptionNumber, 'Dengue suspected', undefined]);
        check('and never makes a second', await Prescription.countDocuments({ appointment: mine._id }), 1);

        await AppointmentServices.complete(mineId, asDrA);
        const afterComplete = await PrescriptionServices.savePrescription(mineId, { ...rx, advice: 'More rest' }, asDrA);
        check('it can still be corrected after the visit is completed', afterComplete.advice, 'More rest');

        const read = await PrescriptionServices.getByAppointment(mineId, asDesk);
        check('the desk can read it to print', read.prescriptionNumber, first.prescriptionNumber);
        await rejectsWith('another doctor cannot read it', 404, () => PrescriptionServices.getByAppointment(mineId, asDrB));
        check('an appointment with none returns nothing', await PrescriptionServices.getByAppointment(String(other._id), asDrA), null);

        const history = await PrescriptionServices.getPrescriptions({ patient: String(p2._id) }, asDesk);
        check('a patient history lists it', [history.meta.total, history.result[0].prescriptionNumber], [1, first.prescriptionNumber]);
        check('another doctor sees none of it', (await PrescriptionServices.getPrescriptions({ patient: String(p2._id) }, asDrB)).meta.total, 0);
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
