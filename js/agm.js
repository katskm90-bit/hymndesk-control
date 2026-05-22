// ============================================================================
// HymnDesk Control · Module 17 · Annual AGM and Audit Log
// ----------------------------------------------------------------------------
// Tabs:
//   • Milestones — AGM and Year 2 milestones with owner, target, status
//   • Sessions   — AGM session records (date, agenda, minutes)
//   • Audit log  — Admin-only read of the system audit trail
// Admin and PM edit AGM. Audit log is Admin only.
// ============================================================================

(function () {
  'use strict';
  const M = {}; window.HD_AGM = M;
  let supabase = null, myRole = null;
  let milestones = [], agmSessions = [], members = [], statuses = [];
  let activeTab = 'milestones';
  let auditRows = [], auditOffset = 0, auditSearch = '';

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
  function fmtDateTime(d) { return d ? new Date(d).toLocaleString('en-ZA', { year:'numeric', month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' }) : '—'; }
  function canEdit() { return ['Admin','Project Manager'].includes(myRole); }
  function isAdmin() { return myRole === 'Admin'; }
  function projectId() { return window.HD_Project ? window.HD_Project.getId() : null; }

  async function loadAll() {
    const { data: { user } } = await supabase.auth.getUser();
    const { data: prof } = await supabase.from('users').select('role:roles(name)').eq('id', user.id).maybeSingle();
    myRole = prof?.role?.name || null;
    const pid = projectId();
    const [mRes, sRes, uRes, stRes] = await Promise.all([
      supabase.rpc('list_agm_milestones', { p_project_id: pid }),
      supabase.rpc('list_agm_sessions', { p_project_id: pid }),
      supabase.from('users').select('id, full_name').eq('is_active', true).order('full_name'),
      supabase.from('lookups').select('id, value, sort_order').eq('domain','task_status').eq('is_active',true).order('sort_order'),
    ]);
    if (mRes.error) throw mRes.error;
    milestones = mRes.data || []; agmSessions = sRes.data || []; members = uRes.data || []; statuses = stRes.data || [];
  }

  M.render = function (container, opts) {
    supabase = opts.supabase;
    container.innerHTML = '<div class="text-sm text-stone-500">Loading AGM...</div>';
    loadAll().then(() => { container.innerHTML = ''; container.appendChild(renderShell()); })
             .catch(err => { container.innerHTML = '';
               container.appendChild(el('div', { class:'bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 text-sm' }, 'Could not load: ' + (err.message || err))); });
  };

  function renderShell() {
    const wrap = el('div', { class:'space-y-6' });
    wrap.appendChild(el('div', null,
      el('h2', { class:'text-xl lg:text-2xl font-bold text-stone-900' }, 'Annual AGM'),
      el('p', { class:'text-sm text-stone-500 mt-1' }, 'Milestones, AGM sessions, and the system audit trail'),
    ));
    const tabs = el('div', { class:'flex items-center gap-1 border-b border-stone-200' });
    const body = el('div');
    const allTabs = [['milestones', `Milestones (${milestones.length})`], ['sessions', `Sessions (${agmSessions.length})`]];
    if (isAdmin()) allTabs.push(['audit', 'Audit log']);

    function renderTabs() {
      if (!allTabs.find(t => t[0] === activeTab)) activeTab = 'milestones';
      tabs.innerHTML = '';
      allTabs.forEach(([key, label]) => {
        const b = el('button', { class:`px-3 py-2 text-sm font-medium border-b-2 ${activeTab === key ? 'border-brand-500 text-brand-700' : 'border-transparent text-stone-500 hover:text-stone-900'}` }, label);
        b.addEventListener('click', () => { activeTab = key; renderTabs(); });
        tabs.appendChild(b);
      });
      body.innerHTML = '';
      if (activeTab === 'milestones') renderMilestones(body);
      else if (activeTab === 'sessions') renderSessions(body);
      else renderAudit(body);
    }
    renderTabs();
    wrap.append(tabs, body);
    return wrap;
  }

  // ----- Milestones -------------------------------------------------------
  function renderMilestones(host) {
    host.innerHTML = '';
    host.appendChild(el('div', { class:'flex items-center justify-end mt-4 mb-3' },
      canEdit() ? el('button', { class:'text-sm bg-brand-500 hover:bg-brand-600 text-white px-3 py-1.5 rounded-lg', onclick: () => openMilestoneDialog(null) }, '+ Add milestone') : null));
    if (milestones.length === 0) {
      host.appendChild(el('div', { class:'bg-white border border-stone-200 rounded-xl p-8 text-center text-sm text-stone-500' }, 'No AGM milestones yet.'));
      return;
    }
    // Group by year
    const byYear = {};
    milestones.forEach(m => { (byYear[m.agm_year] ||= []).push(m); });
    Object.keys(byYear).sort((a,b) => b - a).forEach(year => {
      const section = el('div', { class:'mb-4' },
        el('h3', { class:'text-sm font-semibold text-stone-500 uppercase tracking-wide mb-2' }, 'AGM Year ' + year));
      const list = el('div', { class:'space-y-2' });
      byYear[year].forEach(m => {
        const achieved = !!m.achieved_date;
        list.appendChild(el('div', { class:'bg-white border border-stone-200 rounded-xl p-4 cursor-pointer hover:border-brand-300', onclick: () => { if (canEdit()) openMilestoneDialog(m); } },
          el('div', { class:'flex items-start justify-between gap-3' },
            el('div', { class:'min-w-0 flex-1' },
              el('div', { class:'flex items-center gap-2' },
                achieved ? el('span', { class:'text-emerald-600', html:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg>' }) : null,
                el('span', { class:'font-medium text-stone-900' }, m.milestone),
              ),
              el('div', { class:'text-xs text-stone-500 mt-0.5' },
                [m.owner_name, m.target_date ? 'Target ' + fmtDate(m.target_date) : null, m.status].filter(Boolean).join(' · ')),
            ),
            achieved ? el('span', { class:'text-xs text-emerald-700' }, 'Done ' + fmtDate(m.achieved_date)) : null,
          ),
        ));
      });
      section.appendChild(list);
      host.appendChild(section);
    });
  }

  function openMilestoneDialog(existing) {
    const isEdit = !!existing;
    const { overlay, body, footer } = dialogShell(isEdit ? 'Edit milestone' : 'New AGM milestone');
    const thisYear = new Date().getFullYear();
    const fYear = el('input', { type:'number', required:'', class:inp(), value: existing?.agm_year ?? thisYear });
    const fName = el('input', { type:'text', required:'', class:inp(), value: existing?.milestone || '' });
    const fOwner = el('select', { class:inp() }, el('option', { value:'' }, 'Unassigned'),
      ...members.map(m => el('option', { value:m.id, selected: m.id === existing?.owner_user_id ? '' : null }, m.full_name)));
    const fTarget = el('input', { type:'date', class:inp(), value: existing?.target_date || '' });
    const fStatus = sel(statuses, existing?.status_lookup_id);
    const fAchieved = el('input', { type:'date', class:inp(), value: existing?.achieved_date || '' });
    const fNotes = el('textarea', { rows:'2', class:inp() }, existing?.notes || '');
    const errBox = el('div', { class:'text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3', hidden:'' });
    body.append(
      el('div', { class:'grid grid-cols-2 gap-3' }, lab('AGM year', fYear), lab('Owner', fOwner)),
      lab('Milestone', fName),
      el('div', { class:'grid grid-cols-2 gap-3' }, lab('Target date', fTarget), lab('Status', fStatus)),
      lab('Achieved date', fAchieved), lab('Notes', fNotes), errBox);

    const submitBtn = el('button', { class:'px-4 py-2 text-sm rounded-lg bg-brand-500 hover:bg-brand-600 text-white font-medium' }, isEdit ? 'Save' : 'Create');
    submitBtn.addEventListener('click', async () => {
      errBox.hidden = true;
      if (!fName.value.trim() || !fYear.value) { errBox.textContent = 'Year and milestone required'; errBox.hidden = false; return; }
      submitBtn.disabled = true;
      try {
        const { error } = await supabase.rpc('upsert_agm_milestone', {
          p_id: existing?.id || null, p_agm_year: Number(fYear.value), p_milestone: fName.value.trim(),
          p_target_date: fTarget.value || null, p_owner_user_id: fOwner.value || null,
          p_status_lookup_id: fStatus.value || null, p_achieved_date: fAchieved.value || null,
          p_notes: fNotes.value.trim() || null, p_sort_order: existing?.sort_order ?? 0, p_project_id: projectId(),
        });
        if (error) throw error;
        toast(isEdit ? 'Saved' : 'Added', 'success'); overlay.remove(); reload();
      } catch (err) { errBox.textContent = err.message || 'Could not save'; errBox.hidden = false; submitBtn.disabled = false; }
    });
    footer.append(
      (canEdit() && isEdit) ? el('button', { class:'text-sm text-red-600 hover:text-red-700', onclick: async () => {
        if (!confirm('Delete this milestone?')) return;
        try { const { error } = await supabase.rpc('delete_agm_milestone', { p_id: existing.id });
          if (error) throw error; overlay.remove(); toast('Deleted', 'success'); reload();
        } catch (err) { toast(err.message || 'Could not delete', 'error'); } }}, 'Delete') : el('span'),
      el('div', { class:'flex items-center gap-2' },
        el('button', { class:'px-4 py-2 text-sm rounded-lg hover:bg-stone-100', onclick: () => overlay.remove() }, 'Cancel'), submitBtn));
    document.body.appendChild(overlay); fName.focus();
  }

  // ----- Sessions ---------------------------------------------------------
  function renderSessions(host) {
    host.innerHTML = '';
    host.appendChild(el('div', { class:'flex items-center justify-end mt-4 mb-3' },
      canEdit() ? el('button', { class:'text-sm bg-brand-500 hover:bg-brand-600 text-white px-3 py-1.5 rounded-lg', onclick: () => openSessionDialog(null) }, '+ Add AGM session') : null));
    if (agmSessions.length === 0) {
      host.appendChild(el('div', { class:'bg-white border border-stone-200 rounded-xl p-8 text-center text-sm text-stone-500' }, 'No AGM sessions recorded.'));
      return;
    }
    const list = el('div', { class:'space-y-2' });
    agmSessions.forEach(s => {
      list.appendChild(el('div', { class:'bg-white border border-stone-200 rounded-xl p-4 cursor-pointer hover:border-brand-300', onclick: () => { if (canEdit()) openSessionDialog(s); } },
        el('div', { class:'flex items-start justify-between gap-3' },
          el('div', { class:'min-w-0 flex-1' },
            el('div', { class:'font-medium text-stone-900' }, 'AGM ' + s.agm_year),
            el('div', { class:'text-xs text-stone-500 mt-0.5' }, [s.agm_date ? fmtDate(s.agm_date) : 'Date to be set', s.status].filter(Boolean).join(' · ')),
            el('div', { class:'flex items-center gap-3 mt-2 text-xs' },
              s.agenda_file_path ? el('a', { href: s.agenda_file_path, target:'_blank', class:'text-brand-600 hover:text-brand-700', onclick: (e) => e.stopPropagation() }, 'Agenda') : null,
              s.minutes_file_path ? el('a', { href: s.minutes_file_path, target:'_blank', class:'text-brand-600 hover:text-brand-700', onclick: (e) => e.stopPropagation() }, 'Minutes') : null,
            ),
          ),
        ),
      ));
    });
    host.appendChild(list);
  }

  function openSessionDialog(existing) {
    const isEdit = !!existing;
    const { overlay, body, footer } = dialogShell(isEdit ? 'Edit AGM session' : 'New AGM session');
    const thisYear = new Date().getFullYear();
    const fYear = el('input', { type:'number', required:'', class:inp(), value: existing?.agm_year ?? thisYear });
    const fDate = el('input', { type:'date', class:inp(), value: existing?.agm_date || '' });
    const fStatus = sel(statuses, existing?.status_lookup_id);
    const fAgenda = el('input', { type:'text', class:inp(), value: existing?.agenda_file_path || '', placeholder:'Link to agenda' });
    const fMinutes = el('input', { type:'text', class:inp(), value: existing?.minutes_file_path || '', placeholder:'Link to minutes' });
    const fNotes = el('textarea', { rows:'2', class:inp() }, existing?.notes || '');
    const errBox = el('div', { class:'text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3', hidden:'' });
    body.append(
      el('div', { class:'grid grid-cols-2 gap-3' }, lab('AGM year', fYear), lab('AGM date', fDate)),
      lab('Status', fStatus), lab('Agenda link', fAgenda), lab('Minutes link', fMinutes), lab('Notes', fNotes), errBox);

    const submitBtn = el('button', { class:'px-4 py-2 text-sm rounded-lg bg-brand-500 hover:bg-brand-600 text-white font-medium' }, isEdit ? 'Save' : 'Create');
    submitBtn.addEventListener('click', async () => {
      errBox.hidden = true;
      if (!fYear.value) { errBox.textContent = 'AGM year required'; errBox.hidden = false; return; }
      submitBtn.disabled = true;
      try {
        const { error } = await supabase.rpc('upsert_agm_session', {
          p_id: existing?.id || null, p_agm_year: Number(fYear.value), p_agm_date: fDate.value || null,
          p_agenda_file_path: fAgenda.value.trim() || null, p_minutes_file_path: fMinutes.value.trim() || null,
          p_status_lookup_id: fStatus.value || null, p_notes: fNotes.value.trim() || null, p_project_id: projectId(),
        });
        if (error) throw error;
        toast(isEdit ? 'Saved' : 'Added', 'success'); overlay.remove(); reload();
      } catch (err) { errBox.textContent = err.message || 'Could not save'; errBox.hidden = false; submitBtn.disabled = false; }
    });
    footer.append(
      (canEdit() && isEdit) ? el('button', { class:'text-sm text-red-600 hover:text-red-700', onclick: async () => {
        if (!confirm('Delete this AGM session?')) return;
        try { const { error } = await supabase.rpc('delete_agm_session', { p_id: existing.id });
          if (error) throw error; overlay.remove(); toast('Deleted', 'success'); reload();
        } catch (err) { toast(err.message || 'Could not delete', 'error'); } }}, 'Delete') : el('span'),
      el('div', { class:'flex items-center gap-2' },
        el('button', { class:'px-4 py-2 text-sm rounded-lg hover:bg-stone-100', onclick: () => overlay.remove() }, 'Cancel'), submitBtn));
    document.body.appendChild(overlay); fYear.focus();
  }

  // ----- Audit log --------------------------------------------------------
  async function renderAudit(host) {
    host.innerHTML = '';
    auditOffset = 0;
    const search = el('input', { type:'search', placeholder:'Search action, entity, or person', value: auditSearch, class: inp() + ' mt-4 max-w-md' });
    let timer;
    search.addEventListener('input', e => { auditSearch = e.target.value; clearTimeout(timer); timer = setTimeout(() => loadAudit(host, true), 300); });
    host.appendChild(search);
    const listHost = el('div', { class:'mt-3' });
    host.appendChild(listHost);
    await loadAudit(host, true);
  }

  async function loadAudit(host, reset) {
    const listHost = host.querySelector('div');
    if (reset) { auditRows = []; auditOffset = 0; }
    try {
      const { data, error } = await supabase.rpc('list_audit_log', {
        p_limit: 100, p_offset: auditOffset, p_entity: null, p_search: auditSearch || null,
      });
      if (error) throw error;
      const rows = data || [];
      auditRows = reset ? rows : auditRows.concat(rows);
      renderAuditList(listHost, rows.length === 100);
    } catch (err) {
      listHost.innerHTML = '';
      listHost.appendChild(el('div', { class:'text-sm text-red-600' }, err.message || 'Could not load audit log'));
    }
  }

  function renderAuditList(listHost, hasMore) {
    listHost.innerHTML = '';
    if (auditRows.length === 0) {
      listHost.appendChild(el('div', { class:'bg-white border border-stone-200 rounded-xl p-8 text-center text-sm text-stone-500' }, 'No audit entries.'));
      return;
    }
    const table = el('div', { class:'bg-white border border-stone-200 rounded-xl overflow-hidden' });
    table.appendChild(el('div', { class:'grid grid-cols-12 gap-2 px-4 py-2 bg-stone-50 border-b border-stone-200 text-xs font-medium text-stone-500 uppercase' },
      el('div', { class:'col-span-4' }, 'When'), el('div', { class:'col-span-3' }, 'Who'),
      el('div', { class:'col-span-3' }, 'Action'), el('div', { class:'col-span-2' }, 'Entity')));
    auditRows.forEach(a => {
      table.appendChild(el('div', { class:'grid grid-cols-12 gap-2 px-4 py-2 border-b border-stone-100 last:border-b-0 text-sm items-center' },
        el('div', { class:'col-span-4 text-stone-600 text-xs' }, fmtDateTime(a.created_at)),
        el('div', { class:'col-span-3 text-stone-900 truncate' }, a.actor_name || 'System'),
        el('div', { class:'col-span-3 text-stone-700 truncate' }, (a.action || '').replace(/\./g, ' ')),
        el('div', { class:'col-span-2 text-stone-500 text-xs truncate' }, a.entity || ''),
      ));
    });
    listHost.appendChild(table);
    if (hasMore) {
      listHost.appendChild(el('div', { class:'mt-3 text-center' },
        el('button', { class:'text-sm px-4 py-2 rounded-lg border border-stone-300 hover:bg-stone-50', onclick: async () => {
          auditOffset += 100;
          const { data } = await supabase.rpc('list_audit_log', { p_limit: 100, p_offset: auditOffset, p_entity: null, p_search: auditSearch || null });
          auditRows = auditRows.concat(data || []);
          renderAuditList(listHost, (data || []).length === 100);
        }}, 'Load next 100')));
    }
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

  async function reload() {
    const main = document.getElementById('page-content'); if (!main) return;
    main.innerHTML = '<div class="text-sm text-stone-500">Loading AGM...</div>';
    try { await loadAll(); main.innerHTML = ''; main.appendChild(renderShell()); }
    catch (err) { main.innerHTML = ''; main.appendChild(el('div', { class:'bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 text-sm' }, 'Could not load: ' + (err.message || err))); }
  }
})();
