// ============================================================================
// HymnDesk Control · Module 4 · Project Phases
// ----------------------------------------------------------------------------
// Timeline of project phases with task rollup counts per phase.
// Admin and PM can add, edit, deactivate. System phases cannot be deleted.
// ============================================================================

(function () {
  'use strict';

  const M = {};
  window.HD_Phases = M;

  let supabase = null;
  let phases = [];
  let myRole = null;

  // ----- DOM helpers (reused pattern) --------------------------------------
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
  const esc = (s) => String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  function toast(msg, kind = 'info') {
    const c = { info: 'bg-stone-900 text-white', success: 'bg-emerald-600 text-white', error: 'bg-red-600 text-white' };
    const t = el('div', { class: `fixed bottom-4 left-1/2 -translate-x-1/2 z-50 ${c[kind]} px-4 py-2 rounded-lg shadow-lg text-sm` });
    t.textContent = msg; document.body.appendChild(t); setTimeout(() => t.remove(), 3500);
  }
  function canEdit() { return myRole === 'Admin' || myRole === 'Project Manager'; }
  function canDelete() { return myRole === 'Admin'; }
  function fmtDate(d) { return d ? new Date(d).toLocaleDateString('en-ZA', { year: 'numeric', month: 'short', day: 'numeric' }) : '—'; }

  // ----- Data load --------------------------------------------------------
  async function loadAll() {
    const { data: { user } } = await supabase.auth.getUser();
    const { data: prof } = await supabase.from('users').select('role:roles(name)').eq('id', user.id).maybeSingle();
    myRole = prof?.role?.name || null;
    const projectId = window.HD_Project ? window.HD_Project.getId() : null;
    const { data, error } = await supabase.rpc('list_phases', { p_project_id: projectId });
    if (error) throw error;
    phases = data || [];
  }

  // ----- Render -----------------------------------------------------------
  M.render = function render(container, opts) {
    supabase = opts.supabase;
    container.innerHTML = '<div class="text-sm text-stone-500">Loading phases...</div>';
    loadAll().then(() => { container.innerHTML = ''; container.appendChild(renderPage()); })
             .catch(err => {
               container.innerHTML = '';
               container.appendChild(el('div', { class: 'bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 text-sm' }, 'Could not load: ' + (err.message || err)));
             });
  };

  function renderPage() {
    const wrap = el('div', { class: 'space-y-6' });

    wrap.appendChild(el('div', { class: 'flex items-center justify-between gap-3' },
      el('div', null,
        el('h2', { class: 'text-xl lg:text-2xl font-bold text-stone-900' }, 'Project Phases'),
        el('p', { class: 'text-sm text-stone-500 mt-1' }, `${phases.length} phase${phases.length === 1 ? '' : 's'} from start to AGM`),
      ),
      canEdit() ? el('button', {
        class: 'inline-flex items-center gap-2 bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium px-4 py-2 rounded-lg',
        onclick: () => openDialog(null),
      }, '+ Add phase') : null,
    ));

    if (phases.length === 0) {
      wrap.appendChild(el('div', { class: 'bg-white border border-stone-200 rounded-xl p-8 text-center text-sm text-stone-500' },
        'No phases yet.'));
      return wrap;
    }

    // Timeline / cards layout
    const list = el('div', { class: 'space-y-3' });
    phases.forEach((p, i) => {
      const total = Number(p.task_count) || 0;
      const done  = Number(p.task_done)  || 0;
      const prog  = Number(p.task_in_progress) || 0;
      const blocked = Number(p.task_blocked) || 0;
      const notStarted = Number(p.task_not_started) || 0;
      const pct   = total > 0 ? Math.round((done / total) * 100) : 0;

      const card = el('div', { class: 'bg-white border border-stone-200 rounded-xl p-4 lg:p-5' },
        el('div', { class: 'flex items-start justify-between gap-3' },
          el('div', { class: 'min-w-0 flex-1' },
            el('div', { class: 'flex items-center gap-2 text-xs text-stone-500' }, `Phase ${p.sort_order}`),
            el('h3', { class: 'text-base lg:text-lg font-semibold text-stone-900 mt-0.5' }, p.name),
            el('p', { class: 'text-xs text-stone-500 mt-1' }, `${fmtDate(p.start_date)} → ${fmtDate(p.end_date)}`),
            p.description ? el('p', { class: 'text-sm text-stone-600 mt-2' }, p.description) : null,
          ),
          canEdit() ? el('div', { class: 'flex items-center gap-1' },
            el('button', { class: 'text-xs text-stone-600 hover:text-stone-900 px-2 py-1 rounded hover:bg-stone-100', onclick: () => openDialog(p) }, 'Edit'),
            (canDelete() && !p.is_system) ? el('button', { class: 'text-xs text-red-600 hover:text-red-700 px-2 py-1 rounded hover:bg-red-50', onclick: () => doDelete(p) }, 'Delete') : null,
          ) : null,
        ),
        total > 0 ? el('div', { class: 'mt-4' },
          el('div', { class: 'flex items-center justify-between text-xs text-stone-500 mb-1' },
            el('span', null, `${done} of ${total} tasks complete`),
            el('span', null, pct + ' percent'),
          ),
          el('div', { class: 'h-2 bg-stone-100 rounded-full overflow-hidden' },
            el('div', { class: 'h-full bg-brand-500 transition-all', style: `width: ${pct}%` }),
          ),
          el('div', { class: 'flex flex-wrap items-center gap-2 mt-2 text-xs' },
            done > 0 ? el('span', { class: 'text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5' }, `${done} done`) : null,
            prog > 0 ? el('span', { class: 'text-blue-700 bg-blue-50 border border-blue-200 rounded-full px-2 py-0.5' }, `${prog} in progress`) : null,
            blocked > 0 ? el('span', { class: 'text-red-700 bg-red-50 border border-red-200 rounded-full px-2 py-0.5' }, `${blocked} blocked`) : null,
            notStarted > 0 ? el('span', { class: 'text-stone-700 bg-stone-100 border border-stone-200 rounded-full px-2 py-0.5' }, `${notStarted} not started`) : null,
          )
        ) : el('div', { class: 'text-xs text-stone-400 mt-3' }, 'No tasks linked to this phase yet.'),
        p.key_deliverables ? el('div', { class: 'mt-3 text-xs text-stone-600' },
          el('span', { class: 'font-medium text-stone-700' }, 'Deliverables: '), p.key_deliverables) : null,
      );
      list.appendChild(card);
    });
    wrap.appendChild(list);
    return wrap;
  }

  // ----- Dialog -----------------------------------------------------------
  function openDialog(existing) {
    const isEdit = !!existing;
    const overlay = el('div', { class: 'fixed inset-0 z-40 bg-stone-900/50 flex items-end sm:items-center justify-center p-0 sm:p-4' });
    const dialog  = el('div', { class: 'bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl shadow-xl max-h-[95vh] flex flex-col' });
    overlay.appendChild(dialog);

    dialog.appendChild(el('div', { class: 'px-5 py-4 border-b border-stone-200' },
      el('h3', { class: 'text-base font-semibold' }, isEdit ? 'Edit phase' : 'Add phase')));

    const body = el('div', { class: 'flex-1 overflow-y-auto p-5 space-y-3' });
    const fName   = el('input', { type: 'text', required: '', class: 'w-full rounded-lg border border-stone-300 px-3 py-2 text-sm', value: existing?.name || '' });
    const fStart  = el('input', { type: 'date', class: 'w-full rounded-lg border border-stone-300 px-3 py-2 text-sm', value: existing?.start_date || '' });
    const fEnd    = el('input', { type: 'date', class: 'w-full rounded-lg border border-stone-300 px-3 py-2 text-sm', value: existing?.end_date || '' });
    const fOrder  = el('input', { type: 'number', class: 'w-full rounded-lg border border-stone-300 px-3 py-2 text-sm', value: existing?.sort_order ?? (phases.length + 1) });
    const fDesc   = el('textarea', { rows: '2', class: 'w-full rounded-lg border border-stone-300 px-3 py-2 text-sm' }, existing?.description || '');
    const fDel    = el('textarea', { rows: '2', class: 'w-full rounded-lg border border-stone-300 px-3 py-2 text-sm' }, existing?.key_deliverables || '');
    const errBox  = el('div', { class: 'text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3', hidden: '' });

    body.append(
      labelled('Phase name', fName),
      el('div', { class: 'grid grid-cols-2 gap-3' }, labelled('Start date', fStart), labelled('End date', fEnd)),
      labelled('Sort order', fOrder),
      labelled('Description', fDesc),
      labelled('Key deliverables', fDel),
      errBox,
    );
    dialog.appendChild(body);

    const submitBtn = el('button', { class: 'px-4 py-2 text-sm rounded-lg bg-brand-500 hover:bg-brand-600 text-white font-medium' }, isEdit ? 'Save' : 'Create');
    submitBtn.addEventListener('click', async () => {
      errBox.hidden = true;
      if (!fName.value.trim()) { errBox.textContent = 'Phase name required'; errBox.hidden = false; return; }
      submitBtn.disabled = true; submitBtn.textContent = 'Saving...';
      try {
        const projectId = window.HD_Project ? window.HD_Project.getId() : null;
        const { error } = await supabase.rpc('upsert_phase', {
          p_id: existing?.id || null,
          p_name: fName.value.trim(),
          p_description: fDesc.value.trim() || null,
          p_start_date: fStart.value || null,
          p_end_date: fEnd.value || null,
          p_key_deliverables: fDel.value.trim() || null,
          p_sort_order: fOrder.value ? Number(fOrder.value) : null,
          p_project_id: projectId,
        });
        if (error) throw error;
        toast(isEdit ? 'Phase updated' : 'Phase added', 'success');
        overlay.remove();
        reload();
      } catch (err) {
        errBox.textContent = err.message || 'Could not save';
        errBox.hidden = false;
        submitBtn.disabled = false; submitBtn.textContent = isEdit ? 'Save' : 'Create';
      }
    });

    dialog.appendChild(el('div', { class: 'px-5 py-4 border-t border-stone-200 flex items-center justify-end gap-2' },
      el('button', { class: 'px-4 py-2 text-sm rounded-lg hover:bg-stone-100', onclick: () => overlay.remove() }, 'Cancel'),
      submitBtn,
    ));

    document.body.appendChild(overlay);
    fName.focus();
  }

  function labelled(lab, ctrl) {
    return el('div', null,
      el('label', { class: 'block text-sm font-medium text-stone-700 mb-1' }, lab),
      ctrl);
  }

  async function doDelete(p) {
    if (!confirm(`Delete phase "${p.name}"? This cannot be undone.`)) return;
    try {
      const { error } = await supabase.rpc('delete_phase', { p_id: p.id });
      if (error) throw error;
      toast('Phase deleted', 'success');
      reload();
    } catch (err) {
      toast(err.message || 'Could not delete', 'error');
    }
  }

  async function reload() {
    const main = document.getElementById('page-content');
    if (!main) return;
    main.innerHTML = '<div class="text-sm text-stone-500">Loading phases...</div>';
    try { await loadAll(); main.innerHTML = ''; main.appendChild(renderPage()); }
    catch (err) {
      main.innerHTML = '';
      main.appendChild(el('div', { class: 'bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 text-sm' }, 'Could not load: ' + (err.message || err)));
    }
  }
})();
