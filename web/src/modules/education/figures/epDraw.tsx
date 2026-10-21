import type { ReactNode } from "react";
import { Ang, Chart, Concrete, type Ctx, Dim, Fig, Force, K, Ln, Poly, Soil, Tx, WaterLevel, linspace, pt } from "./kit";

const rad = (d: number) => (d * Math.PI) / 180;
const f2 = (v: number) => v.toFixed(2).replace(".", ",");
const f1 = (v: number) => v.toFixed(1).replace(".", ",");

/* Active and passive states with their failure wedges. */
export function EpActivePassive() {
  const phi = 30, x = 310, top = 70, base = 350, exc = 210;
  const ta = Math.tan(rad(45 + phi / 2)), tp = Math.tan(rad(45 - phi / 2));
  return (
    <Fig label="Active and passive earth pressure on a wall">
      {(c) => (
        <>
          <Soil x={x} y={top} w={310} h={base - top} c={c} />
          <Soil x={20} y={exc} w={x - 20} h={base - exc} c={c} />
          <Concrete x={x - 10} y={top - 20} w={10} h={base - top + 20} c={c} />
          <Ln x1={x} y1={base} x2={x + (base - top) / ta} y2={top} c={K.red} w={2} d="7 4" />
          <Ln x1={x - 10} y1={base} x2={x - 10 - (base - exc) / tp} y2={exc} c={K.blue} w={2} d="7 4" />
          <Tx x={x + 150} y={top + 70} c={K.red}>aktif kama: 45° + φ/2</Tx>
          <Tx x={36} y={exc + 56} c={K.blue}>pasif kama: 45° − φ/2</Tx>
          <Poly pts={[[x, top], [x, base], [x + 120, base]]} fill={K.red} />
          {[110, 170, 230, 290].map((y) => <Ln key={y} x1={x + 120 * ((y - top) / (base - top))} y1={y} x2={x + 3} y2={y} c={K.red} w={1.6} end={c.arrow(K.red)} />)}
          <Tx x={x + 126} y={base - 6} c={K.red} b>σa = Ka·σ′v</Tx>
          <Poly pts={[[x - 10, exc], [x - 10, base], [x - 190, base]]} fill={K.blue} />
          {[250, 290, 330].map((y) => <Ln key={y} x1={x - 10 - 180 * ((y - exc) / (base - exc))} y1={y} x2={x - 13} y2={y} c={K.blue} w={1.6} end={c.arrow(K.blue)} />)}
          <Tx x={x - 192} y={base - 6} c={K.blue} b a="end">σp = Kp·σ′v</Tx>
          <Force x1={x - 6} y1={top - 38} x2={x - 40} y2={top - 38} c={K.red} arrow={c.arrow} w={2.5} />
          <Tx x={x - 46} y={top - 34} c={K.red} a="end">duvar uzaklaşır → aktif</Tx>
          <Force x1={60} y1={exc - 22} x2={100} y2={exc - 22} c={K.blue} arrow={c.arrow} w={2.5} />
          <Tx x={106} y={exc - 18} c={K.blue}>duvar itilirse → pasif</Tx>
          <Tx x={x + 300} y={top + 24} a="end" b>tutulan zemin</Tx>
          <Tx x={30} y={exc + 22} a="start" b>kazı tarafı</Tx>
        </>
      )}
    </Fig>
  );
}

