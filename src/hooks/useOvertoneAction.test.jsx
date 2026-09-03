import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, test, expect } from 'vitest';
import { useOvertoneAction } from './useOvertoneAction';

// A tiny host component, since hooks can only be exercised through a component.
const Host = ({ musicbrainzId, entityType }) => {
  const { overflowAction, modal } = useOvertoneAction(musicbrainzId, entityType);
  return (
    <div>
      {overflowAction && <button onClick={overflowAction.onClick}>{overflowAction.icon} {overflowAction.label}</button>}
      {modal}
    </div>
  );
};

const renderHost = (props) => render(<Host {...props} />, { wrapper: MemoryRouter });

describe('useOvertoneAction', () => {
  test('returns no overflow action or modal when musicbrainzId is absent', () => {
    renderHost({});
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.queryByTitle('Overtone')).not.toBeInTheDocument();
  });

  test('returns an overflow action that opens the Overtone modal on the release path', () => {
    renderHost({ musicbrainzId: 'xyz-789', entityType: 'release' });

    expect(screen.queryByTitle('Overtone')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '🔍 Overtone' }));

    expect(screen.getByTitle('Overtone')).toHaveAttribute('src', 'https://patf.com/overtone/release/xyz-789');
  });

  test('defaults to the entity path (artist) when entityType is omitted', () => {
    renderHost({ musicbrainzId: 'abc-123' });

    fireEvent.click(screen.getByRole('button', { name: '🔍 Overtone' }));

    expect(screen.getByTitle('Overtone')).toHaveAttribute('src', 'https://patf.com/overtone/entity/abc-123');
  });

  test('closing the modal removes it', () => {
    renderHost({ musicbrainzId: 'xyz-789', entityType: 'release' });

    fireEvent.click(screen.getByRole('button', { name: '🔍 Overtone' }));
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));

    expect(screen.queryByTitle('Overtone')).not.toBeInTheDocument();
  });
});
