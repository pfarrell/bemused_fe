// src/components/ConfirmDeleteModal.test.jsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ConfirmDeleteModal from './ConfirmDeleteModal';

describe('ConfirmDeleteModal', () => {
  test('shows the title and blast-radius message', () => {
    render(
      <ConfirmDeleteModal
        title="Delete artist"
        message='Delete "Nirvana" and 12 albums, 201 tracks? This cannot be undone.'
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );
    expect(screen.getByRole('heading', { name: 'Delete artist' })).toBeInTheDocument();
    expect(screen.getByText('Delete "Nirvana" and 12 albums, 201 tracks? This cannot be undone.')).toBeInTheDocument();
  });

  test('Delete button is disabled until "delete me" is typed', async () => {
    render(<ConfirmDeleteModal title="Delete artist" message="msg" onConfirm={vi.fn()} onCancel={vi.fn()} />);
    const deleteButton = screen.getByRole('button', { name: 'Delete' });
    expect(deleteButton).toBeDisabled();

    await userEvent.type(screen.getByRole('textbox'), 'delete me');
    expect(deleteButton).toBeEnabled();
  });

  test('Delete button stays disabled on a near-miss', async () => {
    render(<ConfirmDeleteModal title="Delete artist" message="msg" onConfirm={vi.fn()} onCancel={vi.fn()} />);
    await userEvent.type(screen.getByRole('textbox'), 'Delete Me');
    expect(screen.getByRole('button', { name: 'Delete' })).toBeDisabled();
  });

  test('clicking Delete after typing "delete me" calls onConfirm', async () => {
    const onConfirm = vi.fn().mockResolvedValue();
    render(<ConfirmDeleteModal title="Delete artist" message="msg" onConfirm={onConfirm} onCancel={vi.fn()} />);
    await userEvent.type(screen.getByRole('textbox'), 'delete me');
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(onConfirm).toHaveBeenCalled();
  });

  test('pressing Enter in the input after typing "delete me" calls onConfirm', async () => {
    const onConfirm = vi.fn().mockResolvedValue();
    render(<ConfirmDeleteModal title="Delete artist" message="msg" onConfirm={onConfirm} onCancel={vi.fn()} />);
    await userEvent.type(screen.getByRole('textbox'), 'delete me{Enter}');
    expect(onConfirm).toHaveBeenCalled();
  });

  test('pressing Enter before typing "delete me" does not call onConfirm', async () => {
    const onConfirm = vi.fn();
    render(<ConfirmDeleteModal title="Delete artist" message="msg" onConfirm={onConfirm} onCancel={vi.fn()} />);
    await userEvent.type(screen.getByRole('textbox'), 'delete{Enter}');
    expect(onConfirm).not.toHaveBeenCalled();
  });

  test('shows an error and stays open if the delete fails', async () => {
    const onConfirm = vi.fn().mockRejectedValue({ response: { data: { error: 'Boom' } } });
    render(<ConfirmDeleteModal title="Delete artist" message="msg" onConfirm={onConfirm} onCancel={vi.fn()} />);
    await userEvent.type(screen.getByRole('textbox'), 'delete me');
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(await screen.findByText('Boom')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();
  });

  test('Cancel calls onCancel', async () => {
    const onCancel = vi.fn();
    render(<ConfirmDeleteModal title="Delete artist" message="msg" onConfirm={vi.fn()} onCancel={onCancel} />);
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalled();
  });

  test('clicking the backdrop calls onCancel', async () => {
    const onCancel = vi.fn();
    render(<ConfirmDeleteModal title="Delete artist" message="msg" onConfirm={vi.fn()} onCancel={onCancel} />);
    await userEvent.click(screen.getByTestId('confirm-delete-modal-backdrop'));
    expect(onCancel).toHaveBeenCalled();
  });

  test('disables Cancel and the input while deleting', async () => {
    const onConfirm = vi.fn(() => new Promise(() => {})); // never resolves
    render(<ConfirmDeleteModal title="Delete artist" message="msg" onConfirm={onConfirm} onCancel={vi.fn()} />);
    await userEvent.type(screen.getByRole('textbox'), 'delete me');
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(await screen.findByText('Deleting…')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    expect(screen.getByRole('textbox')).toBeDisabled();
  });
});
