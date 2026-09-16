/**
 * Proves the report-upload path against the REAL Cloudinary account.
 *
 * Everything else is covered without touching the network; this one cannot be.
 * It uploads a small PDF and a small PNG, checks that a PDF is stored as a raw
 * asset rather than a broken image, fetches a signed URL for each, confirms an
 * unsigned URL is refused, then deletes both so nothing is left behind.
 *
 *   cd server && npm run verify:cloudinary
 *
 * Requires CLOUDINARY_* in .env. Costs a couple of API calls.
 */
/* eslint-disable no-console */
const path = require('path');
require('dotenv').config({ path: path.join(process.cwd(), '.env') });

const DIST = path.join(__dirname, '..', 'dist', 'app');
const {
    uploadReportFile,
    getSignedFileUrl,
    deleteReportFile,
} = require(`${DIST}/utils/fileUpload`);

let failures = 0;
const check = (label, ok, detail) => {
    if (!ok) failures += 1;
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${ok || !detail ? '' : `\n        ${detail}`}`);
};

/** Smallest valid one-page PDF. */
const PDF = Buffer.from(
    '%PDF-1.1\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n' +
        '2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n' +
        '3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 99 99]>>endobj\n' +
        'trailer<</Root 1 0 R>>\n%%EOF\n',
    'latin1'
);

/** 1x1 transparent PNG. */
const PNG = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    'base64'
);

const asFile = (buffer, originalname, mimetype) => ({
    buffer,
    originalname,
    mimetype,
    size: buffer.length,
    fieldname: 'report',
});

const fetchStatus = async (url) => {
    try {
        const res = await fetch(url, { method: 'GET' });
        return res.status;
    } catch (error) {
        return `network error: ${error.message}`;
    }
};

(async () => {
    for (const key of [
        'CLOUDINARY_CLOUD_NAME',
        'CLOUDINARY_API_KEY',
        'CLOUDINARY_API_SECRET',
    ]) {
        if (!process.env[key]) {
            console.error(`\n${key} is not set in server/.env — cannot run.\n`);
            process.exit(1);
        }
    }
    console.log(`Cloudinary cloud: ${process.env.CLOUDINARY_CLOUD_NAME}\n`);

    const uploaded = [];

    try {
        console.log('--- PDF report ---');
        const pdf = await uploadReportFile(
            asFile(PDF, 'blood-report.pdf', 'application/pdf'),
            'newlab/_smoketest'
        );
        uploaded.push(pdf);
        check('PDF uploaded', Boolean(pdf.publicId), JSON.stringify(pdf));
        // A PDF routed into Cloudinary's image pipeline 401s on delivery,
        // because PDF-as-image is blocked by default on most accounts.
        check(
            `PDF stored as a raw asset (got "${pdf.resourceType}")`,
            pdf.resourceType === 'raw',
            'resourceTypeFor() in fileUpload.ts is not routing PDFs to raw'
        );
        check('original filename kept', pdf.originalName, 'blood-report.pdf');
        check('byte size recorded', pdf.size > 0);

        console.log('\n--- Image report ---');
        const png = await uploadReportFile(
            asFile(PNG, 'xray.png', 'image/png'),
            'newlab/_smoketest'
        );
        uploaded.push(png);
        check('PNG uploaded', Boolean(png.publicId));
        check(`PNG stored as an image (got "${png.resourceType}")`, png.resourceType === 'image');

        console.log('\n--- Signed delivery (reports are medical records) ---');
        for (const asset of uploaded) {
            const signed = getSignedFileUrl(
                asset.publicId,
                asset.resourceType,
                asset.format,
                asset.version
            );
            const status = await fetchStatus(signed);
            check(
                `signed URL opens for ${asset.originalName} (HTTP ${status})`,
                status === 200,
                signed
            );

            // The asset is `type: authenticated`, so a URL whose signature does
            // not match must be rejected — that is what keeps a report from
            // being read by guessing its path.
            const tampered = signed.replace(/s--[^/]+--/, 's--0000000000--');
            const tamperedStatus = await fetchStatus(tampered);
            check(
                `tampered signature refused for ${asset.originalName} (HTTP ${tamperedStatus})`,
                tamperedStatus === 401 || tamperedStatus === 403 || tamperedStatus === 404,
                `expected a rejection, got ${tamperedStatus}: ${tampered}`
            );
        }
    } catch (error) {
        failures += 1;
        console.error('\nUNEXPECTED ERROR:', error.message);
    } finally {
        console.log('\n--- Cleanup ---');
        for (const asset of uploaded) {
            try {
                await deleteReportFile(asset.publicId, asset.resourceType);
                console.log(`PASS  removed ${asset.publicId}`);
            } catch (error) {
                failures += 1;
                console.log(`FAIL  could not remove ${asset.publicId}: ${error.message}`);
            }
        }

        console.log(
            `\n${failures === 0 ? '*** CLOUDINARY PATH VERIFIED ***' : `*** ${failures} CHECK(S) FAILED ***`}\n`
        );
        process.exit(failures === 0 ? 0 : 1);
    }
})();
