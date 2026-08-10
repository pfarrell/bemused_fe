import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import Admin from './Admin';
import ProtectedRoute from '../components/ProtectedRoute';
import { useAuthStore } from '../stores/authStore';

const renderAdmin = () =>
  render(
    <MemoryRouter initialEntries={['/admin']}>
      <Routes>
        <Route path="/admin" element={<Admin />} />
        <Route path="/admin/upload" element={<div>Upload page</div>} />
        <Route path="/admin/new" element={<div>New page</div>} />
        <Route path="/admin/logs" element={<div>Logs page</div>} />
      </Routes>
    </MemoryRouter>
  );

// Mirrors how App.jsx actually wires the /admin route:
// <Route path="/admin" element={<ProtectedRoute requireAdmin><Admin /></ProtectedRoute>} />
const initialAuthState = { user: null, isAuthenticated: false, isAdmin: false, loading: false };

const renderProtectedAdmin = (authOverrides = {}) => {
  useAuthStore.setState({ ...initialAuthState, ...authOverrides });
  return render(
    <MemoryRouter initialEntries={['/admin']}>
      <Routes>
        <Route path="/admin" element={
          <ProtectedRoute requireAdmin>
            <Admin />
          </ProtectedRoute>
        } />
      </Routes>
    </MemoryRouter>
  );
};

describe('Admin', () => {
  test('renders links to Upload, New, and Logs', () => {
    renderAdmin();
    expect(screen.getByText('Upload')).toBeInTheDocument();
    expect(screen.getByText('New')).toBeInTheDocument();
    expect(screen.getByText('Logs')).toBeInTheDocument();
  });

  test('clicking Upload navigates to /admin/upload', () => {
    renderAdmin();
    fireEvent.click(screen.getByText('Upload'));
    expect(screen.getByText('Upload page')).toBeInTheDocument();
  });

  test('clicking New navigates to /admin/new', () => {
    renderAdmin();
    fireEvent.click(screen.getByText('New'));
    expect(screen.getByText('New page')).toBeInTheDocument();
  });

  test('clicking Logs navigates to /admin/logs', () => {
    renderAdmin();
    fireEvent.click(screen.getByText('Logs'));
    expect(screen.getByText('Logs page')).toBeInTheDocument();
  });
});

describe('Admin route protection', () => {
  afterEach(() => {
    useAuthStore.setState(initialAuthState);
  });

  test('denies access to a non-admin user', () => {
    renderProtectedAdmin({ isAuthenticated: true, isAdmin: false, user: { id: 1, username: 'pat', admin: false } });
    expect(screen.getByText('Access Denied')).toBeInTheDocument();
    expect(screen.queryByText('Upload')).not.toBeInTheDocument();
  });

  test('allows access to an admin user', () => {
    renderProtectedAdmin({ isAuthenticated: true, isAdmin: true, user: { id: 1, username: 'admin-pat', admin: true } });
    expect(screen.getByText('Upload')).toBeInTheDocument();
  });
});
