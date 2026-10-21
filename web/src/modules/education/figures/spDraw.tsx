import type { ReactNode } from "react";
import { Ang, Concrete, Dim, Fig, Force, K, Ln, Poly, Soil, Tx, WaterLevel, linspace, pt, type Ctx } from "./kit";

const rad = (d: number) => (d * Math.PI) / 180;
const f1 = (v: number) => v.toFixed(1).replace(".", ",");
const f2 = (v: number) => v.toFixed(2).replace(".", ",");

/* ───────────── Sheet pile ───────────── */

const SP = { H: 3, g: 18, ka: 1 / 3, kp: 3, D0: 2.778 };
const net = (z: number) => (z <= SP.H ? SP.ka * SP.g * z : SP.ka * SP.g * z - SP.kp * SP.g * (z - SP.H));
function shearMoment(zmax: number) {
  const n = 400, dz = zmax / n, V: number[] = [0], M: number[] = [0];
  for (let i = 1; i <= n; i++) { const z = i * dz; V.push(V[i - 1] + 0.5 * (net(z) + net(z - dz)) * dz); M.push(M[i - 1] + 0.5 * (V[i] + V[i - 1]) * dz); }
  return { V, M, dz };
}

/** Cantilever wall section with active and passive pressure to scale (H = 3 m, γ = 18, φ = 30°, c = 0). */
export function SpCantilever() {
  const s = 42, top = 56, wx = 300, toeZ = SP.H + SP.D0, kp = 0.5; // px per kPa for pressure
  const y = (z: number) => top + z * s;
  const aToe = SP.ka * SP.g * toeZ, pToe = SP.kp * SP.g * SP.D0;
  return (
    <Fig label="Cantilever sheet pile with active and passive pressure">
      {(c) => (
        <>
          <Soil x={wx + 8} y={top} w={310} h={y(toeZ) - top + 30} c={c} />
          <Soil x={20} y={y(SP.H)} w={wx - 12} h={y(toeZ) - y(SP.H) + 30} c={c} />
          <Concrete x={wx - 8} y={top - 20} w={16} h={y(toeZ) - top + 20} c={c} />
          <Poly pts={[[wx + 8, top], [wx + 8 + aToe * kp * 2.2, y(toeZ)], [wx + 8, y(toeZ)]]} fill={K.red} o={0.3} />
          <Poly pts={[[wx - 8, y(SP.H)], [wx - 8 - pToe * kp * 0.55, y(toeZ)], [wx - 8, y(toeZ)]]} fill={K.blue} o={0.3} />
          <Tx x={wx + 14 + aToe * kp * 2.2} y={y(toeZ) - 4} c={K.red} b>σa = Ka·γ·z</Tx>
          <Tx x={wx - 14 - pToe * kp * 0.55} y={y(toeZ) - 6} c={K.blue} b a="end">σp = Kp·γ·(z − H)</Tx>
          <Ln x1={20} y1={y(SP.H)} x2={wx - 8} y2={y(SP.H)} c={K.ink} w={2} />
          <Tx x={30} y={y(SP.H) - 8} b>kazı tabanı</Tx>
          <Dim x1={wx - 70} y1={top} x2={wx - 70} y2={y(SP.H)} label="H" off={8} />
          <Dim x1={wx - 70} y1={y(SP.H)} x2={wx - 70} y2={y(toeZ)} label="D" off={8} />
          <circle cx={wx} cy={y(toeZ)} r={6} fill={K.ink} /><Tx x={wx + 12} y={y(toeZ) + 22}>uç (toe)</Tx>
          <path d={`M${wx} ${top - 20} Q ${wx - 22} ${y(SP.H)} ${wx} ${y(SP.H + 2.2)}`} fill="none" stroke={K.violet} strokeWidth={2} strokeDasharray="6 4" />
          <Tx x={wx - 30} y={y(SP.H + 1.2)} c={K.violet} a="end">eğilme / dönme</Tx>
          <Tx x={20} y={30} b>Konsol palplanş: H = 3 m, γ = 18 kN/m³, φ′ = 30°  (Ka = 1/3, Kp = 3)</Tx>
        </>
      )}
    </Fig>
  );
}