export function EpStatesMovement() {
  const phi = 30, ka = Math.tan(rad(45 - phi / 2)) ** 2, kp = Math.tan(rad(45 + phi / 2)) ** 2, k0 = 1 - Math.sin(rad(phi));
  const away = (v: number) => ka + (k0 - ka) * Math.exp(-v / 0.2);
  const toward = (v: number) => k0 + (kp - k0) * (1 - Math.exp(-Math.abs(v) / 1.5));
  return (
    <Chart
      label="Lateral earth pressure coefficient versus wall movement" xr={[-5, 1]} yr={[0, 3.5]} xl="duvar hareketi (% H):  zemine doğru ←   → zeminden uzağa" yl="K = σ′h / σ′v" xt={[-5, -4, -3, -2, -1, 0, 1]} yt={[0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5]}
      series={[{ pts: [...linspace(-5, 0, 50).map((v) => [v, toward(v)] as [number, number]), ...linspace(0, 1, 40).map((v) => [v, away(v)] as [number, number])], c: K.blue }]}
      extra={(sx, sy) => (
        <g>
          {[[kp, "Kp = 3,00 pasif (büyük hareket gerekir)"], [k0, "K0 = 0,50 sükunet (hareket yok)"], [ka, "Ka = 0,33 aktif (küçük hareket yeter)"]].map(([k, l]) => (
            <g key={l as string}>
              <Ln x1={sx(-5)} y1={sy(k as number)} x2={sx(1)} y2={sy(k as number)} c={K.mut} w={1} d="5 4" />
              <Tx x={sx(-4.9)} y={sy(k as number) + (k === ka ? 18 : -7)} c={K.ink}>{l as string}</Tx>
            </g>
          ))}
          <circle cx={sx(0)} cy={sy(k0)} r={6} fill={K.red} /><Tx x={sx(0) + 10} y={sy(k0) + 20} c={K.red} b>başlangıç</Tx>
          <Tx x={sx(-2.4)} y={sy(2.2)} c={K.orange}>φ = 30° için örnek eğri (şematik)</Tx>
        </g>
      )}
    />
  );
}

export function EpKaPhi() {
  const ph = linspace(15, 45, 30);
  return (
    <Chart
      label="Ka, K0 and Kp versus friction angle" xr={[15, 45]} yr={[0, 6]} xl="içsel sürtünme açısı φ′ (°)" yl="K"
      series={[
        { pts: ph.map((p) => [p, Math.tan(rad(45 + p / 2)) ** 2]), c: K.red, label: "Kp = tan²(45° + φ/2)" },
        { pts: ph.map((p) => [p, 1 - Math.sin(rad(p))]), c: K.green, label: "K0 = 1 − sin φ" },
        { pts: ph.map((p) => [p, Math.tan(rad(45 - p / 2)) ** 2]), c: K.blue, label: "Ka = tan²(45° − φ/2)" },
      ]}
      extra={(sx, sy) => <g><circle cx={sx(30)} cy={sy(1 / 3)} r={5} fill={K.blue} /><Tx x={sx(30) + 8} y={sy(1 / 3) - 8}>φ=30°: Ka = 0,33</Tx><circle cx={sx(30)} cy={sy(3)} r={5} fill={K.red} /><Tx x={sx(30) - 8} y={sy(3) - 8} a="end">φ=30°: Kp = 3,00</Tx></g>}
    />
  );
}

