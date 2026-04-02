import { useTheme } from "../../contexts/ThemeContext";

const SystemIcon = () => (
  <svg aria-hidden="true" fill="none" height="18" viewBox="0 0 24 24" width="18" xmlns="http://www.w3.org/2000/svg">
    <rect height="12" rx="2" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" width="16" x="4" y="5" />
    <path d="M9 19h6M12 17v2" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
  </svg>
);

const LightIcon = () => (
  <svg aria-hidden="true" fill="none" height="18" viewBox="0 0 24 24" width="18" xmlns="http://www.w3.org/2000/svg">
    <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.8" />
    <path d="M12 3v2.2M12 18.8V21M5.64 5.64l1.56 1.56M16.8 16.8l1.56 1.56M3 12h2.2M18.8 12H21M5.64 18.36 7.2 16.8M16.8 7.2l1.56-1.56" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
  </svg>
);

const DarkIcon = () => (
  <svg aria-hidden="true" fill="none" height="18" viewBox="0 0 24 24" width="18" xmlns="http://www.w3.org/2000/svg">
    <path d="M20 14.5A8.5 8.5 0 1 1 9.5 4 6.8 6.8 0 0 0 20 14.5Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
  </svg>
);

const themeOptions = [
  { value: "system", label: "System", icon: <SystemIcon /> },
  { value: "light", label: "Light", icon: <LightIcon /> },
  { value: "dark", label: "Dark", icon: <DarkIcon /> },
] as const;

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <div aria-label="Select theme" className="theme-toggle" role="group">
      {themeOptions.map((option) => (
        <button
          aria-label={option.label}
          aria-pressed={theme === option.value}
          className={`theme-toggle-button ${theme === option.value ? "active" : ""}`}
          key={option.value}
          onClick={() => setTheme(option.value)}
          title={option.label}
          type="button"
        >
          {option.icon}
        </button>
      ))}
    </div>
  );
}
