import { Ang, Concrete, Dim, Fig, Force, K, Ln, Poly, Soil, Tx, linspace, useT, type Ctx } from "./kit";

/* Topic-specific figures: one drawing per figure id (bilingual labels via useT). */

const deg = (d: number) => (d * Math.PI) / 180;

/* ───────────── Bearing capacity: general shear mechanism and load-settlement curves ───────────── */

export function BearFailureMechanism() {
  const t = useT();
  const phi = 30, a = 45 + phi / 2, cx = 215, halfB = 36, gy = 100, by = 124;
  const apexY = by + halfB * Math.tan(deg(a)), r = halfB / Math.cos(deg(a));
  const side = (s: 1 | -1) => {
    const ex = cx + s * halfB, fx = ex + s * r * Math.cos(deg(30)), fy = by + r * Math.sin(deg(30));
    const sx = fx + s * (fy - gy) / Math.tan(deg(45 - phi / 2));
    return { ex, fx, fy, sx };
  };
  const R = side(1), L = side(-1);
  const fan = (q: ReturnType<typeof side>, s: 1 | -1) => `M${q.ex} ${by} L${cx} ${apexY} A ${r} ${r} 0 0 ${s === 1 ? 0 : 1} ${q.fx} ${q.fy} Z`;
  // load-settlement chart
  const X0 = 470, X1 = 622, Y0 = 300, Y1 = 100;
  const px = (v: number) => X0 + v * (X1 - X0), py = (v: number) => Y0 - v * (Y0 - Y1);
  const dense = [[0, 0], [0.08, 0.5], [0.16, 0.85], [0.26, 1], [0.38, 0.9], [0.6, 0.8], [1, 0.76]] as const;
  const loose = [[0, 0], [0.15, 0.3], [0.35, 0.52], [0.6, 0.64], [0.8, 0.7], [1, 0.74]] as const;
  const pl = (pts: readonly (readonly [number, number])[]) => pts.map(([x, y]) => `${px(x)},${py(y)}`).join(" ");
  return (
    <Fig label="General shear failure mechanism and load-settlement curves">
      {(c) => (
        <>
          <Soil x={0} y={gy} w={440} h={220} c={c} />
          <Poly pts={[[cx - halfB, by], [cx + halfB, by], [cx, apexY]]} fill={K.red} o={0.3} />
          <path d={fan(R, 1)} fill={K.orange} fillOpacity={0.3} stroke={K.orange} strokeWidth={1.6} />
          <path d={fan(L, -1)} fill={K.orange} fillOpacity={0.3} stroke={K.orange} strokeWidth={1.6} />
          <Poly pts={[[R.ex, by], [R.fx, R.fy], [R.sx, gy], [R.ex, gy]]} fill={K.green} o={0.3} />
          <Poly pts={[[L.ex, by], [L.fx, L.fy], [L.sx, gy], [L.ex, gy]]} fill={K.green} o={0.3} />
          <Concrete x={cx - halfB} y={gy - 8} w={2 * halfB} h={by - gy + 8} c={c} />
          <Force x1={cx} y1={40} x2={cx} y2={gy - 12} c={K.ink} arrow={c.arrow} w={4} label="Q" lx={cx + 10} ly={64} />
          <Tx x={cx} y={by + 28} a="middle" c={K.red} b>I</Tx>
          <Tx x={R.ex + 20} y={by + 46} a="middle" c={K.orange} b>II</Tx>
          <Tx x={R.fx + 40} y={gy + 28} a="middle" c={K.green} b>III</Tx>
          <Tx x={12} y={290} s={14}>{t("I aktif kama · II radyal bölge · III pasif kama", "I active wedge · II radial zone · III passive wedge")}</Tx>
          <Tx x={12} y={312} s={14}>α = 45° + φ′/2</Tx>
          <Ang x={cx - halfB} y={by} r={26} from={0} to={-a} label="α" />
          <Dim x1={30} y1={gy} x2={30} y2={by} label="D" off={8} />
          <Dim x1={cx - halfB} y1={apexY + 46} x2={cx + halfB} y2={apexY + 46} label="B" />
          <Tx x={36} y={gy - 8} c={K.mut}>q = γ·D</Tx>
          <Tx x={12} y={26} b>{t("Genel kayma göçmesi (yoğun zemin)", "General shear failure (dense soil)")}</Tx>
          <Tx x={12} y={340} s={14}>{t("Üç bölge birlikte hareket eder; yüzeyde kabarma görülür.", "The three zones move together; the ground surface heaves.")}</Tx>
          <Tx x={12} y={360} s={14} c={K.mut}>q_u = c·N_c + q·N_q + ½·γ·B·N_γ</Tx>
          {/* load-settlement */}
          <Ln x1={X0} y1={Y1 - 10} x2={X0} y2={Y0} w={1.8} /><Ln x1={X0} y1={Y0} x2={X1 + 6} y2={Y0} w={1.8} />
          <text transform={`translate(${X0 - 22} ${(Y0 + Y1) / 2}) rotate(-90)`} textAnchor="middle" fontWeight={700} fill={K.ink} fontSize={14}>{t("yük q (basınç)", "bearing pressure q")}</text>
          <Tx x={(X0 + X1) / 2} y={Y0 + 24} a="middle" b>{t("oturma s", "settlement s")}</Tx>
          <polyline points={pl(dense)} fill="none" stroke={K.blue} strokeWidth={3} />
          <polyline points={pl(loose)} fill="none" stroke={K.orange} strokeWidth={3} strokeDasharray="7 4" />
          <Ln x1={X0} y1={py(1)} x2={px(0.26)} y2={py(1)} c={K.blue} w={1.2} d="4 4" /><circle cx={px(0.26)} cy={py(1)} r={5} fill={K.blue} />
          <Tx x={px(0.3)} y={py(1) - 8} c={K.blue} b>q_u</Tx>
          <Ln x1={X0 + 6} y1={44} x2={X0 + 36} y2={44} c={K.blue} w={3} /><Tx x={X0 + 42} y={49} s={13} c={K.blue}>{t("yoğun: tepe var", "dense: peak")}</Tx>
          <Ln x1={X0 + 6} y1={64} x2={X0 + 36} y2={64} c={K.orange} w={3} d="7 4" /><Tx x={X0 + 42} y={69} s={13} c={K.orange}>{t("gevşek: tepe yok", "loose: no peak")}</Tx>
        </>
      )}
    </Fig>
  );
}