/** Net pressure, shear and moment diagrams on a common depth axis, computed for the cantilever example. */
export function SpNetDiagram() {
  const top = 70, s = 44, zt = SP.H + SP.D0, { V, M, dz } = shearMoment(zt);
  const y = (z: number) => top + z * s;
  const iM = M.indexOf(Math.max(...M));
  const xp = 150, xv = 310, xm = 450;
  const col = (x0: number, vals: number[], scale: number, color: string, label: string) => (
    <g>
      <Ln x1={x0} y1={top - 10} x2={x0} y2={y(zt) + 10} w={1.4} />
      <polyline fill={color} fillOpacity={0.25} stroke={color} strokeWidth={2.2} points={[`${x0},${y(0)}`, ...vals.map((v, i) => `${x0 + v * scale},${y(i * dz)}`), `${x0},${y(zt)}`].join(" ")} />
      <Tx x={x0} y={top - 30} a="middle" b>{label}</Tx>
    </g>
  );
  const pv = linspace(0, zt, 400).map(net);
  return (
    <Fig label="Net pressure, shear and bending moment diagrams">
      {() => (
        <>
          <Ln x1={20} y1={y(SP.H)} x2={620} y2={y(SP.H)} c={K.mut} w={1} d="6 4" /><Tx x={22} y={y(SP.H) - 6} c={K.mut}>kazı tabanı</Tx>
          {col(xp, pv, 0.55, K.red, "net basınç p (kPa)")}
          {col(xv, V, 1.7, K.green, "kesme V (kN/m)")}
          {col(xm, M, 1.1, K.orange, "moment M (kN·m/m)")}
          <circle cx={xp + net(3.375) * 0.55} cy={y(3.375)} r={5} fill={K.ink} /><Tx x={xp + 14} y={y(3.375) + 18}>p = 0  (z = 3,375 m)</Tx>
          <Tx x={xp + 18} y={y(0.9)} c={K.red}>aktif itki</Tx><Tx x={xp + 14} y={y(5.3)} c={K.blue}>pasif (net) ◄</Tx>
          <circle cx={xv} cy={y(iM * dz)} r={5} fill={K.ink} /><Tx x={xv + 8} y={y(iM * dz) + 4}>V = 0</Tx>
          <circle cx={xm + M[iM] * 1.1} cy={y(iM * dz)} r={6} fill={K.red} /><Tx x={xm + M[iM] * 1.1 + 8} y={y(iM * dz) + 18} b c={K.red}>Mmax = {f2(M[iM])}</Tx>
          <Tx x={xm + M[iM] * 1.1 + 8} y={y(iM * dz) + 36} c={K.red}>(z = {f2(iM * dz)} m)</Tx>
          <Ln x1={20} y1={y(zt)} x2={620} y2={y(zt)} c={K.ink} w={1.2} d="3 3" /><Tx x={22} y={y(zt) + 22}>uç: z = H + D₀ = {f2(zt)} m, M ≈ {f1(Math.abs(M[M.length - 1]))} (≈ 0)</Tx>
          <Tx x={20} y={y(zt) + 46} c={K.mut} s={14}>V = ∫p dz, M = ∫V dz; M, V = 0 olan derinlikte en büyüktür.</Tx>
          <Tx x={20} y={y(zt) + 66} c={K.mut} s={14}>H = 3 m, γ = 18 kN/m³, φ′ = 30°</Tx>
        </>
      )}
    </Fig>
  );
}

export function SpPassiveFactor() {
  const s = 40, top = 70, wx = 300, D = 3, kpg = SP.kp * SP.g;
  const y = (z: number) => top + z * s;
  return (
    <Fig label="Passive pressure reduced by a safety factor">
      {(c) => (
        <>
          <Soil x={20} y={y(0)} w={wx - 28} h={D * s + 30} c={c} />
          <Concrete x={wx - 8} y={top - 30} w={16} h={D * s + 30 + 30} c={c} />
          <Soil x={wx + 8} y={top - 30} w={300} h={D * s + 60} c={c} />
          <Ln x1={20} y1={y(0)} x2={wx - 8} y2={y(0)} w={2} /><Tx x={30} y={y(0) - 8} b>kazı tabanı</Tx>
          <Poly pts={[[wx - 8, y(0)], [wx - 8 - kpg * D * 0.5, y(D)], [wx - 8, y(D)]]} fill={K.blue} o={0.2} d="6 3" />
          <Poly pts={[[wx - 8, y(0)], [wx - 8 - (kpg * D * 0.5) / 1.5, y(D)], [wx - 8, y(D)]]} fill={K.orange} o={0.45} />
          <Tx x={wx - 14 - kpg * D * 0.5} y={y(D) + 18} c={K.blue} b>GS = 1: Kp·γ·z</Tx>
          <Tx x={wx - 14} y={y(D) + 38} c={K.orange} b a="end">GS = 1,5: Kp·γ·z / 1,5 (tasarım)</Tx>
          <Poly pts={[[wx + 8, y(0)], [wx + 8 + 70, y(D)], [wx + 8, y(D)]]} fill={K.red} o={0.3} />
          <Tx x={wx + 90} y={y(D) - 4} c={K.red} b>aktif</Tx>
          <Tx x={20} y={30} s={14}>Pasif direnç GS ile bölünür: daha az direnç ⇒ daha derin gömme.</Tx>
          <Tx x={20} y={y(D) + 66} c={K.mut} s={14}>Örnek (H = 5 m, şematik çizim): GS = 1 ⇒ D₀ = 4,63 m;  GS = 1,5 ⇒ D₀ = 6,12 m.</Tx>
        </>
      )}
    </Fig>
  );
}

