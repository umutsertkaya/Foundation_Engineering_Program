import { useTranslation } from "react-i18next";

interface DepthSeries {
  label: string;
  values: (number | null)[];
  color: string;
  dashArray?: string;
  highlighted?: boolean[];
}

interface DepthChartProps {
  depth: (number | null)[];
  series: DepthSeries[];
  ariaLabel: string;
  xLabel: string;
  yLabel: string;
  reference?: { value: number; label: string };
  highlightLabel?: string;
}

const finite = (value: number | null | undefined): value is number =>
  typeof value === "number" && Number.isFinite(value);

/** Plot supplied values only; missing coordinates break the series. */
export function DepthChart({ depth, series, ariaLabel, xLabel, yLabel, reference, highlightLabel }: DepthChartProps) {
  const { t } = useTranslation();
  const points = series.flatMap((s) => depth.flatMap((d, i) =>
    finite(d) && finite(s.values[i]) ? [{ depth: d, value: s.values[i] as number }] : [],
  ));
  const xMin = points.reduce((min, p) => Math.min(min, p.value), Math.min(0, reference?.value ?? 0));
  const xMax = points.reduce((max, p) => Math.max(max, p.value), reference?.value ?? 0);
  const yMin = depth.reduce<number>((min, d) => finite(d) ? Math.min(min, d) : min, 0);
  const yMax = depth.reduce<number>((max, d) => finite(d) ? Math.max(max, d) : max, 0);
  const xSpan = xMax - xMin || 1;
  const ySpan = yMax - yMin || 1;
  const x = (value: number) => 76 + (value - xMin) / xSpan * 440;
  const y = (value: number) => 44 + (value - yMin) / ySpan * 290;
  const ticks = [0, 0.25, 0.5, 0.75, 1];

  return (
    <figure style={{ margin: 0 }}>
      <svg role="img" aria-label={ariaLabel} viewBox="0 0 560 400" style={{ width: "100%", maxWidth: 560, color: "var(--mantine-color-text)" }}>
        <title>{ariaLabel}</title>
        <g fill="currentColor" fontSize={12}>
          <path d="M76 44 V334 H516" fill="none" stroke="currentColor" />
          {ticks.map((fraction) => (
            <g key={fraction}>
              <path d={`M${76 + fraction * 440} 334 v5 M71 ${44 + fraction * 290} h5`} stroke="currentColor" />
              <text x={76 + fraction * 440} y={355} textAnchor="middle">{(xMin + fraction * xSpan).toFixed(2)}</text>
              <text x={66} y={48 + fraction * 290} textAnchor="end">{(yMin + fraction * ySpan).toFixed(2)}</text>
            </g>
          ))}
          <text x={296} y={386} textAnchor="middle">{xLabel}</text>
          <text transform="translate(18 190) rotate(-90)" textAnchor="middle">{yLabel}</text>
          {reference && (
            <g>
              <path d={`M${x(reference.value)} 44 V334`} stroke="var(--mantine-color-dimmed)" strokeDasharray="3 4" />
              <text x={x(reference.value)} y={29} textAnchor="middle">{reference.label}</text>
            </g>
          )}
          {points.length === 0 && <text x={296} y={190} textAnchor="middle">{t("liquefaction.results.no_chart_data")}</text>}
        </g>
        {series.map((s, si) => {
          let connected = false;
          const path = depth.map((d, i) => {
            const value = s.values[i];
            if (!finite(d) || !finite(value)) {
              connected = false;
              return "";
            }
            const command = connected ? "L" : "M";
            connected = true;
            return `${command}${x(value)} ${y(d)}`;
          }).join(" ");
          return (
            <g key={`${si}-${s.label}`}>
              <path d={path} fill="none" stroke={s.color} strokeWidth={2} strokeDasharray={s.dashArray} />
              {depth.map((d, i) => finite(d) && finite(s.values[i]) && (
                <circle key={i} cx={x(s.values[i] as number)} cy={y(d)}
                  r={s.highlighted?.[i] ? 5 : 2.5}
                  fill={s.highlighted?.[i] ? "var(--mantine-color-red-6)" : s.color}
                  stroke="var(--mantine-color-body)" strokeWidth={1.5} />
              ))}
            </g>
          );
        })}
      </svg>
      <figcaption style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
        {series.map((s, si) => (
          <span key={`${si}-${s.label}`}>
            <svg aria-hidden="true" width={32} height={12} style={{ marginRight: 6 }}>
              <line x1={0} y1={6} x2={32} y2={6} stroke={s.color} strokeWidth={2} strokeDasharray={s.dashArray} />
            </svg>{s.label}
          </span>
        ))}
        {highlightLabel && <span><svg aria-hidden="true" width={16} height={12}><circle cx={6} cy={6} r={5} fill="var(--mantine-color-red-6)" /></svg>{highlightLabel}</span>}
      </figcaption>
    </figure>
  );
}