/* ───────────── Sheet pile ───────────── */

/** Shared example for the moment figure: H = 5 m, γ = 18, φ' = 30° (Ka = 1/3, Kp = 3), D0 from the closed form. */
const SPW = { H: 5, g: 18, ka: 1 / 3, kp: 3 };
const spwD0 = (() => { const r = (SPW.ka / SPW.kp) ** (1 / 3); return (SPW.H * r) / (1 - r); })();
const spwNet = (z: number) => SPW.ka * SPW.g * z - (z > SPW.H ? SPW.kp * SPW.g * (z - SPW.H) : 0);

export function SpwMomentDiagram() {
  const t = useT();
  const zt = SPW.H + spwD0, n = 4000, dz = zt / n, top = 70, s = 28;
  const V: number[] = [0], M: number[] = [0];
  for (let i = 1; i <= n; i++) { const z = i * dz; V.push(V[i - 1] + 0.5 * (spwNet(z) + spwNet(z - dz)) * dz); M.push(M[i - 1] + 0.5 * (V[i] + V[i - 1]) * dz); }
  const iM = M.indexOf(Math.max(...M)), y = (z: number) => top + z * s;
  const xv = 270, xm = 400, sv = 0.22, sm = 0.38;
  const col = (x0: number, vals: number[], k: number, color: string, label: string) => (
    <g>
      <Ln x1={x0} y1={top - 8} x2={x0} y2={y(zt) + 8} w={1.4} />
      <polyline fill={color} fillOpacity={0.22} stroke={color} strokeWidth={2.4} points={[`${x0},${y(0)}`, ...vals.map((v, i) => `${x0 + v * k},${y(i * dz)}`), `${x0},${y(zt)}`].join(" ")} />
      <Tx x={x0} y={top - 24} a="middle" b>{label}</Tx>
    </g>
  );
  return (
    <Fig label="Shear force and bending moment of a cantilever sheet pile">
      {(c) => (
        <>
          <Soil x={14} y={y(SPW.H)} w={96} h={y(zt) - y(SPW.H) + 12} c={c} />
          <Soil x={124} y={top} w={60} h={y(zt) - top + 12} c={c} />
          <Concrete x={110} y={top - 18} w={14} h={y(zt) - top + 18} c={c} />
          <Tx x={14} y={y(SPW.H) - 8} s={13}>{t("kazı tabanı", "dredge line")}</Tx>
          {[0, SPW.H, zt].map((z, i) => <Ln key={i} x1={14} y1={y(z)} x2={600} y2={y(z)} c={K.mut} w={i === 1 ? 1.2 : 0.8} d="5 4" />)}
          <Dim x1={60} y1={y(0)} x2={60} y2={y(SPW.H)} label="H" off={8} />
          <Dim x1={60} y1={y(SPW.H)} x2={60} y2={y(zt)} label="D₀" off={8} />
          {col(xv, V, sv, K.green, "V (kN/m)")}
          {col(xm, M, sm, K.orange, "M (kN·m/m)")}
          <circle cx={xv} cy={y(iM * dz)} r={5} fill={K.ink} /><Tx x={xv + 10} y={y(iM * dz) - 8}>V = 0</Tx>
          <circle cx={xm + M[iM] * sm} cy={y(iM * dz)} r={6} fill={K.red} />
          <Tx x={xm + M[iM] * sm + 10} y={y(iM * dz) - 2} c={K.red} b>M_max = {t.n(M[iM], 2)}</Tx>
          <Tx x={xm + M[iM] * sm + 10} y={y(iM * dz) + 16} c={K.red}>z = {t.n(iM * dz, 2)} m</Tx>
          <Tx x={14} y={y(zt) + 34} s={14}>{t("H = 5 m, γ = 18 kN/m³, φ′ = 30°, D₀ = ", "H = 5 m, γ = 18 kN/m³, φ′ = 30°, D₀ = ")}{t.n(spwD0, 2)} m</Tx>
          <Tx x={14} y={y(zt) + 54} s={14} c={K.mut}>{t("M_max, kesmenin sıfır olduğu derinlikte oluşur; kesit modülü W = M_max / σ_em", "M_max occurs where shear is zero; section modulus W = M_max / σ_allow")}</Tx>
        </>
      )}
    </Fig>
  );
}

