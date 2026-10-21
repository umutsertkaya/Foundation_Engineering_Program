import { Arrow, C, Line, Svg, T } from "./plot";

const rad = (d: number) => (d * Math.PI) / 180;
const nq = (p: number) => Math.exp(Math.PI * Math.tan(rad(p))) * Math.tan(rad(45 + p / 2)) ** 2;
const nc = (p: number) => (p === 0 ? 5.14 : (nq(p) - 1) / Math.tan(rad(p)));

export function BearTerzaghiZones() {
  return (
    <Svg label="Terzaghi failure zones under a strip footing">
      <Arrow />
      <rect x={20} y={60} width={360} height={190} fill={C.soil} opacity={0.5} />
      <rect x={20} y={20} width={360} height={40} fill="var(--mantine-color-body)" />
      <rect x={150} y={40} width={100} height={20} fill={C.wall} />
      <Line x1={200} y1={4} x2={200} y2={38} arrow w={2.5} /><T x={206} y={16}>Q</T>
      <polygon points="150,60 250,60 200,140" fill={C.a} opacity={0.4} stroke={C.a} />
      <path d="M150 60 Q 90 130 200 140 Z" fill={C.c} opacity={0.35} stroke={C.c} />
      <path d="M250 60 Q 310 130 200 140 Z" fill={C.c} opacity={0.35} stroke={C.c} />
      <polygon points="150,60 60,100 95,60 " fill={C.d} opacity={0.4} stroke={C.d} />
      <polygon points="250,60 340,100 305,60" fill={C.d} opacity={0.4} stroke={C.d} />
      <T x={200} y={92} anchor="middle" color={C.a}>I: aktif kama</T>
      <T x={200} y={106} anchor="middle" color={C.a}>(φ eğimi)</T>
      <T x={112} y={118} anchor="middle" color={C.c}>II: radyal</T><T x={288} y={118} anchor="middle" color={C.c}>II: radyal</T>
      <T x={84} y={74} anchor="middle" color={C.d}>III: pasif</T><T x={316} y={74} anchor="middle" color={C.d}>III: pasif</T>
      <Line x1={24} y1={22} x2={24} y2={58} /><T x={28} y={44}>D</T>
      <T x={30} y={236}>q = γ·D (taban üstü zemin yük olarak)</T>
      <Line x1={150} y1={30} x2={250} y2={30} /><T x={200} y={26} anchor="middle">B</T>
    </Svg>
  );
}

export function BearEccentricWidth() {
  const B = 200, e = 30, x0 = 100;
  return (
    <Svg label="Eccentric load and effective width">
      <Arrow />
      <rect x={x0} y={90} width={B} height={20} fill={C.wall} />
      <Line x1={x0 + B / 2 + e} y1={50} x2={x0 + B / 2 + e} y2={88} arrow w={2.5} /><T x={x0 + B / 2 + e + 6} y={62}>Q (e dışmerkezlik)</T>
      <Line x1={x0 + B / 2} y1={120} x2={x0 + B / 2} y2={140} dash="3 3" /><T x={x0 + B / 2 - 4} y={134} anchor="end">B/2</T>
      <Line x1={x0 + B / 2} y1={132} x2={x0 + B / 2 + e} y2={132} color={C.b} /><T x={x0 + B / 2 + e / 2} y={148} anchor="middle" color={C.b}>e</T>
      <polygon points={`${x0},112 ${x0},${112 + 30} ${x0 + B},${112 + 70} ${x0 + B},112`} fill={C.a} opacity={0.35} stroke={C.a} />
      <T x={x0 - 4} y={150} anchor="end" color={C.a}>q_min</T><T x={x0 + B + 4} y={186} color={C.a}>q_max</T>
      <Line x1={x0} y1={215} x2={x0 + B} y2={215} /><T x={x0 + B / 2} y={229} anchor="middle">B</T>
      <Line x1={x0} y1={238} x2={x0 + B - 2 * e} y2={238} color={C.d} w={3} /><T x={x0 + (B - 2 * e) / 2} y={252} anchor="middle" color={C.d}>B′ = B − 2e</T>
      <T x={x0 + B + 8} y={110}>e = M/Q</T>
    </Svg>
  );
}

export function BearWaterCases() {
  const panel = (x: number, label: string, wt: number) => (
    <g key={label}>
      <rect x={x} y={70} width={110} height={150} fill={C.soil} opacity={0.5} />
      <rect x={x + 30} y={55} width={50} height={15} fill={C.wall} />
      <line x1={x} y1={wt} x2={x + 110} y2={wt} stroke={C.water} strokeWidth={2} strokeDasharray="4 3" />
      <T x={x + 55} y={46} anchor="middle">{label}</T>
    </g>
  );
  return (
    <Svg label="Three groundwater cases">
      {panel(10, "1: GWT ≤ D", 62)}
      {panel(145, "2: D < GWT < D + B", 110)}
      {panel(280, "3: GWT ≥ D + B", 230)}
      <T x={20} y={236}>q: γ′ kullan</T><T x={150} y={236}>γ_eff karışık</T><T x={285} y={236}>γ kuru/doğal</T>
    </Svg>
  );
}

export function BearFactorTables() {
  const rows = [0, 10, 20, 30, 40];
  const cols = ["φ (°)", "Nc", "Nq", "Nγ Vesic", "Nγ Hansen", "Nγ Meyerhof"];
  const g = (p: number) => [
    p, nc(p), nq(p), 2 * (nq(p) + 1) * Math.tan(rad(p)), 1.5 * (nq(p) - 1) * Math.tan(rad(p)), (nq(p) - 1) * Math.tan(rad(1.4 * p)),
  ];
  return (
    <Svg label="Bearing capacity factors table">
      {cols.map((c, i) => <T key={c} x={20 + i * 62} y={30} color={C.a}>{c}</T>)}
      <Line x1={16} y1={38} x2={384} y2={38} />
      {rows.map((p, r) => g(p).map((v, i) => <T key={`${p}-${i}`} x={20 + i * 62} y={62 + r * 30}>{i === 0 ? v : v.toFixed(2)}</T>))}
      <T x={20} y={230}>Nq = e^(π tan φ)·tan²(45° + φ/2),  Nc = (Nq − 1) cot φ (φ = 0: 5,14)</T>
    </Svg>
  );
}
