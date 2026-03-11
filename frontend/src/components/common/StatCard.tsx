interface StatCardProps {
  accent: "teal" | "blue" | "green" | "orange";
  label: string;
  value: string;
}

function renderAccentIcon(accent: StatCardProps["accent"]) {
  switch (accent) {
    case "teal":
      return (
        <svg fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
          <path
            d="M5 12h14M12 5l7 7-7 7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    case "blue":
      return (
        <svg fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
          <path
            d="M4 12h4l2.5-6 4 12 2.5-6H20"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    case "green":
      return (
        <svg fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
          <path
            d="M12 3v18M7 8h7.5a3.5 3.5 0 010 7H9.5a3.5 3.5 0 000 7H17"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    case "orange":
      return (
        <svg fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
          <path
            d="M12 9v4m0 4h.01M4.93 19h14.14c1.54 0 2.5-1.67 1.73-3L13.73 4c-.77-1.33-2.69-1.33-3.46 0L3.2 16c-.77 1.33.19 3 1.73 3z"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
  }
}

export function StatCard({ accent, label, value }: StatCardProps) {
  return (
    <article className={`stat-card stat-card-${accent}`}>
      <div className="stat-card-top">
        <span className="stat-card-icon">{renderAccentIcon(accent)}</span>
        <span className="stat-card-kicker">Operational KPI</span>
      </div>
      <div className="stat-card-copy">
        <p>{label}</p>
        <strong>{value}</strong>
      </div>
    </article>
  );
}