export function SpwWallTypes() {
  const half = (x0: number, anchored: boolean, c: Ctx) => {
    const wx = x0 + 150, top = 60, dr = 150, toe = 300;
    return (
      <g>
        <Soil x={wx + 8} y={top} w={110} h={toe - top + 20} c={c} />
        <Soil x={x0 + 10} y={dr} w={wx - x0 - 18} h={toe - dr + 20} c={c} />
        <Concrete x={wx - 8} y={top - 16} w={16} h={toe - top + 16} c={c} />
        <Tx x={x0 + 12} y={dr - 8} b>kazı tabanı</Tx>
        <path d={`M${wx} ${top - 16} Q ${wx - (anchored ? 12 : 24)} ${dr} ${wx} ${toe - 40}`} fill="none" stroke={K.violet} strokeWidth={2} strokeDasharray="6 4" />
        {anchored && (<>
          <Ln x1={wx + 8} y1={top + 24} x2={wx + 110} y2={top + 24 + 70} c={K.ink} w={3} />
          <rect x={wx + 80} y={top + 24 + 48} width={36} height={24} fill={K.orange} opacity={0.6} transform={`rotate(32 ${wx + 98} ${top + 24 + 60})`} />
          <circle cx={wx + 8} cy={top + 24} r={5} fill={K.red} /><Tx x={wx + 14} y={top + 16} c={K.red} b>T (ankraj)</Tx>
          <Tx x={wx + 70} y={top + 130} c={K.orange}>ankraj kökü</Tx>
        </>)}
        <circle cx={wx} cy={toe} r={5} fill={K.ink} />
        <Tx x={x0 + 150} y={toe + 38} a="middle" b>{anchored ? "Ankrajlı: tek destek + gömme" : "Konsol: yalnız gömme"}</Tx>
      </g>
    );
  };
  return <Fig label="Cantilever and anchored sheet pile">{(c) => <>{half(10, false, c)}{half(330, true, c)}</>}</Fig>;
}

export function SpAnchoredMoment() {
  const panel = (x0: number, fixed: boolean) => {
    const top = 50, h = 250;
    const mom = (t: number) => (fixed ? Math.sin(t * Math.PI * 1.55) * (t < 0.65 ? 50 : 32) * (t < 0.65 ? 1 : -1) : Math.sin(t * Math.PI) * 62);
    return (
      <g>
        <rect x={x0} y={34} width={290} height={300} fill="none" stroke={K.grid} rx={4} />
        <Tx x={x0 + 145} y={54} a="middle" b>{fixed ? "Sabit uç (fixed earth)" : "Serbest uç (free earth)"}</Tx>
        <Ln x1={x0 + 50} y1={top + 24} x2={x0 + 50} y2={top + h} w={6} c={K.concLine} />
        <circle cx={x0 + 50} cy={top + 40} r={6} fill={K.red} /><Tx x={x0 + 40} y={top + 36} a="end" c={K.red} b>T</Tx>
        <path d={fixed ? `M${x0 + 50} ${top + 24} Q ${x0 + 74} ${top + 110} ${x0 + 50} ${top + 175} Q ${x0 + 34} ${top + 220} ${x0 + 50} ${top + h}` : `M${x0 + 50} ${top + 24} Q ${x0 + 78} ${top + 120} ${x0 + 62} ${top + h}`} fill="none" stroke={K.violet} strokeWidth={2.2} strokeDasharray="6 4" />
        <Ln x1={x0 + 160} y1={top + 24} x2={x0 + 160} y2={top + h} w={1.2} />
        <polyline fill={K.orange} fillOpacity={0.25} stroke={K.orange} strokeWidth={2} points={[`${x0 + 160},${top + 40}`, ...linspace(0.1, 1, 30).map((t) => `${x0 + 160 + mom(t)},${top + 40 + t * (h - 40)}`), `${x0 + 160},${top + h}`].join(" ")} />
        <Tx x={x0 + 160} y={top + 30} a="middle" c={K.orange} b>moment M</Tx>
        <Tx x={x0 + 145} y={top + h + 24} a="middle" s={13}>{fixed ? "uçta eğim sıfır, uç momenti var ⇒ daha derin" : "uçta M = 0 (menteşe) ⇒ daha sığ"}</Tx>
        <Tx x={x0 + 145} y={top + h + 44} a="middle" s={13} c={K.mut}>{fixed ? "program: yok (referans)" : "program: bu yöntem (Blum/serbest zemin)"}</Tx>
      </g>
    );
  };
  return <Fig label="Free earth support versus fixed earth support">{() => <>{panel(20, false)}{panel(330, true)}</>}</Fig>;
}

