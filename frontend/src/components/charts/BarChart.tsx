interface BarChartProps {
  labels: string[];
  values: number[];
}

export function BarChart({ labels, values }: BarChartProps) {
  const max = Math.max(...values, 1);

  return (
    <div className="chart-card">
      <div className="bar-chart">
        {values.map((value, index) => (
          <div className="bar-chart-column" key={`${labels[index]}-${value}`}>
            <div className="bar-chart-value">{value}</div>
            <div
              className="bar-chart-bar"
              style={{ height: `${Math.max((value / max) * 100, 12)}%` }}
            />
            <span>{labels[index]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
