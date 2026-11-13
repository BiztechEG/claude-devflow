/* Board page behaviour — inlined into docs/board/board.html by build-board.mjs.
 * Reads the JSON the build embedded and renders every view client-side.
 * Texts come from the embedded dictionary (D.t), so the page follows the
 * project's language and direction. Routing is hash based:
 * #/overview, #/board, #/task/ORD-03, #/decision/ADR-004 … */
(() => {
  'use strict';

  const D = JSON.parse(document.getElementById('board-data').textContent);
  const V = D.vocab;
  const TX = D.t;
  const T = new Map(D.tasks.map((t) => [t.id, t]));
  const SEC = new Map(D.sections.map((s) => [s.id, s]));
  const PH = new Map(D.phases.map((p) => [p.id, p]));
  const DEC = new Map(D.decisions.map((d) => [d.id, d]));
  const ordered = D.order.map((id) => T.get(id));
  const HAS_CLIENT = D.modules.includes('client');
  // Without the client module its statuses do not exist (the build maps them to decision and review).
  const STATUS_ORDER = ['todo', 'clarify', 'decision', 'in-progress', 'review', 'uat', 'blocked', 'done']
    .filter((s) => HAS_CLIENT || !['clarify', 'uat'].includes(s));
  const LAYER_KEYS = Object.keys(V.layers);
  const HAS_RISK = D.tasks.some((t) => t.risk);
  const ARROW = D.dir === 'rtl' ? '←' : '→';

  const app = document.getElementById('app');
  const tip = document.getElementById('tip');

  // ── helpers ───────────────────────────────────────────────────────────────
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fill = (s, p = {}) => String(s).replace(/\{(\w+)\}/g, (m, k) => (k in p ? String(p[k]) : m));
  const t = (key, p) => fill(TX[key] ?? key, p);
  const store = {
    get(k, d) { try { const v = localStorage.getItem('board:' + k); return v === null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem('board:' + k, JSON.stringify(v)); } catch { /* storage unavailable */ } },
  };
  const weight = (x) => (V.sizes[x.size] || { weight: 2 }).weight;
  const fmtDate = (iso) => {
    try { return new Date(iso).toLocaleDateString(TX.locale, { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return iso; }
  };
  const fmtDateTime = (iso) => {
    try { return new Date(iso).toLocaleString(TX.locale, { dateStyle: 'medium', timeStyle: 'short' }); } catch { return iso; }
  };
  const cardsWord = (n) => {
    const f = TX.cards;
    if ('other' in f) return fill(n === 1 ? f.one : f.other, { n });
    return fill(n === 1 ? f.one : n === 2 ? f.two : n >= 3 && n <= 10 ? f.few : f.many, { n });
  };
  const joinList = (xs) => xs.join(TX.sep);
  const phLabel = (id) => t('phase', { id });
  const qList = (qs) => joinList(qs.map((q) => `<span class="tid">${esc(q)}</span>`));
  const typePill = (x) => (x.req && x.req.type ? `<span class="rtype pill" title="${esc(t('reqTypeTitle'))}">${esc(V.reqTypes[x.req.type] || x.req.type)}</span>` : '');

  const statusPill = (s) => `<span class="pill st-${s}"><span class="ico" aria-hidden="true">${esc(V.statuses[s].icon)}</span>${esc(V.statuses[s].label)}</span>`;
  const prioPill = (p) => `<span class="pill prio prio-${p}" title="${esc(t('prioTitle', { label: V.priorities[p].label }))}">${p}</span>`;
  const riskPill = (r) => (r && V.risks[r] ? `<span class="pill risk risk-${r}" title="${esc(V.risks[r].hint)}">${esc(t('riskPill', { label: V.risks[r].label }))}</span>` : '');
  const layerCls = (l) => `layer layer-s${V.layers[l].slot}`;
  const layerPill = (l) => `<span class="pill ${layerCls(l)}">${esc(V.layers[l].label)}</span>`;
  const taskLink = (id, withTitle = true) => {
    const x = T.get(id);
    if (!x) return esc(id);
    return `<button type="button" class="link-btn" data-open="${id}"><span class="tid">${id}</span>${withTitle ? ' ' + esc(x.title) : ''}</button>`;
  };

  function tally(tasks) {
    const r = { n: tasks.length, w: 0, by: {} };
    for (const s of Object.keys(V.statuses)) r.by[s] = { n: 0, w: 0 };
    for (const x of tasks) { const w = weight(x); r.w += w; r.by[x.status].n++; r.by[x.status].w += w; }
    r.pct = r.w ? Math.round((r.by.done.w / r.w) * 100) : 0;
    return r;
  }

  // Stacked meter: done, UAT (client module), review, in-progress over a "remaining" track.
  const METER = ['done', ...(HAS_CLIENT ? ['uat'] : []), 'review', 'in-progress'];
  function meter(tasks, big = false) {
    const r = tally(tasks);
    if (!r.w) return '<div class="meter"></div>';
    const seg = (s) => {
      const b = r.by[s];
      if (!b.n) return '';
      const pct = (b.w / r.w) * 100;
      return `<div class="seg seg-${s}" style="width:${pct.toFixed(2)}%" data-tip="${esc(t('segTip', { label: V.statuses[s].label, cards: cardsWord(b.n), pct: Math.round(pct) }))}"></div>`;
    };
    const counted = METER.reduce((a, s) => a + r.by[s].n, 0);
    const rest = r.n - counted;
    const label = `${V.statuses.done.label} ${r.pct}%: ${joinList([...METER.map((s) => `${V.statuses[s].label} ${r.by[s].n}`), `${t('remaining')} ${rest}`])}`;
    return `<div class="meter${big ? ' lg' : ''}" role="img" aria-label="${esc(label)}" data-tip-rest="${esc(`${t('remaining')}: ${cardsWord(rest)}`)}">${METER.map(seg).join('')}</div>`;
  }
  const meterLegend = () => `<div class="legend" aria-hidden="true">
    ${METER.map((s) => `<span><i class="seg-${s}"></i>${esc(V.statuses[s].label)}</span>`).join('')}
    <span><i style="background:var(--st-todo)"></i>${esc(t('remaining'))}</span></div>`;
  const rowMeter = (label, tasks, attrs = '') => {
    const r = tally(tasks);
    return `<div class="row-meter">
      ${attrs ? `<button type="button" class="lbl" ${attrs}>${label}</button>` : `<div class="lbl">${label}</div>`}
      ${meter(tasks)}
      <div class="val">${r.pct}% · ${r.by.done.n}/${r.n}</div></div>`;
  };

  // ── shell ─────────────────────────────────────────────────────────────────
  const TABS = [
    ['overview', t('tabOverview')],
    ['board', t('tabBoard'), D.tasks.length],
    ['sections', t('tabSections'), D.sections.length],
    ['plan', t('tabPlan')],
    ['decisions', t('tabDecisions'), D.decisions.length],
    ['architecture', t('tabArchitecture')],
    ['activity', t('tabActivity')],
  ];

  function shell(active, content) {
    const all = tally(D.tasks);
    const dark = getComputedStyle(document.documentElement).colorScheme.includes('dark');
    return `
      <header class="top">
        <div class="brand"><h1>${esc(document.title)}</h1><span class="sub">${esc(t('builtAt', { t: fmtDateTime(D.builtAt) }))}</span></div>
        <div class="spacer"></div>
        <div class="top-meter" title="${esc(t('pctTitle'))}">
          <span class="pct">${all.pct}%</span>${meter(D.tasks, true)}
        </div>
        <button type="button" class="icon-btn" id="theme-btn" aria-label="${esc(dark ? t('themeLight') : t('themeDark'))}">${dark ? '☀' : '☾'}</button>
      </header>
      <nav class="tabs" role="tablist">
        ${TABS.map(([k, label, n]) => `<button type="button" role="tab" class="tab" data-tab="${k}" aria-selected="${k === active}">${esc(label)}${n != null ? `<span class="count">${n}</span>` : ''}</button>`).join('')}
      </nav>
      <main>${content}</main>
      ${D.warnings.length ? `<details class="warnings"><summary>${esc(t('warnings', { n: D.warnings.length }))}</summary><ul>${D.warnings.map((w) => `<li>${esc(w)}</li>`).join('')}</ul></details>` : ''}
      <div class="foot">${TX.foot}</div>`;
  }

  // ── overview ──────────────────────────────────────────────────────────────
  function whyNext(x) {
    const why = [];
    if (x.depends.length) why.push(t('whyDeps', { list: joinList(x.depends) }));
    else why.push(t('whyNoDeps'));
    why.push(t('whyPrio', { label: V.priorities[x.priority].label, p: x.priority }));
    if (PH.get(x.phase)) why.push(t('whyPhase', { phase: phLabel(x.phase), title: PH.get(x.phase).title }));
    if (x.unlocks) why.push(t('whyUnlocks', { cards: cardsWord(x.unlocks) }));
    return why;
  }

  function viewOverview() {
    const all = tally(D.tasks);
    const next = D.next ? T.get(D.next) : null;
    const current = D.current.map((id) => T.get(id));
    const decisions = ordered.filter((x) => x.status === 'decision');
    const clarify = ordered.filter((x) => x.status === 'clarify');
    const blocked = ordered.filter((x) => x.status === 'blocked');
    const readyCount = D.tasks.filter((x) => x.ready).length;

    const logs = [];
    for (const x of D.tasks) x.log.forEach((e, i) => logs.push({ ...e, task: x, i }));
    logs.sort((a, b) => b.date.localeCompare(a.date) || b.i - a.i);
    const issues = logs.filter((e) => e.type === 'issue' && e.task.status !== 'done');

    const hero = next ? `
      <section class="card hero" aria-labelledby="next-title">
        <div class="eyebrow">${esc(t('nextEyebrow'))}</div>
        <h2 id="next-title"><button type="button" data-open="${next.id}"><span class="tid">${next.id}</span> ${esc(next.title)}</button></h2>
        <div class="chips">${statusPill(next.status)}${prioPill(next.priority)}${next.layers.map(layerPill).join('')}${typePill(next)}<span class="pill">${esc(SEC.get(next.section)?.title ?? next.section)}</span>${next.phase ? `<span class="pill">${esc(phLabel(next.phase))}</span>` : ''}<span class="pill" title="${esc(V.sizes[next.size].hint)}">${esc(t('size', { label: V.sizes[next.size].label }))}</span></div>
        <ul class="why">${whyNext(next).map((w) => `<li>${esc(w)}</li>`).join('')}</ul>
        ${D.queue.length > 1 ? `<div class="queue"><span class="muted">${esc(t('queueAfter'))}</span>${D.queue.slice(1).map((id) => `<span class="arrow">${ARROW}</span><button type="button" class="qitem" data-open="${id}"><span class="tid">${id}</span> ${esc(T.get(id).title)}</button>`).join('')}</div>` : ''}
      </section>` : `
      <section class="card hero"><div class="eyebrow">${esc(t('nextEyebrow'))}</div><h2>${esc(t('noNextTitle'))}</h2>
        <p class="muted">${esc(HAS_CLIENT ? t('noNextBodyClient') : t('noNextBody'))}</p></section>`;

    const currentBlock = current.length ? `
      <section class="card"><h2>${esc(t('currentTitle'))}</h2><div class="list">${current.map((x) => `
        <div class="list-item">${prioPill(x.priority)}<div>${taskLink(x.id)}<div class="li-sub">${esc(SEC.get(x.section)?.title)}</div></div>${x.checks.total ? `<span class="small muted">${x.checks.done}/${x.checks.total}</span>` : ''}</div>`).join('')}</div></section>` : '';

    const kpi = (label, val, note, cls = '') => `<div class="kpi"><div class="k-label">${label}</div><div class="k-val ${cls}">${val}</div>${note ? `<div class="k-note">${note}</div>` : ''}</div>`;
    const RQ = D.requirements;
    const progressNote = joinList([`${esc(V.statuses.review.label)} ${all.by.review.n}`, ...(HAS_CLIENT ? [`${esc(V.statuses.uat.label)} ${all.by.uat.n}`] : [])]);
    const kpis = `<div class="kpis">
      ${kpi(esc(t('kpiPct')), `${all.pct}%`, esc(t('kpiPctNote')))}
      ${kpi(statusPill('done'), all.by.done.n, esc(t('kpiOf', { n: all.n })))}
      ${kpi(statusPill('in-progress'), all.by['in-progress'].n, progressNote)}
      ${kpi(esc(t('kpiReady')), readyCount, esc(t('kpiReadyNote')))}
      ${kpi(statusPill('decision'), all.by.decision.n, all.by.blocked.n ? `${statusPill('blocked')} ${all.by.blocked.n}` : esc(t('kpiDecisionNote')))}
      ${HAS_CLIENT ? kpi(statusPill('clarify'), all.by.clarify.n, esc(t('kpiClarifyNote'))) : ''}
      ${RQ.total ? kpi(esc(t('kpiReqs')), `${RQ.carded}/${RQ.total}`, esc(t('kpiReqsNote', { done: RQ.done })), RQ.carded < RQ.total ? 'warn' : '') : ''}
    </div>`;

    const byLayer = `<section class="card"><h2>${esc(t('byLayer'))}</h2><p class="card-sub">${esc(t('byLayerSub'))}</p>${meterLegend()}<div class="rows">
      ${LAYER_KEYS.map((l) => { const ts = D.tasks.filter((x) => x.layers.includes(l)); return ts.length ? rowMeter(layerPill(l), ts, `data-filter-layer="${esc(l)}" title="${esc(t('byLayerBtn', { label: V.layers[l].label }))}"`) : ''; }).join('')}
    </div></section>`;

    const byPhase = D.phases.length ? `<section class="card"><h2>${esc(t('byPhase'))}</h2><p class="card-sub">${esc(t('byPhaseSub'))}</p>${meterLegend()}<div class="rows">
      ${D.phases.map((p) => rowMeter(`<span class="tid">${p.id}</span> ${esc(p.title)}`, D.tasks.filter((x) => x.phase === p.id), `data-goto-phase="${p.id}"`)).join('')}
    </div></section>` : '';

    const bySection = `<section class="card"><h2>${esc(t('bySection'))}</h2>${meterLegend()}<div class="rows">
      ${D.sections.map((s) => rowMeter(esc(s.title), D.tasks.filter((x) => x.section === s.id), `data-goto-section="${esc(s.id)}"`)).join('')}
    </div></section>`;

    const decisionsBlock = `<section class="card"><h2>${esc(t('waitSup'))}</h2><p class="card-sub">${esc(t('waitSupSub'))}</p>
      ${decisions.length ? `<div class="list">${decisions.map((x) => `<div class="list-item">${prioPill(x.priority)}<div>${taskLink(x.id)}<div class="li-sub">${esc(SEC.get(x.section)?.title)}${x.unlocks ? ` · ${esc(t('holds', { cards: cardsWord(x.unlocks) }))}` : ''}</div></div><span></span></div>`).join('')}</div>` : `<div class="empty">${esc(t('nothingForYou'))}</div>`}
      ${blocked.length ? `<h3 class="small" style="margin:16px 0 6px">${esc(t('blockedTitle'))}</h3><div class="list">${blocked.map((x) => `<div class="list-item">${prioPill(x.priority)}<div>${taskLink(x.id)}</div><span></span></div>`).join('')}</div>` : ''}
    </section>`;

    const clientBlock = HAS_CLIENT ? `<section class="card"><h2>${esc(t('waitClient'))}</h2><p class="card-sub">${esc(t('waitClientSub'))}</p>
      ${clarify.length ? `<div class="list">${clarify.map((x) => `<div class="list-item">${prioPill(x.priority)}<div>${taskLink(x.id)}<div class="li-sub">${qList(x.questions)} · ${esc(SEC.get(x.section)?.title)}</div></div><span></span></div>`).join('')}</div>` : `<div class="empty">${esc(t('nothingClient'))}</div>`}
    </section>` : '';

    const issuesBlock = `<section class="card"><h2>${esc(t('issues'))}</h2><p class="card-sub">${esc(t('issuesSub'))}</p>
      ${issues.length ? `<div class="list">${issues.slice(0, 8).map((e) => `<div class="list-item"><span class="pill lt lt-issue">${esc(V.logTypes.issue.label)}</span><div><div class="small">${e.html}</div><div class="li-sub">${taskLink(e.task.id)} · ${esc(e.date)}</div></div><span></span></div>`).join('')}</div>` : `<div class="empty">${esc(t('noIssues'))}</div>`}
    </section>`;

    // "created" lines only say a card exists; the feed is for work that happened.
    const worked = logs.filter((e) => e.type !== 'created');
    const activity = `<section class="card"><h2>${esc(t('recent'))}</h2>
      ${worked.length ? `<div class="list">${worked.slice(0, 8).map((e) => `<div class="list-item"><span class="pill lt lt-${e.type}">${esc(V.logTypes[e.type].label)}</span><div><div class="small">${e.html}</div><div class="li-sub">${taskLink(e.task.id)} · ${esc(e.date)}</div></div><span></span></div>`).join('')}</div>
      <p class="small" style="margin:10px 0 0"><a href="#/activity">${esc(t('allLog'))} ${ARROW}</a></p>` : `<div class="empty">${esc(t('noUpdatesYet'))}</div>`}
    </section>`;

    return `<div class="grid">${hero}${currentBlock}${kpis}
      <div class="grid two">${decisionsBlock}${clientBlock}</div>
      <div class="grid two">${byPhase}${byLayer}</div>
      <div class="grid two">${issuesBlock}${activity}</div>
      ${bySection}</div>`;
  }

  // ── filters (board + sections share them) ────────────────────────────────
  const defaultFilters = { q: '', section: '', layers: [], priority: '', risk: '', phase: '', ready: false, hideDone: false };
  let filters = { ...defaultFilters, ...store.get('filters', {}) };
  filters.layers = (filters.layers || []).filter((l) => V.layers[l]);
  if (!HAS_RISK) filters.risk = '';
  const saveFilters = () => store.set('filters', filters);

  function applyFilters(tasks) {
    const q = filters.q.trim().toLowerCase();
    return tasks.filter((x) => (!q || x.text.includes(q))
      && (!filters.section || x.section === filters.section)
      && (!filters.layers.length || filters.layers.some((l) => x.layers.includes(l)))
      && (!filters.priority || x.priority === filters.priority)
      && (!filters.risk || x.risk === filters.risk)
      && (!filters.phase || x.phase === filters.phase)
      && (!filters.ready || x.ready)
      && (!filters.hideDone || x.status !== 'done'));
  }

  function filterBar(count, { showSection = true } = {}) {
    const opt = (v, label, cur) => `<option value="${esc(v)}"${v === cur ? ' selected' : ''}>${esc(label)}</option>`;
    return `<div class="filters" role="search">
      <input type="search" id="f-q" placeholder="${esc(t('searchPlaceholder'))}" value="${esc(filters.q)}" aria-label="${esc(t('searchAria'))}">
      ${showSection ? `<select id="f-section" aria-label="${esc(t('fSection'))}">${opt('', t('allSections'), filters.section)}${D.sections.map((s) => opt(s.id, s.title, filters.section)).join('')}</select>` : ''}
      <select id="f-priority" aria-label="${esc(t('fPriority'))}">${opt('', t('allPriorities'), filters.priority)}${Object.entries(V.priorities).map(([k, p]) => opt(k, `${k} · ${p.label}`, filters.priority)).join('')}</select>
      ${HAS_RISK ? `<select id="f-risk" aria-label="${esc(t('fRisk'))}">${opt('', t('allRisks'), filters.risk)}${Object.entries(V.risks).map(([k, r]) => opt(k, t('riskPill', { label: r.label }), filters.risk)).join('')}</select>` : ''}
      ${D.phases.length ? `<select id="f-phase" aria-label="${esc(t('fPhase'))}">${opt('', t('allPhases'), filters.phase)}${D.phases.map((p) => opt(p.id, `${p.id} · ${p.title}`, filters.phase)).join('')}</select>` : ''}
      <div class="chips">${LAYER_KEYS.map((l) => `<button type="button" class="pill ${layerCls(l)} layer-toggle" data-layer="${esc(l)}" aria-pressed="${filters.layers.includes(l)}">${esc(V.layers[l].label)}</button>`).join('')}</div>
      <label class="toggle"><input type="checkbox" id="f-ready"${filters.ready ? ' checked' : ''}> ${esc(t('readyOnly'))}</label>
      <label class="toggle"><input type="checkbox" id="f-hide-done"${filters.hideDone ? ' checked' : ''}> ${esc(t('hideDone'))}</label>
      <button type="button" class="icon-btn small" id="f-reset">${esc(t('reset'))}</button>
      <span class="result">${esc(cardsWord(count))}</span>
    </div>`;
  }

  // ── board (kanban) ────────────────────────────────────────────────────────
  function tcard(x) {
    const isNext = x.id === D.next;
    const foot = [];
    if (x.checks.total) foot.push(`☐ ${x.checks.done}/${x.checks.total}`);
    if (x.questions.length && x.status !== 'done') foot.push(`<span class="waiting">❓ ${esc(joinList(x.questions))}</span>`);
    if (x.status !== 'done') {
      if (x.waitingOn.length) foot.push(`<span class="waiting">${esc(t('waitingOn', { x: x.waitingOn.length > 3 ? cardsWord(x.waitingOn.length) : joinList(x.waitingOn) }))}</span>`);
      else if (x.ready) foot.push(`<span class="ready">${esc(t('readyShort'))}</span>`);
    }
    if (x.unlocks && x.status !== 'done') foot.push(esc(t('opens', { n: x.unlocks })));
    return `<button type="button" class="tcard${isNext ? ' is-next' : ''}" data-open="${x.id}">
      <div class="tc-top"><span class="tid">${x.id} · #${x.seq}</span><span class="chips">${isNext ? `<span class="badge-next">${esc(t('nextBadge'))}</span>` : ''}${typePill(x)}${prioPill(x.priority)}</span></div>
      <div class="tc-title">${esc(x.title)}</div>
      <div class="tc-sec">${esc(SEC.get(x.section)?.title ?? '')}${x.phase ? ` · ${esc(phLabel(x.phase))}` : ''}</div>
      <div class="chips">${x.layers.map(layerPill).join('')}</div>
      ${foot.length ? `<div class="tc-foot">${foot.join('<span aria-hidden="true">·</span>')}</div>` : ''}
    </button>`;
  }

  function viewBoard() {
    const list = applyFilters(ordered);
    const cols = STATUS_ORDER.filter((s) => !(filters.hideDone && s === 'done')).map((s) => {
      const ts = list.filter((x) => x.status === s);
      return `<section class="col" aria-label="${esc(V.statuses[s].label)}">
        <div class="col-head">${statusPill(s)}<span class="n">${ts.length}</span></div>
        <div class="col-body">${ts.length ? ts.map(tcard).join('') : '<div class="empty">—</div>'}</div></section>`;
    }).join('');
    return `${filterBar(list.length)}<div class="kanban">${cols}</div>`;
  }

  // ── sections ──────────────────────────────────────────────────────────────
  const ownDeps = (x) => x.depends.filter((d) => !x.gated.includes(d));
  // Same rule as the build's planner (a phase gate counts only when done), computed there.
  const delivered = (id) => T.get(id)?.delivered === true;
  const depSpan = (d) => `<span class="dep ${delivered(d) ? 'ok' : 'wait'}">${delivered(d) ? '✓' : '⏳'} ${d}</span>`;

  function taskTable(ts) {
    if (!ts.length) return `<div class="empty">${esc(t('noMatches'))}</div>`;
    return `<div class="table-wrap"><table>
      <thead><tr><th>#</th><th>${esc(t('thCard'))}</th><th>${esc(t('thStatus'))}</th><th>${esc(t('thPriority'))}</th><th>${esc(t('thLayers'))}</th><th>${esc(t('thDepends'))}</th><th>${esc(t('thPhase'))}</th></tr></thead>
      <tbody>${ts.map((x) => `<tr class="clickable" data-open="${x.id}" tabindex="0">
        <td class="num">${x.seq}</td>
        <td>${typePill(x)} <span class="tid">${x.id}</span> ${esc(x.title)}${x.id === D.next ? ` <span class="badge-next">${esc(t('nextBadge'))}</span>` : ''}</td>
        <td>${statusPill(x.status)}</td><td>${prioPill(x.priority)}</td>
        <td><div class="chips">${x.layers.map(layerPill).join('')}</div></td>
        <td>${ownDeps(x).length ? ownDeps(x).map(depSpan).join(' ') : '<span class="muted">—</span>'}</td>
        <td class="num">${esc(x.phase)}</td></tr>`).join('')}</tbody></table></div>`;
  }

  function viewSections() {
    const list = applyFilters(ordered);
    const secs = D.sections.filter((s) => !filters.section || s.id === filters.section);
    return `${filterBar(list.length)}${meterLegend()}${secs.map((s) => {
      const all = D.tasks.filter((x) => x.section === s.id);
      const ts = list.filter((x) => x.section === s.id);
      const r = tally(all);
      const layers = LAYER_KEYS.filter((l) => all.some((x) => x.layers.includes(l)));
      return `<section class="card sec-card" id="sec-${esc(s.id)}">
        <div class="sec-head"><div><h3><span class="tid">${esc(s.id)}</span> ${esc(s.title)}</h3><div class="chips" style="margin-top:6px">${layers.map(layerPill).join('')}</div></div>
          <div class="sec-stats">${meter(all)}<div class="small muted" style="margin-top:6px">${esc(t('secStats', { pct: r.pct, done: r.by.done.n, n: r.n }))} · <span class="src">${esc(s.file)}</span></div></div></div>
        <div class="sec-desc">${s.html}</div>
        ${taskTable(ts)}</section>`;
    }).join('')}`;
  }

  // ── plan ──────────────────────────────────────────────────────────────────
  function viewPlan() {
    const groups = D.phases.length ? D.phases.map((p) => ({ p, ts: ordered.filter((x) => x.phase === p.id) })) : [{ p: null, ts: ordered }];
    const orphan = D.phases.length ? ordered.filter((x) => !PH.get(x.phase)) : [];
    if (orphan.length) groups.push({ p: { id: '—', title: t('noPhase'), html: '' }, ts: orphan });
    const badge = `<span class="badge-next">${esc(t('nextBadge'))}</span>`;
    const intro = `<section class="card" style="margin-bottom:16px"><div class="prose">${D.phasesHtml || ''}
      <p class="small muted" style="margin:0">${fill(esc(TX.planIntro), { badge })}</p></div></section>`;
    return intro + groups.map(({ p, ts }) => {
      const r = tally(ts);
      return `<section class="card phase" id="phase-${p ? p.id : 'all'}">
        ${p ? `<div class="phase-head"><div><h3><span class="tid">${p.id}</span> ${esc(p.title)}</h3>${p.goal ? `<p class="phase-goal">${esc(p.goal)}</p>` : ''}${p.gate && p.gate.length ? `<p class="small muted" style="margin:4px 0 0">${fill(esc(TX.gateLine), { list: joinList(p.gate.map((g) => taskLink(g))) })}</p>` : ''}</div>
          <div class="sec-stats" style="min-width:220px">${meter(ts)}<div class="small muted" style="margin-top:6px">${r.pct}% · ${r.by.done.n}/${r.n}</div></div></div>
          ${p.html ? `<div class="sec-desc prose" style="margin-top:8px">${p.html}</div>` : ''}` : ''}
        <ol class="plan-list">${ts.map((x) => `
          <li class="plan-item${x.status === 'done' ? ' is-done' : ''}${x.id === D.next ? ' is-next' : ''}" data-open="${x.id}" tabindex="0">
            <div class="p-seq">${x.seq}</div>
            <div><div class="p-title">${typePill(x)} <span class="tid">${x.id}</span> ${esc(x.title)} ${x.id === D.next ? badge : ''}</div>
              <div class="p-deps">${esc(SEC.get(x.section)?.title)}${ownDeps(x).length ? esc(t('dependsOn')) + ownDeps(x).map(depSpan).join(' ') : ''}${x.unlocks ? ` · ${esc(t('opens', { n: x.unlocks }))}` : ''}</div></div>
            <div class="chips">${statusPill(x.status)}${prioPill(x.priority)}</div>
          </li>`).join('')}</ol></section>`;
    }).join('');
  }

  // ── decisions ─────────────────────────────────────────────────────────────
  function viewDecisions() {
    const intro = D.decisionsHtml ? `<section class="card" style="margin-bottom:16px"><div class="prose">${D.decisionsHtml}</div></section>` : '';
    const pending = ordered.filter((x) => x.status === 'decision');
    const pendingBlock = pending.length ? `<section class="card" style="margin-bottom:16px"><h2>${esc(t('decPending', { n: pending.length }))}</h2><div class="list">${pending.map((x) => `<div class="list-item">${prioPill(x.priority)}<div>${taskLink(x.id)}${x.unlocks ? `<div class="li-sub">${esc(t('holds', { cards: cardsWord(x.unlocks) }))}</div>` : ''}</div><span></span></div>`).join('')}</div></section>` : '';
    const list = [...D.decisions].reverse();
    return intro + pendingBlock + (list.length ? list.map((d) => `
      <section class="card dec" id="dec-${d.id}">
        <div class="dec-head"><span class="tid">${d.id}</span><h3>${esc(d.title)}</h3>
          <span class="pill dec-status-${d.status}">${esc((V.decisionStatuses[d.status] || { label: d.status }).label)}</span>
          ${d.supersededBy ? `<span class="small">${fill(esc(TX.supersededBy), { link: DEC.get(d.supersededBy) ? `<a class="ref" href="#/decision/${d.supersededBy}">${d.supersededBy}</a>` : esc(d.supersededBy) })}</span>` : ''}
          ${d.date ? `<span class="small muted">${esc(d.date)}</span>` : ''}</div>
        <div class="prose">${d.html}</div>
        ${d.tasks.length ? `<div class="chips small" style="margin-top:8px"><span class="muted">${esc(t('relatedCards'))}</span>${d.tasks.map((id) => `<button type="button" class="dep-chip" data-open="${id}"><span class="tid">${id}</span></button>`).join('')}</div>` : ''}
        <p class="src" style="margin:10px 0 0">${esc(d.file)}</p>
      </section>`).join('') : `<div class="empty">${esc(t('noDecisions'))}</div>`);
  }

  // ── architecture ──────────────────────────────────────────────────────────
  function viewArchitecture() {
    const A = D.architecture;
    return `<div class="arch">
      <nav class="toc card" aria-label="${esc(t('tocAria'))}">${A.toc.map((h) => `<a class="lv${h.lv}" href="#/architecture/${h.id}">${esc(h.text)}</a>`).join('')}</nav>
      <div class="arch-files">${A.files.length ? A.files.map((f) => `<article class="card prose" id="${f.id}">${f.html}</article>`).join('') : `<div class="empty">${esc(t('noArch'))}</div>`}</div></div>`;
  }

  // ── activity ──────────────────────────────────────────────────────────────
  let activityType = store.get('activityType', '');
  if (activityType && !V.logTypes[activityType]) activityType = '';
  function viewActivity() {
    const logs = [];
    for (const x of D.tasks) x.log.forEach((e, i) => logs.push({ ...e, task: x, i }));
    logs.sort((a, b) => b.date.localeCompare(a.date) || b.i - a.i);
    const shown = activityType ? logs.filter((e) => e.type === activityType) : logs;
    const byDay = new Map();
    for (const e of shown) { if (!byDay.has(e.date)) byDay.set(e.date, []); byDay.get(e.date).push(e); }
    const opts = `<option value="">${esc(t('allTypes'))}</option>${Object.entries(V.logTypes).map(([k, v]) => `<option value="${k}"${k === activityType ? ' selected' : ''}>${esc(v.label)}</option>`).join('')}`;
    return `<div class="filters"><select id="f-logtype" aria-label="${esc(t('logTypeAria'))}">${opts}</select><span class="result">${esc(t('updatesCount', { n: shown.length }))}</span></div>
      <section class="card">${shown.length ? [...byDay].map(([day, es]) => `
        <div class="tl-day">${esc(fmtDate(day))}</div>
        ${es.map((e) => `<div class="tl-item"><div><span class="pill lt lt-${e.type}">${esc(V.logTypes[e.type].label)}</span></div>
          <div><div class="tl-body">${e.html}</div><div class="tl-task">${taskLink(e.task.id)}</div></div></div>`).join('')}`).join('') : `<div class="empty">${esc(t('noUpdates'))}</div>`}</section>`;
  }

  // ── task drawer ───────────────────────────────────────────────────────────
  function drawer(x) {
    const sec = SEC.get(x.section);
    const ph = PH.get(x.phase);
    const decs = (x.decisions || []).map((id) => DEC.get(id)).filter(Boolean);
    const depChip = (id) => { const d = T.get(id); return `<button type="button" class="dep-chip" data-open="${id}"><span class="ico">${esc(V.statuses[d.status].icon)}</span><span class="tid">${id}</span> ${esc(d.title)}${x.gated.includes(id) ? ` <span class="muted small">${esc(t('gateNote'))}</span>` : ''}</button>`; };
    const reqStatus = x.req && x.req.status ? `<span class="pill">${esc(V.reqStatuses[x.req.status] || x.req.status)}</span>` : '';
    const req = x.req ? `<div class="req-box"><div class="req-head"><span class="m-label">${esc(t('reqText'))}</span><span class="chips">${typePill(x)}${reqStatus}${x.req.source ? `<span class="pill">${esc(x.req.source)}</span>` : ''}</span></div><div class="prose">${x.req.html}</div></div>` : '';
    const meta = (label, val) => `<div><div class="m-label">${esc(label)}</div><div class="m-val">${val}</div></div>`;
    return `<div class="backdrop" data-close></div>
      <aside class="drawer" role="dialog" aria-modal="true" aria-labelledby="dr-title">
        <div class="drawer-head">
          <div class="dh-top"><span><span class="tid">${x.id}</span> <span class="small muted">· ${esc(t('seqLabel', { n: x.seq }))}</span></span><button type="button" class="icon-btn" data-close aria-label="${esc(t('close'))}">✕</button></div>
          <h2 id="dr-title">${esc(x.title)}</h2>
          <div class="chips">${statusPill(x.status)}${prioPill(x.priority)}${riskPill(x.risk)}${x.layers.map(layerPill).join('')}${x.id === D.next ? `<span class="badge-next">${esc(t('nextCandidate'))}</span>` : ''}</div>
        </div>
        <div class="drawer-body">
          <div class="meta-grid">
            ${meta(t('mSection'), `<a href="#/sections/${x.section}">${esc(sec?.title ?? x.section)}</a>`)}
            ${meta(t('mPhase'), ph ? `<a href="#/plan/${ph.id}">${ph.id} · ${esc(ph.title)}</a>` : esc(x.phase || '—'))}
            ${x.questions.length ? meta(t('mQuestions'), qList(x.questions)) : ''}
            ${meta(t('mSize'), `${esc(V.sizes[x.size].label)} <span class="muted small">(${esc(V.sizes[x.size].hint)})</span>`)}
            ${meta(t('mReadiness'), x.status === 'done' ? esc(V.statuses.done.label) : x.ready ? `<span class="ready">${esc(t('readyFull'))}</span>` : x.waitingOn.length ? esc(t('waitingOn', { x: cardsWord(x.waitingOn.length) })) : esc(V.statuses[x.status].label))}
            ${x.checks.total ? meta(t('mChecks'), `${x.checks.done}/${x.checks.total}`) : ''}
          </div>
          ${req}
          <div class="prose">${x.html || (x.req ? '' : `<p class="muted">${esc(t('noDesc'))}</p>`)}</div>
          ${x.depends.length ? `<h4>${esc(t('hDepends'))}</h4><div class="dep-list">${x.depends.map(depChip).join('')}</div>` : ''}
          ${x.dependents.length ? `<h4>${esc(t('hDependents'))}${x.unlocks > x.dependents.length ? esc(t('dependentsTotal', { cards: cardsWord(x.unlocks) })) : ''}</h4><div class="dep-list">${x.dependents.length > 12 ? `<span class="muted small">${esc(t('dependentsGate', { cards: cardsWord(x.dependents.length) }))}</span>` : x.dependents.map(depChip).join('')}</div>` : ''}
          ${decs.length ? `<h4>${esc(t('hDecisions'))}</h4><div class="dep-list">${decs.map((d) => `<a class="dep-chip" href="#/decision/${d.id}"><span class="tid">${d.id}</span> ${esc(d.title)}</a>`).join('')}</div>` : ''}
          <h4>${esc(t('hLog'))}</h4>
          ${x.log.length ? `<ol class="log">${[...x.log].reverse().map((e) => `<li class="lt-${e.type}-row"><div class="log-meta"><span class="pill lt lt-${e.type}">${esc(V.logTypes[e.type].label)}</span>${esc(e.date)}</div><div class="log-text">${e.html}</div></li>`).join('')}</ol>` : `<p class="muted small">${esc(t('noUpdatesYet'))}</p>`}
          <p class="src" style="margin-top:24px">${esc(x.file)}:${x.line}</p>
        </div>
      </aside>`;
  }

  // ── routing & events ──────────────────────────────────────────────────────
  let lastTab = store.get('tab', 'overview');
  let lastFocus = null;

  function route() {
    // A hand-typed hash with a broken %-sequence is read as written instead of stopping the page.
    const decode = (s) => { try { return decodeURIComponent(s); } catch { return s; } };
    const parts = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decode);
    let [tab, arg] = parts;
    let openTask = null;
    let scrollTo = null;

    if (tab === 'task' && T.get(arg)) { openTask = arg; tab = lastTab; }
    else if (tab === 'decision') { tab = 'decisions'; scrollTo = arg ? `dec-${arg}` : null; }
    else if (tab === 'sections' && arg) scrollTo = `sec-${arg}`;
    else if (tab === 'plan' && arg) scrollTo = `phase-${arg}`;
    else if (tab === 'architecture' && arg) scrollTo = arg;
    if (!TABS.some(([k]) => k === tab)) tab = lastTab;
    if (!TABS.some(([k]) => k === tab)) tab = 'overview';
    lastTab = tab;
    store.set('tab', tab);

    const views = { overview: viewOverview, board: viewBoard, sections: viewSections, plan: viewPlan, decisions: viewDecisions, architecture: viewArchitecture, activity: viewActivity };
    const y = window.scrollY;
    app.innerHTML = shell(tab, views[tab]()) + (openTask ? drawer(T.get(openTask)) : '');
    document.body.style.overflow = openTask ? 'hidden' : '';

    if (openTask) {
      window.scrollTo(0, y);
      app.querySelector('.drawer [data-close]')?.focus();
    } else if (scrollTo) {
      requestAnimationFrame(() => document.getElementById(scrollTo)?.scrollIntoView({ block: 'start' }));
    } else if (lastFocus === 'drawer') {
      window.scrollTo(0, y);
    }
    lastFocus = openTask ? 'drawer' : null;
  }

  const setFilters = (patch) => { filters = { ...filters, ...patch }; saveFilters(); route(); };

  app.addEventListener('click', (e) => {
    const el = e.target.closest('[data-open],[data-close],[data-tab],[data-layer],[data-filter-layer],[data-goto-section],[data-goto-phase],#theme-btn,#f-reset,a.ref');
    if (!el) return;
    if (el.matches('a.ref')) return; // plain hash navigation
    if (el.hasAttribute('data-open')) { location.hash = `#/task/${el.getAttribute('data-open')}`; return; }
    if (el.hasAttribute('data-close')) { location.hash = `#/${lastTab}`; return; }
    if (el.hasAttribute('data-tab')) { location.hash = `#/${el.getAttribute('data-tab')}`; return; }
    if (el.hasAttribute('data-layer')) {
      const l = el.getAttribute('data-layer');
      setFilters({ layers: filters.layers.includes(l) ? filters.layers.filter((x) => x !== l) : [...filters.layers, l] });
      return;
    }
    if (el.hasAttribute('data-filter-layer')) { filters = { ...defaultFilters, layers: [el.getAttribute('data-filter-layer')] }; saveFilters(); location.hash = '#/board'; return; }
    if (el.hasAttribute('data-goto-section')) { location.hash = `#/sections/${el.getAttribute('data-goto-section')}`; return; }
    if (el.hasAttribute('data-goto-phase')) { location.hash = `#/plan/${el.getAttribute('data-goto-phase')}`; return; }
    if (el.id === 'f-reset') { filters = { ...defaultFilters }; saveFilters(); route(); return; }
    if (el.id === 'theme-btn') {
      const dark = getComputedStyle(document.documentElement).colorScheme.includes('dark');
      const next = dark ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      store.set('theme', next);
      route();
    }
  });

  app.addEventListener('keydown', (e) => {
    if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('tr[data-open], li[data-open]')) {
      e.preventDefault();
      location.hash = `#/task/${e.target.getAttribute('data-open')}`;
    }
  });

  let qTimer = null;
  app.addEventListener('input', (e) => {
    if (e.target.id === 'f-q') {
      clearTimeout(qTimer);
      const v = e.target.value;
      qTimer = setTimeout(() => {
        filters.q = v; saveFilters(); route();
        const input = document.getElementById('f-q');
        if (input) { input.focus(); input.setSelectionRange(v.length, v.length); }
      }, 180);
    }
  });
  app.addEventListener('change', (e) => {
    const id = e.target.id;
    if (id === 'f-section') setFilters({ section: e.target.value });
    else if (id === 'f-priority') setFilters({ priority: e.target.value });
    else if (id === 'f-risk') setFilters({ risk: e.target.value });
    else if (id === 'f-phase') setFilters({ phase: e.target.value });
    else if (id === 'f-ready') setFilters({ ready: e.target.checked });
    else if (id === 'f-hide-done') setFilters({ hideDone: e.target.checked });
    else if (id === 'f-logtype') { activityType = e.target.value; store.set('activityType', activityType); route(); }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && location.hash.startsWith('#/task/')) location.hash = `#/${lastTab}`;
  });

  // Tooltip for meter segments.
  document.addEventListener('mousemove', (e) => {
    const seg = e.target.closest('[data-tip]');
    const rest = !seg && e.target.closest('[data-tip-rest]');
    const text = seg ? seg.getAttribute('data-tip') : rest ? rest.getAttribute('data-tip-rest') : null;
    if (!text) { tip.hidden = true; return; }
    tip.textContent = text;
    tip.hidden = false;
    const pad = 14;
    const w = tip.offsetWidth;
    const h = tip.offsetHeight;
    let x = e.clientX - w / 2;
    let y = e.clientY - h - pad;
    if (y < 4) y = e.clientY + pad;
    x = Math.max(4, Math.min(window.innerWidth - w - 4, x));
    tip.style.left = `${x}px`;
    tip.style.top = `${y}px`;
  });
  document.addEventListener('scroll', () => { tip.hidden = true; }, { passive: true });

  const savedTheme = store.get('theme', null);
  if (savedTheme === 'light' || savedTheme === 'dark') document.documentElement.setAttribute('data-theme', savedTheme);
  window.addEventListener('hashchange', route);
  route();
})();