export function AnchorTieForce() {
  const s = 40, top = 70, wx = 250, H = 4, D = 2;
  const y = (z: number) => top + z * s;
  const za = 0.8;
  return (
    <Fig label="Anchored sheet pile: tie force from moment equilibrium about the pivot">
      {(c) => (
        <>
          <Soil x={wx + 8} y={top} w={330} h={(H + D) * s + 40} c={c} />
          <Soil x={20} y={y(H)} w={wx - 12} h={D * s + 40} c={c} />
          <Concrete x={wx - 8} y={top - 20} w={16} h={(H + D) * s + 20} c={c} />
          <Poly pts={[[wx + 8, top], [wx + 8 + 90, y(H + D)], [wx + 8, y(H + D)]]} fill={K.red} o={0.28} />
          <Poly pts={[[wx - 8, y(H)], [wx - 8 - 70, y(H + D)], [wx - 8, y(H + D)]]} fill={K.blue} o={0.28} />
          <circle cx={wx - 8} cy={y(za)} r={6} fill={K.orange} />
          <Force x1={wx - 8} y1={y(za)} x2={wx - 100} y2={y(za)} c={K.orange} arrow={c.arrow} w={4} label="T (ankraj kuvveti)" lx={wx - 190} ly={y(za) - 10} />
          <Dim x1={wx - 130} y1={y(za)} x2={wx - 130} y2={y(H + D)} label="a" off={8} />
          <circle cx={wx} cy={y(H + D)} r={6} fill={K.ink} /><Tx x={wx + 10} y={y(H + D) + 22}>pivot (uç)</Tx>
          <Ln x1={20} y1={y(H)} x2={wx - 8} y2={y(H)} w={2} /><Tx x={30} y={y(H) - 8} b>kazı tabanı</Tx>
          <Dim x1={wx + 120} y1={top} x2={wx + 120} y2={y(H)} label="H" off={-8} side="right" /><Dim x1={wx + 120} y1={y(H)} x2={wx + 120} y2={y(H + D)} label="D₀" off={-8} side="right" />
          <Tx x={20} y={30} b>Serbest zemin desteği: uç noktası etrafında ΣM = 0 ⇒ T = (Ma − Mp) / a</Tx>
          <Tx x={20} y={y(H + D) + 70} c={K.mut}>Yatay denge: T = Pa − Pp (net itki). Ankraj yükü = T · s / cos θ  (s: ankraj aralığı, θ: eğim).</Tx>
        </>
      )}
    </Fig>
  );
}

/* ───────────── Slope stability ───────────── */

