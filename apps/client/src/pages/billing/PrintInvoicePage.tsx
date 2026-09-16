import { Fragment, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useParams } from 'react-router-dom';
import { useReactToPrint } from 'react-to-print';
import { QRCodeSVG } from 'qrcode.react';
import ErrorState from '@/components/common/ErrorState';
import Loader from '@/components/common/Loader';
import BrandLogo from '@/components/brand/BrandLogo';
import BrandMark from '@/components/brand/BrandMark';
import { BRAND_BLUE, BRAND_GREEN, BRAND_TAGLINE_BN, BRAND_VALUES } from '@/lib/brand';
import { CENTRE } from '@/lib/centre';
import { formatDateTime, money } from '@/lib/format';
import { isUnreachableBase, publicReportUrl } from '@/lib/publicUrl';
import { useGetInvoiceQuery } from '@/services/invoicesApi';
import type { Invoice } from '@/services/invoicesApi';
import { useGetInvoicePaymentsQuery } from '@/services/paymentsApi';

type CopyKind = 'patient' | 'centre';
type CopySelection = 'both' | CopyKind;

type Receipt = {
    _id: string;
    receiptNumber: string;
    paymentDate: string;
    receivedByName?: string;
    amount: number;
};

const COPY_LABEL: Record<CopyKind, string> = {
    patient: 'Patient Copy',
    centre: 'Centre Copy',
};

const SELECTION_LABEL: Record<CopySelection, string> = {
    both: 'Both copies · A4',
    patient: 'Patient copy · A5',
    centre: 'Centre copy · A5',
};

/**
 * Paper. Each copy is an A5 portrait sheet framed by the letterhead. Both
 * copies print side by side on one A4 landscape sheet -- two A5 halves -- to
 * be cut down the middle; a single copy prints on A5 by itself.
 */
const MARGIN_MM = 8;
const PAPER = {
    both: { size: 'A4 landscape', width: 297, height: 210 },
    single: { size: 'A5 portrait', width: 148, height: 210 },
} as const;
/** The printable height of one copy, so the footer band lands at the page foot. */
const COPY_HEIGHT_MM = 210 - MARGIN_MM * 2;

/** Printed on every copy, above the footer band. */
const NOTE_BN = 'রিপোর্ট সংগ্রহের সময় অবশ্যই এই রশিদটি সঙ্গে আনবেন।';
const QR_NOTE_BN = 'কিউআর কোড স্ক্যান করে অনলাইনে রিপোর্ট দেখুন।';

const cap = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

/**
 * The top of the letterhead: the logo on the left, the centre's address and
 * contacts on the right, and a blue-to-green rule under both -- the part of
 * the stationery a patient recognises the centre by.
 */
const LetterheadTop = () => {
    const contacts = [
        CENTRE.address,
        CENTRE.phone && `Phone: ${CENTRE.phone}`,
        CENTRE.email,
        CENTRE.website,
    ].filter(Boolean) as string[];

    return (
        <header>
            <div className="flex items-center justify-between gap-4">
                <BrandLogo size="letterhead" lang="en" />
                {contacts.length > 0 && (
                    <address className="lh-contact max-w-[48%] text-right not-italic">
                        {contacts.map((line) => (
                            <p key={line}>{line}</p>
                        ))}
                    </address>
                )}
            </div>
            <div className="brand-rule mt-2" />
        </header>
    );
};

/**
 * The foot of the letterhead: a full-width band in the logo's colours with
 * the centre's values and its Bangla tagline, closing the page the way the
 * centre's printed stationery does.
 */
const LetterheadBand = () => (
    <div className="band">
        <span>{BRAND_VALUES.en.join('  ·  ')}</span>
        <span className="band-bn">{BRAND_TAGLINE_BN}</span>
    </div>
);

const Field = ({ label, children, wide = false }: { label: string; children: ReactNode; wide?: boolean }) => (
    <div className={`flex gap-1.5 ${wide ? 'col-span-2' : ''}`}>
        <span className="w-[64px] shrink-0 text-neutral-600">{label}</span>
        <span className="text-neutral-500">:</span>
        <span className="min-w-0">{children}</span>
    </div>
);

/**
 * One copy of the bill on its own A5 page: letterhead at the top, the band at
 * the foot, and between them the bill set out the way a counter reads one --
 * a "label : value" block, a fully ruled test table, and a ruled totals box.
 *
 * The two copies carry the same bill and differ in what each party keeps: the
 * patient's has the report QR, the centre's has the receipt trail and a
 * "Received by" line. The copy label is outlined on one and solid on the
 * other, so the counter never hands over the wrong half.
 */
