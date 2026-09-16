import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar from './Topbar';

const ShellLayout = () => {
    const [sidebarOpen, setSidebarOpen] = useState(false);

    return (
        <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--surface-page)' }}>
            <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                <Topbar onMenuClick={() => setSidebarOpen(true)} />
                <main
                    style={{
                        flex: 1,
                        padding: 'var(--pad-page-y) var(--pad-page-x) 40px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 'var(--gap-grid)',
                    }}
                >
                    <Outlet />
                </main>
            </div>
        </div>
    );
};

export default ShellLayout;
