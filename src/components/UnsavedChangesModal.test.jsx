// src/components/UnsavedChangesModal.test.jsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import UnsavedChangesModal from './UnsavedChangesModal';

describe('UnsavedChangesModal', () => {
  test('shows the unsaved changes message', () => {
    render(<UnsavedChangesModal onSave={vi.fn()} onDiscard={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByRole('heading', { name: 'Unsaved changes' })).toBeInTheDocument();
  });

  test('Save & Refresh calls onSave', async () => {
    const onSave = vi.fn().mockResolvedValue();
    render(<UnsavedChangesModal onSave={onSave} onDiscard={vi.fn()} onCancel={vi.fn()} />);
    await userEvent.click(screen.getByText('Save & Refresh'));
    expect(onSave).toHaveBeenCalled();
  });

  test('shows an error and stays open if save fails', async () => {
    const onSave = vi.fn().mockRejectedValue({ response: { data: { error: 'Boom' } } });
    render(<UnsavedChangesModal onSave={onSave} onDiscard={vi.fn()} onCancel={vi.fn()} />);
    await userEvent.click(screen.getByText('Save & Refresh'));
    expect(await screen.findByText('Boom')).toBeInTheDocument();
    expect(screen.getByText('Save & Refresh')).toBeInTheDocument();
  });

  test('Discard Changes calls onDiscard', async () => {
    const onDiscard = vi.fn();
    render(<UnsavedChangesModal onSave={vi.fn()} onDiscard={onDiscard} onCancel={vi.fn()} />);
    await userEvent.click(screen.getByText('Discard Changes'));
    expect(onDiscard).toHaveBeenCalled();
  });

  test('Cancel calls onCancel', async () => {
    const onCancel = vi.fn();
    render(<UnsavedChangesModal onSave={vi.fn()} onDiscard={vi.fn()} onCancel={onCancel} />);
    await userEvent.click(screen.getByText('Cancel'));
    expect(onCancel).toHaveBeenCalled();
  });

  test('clicking the backdrop calls onCancel', async () => {
    const onCancel = vi.fn();
    render(<UnsavedChangesModal onSave={vi.fn()} onDiscard={vi.fn()} onCancel={onCancel} />);
    await userEvent.click(screen.getByTestId('unsaved-changes-modal-backdrop'));
    expect(onCancel).toHaveBeenCalled();
  });

  test('disables buttons while saving', async () => {
    // On success the parent (Layout) unmounts this modal as part of doing
    // the refresh — this component doesn't clear its own saving state on
    // success, only on failure (see the error-path test above).
    const onSave = vi.fn(() => new Promise(() => {})); // never resolves
    render(<UnsavedChangesModal onSave={onSave} onDiscard={vi.fn()} onCancel={vi.fn()} />);
    await userEvent.click(screen.getByText('Save & Refresh'));
    expect(await screen.findByText('Saving…')).toBeInTheDocument();
    expect(screen.getByText('Discard Changes')).toBeDisabled();
  });
});
