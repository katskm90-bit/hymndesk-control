// ============================================================================
// HymnDesk Control · My Tasks
// ----------------------------------------------------------------------------
// Each member sees the tasks assigned to them in the active project. Incomplete
// tasks are shown first. A member can move a task through its statuses, mark it
// blocked, set a done date, and add notes. Structural details (title, deadline,
// priority) are set by the Project Manager and shown read only here.
// ============================================================================

(function () {
  'use strict';
  const M = {}; window.HD_MyTasks = M;
  let supabase = null, myUserId = null, tasks = [], statuses = [];

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
    const t = el('div', { class:`fixed bottom-4 left-1/2 -translate-x-1/2 z-50 ${c[kind]} px-4 py-2 rounded-lg shadow-lg text-sm` });
    t.textContent = msg; document.body.appendChild(t); setTimeout(() => t.remove(), 3500);
  }
  function lab(t, ctrl) { return el('div', null, el('label', { class:'block text-sm font-medium text-stone-700 mb-1' }, t), ctrl); }
  function fmtDate(d) { return d ? new Date(d).toLocaleDateString('en-ZA', { year:'numeric', month:'short', day:'numeric' }) : null; }
  function projectId() { return window.HD_Project ? window.HD_Project.getId() : null; }
  function isDone(t) { return t.status === 'Complete' || t.status === 'Done' || !!t.done_date; }
  function isOverdue(t) { return t.target_date && !isDone(t) && new Date(t.target_date) < startOfToday(); }
  function startOfToday() { const d = new Date(); d.setHours(0,0,0,0); return d; }

  let pendingContracts = [];
  let pendingInvites = 0;
  async function loadAll() {
    const { data: { user } } = await supabase.auth.getUser();
    myUserId = user.id;
    const pid = projectId();
    const [tRes, stRes, cRes, invRes] = await Promise.all([
      supabase.rpc('list_tasks', { p_phase_id: null, p_owner_id: myUserId, p_status: null, p_priority: null, p_project_id: pid }),
      supabase.from('lookups').select('id, value, sort_order').eq('domain','task_status').eq('is_active',true).order('sort_order'),
      supabase.rpc('list_contracts', { p_project_id: pid }),
      supabase.rpc('my_pending_invitations'),
    ]);
    if (tRes.error) throw tRes.error;
    tasks = tRes.data || [];
    statuses = stRes.data || [];
    // Contracts awaiting my signature
    pendingContracts = cRes.error ? [] : (cRes.data || []).filter(c => c.user_id === myUserId && c.status !== 'Signed');
    pendingInvites = invRes.error ? 0 : (invRes.data || 0);
  }

  M.render = function (container, opts) {
    supabase = opts.supabase;
    container.innerHTML = '<div class="text-sm text-stone-500">Loading your tasks...</div>';
    loadAll().then(() => { container.innerHTML = ''; container.appendChild(renderPage()); })
             .catch(err => { container.innerHTML = '';
               container.appendChild(el('div', { class:'bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 text-sm' }, 'Could not load: ' + (err.message || err))); });
  };

  function renderPage() {
    const wrap = el('div', { class:'space-y-6' });
    const incomplete = tasks.filter(t => !isDone(t));
    const done = tasks.filter(t => isDone(t));
    const overdue = incomplete.filter(isOverdue);

    wrap.appendChild(el('div', null,
      el('h2', { class:'text-xl lg:text-2xl font-bold text-stone-900' }, 'My Tasks'),
      el('p', { class:'text-sm text-stone-500 mt-1' }, `${incomplete.length} to do · ${done.length} complete`),
    ));

    // Contract awaiting signature prompt
    if (pendingContracts.length > 0) {
      wrap.appendChild(el('div', { class:'bg-brand-50 border-2 border-brand-200 rounded-xl p-4 flex items-center justify-between gap-3' },
        el('div', null,
          el('div', { class:'font-semibold text-stone-900' }, pendingContracts.length === 1 ? 'Sign your contract' : `Sign your contracts (${pendingContracts.length})`),
          el('div', { class:'text-xs text-stone-600 mt-0.5' }, 'You have a contract waiting for your signature.')),
        el('button', { class:'bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium px-4 py-2 rounded-lg shrink-0',
          onclick: () => { window.location.hash = '#/contracts'; } }, 'Go to contract')));
    }

    // Invitation RSVP prompt
    if (pendingInvites > 0) {
      wrap.appendChild(el('div', { class:'bg-brand-50 border-2 border-brand-200 rounded-xl p-4 flex items-center justify-between gap-3' },
        el('div', null,
          el('div', { class:'font-semibold text-stone-900' }, pendingInvites === 1 ? 'Respond to your invitation' : `Respond to your invitations (${pendingInvites})`),
          el('div', { class:'text-xs text-stone-600 mt-0.5' }, 'You have a meeting invitation waiting for your response.')),
        el('button', { class:'bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium px-4 py-2 rounded-lg shrink-0',
          onclick: () => { window.location.hash = '#/invitations'; } }, 'Go to invitation')));
    }

    if (tasks.length === 0) {
      wrap.appendChild(el('div', { class:'bg-white border border-stone-200 rounded-xl p-8 text-center text-sm text-stone-500' },
        (pendingContracts.length > 0 || pendingInvites > 0) ? 'You have no other tasks assigned to you yet.' : 'You have no tasks assigned to you in this project yet.'));
      return wrap;
    }

    if (overdue.length > 0) {
      wrap.appendChild(el('div', { class:'bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-sm' },
        `${overdue.length} of your tasks ${overdue.length === 1 ? 'is' : 'are'} past the deadline.`));
    }

    // Incomplete first
    if (incomplete.length > 0) {
      wrap.appendChild(el('h3', { class:'text-sm font-semibold text-stone-500 uppercase tracking-wide' }, 'To do'));
      const list = el('div', { class:'space-y-2' });
      incomplete.forEach(t => list.appendChild(taskCard(t)));
      wrap.appendChild(list);
    }

    if (done.length > 0) {
      wrap.appendChild(el('h3', { class:'text-sm font-semibold text-stone-500 uppercase tracking-wide mt-4' }, 'Complete'));
      const list = el('div', { class:'space-y-2' });
      done.forEach(t => list.appendChild(taskCard(t)));
      wrap.appendChild(list);
    }

    return wrap;
  }

  function taskCard(t) {
    const overdue = isOverdue(t);
    const done = isDone(t);
    const dateStr = fmtDate(t.target_date);
    return el('div', { class:`bg-white border rounded-xl p-4 cursor-pointer hover:border-brand-300 ${overdue ? 'border-red-200' : 'border-stone-200'}`,
      onclick: () => openTaskDialog(t) },
      el('div', { class:'flex items-start justify-between gap-3' },
        el('div', { class:'min-w-0 flex-1' },
          el('div', { class:`font-medium ${done ? 'text-stone-400 line-through' : 'text-stone-900'}` }, t.title),
          t.description ? el('div', { class:'text-sm text-stone-600 mt-0.5' }, t.description) : null,
          el('div', { class:'flex flex-wrap items-center gap-2 mt-2 text-xs' },
            t.priority ? chip(t.priority, prioTone(t.priority)) : null,
            t.phase_name ? chip(t.phase_name) : null,
            t.is_blocked ? chip('Blocked', 'red') : null,
            dateStr ? chip((overdue ? 'Overdue: ' : 'Due ') + dateStr, overdue ? 'red' : 'stone') : null,
          ),
        ),
        statusPill(t.status),
      ),
    );
  }

  function chip(text, tone) {
    const tones = { red:'text-red-700 bg-red-50 border-red-200', amber:'text-amber-700 bg-amber-50 border-amber-200', stone:'text-stone-600 bg-stone-100 border-stone-200' };
    return el('span', { class:`inline-flex items-center text-xs border rounded-full px-2 py-0.5 ${tones[tone] || tones.stone}` }, text);
  }
  function prioTone(p) { return ({ Critical:'red', High:'amber' })[p] || 'stone'; }
  function statusPill(s) {
    const map = { 'Complete':'text-emerald-700 bg-emerald-50 border-emerald-200', 'Done':'text-emerald-700 bg-emerald-50 border-emerald-200',
                  'In Progress':'text-blue-700 bg-blue-50 border-blue-200', 'Blocked':'text-red-700 bg-red-50 border-red-200',
                  'Not Started':'text-stone-600 bg-stone-100 border-stone-200' };
    return el('span', { class:`inline-flex items-center text-xs font-medium border rounded-full px-2 py-0.5 shrink-0 ${map[s] || 'text-stone-600 bg-stone-100 border-stone-200'}` }, s || '—');
  }

  function openTaskDialog(t) {
    const overlay = el('div', { class:'fixed inset-0 z-40 bg-stone-900/50 flex items-end sm:items-center justify-center p-0 sm:p-4' });
    const dialog  = el('div', { class:'bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl shadow-xl max-h-[95vh] flex flex-col' });
    overlay.appendChild(dialog);
    dialog.appendChild(el('div', { class:'px-5 py-4 border-b border-stone-200' },
      el('h3', { class:'text-base font-semibold' }, 'Update task')));

    const body = el('div', { class:'flex-1 overflow-y-auto p-5 space-y-3' });

    // Read-only summary set by the PM
    body.appendChild(el('div', { class:'rounded-lg border border-stone-200 bg-stone-50 p-3 space-y-1' },
      el('div', { class:'font-medium text-stone-900' }, t.title),
      t.description ? el('div', { class:'text-sm text-stone-600' }, t.description) : null,
      el('div', { class:'text-xs text-stone-500' },
        [t.priority ? 'Priority: ' + t.priority : null, t.phase_name, t.target_date ? 'Due ' + fmtDate(t.target_date) : null].filter(Boolean).join(' · ')),
    ));

    const fSta = el('select', { class:'w-full rounded-lg border border-stone-300 px-3 py-2 text-sm bg-white' },
      ...statuses.map(s => el('option', { value:s.id, selected: s.id === t.status_lookup_id ? '' : null }, s.value)));
    const fBlk = el('input', { type:'checkbox', class:'rounded', checked: t.is_blocked ? '' : null });
    const fDone = el('input', { type:'date', class:'w-full rounded-lg border border-stone-300 px-3 py-2 text-sm', value: t.done_date || '' });
    const fNotes = el('textarea', { rows:'3', class:'w-full rounded-lg border border-stone-300 px-3 py-2 text-sm' }, t.notes || '');
    const errBox = el('div', { class:'text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3', hidden:'' });

    body.append(
      lab('Status', fSta),
      el('label', { class:'flex items-center gap-2 text-sm text-stone-700' }, fBlk, 'I am blocked on this task'),
      lab('Done date (when complete)', fDone),
      lab('Notes', fNotes),
      errBox,
    );
    dialog.appendChild(body);

    const submitBtn = el('button', { class:'px-4 py-2 text-sm rounded-lg bg-brand-500 hover:bg-brand-600 text-white font-medium' }, 'Save');
    submitBtn.addEventListener('click', async () => {
      errBox.hidden = true;
      submitBtn.disabled = true; submitBtn.textContent = 'Saving...';
      try {
        // Send back the existing structural values unchanged; only progress fields differ.
        const { error } = await supabase.rpc('upsert_task', {
          p_id: t.id,
          p_title: t.title,
          p_description: t.description || null,
          p_category_lookup_id: t.category_lookup_id || null,
          p_priority_lookup_id: t.priority_lookup_id || null,
          p_status_lookup_id:   fSta.value || null,
          p_owner_user_id:      t.owner_user_id || null,
          p_phase_id:           t.phase_id || null,
          p_target_date:        t.target_date || null,
          p_done_date:          fDone.value || null,
          p_notes:              fNotes.value.trim() || null,
          p_is_critical:        !!t.is_critical,
          p_is_blocked:         !!fBlk.checked,
          p_project_id:         projectId(),
        });
        if (error) throw error;
        toast('Task updated', 'success');
        overlay.remove(); reload();
      } catch (err) { errBox.textContent = err.message || 'Could not save'; errBox.hidden = false;
        submitBtn.disabled = false; submitBtn.textContent = 'Save'; }
    });

    dialog.appendChild(el('div', { class:'px-5 py-4 border-t border-stone-200 flex items-center justify-end gap-2' },
      el('button', { class:'px-4 py-2 text-sm rounded-lg hover:bg-stone-100', onclick: () => overlay.remove() }, 'Cancel'),
      submitBtn,
    ));
    document.body.appendChild(overlay);
  }

  async function reload() {
    const main = document.getElementById('page-content'); if (!main) return;
    main.innerHTML = '<div class="text-sm text-stone-500">Loading your tasks...</div>';
    try { await loadAll(); main.innerHTML = ''; main.appendChild(renderPage()); }
    catch (err) { main.innerHTML = ''; main.appendChild(el('div', { class:'bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 text-sm' }, 'Could not load: ' + (err.message || err))); }
  }
})();
