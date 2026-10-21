import { Ang, Chart, Concrete, Dim, Fig, Force, K, Ln, Poly, Soil, Tx, WaterLevel, linspace } from "./kit";

const rad = (d: number) => (d * Math.PI) / 180;
const nq = (p: number) => Math.exp(Math.PI * Math.tan(rad(p))) * Math.tan(rad(45 + p / 2)) ** 2;
const nc = (p: number) => (p === 0 ? 5.14 : (nq(p) - 1) / Math.tan(rad(p)));
const f1 = (v: number) => v.toFixed(1).replace(".", ",");
const f2 = (v: number) => v.toFixed(2).replace(".", ",");

/* ───────────── Bearing capacity ───────────── */

export function BearZones() {
  const phi = 30, cx = 320, B = 140, gy = 110, fy = 140, ap = fy + (B / 2) * Math.tan(rad(phi));
  const px = cx + B / 2, tanp = Math.tan(rad(45 - phi / 2));
  const reach = (ap - gy) / tanp;
  return (
    <Fig label="Terzaghi failure zones under a strip footing">
      {(c) => (
        <>
          <Soil x={30} y={gy} w={580} h={250} c={c} />
          <rect x={30} y={gy} width={580} height={fy - gy} fill={K.bg} opacity={0.0} />
          <Concrete x={cx - B / 2} y={fy - 22} w={B} h={22} c={c} />
          <Force x1={cx} y1={62} x2={cx} y2={fy - 24} c={K.ink} arrow={c.arrow} w={4} label="Q" lx={cx + 12} ly={80} />
          {[60, 120, 180].map((x) => <Ln key={x} x1={x} y1={gy - 30} x2={x} y2={gy - 3} c={K.blue} w={2} end={c.arrow(K.blue)} />)}
          {[460, 520, 580].map((x) => <Ln key={x} x1={x} y1={gy - 30} x2={x} y2={gy - 3} c={K.blue} w={2} end={c.arrow(K.blue)} />)}
          <Tx x={40} y={gy - 40} c={K.blue} b>q = γ·D</Tx><Tx x={40} y={gy - 58} c={K.blue}>taban üstündeki zemin yük gibi davranır</Tx><Dim x1={575} y1={gy} x2={575} y2={fy} label="D" off={8} />
          {/* zone I: active wedge */}
          <Poly pts={[[cx - B / 2, fy], [cx + B / 2, fy], [cx, ap]]} fill={K.green} o={0.35} />
          {/* zone II: radial fans */}
          <path d={`M${cx} ${ap} Q ${cx + 100} ${ap + 10} ${px + reach * 0.55} ${fy + 4} L ${px} ${fy} Z`} fill={K.orange} fillOpacity={0.3} stroke={K.orange} strokeWidth={1.8} />
          <path d={`M${cx} ${ap} Q ${cx - 100} ${ap + 10} ${cx - B / 2 - reach * 0.55} ${fy + 4} L ${cx - B / 2} ${fy} Z`} fill={K.orange} fillOpacity={0.3} stroke={K.orange} strokeWidth={1.8} />
          {/* zone III: passive wedges */}
          <Poly pts={[[px, fy], [px + reach * 0.55, fy + 4], [px + reach, gy]]} fill={K.violet} o={0.3} />
          <Poly pts={[[cx - B / 2, fy], [cx - B / 2 - reach * 0.55, fy + 4], [cx - B / 2 - reach, gy]]} fill={K.violet} o={0.3} />
          <Tx x={cx} y={fy + 22} a="middle" c={K.green} b>I</Tx>
          <Tx x={cx + 95} y={ap + 4} a="middle" c={K.orange} b>II</Tx><Tx x={cx - 95} y={ap + 4} a="middle" c={K.orange} b>II</Tx>
          <Tx x={px + reach * 0.6} y={fy - 4} a="middle" c={K.violet} b>III</Tx><Tx x={cx - B / 2 - reach * 0.6} y={fy - 4} a="middle" c={K.violet} b>III</Tx>
          <Ang x={cx - B / 2} y={fy} r={34} from={-30} to={0} label="φ" c={K.green} />
          <Dim x1={cx - B / 2} y1={fy - 30} x2={cx + B / 2} y2={fy - 30} label="B" />
          <Tx x={30} y={290} b>I:  aktif kama (zemin tabanda sıkışıp aşağı doğru itilir)</Tx>
          <Tx x={30} y={312} b>II: radyal kayma bölgesi (logaritmik spiral)</Tx>
          <Tx x={30} y={334} b>III: pasif kama (yanlara ve yukarı itilir)</Tx>
          <Tx x={30} y={372} c={K.mut}>q_ult = c·Nc + q·Nq + ½·γ·B·Nγ     (kohezyon + yan yük + zemin ağırlığı)</Tx>
        </>
      )}
    </Fig>
  );
}

