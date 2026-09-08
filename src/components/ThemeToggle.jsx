import { useThemeStore } from '../stores/themeStore';

// Segmented Light/Dark/System control for the site-wide color theme.
// `variant` picks the surface colors, matching HomeViewToggle: 'dark'
// (default) for the hamburger dropdown, 'light' for Account's white cards.
// These pill colors are the dropdown/card chrome, independent of the
// site-wide theme this component controls.
const ThemeToggle = ({ variant = 'dark' }) => {
  const { mode, setMode } = useThemeStore();
  const pillBackground = variant === 'light' ? '#f3f4f6' : '#1a252f';
  const inactiveColor = variant === 'light' ? '#6b7280' : '#9ca3af';

  const options = [
    { value: 'light', label: 'Light' },
    { value: 'dark', label: 'Dark' },
    { value: 'system', label: 'System' },
  ];

  return (
    <div style={{ display: 'inline-flex', background: pillBackground, borderRadius: '20px', padding: '3px' }}>
      {options.map(({ value, label }) => (
        <button
          key={value}
          onClick={() => setMode(value)}
          style={{
            background: mode === value ? '#3b82f6' : 'none',
            color: mode === value ? 'white' : inactiveColor,
            padding: '4px 14px', borderRadius: '18px',
            fontSize: '0.75rem', fontWeight: '600',
            border: 'none', cursor: 'pointer',
          }}
        >
          {label}
        </button>
      ))}
    </div>
  );
};

export default ThemeToggle;
