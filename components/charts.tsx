export function LineChart({ vals, labels, min, max, fmt = (v: number) => String(v), w = 560, h = 180 }: { vals: number[]; labels: string[]; min: number; max: number; fmt?: (v: number) => string; w?: number; h?: number }) {
  const pl = 38, pr = 12, pt = 16, pb = 24, iw = w - pl - pr, ih = h - pt - pb;
  const x = (i: number) => pl + i * (iw / Math.max(1, vals.length - 1)), y = (v: number) => pt + ih - ((v - min) / (max - min)) * ih;
  const pts = vals.map((v, i) => `${x(i)},${y(v)}`).join(" "); const li = vals.length - 1;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" role="img">
      <defs><linearGradient id="ga" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="var(--accent)" stopOpacity=".22" /><stop offset="1" stopColor="var(--accent)" stopOpacity="0" /></linearGradient></defs>
      {[0, 1, 2, 3, 4].map((i) => { const v = min + ((max - min) * i) / 4; return <g key={i}><line className="grid-l" x1={pl} x2={w - pr} y1={y(v)} y2={y(v)} /><text x={pl - 6} y={y(v) + 4} textAnchor="end">{fmt(v)}</text></g>; })}
      {labels.map((l, i) => <text key={i} x={x(i)} y={h - 6} textAnchor="middle">{l}</text>)}
      {vals.length > 1 && <polygon points={`${pl},${pt + ih} ${pts} ${x(li)},${pt + ih}`} fill="url(#ga)" />}
      <polyline points={pts} fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinejoin="round" />
      {li >= 0 && <><circle cx={x(li)} cy={y(vals[li])} r="4.5" fill="var(--accent)" stroke="var(--panel)" strokeWidth="2" /><text x={x(li) - 8} y={y(vals[li]) - 10} textAnchor="end" style={{ fill: "var(--fg)", fontWeight: 700 }}>{fmt(vals[li])}</text></>}
    </svg>
  );
}
export function Bars({ a, b, labels, max, w = 560, h = 200 }: { a: number[]; b: number[]; labels: string[]; max: number; w?: number; h?: number }) {
  const pl = 44, pr = 10, pt = 12, pb = 24, iw = w - pl - pr, ih = h - pt - pb;
  const y = (v: number) => pt + ih - (v / max) * ih, bw = iw / Math.max(1, a.length);
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" role="img">
      {[0, 0.25, 0.5, 0.75, 1].map((f) => <g key={f}><line className="grid-l" x1={pl} x2={w - pr} y1={y(max * f)} y2={y(max * f)} /><text x={pl - 6} y={y(max * f) + 4} textAnchor="end">₱{((max * f) / 1e6).toFixed(1)}M</text></g>)}
      {a.map((v, i) => { const x0 = pl + i * bw + bw * 0.16, ww = bw * 0.32; return <g key={i}>
        <rect x={x0} y={y(v)} width={ww} height={ih - (y(v) - pt)} rx="2" fill="var(--accent)" />
        <rect x={x0 + ww + 1} y={y(b[i])} width={ww} height={ih - (y(b[i]) - pt)} rx="2" fill="var(--warn)" opacity=".75" />
        <text x={pl + i * bw + bw / 2} y={h - 6} textAnchor="middle">{labels[i]}</text></g>; })}
    </svg>
  );
}