/** Concept sketch: Blum lumps the passive resistance at the toe into a single force R; the real distribution is spread. */
export function SpwMethodCompare() {
  const t = useT();
  const panel = (x0: number, blum: boolean, c: Ctx) => {
    const wx = x0 + 150, top = 70, dr = 180, toe = 270, ext = blum ? 0 : 30;
    return (
      <g>
        <rect x={x0} y={34} width={300} height={318} fill="none" stroke={K.grid} rx={4} />
        <Tx x={x0 + 150} y={54} a="middle" b>{blum ? t("Blum kabulü (programda)", "Blum assumption (program)") : t("Gerçek dağılım (kavramsal)", "Real distribution (concept)")}</Tx>
        <Soil x={wx + 7} y={top} w={x0 + 292 - wx - 7} h={toe - top + ext + 6} c={c} />
        <Soil x={x0 + 8} y={dr} w={wx - x0 - 15} h={toe - dr + ext + 6} c={c} />
        <Concrete x={wx - 7} y={top - 14} w={14} h={toe - top + ext + 14} c={c} />
        <Ln x1={x0 + 8} y1={dr} x2={wx - 7} y2={dr} w={2} /><Tx x={x0 + 14} y={dr - 6} s={13}>{t("kazı tabanı", "dredge line")}</Tx>
        <Poly pts={[[wx + 7, top], [wx + 7 + 70, toe - 20], [wx + 7, toe - 20]]} fill={K.red} o={0.3} />
        {blum ? (
          <>
            <Poly pts={[[wx - 7, dr], [wx - 7 - 62, toe - 20], [wx - 7, toe - 20]]} fill={K.blue} o={0.3} />
            <Force x1={wx + 52} y1={toe} x2={wx + 8} y2={toe} c={K.violet} arrow={c.arrow} w={4} label="R" lx={wx + 56} ly={toe + 5} />
            <circle cx={wx} cy={toe} r={5} fill={K.ink} />
            <Dim x1={wx - 96} y1={dr} x2={wx - 96} y2={toe} label="D₀" off={8} />
          </>
        ) : (
          <>
            <path d={`M${wx - 7} ${dr} Q ${wx - 7 - 96} ${dr + 80} ${wx - 7 - 40} ${toe + 8} L${wx - 7} ${toe + ext} Z`} fill={K.blue} fillOpacity={0.3} stroke={K.blue} strokeWidth={1.6} />
            <path d={`M${wx + 7} ${toe - 20} Q ${wx + 7 + 70} ${toe + 6} ${wx + 7} ${toe + ext}`} fill={K.red} fillOpacity={0.3} stroke={K.red} strokeWidth={1.4} />
            <Dim x1={wx - 112} y1={dr} x2={wx - 112} y2={toe + ext} label="D" off={8} />
          </>
        )}
        <Tx x={x0 + 150} y={344} a="middle" s={13} c={K.mut}>{blum ? t("R: ucun altındaki tüm direnç tek noktada", "R: all resistance below the toe in one point") : t("D = 1,2·D₀ ile telafi edilir", "covered by D = 1.2·D₀")}</Tx>
      </g>
    );
  };
  return <Fig label="Blum assumption versus the real passive distribution">{(c) => <>{panel(14, true, c)}{panel(326, false, c)}</>}</Fig>;
}

/** Free earth support method for an anchored wall: moment about the anchor gives D, horizontal balance gives T. */
export function AncFreeSupport() {
  const t = useT();
  const s = 26, top = 50, wx = 250, H = 6, a = 1.5, D = 3.5;
  const y = (z: number) => top + z * s, ya = y(a), yd = y(H), yt = y(H + D);
  const wa = 100, wp = 82;
  const ypa = top + (2 / 3) * (yt - top), ypp = yd + (2 / 3) * (yt - yd);
  return (
    <Fig label="Free earth support: anchor force and embedment from equilibrium">
      {(c) => (
        <>
          <Soil x={wx + 7} y={top} w={374} h={yt - top + 28} c={c} />
          <Soil x={14} y={yd} w={wx - 7 - 14} h={yt - yd + 28} c={c} />
          <Concrete x={wx - 6} y={top - 20} w={13} h={yt - top + 20} c={c} />
          <Poly pts={[[wx + 7, top], [wx + 7 + wa, yt], [wx + 7, yt]]} fill={K.red} o={0.28} />
          <Poly pts={[[wx - 6, yd], [wx - 6 - wp, yt], [wx - 6, yt]]} fill={K.blue} o={0.28} />
          <Ln x1={wx} y1={ya} x2={500} y2={ya} c={K.ink} w={2.4} /><rect x={500} y={ya - 16} width={10} height={32} fill={K.concLine} />
          <Force x1={wx + 12} y1={ya - 14} x2={wx + 76} y2={ya - 14} c={K.green} arrow={c.arrow} w={3.4} label="T" lx={wx + 86} ly={ya - 10} />
          <Force x1={wx + 150} y1={ypa} x2={wx + 12} y2={ypa} c={K.red} arrow={c.arrow} w={4} label="P_a" lx={wx + 152} ly={ypa + 5} />
          <Force x1={wx - 150} y1={ypp} x2={wx - 12} y2={ypp} c={K.blue} arrow={c.arrow} w={4} label="P_p" lx={wx - 192} ly={ypp + 5} />
          <circle cx={wx} cy={ya} r={5} fill={K.ink} />
          <Ln x1={wx + 20} y1={ya} x2={600} y2={ya} c={K.mut} w={1} d="5 4" />
          <Dim x1={590} y1={ya} x2={590} y2={ypa} label="l_a" off={8} side="right" /><Dim x1={620} y1={ya} x2={620} y2={ypp} label="l_p" off={-8} side="left" />
          <Dim x1={44} y1={top} x2={44} y2={yd} label="H" off={8} /><Dim x1={44} y1={yd} x2={44} y2={yt} label="D" off={8} />
          <Tx x={14} y={yd - 8} s={13}>{t("kazı tabanı", "dredge line")}</Tx>
          <Tx x={14} y={26} b>{t("Serbest zemin desteği: ankraj noktasına göre moment dengesi", "Free earth support: moment equilibrium about the anchor")}</Tx>
          <Tx x={14} y={yt + 50} s={14}>ΣM(T) = 0:  P_a·l_a = P_p·l_p   →  {t("D bulunur", "gives D")}</Tx>
          <Tx x={14} y={yt + 70} s={14}>ΣH = 0:  T = P_a − P_p   →  {t("ankraj kuvveti", "anchor force")}</Tx>
        </>
      )}
    </Fig>
  );
}

