// ============================================================================
// HymnDesk Control · Module 12 · Marketing and YouTube
// ----------------------------------------------------------------------------
// Two sections on one page:
//   • Marketing channels — channel, goal, KPI target, current count, owner
//   • YouTube milestones — milestone, target, status, target/achieved dates
// Admin, Marketing, PM edit.
// ============================================================================

(function () {
  'use strict';
  const M = {}; window.HD_Marketing = M;
  let supabase = null, myRole = null, channels = [], milestones = [], members = [];

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
  function canEdit() { return ['Admin','Marketing','Project Manager'].includes(myRole); }
  function projectId() { return window.HD_Project ? window.HD_Project.getId() : null; }

  async function loadAll() {
    const { data: { user } } = await supabase.auth.getUser();
    const { data: prof } = await supabase.from('users').select('role:roles(name)').eq('id', user.id).maybeSingle();
    myRole = prof?.role?.name || null;
    const pid = projectId();
    const [cRes, mRes, uRes] = await Promise.all([
      supabase.rpc('list_marketing_channels', { p_project_id: pid }),
      supabase.rpc('list_youtube_milestones', { p_project_id: pid }),
      supabase.from('users').select('id, full_name').eq('is_active', true).order('full_name'),
    ]);
    if (cRes.error) throw cRes.error;
    channels = cRes.data || []; milestones = mRes.data || []; members = uRes.data || [];
  }

  M.render = function (container, opts) {
    supabase = opts.supabase;
    container.innerHTML = '<div class="text-sm text-stone-500">Loading...</div>';
    loadAll().then(() => { container.innerHTML = ''; container.appendChild(renderPage()); })
             .catch(err => { container.innerHTML = '';
               container.appendChild(el('div', { class:'bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 text-sm' }, 'Could not load: ' + (err.message || err))); });
  };

  function renderPage() {
    const wrap = el('div', { class:'space-y-8' });
    wrap.appendChild(el('div', null,
      el('h2', { class:'text-xl lg:text-2xl font-bold text-stone-900' }, 'Marketing and YouTube'),
      el('p', { class:'text-sm text-stone-500 mt-1' }, 'Channels and growth milestones'),
    ));

    // Marketing channels section
    const chanSection = el('div', { class:'space-y-3' },
      el('div', { class:'flex items-center justify-between' },
        el('h3', { class:'text-sm font-semibold text-stone-700' }, `Marketing channels (${channels.length})`),
        canEdit() ? el('button', { class:'text-sm bg-brand-500 hover:bg-brand-600 text-white px-3 py-1.5 rounded-lg', onclick: () => openChannelDialog(null) }, '+ Add channel') : null,
      ),
    );
    if (channels.length === 0) {
      chanSection.appendChild(el('div', { class:'bg-white border border-stone-200 rounded-xl p-6 text-center text-sm text-stone-500' }, 'No marketing channels yet.'));
    } else {
      const list = el('div', { class:'space-y-2' });
      channels.forEach(c => list.appendChild(channelCard(c)));
      chanSection.appendChild(list);
    }
    wrap.appendChild(chanSection);

    // YouTube milestones section
    const msSection = el('div', { class:'space-y-3' },
      el('div', { class:'flex items-center justify-between' },
        el('h3', { class:'text-sm font-semibold text-stone-700' }, `YouTube milestones (${milestones.length})`),
        canEdit() ? el('button', { class:'text-sm bg-brand-500 hover:bg-brand-600 text-white px-3 py-1.5 rounded-lg', onclick: () => openMilestoneDialog(null) }, '+ Add milestone') : null,
      ),
    );
    if (milestones.length === 0) {
      msSection.appendChild(el('div', { class:'bg-white border border-stone-200 rounded-xl p-6 text-center text-sm text-stone-500' }, 'No milestones yet.'));
    } else {
      const list = el('div', { class:'space-y-2' });
      milestones.forEach(m => list.appendChild(milestoneCard(m)));
      msSection.appendChild(list);
    }
    wrap.appendChild(msSection);

    return wrap;
  }

  function channelCard(c) {
    return el('div', { class:'bg-white border border-stone-200 rounded-xl p-4 cursor-pointer hover:border-brand-300', onclick: () => { if (canEdit()) openChannelDialog(c); } },
      el('div', { class:'flex items-start justify-between gap-3' },
        el('div', { class:'min-w-0 flex-1' },
          el('div', { class:'font-medium text-stone-900' }, c.channel_name),
          c.goal ? el('div', { class:'text-sm text-stone-600 mt-0.5' }, c.goal) : null,
          el('div', { class:'text-xs text-stone-500 mt-1' }, [c.owner_name, c.timeline, c.status].filter(Boolean).join(' · ') || ''),
        ),
        (c.kpi_target || c.current_count) ? el('div', { class:'text-right text-xs' },
          c.current_count ? el('div', { class:'text-stone-900 font-medium' }, c.current_count) : null,
          c.kpi_target ? el('div', { class:'text-stone-500' }, 'of ' + c.kpi_target) : null,
        ) : null,
      ),
    );
  }

  function milestoneCard(m) {
    const achieved = !!m.achieved_date;
    return el('div', { class:'bg-white border border-stone-200 rounded-xl p-4 cursor-pointer hover:border-brand-300', onclick: () => { if (canEdit()) openMilestoneDialog(m); } },
      el('div', { class:'flex items-start justify-between gap-3' },
        el('div', { class:'min-w-0 flex-1' },
          el('div', { class:'flex items-center gap-2' },
            achieved ? el('span', { class:'text-emerald-600', html:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg>' }) : null,
            el('span', { class:'font-medium text-stone-900' }, m.milestone),
          ),
          el('div', { class:'text-xs text-stone-500 mt-0.5' },
            [m.target ? 'Target ' + m.target : null, m.current_status].filter(Boolean).join(' · ')),
        ),
        el('div', { class:'text-right text-xs text-stone-500' },
          achieved ? el('span', { class:'text-emerald-700' }, 'Done ' + fmtDate(m.achieved_date)) : (m.target_date ? 'By ' + fmtDate(m.target_date) : '')),
      ),
    );
  }

  // ----- Channel dialog ---------------------------------------------------
  function openChannelDialog(existing) {
    const isEdit = !!existing;
    const { overlay, dialog, body, footer } = dialogShell(isEdit ? 'Edit channel' : 'New channel');
    const fName = el('input', { type:'text', required:'', class:inp(), value: existing?.channel_name || '' });
    const fGoal = el('input', { type:'text', class:inp(), value: existing?.goal || '' });
    const fOwner = el('select', { class:inp() }, el('option', { value:'' }, 'Unassigned'),
      ...members.map(m => el('option', { value:m.id, selected: m.id === existing?.owner_user_id ? '' : null }, m.full_name)));
    const fTimeline = el('input', { type:'text', class:inp(), value: existing?.timeline || '' });
    const fKpi = el('input', { type:'text', class:inp(), value: existing?.kpi_target || '' });
    const fCount = el('input', { type:'text', class:inp(), value: existing?.current_count || '' });
    const fNotes = el('textarea', { rows:'2', class:inp() }, existing?.notes || '');
    const errBox = el('div', { class:'text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3', hidden:'' });
    body.append(lab('Channel name', fName), lab('Goal', fGoal),
      el('div', { class:'grid grid-cols-2 gap-3' }, lab('Owner', fOwner), lab('Timeline', fTimeline)),
      el('div', { class:'grid grid-cols-2 gap-3' }, lab('KPI target', fKpi), lab('Current count', fCount)),
      lab('Notes', fNotes), errBox);

    const submitBtn = el('button', { class:'px-4 py-2 text-sm rounded-lg bg-brand-500 hover:bg-brand-600 text-white font-medium' }, isEdit ? 'Save' : 'Create');
    submitBtn.addEventListener('click', async () => {
      errBox.hidden = true;
      if (!fName.value.trim()) { errBox.textContent = 'Channel name required'; errBox.hidden = false; return; }
      submitBtn.disabled = true;
      try {
        const { error } = await supabase.rpc('upsert_marketing_channel', {
          p_id: existing?.id || null, p_channel_name: fName.value.trim(), p_goal: fGoal.value.trim() || null,
          p_owner_user_id: fOwner.value || null, p_timeline: fTimeline.value.trim() || null,
          p_status_lookup_id: null, p_kpi_target: fKpi.value.trim() || null,
          p_current_count: fCount.value.trim() || null, p_notes: fNotes.value.trim() || null,
          p_sort_order: existing?.sort_order ?? 0, p_project_id: projectId(),
        });
        if (error) throw error;
        toast(isEdit ? 'Saved' : 'Added', 'success'); overlay.remove(); reload();
      } catch (err) { errBox.textContent = err.message || 'Could not save'; errBox.hidden = false; submitBtn.disabled = false; }
    });
    footer.append(
      (canEdit() && isEdit) ? el('button', { class:'text-sm text-red-600 hover:text-red-700', onclick: async () => {
        if (!confirm('Delete this channel?')) return;
        try { const { error } = await supabase.rpc('delete_marketing_channel', { p_id: existing.id });
          if (error) throw error; overlay.remove(); toast('Deleted', 'success'); reload();
        } catch (err) { toast(err.message || 'Could not delete', 'error'); } }}, 'Delete') : el('span'),
      el('div', { class:'flex items-center gap-2' },
        el('button', { class:'px-4 py-2 text-sm rounded-lg hover:bg-stone-100', onclick: () => overlay.remove() }, 'Cancel'), submitBtn),
    );
    document.body.appendChild(overlay); fName.focus();
  }

  // ----- Milestone dialog -------------------------------------------------
  function openMilestoneDialog(existing) {
    const isEdit = !!existing;
    const { overlay, dialog, body, footer } = dialogShell(isEdit ? 'Edit milestone' : 'New milestone');
    const fName = el('input', { type:'text', required:'', class:inp(), value: existing?.milestone || '' });
    const fTarget = el('input', { type:'text', class:inp(), value: existing?.target || '' });
    const fStatus = el('input', { type:'text', class:inp(), value: existing?.current_status || '' });
    const fTargetDate = el('input', { type:'date', class:inp(), value: existing?.target_date || '' });
    const fAchieved = el('input', { type:'date', class:inp(), value: existing?.achieved_date || '' });
    const fNotes = el('textarea', { rows:'2', class:inp() }, existing?.notes || '');
    const errBox = el('div', { class:'text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3', hidden:'' });
    body.append(lab('Milestone', fName),
      el('div', { class:'grid grid-cols-2 gap-3' }, lab('Target', fTarget), lab('Current status', fStatus)),
      el('div', { class:'grid grid-cols-2 gap-3' }, lab('Target date', fTargetDate), lab('Achieved date', fAchieved)),
      lab('Notes', fNotes), errBox);

    const submitBtn = el('button', { class:'px-4 py-2 text-sm rounded-lg bg-brand-500 hover:bg-brand-600 text-white font-medium' }, isEdit ? 'Save' : 'Create');
    submitBtn.addEventListener('click', async () => {
      errBox.hidden = true;
      if (!fName.value.trim()) { errBox.textContent = 'Milestone required'; errBox.hidden = false; return; }
      submitBtn.disabled = true;
      try {
        const { error } = await supabase.rpc('upsert_youtube_milestone', {
          p_id: existing?.id || null, p_milestone: fName.value.trim(), p_target: fTarget.value.trim() || null,
          p_current_status: fStatus.value.trim() || null, p_target_date: fTargetDate.value || null,
          p_achieved_date: fAchieved.value || null, p_notes: fNotes.value.trim() || null,
          p_sort_order: existing?.sort_order ?? 0, p_project_id: projectId(),
        });
        if (error) throw error;
        toast(isEdit ? 'Saved' : 'Added', 'success'); overlay.remove(); reload();
      } catch (err) { errBox.textContent = err.message || 'Could not save'; errBox.hidden = false; submitBtn.disabled = false; }
    });
    footer.append(
      (canEdit() && isEdit) ? el('button', { class:'text-sm text-red-600 hover:text-red-700', onclick: async () => {
        if (!confirm('Delete this milestone?')) return;
        try { const { error } = await supabase.rpc('delete_youtube_milestone', { p_id: existing.id });
          if (error) throw error; overlay.remove(); toast('Deleted', 'success'); reload();
        } catch (err) { toast(err.message || 'Could not delete', 'error'); } }}, 'Delete') : el('span'),
      el('div', { class:'flex items-center gap-2' },
        el('button', { class:'px-4 py-2 text-sm rounded-lg hover:bg-stone-100', onclick: () => overlay.remove() }, 'Cancel'), submitBtn),
    );
    document.body.appendChild(overlay); fName.focus();
  }

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
    main.innerHTML = '<div class="text-sm text-stone-500">Loading...</div>';
    try { await loadAll(); main.innerHTML = ''; main.appendChild(renderPage()); }
    catch (err) { main.innerHTML = ''; main.appendChild(el('div', { class:'bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 text-sm' }, 'Could not load: ' + (err.message || err))); }
  }
})();