export function BearFailureWedge() { return <BearZones />; }

export function BearEccentricWidth() {
  const B = 220, e = 34, x0 = 190, fy = 120;
  const qmax = 1 + (6 * e) / B, qmin = 1 - (6 * e) / B, hh = 60;
  return (
    <Fig label="Eccentric load and effective width">
      {(c) => (
        <>
          <Soil x={30} y={fy + 20} w={580} h={120} c={c} />
          <Concrete x={x0} y={fy} w={B} h={20} c={c} />
          <Force x1={x0 + B / 2 + e} y1={36} x2={x0 + B / 2 + e} y2={fy - 2} c={K.ink} arrow={c.arrow} w={4} label="Q" lx={x0 + B / 2 + e + 10} ly={62} />
          <Ln x1={x0 + B / 2} y1={fy - 30} x2={x0 + B / 2} y2={fy + 70} c={K.mut} w={1.2} d="5 3" />
          <Dim x1={x0 + B / 2} y1={fy - 22} x2={x0 + B / 2 + e} y2={fy - 22} label="e" c={K.red} />
          <Poly pts={[[x0, fy + 20], [x0 + B, fy + 20], [x0 + B, fy + 20 + hh * qmax], [x0, fy + 20 + hh * qmin]]} fill={K.blue} o={0.4} />
          <Tx x={x0 - 8} y={fy + 20 + hh * qmin + 4} a="end" c={K.blue} b>q_min</Tx><Tx x={x0 + B + 8} y={fy + 20 + hh * qmax + 4} c={K.blue} b>q_max</Tx>
          <Dim x1={x0} y1={fy + 164} x2={x0 + B} y2={fy + 164} label="B (temel genişliği)" />
          <Ln x1={x0} y1={fy + 178} x2={x0 + B - 2 * e} y2={fy + 178} c={K.orange} w={6} />
          <Tx x={x0 + (B - 2 * e) / 2} y={fy + 198} a="middle" c={K.orange} b>B′ = B − 2e (etkin genişlik)</Tx>
          <Tx x={30} y={326}>e = M / Q  (momentin yük merkezinden uzaklığı)</Tx>
          <Tx x={30} y={346}>q = Q/B · (1 ± 6e/B)      e ≤ B/6 ⇒ yamuk,  e &gt; B/6 ⇒ taban kısmen ayrılır</Tx>
          <Tx x={30} y={366}>Taşıma gücü, yükün tam ortada olduğu B′ genişliğindeki temel için hesaplanır.</Tx>
        </>
      )}
    </Fig>
  );
}

export function BearWaterCases() {
  return (
    <Fig label="Three groundwater cases">
      {(c) => <Panels c={c} />}
    </Fig>
  );
}

