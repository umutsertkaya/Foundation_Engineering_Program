import { Arrow, C, Line, Plot, Svg, T, range } from "./plot";

const rad = (d: number) => (d * Math.PI) / 180;
const f2 = (v: number) => v.toFixed(2);

/** Wall (thin bar) with its soil side on the right; (x0, yTop, yBase) in px. */
const Wall = ({ x = 60, y1 = 50, y2 = 215 }) => <rect x={x - 8} y={y1} width={8} height={y2 - y1} fill={C.wall} />;

export function EpStatesMovement() {
  const phi = 30;
  const ka = Math.tan(rad(45 - phi / 2)) ** 2, kp = Math.tan(rad(45 + phi / 2)) ** 2, k0 = 1 - Math.sin(rad(phi));
  const away = (x: number) => ka + (k0 - ka) * Math.exp(-x / 0.2);
  const toward = (x: number) => k0 + (kp - k0) * (1 - Math.exp(-Math.abs(x) / 1.5));
  return (
    <Plot
      label="Lateral earth pressure coefficient versus wall movement" xr={[-5, 1]} yr={[0, 3.5]}
      xl="duvar hareketi (% H): zemine doğru ← → zeminden uzağa" yl="K = σ′h / σ′v" xt={[-5, -4, -3, -2, -1, 0, 1]}
      series={[{ pts: [...range(-5, 0, 40).map((x) => [x, toward(x)] as [number, number]), ...range(0, 1, 30).map((x) => [x, away(x)] as [number, number])], color: C.a }]}
      extra={(sx, sy) => (
        <g>
          {[[kp, "Kp = 3,00 (pasif)"], [k0, "K0 = 0,50 (sükunet)"], [ka, "Ka = 0,33 (aktif)"]].map(([k, l]) => (
            <g key={l as string}>
              <line x1={sx(-5)} x2={sx(1)} y1={sy(k as number)} y2={sy(k as number)} stroke={C.grid} strokeDasharray="4 3" />
              <T x={sx(-4.9)} y={sy(k as number) - 4}>{l as string}</T>
            </g>
          ))}
          <T x={sx(-2.6)} y={sy(3.3)} color={C.d}>φ = 30°, sıkı kum (şematik)</T>
          <circle cx={sx(0)} cy={sy(k0)} r={4} fill={C.b} />
        </g>
      )}
    />
  );
}

export function EpKaPhi() {
  const ph = range(15, 45, 30);
  const ka = (p: number) => Math.tan(rad(45 - p / 2)) ** 2;
  const kp = (p: number) => Math.tan(rad(45 + p / 2)) ** 2;
  return (
    <Plot
      label="Ka, K0 and Kp versus friction angle" xr={[15, 45]} yr={[0, 6]} xl="φ′ (°)" yl="K"
      series={[
        { pts: ph.map((p) => [p, kp(p)]), color: C.b, label: "Kp = tan²(45° + φ/2)" },
        { pts: ph.map((p) => [p, 1 - Math.sin(rad(p))]), color: C.c, label: "K0 = 1 − sin φ" },
        { pts: ph.map((p) => [p, ka(p)]), color: C.a, label: "Ka = tan²(45° − φ/2)" },
      ]}
    />
  );
}

export function EpMohrRankine() {
  const X = (s: number) => 40 + s, Y = (t: number) => 205 - t;
  const phi = 30;
  const circ = (c: number, r: number, color: string) => <circle cx={X(c)} cy={Y(0)} r={r} fill="none" stroke={color} strokeWidth={2} />;
  return (
    <Svg label="Mohr circles at active and passive failure">
      <Line x1={40} y1={205} x2={385} y2={205} /><Line x1={40} y1={205} x2={40} y2={10} />
      <T x={380} y={220} anchor="end">σ′ (kPa)</T><T x={46} y={16}>τ</T>
      <line x1={40} y1={205} x2={X(320)} y2={Y(320 * Math.tan(rad(phi)))} stroke={C.d} strokeWidth={2} />
      <T x={X(250)} y={Y(250 * Math.tan(rad(phi))) - 6} color={C.d}>τ = σ′ tan φ (c = 0, φ = 30°)</T>
      {circ(200 / 3, 100 / 3, C.a)}{circ(200, 100, C.b)}
      {[[100 / 3, "σh,a = 33,3"], [100, "σv = 100"], [300, "σh,p = 300"]].map(([v, l]) => (
        <g key={l as string}><line x1={X(v as number)} x2={X(v as number)} y1={Y(0) - 4} y2={Y(0) + 4} stroke="currentColor" />
          <T x={X(v as number)} y={Y(0) + 15} anchor="middle">{(l as string)}</T></g>
      ))}
      <T x={X(66.7)} y={Y(33) - 22} anchor="middle" color={C.a}>aktif</T><T x={X(200)} y={Y(100) - 6} anchor="middle" color={C.b}>pasif</T>
      <T x={X(150)} y={Y(0) - 130} color="currentColor">Daire zarfa teğet: kırılma</T>
    </Svg>
  );
}