export function EpMohrRankine() {
  const s = 1.55, X = (v: number) => 70 + v * s, Y = (v: number) => 330 - v * s, phi = 30, tphi = Math.tan(rad(phi));
  return (
    <Fig label="Mohr circles at active and passive failure">
      {() => (
        <>
          <Ln x1={X(0)} y1={Y(0)} x2={X(330)} y2={Y(0)} w={1.8} /><Ln x1={X(0)} y1={Y(0)} x2={X(0)} y2={Y(190)} w={1.8} />
          <Tx x={X(330)} y={Y(0) + 56} a="end" b>σ′ (kPa)</Tx><Tx x={X(0) + 8} y={Y(190) + 6} b>τ (kPa)</Tx>
          <Ln x1={X(0)} y1={Y(0)} x2={X(330)} y2={Y(330 * tphi)} c={K.orange} w={2.6} />
          <Tx x={X(235)} y={Y(235 * tphi) - 14} c={K.orange} b>kırılma zarfı  τ = σ′ tan φ′</Tx>
          <Tx x={X(235)} y={Y(235 * tphi) + 4} c={K.orange}>(c′ = 0, φ′ = 30°)</Tx>
          <circle cx={X(200 / 3)} cy={Y(0)} r={(100 / 3) * s} fill={K.blue} fillOpacity={0.15} stroke={K.blue} strokeWidth={2.4} />
          <circle cx={X(200)} cy={Y(0)} r={100 * s} fill={K.red} fillOpacity={0.08} stroke={K.red} strokeWidth={2.4} />
          {[[100 / 3, "σh,a", "33,3"], [100, "σv", "100"], [300, "σh,p", "300"]].map(([v, n, val]) => (
            <g key={n as string}><Ln x1={X(v as number)} y1={Y(0) - 5} x2={X(v as number)} y2={Y(0) + 5} w={2} /><Tx x={X(v as number)} y={Y(0) + 20} a="middle" b>{n as string}</Tx><Tx x={X(v as number)} y={Y(0) + 34} a="middle">{val as string}</Tx></g>
          ))}
          <Tx x={X(66.7)} y={Y(52)} a="middle" c={K.blue} b>aktif</Tx><Tx x={X(200)} y={Y(40)} a="middle" c={K.red} b>pasif</Tx>
          <Ln x1={X(200 / 3)} y1={Y(0)} x2={X(200 / 3) + (100 / 3) * s * Math.cos(rad(120))} y2={Y(0) - (100 / 3) * s * Math.sin(rad(120))} c={K.blue} w={1.4} />
          <circle cx={X(200 / 3) + (100 / 3) * s * Math.cos(rad(120))} cy={Y(0) - (100 / 3) * s * Math.sin(rad(120))} r={4} fill={K.blue} />
          <Ang x={X(200 / 3)} y={Y(0)} r={26} from={0} to={120} c={K.blue} /><Tx x={X(70)} y={Y(88)} c={K.blue} s={13}>2θ = 90° + φ′</Tx>
          <Tx x={X(0) + 14} y={Y(160)} a="start">Daire zarfa teğet olduğunda zemin kırılır.</Tx>
          <Tx x={X(0) + 14} y={Y(160) + 18} a="start">Aynı σv için iki sınır: σh = Ka·σv ve σh = Kp·σv.</Tx>
        </>
      )}
    </Fig>
  );
}