function Panels({ c }: { c: import("./kit").Ctx }) {
  const defs: { x0: number; title: string; wy: number; l1: string; l2: string }[] = [
    { x0: 12, title: "1  Taban üstünde", wy: 70, l1: "q = γ·D − (su altı kısım için γ′)", l2: "Nγ terimi: γ′ kullanılır" },
    { x0: 218, title: "2  D ile D+B arası", wy: 156, l1: "q = γ·D  (su yok)", l2: "γ_eff = γ′ + (zw/B)(γ − γ′)" },
    { x0: 424, title: "3  D+B'den derin", wy: 300, l1: "q = γ·D", l2: "Nγ terimi: γ kullanılır" },
  ];
  return (
    <>
      {defs.map((d) => (
        <g key={d.title}>
          <rect x={d.x0} y={34} width={200} height={296} fill="none" stroke={K.grid} rx={4} />
          <Tx x={d.x0 + 100} y={52} a="middle" b>{d.title}</Tx>
          <Soil x={d.x0 + 4} y={110} w={192} h={216} c={c} />
          <Concrete x={d.x0 + 70} y={96} w={60} h={16} c={c} />
          <rect x={d.x0 + 4} y={d.wy} width={192} height={326 - d.wy} fill={K.water} opacity={0.18} />
          <WaterLevel x={d.x0 + 4} y={d.wy} len={192} />
          <Dim x1={d.x0 + 150} y1={112} x2={d.x0 + 150} y2={188} label="B" off={-6} side="right" />
          <Tx x={d.x0 + 100} y={348} a="middle" s={13}>{d.l1}</Tx><Tx x={d.x0 + 100} y={366} a="middle" s={13} c={K.blue}>{d.l2}</Tx>
        </g>
      ))}
    </>
  );
}

export function BearFactorTrend() {
  const phis = linspace(1, 45, 44);
  return (
    <Chart
      label="Bearing capacity factors" xr={[0, 45]} yr={[1, 1000]} logY xl="içsel sürtünme açısı φ′ (°)" yl="taşıma gücü faktörleri N" xt={[0, 5, 10, 15, 20, 25, 30, 35, 40, 45]}
      series={[
        { pts: phis.map((p) => [p, nc(p)]), c: K.blue, label: "Nc" },
        { pts: phis.map((p) => [p, nq(p)]), c: K.green, label: "Nq" },
        { pts: phis.map((p) => [p, Math.max(2 * (nq(p) + 1) * Math.tan(rad(p)), 1)]), c: K.red, label: "Nγ (Vesic)" },
      ]}
      extra={(sx, sy) => <g><Ln x1={sx(30)} y1={sy(1)} x2={sx(30)} y2={sy(1000)} c={K.mut} w={1} d="4 4" /><Tx x={sx(30) + 6} y={sy(2.4)}>φ = 30°: Nc 30,1, Nq 18,4, Nγ 22,4</Tx></g>}
    />
  );
}

export function BearFactorTables() {
  const rows = [0, 10, 20, 25, 30, 35, 40];
  const cols = ["φ′ (°)", "Nc", "Nq", "Nγ Vesic", "Nγ Hansen", "Nγ Meyerhof"];
  const g = (p: number) => [p, nc(p), nq(p), 2 * (nq(p) + 1) * Math.tan(rad(p)), 1.5 * (nq(p) - 1) * Math.tan(rad(p)), (nq(p) - 1) * Math.tan(rad(1.4 * p))];
  return (
    <Fig label="Bearing capacity factors table">
      {() => (
        <>
          <rect x={30} y={30} width={580} height={36} fill={K.blue} opacity={0.18} />
          {cols.map((cName, i) => <Tx key={cName} x={52 + i * 96} y={54} b>{cName}</Tx>)}
          {rows.map((p, r) => (
            <g key={p}>
              {r % 2 === 1 && <rect x={30} y={66 + r * 34} width={580} height={34} fill={K.grid} opacity={0.2} />}
              {g(p).map((v, i) => <Tx key={i} x={52 + i * 96} y={90 + r * 34}>{i === 0 ? String(v) : f2(v)}</Tx>)}
            </g>
          ))}
          <Ln x1={30} y1={66} x2={610} y2={66} w={1.5} /><Ln x1={30} y1={66 + rows.length * 34} x2={610} y2={66 + rows.length * 34} w={1.5} />
          <Tx x={30} y={330}>Nq = e^(π tan φ′) · tan²(45° + φ′/2),    Nc = (Nq − 1) cot φ′    (φ′ = 0 için Nc = 5,14)</Tx>
          <Tx x={30} y={352}>Nγ = 2(Nq + 1) tan φ′ (Vesic),  1,5(Nq − 1) tan φ′ (Hansen),  (Nq − 1) tan(1,4φ′) (Meyerhof)</Tx>
        </>
      )}
    </Fig>
  );
}

/* ───────────── Liquefaction ───────────── */