export function EpRankineDiagram() {
  const s = 30, y2 = 215, y1 = y2 - 5 * s, k = 1 / 3, ka = k, sc = 4.2; // px/kPa
  const top = ka * 10, bot = ka * (10 + 18 * 5), x0 = 68;
  return (
    <Svg label="Rankine active pressure diagram with surcharge">
      <Arrow />
      <Wall y1={y1} y2={y2} />
      <rect x={x0} y={y1} width={250} height={y2 - y1} fill={C.soil} opacity={0.35} />
      {[100, 150, 200, 250].map((x) => <Line key={x} x1={x} y1={y1 - 26} x2={x} y2={y1 - 2} arrow color={C.a} />)}
      <T x={282} y={y1 - 12} color={C.a}>q = 10 kPa</T>
      <polygon points={`${x0},${y1} ${x0 + top * sc},${y1} ${x0 + top * sc},${y2} ${x0},${y2}`} fill={C.a} opacity={0.35} />
      <polygon points={`${x0 + top * sc},${y1} ${x0 + bot * sc},${y2} ${x0 + top * sc},${y2}`} fill={C.d} opacity={0.4} />
      <polyline points={`${x0},${y1} ${x0 + top * sc},${y1} ${x0 + bot * sc},${y2} ${x0},${y2}`} fill="none" stroke="currentColor" />
      <T x={x0 + top * sc + 4} y={y1 + 12}>{f2(top)} kPa</T><T x={x0 + bot * sc - 4} y={y2 + 14} anchor="end">{f2(bot)} kPa</T>
      <T x={x0 + 8} y={y1 + 80} color={C.a}>Ka·q</T><T x={x0 + 70} y={y1 + 120} color={C.d}>Ka·γ·z</T>
      <Line x1={x0 + 175} y1={y2 - 1.818 * s} x2={x0 + 2} y2={y2 - 1.818 * s} arrow w={2.5} color={C.b} />
      <T x={x0 + 180} y={y2 - 1.818 * s + 4} color={C.b}>Pa = 91,67 kN/m</T>
      <Line x1={48} y1={y1} x2={48} y2={y2} /><T x={45} y={(y1 + y2) / 2} anchor="end">H = 5</T>
      <T x={30} y={y2 - 1.818 * s + 4} anchor="end">z̄</T>
      <T x={200} y={y2 + 30} anchor="middle">γ = 18 kN/m³, φ = 30°, c = 0, Ka = 1/3; z̄ = 1,82 m (tabandan)</T>
    </Svg>
  );
}

export function EpCohesiveCrack() {
  const ka = Math.tan(rad(35)) ** 2, c = 10, g = 18, H = 6, s = 28, y1 = 40, y2 = y1 + H * s, sc = 3;
  const z0 = (2 * c) / (g * Math.sqrt(ka)), neg = 2 * c * Math.sqrt(ka), bot = ka * g * H - neg, x0 = 150;
  const yc = y1 + z0 * s;
  return (
    <Svg label="Active pressure in cohesive soil with tension crack">
      <Arrow />
      <Wall x={x0} y1={y1} y2={y2} />
      <rect x={x0} y={y1} width={230} height={y2 - y1} fill={C.soil} opacity={0.35} />
      <rect x={x0} y={y1} width={14} height={yc - y1} fill="var(--mantine-color-body)" stroke={C.b} strokeDasharray="3 2" />
      <polygon points={`${x0},${y1} ${x0 - neg * sc},${y1} ${x0},${yc}`} fill="none" stroke={C.b} strokeDasharray="4 3" />
      <T x={x0 - neg * sc - 4} y={y1 + 4} anchor="end" color={C.b}>−2c√Ka = −{neg.toFixed(1)}</T>
      <polygon points={`${x0},${yc} ${x0 + bot * sc},${y2} ${x0},${y2}`} fill={C.d} opacity={0.4} stroke="currentColor" />
      <T x={x0 + bot * sc - 4} y={y2 + 14} anchor="end">{bot.toFixed(1)} kPa</T>
      <T x={x0 + 22} y={yc - 4} color={C.b}>çekme çatlağı z0 = {z0.toFixed(2)} m</T>
      <Line x1={x0 + 170} y1={yc + (y2 - yc) / 3} x2={x0 + 2} y2={yc + (y2 - yc) / 3} arrow w={2.5} color={C.b} />
      <T x={x0 + 150} y={yc + (y2 - yc) / 3 - 6} anchor="end" color={C.b}>Pa = {(0.5 * bot * (H - z0)).toFixed(1)} kN/m</T>
      <Line x1={56} y1={y1} x2={56} y2={y2} /><T x={52} y={(y1 + y2) / 2} anchor="end">H = 6</T>
      <T x={200} y={y2 + 30} anchor="middle">γ = 18, φ = 20°, c = 10 kPa, Ka = {ka.toFixed(3)}</T>
    </Svg>
  );
}

