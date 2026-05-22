// ============================================================================
// HymnDesk Control · Module 11 · Sponsorship Pipeline
// ----------------------------------------------------------------------------
// Prospects grouped by pipeline stage. Tracks target vs signed amount, owner,
// next action. Admin, Sponsorship Manager, PM edit. Finance can view.
// ============================================================================

(function () {
  'use strict';
  const M = {}; window.HD_Sponsorship = M;
  let supabase = null, myRole = null, prospects = [], members = [], statuses = [];

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
  function money(n) { return n == null ? '—' : 'R ' + Number(n).toLocaleString('en-ZA', { minimumFractionDigits:2, maximumFractionDigits:2 }); }
  function fmtDate(d) { return d ? new Date(d).toLocaleDateString('en-ZA', { year:'numeric', month:'short', day:'numeric' }) : '—'; }
  function canEdit() { return ['Admin','Sponsorship Manager','Project Manager'].includes(myRole); }
  function canDelete() { return ['Admin','Sponsorship Manager'].includes(myRole); }
  function projectId() { return window.HD_Project ? window.HD_Project.getId() : null; }

  async function loadAll() {
    const { data: { user } } = await supabase.auth.getUser();
    const { data: prof } = await supabase.from('users').select('role:roles(name)').eq('id', user.id).maybeSingle();
    myRole = prof?.role?.name || null;
    const pid = projectId();
    const [pRes, mRes, stRes] = await Promise.all([
      supabase.rpc('list_sponsorship_prospects', { p_project_id: pid }),
      supabase.from('users').select('id, full_name').eq('is_active', true).order('full_name'),
      supabase.from('lookups').select('id, value, sort_order').eq('domain','sponsorship_status').eq('is_active',true).order('sort_order'),
    ]);
    if (pRes.error) throw pRes.error;
    prospects = pRes.data || []; members = mRes.data || []; statuses = stRes.data || [];
  }

  M.render = function (container, opts) {
    supabase = opts.supabase;
    container.innerHTML = '<div class="text-sm text-stone-500">Loading pipeline...</div>';
    loadAll().then(() => { container.innerHTML = ''; container.appendChild(renderPage()); })
             .catch(err => { container.innerHTML = '';
               container.appendChild(el('div', { class:'bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 text-sm' }, 'Could not load: ' + (err.message || err))); });
  };

  function renderPage() {
    const wrap = el('div', { class:'space-y-6' });
    const signedTotal = prospects.reduce((s, p) => s + Number(p.signed_amount || 0), 0);
    const targetTotal = prospects.reduce((s, p) => s + Number(p.target_amount || 0), 0);

    wrap.appendChild(el('div', { class:'flex items-center justify-between gap-3' },
      el('div', null,
        el('h2', { class:'text-xl lg:text-2xl font-bold text-stone-900' }, 'Sponsorship Pipeline'),
        el('p', { class:'text-sm text-stone-500 mt-1' }, `${prospects.length} prospect${prospects.length === 1 ? '' : 's'}`),
      ),
      canEdit() ? el('button', { class:'inline-flex items-center gap-2 bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium px-4 py-2 rounded-lg',
        onclick: () => openDialog(null) }, '+ Add prospect') : null,
    ));

    if (prospects.length > 0) {
      wrap.appendChild(el('div', { class:'grid grid-cols-2 gap-3' },
        el('div', { class:'border border-stone-200 bg-white rounded-xl p-4' },
          el('div', { class:'text-xs text-stone-500' }, 'Target value'),
          el('div', { class:'text-lg font-semibold mt-0.5' }, money(targetTotal))),
        el('div', { class:'border border-emerald-200 bg-emerald-50 rounded-xl p-4' },
          el('div', { class:'text-xs text-stone-500' }, 'Signed value'),
          el('div', { class:'text-lg font-semibold mt-0.5 text-emerald-700' }, money(signedTotal))),
      ));
    }

    if (prospects.length === 0) {
      wrap.appendChild(el('div', { class:'bg-white border border-stone-200 rounded-xl p-8 text-center text-sm text-stone-500' }, 'No prospects yet.'));
      return wrap;
    }

    // Group by status (pipeline stage)
    const byStatus = {};
    prospects.forEach(p => { (byStatus[p.status || 'No status'] ||= []).push(p); });
    const order = statuses.map(s => s.value).concat(['No status']);
    order.filter(st => byStatus[st]).forEach(st => {
      const rows = byStatus[st];
      const section = el('div', null,
        el('h3', { class:'text-sm font-semibold text-stone-500 uppercase tracking-wide mb-2 mt-2' }, `${st} (${rows.length})`),
        el('div', { class:'space-y-2' }, ...rows.map(p => prospectCard(p))),
      );
      wrap.appendChild(section);
    });
    return wrap;
  }

  function prospectCard(p) {
    return el('div', { class:'bg-white border border-stone-200 rounded-xl p-4 cursor-pointer hover:border-brand-300', onclick: () => { if (canEdit()) openDialog(p); } },
      el('div', { class:'flex items-start justify-between gap-3' },
        el('div', { class:'min-w-0 flex-1' },
          el('div', { class:'font-medium text-stone-900' }, p.name),
          el('div', { class:'text-xs text-stone-500 mt-0.5' }, [p.contact_person, p.owner_name ? 'Owner ' + p.owner_name : null].filter(Boolean).join(' · ') || '—'),
          p.next_action ? el('div', { class:'text-xs text-stone-600 mt-1' }, 'Next: ' + p.next_action) : null,
        ),
        el('div', { class:'text-right' },
          el('div', { class:'text-sm font-medium text-stone-900' }, money(p.signed_amount || p.target_amount)),
          p.last_activity_date ? el('div', { class:'text-xs text-stone-500' }, fmtDate(p.last_activity_date)) : null,
        ),
      ),
    );
  }

  function openDialog(existing) {
    const isEdit = !!existing;
    const overlay = el('div', { class:'fixed inset-0 z-40 bg-stone-900/50 flex items-end sm:items-center justify-center p-0 sm:p-4' });
    const dialog  = el('div', { class:'bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl shadow-xl max-h-[95vh] flex flex-col' });
    overlay.appendChild(dialog);
    dialog.appendChild(el('div', { class:'px-5 py-4 border-b border-stone-200' },
      el('h3', { class:'text-base font-semibold' }, isEdit ? 'Edit prospect' : 'New prospect')));

    const body = el('div', { class:'flex-1 overflow-y-auto p-5 space-y-3' });
    const fName = el('input', { type:'text', required:'', class:inp(), value: existing?.name || '' });
    const fPerson = el('input', { type:'text', class:inp(), value: existing?.contact_person || '' });
    const fEmail = el('input', { type:'email', class:inp(), value: existing?.contact_email || '' });
    const fPhone = el('input', { type:'tel', class:inp(), value: existing?.contact_phone || '' });
    const fStatus = sel(statuses, existing?.status_lookup_id);
    const fTarget = el('input', { type:'number', step:'0.01', class:inp(), value: existing?.target_amount ?? '' });
    const fSigned = el('input', { type:'number', step:'0.01', class:inp(), value: existing?.signed_amount ?? '' });
    const fDate = el('input', { type:'date', class:inp(), value: existing?.last_activity_date || '' });
    const fNext = el('input', { type:'text', class:inp(), value: existing?.next_action || '' });
    const fOwner = el('select', { class:inp() }, el('option', { value:'' }, 'Unassigned'),
      ...members.map(m => el('option', { value:m.id, selected: m.id === existing?.owner_user_id ? '' : null }, m.full_name)));
    const fNotes = el('textarea', { rows:'2', class:inp() }, existing?.notes || '');
    const errBox = el('div', { class:'text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3', hidden:'' });

    body.append(
      lab('Sponsor name', fName),
      el('div', { class:'grid grid-cols-2 gap-3' }, lab('Contact person', fPerson), lab('Status', fStatus)),
      el('div', { class:'grid grid-cols-2 gap-3' }, lab('Email', fEmail), lab('Phone', fPhone)),
      el('div', { class:'grid grid-cols-2 gap-3' }, lab('Target amount (R)', fTarget), lab('Signed amount (R)', fSigned)),
      el('div', { class:'grid grid-cols-2 gap-3' }, lab('Last activity', fDate), lab('Owner', fOwner)),
      lab('Next action', fNext),
      lab('Notes', fNotes),
      errBox,
    );
    dialog.appendChild(body);

    const submitBtn = el('button', { class:'px-4 py-2 text-sm rounded-lg bg-brand-500 hover:bg-brand-600 text-white font-medium' }, isEdit ? 'Save' : 'Create');
    submitBtn.addEventListener('click', async () => {
      errBox.hidden = true;
      if (!fName.value.trim()) { errBox.textContent = 'Name required'; errBox.hidden = false; return; }
      submitBtn.disabled = true; submitBtn.textContent = 'Saving...';
      try {
        const { error } = await supabase.rpc('upsert_sponsorship_prospect', {
          p_id: existing?.id || null, p_name: fName.value.trim(),
          p_contact_person: fPerson.value.trim() || null, p_contact_email: fEmail.value.trim() || null,
          p_contact_phone: fPhone.value.trim() || null, p_status_lookup_id: fStatus.value || null,
          p_target_amount: fTarget.value === '' ? null : Number(fTarget.value),
          p_signed_amount: fSigned.value === '' ? null : Number(fSigned.value),
          p_last_activity_date: fDate.value || null, p_next_action: fNext.value.trim() || null,
          p_owner_user_id: fOwner.value || null, p_notes: fNotes.value.trim() || null, p_project_id: projectId(),
        });
        if (error) throw error;
        toast(isEdit ? 'Saved' : 'Added', 'success'); overlay.remove(); reload();
      } catch (err) { errBox.textContent = err.message || 'Could not save'; errBox.hidden = false;
        submitBtn.disabled = false; submitBtn.textContent = isEdit ? 'Save' : 'Create'; }
    });

    dialog.appendChild(el('div', { class:'px-5 py-4 border-t border-stone-200 flex items-center justify-between' },
      (canDelete() && isEdit) ? el('button', { class:'text-sm text-red-600 hover:text-red-700', onclick: async () => {
        if (!confirm(`Delete prospect "${existing.name}"?`)) return;
        try { const { error } = await supabase.rpc('delete_sponsorship_prospect', { p_id: existing.id });
          if (error) throw error; overlay.remove(); toast('Deleted', 'success'); reload();
        } catch (err) { toast(err.message || 'Could not delete', 'error'); }
      }}, 'Delete') : el('span'),
      el('div', { class:'flex items-center gap-2' },
        el('button', { class:'px-4 py-2 text-sm rounded-lg hover:bg-stone-100', onclick: () => overlay.remove() }, 'Cancel'), submitBtn),
    ));
    document.body.appendChild(overlay); fName.focus();
  }

  function inp() { return 'w-full rounded-lg border border-stone-300 px-3 py-2 text-sm bg-white'; }
  function sel(list, selectedId) { return el('select', { class:inp() }, el('option', { value:'' }, '—'),
    ...list.map(l => el('option', { value:l.id, selected: l.id === selectedId ? '' : null }, l.value))); }

  async function reload() {
    const main = document.getElementById('page-content'); if (!main) return;
    main.innerHTML = '<div class="text-sm text-stone-500">Loading pipeline...</div>';
    try { await loadAll(); main.innerHTML = ''; main.appendChild(renderPage()); }
    catch (err) { main.innerHTML = ''; main.appendChild(el('div', { class:'bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 text-sm' }, 'Could not load: ' + (err.message || err))); }
  }
})();
