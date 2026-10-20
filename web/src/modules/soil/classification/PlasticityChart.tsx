import { useTranslation } from "react-i18next";
import type { USCSItemDTO, USCSReferenceDTO } from "../types";
import { PLOT, clipSegments, crossingLL, pathOf, scale, type Range } from "./geometry";

const LL_RANGE: Range = { min: 0, max: 100 };
const PI_RANGE: Range = { min: 0, max: 60 };
/** PI limits of the CL-ML zone, as in the engine's `uscs.fines_type` (ASTM D2487 Fig. 4). */
const CL_ML_PI = { low: 4, high: 7 } as const;

/** PI at which the line names are placed (label positions only). */
const U_LABEL_PI = 50;
const A_LABEL_PI = 40;

/**
 * Casagrande plasticity chart. A- and U-lines come from the API and go negative below LL 20 / 8;
 * the negative part is clipped (PI < 0 is not drawn).
 */
export function PlasticityChart({ reference, items }: { reference: USCSReferenceDTO; items: USCSItemDTO[] }) {
  const { t } = useTranslation();
  const x0 = PLOT.left;
  const x1 = PLOT.width - PLOT.right;
  const y0 = PLOT.height - PLOT.bottom;
  const y1 = PLOT.top;
  const px = (ll: number) => scale(ll, LL_RANGE, x0, x1, false);
  const py = (pi: number) => scale(pi, PI_RANGE, y0, y1, false);
  const line = (src: { LL: number; PI: number | null }[]) =>
    clipSegments(
      src.flatMap((p) => (p.PI !== null ? [{ x: p.LL, y: p.PI }] : [])),
      LL_RANGE,
      PI_RANGE,
    ).map((run) => pathOf(run.map((p) => ({ x: px(p.x), y: py(p.y) }))));

  const plottable = items.filter(
    (i) => i.LL !== null && i.PI !== null && i.LL >= LL_RANGE.min && i.LL <= LL_RANGE.max
      && i.PI >= PI_RANGE.min && i.PI <= PI_RANGE.max,
  );
  const withLimits = items.filter((i) => i.LL !== null && i.PI !== null).length;
  const hidden = withLimits - plottable.length;

  const aLow = crossingLL(reference.a_line, CL_ML_PI.low);
  const aHigh = crossingLL(reference.a_line, CL_ML_PI.high);
  const zone = aLow !== null && aHigh !== null
    ? `${px(0)},${py(CL_ML_PI.low)} ${px(aLow)},${py(CL_ML_PI.low)} ${px(aHigh)},${py(CL_ML_PI.high)} ${px(0)},${py(CL_ML_PI.high)}`
    : null;
  const uLabelLL = crossingLL(reference.u_line, U_LABEL_PI);
  const aLabelLL = crossingLL(reference.a_line, A_LABEL_PI);
  const llTicks = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
  const piTicks = [0, 10, 20, 30, 40, 50, 60];

  return (
    <div>
      <svg
        viewBox={`0 0 ${PLOT.width} ${PLOT.height}`}
        role="img"
        aria-label={t("soil.cls.uscs.chart_label")}
        data-testid="plasticity-chart"
        style={{ width: "100%", maxWidth: 720, height: "auto" }}
      >
        <rect x={x0} y={y1} width={x1 - x0} height={y0 - y1} fill="none" stroke="currentColor" strokeOpacity={0.5} />
        {llTicks.map((v) => (
          <g key={`x${v}`}>
            <line x1={px(v)} x2={px(v)} y1={y1} y2={y0} stroke="currentColor" strokeOpacity={0.12} />
            <text x={px(v)} y={y0 + 16} fontSize={11} textAnchor="middle" fill="currentColor">{v}</text>
          </g>
        ))}
        {piTicks.map((v) => (
          <g key={`y${v}`}>
            <line x1={x0} x2={x1} y1={py(v)} y2={py(v)} stroke="currentColor" strokeOpacity={0.12} />
            <text x={x0 - 6} y={py(v) + 4} fontSize={11} textAnchor="end" fill="currentColor">{v}</text>
          </g>
        ))}
        <text x={(x0 + x1) / 2} y={PLOT.height - 8} fontSize={12} textAnchor="middle" fill="currentColor">
          {t("soil.cls.uscs.axis_ll")}
        </text>
        <text x={14} y={(y0 + y1) / 2} fontSize={12} textAnchor="middle" fill="currentColor" transform={`rotate(-90 14 ${(y0 + y1) / 2})`}>
          {t("soil.cls.uscs.axis_pi")}
        </text>
        {zone && <polygon points={zone} fill="#f9a825" fillOpacity={0.3} stroke="#f9a825" data-testid="plasticity-clml" />}
        {line(reference.a_line).map((d, i) => (
          <path key={`a${i}`} d={d} fill="none" stroke="currentColor" strokeWidth={1.5} data-testid="plasticity-aline" />
        ))}
        {line(reference.u_line).map((d, i) => (
          <path key={`u${i}`} d={d} fill="none" stroke="currentColor" strokeDasharray="5 3" data-testid="plasticity-uline" />
        ))}
        {uLabelLL !== null && (
          <text x={px(uLabelLL) - 6} y={py(U_LABEL_PI) - 4} fontSize={11} textAnchor="end" fill="currentColor">
            {t("soil.cls.uscs.u_line")}
          </text>
        )}
        {aLabelLL !== null && (
          <text x={px(aLabelLL) + 6} y={py(A_LABEL_PI) + 12} fontSize={11} fill="currentColor">
            {t("soil.cls.uscs.a_line")}
          </text>
        )}
        {plottable.map((item, i) => (
          <circle key={i} cx={px(item.LL as number)} cy={py(item.PI as number)} r={4} fill="#1976d2" stroke="#fff" strokeWidth={0.8} data-testid="plasticity-point">
            <title>
              {`${item.depth !== null ? `z = ${item.depth.toFixed(2)} m · ` : ""}LL = ${item.LL} · PI = ${item.PI}${item.symbol ? ` · ${item.symbol}` : ""}`}
            </title>
          </circle>
        ))}
      </svg>
      {hidden > 0 && (
        <div style={{ fontSize: 12, opacity: 0.75 }} data-testid="plasticity-hidden">
          {t("soil.cls.uscs.hidden_points", { count: hidden })}
        </div>
      )}
    </div>
  );
}