export function EpLayeredWater() {
  const s = 28, y1 = 30, y2 = y1 + 6 * s, ym = y1 + 3 * s, sc = 3.2, x0 = 70;
  const k1 = 1 / 3, k2 = Math.tan(rad(33)) ** 2;
  const s3 = 18 * 3, a1 = k1 * s3, a2 = k2 * s3, sv6 = s3 + (20 - 9.81) * 3, a6 = k2 * sv6, u6 = 9.81 * 3;
  return (
    <Svg label="Layered soil with water table: effective pressure and water pressure">
      <Wall x={x0} y1={y1} y2={y2} />
      <rect x={x0} y={y1} width={300} height={3 * s} fill={C.soil} opacity={0.3} />
      <rect x={x0} y={ym} width={300} height={3 * s} fill={C.soil} opacity={0.55} />
      <line x1={x0} y1={ym} x2={380} y2={ym} stroke={C.water} strokeWidth={2} strokeDasharray="5 3" />
      <T x={376} y={ym - 4} anchor="end" color={C.water}>▽ su tablası (3 m)</T>
      <T x={376} y={y1 + 14} anchor="end">1: γ = 18, φ = 30°, K = 0,333</T>
      <T x={376} y={ym + 16} anchor="end">2: γsat = 20, φ = 24°, K = {k2.toFixed(3)}</T>
      <polyline points={`${x0},${y1} ${x0 + a1 * sc},${ym} ${x0 + a2 * sc},${ym} ${x0 + a6 * sc},${y2} ${x0},${y2}`} fill={C.a} opacity={0.35} stroke={C.a} />
      <polygon points={`${x0 + a6 * sc},${ym} ${x0 + a6 * sc},${y2} ${x0 + (a6 + u6) * sc},${y2}`} fill={C.water} opacity={0.45} stroke={C.water} />
      <T x={x0 + a1 * sc + 3} y={ym - 3}>{a1.toFixed(1)}</T><T x={x0 + a2 * sc + 3} y={ym + 11}>{a2.toFixed(1)} (sıçrama)</T>
      <T x={x0 + a6 * sc - 3} y={y2 + 14} anchor="end">{a6.toFixed(1)}</T><T x={x0 + (a6 + u6) * sc} y={y2 + 14} anchor="end" color={C.water}>+u = {u6.toFixed(1)}</T>
      <T x={200} y={y2 + 32} anchor="middle">σ′v(3 m) = 54 kPa aynı; K değişince σ′h sıçrar. Su basıncı ayrıca eklenir.</T>
    </Svg>
  );
}

export function EpCoulombWedge() {
  return <WedgeFig label="Coulomb wedge and force polygon" kh={0} />;
}
export function EpSeismicWedge() {
  return <WedgeFig label="Pseudo-static wedge and force polygon" kh={0.2} />;
}

