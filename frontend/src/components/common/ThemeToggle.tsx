import { useTheme } from "../../contexts/ThemeContext";

const themeOptions = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
] as const;

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <div aria-label="Select theme" className="theme-toggle" role="group">
      {themeOptions.map((option) => (
        <button
          aria-pressed={theme === option.value}
          className={`theme-toggle-button ${theme === option.value ? "active" : ""}`}
          key={option.value}
          onClick={() => setTheme(option.value)}
          type="button"
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
