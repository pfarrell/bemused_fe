import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { apiService } from '../services/api';
import { isLanAccess } from '../utils/device';
import toast from 'react-hot-toast';
import HomeViewToggle from '../components/HomeViewToggle';
import TagFilterControl from '../components/TagFilterControl';

const cardStyle = {
  backgroundColor: 'white',
  border: '1px solid #d1d5db',
  borderRadius: '6px',
  padding: '1.25rem',
  marginBottom: '1.5rem',
};

const inputStyle = {
  width: '100%',
  padding: '0.625rem 0.75rem',
  backgroundColor: '#f9fafb',
  border: '1px solid #d1d5db',
  borderRadius: '6px',
  color: '#111827',
  fontSize: '1rem',
  boxSizing: 'border-box',
};

const buttonStyle = {
  padding: '0.625rem 1rem',
  backgroundColor: '#3b82f6',
  color: 'white',
  border: 'none',
  borderRadius: '6px',
  fontSize: '0.875rem',
  fontWeight: '500',
  cursor: 'pointer',
};

const Account = () => {
  const { user, setUser, logout } = useAuthStore();
  const [searchParams] = useSearchParams();
  const [password, setPasswordField] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [settingPassword, setSettingPassword] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  const linked = searchParams.get('linked');
  const error = searchParams.get('error');

  const handleSetPassword = async (e) => {
    e.preventDefault();
    if (password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    if (password !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    setSettingPassword(true);
    try {
      await apiService.setPassword(password);
      setUser({ ...user, has_password: true });
      setPasswordField('');
      setConfirmPassword('');
      toast.success('Password set');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to set password');
    } finally {
      setSettingPassword(false);
    }
  };

  const handleLogout = async () => {
    await logout();
  };

  const handleDisconnectGoogle = async () => {
    setDisconnecting(true);
    try {
      await apiService.disconnectGoogle();
      setUser({ ...user, google_connected: false });
      toast.success('Google account disconnected');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to disconnect Google');
    } finally {
      setDisconnecting(false);
    }
  };

  return (
    <div style={{ maxWidth: '480px', margin: '0 auto', padding: '2rem 1rem' }}>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'white', marginBottom: '1.5rem' }}>Account</h1>

      {linked === 'google' && (
        <div style={{ backgroundColor: '#065f46', border: '1px solid #10b981', borderRadius: '6px', padding: '0.75rem 1rem', color: '#a7f3d0', fontSize: '0.875rem', marginBottom: '1rem' }}>
          Google account connected.
        </div>
      )}
      {error === 'google_already_linked' && (
        <div style={{ backgroundColor: '#7f1d1d', border: '1px solid #991b1b', borderRadius: '6px', padding: '0.75rem 1rem', color: '#fca5a5', fontSize: '0.875rem', marginBottom: '1rem' }}>
          That Google account is already linked to another user.
        </div>
      )}

      <div style={cardStyle}>
        <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#9ca3af', marginBottom: '0.5rem' }}>
          Profile
        </div>
        <div style={{ color: '#111827' }}>{user?.username}</div>
        {user?.email && <div style={{ color: '#6b7280', fontSize: '0.875rem' }}>{user.email}</div>}
      </div>

      <div style={cardStyle}>
        <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#9ca3af', marginBottom: '0.75rem' }}>
          Home View
        </div>
        <HomeViewToggle variant="light" />
      </div>

      <div style={cardStyle}>
        <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#9ca3af', marginBottom: '0.75rem' }}>
          Tag Filter
        </div>
        <TagFilterControl allowSetDefault variant="light" />
      </div>

      <div style={cardStyle}>
        <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#9ca3af', marginBottom: '0.75rem' }}>
          Connected accounts
        </div>
        {user?.google_connected ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ color: '#111827', fontSize: '0.875rem' }}>Google — connected</span>
            {user?.has_password ? (
              <button onClick={handleDisconnectGoogle} disabled={disconnecting} style={{ ...buttonStyle, backgroundColor: '#ef4444' }}>
                {disconnecting ? 'Disconnecting...' : 'Disconnect'}
              </button>
            ) : (
              <span style={{ color: '#9ca3af', fontSize: '0.75rem' }}>Set a password to disconnect</span>
            )}
          </div>
        ) : !isLanAccess() ? (
          <a
            href={apiService.getGoogleStartUrl('/account', 'link')}
            style={{ ...buttonStyle, display: 'inline-block', textDecoration: 'none', textAlign: 'center' }}
          >
            Connect Google Account
          </a>
        ) : null}
      </div>

      {!user?.has_password && (
        <div style={cardStyle}>
          <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#9ca3af', marginBottom: '0.75rem' }}>
            Set a password
          </div>
          <p style={{ color: '#6b7280', fontSize: '0.8125rem', marginBottom: '0.75rem' }}>
            You signed up with Google and don't have a password yet. Set one to also sign in with your username, and to be able to disconnect Google later.
          </p>
          <form onSubmit={handleSetPassword} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <input
              type="password"
              placeholder="New password (min 6 characters)"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPasswordField(e.target.value)}
              style={inputStyle}
            />
            <input
              type="password"
              placeholder="Confirm password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              style={inputStyle}
            />
            <button type="submit" disabled={settingPassword} style={buttonStyle}>
              {settingPassword ? 'Saving...' : 'Set password'}
            </button>
          </form>
        </div>
      )}

      <div style={cardStyle}>
        <button onClick={handleLogout} style={{ ...buttonStyle, backgroundColor: '#ef4444' }}>
          Log Out
        </button>
      </div>
    </div>
  );
};

export default Account;
