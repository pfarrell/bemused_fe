import { useAuthStore } from './authStore';
import { useTagFilterStore } from './tagFilterStore';
import { useFavoritesStore } from './favoritesStore';
import { apiService } from '../services/api';

vi.mock('../services/api', () => ({
  apiService: {
    login: vi.fn(),
    logout: vi.fn(),
    signup: vi.fn(),
    getMe: vi.fn(),
    getFavorites: vi.fn().mockResolvedValue({ data: [] }),
  },
}));

const initialState = {
  user: null,
  isAuthenticated: false,
  isAdmin: false,
  loading: false,
};

beforeEach(() => {
  useAuthStore.setState(initialState);
  useTagFilterStore.setState({ activeTag: null });
  useFavoritesStore.setState({ items: [], loading: false, loaded: false });
  localStorage.clear();
  vi.clearAllMocks();
});

describe('authStore — initial state', () => {
  test('user is null', () => {
    expect(useAuthStore.getState().user).toBeNull();
  });

  test('isAuthenticated is false', () => {
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });

  test('isAdmin is false', () => {
    expect(useAuthStore.getState().isAdmin).toBe(false);
  });

  test('loading is false', () => {
    expect(useAuthStore.getState().loading).toBe(false);
  });
});

describe('authStore — login', () => {
  test('sets isAuthenticated on success', async () => {
    apiService.login.mockResolvedValue({
      data: { user: { id: 1, username: 'pat', admin: false, default_tag: null } },
    });

    await useAuthStore.getState().login('pat', 'password');

    expect(useAuthStore.getState().isAuthenticated).toBe(true);
  });

  test('sets isAdmin true for admin users', async () => {
    apiService.login.mockResolvedValue({
      data: { user: { id: 1, username: 'pat', admin: true, default_tag: null } },
    });

    await useAuthStore.getState().login('pat', 'password');

    expect(useAuthStore.getState().isAdmin).toBe(true);
  });

  test('sets isAdmin false for non-admin users', async () => {
    apiService.login.mockResolvedValue({
      data: { user: { id: 2, username: 'regular', admin: false, default_tag: null } },
    });

    await useAuthStore.getState().login('regular', 'password');

    expect(useAuthStore.getState().isAdmin).toBe(false);
  });

  test('returns { success: true } on success', async () => {
    apiService.login.mockResolvedValue({
      data: { user: { id: 1, username: 'pat', admin: false, default_tag: null } },
    });

    const result = await useAuthStore.getState().login('pat', 'password');

    expect(result).toEqual({ success: true });
  });

  test('returns { success: false, error } on failure', async () => {
    apiService.login.mockRejectedValue({
      response: { data: { error: 'Invalid username or password' } },
    });

    const result = await useAuthStore.getState().login('pat', 'wrong');

    expect(result.success).toBe(false);
    expect(result.error).toBe('Invalid username or password');
  });

  test('leaves isAuthenticated false on failure', async () => {
    apiService.login.mockRejectedValue({
      response: { data: { error: 'Invalid username or password' } },
    });

    await useAuthStore.getState().login('pat', 'wrong');

    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });

  test('loads favorites on successful login', async () => {
    apiService.login.mockResolvedValue({
      data: { user: { id: 1, username: 'pat', admin: false, default_tag: null } },
    });

    await useAuthStore.getState().login('pat', 'password');

    expect(apiService.getFavorites).toHaveBeenCalled();
  });
});

describe('authStore — logout', () => {
  test('clears user', async () => {
    useAuthStore.setState({ user: { id: 1, username: 'pat' }, isAuthenticated: true, isAdmin: false });
    apiService.logout.mockResolvedValue({});

    await useAuthStore.getState().logout();

    expect(useAuthStore.getState().user).toBeNull();
  });

  test('clears isAuthenticated', async () => {
    useAuthStore.setState({ user: { id: 1, username: 'pat' }, isAuthenticated: true, isAdmin: false });
    apiService.logout.mockResolvedValue({});

    await useAuthStore.getState().logout();

    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });

  test('clears isAdmin', async () => {
    useAuthStore.setState({ user: { id: 1, username: 'pat' }, isAuthenticated: true, isAdmin: true });
    apiService.logout.mockResolvedValue({});

    await useAuthStore.getState().logout();

    expect(useAuthStore.getState().isAdmin).toBe(false);
  });

  test('clears favorites', async () => {
    useAuthStore.setState({ user: { id: 1, username: 'pat' }, isAuthenticated: true, isAdmin: false });
    useFavoritesStore.setState({ items: [{ id: 1, kind: 'artist', target_id: 5, item: {} }], loaded: true });
    apiService.logout.mockResolvedValue({});

    await useAuthStore.getState().logout();

    expect(useFavoritesStore.getState().items).toEqual([]);
  });
});