export function LiqMechanism() {
  const stage = (x0: number, title: string, spread: number, hw: number, press: string, color: string) => (
    <g key={title}>
      <rect x={x0} y={46} width={170} height={170} fill={K.water} fillOpacity={0.12} stroke={K.grid} rx={4} />
      <Tx x={x0 + 85} y={38} a="middle" b>{title}</Tx>
      {Array.from({ length: 5 }).flatMap((_, r) => Array.from({ length: 5 }).map((__, q) => {
        const cxx = x0 + 22 + q * (24 + spread * 0.6) + (r % 2) * 11, cyy = 188 - r * (24 + spread * 0.8);
        return <circle key={`${r}-${q}`} cx={cxx} cy={cyy} r={11} fill="var(--mantine-color-yellow-3, #ffe066)" stroke={K.soilLine} strokeWidth={1.2} />;
      }))}
      <rect x={x0 + 176} y={46} width={14} height={170} fill="none" stroke={K.ink} strokeWidth={1.2} />
      <rect x={x0 + 177} y={216 - hw} width={12} height={hw} fill={color} opacity={0.7} />
      <Tx x={x0 + 85} y={236} a="middle" c={color} b>{press}</Tx>
    </g>
  );
  return (
    <Fig label="Liquefaction mechanism in three stages">
      {() => (
        <>
          {stage(14, "1  Sarsıntıdan önce", 0, 40, "u ≈ hidrostatik", K.blue)}
          {stage(222, "2  Sarsıntı başlar", 6, 95, "u artıyor", K.orange)}
          {stage(432, "3  u = σv", 14, 160, "σ′ = σ − u → 0", K.red)}
          <Tx x={14} y={282}>Taneler arası temas gerilmesi (σ′) boşluk suyu basıncı u kadar azalır.</Tx>
          <Tx x={14} y={304}>σ′ sıfıra inince taneler birbirini taşımaz, zemin sıvı gibi davranır.</Tx>
          <Tx x={14} y={334} c={K.mut}>Sağdaki şeffaf borular (piezometre): u arttıkça su seviyesi yükselir.</Tx>
          <Tx x={14} y={356} c={K.mut}>Tane aralıklarının açılması hacim artışı değil, temasın kaybıdır (drenaj yoktur).</Tx>
        </>
      )}
    </Fig>
  );
}

export function LiqCsrCrr() {
  const csr = (z: number) => 0.13 + 0.006 * z;
  const crr = (z: number) => (z < 4 ? 0.22 : z < 8 ? 0.10 : z < 11 ? 0.17 : 0.30);
  const zs = linspace(0, 14, 140);
  return (
    <Chart
      label="Cyclic stress ratio demand and resistance with depth (schematic)" xr={[0, 0.5]} yr={[0, 14]} flipY xl="döngüsel gerilme oranı" yl="derinlik z (m)"
      series={[
        { pts: zs.map((z) => [csr(z), z]), c: K.red, label: "CSR (talep)" },
        { pts: zs.map((z) => [crr(z), z]), c: K.blue, label: "CRR (direnç)" },
      ]}
      extra={(sx, sy) => (
        <g>
          <polygon points={`${sx(crr(4.1))},${sy(4)} ${sx(csr(4))},${sy(4)} ${sx(csr(8))},${sy(8)} ${sx(crr(7.9))},${sy(8)}`} fill={K.red} opacity={0.2} />
          <Tx x={sx(0.33)} y={sy(6)} c={K.red} b>CRR &lt; CSR ⇒ FS &lt; 1</Tx><Tx x={sx(0.33)} y={sy(6.9)} c={K.red}>sıvılaşma beklenir</Tx>
          <Tx x={sx(0.07)} y={sy(13.2)}>sıkı kum tabakası: CRR yüksek</Tx>
        </g>
      )}
    />
  );
}

export const rdYoud = (z: number) => (z <= 9.15 ? 1 - 0.00765 * z : z <= 23 ? 1.174 - 0.0267 * z : 0.744 - 0.008 * z);
export const rdBI = (z: number, m: number) => Math.exp(-1.012 - 1.126 * Math.sin(z / 11.73 + 5.133) + m * (0.106 + 0.118 * Math.sin(z / 11.28 + 5.142)));

