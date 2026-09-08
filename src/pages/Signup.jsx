// src/pages/Signup.jsx
import { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { apiService } from '../services/api';
import { isLanAccess } from '../utils/device';
import { safeReturnTo } from '../utils/returnTo';

const Signup = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');

  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { signup, loading } = useAuthStore();

  // Hoisted to component scope (not just handleSubmit) so the "Continue with
  // Google" link can forward the same validated value.
  const returnTo = safeReturnTo(searchParams.get('return_to'));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    if (username.length < 3) {
      setError('Username must be at least 3 characters');
      return;
    }

    try {
      const result = await signup(username, password, email || null);
      if (result.success) {
        if (returnTo) {
          window.location.href = returnTo;
        } else {
          navigate('/');
        }
      } else {
        setError(result.error || 'Signup failed');
      }
    } catch (err) {
      console.error('Signup error:', err);
      setError(err.message || 'Signup failed. Please check console for details.');
    }
  };

  const inputStyle = {
    width: '100%',
    padding: '0.625rem 0.75rem',
    backgroundColor: 'var(--color-bg-surface)',
    border: '1px solid var(--color-border-strong)',
    borderRadius: '6px',
    color: 'var(--color-text-primary)',
    fontSize: '1rem',
    boxSizing: 'border-box',
  };

  const labelStyle = {
    display: 'block',
    color: 'var(--color-text-primary)',
    fontSize: '0.875rem',
    fontWeight: '500',
    marginBottom: '0.375rem',
  };

  return (
    <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem 1rem' }}>
      <div style={{ width: '100%', maxWidth: '400px' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <p style={{ color: 'var(--color-text-faint)', marginTop: '0.5rem' }}>Create your account</p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {error && (
            <div style={{ backgroundColor: '#7f1d1d', border: '1px solid #991b1b', borderRadius: '6px', padding: '0.75rem 1rem', color: '#fca5a5', fontSize: '0.875rem' }}>
              {error}
            </div>
          )}

          <div>
            <label htmlFor="username" style={labelStyle}>Username</label>
            <input
              id="username"
              name="username"
              type="text"
              autoComplete="username"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Choose a username (min 3 characters)"
              style={inputStyle}
            />
          </div>

          <div>
            <label htmlFor="email" style={labelStyle}>Email (optional)</label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Your email address"
              style={inputStyle}
            />
          </div>

          <div>
            <label htmlFor="password" style={labelStyle}>Password</label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Choose a password (min 6 characters)"
              style={inputStyle}
            />
          </div>

          <div>
            <label htmlFor="confirmPassword" style={labelStyle}>Confirm Password</label>
            <input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm your password"
              style={inputStyle}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{ marginTop: '0.5rem', padding: '0.75rem', backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: '6px', fontSize: '1rem', fontWeight: '500', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1 }}
          >
            {loading ? 'Creating account...' : 'Sign up'}
          </button>
        </form>

        {!isLanAccess() && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', margin: '1rem 0' }}>
              <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--color-border-strong)' }} />
              <span style={{ color: 'var(--color-text-faint)', fontSize: '0.75rem' }}>or</span>
              <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--color-border-strong)' }} />
            </div>
            <a
              href={apiService.getGoogleStartUrl(returnTo)}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', padding: '0.75rem', backgroundColor: 'var(--color-bg-surface)', color: 'var(--color-text-primary)', border: '1px solid var(--color-border-strong)', borderRadius: '6px', fontSize: '1rem', fontWeight: '500', textDecoration: 'none' }}
            >
              Continue with Google
            </a>
          </>
        )}

        <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
          <p style={{ color: 'var(--color-text-faint)', fontSize: '0.875rem' }}>
            Already have an account?{' '}
            <Link to="/login" style={{ color: '#3b82f6', textDecoration: 'none' }}>Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Signup;
