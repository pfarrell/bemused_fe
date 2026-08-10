import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import Admin from './Admin';

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