/* Active pressure diagram for H = 5 m, γ = 18, φ = 30°, q = 10 kPa (the worked example). */
export function EpRankineDiagram() {
  const m = 44, top = 80, base = top + 5 * m, x0 = 150, sc = 6.2, ka = 1 / 3;
  const s1 = ka * 10, s2 = ka * (10 + 18 * 5);
  return (
    <Fig label="Rankine active pressure diagram with surcharge">
      {(c) => (
        <>
          <Soil x={x0} y={top} w={470} h={base - top} c={c} />
          <Concrete x={x0 - 12} y={top - 10} w={12} h={base - top + 10} c={c} />
          {[200, 280, 360, 440].map((x) => <Ln key={x} x1={x} y1={top - 38} x2={x} y2={top - 3} c={K.blue} w={2} end={c.arrow(K.blue)} />)}
          <Ln x1={190} y1={top - 40} x2={470} y2={top - 40} c={K.blue} w={1.2} />
          <Tx x={480} y={top - 30} c={K.blue} b>q = 10 kPa</Tx>
          <Poly pts={[[x0, top], [x0 + s1 * sc, top], [x0 + s1 * sc, base], [x0, base]]} fill={K.blue} o={0.35} />
          <Poly pts={[[x0 + s1 * sc, top], [x0 + s2 * sc, base], [x0 + s1 * sc, base]]} fill={K.orange} o={0.4} />
          <polyline points={`${x0},${top} ${x0 + s1 * sc},${top} ${x0 + s2 * sc},${base}`} fill="none" stroke={K.ink} strokeWidth={1.8} />
          {[top + 40, top + 90, top + 140, top + 190].map((y) => { const w = s1 * sc + (s2 - s1) * sc * ((y - top) / (base - top)); return <Ln key={y} x1={x0 + w} y1={y} x2={x0 + 3} y2={y} c={K.ink} w={1} end={c.arrow(K.ink)} />; })}
          <Tx x={x0 + s1 * sc + 8} y={top + 14} b>{f2(s1)} kPa = Ka·q</Tx>
          <Tx x={x0 + s2 * sc + 6} y={base + 4} b>{f2(s2)} kPa</Tx>
          <Tx x={x0 + 12} y={top + 100} c={K.blue} b>P₁ = 16,67</Tx><Tx x={x0 + 12} y={top + 116} c={K.blue}>(z = 2,50 m)</Tx>
          <Tx x={x0 + 70} y={top + 170} c={K.orange} b>P₂ = 75,0</Tx><Tx x={x0 + 70} y={top + 186} c={K.orange}>(z = 1,67 m)</Tx>
          <Force x1={x0 + 340} y1={base - 1.818 * m} x2={x0 + 3} y2={base - 1.818 * m} c={K.red} arrow={c.arrow} w={4} />
          <Tx x={x0 + 346} y={base - 1.818 * m + 5} c={K.red} b>Pa = 91,67 kN/m</Tx>
          <Dim x1={96} y1={top} x2={96} y2={base} label="H = 5 m" off={10} />
          <Dim x1={122} y1={base} x2={122} y2={base - 1.818 * m} label="z̄ = 1,82" off={8} />
          <Tx x={x0 + 8} y={base + 44}>γ = 18 kN/m³, φ′ = 30°, c′ = 0 ⇒ Ka = 1/3</Tx>
          <Tx x={x0 + 8} y={base + 62}>Pa = P₁ + P₂ = 16,67 + 75,0 = 91,67 kN/m</Tx>
        </>
      )}
    </Fig>
  );
}

export function EpCohesiveCrack() {
  const ka = Math.tan(rad(35)) ** 2, cc = 10, g = 18, Hh = 6, m = 38, top = 70, base = top + Hh * m, x0 = 250, sc = 4.2;
  const z0 = (2 * cc) / (g * Math.sqrt(ka)), neg = 2 * cc * Math.sqrt(ka), bot = ka * g * Hh - neg, yc = top + z0 * m, Pa = 0.5 * bot * (Hh - z0), ya = base - ((Hh - z0) / 3) * m;
  return (
    <Fig label="Active pressure in cohesive soil with tension crack">
      {(c) => (
        <>
          <Soil x={x0} y={top} w={360} h={base - top} c={c} />
          <Concrete x={x0 - 12} y={top - 10} w={12} h={base - top + 10} c={c} />
          <rect x={x0} y={top} width={18} height={yc - top} fill={K.bg} stroke={K.red} strokeDasharray="5 3" />
          <Tx x={x0 + 26} y={top + 16} c={K.red} b>çekme çatlağı  z₀ = {f2(z0)} m</Tx>
          <Tx x={x0 + 26} y={top + 32} c={K.red}>(basınç aktarılamaz, program bu bölgeyi sıfırlar)</Tx>
          <Poly pts={[[x0 - 12, top], [x0 - 12 - neg * sc, top], [x0 - 12, yc]]} fill={K.red} o={0.12} d="5 3" />
          <Tx x={x0 - 18 - neg * sc} y={top + 14} a="end" c={K.red}>−2c′√Ka = −{f1(neg)} kPa</Tx>
          <Poly pts={[[x0, yc], [x0 + bot * sc, base], [x0, base]]} fill={K.orange} o={0.4} />
          <polyline points={`${x0},${yc} ${x0 + bot * sc},${base}`} stroke={K.ink} strokeWidth={1.8} fill="none" />
          <Tx x={x0 + bot * sc + 6} y={base + 4} b>{f1(bot)} kPa</Tx>
          <Force x1={x0 + 230} y1={ya} x2={x0 + 3} y2={ya} c={K.red} arrow={c.arrow} w={4} />
          <Tx x={x0 + 236} y={ya + 5} c={K.red} b>Pa = {f1(Pa)} kN/m</Tx>
          <Dim x1={96} y1={top} x2={96} y2={base} label="H = 6 m" off={10} />
          <Dim x1={x0 - 40} y1={yc} x2={x0 - 40} y2={base} label={`H − z₀ = ${f2(Hh - z0)}`} off={8} />
          <Tx x={20} y={base + 44}>γ = 18 kN/m³, φ′ = 20°, c′ = 10 kPa ⇒ Ka = {f2(ka)},  z₀ = 2c′ / (γ√Ka) = {f2(z0)} m</Tx>
          <Tx x={20} y={base + 62}>σh(taban) = Ka·γ·H − 2c′√Ka = {f1(ka * g * Hh)} − {f1(neg)} = {f1(bot)} kPa,   Pa = ½·{f1(bot)}·{f2(Hh - z0)}</Tx>
        </>
      )}
    </Fig>
  );
}