export function SlopeBishopSlice() {
  const O = { x: 290, y: 70 }, R = 230, tg = 0.55;
  const surf = (x: number) => (x <= 130 ? 250 : x >= 330 ? 140 : 250 - (x - 130) * tg);
  const arc = (x: number) => O.y + Math.sqrt(R * R - (x - O.x) ** 2);
  const xs = [190, 240, 290, 340, 390, 440, 490];
  const x1 = 147, x2 = 509;
  return (
    <Fig label="Bishop method: circular slip surface, slices and slice forces" h={470}>
      {(c) => (
        <>
          <polygon points="20,250 130,250 330,140 620,140 620,330 20,330" fill={c.soil} stroke={K.soilLine} />
          <path d={`M${x1} ${arc(x1)} A ${R} ${R} 0 0 0 ${x2} ${arc(x2)}`} fill="none" stroke={K.red} strokeWidth={3.4} />
          <circle cx={O.x} cy={O.y} r={6} fill={K.ink} /><Tx x={O.x + 10} y={O.y + 4} b>O (merkez)</Tx>
          <Ln x1={O.x} y1={O.y} x2={x1 + 30} y2={arc(x1 + 30)} c={K.mut} w={1.5} d="5 4" /><Tx x={190} y={150} c={K.mut} b>R</Tx>
          <Poly pts={[[340, surf(340)], [390, surf(390)], [390, arc(390)], [340, arc(340)]]} fill={K.orange} o={0.35} />
          {xs.map((x) => <Ln key={x} x1={x} y1={surf(x)} x2={x} y2={arc(x)} c={K.ink} w={1} />)}
          <Ln x1={20} y1={235} x2={620} y2={190} c={K.water} w={2.2} d="7 4" /><Tx x={612} y={182} a="end" c={K.water} b>su tablası (u)</Tx>
          <Tx x={20} y={28} b>Dairesel kayma yüzeyi, merkez O, yarıçap R; kütle düşey dilimlere bölünür</Tx>
          <Tx x={20} y={54} c={K.mut} s={13}>Her dilimde: ağırlık W, taban eğimi α, taban uzunluğu l = b / cos α, boşluk suyu basıncı u</Tx>
          {/* detail of one slice */}
          <rect x={20} y={345} width={600} height={115} fill={K.bg} stroke={K.grid} rx={4} />
          <Tx x={30} y={366} b>Seçili dilim (büyütülmüş)</Tx>
          <polygon points="140,380 230,380 230,428 140,448" fill={K.orange} fillOpacity={0.3} stroke={K.ink} strokeWidth={1.6} />
          <Force x1={185} y1={398} x2={185} y2={432} c={K.ink} arrow={c.arrow} w={2.5} label="W" lx={191} ly={418} />
          <Force x1={165} y1={470} x2={162} y2={448} c={K.green} arrow={c.arrow} w={2.5} />
          <Tx x={132} y={462} a="end" c={K.green} s={13}>N′</Tx>
          <Ln x1={140} y1={448} x2={230} y2={428} c={K.red} w={0} />
          <Ln x1={140} y1={448} x2={102} y2={457} c={K.red} w={2.4} end={c.arrow(K.red)} /><Tx x={80} y={455} a="end" c={K.red} s={13}>S</Tx>
          <Ang x={140} y={448} r={44} from={0} to={12} label="α" />
          <Tx x={250} y={380} s={13}>Bishop: dilimler arası düşey kesme kuvvetleri sıfır alınır</Tx>
          <Tx x={250} y={402} s={13}>FS = Σ[(c′b + (W − ub) tanφ′) / mα] / Σ[W sinα]</Tx>
          <Tx x={250} y={424} s={13}>mα = cosα (1 + tanα tanφ′ / FS):  FS iki yanda ⇒ iterasyon</Tx>
          <Tx x={250} y={446} c={K.mut} s={13}>N′: efektif normal kuvvet,  S: mobilize kayma direnci</Tx>
        </>
      )}
    </Fig>
  );
}

export function SlopeSearchDomain() {
  const O = [180, 50];
  return (
    <Fig label="Search grid of circle centres with minimum factor of safety">
      {(c) => (
        <>
          <polygon points="20,250 160,250 320,150 620,150 620,370 20,370" fill={c.soil} stroke={K.soilLine} />
          {Array.from({ length: 5 }).flatMap((_, i) => Array.from({ length: 4 }).map((__, j) => {
            const x = O[0] + i * 46, y = O[1] + j * 30, fs = 1.1 + 0.18 * (Math.abs(i - 2) + Math.abs(j - 1.2)) ;
            const min = i === 2 && j === 1;
            return <g key={`${i}${j}`}><circle cx={x} cy={y} r={min ? 9 : 6} fill={min ? K.red : K.blue} fillOpacity={min ? 1 : 0.55} /><Tx x={x} y={y - 12} a="middle" s={11} c={min ? K.red : K.mut}>{f2(min ? 1.12 : fs)}</Tx></g>;
          }))}
          <path d="M140 250 A 215 215 0 0 0 475 150" fill="none" stroke={K.red} strokeWidth={3.4} /><Ln x1={272} y1={80} x2={140} y2={250} c={K.red} w={1.2} d="5 4" /><Ln x1={272} y1={80} x2={475} y2={150} c={K.red} w={1.2} d="5 4" />
          <Tx x={20} y={16} b>Merkez ızgarası: her merkezden en küçük FS'li daire bulunur</Tx>
          <Tx x={20} y={392} c={K.mut}>Kırmızı nokta: en küçük FS (kritik daire); sayılar şematik FS değerleridir.</Tx>
        </>
      )}
    </Fig>
  );
}

/* ───────────── Surcharge / sloping ground / shear key ───────────── */

