// ============================================================================
// HymnDesk Control · Notifications
// ----------------------------------------------------------------------------
// A header bell showing overdue tasks. Overdue means a task past its target
// date that is not yet complete. Scope follows the person: a member sees their
// own overdue tasks; Admin and the Project Manager see every overdue task in
// the project. Clicking a notification opens that task in the Task Status Board
// (managers) or My Tasks (members).
//
// Notifications are computed live from the task data, so they are always
// accurate and there is nothing to keep in sync. The daily email digest, built
// next, computes the same way on the server.
// ============================================================================

(function () {
  'use strict';
  const M = {}; window.HD_Notifications = M;
  let supabase = null, myUserId = null, myRole = null;
  let overdue = [], open = false;

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
  function fmtDate(d) { return d ? new Date(d).toLocaleDateString('en-ZA', { year:'numeric', month:'short', day:'numeric' }) : ''; }
  function startOfToday() { const d = new Date(); d.setHours(0,0,0,0); return d; }
  function isDone(t) { return t.status === 'Complete' || !!t.done_date; }
  function isOverdue(t) { return t.target_date && !isDone(t) && new Date(t.target_date) < startOfToday(); }
  function daysLate(t) { return Math.floor((startOfToday() - new Date(t.target_date)) / 86400000); }
  function projectId() { return window.HD_Project ? window.HD_Project.getId() : null; }
  function isManager() { return ['Admin','Project Manager'].includes(myRole); }

  const BELL = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>';

  // Mounts the bell into the header. Called once after login.
  M.mount = async function (opts) {
    supabase = opts.supabase;
    const host = document.getElementById('notif-host');
    if (!host) return;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      myUserId = user.id;
      const { data: prof } = await supabase.from('users').select('role:roles(name)').eq('id', user.id).maybeSingle();
      myRole = prof?.role?.name || null;
    } catch (e) { return; }
    await refresh();
  };

  M.refresh = refresh;
  async function refresh() {
    const host = document.getElementById('notif-host');
    if (!host || !supabase) return;
    try {
      const args = { p_phase_id: null, p_owner_id: isManager() ? null : myUserId, p_status: null, p_priority: null, p_project_id: projectId() };
      const { data, error } = await supabase.rpc('list_tasks', args);
      if (error) throw error;
      overdue = (data || []).filter(isOverdue).sort((a,b) => new Date(a.target_date) - new Date(b.target_date));
    } catch (e) { overdue = []; }
    render();
  }

  function render() {
    const host = document.getElementById('notif-host');
    if (!host) return;
    host.innerHTML = '';

    const btn = el('button', { class:'relative focus-ring p-2 rounded-lg hover:bg-stone-100 text-stone-600', 'aria-label':'Notifications',
      onclick: (e) => { e.stopPropagation(); open = !open; render(); } });
    btn.innerHTML = BELL;
    if (overdue.length) {
      btn.appendChild(el('span', { class:'absolute -top-0.5 -right-0.5 bg-red-600 text-white text-[10px] font-bold rounded-full min-w-[16px] h-4 px-1 flex items-center justify-center' },
        overdue.length > 9 ? '9+' : String(overdue.length)));
    }
    host.appendChild(btn);

    if (!open) return;

    const panel = el('div', { class:'absolute right-0 mt-2 w-80 max-w-[92vw] bg-white border border-stone-200 rounded-xl shadow-lg z-50 overflow-hidden' });
    panel.addEventListener('click', (e) => e.stopPropagation());
    panel.appendChild(el('div', { class:'px-4 py-3 border-b border-stone-200 flex items-center justify-between' },
      el('div', { class:'font-semibold text-sm text-stone-900' }, 'Notifications'),
      el('div', { class:'text-xs text-stone-500' }, overdue.length ? `${overdue.length} overdue` : 'All clear')));

    const list = el('div', { class:'max-h-80 overflow-y-auto' });
    if (overdue.length === 0) {
      list.appendChild(el('div', { class:'px-4 py-8 text-center text-sm text-stone-500' }, 'No overdue tasks. Nicely done.'));
    } else {
      overdue.forEach(t => {
        const late = daysLate(t);
        const item = el('button', { class:'w-full text-left px-4 py-3 hover:bg-stone-50 border-b border-stone-100',
          onclick: () => { open = false; goToTask(t); } });
        item.appendChild(el('div', { class:'text-sm text-stone-800 leading-snug' }, t.title));
        const who = isManager() && t.owner_name ? t.owner_name + ' · ' : '';
        item.appendChild(el('div', { class:'text-xs text-red-600 mt-0.5' },
          `${who}Due ${fmtDate(t.target_date)} · ${late} day${late!==1?'s':''} late`));
        list.appendChild(item);
      });
    }
    panel.appendChild(list);

    const wrapRel = el('div', { class:'relative' }, panel);
    host.appendChild(wrapRel);
  }

  function goToTask(t) {
    // Managers land on the board; members on their tasks. Both highlight nothing
    // special yet, but this is where a deep link would go.
    window.location.hash = isManager() ? '#/taskboard' : '#/mytasks';
    render();
  }

  // Close the panel when clicking elsewhere
  document.addEventListener('click', () => { if (open) { open = false; render(); } });
})();