export function EpLayeredWater() {
  const m = 40, top = 60, mid = top + 3 * m, base = top + 6 * m, x0 = 150, sc = 5.2;
  const k1 = 1 / 3, k2 = Math.tan(rad(33)) ** 2, s3 = 54, a1 = k1 * s3, a2 = k2 * s3, sv6 = s3 + (20 - 9.81) * 3, a6 = k2 * sv6, u6 = 9.81 * 3;
  return (
    <Fig label="Layered soil with water table: effective pressure and water pressure">
      {(c) => (
        <>
          <Soil x={x0} y={top} w={470} h={3 * m} c={c} />
          <rect x={x0} y={mid} width={470} height={3 * m} fill={c.soil} stroke={K.soilLine} />
          <rect x={x0} y={mid} width={470} height={3 * m} fill={K.water} opacity={0.18} />
          <Concrete x={x0 - 12} y={top - 10} w={12} h={base - top + 10} c={c} />
          <WaterLevel x={x0 + 2} y={mid} len={468} label="su tablası (3 m)" />
          <Tx x={x0 + 250} y={top + 24} b>Tabaka 1: γ = 18, φ′ = 30°</Tx><Tx x={x0 + 250} y={top + 42}>K = tan²(30°) = 0,333</Tx>
          <Tx x={x0 + 250} y={mid + 70} b>Tabaka 2: γsat = 20, φ′ = 24°</Tx><Tx x={x0 + 250} y={mid + 88}>K = tan²(33°) = {f2(k2)}</Tx>
          <Poly pts={[[x0, top], [x0 + a1 * sc, mid], [x0 + a2 * sc, mid], [x0 + a6 * sc, base], [x0, base]]} fill={K.blue} o={0.35} />
          <Poly pts={[[x0 + a6 * sc, mid], [x0 + (a6 + u6) * sc, base], [x0 + a6 * sc, base]]} fill={K.water} o={0.55} />
          <Tx x={x0 + a1 * sc + 6} y={mid - 24} b>{f1(a1)} kPa</Tx>
          <Tx x={x0 + a2 * sc + 6} y={mid + 14} b c={K.blue}>{f1(a2)} kPa</Tx>
          <Tx x={x0 + a6 * sc - 4} y={base + 16} a="end" b c={K.blue}>σ′h = {f1(a6)}</Tx>
          <Tx x={x0 + (a6 + u6) * sc + 4} y={base + 16} b c={K.water}>+ u = {f1(u6)}</Tx>
          <Tx x={x0 + a2 * sc + 6} y={mid + 34} c={K.ink}>← K değişti: sıçrama</Tx>
          <Dim x1={96} y1={top} x2={96} y2={mid} label="3 m" off={10} /><Dim x1={96} y1={mid} x2={96} y2={base} label="3 m" off={10} />
          <Tx x={20} y={base + 44}>σ′v(3 m) = 18·3 = 54 kPa her iki tarafta aynıdır; K değiştiği için σ′h = 18,0 → 22,8 sıçrar.</Tx>
          <Tx x={20} y={base + 62}>σ′v(6 m) = 54 + (20 − 9,81)·3 = 84,6 kPa;  su basıncı u = 9,81·3 = 29,4 kPa ayrıca eklenir.</Tx>
        </>
      )}
    </Fig>
  );
}