function WedgeFig({ label, kh }: { label: string; kh: number }) {
  const phi = 30, delta = 20, rho = 60, h = 150, y2 = 215, y1 = y2 - h, x0 = 68;
  const cx = x0 + h / Math.tan(rad(rho));
  const pd = [Math.cos(rad(delta)), -Math.sin(rad(delta))];
  const d = [Math.cos(rad(rho)), -Math.sin(rad(rho))], n = [-Math.sin(rad(rho)), -Math.cos(rad(rho))];
  const rd = [Math.cos(rad(phi)) * n[0] + Math.sin(rad(phi)) * d[0], Math.cos(rad(phi)) * n[1] + Math.sin(rad(phi)) * d[1]];
  const F = [-kh * 100, 100]; // W plus horizontal inertia (toward wall)
  // Solve P*pd + R*rd = -F
  const det = pd[0] * rd[1] - pd[1] * rd[0];
  const P = (-F[0] * rd[1] + F[1] * rd[0]) / det, R = (pd[0] * -F[1] + pd[1] * F[0]) / det;
  const o = [305, 70];
  const a = [o[0], o[1]], b = [o[0] + F[0], o[1] + F[1]];
  const c2 = [b[0] + P * pd[0], b[1] + P * pd[1]];
  return (
    <Svg label={label}>
      <Arrow />
      <Wall x={x0} y1={y1} y2={y2} />
      <polygon points={`${x0},${y1} ${x0},${y2} ${cx},${y1}`} fill={C.d} opacity={0.3} stroke={C.d} />
      <line x1={x0} y1={y2} x2={cx + 50} y2={y2 - (cx + 50 - x0) * Math.tan(rad(rho))} stroke={C.b} strokeWidth={2} />
      <T x={cx + 54} y={y1 - 6} color={C.b}>kayma yüzeyi</T><T x={x0 + 26} y={y2 - 14}>ρ</T>
      <Line x1={x0 + 50} y1={y1 + 20} x2={x0 + 50} y2={y1 + 62} arrow /><T x={x0 + 54} y={y1 + 52}>W</T>
      {kh > 0 && <><Line x1={x0 + 80} y1={y1 + 40} x2={x0 + 40} y2={y1 + 40} arrow color={C.d} /><T x={x0 + 84} y={y1 + 44} color={C.d}>kh·W</T></>}
      <Line x1={x0 + 44} y1={y2 - 96} x2={x0 + 5} y2={y2 - 82} arrow color={C.b} /><T x={x0 + 48} y={y2 - 96} color={C.b}>P (δ = 20°)</T>
      <Line x1={x0 + 52} y1={y2 - 18} x2={x0 + 30} y2={y2 - 56} arrow color={C.c} /><T x={x0 + 56} y={y2 - 14} color={C.c}>R (φ = 30°)</T>
      <polygon points={`${a[0]},${a[1]} ${b[0]},${b[1]} ${c2[0]},${c2[1]}`} fill="none" stroke="currentColor" strokeWidth={1.5} />
      <Line x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} arrow w={2} />
      <Line x1={b[0]} y1={b[1]} x2={c2[0]} y2={c2[1]} arrow w={2} color={C.b} />
      <Line x1={c2[0]} y1={c2[1]} x2={a[0]} y2={a[1]} arrow w={2} color={C.c} />
      <T x={b[0] - 6} y={(a[1] + b[1]) / 2} anchor="end">{kh > 0 ? "W + kh·W" : "W"}</T>
      <T x={(b[0] + c2[0]) / 2 + 6} y={(b[1] + c2[1]) / 2 + 12} color={C.b}>P{kh > 0 ? "AE" : "A"} = {(P / 100).toFixed(2)}W</T>
      <T x={(c2[0] + a[0]) / 2 + 8} y={(c2[1] + a[1]) / 2 + 2} color={C.c}>R = {(R / 100).toFixed(2)}W</T>
      <T x={300} y={y2 + 30} anchor="middle">kuvvet çokgeni kapanır: W + P + R = 0</T>
    </Svg>
  );
}

export function EpWallForces() {
  return (
    <Svg label="Forces and lever arms on a gravity wall">
      <Arrow />
      <rect x={20} y={215} width={360} height={20} fill={C.soil} opacity={0.6} />
      <rect x={120} y={70} width={110} height={145} fill={C.wall} opacity={0.8} />
      <rect x={230} y={70} width={150} height={145} fill={C.soil} opacity={0.35} />
      <circle cx={120} cy={215} r={4} fill="currentColor" /><T x={108} y={232} anchor="end">uç (O)</T>
      <Line x1={175} y1={140} x2={175} y2={190} arrow w={2.5} /><T x={181} y={190}>W</T>
      <Line x1={315} y1={167} x2={233} y2={167} arrow w={2.5} color={C.b} /><T x={318} y={171} color={C.b}>Pa</T>
      <Line x1={120} y1={240} x2={175} y2={240} /><T x={147} y={252} anchor="middle">aW</T>
      <Line x1={250} y1={215} x2={250} y2={167} dash="3 3" /><T x={256} y={196}>aP = H/3</T>
      <Line x1={120} y1={60} x2={230} y2={60} /><T x={175} y={54} anchor="middle">B</T>
      <T x={30} y={90}>M_R = W·aW</T><T x={30} y={104} color={C.b}>M_O = Pa·aP</T><T x={30} y={118}>FS = M_R / M_O</T>
      <T x={30} y={138}>FS_kayma = ΣV tan δb / ΣH</T><T x={30} y={152}>e = B/2 − (M_R − M_O)/ΣV</T>
    </Svg>
  );
}