export function LiqRdDepth() {
  return (
    <Chart
      label="rd versus depth" xr={[0.4, 1]} yr={[0, 34]} flipY xl="gerilme azaltma katsayısı rd" yl="derinlik z (m)" xt={[0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1]}
      series={[
        { pts: linspace(0, 30, 60).map((z) => [rdYoud(z), z]), c: K.blue, label: "Youd ve diğ. 2001" },
        ...[6.5, 7.5, 8.5].map((m, i) => ({ pts: linspace(0, 34, 68).map((z) => [rdBI(z, m), z] as [number, number]), c: [K.green, K.orange, K.red][i], d: "7 4", label: `Boulanger-Idriss 2014, M = ${f1(m)}` })),
      ]}
    />
  );
}

export function LiqFsProfile() {
  const pts: [number, number][] = [[0.6, 2], [0.9, 4], [1.4, 6], [0.8, 8], [2.4, 10], [3, 12]];
  return (
    <Chart
      label="Factor of safety profile (schematic)" xr={[0, 3.5]} yr={[0, 14]} flipY xl="güvenlik sayısı FS" yl="derinlik z (m)" series={[]}
      extra={(sx, sy) => (
        <g>
          <rect x={sx(0)} y={sy(0)} width={sx(1) - sx(0)} height={sy(14) - sy(0)} fill={K.red} opacity={0.1} />
          <Ln x1={sx(1)} y1={sy(0)} x2={sx(1)} y2={sy(14)} c={K.red} w={2.4} d="7 4" /><Tx x={sx(1) + 8} y={sy(0.8)} c={K.red} b>FS = 1</Tx>
          <polyline fill="none" stroke={K.ink} strokeWidth={1.4} points={pts.map(([f, d]) => `${sx(f)},${sy(d)}`).join(" ")} />
          {pts.map(([f, d], i) => <circle key={i} cx={sx(f)} cy={sy(d)} r={7} fill={f < 1 ? K.red : f < 1.2 ? K.orange : K.green} stroke={K.bg} strokeWidth={2} />)}
          <Tx x={sx(1.7)} y={sy(2)} c={K.red}>● FS &lt; 1: sıvılaşabilir</Tx><Tx x={sx(1.7)} y={sy(3)} c={K.orange}>● 1 ≤ FS &lt; 1,2: sınırda</Tx><Tx x={sx(1.7)} y={sy(4)} c={K.green}>● FS ≥ 1,2: güvenli</Tx>
        </g>
      )}
    />
  );
}

const crrClean = (n: number) => (n >= 30 ? NaN : 1 / (34 - n) + n / 135 + 50 / (10 * n + 45) ** 2 - 1 / 200);
const fcShift = (fc: number) => (fc <= 5 ? [0, 1] : fc >= 35 ? [5, 1.2] : [Math.exp(1.76 - 190 / fc ** 2), 0.99 + fc ** 1.5 / 1000]);

export function LiqSptCorrelation() {
  const n = linspace(2, 29, 54);
  const pts = (fc: number) => { const [a, b] = fcShift(fc); return n.map((v) => [v, crrClean(a + b * v)] as [number, number]).filter(([, y]) => Number.isFinite(y) && y < 0.6); };
  return (
    <Chart
      label="CRR versus corrected SPT resistance" xr={[0, 30]} yr={[0, 0.6]} xl="düzeltilmiş SPT darbe sayısı (N1)60" yl="CRR (Mw = 7,5, σ′v = 1 atm)"
      series={[
        { pts: pts(5), c: K.blue, label: "ince dane FC ≤ %5" },
        { pts: pts(15), c: K.green, label: "FC = %15" },
        { pts: pts(35), c: K.red, label: "FC ≥ %35" },
      ]}
      extra={(sx, sy) => <g><Ln x1={sx(30)} y1={sy(0)} x2={sx(30)} y2={sy(0.6)} c={K.orange} w={2} d="6 4" /><Tx x={sx(30) - 6} y={sy(0.03)} a="end" c={K.orange} b>(N1)60cs ≥ 30: sıvılaşmaz</Tx></g>}
    />
  );
}