/* Coulomb (kh = 0) and pseudo-static (kh > 0) wedge with the closed force polygon. */
function WedgeFig({ label, kh }: { label: string; kh: number }) {
  const phi = 30, delta = 20, rho = 60, wx = 90, top = 110, base = 330, hpx = base - top;
  const cx = wx + hpx / Math.tan(rad(rho));
  const pd = [Math.cos(rad(delta)), -Math.sin(rad(delta))];
  const d = [Math.cos(rad(rho)), -Math.sin(rad(rho))], n = [-Math.sin(rad(rho)), -Math.cos(rad(rho))];
  const rd = [Math.cos(rad(phi)) * n[0] + Math.sin(rad(phi)) * d[0], Math.cos(rad(phi)) * n[1] + Math.sin(rad(phi)) * d[1]];
  const F = [-kh * 100, 100];
  const det = pd[0] * rd[1] - pd[1] * rd[0];
  const P = (-F[0] * rd[1] + F[1] * rd[0]) / det, R = (pd[0] * -F[1] + pd[1] * F[0]) / det;
  const o = [460, 90], sc = 1.9, A = o, B = [o[0] + F[0] * sc, o[1] + F[1] * sc], Cc = [B[0] + P * pd[0] * sc, B[1] + P * pd[1] * sc];
  const mid = [(wx + cx) / 2, (base + top) / 2];
  return (
    <Fig label={label}>
      {(c) => (
        <>
          <Soil x={wx} y={top - 30} w={cx - wx + 90} h={base - top + 60} c={c} />
          <Concrete x={wx - 12} y={top - 30} w={12} h={base - top + 60} c={c} />
          <Poly pts={[[wx, top], [wx, base], [cx, top]]} fill={K.orange} o={0.3} stroke={K.orange} />
          <Ln x1={wx} y1={base} x2={cx + 60} y2={base - (cx + 60 - wx) * Math.tan(rad(rho))} c={K.red} w={2.6} />
          <Tx x={cx + 44} y={top - 36} c={K.red} b>kayma yüzeyi (ρ)</Tx>
          <Ang x={wx} y={base} r={44} from={0} to={rho} label="ρ" c={K.red} />
          <Force x1={wx + 52} y1={top + 40} x2={wx + 52} y2={top + 105} c={K.ink} arrow={c.arrow} label="W" lx={wx + 36} ly={top + 80} a="end" />
          {kh > 0 && <Force x1={wx + 130} y1={top + 22} x2={wx + 62} y2={top + 22} c={K.violet} arrow={c.arrow} label="kh·W" lx={wx + 136} ly={top + 26} />}
          <Force x1={wx + 2} y1={mid[1] + 46} x2={wx + 2 + 52 * pd[0]} y2={mid[1] + 46 + 52 * pd[1]} c={K.blue} arrow={c.arrow} label={kh > 0 ? "P_AE" : "P_A"} lx={wx + 6} ly={mid[1] + 82} />
          <Force x1={mid[0] - 70 * rd[0]} y1={mid[1] - 70 * rd[1]} x2={mid[0]} y2={mid[1]} c={K.green} arrow={c.arrow} label="R" lx={mid[0] - 70 * rd[0] + 8} ly={mid[1] - 70 * rd[1] + 16} />
          <Ln x1={mid[0]} y1={mid[1]} x2={mid[0] - 62 * n[0]} y2={mid[1] - 62 * n[1]} c={K.mut} w={1.2} d="4 3" />
                    <Ang x={mid[0]} y={mid[1]} r={30} from={300} to={330} label="φ" c={K.green} />
          <Ang x={wx} y={mid[1] + 46} r={30} from={0} to={delta} label="δ" c={K.blue} />
          <Dim x1={40} y1={top} x2={40} y2={base} label="H" off={8} />
          <polygon points={`${A[0]},${A[1]} ${B[0]},${B[1]} ${Cc[0]},${Cc[1]}`} fill={K.blue} fillOpacity={0.08} stroke="none" />
          <Force x1={A[0]} y1={A[1]} x2={B[0]} y2={B[1]} c={K.ink} arrow={c.arrow} w={3.5} label={kh > 0 ? "W + kh·W (bileşke)" : "W"} lx={B[0] - 10} ly={(A[1] + B[1]) / 2} a="end" />
          <Force x1={B[0]} y1={B[1]} x2={Cc[0]} y2={Cc[1]} c={K.blue} arrow={c.arrow} w={3.5} label={`${kh > 0 ? "P_AE" : "P_A"} = ${f2(P / 100)} W`} lx={(B[0] + Cc[0]) / 2 + 8} ly={(B[1] + Cc[1]) / 2 + 16} />
          <Force x1={Cc[0]} y1={Cc[1]} x2={A[0]} y2={A[1]} c={K.green} arrow={c.arrow} w={3.5} label={`R = ${f2(R / 100)} W`} lx={(Cc[0] + A[0]) / 2 + 10} ly={(Cc[1] + A[1]) / 2} />
          <Tx x={A[0] - 20} y={A[1] - 24} b>Kuvvet çokgeni (kapanır)</Tx>
          <Tx x={20} y={base + 68} a="start">P = W·sin(ρ − φ) / cos(ρ − φ − δ)</Tx>
          <Tx x={20} y={base + 48} a="start" c={K.mut}>{kh > 0 ? "kh = 0,20" : "φ = 30°, δ = 20°, ρ = 60°"}</Tx>
        </>
      )}
    </Fig>
  );
}
export const EpCoulombWedge = () => <WedgeFig label="Coulomb wedge and force polygon" kh={0} />;
export const EpSeismicWedge = () => <WedgeFig label="Pseudo-static wedge and force polygon" kh={0.2} />;

