interface SkeletonRowProps {
  width?: string;
  height?: string;
}

export function SkeletonRow({ width = "100%", height = "1rem" }: SkeletonRowProps) {
  return (
    <div
      className="skeleton-shimmer"
      style={{ width, height, borderRadius: "6px" }}
    />
  );
}

interface SkeletonCardProps {
  lines?: number;
}

export function SkeletonCard({ lines = 3 }: SkeletonCardProps) {
  return (
    <div className="skeleton-card">
      <SkeletonRow width="60%" height="1.25rem" />
      {Array.from({ length: lines }).map((_, i) => (
        <SkeletonRow
          key={i}
          width={`${85 - i * 10}%`}
          height="0.875rem"
        />
      ))}
    </div>
  );
}

interface SkeletonTableProps {
  rows?: number;
  columns?: number;
}

export function SkeletonTable({ rows = 8, columns = 6 }: SkeletonTableProps) {
  return (
    <div className="skeleton-table">
      <div className="skeleton-table__header">
        {Array.from({ length: columns }).map((_, i) => (
          <SkeletonRow key={i} width="5rem" height="0.75rem" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={rowIndex} className="skeleton-table__row">
          {Array.from({ length: columns }).map((_, colIndex) => (
            <SkeletonRow
              key={colIndex}
              width={`${60 + Math.random() * 30}%`}
              height="0.75rem"
            />
          ))}
        </div>
      ))}
    </div>
  );
}

export function SkeletonDashboard() {
  return (
    <div className="skeleton-dashboard">
      <div className="skeleton-dashboard__cards">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonCard key={i} lines={2} />
        ))}
      </div>
      <div className="skeleton-dashboard__charts">
        <div className="skeleton-chart">
          <SkeletonRow width="40%" height="1rem" />
          <SkeletonRow width="100%" height="14rem" />
        </div>
        <div className="skeleton-chart">
          <SkeletonRow width="40%" height="1rem" />
          <SkeletonRow width="100%" height="14rem" />
        </div>
      </div>
    </div>
  );
}
