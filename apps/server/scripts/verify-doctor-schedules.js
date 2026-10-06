/**
 * End-to-end verification of doctors and schedules against an in-memory
 * MongoDB. Exercises the service layer the API calls: the admin proposes, only
 * the owning doctor can answer, and nothing but a pending schedule can be
 * approved, declined or edited.
 */
process.env.NODE_ENV = 'development';

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

const DIST = require('path').join(__dirname, '..', 'dist', 'app');
const { User } = require(`${DIST}/modules/User/user.model`);
const { Doctor } = require(`${DIST}/modules/Doctor/doctor.model`);
const { DoctorServices } = require(`${DIST}/modules/Doctor/doctor.service`);
const {
    DoctorScheduleServices,
} = require(`${DIST}/modules/DoctorSchedule/doctor-schedule.service`);
const { ActivityLog } = require(`${DIST}/modules/ActivityLog/activity-log.model`);
const { UserServices } = require(`${DIST}/modules/User/user.service`);

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

const dhakaDay = (offsetDays) => {
    const moved = new Date(Date.now() + offsetDays * 24 * 60 * 60 * 1000);
    return new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Dhaka',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).format(moved);
};

(async () => {
    const mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri());

    const admin = await User.create({
        name: 'Admin',
        role: 'admin',
        email: 'admin@test.local',
        mobileNumber: '01700000000',
        password: 'secret123',
    });
    const adminId = String(admin._id);
    const asAdmin = { _id: adminId, role: 'admin' };

    // ── Doctors ────────────────────────────────────────────────────────────
    const drA = await DoctorServices.createDoctor(
        { name: 'Dr A', specialty: 'Medicine', phone: '01711111111', consultationFee: 500, email: 'a@test.local', password: 'secret123' },
        adminId
    );
    const drB = await DoctorServices.createDoctor(
        { name: 'Dr B', specialty: 'Cardiology', phone: '01722222222', consultationFee: 800, email: 'b@test.local', password: 'secret123' },
        adminId
    );
    check('doctor codes are sequential', [drA.doctorCode, drB.doctorCode], ['DR-0001', 'DR-0002']);

    const loginA = await User.findById(drA.user);
    check('doctor gets a doctor-role login', loginA.role, 'doctor');
    await rejectsWith('duplicate login email is rejected', 400, () =>
        DoctorServices.createDoctor(
            { name: 'Dr C', specialty: 'ENT', phone: '01733333333', consultationFee: 300, email: 'a@test.local', password: 'secret123' },
            adminId
        )
    );
    check('failed create leaves no orphan doctor', await Doctor.countDocuments(), 2);

    const asDrA = { _id: String(drA.user), role: 'doctor' };
    const asDrB = { _id: String(drB.user), role: 'doctor' };
    const day = dhakaDay(3);

    // ── Creating schedules ────────────────────────────────────────────────
    const created = await DoctorScheduleServices.createSchedule(
        { doctor: String(drA._id), date: day, startTime: '09:00', endTime: '12:00', slotMinutes: 15 },
        adminId
    );
    check('new schedule is pending', created.status, 'pending');
    check('fee defaults to the doctor fee', created.fee, 500);
    check('slot count is derived', created.slotCount, 12);

    await rejectsWith('overlap with the same doctor is rejected', 409, () =>
        DoctorScheduleServices.createSchedule(
            { doctor: String(drA._id), date: day, startTime: '11:00', endTime: '13:00', slotMinutes: 15 },
            adminId
        )
    );
    const backToBack = await DoctorScheduleServices.createSchedule(
        { doctor: String(drA._id), date: day, startTime: '12:00', endTime: '14:00', slotMinutes: 20, fee: 650 },
        adminId
    );
    check('back-to-back schedule is allowed and keeps a custom fee', [backToBack.status, backToBack.fee], ['pending', 650]);
    const otherDoctor = await DoctorScheduleServices.createSchedule(
        { doctor: String(drB._id), date: day, startTime: '09:00', endTime: '12:00', slotMinutes: 15 },
        adminId
    );
    check('a different doctor can use the same time', otherDoctor.status, 'pending');
    await rejectsWith('past dates are rejected', 400, () =>
        DoctorScheduleServices.createSchedule(
            { doctor: String(drA._id), date: dhakaDay(-1), startTime: '09:00', endTime: '12:00', slotMinutes: 15 },
            adminId
        )
    );
    await rejectsWith('a window shorter than one slot is rejected', 400, () =>
        DoctorScheduleServices.createSchedule(
            { doctor: String(drA._id), date: dhakaDay(5), startTime: '09:00', endTime: '09:10', slotMinutes: 15 },
            adminId
        )
    );

    // ── Doctor visibility and ownership ───────────────────────────────────
    const mine = await DoctorScheduleServices.getSchedules({}, asDrA);
    check('a doctor lists only their own schedules', mine.meta.total, 2);
    const spoof = await DoctorScheduleServices.getSchedules({ doctor: String(drB._id) }, asDrA);
    check('a doctor cannot widen the list with ?doctor=', spoof.meta.total, 2);
    check('admin sees every schedule', (await DoctorScheduleServices.getSchedules({}, asAdmin)).meta.total, 3);
    await rejectsWith('another doctor cannot read my schedule', 404, () =>
        DoctorScheduleServices.getSchedule(String(created._id), asDrB)
    );
    await rejectsWith('another doctor cannot approve my schedule', 404, () =>
        DoctorScheduleServices.approveSchedule(String(created._id), asDrB)
    );
    check('a refused approval changed nothing', (await DoctorScheduleServices.getSchedule(String(created._id), asAdmin)).status, 'pending');

    // ── Approve / decline ─────────────────────────────────────────────────
    const approved = await DoctorScheduleServices.approveSchedule(String(created._id), asDrA);
    check('the owner can approve', approved.status, 'approved');
    await rejectsWith('an approved schedule cannot be approved again', 409, () =>
        DoctorScheduleServices.approveSchedule(String(created._id), asDrA)
    );
    await rejectsWith('an approved schedule cannot be declined', 409, () =>
        DoctorScheduleServices.declineSchedule(String(created._id), 'changed my mind', asDrA)
    );
    await rejectsWith('an approved schedule cannot be edited', 409, () =>
        DoctorScheduleServices.updateSchedule(String(created._id), { endTime: '13:00' }, asAdmin)
    );

    const declined = await DoctorScheduleServices.declineSchedule(String(backToBack._id), 'Away that afternoon', asDrA);
    check('the owner can decline with a reason', [declined.status, declined.declineReason], ['declined', 'Away that afternoon']);
    await rejectsWith('a declined schedule cannot be approved', 409, () =>
        DoctorScheduleServices.approveSchedule(String(backToBack._id), asDrA)
    );
    const freed = await DoctorScheduleServices.createSchedule(
        { doctor: String(drA._id), date: day, startTime: '12:00', endTime: '14:00', slotMinutes: 20 },
        adminId
    );
    check('a declined window no longer blocks that time', freed.status, 'pending');

    // ── Editing and cancelling ────────────────────────────────────────────
    const edited = await DoctorScheduleServices.updateSchedule(String(freed._id), { endTime: '15:00' }, asAdmin);
    check('a pending schedule can be edited', [edited.endTime, edited.slotCount], ['15:00', 9]);
    await rejectsWith('editing into an overlap is rejected', 409, () =>
        DoctorScheduleServices.updateSchedule(String(freed._id), { startTime: '11:00' }, asAdmin)
    );
    await rejectsWith('cancelling an approved schedule needs a reason', 400, () =>
        DoctorScheduleServices.cancelSchedule(String(created._id), undefined, asAdmin)
    );
    const cancelled = await DoctorScheduleServices.cancelSchedule(String(created._id), 'Doctor on leave', asAdmin);
    check('an approved schedule can be cancelled with a reason', cancelled.status, 'cancelled');
    await rejectsWith('a cancelled schedule cannot be cancelled again', 409, () =>
        DoctorScheduleServices.cancelSchedule(String(created._id), 'again', asAdmin)
    );

    // ── Removing a doctor ─────────────────────────────────────────────────
    await rejectsWith('a doctor with a live schedule cannot be removed', 409, () =>
        DoctorServices.deleteDoctor(String(drA._id), adminId)
    );
    await DoctorScheduleServices.cancelSchedule(String(freed._id), undefined, asAdmin);
    await DoctorServices.deleteDoctor(String(drA._id), adminId);
    const removedLogin = await User.findById(drA.user);
    check('removing a doctor disables their login', [removedLogin.isDeleted, removedLogin.status], [true, 'inactive']);
    await rejectsWith('a removed doctor cannot be given schedules', 404, () =>
        DoctorScheduleServices.createSchedule(
            { doctor: String(drA._id), date: dhakaDay(6), startTime: '09:00', endTime: '12:00', slotMinutes: 15 },
            adminId
        )
    );

    // ── A doctor is created as a user ─────────────────────────────────────
    const asUser = await UserServices.createUser(
        { name: 'Dr U', role: 'doctor', email: 'u@test.local', mobileNumber: '01744444444', password: 'secret123', specialty: 'Dermatology', degrees: 'MBBS', consultationFee: 350 },
        adminId
    );
    check('creating a user with the doctor role gives a doctor login', [asUser.role, asUser.status], ['doctor', 'active']);
    const profile = await Doctor.findOne({ user: asUser._id });
    check('and a doctor profile built from the same form', [profile.name, profile.phone, profile.specialty, profile.degrees, profile.consultationFee], ['Dr U', '01744444444', 'Dermatology', 'MBBS', 350]);
    check('the profile gets the next doctor code', profile.doctorCode, 'DR-0003');
    await rejectsWith('the email must be new, as for any user', 400, () =>
        UserServices.createUser({ name: 'Dr V', role: 'doctor', email: 'u@test.local', mobileNumber: '01766666666', password: 'secret123', specialty: 'ENT', consultationFee: 100 }, adminId)
    );
    check('a refused doctor leaves no profile behind', await Doctor.countDocuments({ isDeleted: false }), 2);

    const renamed = await UserServices.updateUser(String(asUser._id), { name: 'Dr Renamed', mobileNumber: '01755555555' });
    const synced = await Doctor.findOne({ user: asUser._id });
    check('renaming the user renames the doctor', [renamed.name, synced.name, synced.phone], ['Dr Renamed', 'Dr Renamed', '01755555555']);
    await UserServices.updateUser(String(asUser._id), { status: 'inactive' });
    check('deactivating the login deactivates the doctor', (await Doctor.findOne({ user: asUser._id })).isActive, false);
    await UserServices.updateUser(String(asUser._id), { status: 'active' });
    check('and reactivating brings them back', (await Doctor.findOne({ user: asUser._id })).isActive, true);
    await rejectsWith('a doctor login cannot be turned into another role', 400, () => UserServices.updateUser(String(asUser._id), { role: 'admin' }));

    const live = await DoctorScheduleServices.createSchedule({ doctor: String(profile._id), date: dhakaDay(9), startTime: '09:00', endTime: '10:00', slotMinutes: 15 }, adminId);
    await rejectsWith('removing the user is refused while the doctor has live schedules', 409, () => UserServices.deleteUser(String(asUser._id), adminId));
    check('and nothing was removed', [(await User.findById(asUser._id)).isDeleted, (await Doctor.findById(profile._id)).isDeleted], [false, false]);
    await DoctorScheduleServices.cancelSchedule(String(live._id), undefined, asAdmin);
    check('once the schedules are cleared the user can be removed', await UserServices.deleteUser(String(asUser._id), adminId), true);
    const gone = await User.findById(asUser._id);
    check('which removes the login and the doctor together', [gone.isDeleted, gone.status, (await Doctor.findById(profile._id)).isDeleted], [true, 'inactive', true]);

    const plain = await User.create({ name: 'Plain', role: 'receptionist', email: 'plain@test.local', mobileNumber: '019', password: 'secret123' });
    check('an ordinary user is removed as before', await UserServices.deleteUser(String(plain._id), adminId), true);

    // ── Audit trail ───────────────────────────────────────────────────────
    await new Promise((resolve) => setTimeout(resolve, 300));
    const actions = (await ActivityLog.find().select('action')).map((entry) => entry.action);
    for (const action of ['doctor.created', 'schedule.created', 'schedule.approved', 'schedule.declined', 'schedule.cancelled', 'doctor.removed']) {
        check(`activity log recorded ${action}`, actions.includes(action), true);
    }

    await mongoose.disconnect();
    await mongod.stop();

    console.log(failures === 0 ? '\nAll checks passed' : `\n${failures} check(s) FAILED`);
    process.exit(failures === 0 ? 0 : 1);
})().catch((error) => {
    console.error(error);
    process.exit(1);
});
