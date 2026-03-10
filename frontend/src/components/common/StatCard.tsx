interface StatCardProps {
  accent: "teal" | "blue" | "green" | "orange";
  label: string;
  value: string;
}

export function StatCard({ accent, label, value }: StatCardProps) {
  return (
    <article className={`stat-card stat-card-${accent}`}>
      <p>{label}</p>
      <strong>{value}</strong>
    </article>
  );
}
