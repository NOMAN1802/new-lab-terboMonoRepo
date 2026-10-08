/**
 * Gives every existing doctor their entry on the Referrers list. Safe to run
 * more than once: doctors already linked are only refreshed. The Doctors page
 * does the same lazily, so this is for linking everyone in one go.
 *
 *   pnpm --filter @repo/server run backfill:doctor-referrers
 *
 * Reads DB_URL from apps/server/.env.
 */
const mongoose = require('mongoose');

const DIST = require('path').join(__dirname, '..', 'dist', 'app');
const config = require(`${DIST}/config`).default;
const { Doctor } = require(`${DIST}/modules/Doctor/doctor.model`);
const { DoctorServices } = require(`${DIST}/modules/Doctor/doctor.service`);

(async () => {
    if (!config.db_url) throw new Error('DB_URL is not set');
    await mongoose.connect(config.db_url);

    const doctors = await Doctor.find({ isDeleted: false });
    let linked = 0;
    for (const doctor of doctors) {
        const had = Boolean(doctor.referrer);
        const entry = await DoctorServices.ensureReferrer(doctor, String(doctor.createdBy ?? doctor.user));
        if (!had) linked += 1;
        console.log(`${had ? 'kept  ' : 'linked'}  ${doctor.doctorCode}  ${doctor.name}  ->  ${entry.referrerCode}`);
    }
    console.log(`\n${doctors.length} doctor(s), ${linked} newly linked`);
    await mongoose.disconnect();
})().catch(async (error) => {
    console.error(error);
    await mongoose.disconnect();
    process.exit(1);
});
