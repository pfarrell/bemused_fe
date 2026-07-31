import '@testing-library/jest-dom';

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal();
  const realUseNavigate = actual.useNavigate;

  // Create a mock useNavigate that delegates to real useNavigate when possible
  const mockUseNavigate = vi.fn(() => {
    try {
      return realUseNavigate();
    } catch {
      // If not in a Router context, return a mock navigate function
      return vi.fn();
    }
  });

  return {
    ...actual,
    useNavigate: mockUseNavigate,
  };
});
