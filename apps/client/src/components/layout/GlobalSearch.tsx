import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGetPatientsQuery } from '@/services/patientsApi';
import { useGetInvoicesQuery } from '@/services/invoicesApi';
import { useGetTestsQuery } from '@/services/testsApi';
import { money } from '@/lib/format';
import Icon from '@/components/ui/Icon';
import { useT } from '@/i18n/useLanguage';
import type { IconName } from '@/components/ui/Icon';

type Hit = {
    key: string;
    icon: IconName;
    title: string;
    meta: string;
    trailing?: string;
    to: string;
};

const GROUP_LIMIT = 4;

/** Debounces the raw input so one keystroke does not fire three requests. */
const useDebounced = (value: string, delay = 250) => {
    const [settled, setSettled] = useState(value);

    useEffect(() => {
        const id = window.setTimeout(() => setSettled(value), delay);
        return () => window.clearTimeout(id);
    }, [value, delay]);

    return settled;
};

const sectionLabel: CSSProperties = {
    padding: '8px var(--space-4) 4px',
    fontSize: 'var(--text-11)',
    fontWeight: 'var(--fw-semibold)' as CSSProperties['fontWeight'],
    letterSpacing: 'var(--tracking-caps)',
    textTransform: 'uppercase',
    color: 'var(--text-faint)',
};

/**
 * Topbar search across patients, invoices and tests. There is no single search
 * endpoint, so this fans out to the three list endpoints that already take a
 * search term and merges the top few of each.
 */
