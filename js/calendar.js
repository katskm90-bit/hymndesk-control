// ============================================================================
// HymnDesk Control · Calendar
// ----------------------------------------------------------------------------
// A month view showing the current user's sessions, tasks with deadlines, and
// invitations they accepted. Managers (Admin, PM, Director / Producer) can
// switch to a Project calendar that shows everything across the project.
// ============================================================================

(function () {
  'use strict';
  const M = {}; window.HD_Calendar = M;
  let supabase = null, myRole = null;
  let cursor = new Date();  cursor.setDate(1);
  let scope = 'me';   // 'me' or 'project'
  let events = [];
  let monthCache = { key: null };

  const DAYS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];

  function el(tag, attrs, ...children) {
    const e = document.createElement(tag);
    if (attrs) for (const k of Object.keys(attrs)) {
      if (k === 'class') e.className = attrs[k];
      else if (k === 'html') e.innerHTML = attrs[k];
      else if (k.startsWith('on') && typeof attrs[k] === 'function') e.addEventListener(k.slice(2), attrs[k]);
      else if (attrs[k] != null) e.setAttribute(k, attrs[k]);
    }
    for (const c of children) if (c != null) e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    return e;
  }
  function toast(msg, kind = 'info') {
    const c = { info:'bg-stone-900 text-white', success:'bg-emerald-600 text-white', error:'bg-red-600 text-white' };
    const t = el('div', { class:`fixed bottom-4 left-1/2 -translate-x-1/2 z-[60] ${c[kind]} px-4 py-2 rounded-lg shadow-lg text-sm` });
    t.textContent = msg; document.body.appendChild(t); setTimeout(() => t.remove(), 3500);
  }
  function projectId() { return window.HD_Project ? window.HD_Project.getId() : null; }
  function canManage() { return ['Admin','Project Manager','Director / Producer'].includes(myRole); }
  function ymd(d) { const y=d.getFullYear(), m=String(d.getMonth()+1).padStart(2,'0'), dd=String(d.getDate()).padStart(2,'0'); return `${y}-${m}-${dd}`; }
  function monthLabel(d) { return d.toLocaleDateString('en-ZA', { year:'numeric', month:'long' }); }
  function todayYmd() { return ymd(new Date()); }

  function monthRange(d) {
    const first = new Date(d.getFullYear(), d.getMonth(), 1);
    const last = new Date(d.getFullYear(), d.getMonth()+1, 0);
    return { from: ymd(first), to: ymd(last) };
  }

  async function loadAll() {
    const { data: { user } } = await supabase.auth.getUser();
    const pRes = await supabase.from('users').select('role:roles(name)').eq('id', user.id).maybeSingle();
    myRole = pRes.data?.role?.name || null;
    if (!canManage()) scope = 'me';
    const { from, to } = monthRange(cursor);
    const { data, error } = await supabase.rpc('list_my_calendar_events', {
      p_from: from, p_to: to, p_project_id: projectId(), p_scope: scope,
    });
    if (error) throw error;
    events = data || [];
    monthCache.key = `${from}_${scope}`;
  }

  M.render = function (container, opts) {
    supabase = opts.supabase;
    container.innerHTML = '<div class="text-sm text-stone-500">Loading...</div>';
    loadAll().then(() => { container.innerHTML = ''; container.appendChild(renderPage()); })
      .catch(err => { container.innerHTML = '';
        container.appendChild(el('div', { class:'bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 text-sm' }, 'Could not load: ' + (err.message || err))); });
  };

  function reload() {
    const main = document.getElementById('page-content'); if (!main) return;
    main.innerHTML = '<div class="text-sm text-stone-500">Loading...</div>';
    loadAll().then(() => { main.innerHTML = ''; main.appendChild(renderPage()); })
      .catch(err => { main.innerHTML=''; main.appendChild(el('div', { class:'bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 text-sm' }, 'Could not load: ' + (err.message || err))); });
  }

  function eventColour(ev) {
    if (ev.source === 'session') return 'bg-brand-500 text-white';
    if (ev.source === 'invitation') {
      if (ev.status === 'Tentative') return 'bg-amber-100 text-amber-800 border border-amber-200';
      return 'bg-blue-100 text-blue-800 border border-blue-200';
    }
    if (ev.source === 'task') {
      const s = (ev.status || '').toLowerCase();
      if (s.includes('done') || s.includes('complete')) return 'bg-emerald-100 text-emerald-800 border border-emerald-200';
      if (s.includes('block')) return 'bg-red-100 text-red-800 border border-red-200';
      return 'bg-stone-100 text-stone-800 border border-stone-200';
    }
    return 'bg-stone-100 text-stone-800 border border-stone-200';
  }
  function eventLabel(ev) {
    const prefix = ev.start_time ? ev.start_time + ' ' : '';
    return prefix + ev.title;
  }

  function renderPage() {
    const wrap = el('div', { class:'space-y-4' });

    wrap.appendChild(el('div', { class:'flex items-start justify-between gap-3 flex-wrap' },
      el('div', null,
        el('h2', { class:'text-xl lg:text-2xl font-bold text-stone-900' }, 'Calendar'),
        el('p', { class:'text-sm text-stone-500 mt-1' }, scope === 'me' ? 'Your sessions, deadlines, and accepted invitations.' : 'Everything across the project.')),
      canManage() ? el('div', { class:'inline-flex bg-stone-100 rounded-lg p-1 text-sm' },
        el('button', { class:`px-3 py-1 rounded-md ${scope==='me'?'bg-white shadow-sm font-medium':'text-stone-600'}`, onclick:()=>{ scope='me'; reload(); } }, 'My calendar'),
        el('button', { class:`px-3 py-1 rounded-md ${scope==='project'?'bg-white shadow-sm font-medium':'text-stone-600'}`, onclick:()=>{ scope='project'; reload(); } }, 'Project calendar'),
      ) : null,
    ));

    // Month navigation
    wrap.appendChild(el('div', { class:'flex items-center justify-between' },
      el('div', { class:'flex items-center gap-2' },
        el('button', { class:'px-3 py-1.5 text-sm rounded-lg border border-stone-300 hover:bg-stone-50', onclick:()=>{ cursor.setMonth(cursor.getMonth()-1); reload(); } }, '‹ Prev'),
        el('button', { class:'px-3 py-1.5 text-sm rounded-lg border border-stone-300 hover:bg-stone-50', onclick:()=>{ cursor = new Date(); cursor.setDate(1); reload(); } }, 'Today'),
        el('button', { class:'px-3 py-1.5 text-sm rounded-lg border border-stone-300 hover:bg-stone-50', onclick:()=>{ cursor.setMonth(cursor.getMonth()+1); reload(); } }, 'Next ›'),
      ),
      el('div', { class:'text-base font-semibold text-stone-900' }, monthLabel(cursor)),
    ));

    // Grid
    wrap.appendChild(renderGrid());

    // Legend
    wrap.appendChild(el('div', { class:'flex items-center gap-4 flex-wrap text-xs text-stone-600 pt-2' },
      el('span', { class:'inline-flex items-center gap-1' }, el('span', { class:'inline-block w-3 h-3 rounded bg-brand-500' }), 'Session'),
      el('span', { class:'inline-flex items-center gap-1' }, el('span', { class:'inline-block w-3 h-3 rounded bg-blue-100 border border-blue-200' }), 'Invitation'),
      el('span', { class:'inline-flex items-center gap-1' }, el('span', { class:'inline-block w-3 h-3 rounded bg-amber-100 border border-amber-200' }), 'Tentative'),
      el('span', { class:'inline-flex items-center gap-1' }, el('span', { class:'inline-block w-3 h-3 rounded bg-stone-100 border border-stone-200' }), 'Task'),
    ));
    return wrap;
  }

  function renderGrid() {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const last = new Date(cursor.getFullYear(), cursor.getMonth()+1, 0);
    // Monday-first grid
    const startOffset = (first.getDay() + 6) % 7;
    const totalCells = Math.ceil((startOffset + last.getDate()) / 7) * 7;

    // Group events by ymd
    const byDay = {};
    events.forEach(ev => { (byDay[ev.event_date] ||= []).push(ev); });

    const grid = el('div', { class:'bg-white border border-stone-200 rounded-xl overflow-hidden' });
    // Headers
    const head = el('div', { class:'grid grid-cols-7 bg-stone-50 border-b border-stone-200' });
    DAYS.forEach(d => head.appendChild(el('div', { class:'px-2 py-2 text-xs font-medium text-stone-600 text-center' }, d)));
    grid.appendChild(head);

    const body = el('div', { class:'grid grid-cols-7' });
    const today = todayYmd();
    for (let i = 0; i < totalCells; i++) {
      const dayNum = i - startOffset + 1;
      const inMonth = dayNum >= 1 && dayNum <= last.getDate();
      const cellDate = inMonth ? new Date(cursor.getFullYear(), cursor.getMonth(), dayNum) : null;
      const key = cellDate ? ymd(cellDate) : null;
      const isToday = key === today;
      const cell = el('div', { class:`min-h-[92px] border-b border-r border-stone-100 p-1.5 ${inMonth ? '' : 'bg-stone-50'} ${isToday ? 'bg-brand-50' : ''}` });
      if (inMonth) {
        cell.appendChild(el('div', { class:`text-xs font-medium mb-1 ${isToday ? 'text-brand-700' : 'text-stone-600'}` }, String(dayNum)));
        const dayEvents = byDay[key] || [];
        const visible = dayEvents.slice(0, 3);
        visible.forEach(ev => {
          const chip = el('button', { class:`block w-full text-left text-[11px] leading-tight px-1.5 py-0.5 mb-1 rounded truncate ${eventColour(ev)}`,
            title: eventLabel(ev), onclick: () => openEvent(ev) }, eventLabel(ev));
          cell.appendChild(chip);
        });
        if (dayEvents.length > visible.length) {
          cell.appendChild(el('button', { class:'text-[11px] text-brand-600 hover:text-brand-700',
            onclick: () => openDay(key, dayEvents) }, `+${dayEvents.length - visible.length} more`));
        }
      }
      body.appendChild(cell);
    }
    grid.appendChild(body);
    return grid;
  }

  function openEvent(ev) {
    if (ev.source === 'session')    { window.location.hash = '#/schedule'; }
    else if (ev.source === 'task')  { window.location.hash = ev.is_mine ? '#/mytasks' : '#/tasks'; }
    else if (ev.source === 'invitation') { window.location.hash = '#/invitations'; }
  }

  function openDay(dateStr, dayEvents) {
    const overlay = el('div', { class:'fixed inset-0 z-50 bg-stone-900/50 flex items-end sm:items-center justify-center p-0 sm:p-4' });
    const dialog  = el('div', { class:'bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl shadow-xl max-h-[90vh] flex flex-col' });
    overlay.appendChild(dialog);
    dialog.appendChild(el('div', { class:'px-5 py-4 border-b border-stone-200 flex items-center justify-between' },
      el('h3', { class:'text-base font-semibold' }, new Date(dateStr).toLocaleDateString('en-ZA', { weekday:'long', year:'numeric', month:'long', day:'numeric' })),
      el('button', { class:'text-stone-400 hover:text-stone-600 text-xl leading-none', onclick:()=>overlay.remove() }, '×')));
    const body = el('div', { class:'flex-1 overflow-y-auto p-4 space-y-2' });
    dayEvents.forEach(ev => {
      body.appendChild(el('button', { class:`block w-full text-left text-sm px-3 py-2 rounded-lg ${eventColour(ev)}`,
        onclick: () => { overlay.remove(); openEvent(ev); } },
        el('div', { class:'font-medium' }, eventLabel(ev)),
        ev.subtitle ? el('div', { class:'text-xs opacity-80 mt-0.5' }, ev.subtitle) : null,
      ));
    });
    document.body.appendChild(overlay);
  }
})();