/** KDYY seismic increment on a sheet pile: a uniform part over the full length plus a triangular surcharge part. */
export function SpSeismicKdyy() {
  const t = useT();
  const s = 30, top = 62, wx = 150, H = 4, Dt = 4, zt = H + Dt;
  const y = (z: number) => top + z * s, yd = y(H), ytoe = y(zt);
  const u = 56, q = 110;
  const uni = (
    <Poly pts={[[wx + 7, top], [wx + 7 + u, top], [wx + 7 + u, ytoe], [wx + 7, ytoe]]} fill={K.orange} o={0.3} />
  );
  return (
    <Fig label="KDYY seismic increment on a sheet pile">
      {(c) => (
        <>
          <Soil x={wx + 7} y={top} w={200} h={ytoe - top + 28} c={c} />
          <Soil x={14} y={yd} w={wx - 7 - 14} h={ytoe - yd + 28} c={c} />
          <Concrete x={wx - 7} y={top - 16} w={14} h={ytoe - top + 16} c={c} />
          {uni}
          <Poly pts={[[wx + 7 + u, top], [wx + 7 + u + q, top], [wx + 7 + u, ytoe]]} fill={K.red} o={0.3} />
          <Ln x1={14} y1={yd} x2={wx - 7} y2={yd} w={2} /><Tx x={14} y={yd - 6} s={13}>{t("kazı tabanı", "dredge line")}</Tx>
          <Tx x={wx + 7 + u / 2} y={top - 10} a="middle" c={K.orange} b>½·ΔK_ad·σ′v(uç)</Tx>
          <Tx x={wx + 7 + u + q + 6} y={top + 14} c={K.red} b>2·q·ΔK_ad</Tx>
          <Dim x1={wx + 290} y1={top} x2={wx + 290} y2={ytoe} label={t("uç derinliği", "toe depth")} off={-8} side="left" />
          <Tx x={wx + 7 + u + 8} y={ytoe - 8} s={13} c={K.mut}>{t("uçta sıfır", "zero at the toe")}</Tx>
          <Tx x={14} y={26} b>{t("Deprem artışı (KDYY el kitabı dağılımı)", "Seismic increment (KDYY handbook distribution)")}</Tx>
          <Tx x={14} y={ytoe + 52} s={14}>ΔK_ad = (1 − k_v)·K_AE − K_A</Tx>
          <Tx x={14} y={ytoe + 72} s={14} c={K.mut}>{t("Düzgün kısım uç derinliğine kadar sürer; sürşarj payı yüzeyde 2·q·ΔK_ad, uçta 0.", "The uniform part runs to the toe; the surcharge share is 2·q·ΔK_ad at the surface and 0 at the toe.")}</Tx>
        </>
      )}
    </Fig>
  );
}

/* ───────────── Ground anchors ───────────── */

export function GanWedgeGeometry() {
  const t = useT();
  const s = 24, top = 60, wx = 90, H = 8, zh = 3, phi = 30, alpha = 15, a = 45 + phi / 2;
  const y = (z: number) => top + z * s;
  const x0 = wx + 6, y0 = y(zh), yb = y(H);
  // intersection of the rod with the 45+phi/2 plane through the base of the wall
  const ca = Math.cos(deg(alpha)), sa = Math.sin(deg(alpha)), cb = Math.cos(deg(a)), sb = Math.sin(deg(a));
  const det = ca * sb + sa * cb; // solve x0 + t*ca = wx + u*cb ; y0 + t*sa = yb - u*sb
  const tt = ((wx - x0) * sb + (yb - y0) * cb) / det;
  const px = x0 + tt * ca, py = y0 + tt * sa;
  const chi = 34, bond = 150;
  const fx = px + chi * ca, fy = py + chi * sa, ex = fx + bond * ca, ey = fy + bond * sa;
  const topX = wx + (yb - top) / Math.tan(deg(a));
  return (
    <Fig label="Single anchor: failure plane, free length and bond length">
      {(c) => (
        <>
          <Soil x={wx + 6} y={top} w={500} h={yb - top + 60} c={c} />
          <Soil x={14} y={yb} w={wx - 8} h={60} c={c} />
          <Concrete x={wx - 7} y={top - 12} w={14} h={yb - top + 72} c={c} />
          <Poly pts={[[wx + 7, top], [wx + 7, yb], [topX, top]]} fill={K.orange} o={0.18} />
          <Ln x1={wx + 7} y1={yb} x2={topX} y2={top} c={K.orange} w={2.6} d="8 4" />
          <Tx x={topX + 8} y={top + 16} c={K.orange} b>{t("kayma yüzeyi", "failure plane")}</Tx>
          <Ln x1={x0} y1={y0} x2={fx} y2={fy} c={K.ink} w={3} />
          <Ln x1={fx} y1={fy} x2={ex} y2={ey} c={K.red} w={9} />
          <circle cx={x0} cy={y0} r={6} fill={K.blue} />
          <circle cx={px} cy={py} r={5} fill={K.orange} />
          <Dim x1={x0 + 6} y1={y0 + 30} x2={px + 6} y2={py + 30} label="L_kama" c={K.ink} />
          <Dim x1={px + 6} y1={py + 30} x2={fx + 6} y2={fy + 30} label="χ" c={K.ink} />
          <Dim x1={fx + 6} y1={fy + 30} x2={ex + 6} y2={ey + 30} label={t("L_kök (bond)", "L_bond")} c={K.red} />
          <Tx x={ex + 14} y={ey + 4} c={K.red} b>q_u</Tx>
          <Ang x={x0} y={y0} r={46} from={0} to={-alpha} label="α" />
          <Ang x={wx + 7} y={yb} r={42} from={0} to={a} label="45°+φ′/2" />
          <Dim x1={40} y1={top} x2={40} y2={y0} label="z_h" off={8} /><Dim x1={40} y1={top} x2={40} y2={yb} label="H" off={44} />
          <Tx x={14} y={26} b>{t("Tek ankraj: serbest boy = kama içi + kamanın ötesi", "One anchor: free length = inside the wedge + beyond it")}</Tx>
          <Tx x={ex - 120} y={yb + 90} s={14}>L_serbest = L_kama + χ ≥ 4,5 m</Tx>
          <Tx x={ex - 120} y={yb + 110} s={14} c={K.mut}>{t("Kök bölgesi tümüyle kamanın dışındadır.", "The bond zone lies entirely outside the wedge.")}</Tx>
        </>
      )}
    </Fig>
  );
}

