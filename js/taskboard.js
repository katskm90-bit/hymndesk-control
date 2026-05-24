// ============================================================================
// HymnDesk Control · Task Status Board
// ----------------------------------------------------------------------------
// An oversight view for Admin and the Project Manager. Every task in the
// project, grouped by phase on the outside, then by status within each phase.
// Each phase shows a progress bar of how many of its tasks are complete. Any
// task past its target date that is not complete is flagged as behind schedule.
// Clicking a task opens its detail.
// ============================================================================

(function () {
  'use strict';
  const M = {}; window.HD_TaskBoard = M;
  let supabase = null, tasks = [], phases = [];

  const STATUSES = ['Not Started', 'In Progress', 'Blocked', 'Complete'];
  const STATUS_STYLE = {
    'Not Started': 'text-stone-600 bg-stone-100',
    'In Progress': 'text-blue-700 bg-blue-50',
    'Blocked':     'text-red-700 bg-red-50',
    'Complete':    'text-emerald-700 bg-emerald-50',
  };

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
  function fmtDate(d) { return d ? new Date(d).toLocaleDateString('en-ZA', { year:'numeric', month:'short', day:'numeric' }) : null; }
  function startOfToday() { const d = new Date(); d.setHours(0,0,0,0); return d; }
  function isDone(t) { return t.status === 'Complete' || !!t.done_date; }
  function isOverdue(t) { return t.target_date && !isDone(t) && new Date(t.target_date) < startOfToday(); }
  function projectId() { return window.HD_Project ? window.HD_Project.getId() : null; }
  function statusOf(t) { return STATUSES.includes(t.status) ? t.status : (isDone(t) ? 'Complete' : 'Not Started'); }

  async function loadAll() {
    const pid = projectId();
    const [tRes, phRes] = await Promise.all([
      supabase.rpc('list_tasks', { p_phase_id: null, p_owner_id: null, p_status: null, p_priority: null, p_project_id: pid }),
      supabase.rpc('list_phases', { p_project_id: pid }),
    ]);
    if (tRes.error) throw tRes.error;
    tasks = tRes.data || [];
    phases = phRes.error ? [] : (phRes.data || []);
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

  function renderPage() {
    const wrap = el('div', { class:'space-y-6' });

    const totalTasks = tasks.length;
    const doneTasks = tasks.filter(isDone).length;
    const overdueTasks = tasks.filter(isOverdue).length;

    wrap.appendChild(el('div', null,
      el('h2', { class:'text-xl lg:text-2xl font-bold text-stone-900' }, 'Task Status Board'),
      el('p', { class:'text-sm text-stone-500 mt-1' },
        `${totalTasks} task${totalTasks!==1?'s':''} across ${phases.length} phase${phases.length!==1?'s':''}` +
        (overdueTasks ? ` · ${overdueTasks} behind schedule` : '')),
    ));

    if (totalTasks === 0) {
      wrap.appendChild(el('div', { class:'bg-white border border-stone-200 rounded-xl p-8 text-center text-sm text-stone-500' },
        'No tasks in this project yet.'));
      return wrap;
    }

    // Order phases by their natural order, then an "Unassigned phase" bucket last
    const phaseOrder = phases.slice().sort((a,b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
    const seen = new Set();

    phaseOrder.forEach(ph => { seen.add(ph.id); wrap.appendChild(renderPhase(ph.name, tasks.filter(t => t.phase_id === ph.id))); });

    // Any tasks with no phase, or a phase not in the list
    const orphan = tasks.filter(t => !t.phase_id || !seen.has(t.phase_id));
    if (orphan.length) wrap.appendChild(renderPhase('No phase assigned', orphan));

    return wrap;
  }

  function renderPhase(phaseName, phaseTasks) {
    const total = phaseTasks.length;
    const done = phaseTasks.filter(isDone).length;
    const overdue = phaseTasks.filter(isOverdue).length;
    const pct = total ? Math.round((done / total) * 100) : 0;

    const section = el('div', { class:'bg-white border border-stone-200 rounded-xl p-5 space-y-4' });

    // Phase header with progress bar
    section.appendChild(el('div', null,
      el('div', { class:'flex items-center justify-between gap-3' },
        el('div', { class:'font-semibold text-stone-900' }, phaseName),
        el('div', { class:'text-xs text-stone-500' }, `${done} of ${total} complete` + (overdue ? ` · ${overdue} behind` : ''))),
      el('div', { class:'mt-2 h-2 w-full bg-stone-100 rounded-full overflow-hidden' },
        el('div', { class:'h-full bg-emerald-500 rounded-full', style:`width:${pct}%` })),
    ));

    if (total === 0) { section.appendChild(el('div', { class:'text-xs text-stone-400' }, 'No tasks in this phase.')); return section; }

    // Status columns within the phase
    const cols = el('div', { class:'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3' });
    STATUSES.forEach(st => {
      const inSt = phaseTasks.filter(t => statusOf(t) === st);
      const col = el('div', { class:'bg-stone-50 border border-stone-200 rounded-lg p-3 space-y-2' });
      col.appendChild(el('div', { class:'flex items-center justify-between' },
        el('span', { class:`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_STYLE[st]}` }, st),
        el('span', { class:'text-xs text-stone-400' }, String(inSt.length))));
      if (inSt.length === 0) col.appendChild(el('div', { class:'text-xs text-stone-300' }, '—'));
      else inSt.forEach(t => col.appendChild(taskChip(t)));
      cols.appendChild(col);
    });
    section.appendChild(cols);
    return section;
  }

  function taskChip(t) {
    const overdue = isOverdue(t);
    const chip = el('button', {
      class:`w-full text-left bg-white border rounded-lg px-3 py-2 hover:border-brand-300 transition ${overdue ? 'border-red-300' : 'border-stone-200'}`,
      onclick: () => openTask(t),
    });
    chip.appendChild(el('div', { class:'text-sm text-stone-800 leading-snug' }, t.title));
    const meta = [];
    if (t.owner_name) meta.push(t.owner_name);
    if (t.target_date) meta.push('Due ' + fmtDate(t.target_date));
    chip.appendChild(el('div', { class:`text-xs mt-0.5 ${overdue ? 'text-red-600 font-medium' : 'text-stone-500'}` },
      (overdue ? 'Behind schedule · ' : '') + meta.join(' · ')));
    return chip;
  }

  function openTask(t) {
    const overlay = el('div', { class:'fixed inset-0 z-50 bg-stone-900/50 flex items-end sm:items-center justify-center p-0 sm:p-4' });
    const dialog  = el('div', { class:'bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl shadow-xl max-h-[90vh] flex flex-col' });
    overlay.appendChild(dialog);
    dialog.appendChild(el('div', { class:'px-5 py-4 border-b border-stone-200 flex items-center justify-between' },
      el('h3', { class:'text-base font-semibold pr-6' }, t.title),
      el('button', { class:'text-stone-400 hover:text-stone-600 text-xl leading-none', onclick:()=>overlay.remove() }, '×')));

    const body = el('div', { class:'flex-1 overflow-y-auto p-5 space-y-3 text-sm' });
    const rows = [
      ['Status', statusOf(t)],
      ['Phase', t.phase_name || 'No phase assigned'],
      ['Responsible', t.owner_name || 'Unassigned'],
      ['Priority', t.priority || '—'],
      ['Target date', fmtDate(t.target_date) || '—'],
      ['Completed', fmtDate(t.done_date) || '—'],
    ];
    rows.forEach(([k,v]) => body.appendChild(el('div', { class:'flex justify-between gap-3 border-b border-stone-100 py-1.5' },
      el('span', { class:'text-stone-500' }, k), el('span', { class:'text-stone-800 text-right' }, v))));
    if (isOverdue(t)) body.appendChild(el('div', { class:'bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-xs' }, 'This task is past its target date and is not yet complete.'));
    if (t.is_blocked) body.appendChild(el('div', { class:'bg-amber-50 border border-amber-200 text-amber-800 rounded-lg p-3 text-xs' }, 'This task is marked as blocked.'));
    if (t.description) body.appendChild(el('div', null, el('div', { class:'text-stone-500 mb-1' }, 'Description'), el('div', { class:'text-stone-800' }, t.description)));
    if (t.notes) body.appendChild(el('div', null, el('div', { class:'text-stone-500 mb-1' }, 'Notes'), el('div', { class:'text-stone-800' }, t.notes)));
    dialog.appendChild(body);

    dialog.appendChild(el('div', { class:'px-5 py-4 border-t border-stone-200 flex justify-end' },
      el('button', { class:'text-sm border border-stone-300 hover:bg-stone-50 px-4 py-2 rounded-lg', onclick:()=>overlay.remove() }, 'Close')));
    document.body.appendChild(overlay);
  }
})();
