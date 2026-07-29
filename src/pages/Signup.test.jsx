import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Signup from './Signup';

const renderSignup = () =>
  render(
    <MemoryRouter>
      <Signup />
    </MemoryRouter>
  );

describe('Signup', () => {
  test('shows a Continue with Google link pointing at the OAuth start endpoint', () => {
    renderSignup();
    const link = screen.getByText('Continue with Google');
    expect(link).toHaveAttribute('href', '/api/auth/google/start');
  });
});