export function SlopeSurchargeWedge() {
  const b = 18, wx = 120, top = 210, base = 330;
  const surfY = (x: number) => top - (x - wx) * Math.tan(rad(b));
  return (
    <Fig label="Retaining wall with sloping backfill and surcharge">
      {(c) => (
        <>
          <polygon points={`${wx},${top} 620,${surfY(620)} 620,${base} ${wx},${base}`} fill={c.soil} stroke={K.soilLine} />
          <Concrete x={wx - 14} y={top - 10} w={14} h={base - top + 10} c={c} />
          {[200, 280, 360, 440, 520].map((x) => <Ln key={x} x1={x} y1={surfY(x) - 42} x2={x} y2={surfY(x) - 4} c={K.blue} w={2.2} end={c.arrow(K.blue)} />)}
          <Tx x={200} y={surfY(200) - 52} c={K.blue} b>q (üniform sürşarj)</Tx>
          <Ln x1={wx} y1={top} x2={wx + 160} y2={top} c={K.mut} w={1.2} d="4 3" /><Ang x={wx} y={top} r={90} from={0} to={b} label="β" c={K.ink} />
          <Poly pts={[[wx, top], [wx, base], [wx + 200, surfY(wx + 200)]]} fill={K.orange} o={0.25} />
          <Ln x1={wx} y1={base} x2={wx + 250} y2={base - 250 * Math.tan(rad(60))} c={K.red} w={2.6} />
          <Force x1={wx + 130} y1={base - 40} x2={wx + 3} y2={base - 40} c={K.red} arrow={c.arrow} w={4} label="Pa" lx={wx + 136} ly={base - 34} />
          <Tx x={30} y={28} b>Eğimli dolgu (β) ve sürşarj (q) birlikte kamaya yük ekler</Tx>
          <Tx x={30} y={base + 28}>Rankine-β: Ka = cos β (cos β − √(cos²β − cos²φ′)) / (cos β + √(cos²β − cos²φ′))</Tx>
          <Tx x={30} y={base + 48}>φ′ = 30° için Ka: β = 0° ⇒ 0,3333;  β = 10° ⇒ 0,3495;  β = 20° ⇒ 0,4142  (β ≤ φ′ şart)</Tx>
        </>
      )}
    </Fig>
  );
}

export function ShearKeyPlanes() {
  const bx = 150, by = 170, Bw = 240, kd = 44;
  return (
    <Fig label="Retaining wall with a shear key: two candidate sliding planes">
      {(c) => (
        <>
          <Soil x={30} y={by + 20} w={580} h={130} c={c} />
          <Soil x={bx + Bw} y={60} w={610 - bx - Bw} h={by - 40} c={c} />
          <Concrete x={bx + Bw - 40} y={60} w={40} h={by - 60 + 0} c={c} />
          <Concrete x={bx} y={by} w={Bw} h={20} c={c} />
          <Concrete x={bx + 14} y={by + 20} w={34} h={kd} c={c} />
          <Ln x1={bx - 70} y1={by + 20} x2={bx + Bw + 70} y2={by + 20} c={K.blue} w={2.4} d="8 4" /><Tx x={bx - 66} y={by + 14} c={K.blue} b>① taban düzlemi</Tx>
          <Ln x1={bx - 70} y1={by + 20 + kd} x2={bx + Bw + 70} y2={by + 20 + kd} c={K.red} w={2.4} d="8 4" /><Tx x={bx - 66} y={by + 20 + kd + 16} c={K.red} b>② diş ucu düzlemi</Tx>
          <Force x1={bx + Bw + 100} y1={by - 60} x2={bx + Bw + 6} y2={by - 60} c={K.ink} arrow={c.arrow} w={4} label="Pa" lx={bx + Bw + 60} ly={by - 68} />
          <Force x1={bx + Bw + 100} y1={by + 42} x2={bx + Bw + 6} y2={by + 42} c={K.orange} arrow={c.arrow} w={4} label="ΔH diş = 24,68 kN/m" lx={bx + Bw - 30} ly={by + 34} />
          <Force x1={bx - 40} y1={by + 20 + kd / 2} x2={bx + 12} y2={by + 20 + kd / 2} c={K.green} arrow={c.arrow} w={3} />
          <Tx x={40} y={by + 4 + kd / 2} c={K.green} b>Pp (diş pasifi)</Tx>
          <Tx x={30} y={30} b>İki kayma düzlemi kontrol edilir; küçük FS yönetir</Tx>
          <Tx x={30} y={330} s={14}>Referans duvar (G9): taban FS = 1,85, diş ucu düzlemi FS = 1,66 ⇒ diş ucu yönetir.</Tx>
          <Tx x={30} y={352} c={K.mut} s={14}>Diş ucu düzleminde ek arka itki ΔH diş eklenir (diş derinliği boyunca).</Tx>
        </>
      )}
    </Fig>
  );
}

/* ───────────── Ground anchors and anchored walls ───────────── */

