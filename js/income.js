// ============================================================================
// HymnDesk Control · Module 10 · Income Streams
// ----------------------------------------------------------------------------
// Revenue sources per project (YouTube, donations, sponsorship, etc).
// Each stream has income entries with gross, bank charges, tax, net (auto).
// Admin, Finance, PM view and edit streams. Admin, Finance record entries.
// ============================================================================

(function () {
  'use strict';

  const M = {};
  window.HD_Income = M;

  let supabase = null;
  let myRole = null;
  let streams = [];

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
  function money(n) { return 'R ' + Number(n||0).toLocaleString('en-ZA', { minimumFractionDigits:2, maximumFractionDigits:2 }); }
  function fmtDate(d) { return d ? new Date(d).toLocaleDateString('en-ZA', { year:'numeric', month:'short', day:'numeric' }) : '—'; }
  function canEditStream() { return ['Admin','Finance','Project Manager'].includes(myRole); }
  function canEditEntry()  { return ['Admin','Finance'].includes(myRole); }
  function canDelete()     { return ['Admin','Finance'].includes(myRole); }
  function projectId() { return window.HD_Project ? window.HD_Project.getId() : null; }

  async function loadAll() {
    const { data: { user } } = await supabase.auth.getUser();
    const { data: prof } = await supabase.from('users').select('role:roles(name)').eq('id', user.id).maybeSingle();
    myRole = prof?.role?.name || null;
    const { data, error } = await supabase.rpc('list_income_streams', { p_project_id: projectId() });
    if (error) throw error;
    streams = data || [];
  }

  M.render = function (container, opts) {
    supabase = opts.supabase;
    container.innerHTML = '<div class="text-sm text-stone-500">Loading income streams...</div>';
    loadAll().then(() => { container.innerHTML = ''; container.appendChild(renderPage()); })
             .catch(err => { container.innerHTML = '';
               container.appendChild(el('div', { class:'bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 text-sm' }, 'Could not load: ' + (err.message || err))); });
  };

  function renderPage() {
    const wrap = el('div', { class:'space-y-6' });

    const grossTotal = streams.reduce((s, x) => s + Number(x.gross_total || 0), 0);
    const netTotal   = streams.reduce((s, x) => s + Number(x.net_total || 0), 0);

    wrap.appendChild(el('div', { class:'flex items-center justify-between gap-3' },
      el('div', null,
        el('h2', { class:'text-xl lg:text-2xl font-bold text-stone-900' }, 'Income Streams'),
        el('p', { class:'text-sm text-stone-500 mt-1' }, `${streams.length} stream${streams.length === 1 ? '' : 's'}`),
      ),
      canEditStream() ? el('button', {
        class:'inline-flex items-center gap-2 bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium px-4 py-2 rounded-lg',
        onclick: () => openStreamDialog(null),
      }, '+ Add stream') : null,
    ));

    if (streams.length > 0) {
      wrap.appendChild(el('div', { class:'grid grid-cols-2 gap-3' },
        el('div', { class:'border border-stone-200 bg-white rounded-xl p-4' },
          el('div', { class:'text-xs text-stone-500' }, 'Gross income to date'),
          el('div', { class:'text-lg font-semibold mt-0.5' }, money(grossTotal))),
        el('div', { class:'border border-emerald-200 bg-emerald-50 rounded-xl p-4' },
          el('div', { class:'text-xs text-stone-500' }, 'Net income to date'),
          el('div', { class:'text-lg font-semibold mt-0.5 text-emerald-700' }, money(netTotal))),
      ));
    }

    if (streams.length === 0) {
      wrap.appendChild(el('div', { class:'bg-white border border-stone-200 rounded-xl p-8 text-center text-sm text-stone-500' },
        'No income streams yet.'));
      return wrap;
    }

    const list = el('div', { class:'space-y-3' });
    streams.forEach(s => {
      list.appendChild(el('div', {
        class:'bg-white border border-stone-200 rounded-xl p-4 lg:p-5 cursor-pointer hover:border-brand-300',
        onclick: () => openStreamDetail(s),
      },
        el('div', { class:'flex items-start justify-between gap-3' },
          el('div', { class:'min-w-0 flex-1' },
            el('div', { class:'flex items-center gap-2' },
              el('h3', { class:'text-base font-semibold text-stone-900' }, s.name),
              s.is_active ? null : el('span', { class:'text-xs text-stone-500 bg-stone-100 border border-stone-200 rounded-full px-2 py-0.5' }, 'Inactive'),
            ),
            s.description ? el('p', { class:'text-sm text-stone-600 mt-1' }, s.description) : null,
            el('div', { class:'text-xs text-stone-500 mt-1' },
              [s.target_live_date ? 'Target ' + fmtDate(s.target_live_date) : null,
               s.est_year1_amount ? 'Est ' + money(s.est_year1_amount) : null].filter(Boolean).join(' · ')),
          ),
          el('div', { class:'text-right' },
            el('div', { class:'text-sm font-medium text-emerald-700' }, money(s.net_total)),
            el('div', { class:'text-xs text-stone-500' }, `${s.entry_count} entr${s.entry_count === 1 ? 'y' : 'ies'}`),
          ),
        ),
      ));
    });
    wrap.appendChild(list);
    return wrap;
  }

  function openStreamDialog(existing) {
    const isEdit = !!existing;
    const overlay = el('div', { class:'fixed inset-0 z-40 bg-stone-900/50 flex items-end sm:items-center justify-center p-0 sm:p-4' });
    const dialog  = el('div', { class:'bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl shadow-xl max-h-[95vh] flex flex-col' });
    overlay.appendChild(dialog);

    dialog.appendChild(el('div', { class:'px-5 py-4 border-b border-stone-200' },
      el('h3', { class:'text-base font-semibold' }, isEdit ? 'Edit income stream' : 'New income stream')));

    const body = el('div', { class:'flex-1 overflow-y-auto p-5 space-y-3' });
    const fName = el('input', { type:'text', required:'', class:'w-full rounded-lg border border-stone-300 px-3 py-2 text-sm', value: existing?.name || '', placeholder:'e.g. YouTube AdSense' });
    const fDesc = el('textarea', { rows:'2', class:'w-full rounded-lg border border-stone-300 px-3 py-2 text-sm' }, existing?.description || '');
    const fActive = el('input', { type:'checkbox', class:'rounded', checked: (existing ? existing.is_active : true) ? '' : null });
    const fTarget = el('input', { type:'date', class:'w-full rounded-lg border border-stone-300 px-3 py-2 text-sm', value: existing?.target_live_date || '' });
    const fEst = el('input', { type:'number', step:'0.01', class:'w-full rounded-lg border border-stone-300 px-3 py-2 text-sm', value: existing?.est_year1_amount ?? '' });
    const fSteps = el('textarea', { rows:'2', class:'w-full rounded-lg border border-stone-300 px-3 py-2 text-sm' }, existing?.steps_to_activate || '');
    const errBox = el('div', { class:'text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3', hidden:'' });

    body.append(
      lab('Stream name', fName),
      lab('Description', fDesc),
      el('label', { class:'flex items-center gap-2 text-sm text-stone-700' }, fActive, 'Active'),
      el('div', { class:'grid grid-cols-2 gap-3' }, lab('Target live date', fTarget), lab('Estimated annual (R)', fEst)),
      lab('Steps to activate', fSteps),
      errBox,
    );
    dialog.appendChild(body);

    const submitBtn = el('button', { class:'px-4 py-2 text-sm rounded-lg bg-brand-500 hover:bg-brand-600 text-white font-medium' }, isEdit ? 'Save' : 'Create');
    submitBtn.addEventListener('click', async () => {
      errBox.hidden = true;
      if (!fName.value.trim()) { errBox.textContent = 'Name required'; errBox.hidden = false; return; }
      submitBtn.disabled = true; submitBtn.textContent = 'Saving...';
      try {
        const { error } = await supabase.rpc('upsert_income_stream', {
          p_id: existing?.id || null,
          p_name: fName.value.trim(),
          p_description: fDesc.value.trim() || null,
          p_is_active: !!fActive.checked,
          p_target_live_date: fTarget.value || null,
          p_est_year1_amount: fEst.value === '' ? null : Number(fEst.value),
          p_steps_to_activate: fSteps.value.trim() || null,
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
        if (!confirm(`Delete stream "${existing.name}"?`)) return;
        try { const { error } = await supabase.rpc('delete_income_stream', { p_id: existing.id });
          if (error) throw error; overlay.remove(); toast('Deleted', 'success'); reload();
        } catch (err) { toast(err.message || 'Could not delete', 'error'); }
      }}, 'Delete') : el('span'),
      el('div', { class:'flex items-center gap-2' },
        el('button', { class:'px-4 py-2 text-sm rounded-lg hover:bg-stone-100', onclick: () => overlay.remove() }, 'Cancel'),
        submitBtn,
      ),
    ));
    document.body.appendChild(overlay);
    fName.focus();
  }

  async function openStreamDetail(s) {
    const overlay = el('div', { class:'fixed inset-0 z-40 bg-stone-900/50 flex items-end sm:items-center justify-center p-0 sm:p-4' });
    const dialog  = el('div', { class:'bg-white w-full sm:max-w-2xl sm:rounded-2xl rounded-t-2xl shadow-xl max-h-[95vh] flex flex-col' });
    overlay.appendChild(dialog);

    dialog.appendChild(el('div', { class:'px-5 py-4 border-b border-stone-200 flex items-start justify-between' },
      el('div', null,
        el('h3', { class:'text-base font-semibold' }, s.name),
        el('p', { class:'text-xs text-stone-500 mt-0.5' }, 'Income entries'),
      ),
      el('div', { class:'flex items-center gap-2' },
        canEditStream() ? el('button', { class:'text-xs px-3 py-1.5 rounded-lg hover:bg-stone-100', onclick: () => { overlay.remove(); openStreamDialog(s); } }, 'Edit stream') : null,
        el('button', { class:'p-1.5 rounded-lg hover:bg-stone-100',
          html:'<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="6" y1="6" x2="18" y2="18"/><line x1="6" y1="18" x2="18" y2="6"/></svg>',
          onclick: () => overlay.remove() }),
      ),
    ));

    const body = el('div', { class:'flex-1 overflow-y-auto p-5' }, el('div', { class:'text-sm text-stone-500' }, 'Loading entries...'));
    dialog.appendChild(body);
    document.body.appendChild(overlay);
    renderEntries(s, body);
  }

  async function renderEntries(s, body) {
    const { data, error } = await supabase.rpc('list_income_entries', { p_stream_id: s.id });
    if (error) { body.innerHTML = ''; body.appendChild(el('div', { class:'text-sm text-red-600' }, error.message)); return; }
    body.innerHTML = '';
    const entries = data || [];

    if (entries.length === 0) {
      body.appendChild(el('div', { class:'text-sm text-stone-500 text-center py-6' }, 'No income recorded yet.'));
    } else {
      const table = el('div', { class:'border border-stone-200 rounded-xl overflow-hidden' });
      table.appendChild(el('div', { class:'grid grid-cols-12 gap-2 px-3 py-2 bg-stone-50 border-b border-stone-200 text-xs font-medium text-stone-500 uppercase' },
        el('div', { class:'col-span-4' }, 'Period'),
        el('div', { class:'col-span-3 text-right' }, 'Gross'),
        el('div', { class:'col-span-3 text-right' }, 'Net'),
        el('div', { class:'col-span-2' }, ''),
      ));
      entries.forEach(e => {
        table.appendChild(el('div', { class:'grid grid-cols-12 gap-2 px-3 py-2 border-b border-stone-100 last:border-b-0 text-sm items-center' },
          el('div', { class:'col-span-4' },
            el('div', { class:'text-stone-900 text-xs' }, fmtDate(e.period_start) + ' – ' + fmtDate(e.period_end)),
            e.notes ? el('div', { class:'text-xs text-stone-500 truncate' }, e.notes) : null,
          ),
          el('div', { class:'col-span-3 text-right text-stone-700' }, money(e.gross_amount)),
          el('div', { class:'col-span-3 text-right text-emerald-700 font-medium' }, money(e.net_amount)),
          el('div', { class:'col-span-2 text-right' },
            canEditEntry() ? el('button', { class:'text-xs text-stone-500 hover:text-stone-900', onclick: () => openEntryDialog(s, e, body) }, 'Edit') : null,
          ),
        ));
      });
      body.appendChild(table);
    }

    if (canEditEntry()) {
      body.appendChild(el('div', { class:'mt-4 flex items-center justify-end' },
        el('button', { class:'text-sm bg-brand-500 hover:bg-brand-600 text-white px-3 py-1.5 rounded-lg', onclick: () => openEntryDialog(s, null, body) }, '+ Record income')));
    }
  }

  function openEntryDialog(s, existing, body) {
    const isEdit = !!existing;
    const overlay = el('div', { class:'fixed inset-0 z-50 bg-stone-900/50 flex items-center justify-center p-4' });
    const dlg = el('div', { class:'bg-white rounded-2xl shadow-xl w-full max-w-md p-5 space-y-3 max-h-[95vh] overflow-y-auto' });
    const fStart = el('input', { type:'date', required:'', class:'w-full rounded-lg border border-stone-300 px-3 py-2 text-sm', value: existing?.period_start || '' });
    const fEnd   = el('input', { type:'date', required:'', class:'w-full rounded-lg border border-stone-300 px-3 py-2 text-sm', value: existing?.period_end || '' });
    const fGross = el('input', { type:'number', step:'0.01', class:'w-full rounded-lg border border-stone-300 px-3 py-2 text-sm', value: existing?.gross_amount ?? '0' });
    const fBank  = el('input', { type:'number', step:'0.01', class:'w-full rounded-lg border border-stone-300 px-3 py-2 text-sm', value: existing?.bank_charges ?? '0' });
    const fTax   = el('input', { type:'number', step:'0.01', class:'w-full rounded-lg border border-stone-300 px-3 py-2 text-sm', value: existing?.tax_amount ?? '0' });
    const fNotes = el('textarea', { rows:'2', class:'w-full rounded-lg border border-stone-300 px-3 py-2 text-sm' }, existing?.notes || '');
    const netPreview = el('div', { class:'text-sm text-emerald-700 font-medium' }, '');
    const errBox = el('div', { class:'text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3', hidden:'' });

    function updateNet() {
      const net = (Number(fGross.value||0) - Number(fBank.value||0) - Number(fTax.value||0));
      netPreview.textContent = 'Net: ' + money(net);
    }
    [fGross, fBank, fTax].forEach(f => f.addEventListener('input', updateNet));
    updateNet();

    dlg.append(
      el('h4', { class:'font-semibold' }, isEdit ? 'Edit income entry' : 'Record income'),
      el('div', { class:'grid grid-cols-2 gap-3' }, lab('Period start', fStart), lab('Period end', fEnd)),
      lab('Gross amount (R)', fGross),
      el('div', { class:'grid grid-cols-2 gap-3' }, lab('Bank charges (R)', fBank), lab('Tax (R)', fTax)),
      netPreview,
      lab('Notes', fNotes),
      errBox,
      el('div', { class:'flex items-center justify-between gap-2 pt-2' },
        (canDelete() && isEdit) ? el('button', { class:'text-sm text-red-600 hover:text-red-700', onclick: async () => {
          if (!confirm('Delete this entry?')) return;
          try { const { error } = await supabase.rpc('delete_income_entry', { p_id: existing.id });
            if (error) throw error; overlay.remove(); renderEntries(s, body);
          } catch (err) { toast(err.message || 'Failed', 'error'); }
        }}, 'Delete') : el('span'),
        el('div', { class:'flex items-center gap-2' },
          el('button', { class:'px-4 py-2 text-sm rounded-lg hover:bg-stone-100', onclick: () => overlay.remove() }, 'Cancel'),
          el('button', { class:'px-4 py-2 text-sm rounded-lg bg-brand-500 hover:bg-brand-600 text-white font-medium', onclick: async () => {
            errBox.hidden = true;
            if (!fStart.value || !fEnd.value) { errBox.textContent = 'Period start and end required'; errBox.hidden = false; return; }
            try {
              const { error } = await supabase.rpc('upsert_income_entry', {
                p_id: existing?.id || null, p_stream_id: s.id,
                p_period_start: fStart.value, p_period_end: fEnd.value,
                p_gross_amount: Number(fGross.value||0), p_bank_charges: Number(fBank.value||0),
                p_tax_amount: Number(fTax.value||0), p_notes: fNotes.value.trim() || null,
              });
              if (error) throw error;
              overlay.remove(); renderEntries(s, body); reload();
            } catch (err) { errBox.textContent = err.message || 'Could not save'; errBox.hidden = false; }
          }}, isEdit ? 'Save' : 'Record'),
        ),
      ),
    );
    overlay.appendChild(dlg); document.body.appendChild(overlay);
  }

  async function reload() {
    const main = document.getElementById('page-content');
    if (!main) return;
    try { await loadAll();
      const visible = document.querySelector('#page-content');
      if (visible) { visible.innerHTML = ''; visible.appendChild(renderPage()); }
    } catch (err) { /* keep current view */ }
  }
})();
