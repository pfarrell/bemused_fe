// src/pages/Login.jsx
import { useState } from 'react';
import { useNavigate, useLocation, useSearchParams, Link } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { apiService } from '../services/api';
import { isLanAccess } from '../utils/device';
import { safeReturnTo } from '../utils/returnTo';

// Error codes the backend's Google OAuth callback redirects here with. Anything
// unrecognized renders nothing rather than echoing a query-string value.
const OAUTH_ERROR_MESSAGES = {
  google_failed: 'Something went wrong connecting to Google. Please try again.',
  google_email_unverified: "Your Google account's email isn't verified. Please verify it with Google and try again.",
  google_email_in_use: 'An account with this email already exists — sign in with your password, then connect Google from your Account page.',
  access_denied: 'Google sign-in was cancelled.',
};

const errorBannerStyle = {
  backgroundColor: '#7f1d1d',
  border: '1px solid #991b1b',
  borderRadius: '6px',
  padding: '0.75rem 1rem',
  color: '#fca5a5',
  fontSize: '0.875rem',
};

const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { login, loading } = useAuthStore();

  // Own-property check matters: a bare lookup for ?error=constructor returns an
  // inherited function, which is truthy — that renders an empty red banner (React
  // drops a function child with a warning rather than printing it).
  const oauthErrorCode = searchParams.get('error');
  const oauthError =
    oauthErrorCode && Object.hasOwn(OAUTH_ERROR_MESSAGES, oauthErrorCode)
      ? OAUTH_ERROR_MESSAGES[oauthErrorCode]
      : null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    try {
      const result = await login(username, password);
      if (result.success) {
        const returnTo = safeReturnTo(searchParams.get('return_to'));
        if (returnTo) {
          window.location.href = returnTo;
        } else {
          const from = location.state?.from || '/';
          navigate(from, { replace: true });
        }
      } else {
        setError(result.error || 'Login failed');
      }
    } catch (err) {
      console.error('Login error:', err);
      setError(err.message || 'Login failed. Please check console for details.');
    }
  };

  return (
    <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem 1rem' }}>
      <div style={{ width: '100%', maxWidth: '400px' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <p style={{ color: '#9ca3af', marginTop: '0.5rem' }}>Sign in to your account</p>
        </div>

        {oauthError && (
          <div data-testid="oauth-error" style={{ ...errorBannerStyle, marginBottom: '1rem' }}>
            {oauthError}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {error && (
            <div style={errorBannerStyle}>
              {error}
            </div>
          )}

          <div>
            <label htmlFor="username" style={{ display: 'block', color: '#111827', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.375rem' }}>
              Username
            </label>
            <input
              id="username"
              name="username"
              type="text"
              autoComplete="username"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter your username"
              style={{ width: '100%', padding: '0.625rem 0.75rem', backgroundColor: '#f9fafb', border: '1px solid #d1d5db', borderRadius: '6px', color: '#111827', fontSize: '1rem', boxSizing: 'border-box' }}
            />
          </div>

          <div>
            <label htmlFor="password" style={{ display: 'block', color: '#111827', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.375rem' }}>
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              style={{ width: '100%', padding: '0.625rem 0.75rem', backgroundColor: '#f9fafb', border: '1px solid #d1d5db', borderRadius: '6px', color: '#111827', fontSize: '1rem', boxSizing: 'border-box' }}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{ marginTop: '0.5rem', padding: '0.75rem', backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: '6px', fontSize: '1rem', fontWeight: '500', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1 }}
          >
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>
        {!isLanAccess() && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', margin: '1rem 0' }}>
              <div style={{ flex: 1, height: '1px', backgroundColor: '#d1d5db' }} />
              <span style={{ color: '#9ca3af', fontSize: '0.75rem' }}>or</span>
              <div style={{ flex: 1, height: '1px', backgroundColor: '#d1d5db' }} />
            </div>
            <a
              href={apiService.getGoogleStartUrl()}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', padding: '0.75rem', backgroundColor: 'white', color: '#111827', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '1rem', fontWeight: '500', textDecoration: 'none' }}
            >
              Continue with Google
            </a>
          </>
        )}
        <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
          <p style={{ color: '#9ca3af', fontSize: '0.875rem' }}>
            Don't have an account?{' '}
            <Link to="/signup" style={{ color: '#3b82f6', textDecoration: 'none' }}>Sign up</Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
