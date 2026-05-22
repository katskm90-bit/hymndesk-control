// ============================================================================
// HymnDesk Control · Module 15 · Risk Register
// ----------------------------------------------------------------------------
// Risks sorted by severity (impact times likelihood). Colour-coded. Admin and
// PM edit; everyone can read for transparency.
// ============================================================================

(function () {
  'use strict';
  const M = {}; window.HD_Risks = M;
  let supabase = null, myRole = null, risks = [], members = [], impacts = [], likelihoods = [], statuses = [];

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
  function canEdit() { return ['Admin','Project Manager'].includes(myRole); }
  function projectId() { return window.HD_Project ? window.HD_Project.getId() : null; }

  async function loadAll() {
    const { data: { user } } = await supabase.auth.getUser();
    const { data: prof } = await supabase.from('users').select('role:roles(name)').eq('id', user.id).maybeSingle();
    myRole = prof?.role?.name || null;
    const pid = projectId();
    const [rRes, mRes, iRes, lRes, sRes] = await Promise.all([
      supabase.rpc('list_risks', { p_project_id: pid }),
      supabase.from('users').select('id, full_name').eq('is_active', true).order('full_name'),
      supabase.from('lookups').select('id, value, sort_order').eq('domain','risk_impact').eq('is_active',true).order('sort_order'),
      supabase.from('lookups').select('id, value, sort_order').eq('domain','risk_likelihood').eq('is_active',true).order('sort_order'),
      supabase.from('lookups').select('id, value, sort_order').eq('domain','risk_status').eq('is_active',true).order('sort_order'),
    ]);
    if (rRes.error) throw rRes.error;
    risks = rRes.data || []; members = mRes.data || [];
    impacts = iRes.data || []; likelihoods = lRes.data || []; statuses = sRes.data || [];
  }

  M.render = function (container, opts) {
    supabase = opts.supabase;
    container.innerHTML = '<div class="text-sm text-stone-500">Loading risk register...</div>';
    loadAll().then(() => { container.innerHTML = ''; container.appendChild(renderPage()); })
             .catch(err => { container.innerHTML = '';
               container.appendChild(el('div', { class:'bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 text-sm' }, 'Could not load: ' + (err.message || err))); });
  };

  function renderPage() {
    const wrap = el('div', { class:'space-y-6' });
    const active = risks.filter(r => r.status !== 'Closed').length;

    wrap.appendChild(el('div', { class:'flex items-center justify-between gap-3' },
      el('div', null,
        el('h2', { class:'text-xl lg:text-2xl font-bold text-stone-900' }, 'Risk Register'),
        el('p', { class:'text-sm text-stone-500 mt-1' }, `${active} active · ${risks.length} total`),
      ),
      canEdit() ? el('button', { class:'inline-flex items-center gap-2 bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium px-4 py-2 rounded-lg',
        onclick: () => openDialog(null) }, '+ Add risk') : null,
    ));

    if (risks.length === 0) {
      wrap.appendChild(el('div', { class:'bg-white border border-stone-200 rounded-xl p-8 text-center text-sm text-stone-500' }, 'No risks recorded.'));
      return wrap;
    }

    const list = el('div', { class:'space-y-2' });
    risks.forEach(r => {
      const sev = Number(r.severity_rank || 0);
      const bar = sevColour(sev, r.status);
      list.appendChild(el('div', { class:'bg-white border border-stone-200 rounded-xl p-4 cursor-pointer hover:border-brand-300', onclick: () => { if (canEdit()) openDialog(r); } },
        el('div', { class:'flex items-start gap-3' },
          el('div', { class:`w-1 self-stretch rounded-full ${bar}` }),
          el('div', { class:'min-w-0 flex-1' },
            el('div', { class:'flex items-start justify-between gap-2' },
              el('div', { class:`font-medium ${r.status === 'Closed' ? 'text-stone-400 line-through' : 'text-stone-900'}` }, r.risk_description),
              statusPill(r.status),
            ),
            r.impact_summary ? el('div', { class:'text-sm text-stone-600 mt-1' }, r.impact_summary) : null,
            el('div', { class:'flex flex-wrap items-center gap-2 mt-2 text-xs' },
              r.impact ? chip('Impact: ' + r.impact) : null,
              r.likelihood ? chip('Likelihood: ' + r.likelihood) : null,
              r.owner_name ? chip('Owner: ' + r.owner_name) : null,
            ),
            r.response_summary ? el('div', { class:'text-xs text-stone-600 mt-2' }, 'Response: ' + r.response_summary) : null,
          ),
        ),
      ));
    });
    wrap.appendChild(list);
    return wrap;
  }

  function sevColour(sev, status) {
    if (status === 'Closed') return 'bg-stone-200';
    if (sev >= 12) return 'bg-red-500';
    if (sev >= 9) return 'bg-amber-500';
    if (sev >= 4) return 'bg-yellow-400';
    return 'bg-emerald-400';
  }
  function chip(text) { return el('span', { class:'inline-flex items-center text-xs text-stone-600 bg-stone-100 border border-stone-200 rounded-full px-2 py-0.5' }, text); }
  function statusPill(s) {
    const map = { 'Active':'text-red-700 bg-red-50 border-red-200', 'Monitoring':'text-amber-700 bg-amber-50 border-amber-200',
                  'Mitigated':'text-blue-700 bg-blue-50 border-blue-200', 'Closed':'text-stone-500 bg-stone-100 border-stone-200' };
    return el('span', { class:`inline-flex items-center text-xs font-medium border rounded-full px-2 py-0.5 shrink-0 ${map[s] || 'text-stone-600 bg-stone-100 border-stone-200'}` }, s || '—');
  }

  function openDialog(existing) {
    const isEdit = !!existing;
    const overlay = el('div', { class:'fixed inset-0 z-40 bg-stone-900/50 flex items-end sm:items-center justify-center p-0 sm:p-4' });
    const dialog  = el('div', { class:'bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl shadow-xl max-h-[95vh] flex flex-col' });
    overlay.appendChild(dialog);
    dialog.appendChild(el('div', { class:'px-5 py-4 border-b border-stone-200' }, el('h3', { class:'text-base font-semibold' }, isEdit ? 'Edit risk' : 'New risk')));
    const body = el('div', { class:'flex-1 overflow-y-auto p-5 space-y-3' });
    const fDesc = el('textarea', { rows:'2', required:'', class:inp() }, existing?.risk_description || '');
    const fImpactSummary = el('input', { type:'text', class:inp(), value: existing?.impact_summary || '' });
    const fImpact = sel(impacts, existing?.impact_lookup_id);
    const fLikelihood = sel(likelihoods, existing?.likelihood_lookup_id);
    const fStatus = sel(statuses, existing?.status_lookup_id);
    const fResponse = el('textarea', { rows:'2', class:inp() }, existing?.response_summary || '');
    const fOwner = el('select', { class:inp() }, el('option', { value:'' }, 'Unassigned'),
      ...members.map(m => el('option', { value:m.id, selected: m.id === existing?.owner_user_id ? '' : null }, m.full_name)));
    const fOpened = el('input', { type:'date', class:inp(), value: existing?.opened_date || new Date().toISOString().slice(0,10) });
    const fClosed = el('input', { type:'date', class:inp(), value: existing?.closed_date || '' });
    const fNotes = el('textarea', { rows:'2', class:inp() }, existing?.notes || '');
    const errBox = el('div', { class:'text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3', hidden:'' });
    body.append(
      lab('Risk description', fDesc),
      lab('Impact summary', fImpactSummary),
      el('div', { class:'grid grid-cols-3 gap-3' }, lab('Impact', fImpact), lab('Likelihood', fLikelihood), lab('Status', fStatus)),
      lab('Response', fResponse),
      el('div', { class:'grid grid-cols-2 gap-3' }, lab('Owner', fOwner), lab('Opened date', fOpened)),
      lab('Closed date', fClosed), lab('Notes', fNotes), errBox);
    dialog.appendChild(body);

    const submitBtn = el('button', { class:'px-4 py-2 text-sm rounded-lg bg-brand-500 hover:bg-brand-600 text-white font-medium' }, isEdit ? 'Save' : 'Create');
    submitBtn.addEventListener('click', async () => {
      errBox.hidden = true;
      if (!fDesc.value.trim()) { errBox.textContent = 'Risk description required'; errBox.hidden = false; return; }
      submitBtn.disabled = true; submitBtn.textContent = 'Saving...';
      try {
        const { error } = await supabase.rpc('upsert_risk', {
          p_id: existing?.id || null, p_risk_description: fDesc.value.trim(),
          p_impact_summary: fImpactSummary.value.trim() || null, p_impact_lookup_id: fImpact.value || null,
          p_likelihood_lookup_id: fLikelihood.value || null, p_status_lookup_id: fStatus.value || null,
          p_response_summary: fResponse.value.trim() || null, p_owner_user_id: fOwner.value || null,
          p_opened_date: fOpened.value || null, p_closed_date: fClosed.value || null,
          p_notes: fNotes.value.trim() || null, p_sort_order: existing?.sort_order ?? 0, p_project_id: projectId(),
        });
        if (error) throw error;
        toast(isEdit ? 'Saved' : 'Added', 'success'); overlay.remove(); reload();
      } catch (err) { errBox.textContent = err.message || 'Could not save'; errBox.hidden = false;
        submitBtn.disabled = false; submitBtn.textContent = isEdit ? 'Save' : 'Create'; }
    });
    dialog.appendChild(el('div', { class:'px-5 py-4 border-t border-stone-200 flex items-center justify-between' },
      (canEdit() && isEdit) ? el('button', { class:'text-sm text-red-600 hover:text-red-700', onclick: async () => {
        if (!confirm('Delete this risk?')) return;
        try { const { error } = await supabase.rpc('delete_risk', { p_id: existing.id });
          if (error) throw error; overlay.remove(); toast('Deleted', 'success'); reload();
        } catch (err) { toast(err.message || 'Could not delete', 'error'); } }}, 'Delete') : el('span'),
      el('div', { class:'flex items-center gap-2' },
        el('button', { class:'px-4 py-2 text-sm rounded-lg hover:bg-stone-100', onclick: () => overlay.remove() }, 'Cancel'), submitBtn)));
    document.body.appendChild(overlay); fDesc.focus();
  }

  function sel(list, selectedId) { return el('select', { class:inp() }, el('option', { value:'' }, '—'),
    ...list.map(l => el('option', { value:l.id, selected: l.id === selectedId ? '' : null }, l.value))); }

  async function reload() {
    const main = document.getElementById('page-content'); if (!main) return;
    main.innerHTML = '<div class="text-sm text-stone-500">Loading risk register...</div>';
    try { await loadAll(); main.innerHTML = ''; main.appendChild(renderPage()); }
    catch (err) { main.innerHTML = ''; main.appendChild(el('div', { class:'bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 text-sm' }, 'Could not load: ' + (err.message || err))); }
  }
})();