export function AnchorBondFreeLength() {
  const s = 28, top = 60, H = 10, wx = 110, phi = 30, zh = 6.25, theta = 15;
  const y = (z: number) => top + z * s;
  const a45 = 45 + phi / 2;
  const x0 = wx + 8, y0 = y(zh), Lf = 4.5 * s * 1.4, Lb = 8.9 * s * 0.9;
  const [xf, yf] = pt(x0, y0, Lf, -theta), [xb, yb] = pt(x0, y0, Lf + Lb, -theta);
  const wedgeX = wx + 8 + (y(H) - top) / Math.tan(rad(a45));
  return (
    <Fig label="Ground anchor: free length and bond length behind the active wedge" h={440}>
      {(c) => (
        <>
          <Soil x={wx + 8} y={top} w={500} h={y(H) - top + 40} c={c} />
          <Soil x={20} y={y(H)} w={wx - 12} h={40} c={c} />
          <Concrete x={wx - 8} y={top - 10} w={16} h={y(H) - top + 40} c={c} />
          <Ln x1={wx + 8} y1={y(H)} x2={wedgeX} y2={top} c={K.orange} w={2.4} d="8 4" /><Tx x={wedgeX - 10} y={top + 18} a="end" c={K.orange} b>kayma yüzeyi 45° + φ′/2</Tx>
          <Poly pts={[[wx + 8, top], [wx + 8, y(H)], [wedgeX, top]]} fill={K.orange} o={0.15} />
          <Ln x1={x0} y1={y0} x2={xf} y2={yf} c={K.ink} w={3} />
          <Ln x1={xf} y1={yf} x2={xb} y2={yb} c={K.red} w={9} />
          <Tx x={(x0 + xf) / 2 + 40} y={(y0 + yf) / 2 - 24} a="middle" b>L serbest ≥ 4,5 m</Tx>
          <Tx x={(xf + xb) / 2 + 20} y={(yf + yb) / 2 + 34} a="middle" c={K.red} b>L kök (bond): q_u ile belirlenir</Tx>
          <circle cx={x0} cy={y0} r={6} fill={K.blue} /><Tx x={x0 + 8} y={y0 - 10} c={K.blue} b>T</Tx>
          <Ang x={x0} y={y0} r={30} from={0} to={-theta} label="" />
          <Dim x1={wx - 40} y1={y(0)} x2={wx - 40} y2={y(zh)} label="z_h" off={8} /><Dim x1={wx - 40} y1={y(0)} x2={wx - 40} y2={y(H)} label="H" off={44} />
          <Tx x={20} y={30} b>Kök, kayma yüzeyinin gerisinde kalmalıdır; serbest boy en az 4,5 m (GEC-4)</Tx>
          <Tx x={20} y={y(H) + 62}>Örnek: H = 10 m, z_h = 6,25 m, θ = 15° ⇒ T = 445,2 kN</Tx><Tx x={20} y={y(H) + 82}>L serbest = 4,5 m (minimum), L kök = 8,90 m</Tx>
        </>
      )}
    </Fig>
  );
}

export function GanTendonLimits() {
  const X = (r: number) => 50 + r * 520;
  return (
    <Fig label="Tendon stress limits as fractions of SMTS">
      {() => (
        <>
          <rect x={X(0)} y={120} width={X(1) - X(0)} height={50} fill={K.grid} fillOpacity={0.3} stroke={K.ink} />
          <rect x={X(0)} y={120} width={X(0.6) - X(0)} height={50} fill={K.green} fillOpacity={0.55} />
          <rect x={X(0.6)} y={120} width={X(0.7) - X(0.6)} height={50} fill={K.blue} fillOpacity={0.55} />
          <rect x={X(0.7)} y={120} width={X(0.8) - X(0.7)} height={50} fill={K.orange} fillOpacity={0.55} />
          <rect x={X(0.8)} y={120} width={X(1) - X(0.8)} height={50} fill={K.red} fillOpacity={0.3} />
          {[[0.6, "0,60"], [0.7, "0,70"], [0.8, "0,80"], [1, "1,00"]].map(([r, l]) => <g key={l as string}><Ln x1={X(r as number)} y1={110} x2={X(r as number)} y2={182} /><Tx x={X(r as number)} y={204} a="middle" b>{l as string}</Tx></g>)}
          <Tx x={X(0.3)} y={150} a="middle" b>T_tasarım ≤ 0,60 SMTS</Tx>
          <Tx x={X(0.65)} y={100} a="middle" c={K.blue} b>T_kilit ≤ 0,70</Tx>
          <Tx x={X(0.75)} y={240} a="middle" c={K.orange} b>T_deneme = 1,33·T ≤ 0,80</Tx>
          <Tx x={X(0.9)} y={150} a="middle" c={K.red}>kopma bölgesi</Tx>
          <Tx x={50} y={290} s={14}>Sayılar SMTS oranıdır (tendonun özelleşmiş en küçük çekme dayanımı).</Tx>
          <Tx x={50} y={312} c={K.mut} s={14}>Tasarım, kilitleme ve deneme yükü ayrı sınırlara bağlıdır.</Tx>
        </>
      )}
    </Fig>
  );
}

