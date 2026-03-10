import type { PieSlice } from "../../types";

interface PieChartProps {
  slices: PieSlice[];
}

function createGradient(slices: PieSlice[]) {
  const total = slices.reduce((sum, slice) => sum + slice.value, 0) || 1;
  const palette = ["#0e7490", "#1d4ed8", "#f97316", "#16a34a", "#e11d48", "#7c3aed"];
  let offset = 0;

  return slices
    .map((slice, index) => {
      const start = offset;
      const size = (slice.value / total) * 100;
      offset += size;
      const color = palette[index % palette.length];
      return `${color} ${start}% ${offset}%`;
    })
    .join(", ");
}

export function PieChart({ slices }: PieChartProps) {
  return (
    <div className="pie-chart-layout">
      <div
        className="pie-chart"
        style={{ backgroundImage: `conic-gradient(${createGradient(slices)})` }}
      />
      <div className="pie-chart-legend">
        {slices.map((slice) => (
          <div className="pie-chart-legend-item" key={slice.label}>
            <span>{slice.label}</span>
            <strong>{slice.value}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}
