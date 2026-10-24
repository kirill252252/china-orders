// Столбчатый график на чистом SVG: столбцы без подписей, подписи вынесены в HTML,
// чтобы текст не искажался при растяжении. Подсказка по наведению через <title>.
export default function BarChart({ data, format = String, tone = '' }) {
  const max = Math.max(0, ...data.map((d) => d.value));
  if (data.length === 0 || max === 0) {
    return <p className="muted small">Нет данных за период.</p>;
  }
  const n = data.length;
  return (
    <div className="chart">
      <div className="chart-labels">
        <span>Максимум за день: {format(max)}</span>
      </div>
      <svg className={`chart-svg ${tone}`} viewBox={`0 0 ${n * 10} 100`} preserveAspectRatio="none" role="img" aria-label="График по дням">
        {data.map((d, i) => {
          const h = Math.max(d.value > 0 ? 1.5 : 0, (d.value / max) * 100);
          return (
            <rect key={d.label} x={i * 10 + 1} y={100 - h} width={8} height={h}>
              <title>{`${d.label}: ${format(d.value)}`}</title>
            </rect>
          );
        })}
      </svg>
      <div className="chart-labels">
        <span>{data[0].label}</span>
        <span>{data[n - 1].label}</span>
      </div>
    </div>
  );
}