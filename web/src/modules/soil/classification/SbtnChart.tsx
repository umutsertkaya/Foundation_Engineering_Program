import { useTranslation } from "react-i18next";
import type { CPTSBTNDTO, SBTNReferenceDTO } from "../types";
import { PLOT, ZONE_COLORS, clipSegments, decadeTicks, pathOf, scale, type Pt } from "./geometry";

/** Robertson SBTn chart: Qtn (y) against Fr (x), both logarithmic. Out-of-range samples are counted, not drawn. */
export function SbtnChart({ reference, points }: { reference: SBTNReferenceDTO; points: CPTSBTNDTO["points"] }) {
  const { t, i18n } = useTranslation();
  const xr = reference.fr_range;
  const yr = reference.qtn_range;
  const x0 = PLOT.left;
  const x1 = PLOT.width - PLOT.right;
  const y0 = PLOT.height - PLOT.bottom;
  const y1 = PLOT.top;
  const px = (fr: number) => scale(fr, xr, x0, x1, true);
  const py = (q: number) => scale(q, yr, y0, y1, true);
  const toPts = (list: { Fr: number | null; Qtn: number | null }[]): Pt[] =>
    list.flatMap((c) => (c.Fr !== null && c.Qtn !== null ? [{ x: c.Fr, y: c.Qtn }] : []));
  const draw = (list: { Fr: number | null; Qtn: number | null }[]) =>
    clipSegments(toPts(list), xr, yr, true, true).map((run) => pathOf(run.map((p) => ({ x: px(p.x), y: py(p.y) }))));

  const plotted = points.filter(
    (p) => p.Fr !== null && p.Qtn !== null && p.Fr >= xr.min && p.Fr <= xr.max && p.Qtn >= yr.min && p.Qtn <= yr.max,
  );
  const hidden = points.length - plotted.length;
  const zoneName = (zone: number): string => {
    const z = reference.zones.find((r) => r.zone === zone);
    if (!z) return String(zone);
    return i18n.language.startsWith("tr") ? z.name_tr : z.name_en;
  };

  return (
    <div>
      <svg
        viewBox={`0 0 ${PLOT.width} ${PLOT.height}`}
        role="img"
        aria-label={t("soil.cls.sbtn.chart_label")}
        data-testid="sbtn-chart"
        style={{ width: "100%", maxWidth: 720, height: "auto" }}
      >
        <rect x={x0} y={y1} width={x1 - x0} height={y0 - y1} fill="none" stroke="currentColor" strokeOpacity={0.5} />
        {decadeTicks(xr).map((v) => (
          <g key={`x${v}`}>
            <line x1={px(v)} x2={px(v)} y1={y1} y2={y0} stroke="currentColor" strokeOpacity={0.12} />
            <text x={px(v)} y={y0 + 16} fontSize={11} textAnchor="middle" fill="currentColor">{v}</text>
          </g>
        ))}
        {decadeTicks(yr).map((v) => (
          <g key={`y${v}`}>
            <line x1={x0} x2={x1} y1={py(v)} y2={py(v)} stroke="currentColor" strokeOpacity={0.12} />
            <text x={x0 - 6} y={py(v) + 4} fontSize={11} textAnchor="end" fill="currentColor">{v}</text>
          </g>
        ))}
        <text x={(x0 + x1) / 2} y={PLOT.height - 8} fontSize={12} textAnchor="middle" fill="currentColor">
          {t("soil.cls.sbtn.axis_fr")}
        </text>
        <text
          x={14}
          y={(y0 + y1) / 2}
          fontSize={12}
          textAnchor="middle"
          fill="currentColor"
          transform={`rotate(-90 14 ${(y0 + y1) / 2})`}
        >
          {t("soil.cls.sbtn.axis_qtn")}
        </text>

        {reference.ic_contours.map((c) =>
          draw(c.points).map((d, i) => (
            <path key={`ic${c.Ic}-${i}`} d={d} fill="none" stroke="currentColor" strokeOpacity={0.6} strokeDasharray="4 3" data-testid="sbtn-contour" />
          )),
        )}
        {reference.ic_contours.map((c) => {
          const last = toPts(c.points).filter((p) => p.x >= xr.min && p.x <= xr.max && p.y >= yr.min && p.y <= yr.max).pop();
          return last ? (
            <text key={`lbl${c.Ic}`} x={Math.min(px(last.x) + 3, x1 - 2)} y={py(last.y) - 3} fontSize={10} fill="currentColor" textAnchor="end">
              Ic={c.Ic}
            </text>
          ) : null;
        })}
        {draw(reference.zone_1_boundary).map((d, i) => (
          <path key={`z1-${i}`} d={d} fill="none" stroke={ZONE_COLORS[1]} strokeWidth={2} data-testid="sbtn-zone1" />
        ))}

        {plotted.map((p, i) => (
          <circle
            key={i}
            cx={px(p.Fr as number)}
            cy={py(p.Qtn as number)}
            r={3}
            fill={p.zone ? ZONE_COLORS[p.zone] : "#9e9e9e"}
            stroke="#fff"
            strokeWidth={0.5}
            data-testid="sbtn-point"
          >
            <title>
              {`z = ${p.depth?.toFixed(2) ?? "-"} m · Fr = ${(p.Fr as number).toFixed(2)} % · Qtn = ${(p.Qtn as number).toFixed(1)}`
                + ` · Ic = ${p.Ic?.toFixed(2) ?? "-"}${p.zone ? ` · ${p.zone}: ${zoneName(p.zone)}` : ""}`}
            </title>
          </circle>
        ))}
      </svg>
      {hidden > 0 && (
        <div style={{ fontSize: 12, opacity: 0.75 }} data-testid="sbtn-hidden">
          {t("soil.cls.sbtn.hidden_points", { count: hidden })}
        </div>
      )}
    </div>
  );
}
