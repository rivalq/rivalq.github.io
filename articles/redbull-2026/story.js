/* Charts for "How Red Bull found its straight-line speed".
   Host-agnostic: RBStory(api) where api.get(id) -> {status, rows}, api.onData(fn), api.setLink(id). */
window.RBStory = function (api) {
  const root = document.querySelector('.paper');
  const css = (n) => `var(--${n})`;
  const TEAM = { 'Red Bull': ['rb', d3.symbolCircle], 'Mercedes': ['mer', d3.symbolSquare], 'McLaren': ['mcl', d3.symbolTriangle],
                 'Ferrari': ['fer', d3.symbolDiamond], 'Racing Bulls': ['rbs', d3.symbolCircle] };
  const col = (t) => css(TEAM[t] ? TEAM[t][0] : 'grey');
  const sym = (t) => (TEAM[t] ? TEAM[t][1] : d3.symbolCircle);
  const minus = (v, d) => (v < 0 ? '−' : '') + Math.abs(v).toFixed(d);
  const signed = (v, d) => (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v).toFixed(d);

  // ---------- formatting of quoted numbers
  const DELTA = /chg|vs_mer|_p3_|ls_p|str_p/;
  function fmtNum(row) {
    const v = +row.value, u = row.unit || '';
    if (!u) return d3.format(',')(Math.round(v));
    const dec = u === '%' ? 2 : (u === 's' || u === 's/lap') ? (Math.abs(v) < 0.1 ? 3 : 2) : (u === 'ms/lap' ? 1 : (Number.isInteger(v) ? 0 : 1));
    const n = DELTA.test(row.key) && ['s', 's/lap', 'km/h'].includes(u) ? signed(v, dec) : minus(v, dec);
    return u === '%' ? n + '%' : n + ' ' + u;
  }
  function fillNumbers() {
    const d = api.get('numbers');
    root.querySelectorAll('[data-source="numbers"]').forEach((el) => {
      if (d.status !== 'ok') { el.textContent = '—'; return; }
      const key = decodeURIComponent((el.getAttribute('data-where') || '').split('=')[1] || '');
      const row = d.rows.find((r) => r.key === key);
      el.textContent = row ? fmtNum(row) : '—';
    });
  }
  function fillTable() {
    const t = root.querySelector('#tab-phase');
    if (!t) return;
    const d = api.get('phase_summary');
    const tb = t.querySelector('tbody');
    tb.replaceChildren();
    if (d.status !== 'ok') return;
    d.rows.forEach((r) => {
      const tr = document.createElement('tr');
      const c0 = document.createElement('td'); c0.textContent = r.metric; if (+r.indent) c0.className = 'ind'; tr.appendChild(c0);
      ['r1_5', 'r6_11', 'r12_17'].forEach((k) => {
        const td = document.createElement('td'); const v = +r[k];
        td.textContent = r.unit === '%' ? v.toFixed(2) + '%' : signed(v, Math.abs(v) < 0.1 ? 3 : 2) + ' s';
        tr.appendChild(td);
      });
      tb.appendChild(tr);
    });
  }

  // ---------- chart scaffolding (pgfplots look)
  const W = (el) => Math.max(280, el.clientWidth || 600);
  function svgIn(el, h) {
    el.replaceChildren();
    const w = W(el);
    const svg = d3.select(el).append('svg').attr('width', '100%').attr('viewBox', `0 0 ${w} ${h}`).attr('height', h);
    return { svg, w, h };
  }
  function box(svg, x, y, m, w, h, o = {}) {
    const iw = w - m.l - m.r, ih = h - m.t - m.b;
    if (o.grid !== false) svg.append('g').attr('transform', `translate(${m.l},0)`)
      .call(d3.axisLeft(y).ticks(o.yt || 5).tickSize(-iw).tickFormat(''))
      .call((g) => { g.select('.domain').remove(); g.selectAll('line').style('stroke', css('hair')).attr('stroke-dasharray', '1 3'); });
    const bx = d3.axisBottom(x).tickSizeInner(o.band ? 0 : -4).tickSizeOuter(0).tickPadding(6);
    if (o.xt) bx.ticks(o.xt);
    if (o.xv) bx.tickValues(o.xv);
    if (o.xf) bx.tickFormat(o.xf);
    const ly = d3.axisLeft(y).ticks(o.yt || 5).tickSizeInner(-4).tickSizeOuter(0).tickPadding(6);
    if (o.yf) ly.tickFormat(o.yf);
    const style = (g) => { g.attr('font-size', null).attr('font-family', null); g.select('.domain').remove(); g.selectAll('line').style('stroke', css('rule')); };
    svg.append('g').attr('transform', `translate(0,${h - m.b})`).call(bx).call(style);
    svg.append('g').attr('transform', `translate(${m.l},0)`).call(ly).call(style);
    if (!o.band) {
      const tx = d3.axisTop(x).tickSizeInner(-4).tickSizeOuter(0).tickFormat('');
      if (o.xt) tx.ticks(o.xt);
      if (o.xv) tx.tickValues(o.xv);
      svg.append('g').attr('transform', `translate(0,${m.t})`).call(tx).call(style);
    }
    svg.append('g').attr('transform', `translate(${w - m.r},0)`).call(d3.axisRight(y).ticks(o.yt || 5).tickSizeInner(-4).tickSizeOuter(0).tickFormat('')).call(style);
    svg.append('rect').attr('x', m.l).attr('y', m.t).attr('width', iw).attr('height', ih)
      .style('fill', 'none').style('stroke', css('rule')).attr('stroke-width', 0.8);
    if (o.xl) svg.append('text').attr('class', 'axlab').attr('x', m.l + iw / 2).attr('y', h - 6).attr('text-anchor', 'middle').text(o.xl);
    if (o.yl) svg.append('text').attr('class', 'axlab').attr('transform', `translate(13,${m.t + ih / 2}) rotate(-90)`).attr('text-anchor', 'middle').text(o.yl);
  }
  function legend(svg, items, x0, y0, anchor = 'start') {
    const g = svg.append('g');
    const rows = items.map((it, i) => {
      const r = g.append('g').attr('transform', `translate(0,${i * 17})`);
      r.append('line').attr('x1', 0).attr('x2', 22).attr('y1', 0).attr('y2', 0).style('stroke', it.c).attr('stroke-width', it.sw || 1.6)
        .attr('stroke-dasharray', it.dash || null);
      if (it.s) r.append('path').attr('d', d3.symbol(it.s, 30)()).attr('transform', 'translate(11,0)').style('fill', it.fill === false ? css('paper') : it.c).style('stroke', it.c);
      r.append('text').attr('x', 28).attr('y', 4).text(it.label);
      return r;
    });
    const bb = g.node().getBBox();
    const pad = 6;
    const bx = anchor === 'end' ? x0 - bb.width - 2 * pad : x0;
    g.attr('transform', `translate(${bx + pad},${y0 + pad - bb.y})`);
    g.insert('rect', ':first-child').attr('x', bb.x - pad).attr('y', bb.y - pad).attr('width', bb.width + 2 * pad).attr('height', bb.height + 2 * pad)
      .style('fill', css('paper')).style('stroke', css('rule')).attr('stroke-width', 0.7);
    return rows;
  }
  function legendRow(svg, items, xc, y0) {
    const g = svg.append('g');
    let x = 0;
    items.forEach((it) => {
      const r = g.append('g').attr('transform', `translate(${x},0)`);
      r.append('line').attr('x1', 0).attr('x2', 20).attr('y1', 0).attr('y2', 0).style('stroke', it.c).attr('stroke-width', it.sw || 1.6).attr('stroke-dasharray', it.dash || null);
      if (it.s) r.append('path').attr('d', d3.symbol(it.s, 28)()).attr('transform', 'translate(10,0)').style('fill', it.fill === false ? css('paper') : it.c).style('stroke', it.c);
      const t = r.append('text').attr('x', 25).attr('y', 4).text(it.label);
      x += 25 + t.node().getComputedTextLength() + 16;
    });
    const wd = x - 16;
    g.attr('transform', `translate(${Math.max(4, xc - wd / 2)},${y0})`);
    return wd;
  }
  function series(svg, pts, x, y, c, o = {}) {
    const ok = pts.filter((p) => Number.isFinite(p.y));
    svg.append('path').datum(ok).style('fill', 'none').style('stroke', c).attr('stroke-width', o.sw || 1.6)
      .attr('stroke-linejoin', 'round').attr('stroke-linecap', 'round').attr('stroke-dasharray', o.dash || null)
      .attr('d', d3.line().x((p) => x(p.x)).y((p) => y(p.y)));
    if (o.s) svg.selectAll(null).data(ok).join('path').attr('d', d3.symbol(o.s, o.size || 28)())
      .attr('transform', (p) => `translate(${x(p.x)},${y(p.y)})`).style('fill', o.hollow ? css('paper') : c).style('stroke', c).attr('stroke-width', 1);
    return ok;
  }
  function tooltip(fig) {
    let t = fig.querySelector(':scope > .tt-pop');
    if (!t) { t = document.createElement('div'); t.className = 'tt-pop'; t.hidden = true; fig.appendChild(t); }
    return {
      show(ev, head, rows) {
        t.replaceChildren();
        const h = document.createElement('div'); h.className = 'h'; h.textContent = head; t.appendChild(h);
        rows.forEach(([n, v, c]) => {
          const r = document.createElement('div'); r.className = 'r';
          if (c) { const s = document.createElement('span'); s.className = 'sw'; s.style.background = c; r.appendChild(s); }
          const a = document.createElement('span'); a.textContent = n; r.appendChild(a);
          const b = document.createElement('span'); b.className = 'v'; b.textContent = v; r.appendChild(b);
          t.appendChild(r);
        });
        t.hidden = false;
        const fb = fig.getBoundingClientRect();
        let x = ev.clientX - fb.left + 14, y = ev.clientY - fb.top + 12;
        if (x + t.offsetWidth > fb.width - 4) x = ev.clientX - fb.left - t.offsetWidth - 14;
        if (y + t.offsetHeight > fb.height - 4) y = fb.height - t.offsetHeight - 4;
        t.style.left = Math.max(4, x) + 'px'; t.style.top = Math.max(4, y) + 'px';
      },
      hide() { t.hidden = true; },
    };
  }
  function hover(svg, m, w, h, fn, leave) {
    svg.append('rect').attr('x', m.l).attr('y', m.t).attr('width', w - m.l - m.r).attr('height', h - m.t - m.b)
      .style('fill', 'transparent').on('mousemove', fn).on('mouseleave', leave);
  }
  function rowsOf(el, id, cols) {
    const d = api.get(id);
    if (d.status !== 'ok') {
      el.replaceChildren();
      el.classList.add('dash-skeleton');
      if (d.status === 'error') { el.classList.remove('dash-skeleton'); el.textContent = 'Failed to load'; }
      return null;
    }
    el.classList.remove('dash-skeleton');
    return d.rows.map((r) => { const o = { ...r }; cols.forEach((c) => { o[c] = r[c] === '' || r[c] == null ? NaN : +r[c]; }); return o; });
  }

  // ---------- Fig 1: energy loop (schematic, no data)
  function figLoop() {
    const el = document.getElementById('c-loop');
    const { svg, w, h } = svgIn(el, 220);
    const m = { l: 34, r: 8, t: 8, b: 30 };
    const x = d3.scaleLinear([0, 1], [m.l, w - m.r]), y = d3.scaleLinear([0, 1], [h - m.b, m.t]);
    const Z = [[0, .3, '(i) deploy', 'ICE + full electric'], [.3, .55, '(ii) taper', 'electric fades'],
               [.55, .9, '(iii) super-clip', 'flat out, harvesting'], [.9, 1, '(iv) brake', 'regen']];
    Z.forEach((z, i) => {
      if (i) svg.append('line').attr('x1', x(z[0])).attr('x2', x(z[0])).attr('y1', m.t).attr('y2', h - m.b).style('stroke', css('rule')).attr('stroke-dasharray', '3 3').attr('stroke-width', .7);
      const mid = (x(z[0]) + x(z[1])) / 2, narrow = x(z[1]) - x(z[0]) < 100;
      svg.append('text').attr('x', mid).attr('y', h - m.b - 28).attr('text-anchor', 'middle').text(z[2]);
      if (!narrow) svg.append('text').attr('class', 'ann').attr('x', mid).attr('y', h - m.b - 12).attr('text-anchor', 'middle').text(z[3]);
    });
    const pk = .15 + .75 * (1 - Math.exp(-.55 / .18));
    const pts = d3.range(0, 1.0001, 0.004).map((t) => [t, t < .55 ? .15 + .75 * (1 - Math.exp(-t / .18)) : (t < .9 ? pk - .25 * (t - .55) / .35 : pk - .25 - 2.4 * (t - .9))]);
    svg.append('path').datum(pts).style('fill', 'none').style('stroke', css('rb')).attr('stroke-width', 2).attr('d', d3.line().x((p) => x(p[0])).y((p) => y(p[1])));
    svg.append('rect').attr('x', m.l).attr('y', m.t).attr('width', w - m.l - m.r).attr('height', h - m.t - m.b).style('fill', 'none').style('stroke', css('rule')).attr('stroke-width', .8);
    svg.append('text').attr('class', 'axlab').attr('x', (m.l + w - m.r) / 2).attr('y', h - 8).attr('text-anchor', 'middle').text('distance along the straight →');
    svg.append('text').attr('class', 'axlab').attr('transform', `translate(14,${(m.t + h - m.b) / 2}) rotate(-90)`).attr('text-anchor', 'middle').text('speed');
  }

  // ---------- Fig 2: MGU-K taper
  function figTaper() {
    const el = document.getElementById('c-taper');
    const rows = rowsOf(el, 'taper', ['kmh', 'normal_kw', 'overtake_kw']); if (!rows) return;
    const { svg, w, h } = svgIn(el, 290);
    const m = { l: 50, r: 10, t: 10, b: 42 };
    const x = d3.scaleLinear(d3.extent(rows, (r) => r.kmh), [m.l, w - m.r]);
    const y = d3.scaleLinear([0, 400], [h - m.b, m.t]);
    box(svg, x, y, m, w, h, { xt: 6, yt: 5, xl: 'car speed  v  (km/h)', yl: 'max. MGU-K power (kW)' });
    const area = (k) => d3.area().x((r) => x(r.kmh)).y0(y(0)).y1((r) => y(r[k]));
    svg.append('path').datum(rows).attr('d', area('overtake_kw')).style('fill', css('ot')).style('fill-opacity', .12);
    svg.append('path').datum(rows).attr('d', area('normal_kw')).style('fill', css('rb')).style('fill-opacity', .14);
    series(svg, rows.map((r) => ({ x: r.kmh, y: r.overtake_kw })), x, y, css('ot'), { sw: 1.8, dash: '6 3' });
    series(svg, rows.map((r) => ({ x: r.kmh, y: r.normal_kw })), x, y, css('rb'), { sw: 1.8 });
    legend(svg, [{ c: css('rb'), label: 'race, normal mode', sw: 1.8 }, { c: css('ot'), label: 'Overtake on (all qualifying laps)', sw: 1.8, dash: '6 3' }], w - m.r - 6, m.t + 4, 'end');
    const tip = tooltip(el.closest('figure'));
    const bis = d3.bisector((r) => r.kmh).center;
    hover(svg, m, w, h, (ev) => { const r = rows[bis(rows, x.invert(d3.pointer(ev)[0]))];
      tip.show(ev, `v = ${r.kmh} km/h`, [['normal', `${r.normal_kw} kW`, css('rb')], ['Overtake', `${r.overtake_kw} kW`, css('ot')]]); }, () => tip.hide());
  }

  // ---------- Fig 3: pace
  let paceMode = 'q';
  function figPace() {
    const el = document.getElementById('c-pace');
    const rows = rowsOf(el, 'pace', ['round', 'quali_gap_pct', 'race_gap_pct']); if (!rows) return;
    const k = paceMode === 'q' ? 'quali_gap_pct' : 'race_gap_pct';
    const teams = ['Ferrari', 'McLaren', 'Mercedes', 'Red Bull'];
    const abbr = new Map(rows.map((r) => [r.round, r.abbr]));
    const rounds = [...abbr.keys()].sort((a, b) => a - b);
    const { svg, w, h } = svgIn(el, 330);
    const m = { l: 52, r: 10, t: 30, b: 42 };
    const x = d3.scaleLinear([0.5, d3.max(rounds) + 0.5], [m.l, w - m.r]);
    const ymax = d3.max(rows.filter((r) => teams.includes(r.team)), (r) => r[k]);
    const y = d3.scaleLinear([ymax * 1.06, -0.04], [h - m.b, m.t]);
    const every = w < 560 ? 2 : 1;
    box(svg, x, y, m, w, h, { xv: rounds.filter((r, i) => i % every === 0), xf: (r) => abbr.get(r), yt: 6, yf: (v) => v.toFixed(1),
      yl: paceMode === 'q' ? 'gap to pole (%)' : 'gap to fastest team (%)' });
    [[4, 'a'], [6, 'b'], [15, 'c']].forEach(([r, l]) => {
      svg.append('line').attr('x1', x(r)).attr('x2', x(r)).attr('y1', m.t).attr('y2', h - m.b).style('stroke', css('muted')).attr('stroke-dasharray', '2 3').attr('stroke-width', .8);
      svg.append('text').attr('class', 'ann').attr('x', x(r) + 3).attr('y', h - m.b - 6).text(`(${l})`);
    });
    teams.forEach((t) => series(svg, rows.filter((r) => r.team === t).sort((a, b) => a.round - b.round).map((r) => ({ x: r.round, y: r[k] })), x, y, col(t),
      { s: sym(t), sw: t === 'Red Bull' ? 2.2 : 1.3, size: t === 'Red Bull' ? 34 : 24, hollow: t !== 'Red Bull' }));
    legendRow(svg, teams.slice().reverse().map((t) => ({ c: col(t), s: sym(t), label: t, sw: t === 'Red Bull' ? 2.2 : 1.3, fill: t === 'Red Bull' })), (m.l + w - m.r) / 2, 12);
    const tip = tooltip(el.closest('figure'));
    const vl = svg.append('line').attr('y1', m.t).attr('y2', h - m.b).style('stroke', css('rule')).attr('stroke-width', .6).attr('opacity', 0);
    hover(svg, m, w, h, (ev) => {
      const r = Math.max(1, Math.min(d3.max(rounds), Math.round(x.invert(d3.pointer(ev)[0]))));
      vl.attr('x1', x(r)).attr('x2', x(r)).attr('opacity', 1);
      tip.show(ev, `Round ${r}, ${abbr.get(r)}`, teams.slice().reverse().map((t) => { const q = rows.find((z) => z.team === t && z.round === r);
        return [t, q && Number.isFinite(q[k]) ? q[k].toFixed(2) + '%' : '—', col(t)]; }));
    }, () => { tip.hide(); vl.attr('opacity', 0); });
  }
  function setPace(mode) {
    paceMode = mode;
    document.getElementById('pace-q').setAttribute('aria-pressed', mode === 'q');
    document.getElementById('pace-r').setAttribute('aria-pressed', mode === 'r');
    figPace();
  }

  // ---------- Fig 4: segments
  function figSeg() {
    const el = document.getElementById('c-seg');
    const rows = rowsOf(el, 'segments_phase', ['dt_vs_mer']); if (!rows) return;
    const cls = [['straight', 'straights'], ['low', 'slow'], ['medium', 'medium'], ['high', 'fast']];
    const ph = ['R1-5', 'R6-11', 'R12-17'];
    const fills = [0.25, 0.6, 1];
    const narrow = W(el) < 560, H = 250;
    const { svg, w } = svgIn(el, narrow ? 2 * H + 10 : H);
    const ext = d3.extent(rows, (r) => r.dt_vs_mer);
    const pw = narrow ? w : (w - 16) / 2;
    const tip = tooltip(el.closest('figure'));
    ['Red Bull', 'Racing Bulls'].forEach((t, i) => {
      const g = svg.append('g').attr('transform', `translate(${narrow ? 0 : i * (pw + 16)},${narrow ? i * (H + 10) : 0})`);
      const m = { l: i && !narrow ? 34 : 52, r: 6, t: 24, b: 40 };
      const x = d3.scaleBand(cls.map((c) => c[0]), [m.l, pw - m.r]).padding(0.2);
      const xs = d3.scaleBand(ph, [0, x.bandwidth()]).padding(0.08);
      const y = d3.scaleLinear([Math.min(0, ext[0]) - .03, ext[1] + .05], [H - m.b, m.t]);
      box(g, x, y, m, pw, H, { band: true, xf: (c) => cls.find((z) => z[0] === c)[1], yt: 5, yf: (v) => v.toFixed(1), yl: i && !narrow ? null : 'seconds vs Mercedes' });
      g.append('line').attr('x1', m.l).attr('x2', pw - m.r).attr('y1', y(0)).attr('y2', y(0)).style('stroke', css('rule')).attr('stroke-width', .7);
      g.append('text').attr('x', m.l + 4).attr('y', m.t - 8).text(`(${'ab'[i]}) ${t} minus Mercedes`);
      rows.filter((r) => r.team === t).forEach((r) => {
        const v = r.dt_vs_mer;
        g.append('rect').attr('x', x(r.class) + xs(r.phase)).attr('width', xs.bandwidth()).attr('y', Math.min(y(v), y(0))).attr('height', Math.abs(y(v) - y(0)))
          .style('fill', css('rb')).style('fill-opacity', fills[ph.indexOf(r.phase)]).style('stroke', css('rb')).attr('stroke-width', .6)
          .on('mousemove', (ev) => tip.show(ev, `${t}, ${cls.find((c) => c[0] === r.class)[1]}`, [[r.phase, signed(v, 3) + ' s', css('rb')]]))
          .on('mouseleave', () => tip.hide());
      });
      if (i === 0) {
        const lg = g.append('g').attr('transform', `translate(${pw - m.r - 152},${m.t + 8})`);
        ph.forEach((p, j) => { lg.append('rect').attr('x', j * 50).attr('y', -8).attr('width', 10).attr('height', 10).style('fill', css('rb')).style('fill-opacity', fills[j]).style('stroke', css('rb')).attr('stroke-width', .6);
          lg.append('text').attr('x', j * 50 + 14).attr('y', 1).text(p.replace('-', '–')); });
      }
    });
  }

  // ---------- Fig 5: clipping example
  function figClip() {
    const el = document.getElementById('c-clip');
    const rows = rowsOf(el, 'clip_example', ['x_m', 'speed', 'throttle', 'brake']); if (!rows) return;
    const { svg, w, h } = svgIn(el, 300);
    const m = { l: 52, r: 10, t: 10, b: 42 };
    const x = d3.scaleLinear(d3.extent(rows, (r) => r.x_m), [m.l, w - m.r]);
    const y = d3.scaleLinear([d3.min(rows, (r) => r.speed) - 6, d3.max(rows, (r) => r.speed) + 22], [h - m.b, m.t]);
    const rus = rows.filter((r) => r.driver === 'RUS');
    let end = 0; for (const r of rus) { if (r.x_m < 0) continue; if (r.throttle >= 97 && r.brake === 0) end = r.x_m; else if (end > 0) break; }
    svg.append('rect').attr('x', x(0)).attr('width', x(end) - x(0)).attr('y', m.t).attr('height', h - m.t - m.b).style('fill', css('hl'));
    box(svg, x, y, m, w, h, { xt: 7, yt: 5, xl: 'distance from the start of the straight (m)', yl: 'speed (km/h)' });
    const D = [['RUS', 'Russell (Mercedes), pole', 'Mercedes'], ['HAD', 'Hadjar (Red Bull), P3', 'Red Bull']];
    D.forEach(([d, lab, t]) => series(svg, rows.filter((r) => r.driver === d).map((r) => ({ x: r.x_m, y: r.speed })), x, y, col(t), { sw: 1.8 }));
    legend(svg, D.map(([, lab, t]) => ({ c: col(t), label: lab, sw: 1.8 })), m.l + 6, m.t + 4);
    const full = rus.filter((r) => r.x_m >= 0 && r.x_m <= end);
    const pk = full.reduce((a, b) => (b.speed > a.speed ? b : a), full[0]);
    const last = full[full.length - 1];
    [[pk, `peak ${pk.speed.toFixed(0)} km/h`, -10, 'middle'], [last, `${last.speed.toFixed(0)} km/h, still at full throttle`, 20, 'end']].forEach(([p, s, dy, a]) => {
      svg.append('path').attr('d', d3.symbol(d3.symbolSquare, 30)()).attr('transform', `translate(${x(p.x_m)},${y(p.speed)})`).style('fill', col('Mercedes'));
      svg.append('text').attr('class', 'ann').attr('x', x(p.x_m) + (a === 'end' ? -6 : 0)).attr('y', y(p.speed) + dy).attr('text-anchor', a).text(s);
    });
    const tip = tooltip(el.closest('figure'));
    const bis = d3.bisector((r) => r.x_m).center;
    hover(svg, m, w, h, (ev) => { const xm = x.invert(d3.pointer(ev)[0]);
      tip.show(ev, `${Math.round(xm)} m`, D.map(([d, lab, t]) => { const p = rows.filter((r) => r.driver === d); const q = p[bis(p, xm)];
        return [lab.split(' (')[0], `${q.speed.toFixed(0)} km/h, throttle ${q.throttle}%`, col(t)]; })); }, () => tip.hide());
  }

  // ---------- Fig 6: longest straight in races
  function figRst() {
    const el = document.getElementById('c-rst');
    const rows = rowsOf(el, 'race_straight', ['round', 't_vs_mer']); if (!rows) return;
    const abbr = new Map(rows.map((r) => [r.round, r.abbr]));
    const rounds = [...abbr.keys()].sort((a, b) => a - b);
    const { svg, w, h } = svgIn(el, 300);
    const m = { l: 56, r: 10, t: w < 560 ? 48 : 30, b: 42 };
    const x = d3.scaleLinear([0.5, d3.max(rounds) + 0.5], [m.l, w - m.r]);
    const e = d3.extent(rows, (r) => r.t_vs_mer);
    const y = d3.scaleLinear([e[0] - .04, e[1] + .06], [h - m.b, m.t]);
    const every = w < 560 ? 2 : 1;
    box(svg, x, y, m, w, h, { xv: rounds.filter((r, i) => i % every === 0), xf: (r) => abbr.get(r), yt: 6, yf: (v) => signed(v, 2), yl: 'seconds vs Mercedes' });
    svg.append('line').attr('x1', m.l).attr('x2', w - m.r).attr('y1', y(0)).attr('y2', y(0)).style('stroke', col('Mercedes')).attr('stroke-width', 1.4);
    const T = [['Ferrari', 1.1], ['McLaren', 1.1], ['Racing Bulls', 1.4], ['Red Bull', 2.2]];
    T.forEach(([t, sw]) => series(svg, rows.filter((r) => r.team === t).sort((a, b) => a.round - b.round).map((r) => ({ x: r.round, y: r.t_vs_mer })), x, y,
      t === 'Red Bull' || t === 'Racing Bulls' ? col(t) : css('grey'), { s: sym(t), sw, size: t === 'Red Bull' ? 34 : 22, hollow: t !== 'Red Bull' }));
    const L1 = [{ c: col('Red Bull'), s: sym('Red Bull'), label: 'Red Bull', sw: 2.2 }, { c: col('Racing Bulls'), s: sym('Racing Bulls'), label: 'Racing Bulls', sw: 1.4, fill: false },
      { c: css('grey'), s: sym('McLaren'), label: 'McLaren', fill: false, sw: 1.1 }, { c: css('grey'), s: sym('Ferrari'), label: 'Ferrari', fill: false, sw: 1.1 },
      { c: col('Mercedes'), label: 'Mercedes (zero)', sw: 1.4 }];
    if (w < 560) { legendRow(svg, L1.slice(0, 3), (m.l + w - m.r) / 2, 12); legendRow(svg, L1.slice(3), (m.l + w - m.r) / 2, 30); }
    else legendRow(svg, L1, (m.l + w - m.r) / 2, 12);
    const tip = tooltip(el.closest('figure'));
    hover(svg, m, w, h, (ev) => { const r = Math.round(x.invert(d3.pointer(ev)[0]));
      if (!abbr.has(r)) { tip.hide(); return; }
      tip.show(ev, `Round ${r}, ${abbr.get(r)}`, T.slice().reverse().map(([t]) => { const q = rows.find((z) => z.team === t && z.round === r);
        return [t, q ? signed(q.t_vs_mer, 3) + ' s' : '—', t === 'Red Bull' || t === 'Racing Bulls' ? col(t) : css('grey')]; })); }, () => tip.hide());
  }

  // ---------- Fig 7: change vs field
  let chgKind = 'race_longest_straight';
  const CHGU = { race_longest_straight: 's', quali_all_straights: 's', quali_speed_trap: 'km/h' };
  function figChg() {
    const el = document.getElementById('c-chg');
    const all = rowsOf(el, 'straight_change', ['before', 'after', 'change']); if (!all) return;
    const rows = all.filter((r) => r.kind === chgKind).sort((a, b) => a.change - b.change);
    const u = CHGU[chgKind];
    const { svg, w, h } = svgIn(el, 46 + rows.length * 22);
    const m = { l: 96, r: 52, t: 6, b: 38 };
    const e = d3.extent(rows, (r) => r.change);
    const x = d3.scaleLinear([Math.min(0, e[0]) * 1.12, Math.max(0, e[1]) * 1.12], [m.l, w - m.r]).nice();
    const y = d3.scaleBand(rows.map((r) => r.team), [m.t, h - m.b]).padding(0.28);
    const bx = d3.axisBottom(x).ticks(5).tickSizeInner(-4).tickSizeOuter(0).tickPadding(6).tickFormat((v) => signed(v, u === 'km/h' ? 0 : 2));
    svg.append('g').attr('transform', `translate(0,${h - m.b})`).call(bx).call((g) => { g.attr('font-size', null).attr('font-family', null); g.select('.domain').remove(); g.selectAll('line').style('stroke', css('rule')); });
    svg.append('rect').attr('x', m.l).attr('y', m.t).attr('width', w - m.l - m.r).attr('height', h - m.t - m.b).style('fill', 'none').style('stroke', css('rule')).attr('stroke-width', .8);
    svg.append('line').attr('x1', x(0)).attr('x2', x(0)).attr('y1', m.t).attr('y2', h - m.b).style('stroke', css('rule')).attr('stroke-width', .7);
    svg.append('text').attr('class', 'axlab').attr('x', (m.l + w - m.r) / 2).attr('y', h - 4).attr('text-anchor', 'middle')
      .text(u === 'km/h' ? 'change in trap speed vs field (km/h)' : `change in time vs field (${chgKind === 'race_longest_straight' ? 's per pass' : 's per lap'})`);
    const tip = tooltip(el.closest('figure'));
    rows.forEach((r) => {
      const hi = ['Red Bull', 'Racing Bulls', 'Mercedes'].includes(r.team), c = hi ? col(r.team) : css('grey');
      svg.append('rect').attr('x', Math.min(x(0), x(r.change))).attr('width', Math.abs(x(r.change) - x(0))).attr('y', y(r.team)).attr('height', y.bandwidth())
        .style('fill', c).style('fill-opacity', hi ? .9 : .45)
        .on('mousemove', (ev) => tip.show(ev, r.team, [['R1–5 vs field', signed(r.before, 3) + ' ' + u], ['R6–17 vs field', signed(r.after, 3) + ' ' + u], ['change', signed(r.change, 3) + ' ' + u, c]]))
        .on('mouseleave', () => tip.hide());
      svg.append('text').attr('x', m.l - 7).attr('y', y(r.team) + y.bandwidth() / 2 + 4).attr('text-anchor', 'end').style('font-weight', hi ? 700 : 400).text(r.team);
      svg.append('text').attr('class', 'ann').attr('x', r.change < 0 ? x(r.change) - 4 : x(r.change) + 4).attr('y', y(r.team) + y.bandwidth() / 2 + 4)
        .attr('text-anchor', r.change < 0 ? 'end' : 'start').text(signed(r.change, u === 'km/h' ? 1 : 3));
    });
  }
  function setChg(k, btn) {
    chgKind = k;
    document.querySelectorAll('#fig-chg .subfig button').forEach((b) => b.setAttribute('aria-pressed', b === btn));
    figChg();
  }

  // ---------- Fig 8: profile along the straight
  function figProf() {
    const el = document.getElementById('c-prof');
    const rows = rowsOf(el, 'straight_profile', ['pos_pct', 'dv_vs_mer']); if (!rows) return;
    const S = [['Red Bull race R1-5', 'races, R1–5', css('rbs'), null, d3.symbolCircle, true],
               ['Red Bull race R12-17', 'races, R12–17', css('rb'), null, d3.symbolCircle, false],
               ['Red Bull quali R12-17', 'qualifying, R12–17', css('ot'), '6 3', d3.symbolTriangle, true]];
    const { svg, w, h } = svgIn(el, 320);
    const m = { l: 52, r: 10, t: w < 560 ? 48 : 30, b: 42 };
    const x = d3.scaleLinear([0, 100], [m.l, w - m.r]);
    const sel = rows.filter((r) => S.some((s) => s[0] === r.series));
    const e = d3.extent(sel, (r) => r.dv_vs_mer);
    const y = d3.scaleLinear([Math.min(e[0], 0) - .6, Math.max(e[1], 0) + .6], [h - m.b, m.t]);
    box(svg, x, y, m, w, h, { xt: 5, yt: 6, yf: (v) => signed(v, 0), xl: 'position along the longest straight (% of its length)', yl: 'Red Bull − Mercedes (km/h)' });
    svg.append('line').attr('x1', m.l).attr('x2', w - m.r).attr('y1', y(0)).attr('y2', y(0)).style('stroke', col('Mercedes')).attr('stroke-width', 1.4);
    S.forEach(([k, , c, dash, s, hollow], i) => series(svg, rows.filter((r) => r.series === k).sort((a, b) => a.pos_pct - b.pos_pct).map((r) => ({ x: r.pos_pct, y: r.dv_vs_mer })), x, y, c,
      { s, dash, hollow, sw: i === 1 ? 2.2 : 1.5, size: 28 }));
    const L2 = S.map(([, lab, c, dash, s, hollow], i) => ({ c, s, dash, label: lab, fill: !hollow, sw: i === 1 ? 2.2 : 1.5 })).concat([{ c: col('Mercedes'), label: 'Mercedes (zero)', sw: 1.4 }]);
    if (w < 560) { legendRow(svg, L2.slice(0, 2), (m.l + w - m.r) / 2, 12); legendRow(svg, L2.slice(2), (m.l + w - m.r) / 2, 30); }
    else legendRow(svg, L2, (m.l + w - m.r) / 2, 12);
    const tip = tooltip(el.closest('figure'));
    hover(svg, m, w, h, (ev) => { const p = Math.max(5, Math.min(95, Math.round((x.invert(d3.pointer(ev)[0]) - 5) / 10) * 10 + 5));
      tip.show(ev, `${p - 5}–${p + 5}% along the straight`, S.map(([k, lab, c]) => { const q = rows.find((r) => r.series === k && r.pos_pct === p);
        return [lab, q ? signed(q.dv_vs_mer, 1) + ' km/h' : '—', c]; })); }, () => tip.hide());
  }

  // ---------- Fig 9: timeline
  function figTl() {
    const el = document.getElementById('c-tl');
    const rows = rowsOf(el, 'timeline', ['round', 'n_parts', 'major']); if (!rows) return;
    const { svg, w, h } = svgIn(el, 200);
    const m = { l: 10, r: 10, t: 24, b: 30 };
    const maxR = d3.max(rows, (r) => r.round);
    const x = d3.scaleLinear([0.5, maxR + 0.5], [m.l, w - m.r]);
    const L = ['Red Bull parts', 'Rules and engines'];
    const y = d3.scalePoint(L, [m.t + 30, h - m.b - 26]);
    const abbr = new Map(rows.map((r) => [r.round, r.abbr]));
    const every = w < 560 ? 2 : 1;
    const bx = d3.axisBottom(x).tickValues(d3.range(1, maxR + 1).filter((r, i) => i % every === 0)).tickFormat((r) => abbr.get(r) || '').tickSizeInner(-4).tickSizeOuter(0).tickPadding(6);
    svg.append('g').attr('transform', `translate(0,${h - m.b})`).call(bx).call((g) => { g.attr('font-size', null).attr('font-family', null); g.select('.domain').remove(); g.selectAll('line').style('stroke', css('rule')); });
    svg.append('rect').attr('x', m.l).attr('y', m.t).attr('width', w - m.l - m.r).attr('height', h - m.t - m.b).style('fill', 'none').style('stroke', css('rule')).attr('stroke-width', .8);
    L.forEach((l) => { svg.append('line').attr('x1', m.l).attr('x2', w - m.r).attr('y1', y(l)).attr('y2', y(l)).style('stroke', css('hair'));
      svg.append('text').attr('x', m.l + 6).attr('y', y(l) - 16).style('font-style', 'italic').text(l); });
    const rs = d3.scaleSqrt([0, d3.max(rows, (r) => r.n_parts) || 1], [3.5, 10]);
    const tip = tooltip(el.closest('figure'));
    rows.forEach((r) => {
      const parts = r.lane === L[0], c = parts ? css('rb') : css('ot');
      const g = svg.append('path').attr('d', d3.symbol(parts ? d3.symbolCircle : d3.symbolDiamond, parts ? Math.PI * rs(r.n_parts) ** 2 : 70)())
        .attr('transform', `translate(${x(r.round)},${y(r.lane)})`).style('fill', r.major ? c : css('paper')).style('stroke', c).attr('stroke-width', 1.1);
      g.on('mousemove', (ev) => tip.show(ev, `Round ${r.round}, ${r.abbr}`, [[r.title, parts ? `${r.n_parts} parts` : '', c]])).on('mouseleave', () => tip.hide());
    });
  }

  // ---------- Fig 10: degradation
  function figDeg() {
    const el = document.getElementById('c-deg');
    const rows = rowsOf(el, 'deg_phase', ['deg']); if (!rows) return;
    const T = ['Red Bull', 'Mercedes', 'McLaren', 'Ferrari'], ph = ['R1-5', 'R6-11', 'R12-17'], fo = [0.25, 0.6, 1];
    const { svg, w, h } = svgIn(el, 240);
    const m = { l: 52, r: 10, t: 26, b: 34 };
    const x = d3.scaleBand(T, [m.l, w - m.r]).padding(0.22), xs = d3.scaleBand(ph, [0, x.bandwidth()]).padding(0.08);
    const y = d3.scaleLinear([0, d3.max(rows, (r) => r.deg * 1000) * 1.15], [h - m.b, m.t]);
    box(svg, x, y, m, w, h, { band: true, yt: 4, yl: 'ms per lap of tyre age' });
    const tip = tooltip(el.closest('figure'));
    rows.forEach((r) => {
      const v = r.deg * 1000, c = col(r.team);
      svg.append('rect').attr('x', x(r.team) + xs(r.phase)).attr('width', xs.bandwidth()).attr('y', y(v)).attr('height', y(0) - y(v))
        .style('fill', c).style('fill-opacity', fo[ph.indexOf(r.phase)]).style('stroke', c).attr('stroke-width', .6)
        .on('mousemove', (ev) => tip.show(ev, `${r.team}, ${r.phase}`, [['degradation', v.toFixed(1) + ' ms/lap', c]])).on('mouseleave', () => tip.hide());
    });
    const lg = svg.append('g').attr('transform', `translate(${w - m.r - 160},${m.t - 10})`);
    ph.forEach((p, j) => { lg.append('rect').attr('x', j * 52).attr('y', -8).attr('width', 10).attr('height', 10).style('fill', css('ink')).style('fill-opacity', fo[j]);
      lg.append('text').attr('x', j * 52 + 14).attr('y', 1).text(p.replace('-', '–')); });
  }

  // ---------- wiring
  document.getElementById('pace-q').addEventListener('click', () => setPace('q'));
  document.getElementById('pace-r').addEventListener('click', () => setPace('r'));
  [['chg-race', 'race_longest_straight'], ['chg-q', 'quali_all_straights'], ['chg-trap', 'quali_speed_trap']].forEach(([id, k]) => {
    const b = document.getElementById(id); b.addEventListener('click', () => setChg(k, b));
  });
  const draw = () => {
    fillNumbers(); fillTable();
    [figLoop, figTaper, figPace, figSeg, figClip, figRst, figChg, figProf, figTl, figDeg].forEach((f) => {
      try { f(); } catch (e) { console.error(f.name, e); }
    });
  };
  api.onData(draw);
  if (api.setLink) root.querySelectorAll('section[id]').forEach((s) => new IntersectionObserver((es) => {
    es.forEach((e) => { if (e.isIntersecting) api.setLink(e.target.id); });
  }, { root: document, threshold: 0.35 }).observe(s));
};
