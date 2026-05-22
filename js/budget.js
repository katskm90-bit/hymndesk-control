// ============================================================================
// HymnDesk Control · Module 9 · Budget Tracker
// ----------------------------------------------------------------------------
// Project budget: planned vs actual per line item, grouped by category.
// Admin, Finance, PM can view and edit. Summary tiles at the top.
// ============================================================================

(function () {
  'use strict';

  const M = {};
  window.HD_Budget = M;

  let supabase = null;
  let myRole = null;
  let items = [];
  let phases = [];
  let statuses = [];
  let summary = null;

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
    const t = el('div', { class: `fixed bottom-4 left-1/2 -translate-x-1/2 z-50 ${c[kind]} px-4 py-2 rounded-lg shadow-lg text-sm` });
    t.textContent = msg; document.body.appendChild(t); setTimeout(() => t.remove(), 3500);
  }
  function lab(t, ctrl) { return el('div', null, el('label', { class:'block text-sm font-medium text-stone-700 mb-1' }, t), ctrl); }
  function money(n) {
    const v = Number(n || 0);
    return 'R ' + v.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  function canEdit() { return ['Admin','Finance','Project Manager'].includes(myRole); }
  function canDelete() { return ['Admin','Finance'].includes(myRole); }
  function projectId() { return window.HD_Project ? window.HD_Project.getId() : null; }

  async function loadAll() {
    const { data: { user } } = await supabase.auth.getUser();
    const { data: prof } = await supabase.from('users').select('role:roles(name)').eq('id', user.id).maybeSingle();
    myRole = prof?.role?.name || null;
    const pid = projectId();
    const [iRes, phRes, stRes, sumRes] = await Promise.all([
      supabase.rpc('list_budget_items', { p_project_id: pid }),
      supabase.rpc('list_phases', { p_project_id: pid }),
      supabase.from('lookups').select('id, value, sort_order').eq('domain','budget_status').eq('is_active',true).order('sort_order'),
      supabase.rpc('budget_summary', { p_project_id: pid }),
    ]);
    if (iRes.error) throw iRes.error;
    items    = iRes.data || [];
    phases   = phRes.data || [];
    statuses = stRes.data || [];
    summary  = sumRes.data || null;
  }

  M.render = function (container, opts) {
    supabase = opts.supabase;
    container.innerHTML = '<div class="text-sm text-stone-500">Loading budget...</div>';
    loadAll().then(() => { container.innerHTML = ''; container.appendChild(renderPage()); })
             .catch(err => {
               container.innerHTML = '';
               container.appendChild(el('div', { class:'bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 text-sm' },
                 'Could not load: ' + (err.message || err)));
             });
  };

  function renderPage() {
    const wrap = el('div', { class:'space-y-6' });

    wrap.appendChild(el('div', { class:'flex items-center justify-between gap-3' },
      el('div', null,
        el('h2', { class:'text-xl lg:text-2xl font-bold text-stone-900' }, 'Budget Tracker'),
        el('p', { class:'text-sm text-stone-500 mt-1' }, `${items.length} line item${items.length === 1 ? '' : 's'}`),
      ),
      canEdit() ? el('button', {
        class:'inline-flex items-center gap-2 bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium px-4 py-2 rounded-lg',
        onclick: () => openDialog(null),
      }, '+ Add line item') : null,
    ));

    // Summary tiles
    if (summary) {
      const variance = Number(summary.variance_total || 0);
      wrap.appendChild(el('div', { class:'grid grid-cols-1 sm:grid-cols-3 gap-3' },
        tile('Planned', money(summary.planned_total)),
        tile('Actual', money(summary.actual_total)),
        tile('Variance', money(variance), variance < 0 ? 'red' : 'green'),
      ));
    }

    if (items.length === 0) {
      wrap.appendChild(el('div', { class:'bg-white border border-stone-200 rounded-xl p-8 text-center text-sm text-stone-500' },
        'No budget items yet.'));
      return wrap;
    }

    // Group by category
    const byCat = {};
    items.forEach(it => { (byCat[it.category || 'Uncategorised'] ||= []).push(it); });

    Object.keys(byCat).sort().forEach(cat => {
      const rows = byCat[cat];
      const catPlanned = rows.reduce((s, r) => s + Number(r.planned_amount || 0), 0);
      const catActual  = rows.reduce((s, r) => s + Number(r.actual_amount || 0), 0);

      const section = el('div', { class:'bg-white border border-stone-200 rounded-xl overflow-hidden' });
      section.appendChild(el('div', { class:'flex items-center justify-between px-4 py-3 bg-stone-50 border-b border-stone-200' },
        el('div', { class:'font-medium text-stone-900' }, cat),
        el('div', { class:'text-xs text-stone-500' }, `Planned ${money(catPlanned)} · Actual ${money(catActual)}`),
      ));
      rows.forEach(it => {
        const variance = Number(it.variance || 0);
        section.appendChild(el('div', {
          class:'flex items-center gap-3 px-4 py-3 border-b border-stone-100 last:border-b-0 hover:bg-stone-50 cursor-pointer text-sm',
          onclick: () => { if (canEdit()) openDialog(it); },
        },
          el('div', { class:'flex-1 min-w-0' },
            el('div', { class:'text-stone-900 truncate' }, it.item_description),
            el('div', { class:'text-xs text-stone-500' },
              [it.phase_name, it.status].filter(Boolean).join(' · ') || ''),
          ),
          el('div', { class:'text-right' },
            el('div', { class:'text-stone-900' }, money(it.actual_amount)),
            el('div', { class:'text-xs text-stone-500' }, 'of ' + money(it.planned_amount)),
          ),
          el('div', { class:`text-right text-xs w-24 ${variance < 0 ? 'text-red-600' : 'text-emerald-600'}` },
            (variance < 0 ? '' : '+') + money(variance)),
        ));
      });
      wrap.appendChild(section);
    });

    return wrap;
  }

  function tile(label, value, tone) {
    const tones = { red:'text-red-700 bg-red-50 border-red-200', green:'text-emerald-700 bg-emerald-50 border-emerald-200' };
    const cls = tones[tone] || 'bg-white border-stone-200';
    return el('div', { class:`border ${cls} rounded-xl p-4` },
      el('div', { class:'text-xs text-stone-500' }, label),
      el('div', { class:'text-lg font-semibold mt-0.5' }, value));
  }

  function openDialog(existing) {
    const isEdit = !!existing;
    const overlay = el('div', { class:'fixed inset-0 z-40 bg-stone-900/50 flex items-end sm:items-center justify-center p-0 sm:p-4' });
    const dialog  = el('div', { class:'bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl shadow-xl max-h-[95vh] flex flex-col' });
    overlay.appendChild(dialog);

    dialog.appendChild(el('div', { class:'px-5 py-4 border-b border-stone-200' },
      el('h3', { class:'text-base font-semibold' }, isEdit ? 'Edit budget item' : 'New budget item')));

    const body = el('div', { class:'flex-1 overflow-y-auto p-5 space-y-3' });
    const fCat = el('input', { type:'text', required:'', class:'w-full rounded-lg border border-stone-300 px-3 py-2 text-sm',
      value: existing?.category || '', placeholder:'e.g. Equipment, Venue, Catering' });
    const fDesc = el('input', { type:'text', required:'', class:'w-full rounded-lg border border-stone-300 px-3 py-2 text-sm', value: existing?.item_description || '' });
    const fPhase = el('select', { class:'w-full rounded-lg border border-stone-300 px-3 py-2 text-sm bg-white' },
      el('option', { value:'' }, 'No phase'),
      ...phases.map(p => el('option', { value:p.id, selected: p.id === existing?.phase_id ? '' : null }, `Phase ${p.sort_order}: ${p.name}`)));
    const fPlanned = el('input', { type:'number', step:'0.01', class:'w-full rounded-lg border border-stone-300 px-3 py-2 text-sm', value: existing?.planned_amount ?? '0' });
    const fActual  = el('input', { type:'number', step:'0.01', class:'w-full rounded-lg border border-stone-300 px-3 py-2 text-sm', value: existing?.actual_amount ?? '0' });
    const fStatus = el('select', { class:'w-full rounded-lg border border-stone-300 px-3 py-2 text-sm bg-white' },
      el('option', { value:'' }, '—'),
      ...statuses.map(s => el('option', { value:s.id, selected: s.id === existing?.status_lookup_id ? '' : null }, s.value)));
    const fNotes = el('textarea', { rows:'2', class:'w-full rounded-lg border border-stone-300 px-3 py-2 text-sm' }, existing?.notes || '');
    const errBox = el('div', { class:'text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3', hidden:'' });

    body.append(
      lab('Category', fCat),
      lab('Item description', fDesc),
      lab('Phase', fPhase),
      el('div', { class:'grid grid-cols-2 gap-3' }, lab('Planned amount (R)', fPlanned), lab('Actual amount (R)', fActual)),
      lab('Status', fStatus),
      lab('Notes', fNotes),
      errBox,
    );
    dialog.appendChild(body);

    const submitBtn = el('button', { class:'px-4 py-2 text-sm rounded-lg bg-brand-500 hover:bg-brand-600 text-white font-medium' }, isEdit ? 'Save' : 'Create');
    submitBtn.addEventListener('click', async () => {
      errBox.hidden = true;
      if (!fCat.value.trim() || !fDesc.value.trim()) { errBox.textContent = 'Category and description are required'; errBox.hidden = false; return; }
      submitBtn.disabled = true; submitBtn.textContent = 'Saving...';
      try {
        const { error } = await supabase.rpc('upsert_budget_item', {
          p_id: existing?.id || null,
          p_category: fCat.value.trim(),
          p_item_description: fDesc.value.trim(),
          p_phase_id: fPhase.value || null,
          p_planned_amount: fPlanned.value === '' ? 0 : Number(fPlanned.value),
          p_actual_amount:  fActual.value === '' ? 0 : Number(fActual.value),
          p_status_lookup_id: fStatus.value || null,
          p_notes: fNotes.value.trim() || null,
          p_sort_order: existing?.sort_order ?? 0,
          p_project_id: projectId(),
        });
        if (error) throw error;
        toast(isEdit ? 'Saved' : 'Added', 'success');
        overlay.remove(); reload();
      } catch (err) { errBox.textContent = err.message || 'Could not save'; errBox.hidden = false;
        submitBtn.disabled = false; submitBtn.textContent = isEdit ? 'Save' : 'Create'; }
    });

    dialog.appendChild(el('div', { class:'px-5 py-4 border-t border-stone-200 flex items-center justify-between' },
      (canDelete() && isEdit) ? el('button', { class:'text-sm text-red-600 hover:text-red-700', onclick: async () => {
        if (!confirm('Delete this budget item?')) return;
        try { const { error } = await supabase.rpc('delete_budget_item', { p_id: existing.id });
          if (error) throw error; overlay.remove(); toast('Deleted', 'success'); reload();
        } catch (err) { toast(err.message || 'Could not delete', 'error'); }
      }}, 'Delete') : el('span'),
      el('div', { class:'flex items-center gap-2' },
        el('button', { class:'px-4 py-2 text-sm rounded-lg hover:bg-stone-100', onclick: () => overlay.remove() }, 'Cancel'),
        submitBtn,
      ),
    ));
    document.body.appendChild(overlay);
    fCat.focus();
  }

  async function reload() {
    const main = document.getElementById('page-content');
    if (!main) return;
    main.innerHTML = '<div class="text-sm text-stone-500">Loading budget...</div>';
    try { await loadAll(); main.innerHTML = ''; main.appendChild(renderPage()); }
    catch (err) { main.innerHTML = ''; main.appendChild(el('div', { class:'bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 text-sm' }, 'Could not load: ' + (err.message || err))); }
  }
})();