export function LiqMsfCurve() {
  const m = linspace(5.5, 8.5, 30);
  return (
    <Chart
      label="Magnitude scaling factor" xr={[5.5, 8.5]} yr={[0.5, 2]} xl="moment büyüklüğü Mw" yl="deprem büyüklüğü ölçek faktörü MSF"
      series={[
        { pts: m.map((x) => [x, Math.min(1.8, 6.9 * Math.exp(-x / 4) - 0.058)]), c: K.blue, label: "Idriss" },
        { pts: m.map((x) => [x, Math.min(1.8, (x / 7.5) ** -2.56)]), c: K.red, d: "7 4", label: "Andrus–Stokoe" },
      ]}
      extra={(sx, sy) => <g><Ln x1={sx(7.5)} y1={sy(0.5)} x2={sx(7.5)} y2={sy(2)} c={K.mut} w={1} d="4 4" /><Tx x={sx(7.5) + 8} y={sy(0.62)}>Mw = 7,5 için MSF = 1</Tx></g>}
    />
  );
}

export function LiqLpiWeight() {
  return (
    <Chart
      label="LPI depth weighting" xr={[0, 10]} yr={[0, 20]} flipY xl="derinlik ağırlığı w(z)" yl="derinlik z (m)"
      series={[{ pts: [[10, 0], [0, 20]], c: K.blue, label: "w(z) = 10 − 0,5·z" }]}
      extra={(sx, sy) => <g><Tx x={sx(5.4)} y={sy(11)}>z = 20 m ve altında w = 0</Tx><Tx x={sx(0.2)} y={sy(1.4)} b>LPI = ∫ F(z)·w(z) dz</Tx><Tx x={sx(0.2)} y={sy(2.5)}>F = 1 − FS (FS &lt; 1), aksi halde 0</Tx></g>}
    />
  );
}

/* ───────────── Classification ───────────── */

export function ClsGradingCurve() {
  const pts: [number, number][] = [[0.01, 3], [0.075, 8], [0.2, 18], [0.5, 40], [1, 62], [2, 80], [4.75, 94], [10, 100]];
  return (
    <Chart
      label="Particle size distribution curve" xr={[0.01, 10]} yr={[0, 100]} logX xl="tane çapı (mm, logaritmik)" yl="elekten geçen (%)"
      series={[{ pts, c: K.blue }]}
      extra={(sx, sy) => (
        <g>
          {[[10, 0.075], [30, 0.35], [60, 0.8]].map(([p, d]) => (
            <g key={p}><Ln x1={sx(0.01)} y1={sy(p)} x2={sx(d)} y2={sy(p)} c={K.orange} w={1.4} d="4 4" /><Ln x1={sx(d)} y1={sy(p)} x2={sx(d)} y2={sy(0)} c={K.orange} w={1.4} d="4 4" />
              <Tx x={sx(d) + 5} y={sy(0) - 8} c={K.orange} b>D{p}</Tx></g>
          ))}
          <Ln x1={sx(4.75)} y1={sy(0)} x2={sx(4.75)} y2={sy(100)} c={K.red} w={1.4} d="5 4" /><Tx x={sx(4.75) - 6} y={sy(25)} a="end" c={K.red}>No. 4 elek: çakıl | kum</Tx>
          <Ln x1={sx(0.075)} y1={sy(0)} x2={sx(0.075)} y2={sy(100)} c={K.green} w={1.4} d="5 4" /><Tx x={sx(0.075) + 6} y={sy(92)} c={K.green}>No. 200: kum | ince</Tx>
          <Tx x={sx(0.012)} y={sy(80)} b>Cu = D60 / D10</Tx><Tx x={sx(0.012)} y={sy(72)} b>Cc = D30² / (D10·D60)</Tx>
        </g>
      )}
    />
  );
}

