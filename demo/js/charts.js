/* ============================================================
 * charts.js · 纯 SVG / DOM 图表（雷达图 / 双向条形图 / 条形图 /
 * MBTI v2 四维偏好雷达 / 偏好强度尺）
 * 零外部依赖；文本字体显式指定 CJK 字体栈以适配中文。
 * ============================================================ */
(function (global) {
  'use strict';
  const FONT = 'Noto Sans CJK SC, Source Han Sans SC, PingFang SC, Microsoft YaHei, sans-serif';
  const NS = 'http://www.w3.org/2000/svg';

  function el(tag, attrs, parent) {
    const node = document.createElementNS(NS, tag);
    for (const k in attrs) node.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(node);
    return node;
  }
  function clear(el) { while (el.firstChild) el.removeChild(el.firstChild); }

  /* ---------- 雷达图 ---------- */
  function radar(host, opt) {
    clear(host);
    const axes = opt.axes || [];
    if (!axes.length) return;
    const cx = 160, cy = 158, R = 118;
    const n = axes.length;
    const angle = function (i) { return -Math.PI / 2 + (i * 2 * Math.PI) / n; };
    const point = function (i, r) { return { x: cx + r * Math.cos(angle(i)), y: cy + r * Math.sin(angle(i)) }; };
    const colors = opt.colors || ['#9A7B60', '#77836B', '#B08D57', '#7D8A97'];

    const svg = el('svg', { viewBox: '0 0 320 320', role: 'img' });
    el('title', {}, svg).textContent = opt.title || '维度雷达图';
    // 网格环
    [0.25, 0.5, 0.75, 1].forEach(function (f) {
      const pts = [];
      for (let i = 0; i < n; i++) { const p = point(i, R * f); pts.push(p.x + ',' + p.y); }
      el('polygon', { points: pts.join(' '), fill: 'none', stroke: '#E3DACA', 'stroke-width': 1 }, svg);
    });
    // 轴线
    for (let i = 0; i < n; i++) {
      const p = point(i, R);
      el('line', { x1: cx, y1: cy, x2: p.x, y2: p.y, stroke: '#E9E1D1', 'stroke-width': 1 }, svg);
    }
    // 数值多边形
    const vals = [];
    for (let i = 0; i < n; i++) {
      const f = Math.max(0, Math.min(1, (axes[i].value || 0) / 100));
      const p = point(i, R * f);
      vals.push(p.x + ',' + p.y);
    }
    const g = el('g', {}, svg);
    el('polygon', { points: vals.join(' '), fill: colors[0], 'fill-opacity': 0.18, stroke: colors[0], 'stroke-width': 2, 'stroke-linejoin': 'round' }, g);
    // 数据点
    for (let i = 0; i < n; i++) {
      const f = Math.max(0, Math.min(1, (axes[i].value || 0) / 100));
      const p = point(i, R * f);
      el('circle', { cx: p.x, cy: p.y, r: 3.4, fill: colors[i % colors.length] }, g);
    }
    // 轴标签（外侧）
    for (let i = 0; i < n; i++) {
      const p = point(i, R + 24);
      const short = axes[i].short || axes[i].label;
      const t = el('text', { x: p.x, y: p.y, 'text-anchor': 'middle', 'dominant-baseline': 'middle', 'font-size': 12, fill: '#5C564B', 'font-family': FONT }, svg);
      t.textContent = short;
      const v = el('text', { x: p.x, y: p.y + 16, 'text-anchor': 'middle', 'dominant-baseline': 'middle', 'font-size': 11, fill: '#9A7B60', 'font-family': FONT, 'font-weight': 700 }, svg);
      v.textContent = axes[i].value + '%';
    }
    host.appendChild(svg);
  }

  /* ---------- 双向条形图（MBTI 二分维度） ---------- */
  function splitBars(el, opt) {
    clear(el);
    const rows = opt.axes || [];
    const colorA = opt.colorA || '#9A7B60';
    const colorB = opt.colorB || '#B08D57';
    const wrap = el.appendChild(document.createElement('div'));
    wrap.style.cssText = 'display:flex;flex-direction:column;gap:20px';
    rows.forEach(function (r) {
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;align-items:center;gap:14px';
      const dim = document.createElement('div');
      dim.style.cssText = 'font-size:12px;color:#857B6D;font-weight:600;min-width:64px';
      dim.textContent = r.label;
      row.appendChild(dim);
      const main = document.createElement('div');
      main.style.cssText = 'flex:1';
      const track = document.createElement('div');
      track.style.cssText = 'display:flex;height:10px;border-radius:99px;overflow:hidden;background:#EAE3D2';
      const left = document.createElement('div');
      left.style.cssText = 'height:100%;width:' + r.aValue + '%;background:' + colorA + ';transition:width 1s cubic-bezier(.25,.6,.25,1)';
      const right = document.createElement('div');
      right.style.cssText = 'height:100%;flex:1;background:' + colorB + ';transition:width 1s cubic-bezier(.25,.6,.25,1)';
      track.appendChild(left); track.appendChild(right);
      main.appendChild(track);
      const labels = document.createElement('div');
      labels.style.cssText = 'display:flex;justify-content:space-between;font-size:11px;margin-top:5px;color:#857B6D';
      const la = document.createElement('span');
      la.textContent = r.aLabel;
      const lb = document.createElement('span');
      lb.textContent = r.bLabel;
      labels.appendChild(la); labels.appendChild(lb);
      main.appendChild(labels);
      row.appendChild(main);
      wrap.appendChild(row);
    });
  }

  /* ---------- 横向条形图（通用） ---------- */
  function bars(el, opt) {
    clear(el);
    const rows = opt.axes || [];
    const color = opt.color || '#77836B';
    const wrap = el.appendChild(document.createElement('div'));
    wrap.style.cssText = 'display:flex;flex-direction:column;gap:14px';
    rows.forEach(function (r) {
      const row = document.createElement('div');
      const head = document.createElement('div');
      head.style.cssText = 'display:flex;justify-content:space-between;font-size:12px;margin-bottom:5px';
      const l = document.createElement('span');
      l.textContent = r.short || r.label;
      l.style.cssText = 'font-weight:600;color:#38322A';
      const v = document.createElement('span');
      v.textContent = r.value + '%';
      v.style.cssText = 'color:#857B6D';
      head.appendChild(l); head.appendChild(v);
      row.appendChild(head);
      const track = document.createElement('div');
      track.style.cssText = 'height:9px;border-radius:99px;background:#EAE3D2;overflow:hidden';
      const fill = document.createElement('div');
      fill.style.cssText = 'height:100%;width:0;border-radius:99px;background:' + color + ';transition:width 1s cubic-bezier(.25,.6,.25,1)';
      track.appendChild(fill);
      row.appendChild(track);
      wrap.appendChild(row);
      requestAnimationFrame(function () { fill.style.width = r.value + '%'; });
    });
  }

  /* ---------- MBTI v2：四维偏好雷达（带方向） ----------
   * dims 每项：{ score(-24..24), fav:{k,name}, unfav:{k,name} }
   * 每维画一条穿过中心的直径：
   *   θ 端 = 维度 A 极点字母(E/S/T/J)，θ+180° 端 = B 极点字母(I/N/F/P)
   *   score<0 → 数据点偏向 θ 端；score>0 → 偏向 θ+180° 端
   *   强度用非线性刻度：半径 = R × (|score|/24)^0.7。
   *   原因：多数用户的偏差集中在 2–14 分，若按线性比例，|score|/24 只有
   *   8%–58%，雷达会贴向中心、看不出差异；0.7 次方在小值段放大间距，
   *   让“轻微偏好”也能在图上可读。刻度环按同一映射绘制，边界仍对应 6/14/24。 */
  const POLAR_K = 0.7;
  function polarRadar(host, opt) {
    clear(host);
    const dims = opt.dims || [];
    if (dims.length < 2) return;
    const W = 360, H = 360, cx = W / 2, cy = H / 2, R = 110;
    const pt = function (deg, rad) {
      const a = (deg - 90) * Math.PI / 180; // 屏幕坐标：0°=正上方
      return { x: cx + rad * Math.cos(a), y: cy + rad * Math.sin(a) };
    };
    const kRad = function (score) { return R * Math.pow(Math.max(0, Math.min(24, Math.abs(score))) / 24, POLAR_K); };
    const svg = el('svg', { viewBox: '0 0 ' + W + ' ' + H, role: 'img' });
    el('title', {}, svg).textContent = 'MBTI 四维偏好雷达';

    // 网格环（强度刻度：6/14/24 为 轻微/中等/明显 边界；用同一非线性刻度定位）
    [6, 14, 24].forEach(function (v) {
      const r = kRad(v);
      el('circle', { cx: cx, cy: cy, r: r, fill: 'none', stroke: '#E3DACA', 'stroke-width': 1, 'stroke-dasharray': v === 24 ? 'none' : '2 5' }, svg);
    });

    const COLOR_A = '#9A7B60', COLOR_B = '#B08D57', FAINT = '#D3C7B2';
    const aOf = function (d) { return d.score < 0 ? d.fav.k : d.unfav.k; };
    const bOf = function (d) { return d.score < 0 ? d.unfav.k : d.fav.k; };

    dims.forEach(function (d, i) {
      const deg = i * 45; // 0/45/90/135 → 上、右上、右、右下四条直径（含对向）
      const aLetter = aOf(d), bLetter = bOf(d);
      const p1 = pt(deg, R), p2 = pt(deg + 180, R);
      el('line', { x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y, stroke: '#E3DACA', 'stroke-width': 1.2 }, svg);
      // 字母标签（θ 端=A 极点，θ+180 端=B 极点）
      const o1 = pt(deg, R + 26), o2 = pt(deg + 180, R + 26);
      const t1 = el('text', { x: o1.x, y: o1.y, 'text-anchor': 'middle', 'dominant-baseline': 'middle', 'font-size': 17, 'font-weight': 700, 'font-family': FONT }, svg);
      const t2 = el('text', { x: o2.x, y: o2.y, 'text-anchor': 'middle', 'dominant-baseline': 'middle', 'font-size': 17, 'font-weight': 700, 'font-family': FONT }, svg);
      t1.textContent = aLetter;
      t2.textContent = bLetter;
      t1.setAttribute('fill', d.score < 0 ? COLOR_A : FAINT);
      t2.setAttribute('fill', d.score > 0 ? COLOR_B : FAINT);
      // 强度刻度小点
      [6, 14].forEach(function (v) {
        const rr = kRad(v);
        [pt(deg, rr), pt(deg + 180, rr)].forEach(function (q) {
          el('circle', { cx: q.x, cy: q.y, r: 1.3, fill: '#C9BDA6' }, svg);
        });
      });
    });

    // 数据多边形
    const pts = dims.map(function (d, i) {
      const deg = i * 45;
      const s = Math.max(-24, Math.min(24, d.score || 0));
      const rad = kRad(s);
      return pt(s < 0 ? deg : deg + 180, rad);
    });
    el('polygon', {
      points: pts.map(function (p) { return p.x + ',' + p.y; }).join(' '),
      fill: '#9A7B60', 'fill-opacity': 0.15, stroke: '#7E6450', 'stroke-width': 2, 'stroke-linejoin': 'round'
    }, svg);
    el('circle', { cx: cx, cy: cy, r: 2.6, fill: '#C9BDA6' }, svg);
    host.appendChild(svg);
  }

  /* ---------- MBTI v2：偏好强度尺（双侧条形，DOM 实现） ---------- */
  function meters(host, opt) {
    clear(host);
    const dims = opt.dims || [];
    const wrap = host.appendChild(document.createElement('div'));
    wrap.style.cssText = 'display:flex;flex-direction:column;gap:18px';
    const bandName = { 0: '无明显偏向', 1: '轻微', 2: '中等', 3: '明显' };
    const COLOR_A = '#9A7B60', COLOR_B = '#B08D57';
    const aOf = function (d) { return d.score < 0 ? d.fav : d.unfav; };
    const bOf = function (d) { return d.score < 0 ? d.unfav : d.fav; };

    dims.forEach(function (d) {
      const a = aOf(d), b = bOf(d);
      const pct = Math.min(50, Math.abs(d.score) / 24 * 50);
      const side = d.score < 0 ? 'l' : 'r';
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;flex-direction:column;gap:8px';
      // 头部
      const head = document.createElement('div');
      head.style.cssText = 'display:flex;justify-content:space-between;align-items:baseline;gap:12px';
      const nm = document.createElement('span');
      nm.style.cssText = 'font-weight:700;color:#38322A;font-size:13.5px';
      nm.textContent = d.name;
      const desc = document.createElement('span');
      desc.style.cssText = 'color:#857B6D;font-size:12px;text-align:right';
      desc.textContent = d.tied
        ? '左右趋近平衡（得分 0）'
        : (bandName[d.band.n] || '') + ' · 偏' + d.fav.name + '（' + (d.score > 0 ? '+' : '') + d.score + '）';
      head.appendChild(nm); head.appendChild(desc);
      row.appendChild(head);
      // 轨道（中心为 0）
      const track = document.createElement('div');
      track.style.cssText = 'position:relative;height:11px;border-radius:99px;background:#EDE6D6;box-shadow:inset 0 1px 2px rgba(56,50,42,.08)';
      const mid = document.createElement('div');
      mid.style.cssText = 'position:absolute;left:50%;top:-2px;bottom:-2px;width:1px;background:rgba(56,50,42,.28)';
      const fill = document.createElement('div');
      fill.style.cssText = 'position:absolute;top:0;bottom:0;border-radius:99px;width:0;transition:width 1.1s cubic-bezier(.25,.6,.25,1);background:' + (side === 'l' ? COLOR_A : COLOR_B);
      fill.style[side === 'l' ? 'right' : 'left'] = '50%';
      track.appendChild(mid); track.appendChild(fill);
      row.appendChild(track);
      // 两端字母标签（左=A 极点，右=B 极点）
      const ends = document.createElement('div');
      ends.style.cssText = 'display:flex;justify-content:space-between;font-size:12.5px';
      const lEnd = document.createElement('span');
      const rEnd = document.createElement('span');
      lEnd.textContent = a.k + ' · ' + a.name;
      rEnd.textContent = b.k + ' · ' + b.name;
      lEnd.style.color = (side === 'l' ? '#7E6450' : '#C4B89F');
      rEnd.style.color = (side === 'r' ? '#8A6B33' : '#C4B89F');
      if (side === 'l') lEnd.style.fontWeight = '700'; else rEnd.style.fontWeight = '700';
      ends.appendChild(lEnd); ends.appendChild(rEnd);
      row.appendChild(ends);
      wrap.appendChild(row);
      requestAnimationFrame(function () { fill.style.width = pct + '%'; });
    });
  }

  /* ---------- SRI：四维剖面（百分位条形，0–100） ---------- */
  /* dims: [{ name, z(-3..3), ptile(0..100) }] */
  function zMeters(host, opt) {
    clear(host);
    const dims = opt.dims || [];
    const wrap = host.appendChild(document.createElement('div'));
    wrap.style.cssText = 'display:flex;flex-direction:column;gap:20px';
    dims.forEach(function (d) {
      let p = Math.round((d.ptile != null) ? d.ptile : 50);
      p = Math.max(1, Math.min(100, p));
      const hot = p >= 84; // 对应原 z > 1 的提醒线，改用百分位表达
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;flex-direction:column;gap:7px';
      const head = document.createElement('div');
      head.style.cssText = 'display:flex;justify-content:space-between;align-items:baseline;gap:12px';
      const nm = document.createElement('span');
      nm.style.cssText = 'font-weight:700;color:#38322A;font-size:13.5px';
      nm.textContent = d.name;
      const val = document.createElement('span');
      val.style.cssText = 'color:#857B6D;font-size:12px;text-align:right';
      val.textContent = '高于约 ' + p + '% 参考人群';
      head.appendChild(nm); head.appendChild(val);
      row.appendChild(head);
      // 轨道：浅色区 = 约 68% 人群所在（参考人群典型范围）
      const track = document.createElement('div');
      track.style.cssText = 'position:relative;height:11px;border-radius:99px;background:#EDE6D6;box-shadow:inset 0 1px 2px rgba(56,50,42,.08)';
      const band = document.createElement('div');
      band.style.cssText = 'position:absolute;left:16%;right:16%;top:0;bottom:0;background:rgba(119,131,107,.16)';
      const mid = document.createElement('div');
      mid.style.cssText = 'position:absolute;left:50%;top:-2px;bottom:-2px;width:1px;background:rgba(56,50,42,.28)';
      const fill = document.createElement('div');
      const color = hot ? '#B07A64' : '#A9826A';
      fill.style.cssText = 'position:absolute;top:0;bottom:0;left:0;border-radius:99px;width:0;transition:width 1.1s cubic-bezier(.25,.6,.25,1);background:' + color;
      track.appendChild(band); track.appendChild(mid); track.appendChild(fill);
      row.appendChild(track);
      const hint = document.createElement('div');
      hint.style.cssText = 'display:flex;justify-content:space-between;font-size:11px;color:#B0A694;line-height:1.5';
      const lEnd = document.createElement('span');
      lEnd.textContent = '较不明显';
      const cEnd = document.createElement('span');
      cEnd.textContent = '典型水平 · 50%';
      const rEnd = document.createElement('span');
      rEnd.textContent = hot ? '值得留意' : '较明显';
      hint.appendChild(lEnd); hint.appendChild(cEnd); hint.appendChild(rEnd);
      row.appendChild(hint);
      wrap.appendChild(row);
      requestAnimationFrame(function () { fill.style.width = p + '%'; });
    });
  }

  global.Innerway = global.Innerway || {};
  global.Innerway.charts = { radar: radar, splitBars: splitBars, bars: bars, polarRadar: polarRadar, meters: meters, zMeters: zMeters };
})(window);