/* ───────────── Shear key ───────────── */

type KeyOpts = { dims?: boolean; tip?: boolean; press?: boolean };

function KeySection({ c, o, t }: { c: Ctx; o: KeyOpts; t: ReturnType<typeof useT> }) {
  // geometry (px): base slab 140..380, stem 230..262, key 250..292 under the slab
  const sx0 = 140, sx1 = 380, sy = 220, sh = 30, kx0 = 250, kx1 = 292, ky = sy + sh + 46, gy = 80, fy = 192;
  return (
    <g>
      <Soil x={14} y={sy + sh} w={612} h={ky - sy - sh + 70} c={c} />
      <Soil x={262} y={gy} w={364} h={sy - gy + sh} c={c} />
      <Soil x={14} y={fy} w={sx0 - 14 + 90} h={sy - fy + sh} c={c} />
      <Concrete x={230} y={gy} w={32} h={sy - gy} c={c} />
      <Concrete x={sx0} y={sy} w={sx1 - sx0} h={sh} c={c} />
      <Concrete x={kx0} y={sy + sh} w={kx1 - kx0} h={ky - sy - sh} c={c} />
      {o.dims && (
        <>
          <Dim x1={sx0} y1={372} x2={sx1} y2={372} label="B" />
          <Dim x1={kx0} y1={346} x2={kx1} y2={346} label="b_k" />
          <Dim x1={sx0} y1={320} x2={kx0} y2={320} label="x_k" />
          <Dim x1={kx1 + 14} y1={sy + sh} x2={kx1 + 14} y2={ky} label="h_k" off={8} side="right" />
          <Dim x1={sx0 - 30} y1={fy} x2={sx0 - 30} y2={sy + sh} label="D_f" off={8} />
          <Dim x1={196} y1={gy} x2={196} y2={sy} label="H" off={8} side="left" />
          <Tx x={14} y={26} b>{t("Kayma dişi geometrisi", "Shear key geometry")}</Tx>
          <Tx x={14} y={50} s={14} c={K.mut}>{t("Diş, taban plağının altında; konumu x_k, boyu h_k, genişliği b_k.", "The key sits below the base slab: position x_k, depth h_k, width b_k.")}</Tx>
        </>
      )}
      {o.tip && (
        <>
          <Ln x1={sx0 - 40} y1={ky} x2={sx1 + 120} y2={ky} c={K.red} w={2.6} d="8 4" /><Tx x={sx0 - 36} y={ky + 16} c={K.red} b>{t("② diş ucu düzlemi", "② key-tip plane")}</Tx>
          <Ln x1={sx0 - 40} y1={sy + sh} x2={sx1 + 120} y2={sy + sh} c={K.blue} w={2.2} d="8 4" /><Tx x={sx0 - 36} y={sy + sh - 6} c={K.blue} b>{t("① taban düzlemi", "① base plane")}</Tx>
          <Ln x1={sx1} y1={sy + sh} x2={sx1} y2={ky} c={K.orange} w={2.4} d="5 4" />
          <Poly pts={[[sx1, sy + sh], [sx1 + 38, sy + sh], [sx1 + 38, ky], [sx1, ky]]} fill={K.orange} o={0.25} />
          <Force x1={sx1 + 120} y1={(sy + sh + ky) / 2} x2={sx1 + 42} y2={(sy + sh + ky) / 2} c={K.orange} arrow={c.arrow} w={3.4} label="ΔH_diş" lx={sx1 + 84} ly={(sy + sh + ky) / 2 - 8} />
          <Force x1={sx1 + 120} y1={140} x2={sx1 + 40} y2={140} c={K.ink} arrow={c.arrow} w={4} label="P_a" lx={sx1 + 84} ly={132} />
          <Tx x={sx1 + 44} y={sy + sh + 22} s={13} c={K.orange}>{t("uzatılmış arka düzlem", "extended back plane")}</Tx>
          <Tx x={14} y={26} b>{t("Diş ucu düzlemi: ek arka itki", "Key-tip plane: extra back thrust")}</Tx>
          <Tx x={14} y={50} s={14} c={K.mut}>{t("Düşey arka düzlem diş ucuna kadar uzar; bu ek yükseklikte aktif itki ΔH_diş eklenir.", "The vertical back plane is extended to the key tip; the active thrust over that extra height is added.")}</Tx>
        </>
      )}
      {o.press && (
        <>
          <Poly pts={[[kx0, sy + sh], [kx0 - 52, sy + sh], [kx0 - 52 - 22, ky], [kx0, ky]]} fill={K.blue} o={0.3} />
          <Poly pts={[[kx0, sy + sh], [kx0 - 26, sy + sh], [kx0 - 26 - 11, ky], [kx0, ky]]} fill={K.green} o={0.5} />
          <Force x1={kx0 - 100} y1={(sy + sh + ky) / 2} x2={kx0 - 2} y2={(sy + sh + ky) / 2} c={K.blue} arrow={c.arrow} w={3.4} label="P_p" lx={kx0 - 128} ly={(sy + sh + ky) / 2 + 5} />
          <Tx x={14} y={26} b>{t("Dişin pasif direnci", "Passive resistance of the key")}</Tx>
          <Tx x={14} y={50} s={14} c={K.mut}>{t("Mavi: tam pasif; yeşil: tasarımda kullanılan 0,5·P_p (EM 1110-2-2502).", "Blue: full passive; green: 0.5·P_p used in design (EM 1110-2-2502).")}</Tx>
          <Tx x={14} y={72} s={14} c={K.mut}>{t("Ön zemin kaybolmayacaksa hesaba girer.", "Only counts if the front soil will not be removed.")}</Tx>
        </>
      )}
    </g>
  );
}