export function EpWallForces() {
  const m = 56, top = 76, base = top + 4 * m, xl = 130, B = 2.5 * m, Hh = 4 * m;
  return (
    <Fig label="Forces and lever arms on a gravity wall">
      {(c) => (
        <>
          <Soil x={xl + B} y={top} w={640 - xl - B - 10} h={Hh} c={c} />
          <Soil x={20} y={base} w={600} h={40} c={c} />
          <Concrete x={xl} y={top} w={B} h={Hh} c={c} />
          <circle cx={xl} cy={base} r={6} fill={K.red} /><Tx x={xl - 10} y={base + 22} a="end" c={K.red} b>O (uç)</Tx>
          <Force x1={xl + B / 2} y1={top + 40} x2={xl + B / 2} y2={top + 130} c={K.ink} arrow={c.arrow} label="W = 240 kN/m" lx={xl + B / 2 + 8} ly={top + 70} />
          <Poly pts={[[xl + B, top], [xl + B, base], [xl + B + 96, base]]} fill={K.orange} o={0.35} />
          <Force x1={xl + B + 190} y1={base - Hh / 3} x2={xl + B + 4} y2={base - Hh / 3} c={K.red} arrow={c.arrow} w={4} label="Pa = 48 kN/m" lx={xl + B + 196} ly={base - Hh / 3 + 5} />
          <Dim x1={xl} y1={base + 28} x2={xl + B / 2} y2={base + 28} label="aW = 1,25 m" off={6} />
          <Dim x1={xl + B + 40} y1={base} x2={xl + B + 40} y2={base - Hh / 3} label="aP = H/3 = 1,33 m" off={10} side="right" />
          <Dim x1={xl} y1={top - 14} x2={xl + B} y2={top - 14} label="B = 2,5 m" off={6} />
          <Dim x1={xl - 40} y1={top} x2={xl - 40} y2={base} label="H = 4 m" off={8} />
          <Tx x={380} y={base + 56} b>M_R = W·aW = 300 kN·m/m</Tx>
          <Tx x={380} y={base + 74}>M_O = Pa·aP = 64 kN·m/m</Tx>
          <Tx x={380} y={base + 92} b c={K.green}>FS devrilme = M_R / M_O = 4,69</Tx>
          <Tx x={20} y={30}>Örnek: gravite duvar 2,5 × 4 m, γc = 24, dolgu φ′ = 30°, δ = 0</Tx>
        </>
      )}
    </Fig>
  );
}

