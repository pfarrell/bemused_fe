import { useUnsavedChangesStore } from './unsavedChangesStore';

beforeEach(() => {
  useUnsavedChangesStore.setState({ hasUnsavedChanges: false, save: null });
});

describe('unsavedChangesStore', () => {
  test('defaults to no unsaved changes and no save function', () => {
    expect(useUnsavedChangesStore.getState().hasUnsavedChanges).toBe(false);
    expect(useUnsavedChangesStore.getState().save).toBe(null);
  });

  test('setUnsavedChanges updates both fields', () => {
    const save = async () => {};
    useUnsavedChangesStore.getState().setUnsavedChanges(true, save);
    expect(useUnsavedChangesStore.getState().hasUnsavedChanges).toBe(true);
    expect(useUnsavedChangesStore.getState().save).toBe(save);
  });

  test('clear resets to defaults', () => {
    useUnsavedChangesStore.getState().setUnsavedChanges(true, async () => {});
    useUnsavedChangesStore.getState().clear();
    expect(useUnsavedChangesStore.getState().hasUnsavedChanges).toBe(false);
    expect(useUnsavedChangesStore.getState().save).toBe(null);
  });
});