export const KeyGeometry = () => { const t = useT(); return <Fig label="Shear key geometry" h={400}>{(c) => <KeySection c={c} o={{ dims: true }} t={t} />}</Fig>; };
export const KeyTipPlane = () => { const t = useT(); return <Fig label="Key-tip sliding plane and extra back thrust" h={400}>{(c) => <KeySection c={c} o={{ tip: true }} t={t} />}</Fig>; };
export const KeyPassive = () => { const t = useT(); return <Fig label="Passive resistance on the shear key" h={400}>{(c) => <KeySection c={c} o={{ press: true }} t={t} />}</Fig>; };

/* ───────────── Slope stability: slip circle and the moment definition of FS ───────────── */

export function SlpSlipCircle() {
  const t = useT();
  const O = { x: 260, y: 80 }, R = 200, toe = { x: 150, y: 247 }, crest = { x: 310, y: 150 };
  const th0 = Math.atan2(70, Math.sqrt(R * R - 70 * 70)), th1 = Math.atan2(toe.y - O.y, toe.x - O.x);
  const arc = linspace(th0, th1, 40).map((a): [number, number] => [O.x + R * Math.cos(a), O.y + R * Math.sin(a)]);
  const mass: [number, number][] = [[toe.x, toe.y], [crest.x, crest.y], ...arc];
  const Wx = 335, Wy = 205;
  return (
    <Fig label="Circular slip surface and the moment definition of the factor of safety">
      {(c) => (
        <>
          <polygon points={`14,${toe.y} ${toe.x},${toe.y} ${crest.x},${crest.y} 626,${crest.y} 626,330 14,330`} fill={c.soil} stroke={K.soilLine} />
          <Poly pts={mass} fill={K.orange} o={0.28} stroke={K.orange} />
          <polyline points={arc.map((p) => p.join(",")).join(" ")} fill="none" stroke={K.red} strokeWidth={3.6} />
          <circle cx={O.x} cy={O.y} r={6} fill={K.ink} /><Tx x={O.x + 10} y={O.y + 4} b>O</Tx>
          <Ln x1={O.x} y1={O.y} x2={toe.x} y2={toe.y} c={K.mut} w={1.5} d="5 4" /><Tx x={196} y={150} c={K.mut} b>R</Tx>
          <Ln x1={O.x} y1={O.y} x2={O.x} y2={310} c={K.mut} w={1} d="3 4" /><Ln x1={Wx} y1={Wy} x2={Wx} y2={310} c={K.mut} w={1} d="3 4" />
          <Force x1={Wx} y1={Wy - 30} x2={Wx} y2={Wy + 26} c={K.ink} arrow={c.arrow} w={4} label="W" lx={Wx + 8} ly={Wy - 8} />
          <Dim x1={O.x} y1={300} x2={Wx} y2={300} label="d" />
          <Ln x1={430} y1={106} x2={376} y2={106} c={K.violet} w={3} end={c.arrow(K.violet)} /><Tx x={434} y={110} c={K.violet} s={14}>{t("kayma yönü", "sliding direction")}</Tx>
          <Ln x1={238} y1={286} x2={186} y2={268} c={K.green} w={3} end={c.arrow(K.green)} /><Tx x={242} y={304} c={K.green} s={14} a="start">τ_f</Tx>
          <Tx x={14} y={26} b>{t("Dairesel kayma yüzeyi: merkez O, yarıçap R", "Circular slip surface: centre O, radius R")}</Tx>
          <Tx x={14} y={352} s={14}>FS = M_direnç / M_itici = (τ_f·L·R) / (W·d)</Tx>
          <Tx x={14} y={372} s={14} c={K.mut}>{t("L: yay uzunluğu, τ_f: zeminin kayma direnci, W: kayan kütlenin ağırlığı", "L: arc length, τ_f: shear strength of the soil, W: weight of the sliding mass")}</Tx>
        </>
      )}
    </Fig>
  );
}

/* ───────────── Surcharge basis: horizontal projection versus inclined surface ───────────── */