const InvoiceCopy = ({ invoice, receipts, kind }: { invoice: Invoice; receipts: Receipt[]; kind: CopyKind }) => {
    const patient = invoice.patientInfo;
    const referrer = invoice.referrerInfo;
    const settled = invoice.dueAmount <= 0;
    const bookedBy = typeof invoice.createdBy === 'object' ? invoice.createdBy?.name : undefined;
    const status = invoice.isCancelled ? 'Cancelled' : settled ? 'Paid' : 'Due';

    return (
        <section className="copy" style={{ minHeight: `${COPY_HEIGHT_MM}mm` }}>
            {/*
              The watermark: the centre's mark set large and faint in the middle
              of the page, behind the bill, as on the centre's stationery. It is
              part of every copy, so a photocopy or a forgery without it stands
              out, and it never competes with the figures printed over it.
            */}
            <div className="watermark" aria-hidden="true">
                <BrandMark size={300} />
            </div>

            <LetterheadTop />

            <div className="mt-2 flex justify-center">
                <span className={`copy-pill ${kind === 'centre' ? 'copy-pill--solid' : ''}`}>{COPY_LABEL[kind]}</span>
            </div>

            <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-0.5 border-y border-neutral-400 py-1.5 text-[10.5px] leading-snug">
                <Field label="Invoice No">
                    <span className="figure font-semibold">{invoice.invoiceNumber}</span>
                </Field>
                <Field label="Date">
                    <span className="figure">{formatDateTime(invoice.createdAt || invoice.visitDate)}</span>
                </Field>
                <Field label="Patient ID">
                    <span className="figure">{patient.patientId}</span>
                </Field>
                <Field label="Phone">
                    <span className="figure">{patient.phone}</span>
                </Field>
                <Field label="Name" wide>
                    <strong className="text-[11.5px]">{patient.name}</strong>
                </Field>
                <Field label="Age / Sex">
                    {patient.age} Y / {cap(patient.gender)}
                </Field>
                <Field label="Ref. By">
                    {referrer ? (
                        <>
                            {referrer.name}
                            {referrer.designation ? `, ${referrer.designation}` : ''}
                        </>
                    ) : (
                        'Self'
                    )}
                </Field>
            </div>

            <table className="bill mt-2 w-full">
                <thead>
                    <tr>
                        <th className="w-7">SL</th>
                        <th className="w-[4.6rem]">Code</th>
                        <th>Test Name</th>
                        <th className="w-[5.2rem] text-right">Amount</th>
                    </tr>
                </thead>
                <tbody>
                    {invoice.items.map((item, index) => (
                        <tr key={item._id} className={item.isCancelled ? 'text-neutral-400' : ''}>
                            <td className="figure text-center">{index + 1}</td>
                            <td className="figure">{item.testCode}</td>
                            <td>
                                {/* Struck, not dropped: the bill has to show what
                                    happened to a test the patient was told about. */}
                                <span className={item.isCancelled ? 'line-through' : ''}>{item.testName}</span>
                                {item.isCancelled && <span className="ml-1.5 text-[9px] italic">cancelled</span>}
                            </td>
                            <td className={`figure text-right tabular-nums ${item.isCancelled ? 'line-through' : ''}`}>
                                {money(item.price)}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>

            <div className="mt-2 flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1 text-[9.5px] leading-snug text-neutral-700">
                    <p className="status">{status}</p>

                    {kind === 'patient' && invoice.publicToken && (
                        <div className="mt-1.5 flex items-center gap-2">
                            <QRCodeSVG value={publicReportUrl(invoice.publicToken)} size={56} level="M" marginSize={0} />
                            <p className="bn max-w-[9rem] text-[9.5px] leading-snug">{QR_NOTE_BN}</p>
                        </div>
                    )}

                    {kind === 'centre' && (
                        <div className="mt-1">
                            {receipts.length > 0 ? (
                                <table className="w-full border-collapse text-[8.5px] leading-tight">
                                    <tbody>
                                        {receipts.map((payment) => (
                                            <tr key={payment._id} className="border-b border-neutral-200">
                                                <td className="figure py-0.5 pr-1.5">{payment.receiptNumber}</td>
                                                <td className="figure py-0.5 pr-1.5">
                                                    {formatDateTime(payment.paymentDate)}
                                                </td>
                                                <td className="figure py-0.5 text-right tabular-nums">
                                                    {money(payment.amount)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            ) : (
                                <p>No payment received yet.</p>
                            )}
                        </div>
                    )}
                </div>

                <table className="totals shrink-0">
                    <tbody>
                        <tr>
                            <td>Item Total</td>
                            <td className="figure">{money(invoice.grossAmount)}</td>
                        </tr>
                        <tr>
                            <td>(-) Discount{invoice.discountPercent ? ` ${invoice.discountPercent}%` : ''}</td>
                            <td className="figure">{money(invoice.discountAmount)}</td>
                        </tr>
                        <tr className="font-semibold">
                            <td>Net Payable</td>
                            <td className="figure">{money(invoice.netPayable)}</td>
                        </tr>
                        <tr>
                            <td>Paid</td>
                            <td className="figure">{money(invoice.paidAmount)}</td>
                        </tr>
                        <tr className="font-bold">
                            <td>Due</td>
                            <td className="figure">{money(invoice.dueAmount)}</td>
                        </tr>
                    </tbody>
                </table>
            </div>

            {/* Everything below this point sits at the foot of the page. */}
            <div className="mt-auto pt-3">
                <div className="flex items-end justify-between gap-4 text-[8.5px] text-neutral-600">
                    <p>
                        Created by: <span className="text-neutral-800">{bookedBy ?? '—'}</span>
                    </p>
                    <div className="text-center">
                        <div className="mb-0.5 w-32 border-t border-neutral-500" />
                        <p>{kind === 'patient' ? 'Authorised Signature' : 'Received By'}</p>
                    </div>
                </div>
                <p className="bn mt-1.5 text-center text-[9.5px] text-neutral-800">{NOTE_BN}</p>
                <p className="mt-0.5 text-center text-[7.5px] text-neutral-500">
                    Printed {formatDateTime(new Date().toISOString())} · Computer-generated invoice
                </p>
                <div className="mt-1.5">
                    <LetterheadBand />
                </div>
            </div>
        </section>
    );
};

/**
 * The printed invoice, as the centre's own stationery: every copy is a full
 * page framed by the letterhead -- logo and contacts across the top, a band in
 * the logo's colours across the foot -- rather than a document with a logo
 * dropped on it.
 *
 * Set in a serif for names and running text; the mono face is kept for what
 * gets read back or transcribed -- invoice numbers, codes, money.
 *
 * Nothing about the centre's commission arrangements appears on either copy.
 */
const PrintInvoicePage = () => {
    const { id } = useParams();
    const printRef = useRef<HTMLDivElement>(null);
    const [selection, setSelection] = useState<CopySelection>('both');

    const { data: invoice, isLoading, isError, refetch } = useGetInvoiceQuery(id!);
    const { data: payments = [] } = useGetInvoicePaymentsQuery(id!);

    const handlePrint = useReactToPrint({
        contentRef: printRef,
        documentTitle: invoice ? `Invoice-${invoice.invoiceNumber}` : 'Invoice',
    });

    if (isLoading) return <Loader fullScreen message="Preparing invoice..." />;
    if (isError || !invoice) {
        return <ErrorState title="Could not load invoice" onRetry={refetch} />;
    }

    const receipts = payments.filter((payment) => !payment.isVoided) as Receipt[];
    const both = selection === 'both';
    const kinds: CopyKind[] = both ? ['patient', 'centre'] : [selection];
    const paper = both ? PAPER.both : PAPER.single;

    return (
        <div className="min-h-screen bg-slate-100 py-8 print:bg-white print:py-0">
            <style>{`
                @page { size: ${paper.size}; margin: ${MARGIN_MM}mm; }
                @media print {
                    .sheet {
                        width: auto !important; min-height: 0 !important;
                        padding: 0 !important; box-shadow: none !important;
                    }
                }
                .doc {
                    font-family: 'Source Serif 4', Georgia, 'Times New Roman', serif;
                    color: #111;
                    /* Browsers drop background colours when printing unless told
                       not to; the rule, the band and the solid copy label need them. */
                    -webkit-print-color-adjust: exact;
                    print-color-adjust: exact;
                }
                .figure { font-family: 'JetBrains Mono', 'Noto Sans Bengali', ui-monospace, monospace; }
                .bn { font-family: 'Noto Sans Bengali', sans-serif; }
                .copy { display: flex; flex-direction: column; position: relative; }
                /* Everything in a copy sits above the watermark. */
                .copy > *:not(.watermark) { position: relative; z-index: 1; }
                .watermark {
                    position: absolute; inset: 0; z-index: 0;
                    display: flex; align-items: center; justify-content: center;
                    pointer-events: none; opacity: .08;
                }
                .brand-rule { height: 2.5px; background: linear-gradient(90deg, ${BRAND_BLUE}, ${BRAND_GREEN}); }
                .lh-contact { font-family: 'Noto Sans Bengali', 'Source Serif 4', serif; font-size: 9px; line-height: 1.45; color: #444; }
                .copy-pill {
                    font-family: 'Space Grotesk', sans-serif; font-size: 10px; font-weight: 700;
                    letter-spacing: .06em; padding: 2px 16px; border: 1.5px solid #111; border-radius: 999px;
                }
                .copy-pill--solid { background: #111; color: #fff; }
                .bill { border-collapse: collapse; font-size: 10px; }
                .bill th, .bill td { border: 1px solid #6b6b6b; padding: 2.5px 5px; vertical-align: top; }
                .bill th {
                    background: #ececec; font-family: 'Space Grotesk', sans-serif; font-weight: 700;
                    font-size: 9px; letter-spacing: .04em; text-align: left;
                }
                .totals { border-collapse: collapse; font-size: 10px; }
                .totals td { border: 1px solid #6b6b6b; padding: 2px 7px; }
                .totals td:first-child { text-align: right; color: #333; }
                .totals td:last-child { text-align: right; min-width: 5.4rem; font-variant-numeric: tabular-nums; }
                .status { font-family: 'Space Grotesk', sans-serif; font-size: 22px; font-weight: 700; line-height: 1; }
                .band {
                    display: flex; align-items: center; justify-content: space-between; gap: 8px;
                    padding: 4px 10px; color: #fff;
                    background: linear-gradient(90deg, ${BRAND_BLUE}, ${BRAND_GREEN});
                    font-family: 'Space Grotesk', sans-serif; font-size: 8px; font-weight: 700;
                    letter-spacing: .14em; text-transform: uppercase;
                }
                .band-bn { font-family: 'Noto Sans Bengali', sans-serif; font-size: 9.5px; letter-spacing: 0; text-transform: none; }
                .cut-v { position: relative; display: flex; align-items: center; justify-content: center; }
                .cut-v::before { content: ''; position: absolute; top: 0; bottom: 0; left: 50%; border-left: 1.5px dashed #9a948a; }
                .cut-v span {
                    position: relative; writing-mode: vertical-rl; background: #fff; padding: 8px 0;
                    font-family: 'JetBrains Mono', monospace; font-size: 8px; letter-spacing: .2em;
                    text-transform: uppercase; color: #7a756b;
                }
            `}</style>

            <div className="mx-auto max-w-full px-4" style={{ width: `calc(${paper.width}mm + 2rem)` }}>
                {invoice.publicToken && isUnreachableBase() && (
                    <div className="mb-3 rounded-sm border border-amber-400 bg-amber-50 px-4 py-3 text-[13px] text-amber-900 print:hidden">
                        <strong>The QR code on this invoice will not work for patients.</strong> It
                        points at <code>{publicReportUrl(invoice.publicToken)}</code>, which only
                        opens on this machine. Print from the live site, or set
                        VITE_PUBLIC_BASE_URL.
                    </div>
                )}

                <div className="mb-4 flex flex-wrap items-center justify-end gap-3 print:hidden">
                    <div
                        role="group"
                        aria-label="Copies to print"
                        className="mr-auto flex rounded-sm border border-slate-300 bg-white p-0.5 text-sm"
                    >
                        {(Object.keys(SELECTION_LABEL) as CopySelection[]).map((value) => (
                            <button
                                key={value}
                                type="button"
                                aria-pressed={selection === value}
                                onClick={() => setSelection(value)}
                                className={`rounded-sm px-3.5 py-2 font-semibold transition ${
                                    selection === value
                                        ? 'bg-slate-900 text-white'
                                        : 'text-slate-600 hover:bg-slate-50'
                                }`}
                            >
                                {SELECTION_LABEL[value]}
                            </button>
                        ))}
                    </div>
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
            </div>

            {/* Drawn at true paper size, so what is on screen is what prints. */}
            <div className="overflow-x-auto px-4 pb-4 print:overflow-visible print:p-0">
                <div
                    ref={printRef}
                    className="doc sheet mx-auto bg-white shadow-lg"
                    style={{
                        width: `${paper.width}mm`,
                        minHeight: `${paper.height}mm`,
                        padding: `${MARGIN_MM}mm`,
                        boxSizing: 'border-box',
                        display: 'grid',
                        gridTemplateColumns: both ? '1fr 8mm 1fr' : '1fr',
                    }}
                >
                    {kinds.map((kind, index) => (
                        <Fragment key={kind}>
                            {index > 0 && (
                                <div className="cut-v" aria-hidden="true">
                                    <span>✂ cut here</span>
                                </div>
                            )}
                            <InvoiceCopy invoice={invoice} receipts={receipts} kind={kind} />
                        </Fragment>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default PrintInvoicePage;
