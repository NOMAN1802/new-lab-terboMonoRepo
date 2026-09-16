import { CENTRE } from './centre';

export type ExportColumn<T> = {
    header: string;
    /** Value for the cell. Return a primitive — formatting belongs here. */
    accessor: (row: T) => string | number;
};

type ExportOptions<T> = {
    title: string;
    subtitle?: string;
    filename: string;
    columns: ExportColumn<T>[];
    rows: T[];
};

const buildMatrix = <T,>(columns: ExportColumn<T>[], rows: T[]) =>
    rows.map((row) => columns.map((column) => column.accessor(row)));

/**
 * jsPDF and SheetJS are ~1MB together and are only needed when someone
 * actually clicks Export, so they are pulled in on demand rather than
 * shipped in the initial bundle — this app is used on phones over mobile data.
 */
export const exportToPdf = async <T,>({
    title,
    subtitle,
    filename,
    columns,
    rows,
}: ExportOptions<T>) => {
    const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
        import('jspdf'),
        import('jspdf-autotable'),
    ]);

    const doc = new jsPDF({ orientation: 'landscape' });

    doc.setFontSize(14);
    doc.text(CENTRE.name, 14, 16);
    doc.setFontSize(11);
    doc.text(title, 14, 23);

    if (subtitle) {
        doc.setFontSize(9);
        doc.setTextColor(120);
        doc.text(subtitle, 14, 29);
        doc.setTextColor(0);
    }

    autoTable(doc, {
        startY: subtitle ? 34 : 28,
        head: [columns.map((column) => column.header)],
        body: buildMatrix(columns, rows).map((row) => row.map(String)),
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [37, 99, 235] },
    });

    doc.save(`${filename}.pdf`);
};

export const exportToExcel = async <T,>({
    title,
    filename,
    columns,
    rows,
}: ExportOptions<T>) => {
    const XLSX = await import('xlsx');

    const sheet = XLSX.utils.aoa_to_sheet([
        columns.map((column) => column.header),
        ...buildMatrix(columns, rows),
    ]);

    const book = XLSX.utils.book_new();
    // Excel rejects sheet names over 31 characters.
    XLSX.utils.book_append_sheet(book, sheet, title.slice(0, 31));
    XLSX.writeFile(book, `${filename}.xlsx`);
};