export function SurSurchargeBasis() {
  const t = useT();
  const beta = 10, k = Math.tan(deg(beta));
  const panel = (x0: number, inclined: boolean, c: Ctx) => {
    const gx0 = x0 + 40, gx1 = x0 + 270, g0 = 190;
    const gy = (x: number) => (inclined ? g0 - (x - gx0) * k : g0);
    return (
      <g>
        <rect x={x0} y={34} width={300} height={318} fill="none" stroke={K.grid} rx={4} />
        <Tx x={x0 + 150} y={54} a="middle" b>{inclined ? t("q eğik yüzey başına", "q per inclined surface") : t("q yatay izdüşüm başına", "q per horizontal projection")}</Tx>
        <polygon points={`${gx0 - 20},${gy(gx0 - 20)} ${gx1},${gy(gx1)} ${gx1},300 ${gx0 - 20},300`} fill={c.soil} stroke={K.soilLine} />
        {linspace(gx0 + 10, gx1 - 14, 6).map((x) => <Ln key={x} x1={x} y1={gy(x) - 52} x2={x} y2={gy(x) - 4} c={K.red} w={2.4} end={c.arrow(K.red)} />)}
        <Ln x1={gx0 + 10} y1={gy(gx0 + 10) - 56} x2={gx1 - 14} y2={gy(gx1 - 14) - 56} c={K.red} w={1.4} />
        {inclined ? (
          <>
            <Tx x={x0 + 150} y={gy(x0 + 150) - 72} a="middle" c={K.red} b>q ({t("yüzey başına", "per surface")})</Tx>
            <Tx x={x0 + 150} y={256} a="middle" s={14}>q_h = q / cos β</Tx>
            <Tx x={x0 + 150} y={276} a="middle" s={14} c={K.mut}>β = 10° → q_h = {t.n(1 / Math.cos(deg(beta)), 3)}·q</Tx>
          </>
        ) : (
          <>
            <Tx x={x0 + 150} y={gy(x0 + 150) - 72} a="middle" c={K.red} b>q ({t("yatay izdüşüm", "horizontal")})</Tx>
            <Tx x={x0 + 150} y={256} a="middle" s={14}>q_h = q</Tx>
            <Tx x={x0 + 150} y={276} a="middle" s={14} c={K.mut}>{t("varsayılan: 'horizontal'", "default: 'horizontal'")}</Tx>
          </>
        )}
        {inclined && <Ang x={gx0 + 80} y={gy(gx0 + 80)} r={44} from={0} to={beta} label="β" />}
        <Tx x={x0 + 150} y={332} a="middle" s={13} c={K.mut}>{inclined ? 'basis = "inclined"' : 'basis = "horizontal"'}</Tx>
      </g>
    );
  };
  return <Fig label="Surcharge basis options">{(c) => <>{panel(14, false, c)}{panel(326, true, c)}</>}</Fig>;
}

/* ───────────── Anchored wall: apparent pressure envelopes ───────────── */

/** Sand: Peck/GEC-4 trapezoid for the worked example (H = 10 m, anchors at 1.5, 4.5, 7.5 m, P = 0.65·Ka·γ·H² = 390 kN/m). */
export function AwlSandEnvelope() {
  const t = useT();
  const s = 28, top = 64, wx = 150, H = 10, k = 5, p = 45, h1 = 1.5, hn = 2.5;
  const y = (z: number) => top + z * s;
  const z1 = (2 / 3) * h1, z2 = H - hn / 3;
  return (
    <Fig label="Apparent pressure envelope for an anchored wall in sand">
      {(c) => (
        <>
          <Soil x={wx + 8} y={top} w={p * k + 16} h={H * s} c={c} />
          <Concrete x={wx - 8} y={top - 10} w={16} h={H * s + 10} c={c} />
          <Poly pts={[[wx + 8, y(0)], [wx + 8 + p * k, y(z1)], [wx + 8 + p * k, y(z2)], [wx + 8, y(H)]]} fill={K.blue} o={0.3} />
          {[1.5, 4.5, 7.5].map((z) => (
            <g key={z}><Ln x1={wx - 8} y1={y(z)} x2={wx - 70} y2={y(z)} c={K.red} w={2.6} end={c.arrow(K.red)} /><circle cx={wx - 8} cy={y(z)} r={4.5} fill={K.red} /><Tx x={wx - 74} y={y(z) + 4} a="end" s={13} c={K.red}>{`z = ${t.n(z, 1)} m`}</Tx></g>
          ))}
          {[z1, z2].map((z) => <Ln key={z} x1={wx + 8} y1={y(z)} x2={wx + 8 + p * k} y2={y(z)} c={K.mut} w={1} d="4 4" />)}
          <Dim x1={wx + 8} y1={y(H) + 26} x2={wx + 8 + p * k} y2={y(H) + 26} label="p_max = 45 kPa" c={K.blue} />
          <Tx x={wx + 8 + p * k + 10} y={y(z1) + 4} s={13}>z = 2/3·H₁ = {t.n(z1, 1)} m</Tx>
          <Tx x={wx + 8 + p * k + 10} y={y(z2) + 4} s={13}>z = H − H₊₁/3 = {t.n(z2, 2)} m</Tx>
          <Dim x1={wx + 8 + p * k + 120} y1={y(0)} x2={wx + 8 + p * k + 120} y2={y(H)} label="H" off={-8} side="left" />
          <Tx x={14} y={26} b>{t("Kum: görünür basınç zarfı (yamuk)", "Sand: apparent pressure envelope (trapezoid)")}</Tx>
          <Tx x={14} y={y(H) + 62} s={14}>P = 0,65·K_a·γ·H² = 390 kN/m   →   p_max = P / (H − H₁/3 − H₊₁/3)</Tx>
          <Tx x={14} y={y(H) + 82} s={14} c={K.mut}>{t("K_a = 1/3, γ = 18 kN/m³, H = 10 m; zarf alanı toplam yüke eşittir.", "K_a = 1/3, γ = 18 kN/m³, H = 10 m; the envelope area equals the total load.")}</Tx>
        </>
      )}
    </Fig>
  );
}

