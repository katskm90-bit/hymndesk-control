// ============================================================================
// HymnDesk Control · Module 3 · Master Task Tracker
// ----------------------------------------------------------------------------
// 53 master tasks across project phases. Filter by phase, owner, status,
// priority. Bulk status updates for PM and Admin. Task owners can update their
// own row. Admin and PM can create and delete.
// ============================================================================

(function () {
  'use strict';

  const M = {};
  window.HD_Tasks = M;

  let supabase = null;
  let tasks = [];
  let members = [];
  let phases  = [];
  let categories = [];
  let priorities = [];
  let statuses   = [];
  let myRole = null;
  let myUserId = null;

  let filterPhase = '';
  let filterOwner = '';
  let filterStatus = '';
  let filterPriority = '';
  let filterText = '';
  const selectedIds = new Set();

  // ----- DOM helpers ------------------------------------------------------
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
  const esc = (s) => String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  function toast(msg, kind = 'info') {
    const c = { info: 'bg-stone-900 text-white', success: 'bg-emerald-600 text-white', error: 'bg-red-600 text-white' };
    const t = el('div', { class: `fixed bottom-4 left-1/2 -translate-x-1/2 z-50 ${c[kind]} px-4 py-2 rounded-lg shadow-lg text-sm` });
    t.textContent = msg; document.body.appendChild(t); setTimeout(() => t.remove(), 3500);
  }
  function canManage() { return myRole === 'Admin' || myRole === 'Project Manager'; }
  function canEditTask(t) { return canManage() || t.owner_user_id === myUserId; }
  function fmtDate(d) { return d ? new Date(d).toLocaleDateString('en-ZA', { year: 'numeric', month: 'short', day: 'numeric' }) : '—'; }

  // ----- Data load --------------------------------------------------------
  async function loadAll() {
    const { data: { user } } = await supabase.auth.getUser();
    myUserId = user.id;
    const { data: prof } = await supabase.from('users').select('role:roles(name)').eq('id', user.id).maybeSingle();
    myRole = prof?.role?.name || null;

    const projectId = window.HD_Project ? window.HD_Project.getId() : null;
    const [tRes, mRes, phRes, catRes, prRes, stRes] = await Promise.all([
      supabase.rpc('list_tasks', {
        p_phase_id: filterPhase || null, p_owner_id: filterOwner || null,
        p_status: filterStatus || null, p_priority: filterPriority || null,
        p_project_id: projectId,
      }),
      supabase.from('users').select('id, full_name').eq('is_active', true).order('full_name'),
      supabase.rpc('list_phases', { p_project_id: projectId }),
      supabase.from('lookups').select('id, value, sort_order').eq('domain','task_category').eq('is_active',true).order('sort_order'),
      supabase.from('lookups').select('id, value, sort_order').eq('domain','task_priority').eq('is_active',true).order('sort_order'),
      supabase.from('lookups').select('id, value, sort_order').eq('domain','task_status').eq('is_active',true).order('sort_order'),
    ]);
    if (tRes.error) throw tRes.error;
    tasks = tRes.data || [];
    members    = mRes.data || [];
    phases     = phRes.data || [];
    categories = catRes.data || [];
    priorities = prRes.data || [];
    statuses   = stRes.data || [];
  }

  // ----- Render -----------------------------------------------------------
  M.render = function (container, opts) {
    supabase = opts.supabase;
    container.innerHTML = '<div class="text-sm text-stone-500">Loading tasks...</div>';
    loadAll().then(() => { container.innerHTML = ''; container.appendChild(renderPage()); })
             .catch(err => {
               container.innerHTML = '';
               container.appendChild(el('div', { class: 'bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 text-sm' }, 'Could not load: ' + (err.message || err)));
             });
  };

  function renderPage() {
    selectedIds.clear();
    const wrap = el('div', { class: 'space-y-6' });

    // header
    wrap.appendChild(el('div', { class: 'flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3' },
      el('div', null,
        el('h2', { class: 'text-xl lg:text-2xl font-bold text-stone-900' }, 'Master Task Tracker'),
        el('p', { class: 'text-sm text-stone-500 mt-1' }, `${tasks.length} task${tasks.length === 1 ? '' : 's'}`),
      ),
      canManage() ? el('button', {
        class: 'inline-flex items-center gap-2 bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium px-4 py-2 rounded-lg',
        onclick: () => openDialog(null),
      }, '+ Add task') : null,
    ));

    // Filters
    const filters = el('div', { class: 'bg-white border border-stone-200 rounded-xl p-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2' });
    const search = el('input', { type: 'search', placeholder: 'Search title or notes', value: filterText,
      class: 'rounded-lg border border-stone-300 px-3 py-2 text-sm' });
    search.addEventListener('input', (e) => { filterText = e.target.value; renderTable(tableHost); });

    const phaseSel = el('select', { class: 'rounded-lg border border-stone-300 px-3 py-2 text-sm bg-white' },
      el('option', { value: '' }, 'All phases'),
      ...phases.map(p => el('option', { value: p.id, selected: p.id === filterPhase ? '' : null }, `Phase ${p.sort_order}: ${p.name}`)),
    );
    phaseSel.addEventListener('change', (e) => { filterPhase = e.target.value; reload(); });

    const ownerSel = el('select', { class: 'rounded-lg border border-stone-300 px-3 py-2 text-sm bg-white' },
      el('option', { value: '' }, 'All owners'),
      el('option', { value: myUserId, selected: filterOwner === myUserId ? '' : null }, 'Assigned to me'),
      ...members.map(m => el('option', { value: m.id, selected: m.id === filterOwner ? '' : null }, m.full_name)),
    );
    ownerSel.addEventListener('change', (e) => { filterOwner = e.target.value; reload(); });

    const statusSel = el('select', { class: 'rounded-lg border border-stone-300 px-3 py-2 text-sm bg-white' },
      el('option', { value: '' }, 'All statuses'),
      ...statuses.map(s => el('option', { value: s.value, selected: s.value === filterStatus ? '' : null }, s.value)),
    );
    statusSel.addEventListener('change', (e) => { filterStatus = e.target.value; reload(); });

    const priSel = el('select', { class: 'rounded-lg border border-stone-300 px-3 py-2 text-sm bg-white' },
      el('option', { value: '' }, 'All priorities'),
      ...priorities.map(p => el('option', { value: p.value, selected: p.value === filterPriority ? '' : null }, p.value)),
    );
    priSel.addEventListener('change', (e) => { filterPriority = e.target.value; reload(); });

    filters.append(search, phaseSel, ownerSel, statusSel, priSel);
    wrap.appendChild(filters);

    // Bulk action bar (only when selection exists and user can manage)
    const bulkBar = el('div', { class: 'hidden bg-brand-50 border border-brand-200 rounded-lg px-3 py-2 flex-wrap items-center gap-2 text-sm', id: 'bulk-bar' });
    wrap.appendChild(bulkBar);

    const tableHost = el('div');
    wrap.appendChild(tableHost);
    renderTable(tableHost);

    return wrap;
  }

  function filteredTasks() {
    const q = filterText.trim().toLowerCase();
    if (!q) return tasks;
    return tasks.filter(t =>
      (t.title || '').toLowerCase().includes(q) ||
      (t.notes || '').toLowerCase().includes(q) ||
      (t.description || '').toLowerCase().includes(q));
  }

  function renderTable(host) {
    host.innerHTML = '';
    const list = filteredTasks();
    if (list.length === 0) {
      host.appendChild(el('div', { class: 'bg-white border border-stone-200 rounded-xl p-8 text-center text-sm text-stone-500' },
        tasks.length === 0 ? 'No tasks yet. Click "Add task" to create the first one.' : 'No tasks match the current filters.'));
      return;
    }

    // Desktop table
    const table = el('div', { class: 'hidden md:block bg-white border border-stone-200 rounded-xl overflow-hidden' });
    const thead = el('div', { class: 'grid grid-cols-12 gap-2 px-4 py-3 bg-stone-50 border-b border-stone-200 text-xs font-medium text-stone-500 uppercase tracking-wide items-center' });
    if (canManage()) {
      const checkAll = el('input', { type: 'checkbox', class: 'rounded' });
      checkAll.addEventListener('change', (e) => {
        if (e.target.checked) list.forEach(t => selectedIds.add(t.id));
        else selectedIds.clear();
        renderTable(host);
      });
      thead.appendChild(el('div', { class: 'col-span-1' }, checkAll));
    } else thead.appendChild(el('div', { class: 'col-span-1' }));
    thead.append(
      el('div', { class: 'col-span-4' }, 'Task'),
      el('div', { class: 'col-span-2' }, 'Owner'),
      el('div', { class: 'col-span-2' }, 'Phase'),
      el('div', { class: 'col-span-1' }, 'Priority'),
      el('div', { class: 'col-span-2' }, 'Status'),
    );
    table.appendChild(thead);

    list.forEach(t => {
      const checked = selectedIds.has(t.id);
      const cb = canManage() ? el('input', { type: 'checkbox', class: 'rounded', checked: checked ? '' : null }) : null;
      if (cb) cb.addEventListener('change', () => { if (cb.checked) selectedIds.add(t.id); else selectedIds.delete(t.id); refreshBulkBar(); });

      const row = el('div', {
        class: 'grid grid-cols-12 gap-2 px-4 py-3 border-b border-stone-100 last:border-b-0 hover:bg-stone-50 text-sm items-center cursor-pointer',
        onclick: (e) => { if (e.target.tagName === 'INPUT') return; if (canEditTask(t)) openDialog(t); }
      },
        el('div', { class: 'col-span-1' }, cb || ''),
        el('div', { class: 'col-span-4 min-w-0' },
          el('div', { class: 'font-medium text-stone-900 truncate flex items-center gap-2' },
            t.is_critical ? el('span', { class: 'inline-block w-1.5 h-1.5 rounded-full bg-red-500', title: 'Critical' }) : null,
            t.is_blocked ? el('span', { class: 'text-xs text-red-700 bg-red-50 border border-red-200 rounded px-1.5 py-0.5' }, 'Blocked') : null,
            document.createTextNode(t.title),
          ),
          t.category ? el('div', { class: 'text-xs text-stone-500 mt-0.5' }, t.category) : null,
          t.target_date ? el('div', { class: 'text-xs text-stone-500 mt-0.5' }, 'Due ' + fmtDate(t.target_date)) : null,
        ),
        el('div', { class: 'col-span-2 text-stone-700 truncate' }, t.owner_name || '—'),
        el('div', { class: 'col-span-2 text-stone-600 truncate' }, t.phase_name || '—'),
        el('div', { class: 'col-span-1' }, priorityPill(t.priority)),
        el('div', { class: 'col-span-2' }, statusPill(t.status)),
      );
      table.appendChild(row);
    });
    host.appendChild(table);

    // Mobile cards
    const cards = el('div', { class: 'md:hidden space-y-3' });
    list.forEach(t => {
      cards.appendChild(el('div', {
        class: 'bg-white border border-stone-200 rounded-xl p-4',
        onclick: () => { if (canEditTask(t)) openDialog(t); },
      },
        el('div', { class: 'flex items-start justify-between gap-2' },
          el('div', { class: 'min-w-0 flex-1' },
            el('div', { class: 'font-medium text-stone-900 flex items-center gap-2' },
              t.is_critical ? el('span', { class: 'inline-block w-1.5 h-1.5 rounded-full bg-red-500' }) : null,
              document.createTextNode(t.title),
            ),
            el('div', { class: 'text-xs text-stone-500 mt-0.5' }, [t.category, t.phase_name].filter(Boolean).join(' · ') || '—'),
          ),
          statusPill(t.status),
        ),
        el('div', { class: 'flex items-center gap-2 mt-3 text-xs text-stone-600' },
          el('span', null, t.owner_name || 'Unassigned'),
          t.target_date ? el('span', null, '· Due ' + fmtDate(t.target_date)) : null,
          t.is_blocked ? el('span', { class: 'text-red-700' }, '· Blocked') : null,
        ),
      ));
    });
    host.appendChild(cards);

    refreshBulkBar();
  }

  function statusPill(s) {
    const map = {
      'Complete':    'text-emerald-700 bg-emerald-50 border-emerald-200',
      'In Progress': 'text-blue-700 bg-blue-50 border-blue-200',
      'Blocked':     'text-red-700 bg-red-50 border-red-200',
      'Not Started': 'text-stone-600 bg-stone-100 border-stone-200',
    };
    const cls = map[s] || 'text-stone-600 bg-stone-100 border-stone-200';
    return el('span', { class: `inline-flex items-center text-xs font-medium border rounded-full px-2 py-0.5 ${cls}` }, s || '—');
  }
  function priorityPill(p) {
    const map = {
      'Critical': 'text-red-700 bg-red-50 border-red-200',
      'High':     'text-amber-700 bg-amber-50 border-amber-200',
      'Medium':   'text-stone-700 bg-stone-100 border-stone-200',
      'Low':      'text-stone-500 bg-white border-stone-200',
    };
    const cls = map[p] || 'text-stone-500 bg-white border-stone-200';
    return el('span', { class: `inline-flex items-center text-xs font-medium border rounded-full px-2 py-0.5 ${cls}` }, p || '—');
  }

  function refreshBulkBar() {
    const bar = document.getElementById('bulk-bar');
    if (!bar) return;
    if (selectedIds.size === 0 || !canManage()) { bar.classList.add('hidden'); bar.innerHTML = ''; return; }
    bar.classList.remove('hidden');
    bar.style.display = 'flex';
    bar.innerHTML = '';
    bar.appendChild(el('span', { class: 'font-medium text-brand-700' }, `${selectedIds.size} selected`));
    bar.appendChild(el('span', { class: 'text-stone-500' }, '· Set status to:'));
    statuses.forEach(s => {
      bar.appendChild(el('button', {
        class: 'text-xs bg-white border border-stone-300 hover:bg-stone-50 rounded-lg px-2 py-1',
        onclick: () => bulkSetStatus(s.id),
      }, s.value));
    });
    bar.appendChild(el('button', {
      class: 'text-xs text-stone-500 hover:text-stone-900 ml-2',
      onclick: () => { selectedIds.clear(); renderTable(document.querySelector('#page-content > div > div:last-child')); }
    }, 'Clear'));
  }

  async function bulkSetStatus(statusId) {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    try {
      const { data, error } = await supabase.rpc('bulk_update_task_status', { p_task_ids: ids, p_status_lookup_id: statusId });
      if (error) throw error;
      toast(`Updated ${data || ids.length} task${ids.length === 1 ? '' : 's'}`, 'success');
      selectedIds.clear();
      reload();
    } catch (err) { toast(err.message || 'Could not update', 'error'); }
  }

  // ----- Dialog -----------------------------------------------------------
  function openDialog(existing) {
    const isEdit = !!existing;
    const overlay = el('div', { class: 'fixed inset-0 z-40 bg-stone-900/50 flex items-end sm:items-center justify-center p-0 sm:p-4' });
    const dialog  = el('div', { class: 'bg-white w-full sm:max-w-2xl sm:rounded-2xl rounded-t-2xl shadow-xl max-h-[95vh] flex flex-col' });
    overlay.appendChild(dialog);

    dialog.appendChild(el('div', { class: 'px-5 py-4 border-b border-stone-200' },
      el('h3', { class: 'text-base font-semibold' }, isEdit ? 'Edit task' : 'New task')));

    const body = el('div', { class: 'flex-1 overflow-y-auto p-5 space-y-3' });
    const fTitle = el('input', { type: 'text', required: '', class: 'w-full rounded-lg border border-stone-300 px-3 py-2 text-sm', value: existing?.title || '' });
    const fDesc  = el('textarea', { rows: '2', class: 'w-full rounded-lg border border-stone-300 px-3 py-2 text-sm' }, existing?.description || '');
    const fCat = selectFromLookups(categories, existing?.category_lookup_id);
    const fPri = selectFromLookups(priorities, existing?.priority_lookup_id);
    const fSta = selectFromLookups(statuses, existing?.status_lookup_id);
    const fOwn = el('select', { class: 'w-full rounded-lg border border-stone-300 px-3 py-2 text-sm bg-white' },
      el('option', { value: '' }, 'Unassigned'),
      ...members.map(m => el('option', { value: m.id, selected: m.id === existing?.owner_user_id ? '' : null }, m.full_name)));
    const fPh = el('select', { class: 'w-full rounded-lg border border-stone-300 px-3 py-2 text-sm bg-white' },
      el('option', { value: '' }, 'No phase'),
      ...phases.map(p => el('option', { value: p.id, selected: p.id === existing?.phase_id ? '' : null }, `Phase ${p.sort_order}: ${p.name}`)));
    const fTarget = el('input', { type: 'date', class: 'w-full rounded-lg border border-stone-300 px-3 py-2 text-sm', value: existing?.target_date || '' });
    const fDone   = el('input', { type: 'date', class: 'w-full rounded-lg border border-stone-300 px-3 py-2 text-sm', value: existing?.done_date || '' });
    const fNotes  = el('textarea', { rows: '2', class: 'w-full rounded-lg border border-stone-300 px-3 py-2 text-sm' }, existing?.notes || '');
    const fCrit   = el('input', { type: 'checkbox', class: 'rounded', checked: existing?.is_critical ? '' : null });
    const fBlk    = el('input', { type: 'checkbox', class: 'rounded', checked: existing?.is_blocked  ? '' : null });
    const errBox  = el('div', { class: 'text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3', hidden: '' });

    body.append(
      lab('Title', fTitle),
      lab('Description', fDesc),
      el('div', { class: 'grid grid-cols-2 gap-3' }, lab('Category', fCat), lab('Priority', fPri)),
      el('div', { class: 'grid grid-cols-2 gap-3' }, lab('Owner', fOwn), lab('Status', fSta)),
      el('div', { class: 'grid grid-cols-2 gap-3' }, lab('Phase', fPh), lab('Target date', fTarget)),
      el('div', { class: 'grid grid-cols-2 gap-3' },
        el('label', { class: 'flex items-center gap-2 text-sm text-stone-700' }, fCrit, 'Critical'),
        el('label', { class: 'flex items-center gap-2 text-sm text-stone-700' }, fBlk,  'Blocked'),
      ),
      lab('Done date (if complete)', fDone),
      lab('Notes', fNotes),
      errBox,
    );
    dialog.appendChild(body);

    const submitBtn = el('button', { class: 'px-4 py-2 text-sm rounded-lg bg-brand-500 hover:bg-brand-600 text-white font-medium' }, isEdit ? 'Save' : 'Create');
    submitBtn.addEventListener('click', async () => {
      errBox.hidden = true;
      if (!fTitle.value.trim()) { errBox.textContent = 'Title required'; errBox.hidden = false; return; }
      submitBtn.disabled = true; submitBtn.textContent = 'Saving...';
      try {
        const projectId = window.HD_Project ? window.HD_Project.getId() : null;
        const { error } = await supabase.rpc('upsert_task', {
          p_id: existing?.id || null,
          p_title: fTitle.value.trim(),
          p_description: fDesc.value.trim() || null,
          p_category_lookup_id: fCat.value || null,
          p_priority_lookup_id: fPri.value || null,
          p_status_lookup_id:   fSta.value || null,
          p_owner_user_id:      fOwn.value || null,
          p_phase_id:           fPh.value || null,
          p_target_date:        fTarget.value || null,
          p_done_date:          fDone.value || null,
          p_notes:              fNotes.value.trim() || null,
          p_is_critical:        !!fCrit.checked,
          p_is_blocked:         !!fBlk.checked,
          p_project_id:         projectId,
        });
        if (error) throw error;
        toast(isEdit ? 'Task saved' : 'Task created', 'success');
        overlay.remove();
        reload();
      } catch (err) {
        errBox.textContent = err.message || 'Could not save';
        errBox.hidden = false;
        submitBtn.disabled = false; submitBtn.textContent = isEdit ? 'Save' : 'Create';
      }
    });

    const footer = el('div', { class: 'px-5 py-4 border-t border-stone-200 flex items-center justify-between gap-2' },
      canManage() && isEdit
        ? el('button', { class: 'text-sm text-red-600 hover:text-red-700', onclick: async () => {
            if (!confirm(`Delete task "${existing.title}"?`)) return;
            try {
              const { error } = await supabase.rpc('delete_task', { p_id: existing.id });
              if (error) throw error;
              overlay.remove();
              toast('Task deleted', 'success'); reload();
            } catch (err) { toast(err.message || 'Could not delete', 'error'); }
          }}, 'Delete')
        : el('span', null, ''),
      el('div', { class: 'flex items-center gap-2' },
        el('button', { class: 'px-4 py-2 text-sm rounded-lg hover:bg-stone-100', onclick: () => overlay.remove() }, 'Cancel'),
        submitBtn,
      )
    );
    dialog.appendChild(footer);

    document.body.appendChild(overlay);
    fTitle.focus();
  }

  function selectFromLookups(list, selectedId) {
    return el('select', { class: 'w-full rounded-lg border border-stone-300 px-3 py-2 text-sm bg-white' },
      el('option', { value: '' }, '—'),
      ...list.map(l => el('option', { value: l.id, selected: l.id === selectedId ? '' : null }, l.value)));
  }
  function lab(t, ctrl) { return el('div', null, el('label', { class: 'block text-sm font-medium text-stone-700 mb-1' }, t), ctrl); }

  async function reload() {
    const main = document.getElementById('page-content');
    if (!main) return;
    main.innerHTML = '<div class="text-sm text-stone-500">Loading tasks...</div>';
    try { await loadAll(); main.innerHTML = ''; main.appendChild(renderPage()); }
    catch (err) {
      main.innerHTML = '';
      main.appendChild(el('div', { class: 'bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 text-sm' }, 'Could not load: ' + (err.message || err)));
    }
  }
})();