const GlobalSearch = () => {
    const t = useT();
    const navigate = useNavigate();
    const inputRef = useRef<HTMLInputElement>(null);
    const wrapRef = useRef<HTMLDivElement>(null);
    const [term, setTerm] = useState('');
    const [open, setOpen] = useState(false);
    const [cursor, setCursor] = useState(0);

    const search = useDebounced(term.trim());
    const idle = search.length < 2;

    const { data: patients } = useGetPatientsQuery({ search, limit: GROUP_LIMIT }, { skip: idle });
    const { data: invoices } = useGetInvoicesQuery({ search, limit: GROUP_LIMIT }, { skip: idle });
    const { data: tests } = useGetTestsQuery({ search, limit: GROUP_LIMIT }, { skip: idle });

    const groups = useMemo<[string, Hit[]][]>(() => {
        const built: [string, Hit[]][] = [
            [
                'Patients',
                (patients?.items ?? []).slice(0, GROUP_LIMIT).map((patient) => ({
                    key: `patient-${patient._id}`,
                    icon: 'users' as IconName,
                    title: patient.name,
                    meta: `${patient.patientId} · ${patient.phone}`,
                    to: `/patients/${patient._id}`,
                })),
            ],
            [
                'Invoices',
                (invoices?.items ?? []).slice(0, GROUP_LIMIT).map((invoice) => ({
                    key: `invoice-${invoice._id}`,
                    icon: 'credit-card' as IconName,
                    title: invoice.invoiceNumber,
                    meta: invoice.patientInfo.name,
                    trailing: money(invoice.netPayable),
                    to: `/billing/${invoice._id}`,
                })),
            ],
            [
                'Tests',
                (tests?.items ?? []).slice(0, GROUP_LIMIT).map((test) => ({
                    key: `test-${test._id}`,
                    icon: 'flask-conical' as IconName,
                    title: test.name,
                    meta: test.testCode,
                    trailing: money(test.price),
                    to: '/tests',
                })),
            ],
        ];

        return built.filter(([, hits]) => hits.length > 0);
    }, [patients, invoices, tests]);

    const flat = useMemo(() => groups.flatMap(([, hits]) => hits), [groups]);

    // A new term means a new result set, so the highlight goes back to the top.
    const [cursorFor, setCursorFor] = useState(search);
    if (cursorFor !== search) {
        setCursorFor(search);
        setCursor(0);
    }

    // Ctrl/Cmd-K focuses the field from anywhere, as the design's hint promises.
    useEffect(() => {
        const onKey = (event: globalThis.KeyboardEvent) => {
            if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
                event.preventDefault();
                inputRef.current?.focus();
                setOpen(true);
            }
        };

        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, []);

    useEffect(() => {
        const onClick = (event: MouseEvent) => {
            if (!wrapRef.current?.contains(event.target as Node)) setOpen(false);
        };

        document.addEventListener('mousedown', onClick);
        return () => document.removeEventListener('mousedown', onClick);
    }, []);

    const go = (hit: Hit) => {
        setOpen(false);
        setTerm('');
        inputRef.current?.blur();
        navigate(hit.to);
    };

    const onKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'Escape') {
            setOpen(false);
            inputRef.current?.blur();
            return;
        }
        if (!flat.length) return;

        if (event.key === 'ArrowDown') {
            event.preventDefault();
            setCursor((index) => (index + 1) % flat.length);
        } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            setCursor((index) => (index - 1 + flat.length) % flat.length);
        } else if (event.key === 'Enter') {
            event.preventDefault();
            go(flat[cursor]);
        }
    };

    return (
        <div ref={wrapRef} className="search-wrap" style={{ position: 'relative', flex: '1 1 380px', maxWidth: '420px', minWidth: 0 }}>
            <span
                style={{
                    position: 'absolute',
                    left: '14px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    display: 'flex',
                    color: 'var(--text-faint)',
                    pointerEvents: 'none',
                }}
            >
                <Icon name="search" size={16} />
            </span>

            <input
                ref={inputRef}
                type="search"
                value={term}
                placeholder={t('shell.search')}
                aria-label={t('shell.searchAria')}
                onChange={(event) => {
                    setTerm(event.target.value);
                    setOpen(true);
                }}
                onFocus={() => setOpen(true)}
                onKeyDown={onKeyDown}
                style={{
                    width: '100%',
                    height: '40px',
                    padding: '0 62px 0 40px',
                    border: '1px solid var(--border-card)',
                    borderRadius: 'var(--radius-pill)',
                    background: 'var(--surface-sunken)',
                    fontFamily: 'var(--font-sans)',
                    fontSize: 'var(--text-13)',
                    color: 'var(--text-body)',
                    outline: 'none',
                    transition: 'var(--transition-control)',
                }}
            />

            <span
                className="hidden lg:block"
                style={{
                    position: 'absolute',
                    right: '14px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    fontSize: 'var(--text-11)',
                    fontWeight: 'var(--fw-medium)' as CSSProperties['fontWeight'],
                    color: 'var(--text-faint)',
                    pointerEvents: 'none',
                }}
            >
                Ctrl K
            </span>

            {open && !idle && (
                <div
                    style={{
                        position: 'absolute',
                        top: 'calc(100% + 8px)',
                        left: 0,
                        right: 0,
                        maxHeight: '380px',
                        overflowY: 'auto',
                        background: 'var(--surface-card)',
                        border: '1px solid var(--border-card)',
                        borderRadius: 'var(--radius-lg)',
                        boxShadow: 'var(--shadow-pop)',
                        padding: '4px 0',
                        zIndex: 60,
                    }}
                >
                    {flat.length === 0 ? (
                        <p style={{ padding: 'var(--space-4)', fontSize: 'var(--text-13)', color: 'var(--text-muted)' }}>
                            {t('shell.nothingMatches')}
                        </p>
                    ) : (
                        groups.map(([label, hits]) => (
                            <div key={label}>
                                <p style={sectionLabel}>{label}</p>
                                {hits.map((hit) => {
                                    const index = flat.findIndex((entry) => entry.key === hit.key);
                                    const active = index === cursor;

                                    return (
                                        <button
                                            key={hit.key}
                                            type="button"
                                            onMouseEnter={() => setCursor(index)}
                                            onClick={() => go(hit)}
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: 'var(--space-3)',
                                                width: '100%',
                                                padding: '8px var(--space-4)',
                                                border: 0,
                                                background: active ? 'var(--surface-sunken)' : 'transparent',
                                                cursor: 'pointer',
                                                textAlign: 'left',
                                                fontFamily: 'var(--font-sans)',
                                            }}
                                        >
                                            <Icon name={hit.icon} size={16} color="var(--text-faint)" />
                                            <span style={{ flex: 1, minWidth: 0 }}>
                                                <span
                                                    style={{
                                                        display: 'block',
                                                        fontSize: 'var(--text-13)',
                                                        fontWeight: 'var(--fw-semibold)' as CSSProperties['fontWeight'],
                                                        color: 'var(--text-heading)',
                                                        overflow: 'hidden',
                                                        textOverflow: 'ellipsis',
                                                        whiteSpace: 'nowrap',
                                                    }}
                                                >
                                                    {hit.title}
                                                </span>
                                                <span style={{ display: 'block', fontSize: 'var(--text-12)', color: 'var(--text-muted)' }}>
                                                    {hit.meta}
                                                </span>
                                            </span>
                                            {hit.trailing && (
                                                <span style={{ fontSize: 'var(--text-12)', color: 'var(--text-muted)', flexShrink: 0 }}>
                                                    {hit.trailing}
                                                </span>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        ))
                    )}
                </div>
            )}
        </div>
    );
};

export default GlobalSearch;