/** Clay: soft (constant ordinate below a short ramp) and stiff (trapezoid), H = 8 m, γ = 17 kN/m³. */
export function AwlClayEnvelopes() {
  const t = useT();
  const s = 30, top = 70, H = 8, k = 3;
  const y = (z: number) => top + z * s;
  const panel = (x0: number, title: string, pts: [number, number][], p: number, color: string, note: string, c: Ctx) => (
    <g>
      <rect x={x0} y={34} width={300} height={330} fill="none" stroke={K.grid} rx={4} />
      <Tx x={x0 + 150} y={54} a="middle" b>{title}</Tx>
      <Soil x={x0 + 50} y={top} w={110} h={H * s} c={c} />
      <Concrete x={x0 + 36} y={top - 8} w={14} h={H * s + 8} c={c} />
      <Poly pts={pts.map(([z, v]): [number, number] => [x0 + 50 + v * p * k, y(z)])} fill={color} o={0.3} />
      <Ln x1={x0 + 50} y1={y(H)} x2={x0 + 290} y2={y(H)} c={K.mut} w={1} d="4 4" />
      <Tx x={x0 + 50 + p * k + 8} y={(y(pts[1][0]) + y(pts[2][0])) / 2} c={color} b>{t.n(p, 2)} kPa</Tx>
      <Dim x1={x0 + 22} y1={top} x2={x0 + 22} y2={y(H)} label="H" off={8} />
      <Tx x={x0 + 150} y={y(H) + 28} a="middle" s={13}>{note}</Tx>
    </g>
  );
  return (
    <Fig label="Apparent pressure envelopes for an anchored wall in clay">
      {(c) => (
        <>
          {panel(14, t("Yumuşak kil", "Soft clay"), [[0, 0], [2, 1], [8, 1], [8, 0]], 29.92, K.green, "p = K_a·γ·H, K_a ≥ 0,22; z = 0 → 2 m", c)}
          {panel(326, t("Sert kil", "Stiff clay"), [[0, 0], [8 / 6, 1], [6, 1], [8, 0]], 54.4, K.orange, "p = c·γ·H (c = 0,4); P ≥ 3H²", c)}
          <Tx x={14} y={394} s={13} c={K.mut}>{t("H = 8 m, γ = 17 kN/m³. Toplam yük: yumuşak kil 209,44 kN/m; sert kil 344,53 kN/m.", "H = 8 m, γ = 17 kN/m³. Total load: soft clay 209.44 kN/m; stiff clay 344.53 kN/m.")}</Tx>
        </>
      )}
    </Fig>
  );
}

/** Tendon zones laid out along its length (schematic split of the free length; the 4.5 m and 8.90 m values are the worked example). */
export function GanZonesStrip() {
  const t = useT();
  const x0 = 70, m = 40, y = 150, h = 36;
  const free = 4.5, bond = 8.9, kama = 2.6;
  const X = (v: number) => x0 + v * m;
  return (
    <Fig label="Tendon zones along its length: head, free length (wedge and chi), bond length">
      {(c) => (
        <>
          <Concrete x={x0 - 22} y={y - 26} w={16} h={h + 52} c={c} />
          <rect x={X(0)} y={y} width={X(kama) - X(0)} height={h} fill={K.blue} fillOpacity={0.3} stroke={K.ink} />
          <rect x={X(kama)} y={y} width={X(free) - X(kama)} height={h} fill={K.green} fillOpacity={0.3} stroke={K.ink} />
          <rect x={X(free)} y={y} width={X(free + bond) - X(free)} height={h} fill={K.red} fillOpacity={0.45} stroke={K.ink} />
          <Force x1={x0 - 60} y1={y + h / 2} x2={x0 - 24} y2={y + h / 2} c={K.violet} arrow={c.arrow} w={4} label="T" lx={x0 - 66} ly={y + h / 2 - 12} a="middle" />
          <Ln x1={X(kama)} y1={y - 62} x2={X(kama)} y2={y + h + 20} c={K.orange} w={2.4} d="7 4" />
          <Tx x={X(kama) + 4} y={y - 66} s={13} c={K.orange} b>{t("kayma yüzeyi", "failure plane")}</Tx>
          <Ln x1={X(free)} y1={y - 44} x2={X(free)} y2={y + h + 44} c={K.ink} w={1.2} d="4 4" />
          <Tx x={X(kama / 2)} y={y + h / 2 + 5} a="middle" s={13}>L_kama</Tx>
          <Tx x={(X(kama) + X(free)) / 2} y={y + h / 2 + 5} a="middle" s={13}>χ</Tx>
          <Tx x={(X(free) + X(free + bond)) / 2} y={y + h / 2 + 5} a="middle" s={14} b c={K.red}>{t("kök boyu L_kök", "bond length L_b")}</Tx>
          <Dim x1={X(0)} y1={y - 16} x2={X(free)} y2={y - 16} label={t("serbest boy ≥ 4,5 m", "free length ≥ 4.5 m")} />
          <Dim x1={X(free)} y1={y - 16} x2={X(free + bond)} y2={y - 16} label={t("kök boyu (enjeksiyonla zemine kenetli)", "bond length (grouted into the soil)")} c={K.red} />
          <Dim x1={X(0)} y1={y + h + 76} x2={X(free + bond)} y2={y + h + 76} label="L_toplam = L_serbest + L_kök" />
          {linspace(0, 1, 7).slice(0, 7).map((v, i) => { const xx = X(free) + 10 + v * (X(free + bond) - X(free) - 20); return <Ln key={i} x1={xx} y1={y + h + 4} x2={xx} y2={y + h + 24} c={K.red} w={2} end={c.arrow(K.red)} />; })}
          <Tx x={X(free + bond / 2)} y={y + h + 40} a="middle" s={13} c={K.red}>q_u</Tx>
          <Tx x={14} y={26} b>{t("Tendon boyunca bölgeler", "Zones along the tendon")}</Tx>
          <Tx x={14} y={y + h + 116} s={14}>{t("Örnek: L_serbest = 4,5 m (en az), L_kök = 8,90 m, T = 445,2 kN.", "Example: L_free = 4.5 m (minimum), L_bond = 8.90 m, T = 445.2 kN.")}</Tx>
          <Tx x={14} y={y + h + 136} s={14} c={K.mut}>{t("Yük yalnız kök boyunda zemine aktarılır; serbest boy kayma yüzeyini aşmalıdır.", "Load transfers to the soil only along the bond length; the free length must reach beyond the failure plane.")}</Tx>
          <Tx x={14} y={y + h + 156} s={13} c={K.mut}>{t("L_kama / χ ayrımı şematiktir.", "The L_kama / χ split is schematic.")}</Tx>
        </>
      )}
    </Fig>
  );
}
