// ============================================================================
// HymnDesk Control · Module 14 · App Development Roadmap
// ----------------------------------------------------------------------------
// Development tasks grouped by platform (Android, iOS, Web, Backend, etc).
// Tracks target date, status, planned vs actual cost. Admin, Product
// Development Manager, PM.
// ============================================================================

(function () {
  'use strict';
  const M = {}; window.HD_AppDev = M;
  let supabase = null, myRole = null, tasks = [], statuses = [];

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
  function toast(msg, kind='info') {
    const c = { info:'bg-stone-900 text-white', success:'bg-emerald-600 text-white', error:'bg-red-600 text-white' };
    const t = el('div', { class:`fixed bottom-4 left-1/2 -translate-x-1/2 z-50 ${c[kind]} px-4 py-2 rounded-lg shadow-lg text-sm` });
    t.textContent = msg; document.body.appendChild(t); setTimeout(() => t.remove(), 3500);
  }
  function lab(t, ctrl) { return el('div', null, el('label', { class:'block text-sm font-medium text-stone-700 mb-1' }, t), ctrl); }
  function inp() { return 'w-full rounded-lg border border-stone-300 px-3 py-2 text-sm bg-white'; }
  function money(n) { return n == null ? '—' : 'R ' + Number(n).toLocaleString('en-ZA', { minimumFractionDigits:2, maximumFractionDigits:2 }); }
  function fmtDate(d) { return d ? new Date(d).toLocaleDateString('en-ZA', { year:'numeric', month:'short', day:'numeric' }) : '—'; }
  function canEdit() { return ['Admin','Product Development Manager','Project Manager'].includes(myRole); }
  function projectId() { return window.HD_Project ? window.HD_Project.getId() : null; }

  async function loadAll() {
    const { data: { user } } = await supabase.auth.getUser();
    const { data: prof } = await supabase.from('users').select('role:roles(name)').eq('id', user.id).maybeSingle();
    myRole = prof?.role?.name || null;
    const pid = projectId();
    const [tRes, stRes] = await Promise.all([
      supabase.rpc('list_app_dev_tasks', { p_project_id: pid }),
      supabase.from('lookups').select('id, value, sort_order').eq('domain','task_status').eq('is_active',true).order('sort_order'),
    ]);
    if (tRes.error) throw tRes.error;
    tasks = tRes.data || []; statuses = stRes.data || [];
  }

  M.render = function (container, opts) {
    supabase = opts.supabase;
    container.innerHTML = '<div class="text-sm text-stone-500">Loading roadmap...</div>';
    loadAll().then(() => { container.innerHTML = ''; container.appendChild(renderPage()); })
             .catch(err => { container.innerHTML = '';
               container.appendChild(el('div', { class:'bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 text-sm' }, 'Could not load: ' + (err.message || err))); });
  };

  function renderPage() {
    const wrap = el('div', { class:'space-y-6' });
    const plannedTotal = tasks.reduce((s, t) => s + Number(t.cost_planned || 0), 0);
    const actualTotal = tasks.reduce((s, t) => s + Number(t.cost_actual || 0), 0);

    wrap.appendChild(el('div', { class:'flex items-center justify-between gap-3' },
      el('div', null,
        el('h2', { class:'text-xl lg:text-2xl font-bold text-stone-900' }, 'App Development Roadmap'),
        el('p', { class:'text-sm text-stone-500 mt-1' }, `${tasks.length} task${tasks.length === 1 ? '' : 's'}`),
      ),
      canEdit() ? el('button', { class:'inline-flex items-center gap-2 bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium px-4 py-2 rounded-lg',
        onclick: () => openDialog(null) }, '+ Add task') : null,
    ));

    if (tasks.length > 0 && (plannedTotal > 0 || actualTotal > 0)) {
      wrap.appendChild(el('div', { class:'grid grid-cols-2 gap-3' },
        el('div', { class:'border border-stone-200 bg-white rounded-xl p-4' },
          el('div', { class:'text-xs text-stone-500' }, 'Planned cost'),
          el('div', { class:'text-lg font-semibold mt-0.5' }, money(plannedTotal))),
        el('div', { class:'border border-stone-200 bg-white rounded-xl p-4' },
          el('div', { class:'text-xs text-stone-500' }, 'Actual cost'),
          el('div', { class:'text-lg font-semibold mt-0.5' }, money(actualTotal))),
      ));
    }

    if (tasks.length === 0) {
      wrap.appendChild(el('div', { class:'bg-white border border-stone-200 rounded-xl p-8 text-center text-sm text-stone-500' }, 'No development tasks yet.'));
      return wrap;
    }

    // Group by platform
    const byPlatform = {};
    tasks.forEach(t => { (byPlatform[t.platform || 'General'] ||= []).push(t); });
    Object.keys(byPlatform).sort().forEach(plat => {
      const rows = byPlatform[plat];
      const section = el('div', { class:'bg-white border border-stone-200 rounded-xl overflow-hidden' },
        el('div', { class:'px-4 py-3 bg-stone-50 border-b border-stone-200 font-medium text-stone-900' }, plat));
      rows.forEach(t => {
        section.appendChild(el('div', { class:'flex items-center gap-3 px-4 py-3 border-b border-stone-100 last:border-b-0 hover:bg-stone-50 cursor-pointer text-sm', onclick: () => { if (canEdit()) openDialog(t); } },
          el('div', { class:'flex-1 min-w-0' },
            el('div', { class:'text-stone-900' }, t.task),
            el('div', { class:'text-xs text-stone-500 mt-0.5' },
              [t.target_date ? 'Target ' + fmtDate(t.target_date) : null,
               (t.cost_actual != null || t.cost_planned != null) ? money(t.cost_actual ?? t.cost_planned) : null].filter(Boolean).join(' · ')),
          ),
          statusPill(t.status),
        ));
      });
      wrap.appendChild(section);
    });
    return wrap;
  }

  function statusPill(s) {
    const map = { 'Complete':'text-emerald-700 bg-emerald-50 border-emerald-200', 'In Progress':'text-blue-700 bg-blue-50 border-blue-200',
                  'Blocked':'text-red-700 bg-red-50 border-red-200', 'Not Started':'text-stone-600 bg-stone-100 border-stone-200' };
    return el('span', { class:`inline-flex items-center text-xs font-medium border rounded-full px-2 py-0.5 ${map[s] || 'text-stone-600 bg-stone-100 border-stone-200'}` }, s || '—');
  }

  function openDialog(existing) {
    const isEdit = !!existing;
    const overlay = el('div', { class:'fixed inset-0 z-40 bg-stone-900/50 flex items-end sm:items-center justify-center p-0 sm:p-4' });
    const dialog  = el('div', { class:'bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl shadow-xl max-h-[95vh] flex flex-col' });
    overlay.appendChild(dialog);
    dialog.appendChild(el('div', { class:'px-5 py-4 border-b border-stone-200' }, el('h3', { class:'text-base font-semibold' }, isEdit ? 'Edit task' : 'New task')));
    const body = el('div', { class:'flex-1 overflow-y-auto p-5 space-y-3' });
    const fPlatform = el('input', { type:'text', required:'', class:inp(), value: existing?.platform || '', placeholder:'e.g. Android, iOS, Web, Backend' });
    const fTask = el('input', { type:'text', required:'', class:inp(), value: existing?.task || '' });
    const fDate = el('input', { type:'date', class:inp(), value: existing?.target_date || '' });
    const fStatus = el('select', { class:inp() }, el('option', { value:'' }, '—'),
      ...statuses.map(s => el('option', { value:s.id, selected: s.id === existing?.status_lookup_id ? '' : null }, s.value)));
    const fPlanned = el('input', { type:'number', step:'0.01', class:inp(), value: existing?.cost_planned ?? '' });
    const fActual = el('input', { type:'number', step:'0.01', class:inp(), value: existing?.cost_actual ?? '' });
    const fNotes = el('textarea', { rows:'2', class:inp() }, existing?.notes || '');
    const errBox = el('div', { class:'text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3', hidden:'' });
    body.append(
      el('div', { class:'grid grid-cols-2 gap-3' }, lab('Platform', fPlatform), lab('Target date', fDate)),
      lab('Task', fTask),
      el('div', { class:'grid grid-cols-2 gap-3' }, lab('Planned cost (R)', fPlanned), lab('Actual cost (R)', fActual)),
      lab('Status', fStatus), lab('Notes', fNotes), errBox);
    dialog.appendChild(body);

    const submitBtn = el('button', { class:'px-4 py-2 text-sm rounded-lg bg-brand-500 hover:bg-brand-600 text-white font-medium' }, isEdit ? 'Save' : 'Create');
    submitBtn.addEventListener('click', async () => {
      errBox.hidden = true;
      if (!fPlatform.value.trim() || !fTask.value.trim()) { errBox.textContent = 'Platform and task are required'; errBox.hidden = false; return; }
      submitBtn.disabled = true; submitBtn.textContent = 'Saving...';
      try {
        const { error } = await supabase.rpc('upsert_app_dev_task', {
          p_id: existing?.id || null, p_platform: fPlatform.value.trim(), p_task: fTask.value.trim(),
          p_target_date: fDate.value || null, p_status_lookup_id: fStatus.value || null,
          p_cost_planned: fPlanned.value === '' ? null : Number(fPlanned.value),
          p_cost_actual: fActual.value === '' ? null : Number(fActual.value),
          p_notes: fNotes.value.trim() || null, p_sort_order: existing?.sort_order ?? 0, p_project_id: projectId(),
        });
        if (error) throw error;
        toast(isEdit ? 'Saved' : 'Added', 'success'); overlay.remove(); reload();
      } catch (err) { errBox.textContent = err.message || 'Could not save'; errBox.hidden = false;
        submitBtn.disabled = false; submitBtn.textContent = isEdit ? 'Save' : 'Create'; }
    });
    dialog.appendChild(el('div', { class:'px-5 py-4 border-t border-stone-200 flex items-center justify-between' },
      (canEdit() && isEdit) ? el('button', { class:'text-sm text-red-600 hover:text-red-700', onclick: async () => {
        if (!confirm('Delete this task?')) return;
        try { const { error } = await supabase.rpc('delete_app_dev_task', { p_id: existing.id });
          if (error) throw error; overlay.remove(); toast('Deleted', 'success'); reload();
        } catch (err) { toast(err.message || 'Could not delete', 'error'); } }}, 'Delete') : el('span'),
      el('div', { class:'flex items-center gap-2' },
        el('button', { class:'px-4 py-2 text-sm rounded-lg hover:bg-stone-100', onclick: () => overlay.remove() }, 'Cancel'), submitBtn)));
    document.body.appendChild(overlay); fPlatform.focus();
  }

  async function reload() {
    const main = document.getElementById('page-content'); if (!main) return;
    main.innerHTML = '<div class="text-sm text-stone-500">Loading roadmap...</div>';
    try { await loadAll(); main.innerHTML = ''; main.appendChild(renderPage()); }
    catch (err) { main.innerHTML = ''; main.appendChild(el('div', { class:'bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 text-sm' }, 'Could not load: ' + (err.message || err))); }
  }
})();
