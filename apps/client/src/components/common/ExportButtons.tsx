import { useT } from '@/i18n/useLanguage';
import { useState } from 'react';
import { toast } from 'sonner';
import Button from '@/components/ui/Button';
import { exportToExcel, exportToPdf } from '@/lib/exportTable';
import type { ExportColumn } from '@/lib/exportTable';

type ExportButtonsProps<T> = {
    title: string;
    subtitle?: string;
    filename: string;
    columns: ExportColumn<T>[];
    rows: T[];
};

/** PDF + Excel pair. Both libraries load on demand, so the busy state is real. */
const ExportButtons = <T,>({ rows, ...options }: ExportButtonsProps<T>) => {
    const t = useT();
    const [busy, setBusy] = useState<'pdf' | 'excel' | null>(null);
    const disabled = rows.length === 0 || busy !== null;

    const run = async (kind: 'pdf' | 'excel') => {
        setBusy(kind);
        try {
            const exporter = kind === 'pdf' ? exportToPdf : exportToExcel;
            await exporter({ ...options, rows });
        } catch (error) {
            console.error(error);
            toast.error(`Could not build the ${kind === 'pdf' ? 'PDF' : 'Excel'} file`);
        } finally {
            setBusy(null);
        }
    };

    return (
        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            <Button variant="secondary" size="sm" icon="download" disabled={disabled} loading={busy === 'pdf'} onClick={() => run('pdf')}>
                {busy === 'pdf' ? t('ctrl.building') : t('ctrl.pdf')}
            </Button>
            <Button variant="secondary" size="sm" icon="download" disabled={disabled} loading={busy === 'excel'} onClick={() => run('excel')}>
                {busy === 'excel' ? t('ctrl.building') : t('ctrl.excel')}
            </Button>
        </div>
    );
};

export default ExportButtons;