export function ClassUscsPlasticity() {
  return (
    <Chart
      label="Casagrande plasticity chart" xr={[0, 100]} yr={[0, 60]} xl="likit limit LL (%)" yl="plastisite indisi PI (%)" xt={[0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100]}
      series={[
        { pts: [[20, 0], [25.5, 4], [100, 58.4]] as [number, number][], c: K.blue, label: "A-çizgisi" },
        { pts: [[16, 0], [16, 7.2], [74.6, 60]] as [number, number][], c: K.red, d: "7 4", label: "U-çizgisi" },
      ]}
      extra={(sx, sy) => (
        <g>
          <rect x={sx(10)} y={sy(7)} width={sx(29.5) - sx(10)} height={sy(4) - sy(7)} fill={K.orange} opacity={0.4} />
          <Tx x={sx(31)} y={sy(5)} c={K.orange} b>CL-ML</Tx>
          <Ln x1={sx(50)} y1={sy(0)} x2={sx(50)} y2={sy(60)} c={K.mut} w={1.2} d="4 4" /><Tx x={sx(25)} y={sy(52)} a="middle" b>düşük plastisite</Tx><Tx x={sx(52)} y={sy(9)}>A: PI = 0,73 (LL − 20)</Tx><Tx x={sx(52)} y={sy(4)}>U: PI = 0,9 (LL − 8)</Tx><Tx x={sx(75)} y={sy(52)} a="middle" b>yüksek plastisite</Tx>
          <Tx x={sx(34)} y={sy(22)} c={K.green} b>CL</Tx><Tx x={sx(70)} y={sy(44)} c={K.green} b>CH</Tx><Tx x={sx(32)} y={sy(2.3)} c={K.violet} b>ML / OL</Tx><Tx x={sx(70)} y={sy(14)} c={K.violet} b>MH / OH</Tx>
        </g>
      )}
    />
  );
}

export function ClassIcChart() {
  const circle = (r: number) => {
    const pts: [number, number][] = [];
    for (let a = 0; a <= 360; a += 2) { const lf = -1.22 + r * Math.cos(rad(a)), lq = 3.47 + r * Math.sin(rad(a)); if (lf >= -1 && lf <= 1 && lq >= 0 && lq <= 3) pts.push([10 ** lf, 10 ** lq]); }
    return pts;
  };
  const rs = [1.31, 2.05, 2.6, 2.95, 3.6];
  return (
    <Chart
      label="Robertson SBTn chart with Ic contours" xr={[0.1, 10]} yr={[1, 1000]} logX logY xl="normalize sürtünme oranı Fr (%)" yl="normalize uç direnci Qtn"
      series={rs.map((r, i) => ({ pts: circle(r), c: [K.red, K.orange, K.green, K.blue, K.violet][i], w: 2.2 }))}
      extra={(sx, sy) => (
        <g>
          {[[1.31, "Ic = 1,31", 0.13], [2.05, "2,05", 0.2], [2.6, "2,60", 0.35], [2.95, "2,95", 0.3], [3.6, "3,60", 0.7]].map(([r, l, fr]) => {
            const lf = Math.log10(fr as number), q = 10 ** (3.47 - Math.sqrt((r as number) ** 2 - (lf + 1.22) ** 2));
            return <Tx key={l as string} x={sx(fr as number)} y={sy(q) - 8} b>{l as string}</Tx>;
          })}
          <Tx x={sx(0.14)} y={sy(500)} c={K.mut}>iri daneli (kum, çakıl)</Tx><Tx x={sx(3.5)} y={sy(6)} c={K.mut}>ince daneli (kil)</Tx>
          <circle cx={sx(1)} cy={sy(50)} r={6} fill={K.ink} /><Tx x={sx(1) + 10} y={sy(50) + 22}>örnek: Fr = %1, Qtn = 50 ⇒ Ic = 2,15</Tx>
        </g>
      )}
    />
  );
}

export function ClassFcFromIc() {
  const ic = linspace(1.2, 3.6, 24);
  return (
    <Chart
      label="Fines content from Ic" xr={[1.2, 3.6]} yr={[0, 100]} xl="zemin davranış tipi indeksi Ic" yl="tahmini ince dane oranı FC (%)"
      series={[{ pts: ic.map((v) => [v, Math.min(100, Math.max(0, 80 * v - 137))]), c: K.blue, label: "FC = 80·(Ic + C_FC) − 137" }]}
      extra={(sx, sy) => <g><Tx x={sx(1.3)} y={sy(8)}>Ic ≤ 1,71: FC = 0</Tx><Tx x={sx(2.7)} y={sy(92)} a="start">Ic ≥ 2,96: FC = %100</Tx></g>}
    />
  );
}
