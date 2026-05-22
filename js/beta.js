// ============================================================================
// HymnDesk Control · Module 13 · Beta Testing
// ----------------------------------------------------------------------------
// Two tabs:
//   • Testers  — register of beta testers with device and activity
//   • Feedback — bug and feature reports with type, priority, status, assignee
// Admin, PM, Product Development Manager.
// ============================================================================

(function () {
  'use strict';
  const M = {}; window.HD_Beta = M;
  let supabase = null, myRole = null, testers = [], feedback = [], members = [];
  let types = [], priorities = [], statuses = [];
  let activeTab = 'feedback';
  let fbFilter = '';

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
  function fmtDate(d) { return d ? new Date(d).toLocaleDateString('en-ZA', { year:'numeric', month:'short', day:'numeric' }) : '—'; }
  function canEdit() { return ['Admin','Project Manager','Product Development Manager'].includes(myRole); }
  function projectId() { return window.HD_Project ? window.HD_Project.getId() : null; }

  async function loadAll() {
    const { data: { user } } = await supabase.auth.getUser();
    const { data: prof } = await supabase.from('users').select('role:roles(name)').eq('id', user.id).maybeSingle();
    myRole = prof?.role?.name || null;
    const pid = projectId();
    const [tRes, fRes, mRes, tyRes, prRes, stRes] = await Promise.all([
      supabase.rpc('list_beta_testers', { p_project_id: pid }),
      supabase.rpc('list_beta_feedback', { p_project_id: pid, p_status: fbFilter || null }),
      supabase.from('users').select('id, full_name').eq('is_active', true).order('full_name'),
      supabase.from('lookups').select('id, value, sort_order').eq('domain','feedback_type').eq('is_active',true).order('sort_order'),
      supabase.from('lookups').select('id, value, sort_order').eq('domain','feedback_priority').eq('is_active',true).order('sort_order'),
      supabase.from('lookups').select('id, value, sort_order').eq('domain','feedback_status').eq('is_active',true).order('sort_order'),
    ]);
    if (tRes.error) throw tRes.error;
    testers = tRes.data || []; feedback = fRes.data || []; members = mRes.data || [];
    types = tyRes.data || []; priorities = prRes.data || []; statuses = stRes.data || [];
  }

  M.render = function (container, opts) {
    supabase = opts.supabase;
    container.innerHTML = '<div class="text-sm text-stone-500">Loading beta testing...</div>';
    loadAll().then(() => { container.innerHTML = ''; container.appendChild(renderShell()); })
             .catch(err => { container.innerHTML = '';
               container.appendChild(el('div', { class:'bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 text-sm' }, 'Could not load: ' + (err.message || err))); });
  };

  function renderShell() {
    const wrap = el('div', { class:'space-y-6' });
    wrap.appendChild(el('div', null,
      el('h2', { class:'text-xl lg:text-2xl font-bold text-stone-900' }, 'Beta Testing'),
      el('p', { class:'text-sm text-stone-500 mt-1' }, 'Testers and their feedback'),
    ));
    const tabs = el('div', { class:'flex items-center gap-1 border-b border-stone-200' });
    const body = el('div');
    function renderTabs() {
      tabs.innerHTML = '';
      [['feedback',`Feedback (${feedback.length})`], ['testers',`Testers (${testers.length})`]].forEach(([key, label]) => {
        const b = el('button', { class:`px-3 py-2 text-sm font-medium border-b-2 ${activeTab === key ? 'border-brand-500 text-brand-700' : 'border-transparent text-stone-500 hover:text-stone-900'}` }, label);
        b.addEventListener('click', () => { activeTab = key; renderTabs(); });
        tabs.appendChild(b);
      });
      body.innerHTML = '';
      if (activeTab === 'feedback') renderFeedback(body); else renderTesters(body);
    }
    renderTabs();
    wrap.append(tabs, body);
    return wrap;
  }

  // ----- Feedback ---------------------------------------------------------
  function renderFeedback(host) {
    host.innerHTML = '';
    host.appendChild(el('div', { class:'flex items-center justify-between mt-4 mb-3' },
      el('div', { class:'flex flex-wrap items-center gap-2' },
        ...['', 'Open', 'Fixing', 'Fixed', "Won't Fix"].map(st => {
          const active = fbFilter === st;
          return el('button', { class:`text-xs px-3 py-1.5 rounded-full border ${active ? 'bg-brand-50 border-brand-300 text-brand-700' : 'bg-white border-stone-300 hover:bg-stone-50'}`,
            onclick: () => { fbFilter = st; reload('feedback'); } }, st || 'All');
        }),
      ),
      canEdit() ? el('button', { class:'text-sm bg-brand-500 hover:bg-brand-600 text-white px-3 py-1.5 rounded-lg', onclick: () => openFeedbackDialog(null) }, '+ Add feedback') : null,
    ));

    if (feedback.length === 0) {
      host.appendChild(el('div', { class:'bg-white border border-stone-200 rounded-xl p-8 text-center text-sm text-stone-500' }, 'No feedback to show.'));
      return;
    }
    const list = el('div', { class:'space-y-2' });
    feedback.forEach(f => {
      list.appendChild(el('div', { class:'bg-white border border-stone-200 rounded-xl p-4 cursor-pointer hover:border-brand-300', onclick: () => { if (canEdit()) openFeedbackDialog(f); } },
        el('div', { class:'flex items-start justify-between gap-3' },
          el('div', { class:'min-w-0 flex-1' },
            el('div', { class:'flex items-center gap-2 flex-wrap' },
              f.feedback_type ? pill(f.feedback_type, 'stone') : null,
              f.priority ? pill(f.priority, priorityTone(f.priority)) : null,
            ),
            el('div', { class:'text-sm text-stone-900 mt-1' }, f.description),
            el('div', { class:'text-xs text-stone-500 mt-1' },
              [f.tester_name, f.assigned_to_name ? 'Assigned ' + f.assigned_to_name : null].filter(Boolean).join(' · ') || ''),
          ),
          statusPill(f.status),
        ),
      ));
    });
    host.appendChild(list);
  }

  function priorityTone(p) { return ({ Critical:'red', High:'amber', Medium:'stone', Low:'stone' })[p] || 'stone'; }
  function pill(text, tone) {
    const tones = { red:'text-red-700 bg-red-50 border-red-200', amber:'text-amber-700 bg-amber-50 border-amber-200', stone:'text-stone-600 bg-stone-100 border-stone-200' };
    return el('span', { class:`inline-flex items-center text-xs font-medium border rounded-full px-2 py-0.5 ${tones[tone] || tones.stone}` }, text);
  }
  function statusPill(s) {
    const map = { 'Open':'text-blue-700 bg-blue-50 border-blue-200', 'Fixing':'text-amber-700 bg-amber-50 border-amber-200',
                  'Fixed':'text-emerald-700 bg-emerald-50 border-emerald-200', "Won't Fix":'text-stone-500 bg-stone-100 border-stone-200' };
    return el('span', { class:`inline-flex items-center text-xs font-medium border rounded-full px-2 py-0.5 ${map[s] || 'text-stone-600 bg-stone-100 border-stone-200'}` }, s || '—');
  }

  function openFeedbackDialog(existing) {
    const isEdit = !!existing;
    const { overlay, body, footer } = dialogShell(isEdit ? 'Edit feedback' : 'New feedback');
    const fTester = el('select', { class:inp() }, el('option', { value:'' }, 'Anonymous / not linked'),
      ...testers.map(t => el('option', { value:t.id, selected: t.id === existing?.tester_id ? '' : null }, t.full_name)));
    const fType = sel(types, existing?.feedback_type_lookup_id);
    const fPriority = sel(priorities, existing?.priority_lookup_id);
    const fStatus = sel(statuses, existing?.status_lookup_id);
    const fDesc = el('textarea', { rows:'3', required:'', class:inp() }, existing?.description || '');
    const fAssigned = el('select', { class:inp() }, el('option', { value:'' }, 'Unassigned'),
      ...members.map(m => el('option', { value:m.id, selected: m.id === existing?.assigned_to_user_id ? '' : null }, m.full_name)));
    const fResolution = el('textarea', { rows:'2', class:inp() }, existing?.resolution_notes || '');
    const errBox = el('div', { class:'text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3', hidden:'' });
    body.append(
      lab('Tester', fTester),
      el('div', { class:'grid grid-cols-3 gap-3' }, lab('Type', fType), lab('Priority', fPriority), lab('Status', fStatus)),
      lab('Description', fDesc), lab('Assigned to', fAssigned), lab('Resolution notes', fResolution), errBox);

    const submitBtn = el('button', { class:'px-4 py-2 text-sm rounded-lg bg-brand-500 hover:bg-brand-600 text-white font-medium' }, isEdit ? 'Save' : 'Create');
    submitBtn.addEventListener('click', async () => {
      errBox.hidden = true;
      if (!fDesc.value.trim()) { errBox.textContent = 'Description required'; errBox.hidden = false; return; }
      submitBtn.disabled = true;
      try {
        const { error } = await supabase.rpc('upsert_beta_feedback', {
          p_id: existing?.id || null, p_tester_id: fTester.value || null,
          p_feedback_type_lookup_id: fType.value || null, p_priority_lookup_id: fPriority.value || null,
          p_status_lookup_id: fStatus.value || null, p_description: fDesc.value.trim(),
          p_assigned_to_user_id: fAssigned.value || null, p_resolution_notes: fResolution.value.trim() || null,
          p_project_id: projectId(),
        });
        if (error) throw error;
        toast(isEdit ? 'Saved' : 'Added', 'success'); overlay.remove(); reload('feedback');
      } catch (err) { errBox.textContent = err.message || 'Could not save'; errBox.hidden = false; submitBtn.disabled = false; }
    });
    footer.append(
      (canEdit() && isEdit) ? el('button', { class:'text-sm text-red-600 hover:text-red-700', onclick: async () => {
        if (!confirm('Delete this feedback?')) return;
        try { const { error } = await supabase.rpc('delete_beta_feedback', { p_id: existing.id });
          if (error) throw error; overlay.remove(); toast('Deleted', 'success'); reload('feedback');
        } catch (err) { toast(err.message || 'Could not delete', 'error'); } }}, 'Delete') : el('span'),
      el('div', { class:'flex items-center gap-2' },
        el('button', { class:'px-4 py-2 text-sm rounded-lg hover:bg-stone-100', onclick: () => overlay.remove() }, 'Cancel'), submitBtn));
    document.body.appendChild(overlay); fDesc.focus();
  }

  // ----- Testers ----------------------------------------------------------
  function renderTesters(host) {
    host.innerHTML = '';
    host.appendChild(el('div', { class:'flex items-center justify-end mt-4 mb-3' },
      canEdit() ? el('button', { class:'text-sm bg-brand-500 hover:bg-brand-600 text-white px-3 py-1.5 rounded-lg', onclick: () => openTesterDialog(null) }, '+ Add tester') : null));
    if (testers.length === 0) {
      host.appendChild(el('div', { class:'bg-white border border-stone-200 rounded-xl p-8 text-center text-sm text-stone-500' }, 'No testers registered.'));
      return;
    }
    const list = el('div', { class:'bg-white border border-stone-200 rounded-xl divide-y divide-stone-100' });
    testers.forEach(t => {
      list.appendChild(el('div', { class:'flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-stone-50', onclick: () => { if (canEdit()) openTesterDialog(t); } },
        el('div', { class:'flex-1 min-w-0' },
          el('div', { class:`text-sm ${t.is_active ? 'text-stone-900' : 'text-stone-400'}` }, t.full_name),
          el('div', { class:'text-xs text-stone-500' }, [t.device, t.contact_email].filter(Boolean).join(' · ') || ''),
        ),
        el('div', { class:'text-right text-xs text-stone-500' },
          el('div', null, `${t.feedback_count} feedback`),
          t.install_date ? el('div', null, 'Since ' + fmtDate(t.install_date)) : null,
        ),
      ));
    });
    host.appendChild(list);
  }

  function openTesterDialog(existing) {
    const isEdit = !!existing;
    const { overlay, body, footer } = dialogShell(isEdit ? 'Edit tester' : 'New tester');
    const fName = el('input', { type:'text', required:'', class:inp(), value: existing?.full_name || '' });
    const fEmail = el('input', { type:'email', class:inp(), value: existing?.contact_email || '' });
    const fPhone = el('input', { type:'tel', class:inp(), value: existing?.contact_phone || '' });
    const fDevice = el('input', { type:'text', class:inp(), value: existing?.device || '', placeholder:'e.g. Samsung A52, iPhone 13' });
    const fInstall = el('input', { type:'date', class:inp(), value: existing?.install_date || '' });
    const fActivity = el('input', { type:'date', class:inp(), value: existing?.last_activity_date || '' });
    const fActive = el('input', { type:'checkbox', class:'rounded', checked: (existing ? existing.is_active : true) ? '' : null });
    const fNotes = el('textarea', { rows:'2', class:inp() }, existing?.notes || '');
    const errBox = el('div', { class:'text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3', hidden:'' });
    body.append(lab('Full name', fName),
      el('div', { class:'grid grid-cols-2 gap-3' }, lab('Email', fEmail), lab('Phone', fPhone)),
      lab('Device', fDevice),
      el('div', { class:'grid grid-cols-2 gap-3' }, lab('Install date', fInstall), lab('Last activity', fActivity)),
      el('label', { class:'flex items-center gap-2 text-sm text-stone-700' }, fActive, 'Active'),
      lab('Notes', fNotes), errBox);

    const submitBtn = el('button', { class:'px-4 py-2 text-sm rounded-lg bg-brand-500 hover:bg-brand-600 text-white font-medium' }, isEdit ? 'Save' : 'Create');
    submitBtn.addEventListener('click', async () => {
      errBox.hidden = true;
      if (!fName.value.trim()) { errBox.textContent = 'Name required'; errBox.hidden = false; return; }
      submitBtn.disabled = true;
      try {
        const { error } = await supabase.rpc('upsert_beta_tester', {
          p_id: existing?.id || null, p_full_name: fName.value.trim(),
          p_contact_phone: fPhone.value.trim() || null, p_contact_email: fEmail.value.trim() || null,
          p_device: fDevice.value.trim() || null, p_install_date: fInstall.value || null,
          p_last_activity_date: fActivity.value || null, p_is_active: !!fActive.checked,
          p_notes: fNotes.value.trim() || null, p_project_id: projectId(),
        });
        if (error) throw error;
        toast(isEdit ? 'Saved' : 'Added', 'success'); overlay.remove(); reload('testers');
      } catch (err) { errBox.textContent = err.message || 'Could not save'; errBox.hidden = false; submitBtn.disabled = false; }
    });
    footer.append(
      (canEdit() && isEdit) ? el('button', { class:'text-sm text-red-600 hover:text-red-700', onclick: async () => {
        if (!confirm('Delete this tester?')) return;
        try { const { error } = await supabase.rpc('delete_beta_tester', { p_id: existing.id });
          if (error) throw error; overlay.remove(); toast('Deleted', 'success'); reload('testers');
        } catch (err) { toast(err.message || 'Could not delete', 'error'); } }}, 'Delete') : el('span'),
      el('div', { class:'flex items-center gap-2' },
        el('button', { class:'px-4 py-2 text-sm rounded-lg hover:bg-stone-100', onclick: () => overlay.remove() }, 'Cancel'), submitBtn));
    document.body.appendChild(overlay); fName.focus();
  }

  function sel(list, selectedId) { return el('select', { class:inp() }, el('option', { value:'' }, '—'),
    ...list.map(l => el('option', { value:l.id, selected: l.id === selectedId ? '' : null }, l.value))); }

  function dialogShell(title) {
    const overlay = el('div', { class:'fixed inset-0 z-40 bg-stone-900/50 flex items-end sm:items-center justify-center p-0 sm:p-4' });
    const dialog  = el('div', { class:'bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl shadow-xl max-h-[95vh] flex flex-col' });
    overlay.appendChild(dialog);
    dialog.appendChild(el('div', { class:'px-5 py-4 border-b border-stone-200' }, el('h3', { class:'text-base font-semibold' }, title)));
    const body = el('div', { class:'flex-1 overflow-y-auto p-5 space-y-3' });
    const footer = el('div', { class:'px-5 py-4 border-t border-stone-200 flex items-center justify-between' });
    dialog.append(body, footer);
    return { overlay, dialog, body, footer };
  }

  async function reload(tab) {
    if (tab) activeTab = tab;
    const main = document.getElementById('page-content'); if (!main) return;
    main.innerHTML = '<div class="text-sm text-stone-500">Loading...</div>';
    try { await loadAll(); main.innerHTML = ''; main.appendChild(renderShell()); }
    catch (err) { main.innerHTML = ''; main.appendChild(el('div', { class:'bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 text-sm' }, 'Could not load: ' + (err.message || err))); }
  }
})();
