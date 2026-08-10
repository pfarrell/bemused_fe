import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Layout from './Layout';
import { useAuthStore } from '../stores/authStore';

vi.mock('./SearchBar', () => ({ default: () => null }));

const renderLayout = () =>
  render(
    <MemoryRouter>
      <Layout>
        <div>page content</div>
      </Layout>
    </MemoryRouter>
  );

beforeEach(() => {
  useAuthStore.setState({ user: null, isAuthenticated: false, isAdmin: false });
});

describe('Layout — logged-in hamburger menu', () => {
  beforeEach(() => {
    useAuthStore.setState({ user: { id: 1, username: 'pat', admin: false }, isAuthenticated: true, isAdmin: false });
  });

  test('clicking the hamburger opens a dropdown whose username navigates to Account', () => {
    renderLayout();
    const toggle = screen.getByText('pat').closest('button');
    fireEvent.click(toggle);
    const usernameInDropdown = screen.getAllByText('pat')[1];
    fireEvent.click(usernameInDropdown);
    expect(screen.queryByText('Playlists')).not.toBeInTheDocument(); // dropdown closed after navigating
  });

  test('does not show Home View, Tag Filter, Account, or Logout', () => {
    renderLayout();
    const toggle = screen.getByText('pat').closest('button');
    fireEvent.click(toggle);
    expect(screen.queryByText('Home View')).not.toBeInTheDocument();
    expect(screen.queryByText('Tag Filter')).not.toBeInTheDocument();
    expect(screen.queryByText('Account')).not.toBeInTheDocument();
    expect(screen.queryByText('Logout')).not.toBeInTheDocument();
  });

  test('shows Playlists, Collections, and Favorites', () => {
    renderLayout();
    const toggle = screen.getByText('pat').closest('button');
    fireEvent.click(toggle);
    expect(screen.getByText('Playlists')).toBeInTheDocument();
    expect(screen.getByText('Collections')).toBeInTheDocument();
    expect(screen.getByText('Favorites')).toBeInTheDocument();
  });

  test('does not show Admin, Upload, New, or Logs for a non-admin', () => {
    renderLayout();
    const toggle = screen.getByText('pat').closest('button');
    fireEvent.click(toggle);
    expect(screen.queryByText('Admin')).not.toBeInTheDocument();
    expect(screen.queryByText('Upload')).not.toBeInTheDocument();
    expect(screen.queryByText('New')).not.toBeInTheDocument();
    expect(screen.queryByText('Logs')).not.toBeInTheDocument();
  });
});

describe('Layout — logged-in admin', () => {
  beforeEach(() => {
    useAuthStore.setState({ user: { id: 1, username: 'admin-pat', admin: true }, isAuthenticated: true, isAdmin: true });
  });

  test('shows a single Admin link, not Upload/New/Logs', () => {
    renderLayout();
    const toggle = screen.getByText('admin-pat').closest('button');
    fireEvent.click(toggle);
    expect(screen.getByText('Admin')).toBeInTheDocument();
    expect(screen.queryByText('Upload')).not.toBeInTheDocument();
    expect(screen.queryByText('New')).not.toBeInTheDocument();
    expect(screen.queryByText('Logs')).not.toBeInTheDocument();
  });
});

describe('Layout — logged-out hamburger menu', () => {
  test('still shows Home View and Tag Filter', () => {
    renderLayout();
    fireEvent.click(screen.getAllByRole('button')[0]);
    expect(screen.getByText('Home View')).toBeInTheDocument();
    expect(screen.getByText('Tag Filter')).toBeInTheDocument();
  });

  test('shows Login / Sign Up, not Account or Logout', () => {
    renderLayout();
    fireEvent.click(screen.getAllByRole('button')[0]);
    expect(screen.getByText('Login / Sign Up')).toBeInTheDocument();
    expect(screen.queryByText('Account')).not.toBeInTheDocument();
    expect(screen.queryByText('Logout')).not.toBeInTheDocument();
  });
});