export function WallStabilityChecks() {
  const panel = (x0: number, title: string, body: (c: Ctx) => ReactNode, cc: Ctx) => (
    <g>
      <rect x={x0} y={30} width={200} height={348} fill="none" stroke={K.grid} rx={4} />
      <Tx x={x0 + 100} y={50} a="middle" b>{title}</Tx>
      <Soil x={x0 + 110} y={90} w={80} h={190} c={cc} />
      <Soil x={x0 + 10} y={280} w={180} h={24} c={cc} />
      <Concrete x={x0 + 60} y={90} w={50} h={190} c={cc} />
      {body(cc)}
    </g>
  );
  return (
    <Fig label="Retaining wall stability checks">
      {(c) => (
        <>
          {panel(8, "1. Devrilme", (cc) => (<>
            <circle cx={68} cy={280} r={5} fill={K.red} /><Tx x={62} y={298} a="end" c={K.red}>O</Tx>
            <Force x1={85} y1={150} x2={85} y2={210} c={K.ink} arrow={cc.arrow} label="W" lx={91} ly={170} />
            <Force x1={185} y1={247} x2={113} y2={247} c={K.red} arrow={cc.arrow} label="Pa" lx={150} ly={240} />
            <Tx x={108} y={366} a="middle">FS = ΣM_R / ΣM_O</Tx><Tx x={108} y={80} a="middle" c={K.mut}>W·a_W / Pa·a_P</Tx>
          </>), c)}
          {panel(220, "2. Kayma", (cc) => (<>
            <Force x1={285} y1={190} x2={333} y2={190} c={K.ink} arrow={cc.arrow} label="ΣV" lx={290} ly={170} />
            <Force x1={405} y1={190} x2={333} y2={190} c={K.red} arrow={cc.arrow} label="ΣH" lx={370} ly={183} />
            <Force x1={308} y1={282} x2={262} y2={282} c={K.green} arrow={cc.arrow} label="ΣV·tan δb" lx={236} ly={272} />
            <Tx x={320} y={366} a="middle">FS = ΣV·tan δb / ΣH</Tx>
          </>), c)}
          {panel(432, "3. Taban basıncı", (cc) => (<>
            <Poly pts={[[492, 306], [542, 306], [542, 346], [492, 322]]} fill={K.blue} o={0.4} />
            <Tx x={488} y={324} a="end" c={K.blue}>q_min</Tx><Tx x={548} y={350} c={K.blue}>q_max</Tx>
            <Force x1={517} y1={150} x2={517} y2={210} c={K.ink} arrow={cc.arrow} label="ΣV" lx={523} ly={170} />
            <Dim x1={492} y1={262} x2={542} y2={262} label="B" off={4} />
            <Tx x={532} y={80} a="middle" c={K.mut}>e = B/2 − x̄</Tx>
            <Tx x={532} y={366} a="middle">q = ΣV/B · (1 ± 6e/B)</Tx>
          </>), c)}
        </>
      )}
    </Fig>
  );
}
