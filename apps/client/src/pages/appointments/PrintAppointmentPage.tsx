import { useRef } from 'react';
import { useParams } from 'react-router-dom';
import { useReactToPrint } from 'react-to-print';
import ErrorState from '@/components/common/ErrorState';
import Loader from '@/components/common/Loader';
import BrandLogo from '@/components/brand/BrandLogo';
import { BRAND_RED, BRAND_GREEN } from '@/lib/brand';
import { CENTRE } from '@/lib/centre';
import { formatDate, money } from '@/lib/format';
import { useGetAppointmentQuery } from '@/services/appointmentsApi';

const MARGIN_MM = 8;

const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div style={{ display: 'flex', gap: 6, padding: '3px 0', borderBottom: '1px dotted #bbb' }}>
        <span style={{ width: 78, flexShrink: 0, color: '#555' }}>{label}</span>
        <span style={{ color: '#555' }}>:</span>
        <span style={{ fontWeight: 600 }}>{children}</span>
    </div>
);

/**
 * The slip a patient carries to the doctor's room. The serial number is the
 * thing they are called by, so it is the largest thing on the page.
 */
const PrintAppointmentPage = () => {
    const { id } = useParams();
    const printRef = useRef<HTMLDivElement>(null);
    const { data: appointment, isLoading, isError, refetch } = useGetAppointmentQuery(id!);

    const handlePrint = useReactToPrint({
        contentRef: printRef,
        documentTitle: appointment ? `Appointment-${appointment.appointmentNumber}` : 'Appointment',
    });

    if (isLoading) return <Loader fullScreen message="Preparing slip..." />;
    if (isError || !appointment) return <ErrorState title="Could not load appointment" onRetry={refetch} />;

    const contacts = [CENTRE.address, CENTRE.phone && `Phone: ${CENTRE.phone}`, CENTRE.email].filter(Boolean) as string[];
    const cancelled = appointment.status === 'cancelled';

    return (
        <div className="min-h-screen bg-slate-100 py-8 print:bg-white print:py-0">
            <style>{`
                @page { size: A5 portrait; margin: ${MARGIN_MM}mm; }
                @media print { .sheet { width: auto !important; min-height: 0 !important; padding: 0 !important; box-shadow: none !important; } }
                .slip { font-family: 'Source Serif 4', Georgia, serif; color: #111; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            `}</style>

            <div className="mx-auto mb-4 flex max-w-[148mm] flex-wrap justify-end gap-3 px-4 print:hidden">
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
                    className="slip sheet mx-auto bg-white shadow-lg"
                    style={{ width: '148mm', minHeight: '210mm', padding: `${MARGIN_MM}mm`, boxSizing: 'border-box' }}
                >
                    <header>
                        <div className="flex items-center justify-between gap-4">
                            <BrandLogo size="letterhead" lang="en" />
                            {contacts.length > 0 && (
                                <address className="max-w-[48%] text-right not-italic" style={{ fontSize: 9, lineHeight: 1.45, color: '#444' }}>
                                    {contacts.map((line) => (
                                        <p key={line}>{line}</p>
                                    ))}
                                </address>
                            )}
                        </div>
                        <div style={{ height: 2.5, marginTop: 8, background: `linear-gradient(90deg, ${BRAND_RED}, ${BRAND_GREEN})` }} />
                    </header>

                    <h1 style={{ marginTop: 14, textAlign: 'center', fontSize: 15, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase' }}>
                        Appointment Slip
                    </h1>

                    <div style={{ margin: '14px auto', textAlign: 'center' }}>
                        <div style={{ fontSize: 11, color: '#555', letterSpacing: '.1em', textTransform: 'uppercase' }}>Serial No.</div>
                        <div
                            style={{
                                display: 'inline-block',
                                minWidth: 90,
                                marginTop: 4,
                                padding: '6px 22px',
                                border: '2px solid #111',
                                borderRadius: 6,
                                fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                                fontSize: 44,
                                fontWeight: 700,
                                lineHeight: 1.1,
                            }}
                        >
                            {appointment.serialNo}
                        </div>
                        <div style={{ marginTop: 6, fontSize: 15, fontWeight: 700 }}>
                            {appointment.startTime} – {appointment.endTime}
                        </div>
                        <div style={{ fontSize: 12, color: '#333' }}>{formatDate(appointment.date)}</div>
                    </div>

                    <div style={{ fontSize: 12 }}>
                        <Row label="Appt. no">{appointment.appointmentNumber}</Row>
                        <Row label="Doctor">
                            {appointment.doctor.name} · {appointment.doctor.specialty}
                        </Row>
                        <Row label="Patient">{appointment.patientInfo.name}</Row>
                        <Row label="Patient ID">{appointment.patientInfo.patientId}</Row>
                        <Row label="Age / Sex">
                            {appointment.patientInfo.age} · {appointment.patientInfo.gender}
                        </Row>
                        <Row label="Phone">{appointment.patientInfo.phone}</Row>
                        <Row label="Fee">{money(appointment.fee)}</Row>
                        {appointment.invoice && !appointment.invoice.isCancelled && (
                            <>
                                <Row label="Invoice">{appointment.invoice.invoiceNumber}</Row>
                                <Row label="Payment">
                                    {appointment.invoice.dueAmount <= 0
                                        ? `Paid ${money(appointment.invoice.paidAmount)}`
                                        : `Paid ${money(appointment.invoice.paidAmount)} · Due ${money(appointment.invoice.dueAmount)}`}
                                </Row>
                            </>
                        )}
                        {appointment.notes && <Row label="Notes">{appointment.notes}</Row>}
                    </div>

                    {cancelled && (
                        <p style={{ marginTop: 14, textAlign: 'center', fontSize: 16, fontWeight: 700, letterSpacing: '.1em' }}>
                            — CANCELLED —
                        </p>
                    )}

                    <p style={{ marginTop: 18, textAlign: 'center', fontSize: 10.5, color: '#444' }}>
                        Please arrive 10 minutes before your time and show this slip at the desk.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default PrintAppointmentPage;
