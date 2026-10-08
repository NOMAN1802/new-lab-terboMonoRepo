import { Suspense, lazy, useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import ShellLayout from '@/components/layout/ShellLayout';
import Loader from '@/components/common/Loader';
import LoginPage from '@/pages/auth/LoginPage';
import DashboardPage from '@/pages/dashboard/DashboardPage';
import PatientsPage from '@/pages/patients/PatientsPage';
import PatientFormPage from '@/pages/patients/PatientFormPage';
import PatientDetailPage from '@/pages/patients/PatientDetailPage';
import CreateBookingPage from '@/pages/billing/CreateBookingPage';
import InvoicesPage from '@/pages/billing/InvoicesPage';
import InvoiceDetailPage from '@/pages/billing/InvoiceDetailPage';
import ProtectedRoute from '@/routes/ProtectedRoute';
import RoleRoute from '@/routes/RoleRoute';

/**
 * Everything below the daily reception workflow loads on demand. The centre
 * runs on phones over mobile data, so the first paint carries only the screens
 * a receptionist opens every day.
 */
const TestsPage = lazy(() => import('@/pages/catalogue/TestsPage'));
const TestCategoriesPage = lazy(() => import('@/pages/catalogue/TestCategoriesPage'));
const ReferrersPage = lazy(() => import('@/pages/referrers/ReferrersPage'));
const PrintInvoicePage = lazy(() => import('@/pages/billing/PrintInvoicePage'));
const CommissionPayoutsPage = lazy(
    () => import('@/pages/commission/CommissionPayoutsPage')
);
const PatientReportPage = lazy(() => import('@/pages/reports/PatientReportPage'));
const PatientReportUploadPage = lazy(() => import('@/pages/reports/PatientReportUploadPage'));
const FinancialReportPage = lazy(() => import('@/pages/reports/FinancialReportPage'));
const CommissionReportPage = lazy(() => import('@/pages/reports/CommissionReportPage'));
const DuesReportPage = lazy(() => import('@/pages/reports/DuesReportPage'));
const ProfilePage = lazy(() => import('@/pages/profile/ProfilePage'));
const SettingsPage = lazy(() => import('@/pages/settings/SettingsPage'));
const UsersPage = lazy(() => import('@/pages/users/UsersPage'));
const AddUserPage = lazy(() => import('@/pages/users/AddUserPage'));
const ActivityPage = lazy(() => import('@/pages/activity/ActivityPage'));
const PublicReportPage = lazy(() => import('@/pages/public/PublicReportPage'));
const DoctorsPage = lazy(() => import('@/pages/doctors/DoctorsPage'));
const SchedulesPage = lazy(() => import('@/pages/schedules/SchedulesPage'));
const DoctorDashboardPage = lazy(() => import('@/pages/dashboard/DoctorDashboardPage'));
const BookAppointmentPage = lazy(() => import('@/pages/appointments/BookAppointmentPage'));
const AppointmentsPage = lazy(() => import('@/pages/appointments/AppointmentsPage'));
const PrintAppointmentPage = lazy(() => import('@/pages/appointments/PrintAppointmentPage'));
const PrescriptionPage = lazy(() => import('@/pages/appointments/PrescriptionPage'));
const PrintPrescriptionPage = lazy(() => import('@/pages/appointments/PrintPrescriptionPage'));
import { useRefreshTokenMutation } from '@/services/authApi';
import { useAppDispatch, useAppSelector } from '@/hooks/store';
import { logout, setInitializing } from '@/features/auth/authSlice';

/** A doctor opens to their own clinic; everyone else gets the usual dashboard. */
const HomeRoute = () => {
    const role = useAppSelector((state) => state.auth.user?.role);
    return role === 'doctor' ? <DoctorDashboardPage /> : <DashboardPage />;
};

function App() {
    const dispatch = useAppDispatch();
    const { accessToken, refreshToken, initializing } = useAppSelector(
        (state) => state.auth
    );
    const [refreshTokenMutation] = useRefreshTokenMutation();

    useEffect(() => {
        const hydrate = async () => {
            if (!initializing) return;
            if (!accessToken && refreshToken) {
                try {
                    await refreshTokenMutation({ refreshToken }).unwrap();
                } catch (error) {
                    console.error(error);
                    dispatch(logout());
                } finally {
                    dispatch(setInitializing(false));
                }
            } else {
                dispatch(setInitializing(false));
            }
        };

        hydrate();
    }, [accessToken, refreshToken, initializing, refreshTokenMutation, dispatch]);

    if (initializing) {
        return <Loader fullScreen message="Starting up..." />;
    }

    return (
        <Suspense fallback={<Loader fullScreen message="Loading..." />}>
            <Routes>
                <Route
                    path="/login"
                    element={accessToken ? <Navigate to="/" replace /> : <LoginPage />}
                />

                {/* Patient-facing, reached by scanning the QR on an invoice.
                    Outside ProtectedRoute on purpose, and declared explicitly
                    because the catch-all below would otherwise send it to the
                    login page. */}
                <Route path="/r/:token" element={<PublicReportPage />} />

                <Route element={<ProtectedRoute />}>
                    <Route element={<ShellLayout />}>
                        <Route index element={<HomeRoute />} />

                        {/* Reception and admin. A doctor has no business here, and the API
                            would reject them anyway. */}
                        <Route element={<RoleRoute allow={['admin', 'receptionist']} />}>
                            {/* Patients — both roles */}
                            <Route path="patients" element={<PatientsPage />} />
                            <Route path="patients/new" element={<PatientFormPage />} />
                            <Route path="patients/:id" element={<PatientDetailPage />} />
                            <Route path="patients/:id/edit" element={<PatientFormPage />} />

                            {/* Billing — both roles */}
                            <Route path="billing" element={<InvoicesPage />} />
                            <Route path="billing/new" element={<CreateBookingPage />} />
                            <Route path="billing/:id" element={<InvoiceDetailPage />} />

                            {/* Catalogue — readable by both, editable by admin only */}
                            <Route path="tests" element={<TestsPage />} />

                            {/* Report handling is reception work too — the API allows both roles. */}
                            <Route path="patient-reports" element={<PatientReportUploadPage />} />

                            {/* Patient report — both roles, patient data only */}
                            <Route path="reports/patients" element={<PatientReportPage />} />
                            <Route path="doctors" element={<DoctorsPage />} />
                            <Route path="appointments/new" element={<BookAppointmentPage />} />
                        </Route>

                        {/* Admin proposes schedules; the doctor approves or declines them. */}
                        <Route element={<RoleRoute allow={['admin', 'doctor']} />}>
                            <Route path="schedules" element={<SchedulesPage />} />
                        </Route>

                        {/* Everyone with a login works with appointments; the lists scope to what each role may see. */}
                        <Route element={<RoleRoute allow={['admin', 'receptionist', 'doctor']} />}>
                            <Route path="appointments" element={<AppointmentsPage />} />
                        </Route>

                        {/* Only the visit's own doctor writes it; the API checks which visit. */}
                        <Route element={<RoleRoute allow={['doctor']} />}>
                            <Route path="appointments/:id/prescription" element={<PrescriptionPage />} />
                        </Route>

                        <Route path="profile" element={<ProfilePage />} />

                        {/* Admin-only. The API enforces this independently. */}
                        <Route element={<RoleRoute allow={['admin']} />}>
                            <Route path="departments" element={<TestCategoriesPage />} />
                            <Route path="referrers" element={<ReferrersPage />} />
                            <Route path="commission" element={<CommissionPayoutsPage key="lab" kind="lab" />} />
                            <Route
                                path="commission/appointments"
                                element={<CommissionPayoutsPage key="appointment" kind="appointment" />}
                            />
                            <Route path="reports/financial" element={<FinancialReportPage />} />
                            <Route path="reports/commission" element={<CommissionReportPage />} />
                            <Route path="reports/dues" element={<DuesReportPage />} />
                            <Route path="users" element={<UsersPage />} />
                            <Route path="users/new" element={<AddUserPage />} />
                            <Route path="activity" element={<ActivityPage />} />
                            <Route path="settings" element={<SettingsPage />} />
                        </Route>
                    </Route>

                    {/* Print view renders without the app shell. */}
                    <Route element={<RoleRoute allow={['admin', 'receptionist']} />}>
                        <Route path="billing/:id/print" element={<PrintInvoicePage />} />
                        <Route path="appointments/:id/print" element={<PrintAppointmentPage />} />
                    </Route>
                    <Route element={<RoleRoute allow={['admin', 'receptionist', 'doctor']} />}>
                        <Route path="appointments/:id/prescription/print" element={<PrintPrescriptionPage />} />
                    </Route>
                </Route>

                <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
        </Suspense>
    );
}

export default App;