export function AnchoredWallEnvelopes() {
  const panel = (x0: number, title: string, body: ReactNode, c: Ctx) => (
    <g>
      <rect x={x0} y={30} width={200} height={330} fill="none" stroke={K.grid} rx={4} />
      <Tx x={x0 + 100} y={52} a="middle" b>{title}</Tx>
      <Concrete x={x0 + 20} y={80} w={10} h={220} c={c} />
      {[1.5, 4.5, 7.5].map((z, i) => <g key={i}><circle cx={x0 + 25} cy={80 + z * 22} r={4.5} fill={K.red} /></g>)}
      {body}
    </g>
  );
  return (
    <Fig label="Apparent pressure envelopes for anchored walls">
      {(c) => (
        <>
          {panel(10, "Kum (trapez)", (<>
            <Poly pts={[[40, 80], [40 + 0, 80 + 0], [40 + 45 * 2.6, 80 + (2 / 3) * 1.5 * 22], [40 + 45 * 2.6, 80 + 220 - 1.1 * 22], [40, 300]]} fill={K.blue} o={0.3} />
            <Tx x={40 + 45 * 2.6 - 4} y={80 + 110} s={13} b c={K.blue} a="end">p = 45 kPa</Tx>
            <Tx x={110} y={324} a="middle" s={13}>p = ΣP / (H − H₁/3 − Hₙ₊₁/3)</Tx>
          </>), c)}
          {panel(220, "Yumuşak kil", (<>
            <Poly pts={[[250, 80], [250 + 29.92 * 2.6, 80 + 0.25 * 220], [250 + 29.92 * 2.6, 300 - 0.25 * 220], [250, 300]]} fill={K.green} o={0.3} />
            <Tx x={250 + 29.92 * 2.6 + 2} y={80 + 110} s={13} b c={K.green}>29,92</Tx>
            <Tx x={320} y={330} a="middle" s={13}>p = Ka·γ·H, Ka ≥ 0,22</Tx>
          </>), c)}
          {panel(430, "Sert kil", (<>
            <Poly pts={[[460, 80], [460 + 54.4 * 1.5, 80 + 0.25 * 220], [460 + 54.4 * 1.5, 300 - 0.25 * 220], [460, 300]]} fill={K.orange} o={0.3} />
            <Tx x={460 + 54.4 * 1.5 + 2} y={80 + 110} s={13} b c={K.orange}>54,4</Tx>
            <Tx x={530} y={330} a="middle" s={13}>toplam ≥ 3H² (kN/m)</Tx>
          </>), c)}
          <Tx x={10} y={382} c={K.mut} s={13}>Kırmızı noktalar: ankraj seviyeleri (H = 10 m, 1,5 / 4,5 / 7,5 m). Değerler programın el hesabı örnekleridir.</Tx>
        </>
      )}
    </Fig>
  );
}

export function AnchoredWallHeave() {
  const s = 28, top = 70, H = 6, B = 10 * 14;
  return (
    <Fig label="Base heave in soft clay under an excavation" h={460}>
      {(c) => (
        <>
          <Soil x={20} y={top} w={110} h={H * s} c={c} /><Soil x={510} y={top} w={110} h={H * s} c={c} />
          <rect x={20} y={top + H * s} width={600} height={160} fill={c.soil} stroke={K.soilLine} />
          <rect x={20} y={top + H * s} width={600} height={160} fill={K.mut} opacity={0.12} />
          <Concrete x={124} y={top - 10} w={12} h={H * s + 60} c={c} /><Concrete x={504} y={top - 10} w={12} h={H * s + 60} c={c} />
          <Dim x1={140} y1={top + H * s - 14} x2={500} y2={top + H * s - 14} label="B (kazı genişliği)" />
          <Dim x1={70} y1={top} x2={70} y2={top + H * s} label="H" off={8} />
          <path d={`M140 ${top + H * s} Q 320 ${top + H * s + 150} 500 ${top + H * s}`} fill="none" stroke={K.red} strokeWidth={3} />
          <Force x1={320} y1={top + H * s + 70} x2={320} y2={top + H * s + 6} c={K.red} arrow={c.arrow} w={3} label="kabarma" lx={332} ly={top + H * s + 46} />
          <Tx x={30} y={top + H * s + 150} b c={K.mut}>taban altı yumuşak kil: S_u,b</Tx>
          <Tx x={20} y={30} b>Kil tabanda kabarma: iki mekanizma, küçük FS yönetir</Tx>
          <Tx x={20} y={top + H * s + 190}>FS = Nc · S_u,b / (γH + q);  örnek H = 6 m, B = 10 m, S_u,b = 20 kPa ⇒ FS = 1,098 (&lt; 1,5)</Tx>
          <Tx x={20} y={top + H * s + 210} c={K.mut}>Dar derin kazıda (H = 10, B = 2): FS = 1,243;  gereken FS 1,5 geçici, 2,5 kalıcı.</Tx>
        </>
      )}
    </Fig>
  );
}
