import { useRef } from 'react';
import { useParams } from 'react-router-dom';
import { useReactToPrint } from 'react-to-print';
import ErrorState from '@/components/common/ErrorState';
import Loader from '@/components/common/Loader';
import BrandLogo from '@/components/brand/BrandLogo';
import { BRAND_RED, BRAND_GREEN } from '@/lib/brand';
import { CENTRE } from '@/lib/centre';
import { formatDate } from '@/lib/format';
import { useGetPrescriptionByAppointmentQuery } from '@/services/prescriptionsApi';

const Side = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <section style={{ marginBottom: 16 }}>
        <h3 style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: BRAND_GREEN }}>{title}</h3>
        <div style={{ marginTop: 3, fontSize: 12, lineHeight: 1.45 }}>{children}</div>
    </section>
);

const Blank = ({ label, children, grow = false }: { label: string; children: React.ReactNode; grow?: boolean }) => (
    <span style={{ display: 'flex', alignItems: 'baseline', gap: 6, flex: grow ? 1 : 'none', minWidth: 0 }}>
        <b style={{ fontSize: 12 }}>{label}</b>
        <span style={{ flex: 1, borderBottom: '1px dotted #555', padding: '0 6px', fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap' }}>
            {children}
        </span>
    </span>
);

/**
 * A prescription on the centre's pad: letterhead and doctor details on top, a
 * strip for the patient, findings down the left, the Rx down the right and the
 * appointment line and address along the foot.
 */
const PrintPrescriptionPage = () => {
    const { id } = useParams();
    const printRef = useRef<HTMLDivElement>(null);
    const { data: rx, isLoading, isError, refetch } = useGetPrescriptionByAppointmentQuery(id!);

    const handlePrint = useReactToPrint({
        contentRef: printRef,
        documentTitle: rx ? `Prescription-${rx.prescriptionNumber}` : 'Prescription',
    });

    if (isLoading) return <Loader fullScreen message="Preparing prescription..." />;
    if (isError) return <ErrorState title="Could not load the prescription" onRetry={refetch} />;
    if (!rx) return <ErrorState title="No prescription yet" description="The doctor has not written one for this visit." />;

    const degrees = (rx.doctorInfo.degrees ?? '')
        .split(/\n|;/)
        .map((line) => line.trim())
        .filter(Boolean);

    return (
        <div className="min-h-screen bg-slate-100 py-8 print:bg-white print:py-0">
            <style>{`
                @page { size: A4 portrait; margin: 0; }
                @media print { .sheet { width: auto !important; height: 297mm !important; box-shadow: none !important; } }
                .rx { font-family: 'Source Serif 4', Georgia, serif; color: #111; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            `}</style>

            <div className="mx-auto mb-4 flex max-w-[210mm] flex-wrap justify-end gap-3 px-4 print:hidden">
                <button
                    type="button"
                    onClick={() => window.history.back()}
                    className="rounded-sm border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
                >
                    Back
                </button>
                <button
                    type="button"
                    onClick={() => handlePrint()}
                    className="rounded-sm bg-slate-900 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700"
                >
                    Print / Save as PDF
                </button>
            </div>

            <div className="overflow-x-auto px-4 pb-4 print:overflow-visible print:p-0">
                <div
                    ref={printRef}
                    className="rx sheet mx-auto flex flex-col bg-white shadow-lg"
                    style={{ width: '210mm', height: '297mm', boxSizing: 'border-box', overflow: 'hidden' }}
                >
                    {/* Letterhead: the centre on the left, the doctor on the right. */}
                    <header style={{ padding: '10mm 12mm 3mm', display: 'flex', justifyContent: 'space-between', gap: 16 }}>
                        <BrandLogo size="letterhead" lang="en" />
                        <div style={{ textAlign: 'right', maxWidth: '58%' }}>
                            <p style={{ fontSize: 22, fontWeight: 800, letterSpacing: '.02em', color: BRAND_GREEN, textTransform: 'uppercase' }}>
                                {rx.doctorInfo.name}
                            </p>
                            <p style={{ fontSize: 12, fontWeight: 700, color: BRAND_RED }}>{rx.doctorInfo.specialty}</p>
                            {degrees.map((line) => (
                                <p key={line} style={{ fontSize: 10.5, lineHeight: 1.4, color: '#222' }}>
                                    {line}
                                </p>
                            ))}
                        </div>
                    </header>
                    <div style={{ height: 3, background: `linear-gradient(90deg, ${BRAND_RED}, ${BRAND_GREEN})` }} />

                    {/* The patient strip. */}
                    <div style={{ display: 'flex', gap: 18, padding: '3mm 12mm', borderBottom: '1px solid #bbb', flexWrap: 'wrap' }}>
                        <Blank label="Name:" grow>
                            {rx.patientInfo.name}
                        </Blank>
                        <Blank label="Age:">{rx.patientInfo.age}</Blank>
                        <Blank label="Sex:">{rx.patientInfo.gender}</Blank>
                        <Blank label="Date:">{formatDate(rx.visitDate)}</Blank>
                    </div>

                    {/* Findings on the left, the Rx on the right. */}
                    <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
                        <aside style={{ width: '56mm', padding: '5mm 4mm 5mm 12mm', borderRight: '1px solid #bbb', boxSizing: 'content-box' }}>
                            {rx.complaints && (
                                <Side title="Complaints">
                                    <p style={{ whiteSpace: 'pre-wrap' }}>{rx.complaints}</p>
                                </Side>
                            )}
                            {rx.diagnosis && (
                                <Side title="Diagnosis">
                                    <p style={{ whiteSpace: 'pre-wrap' }}>{rx.diagnosis}</p>
                                </Side>
                            )}
                            {rx.investigations.length > 0 && (
                                <Side title="Investigations">
                                    <ul style={{ margin: 0, paddingLeft: 14 }}>
                                        {rx.investigations.map((test) => (
                                            <li key={test}>{test}</li>
                                        ))}
                                    </ul>
                                </Side>
                            )}
                            {rx.advice && (
                                <Side title="Advice">
                                    <p style={{ whiteSpace: 'pre-wrap' }}>{rx.advice}</p>
                                </Side>
                            )}
                            {rx.followUpDate && (
                                <Side title="Follow-up">
                                    <p style={{ fontWeight: 700 }}>{formatDate(rx.followUpDate)}</p>
                                </Side>
                            )}
                        </aside>

                        <main style={{ flex: 1, padding: '4mm 12mm 5mm 8mm' }}>
                            <p style={{ fontSize: 34, fontWeight: 700, lineHeight: 1, color: BRAND_GREEN }}>℞</p>
                            <ul style={{ listStyle: 'none', margin: '10px 0 0', padding: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
                                {rx.medicines.map((medicine, index) => (
                                    <li key={index}>
                                        <p style={{ fontSize: 15, fontWeight: 700 }}>
                                            <span style={{ marginRight: 8 }}>•</span>
                                            <span style={{ borderBottom: '1.5px solid #111' }}>{medicine.name}</span>
                                            {medicine.dose && <span style={{ marginLeft: 10, fontWeight: 600, fontSize: 13 }}>{medicine.dose}</span>}
                                        </p>
                                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginTop: 4, paddingLeft: 18, fontSize: 13 }}>
                                            <span style={{ flex: 1 }}>
                                                {[medicine.frequency, medicine.instruction].filter(Boolean).join(' · ')}
                                            </span>
                                            {medicine.duration && (
                                                <span style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>
                                                    <span style={{ display: 'inline-block', width: 34, borderTop: '1px solid #111', verticalAlign: 'middle', marginRight: 8 }} />
                                                    {medicine.duration}
                                                </span>
                                            )}
                                        </div>
                                    </li>
                                ))}
                            </ul>

                            <div style={{ marginTop: 40, display: 'flex', justifyContent: 'flex-end' }}>
                                <div style={{ borderTop: '1px solid #111', minWidth: 160, paddingTop: 4, textAlign: 'center', fontSize: 11 }}>
                                    {rx.doctorInfo.name}
                                    <div style={{ fontSize: 9.5, color: '#555' }}>{rx.prescriptionNumber}</div>
                                </div>
                            </div>
                        </main>
                    </div>

                    {/* The foot: how to book, and where the centre is. */}
                    <footer style={{ background: BRAND_GREEN, color: '#fff', padding: '4mm 12mm', display: 'flex', gap: 24, justifyContent: 'space-between', fontSize: 11, lineHeight: 1.45 }}>
                        {CENTRE.phone && (
                            <div>
                                <p style={{ fontWeight: 700 }}>For Appointment:</p>
                                <p>{CENTRE.phone}</p>
                            </div>
                        )}
                        <div style={{ textAlign: CENTRE.phone ? 'right' : 'left', marginLeft: 'auto' }}>
                            <p style={{ fontWeight: 700 }}>{CENTRE.name}</p>
                            {CENTRE.address && <p>{CENTRE.address}</p>}
                            {(CENTRE.email || CENTRE.website) && <p>{[CENTRE.email, CENTRE.website].filter(Boolean).join(' · ')}</p>}
                        </div>
                    </footer>
                </div>
            </div>
        </div>
    );
};

export default PrintPrescriptionPage;
