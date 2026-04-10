interface ChartPanelHeaderProps {
  title: string;
  accentClassName?: string;
}

export function ChartPanelHeader({
  title,
  accentClassName = "management-section-icon--green",
}: ChartPanelHeaderProps) {
  return (
    <div className="chart-header">
      <h3 className="chart-title management-panel-title">
        <span className={`management-section-icon ${accentClassName}`} aria-hidden="true">
          <svg viewBox="0 0 24 24">
            <path d="M4 18h16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            <path d="M7 16V9" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            <path d="M12 16V6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            <path d="M17 16v-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </span>
        <span>{title}</span>
      </h3>
    </div>
  );
}
