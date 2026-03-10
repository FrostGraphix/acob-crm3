interface LineChartProps {
  labels: string[];
  values: number[];
}

export function LineChart({ labels, values }: LineChartProps) {
  const max = Math.max(...values, 1);
  const points = values
    .map((value, index) => {
      const x = (index / Math.max(values.length - 1, 1)) * 100;
      const y = 100 - (value / max) * 100;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <div className="chart-card">
      <svg className="line-chart" viewBox="0 0 100 100" preserveAspectRatio="none">
        <polyline fill="none" points={points} stroke="currentColor" strokeWidth="3" />
      </svg>
      <div className="line-chart-labels">
        {labels.map((label) => (
          <span key={label}>{label}</span>
        ))}
      </div>
    </div>
  );
}
