// ============================================================================
// HymnDesk Control · Invitations
// ----------------------------------------------------------------------------
// Meeting and production day invitations. Admin, Project Manager, and Director /
// Producer create invitations and invite specific members. Invited members RSVP,
// give dietary requirements, and may add Any Other Business points. Upcoming and
// past invitations are shown.
// ============================================================================

(function () {
  'use strict';
  const M = {}; window.HD_Invitations = M;
  let supabase = null, myRole = null, myUserId = null;
  let invites = [], members = [], sessions = [];

  const RSVP_OPTIONS = ['Available', 'Not available', 'Tentative'];

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
    const t = el('div', { class:`fixed bottom-4 left-1/2 -translate-x-1/2 z-[60] ${c[kind]} px-4 py-2 rounded-lg shadow-lg text-sm` });
    t.textContent = msg; document.body.appendChild(t); setTimeout(() => t.remove(), 3500);
  }
  function lab(t, ctrl) { return el('div', null, el('label', { class:'block text-sm font-medium text-stone-700 mb-1' }, t), ctrl); }
  function fmtDate(d) { return d ? new Date(d).toLocaleDateString('en-ZA', { year:'numeric', month:'short', day:'numeric' }) : 'Date to confirm'; }
  function esc(s) { return String(s == null ? '' : s); }
  function projectId() { return window.HD_Project ? window.HD_Project.getId() : null; }
  function canManage() { return ['Admin','Project Manager','Director / Producer'].includes(myRole); }
  function mapsLink(addr) { return 'https://www.google.com/maps/dir/?api=1&destination=' + encodeURIComponent(addr); }

  async function loadAll() {
    const { data: { user } } = await supabase.auth.getUser();
    myUserId = user.id;
    const [pRes, iRes, mRes, sRes] = await Promise.all([
      supabase.from('users').select('role:roles(name)').eq('id', user.id).maybeSingle(),
      supabase.rpc('list_invitations', { p_project_id: projectId() }),
      supabase.rpc('list_assignable_members'),
      supabase.rpc('list_sessions', { p_project_id: projectId() }),
    ]);
    myRole = pRes.data?.role?.name || null;
    invites = iRes.error ? [] : (iRes.data || []);
    members = mRes.error ? [] : (mRes.data || []);
    sessions = sRes.error ? [] : (sRes.data || []);
  }

  M.render = function (container, opts) {
    supabase = opts.supabase;
    container.innerHTML = '<div class="text-sm text-stone-500">Loading...</div>';
    loadAll().then(() => { container.innerHTML = ''; container.appendChild(renderList()); })
      .catch(err => { container.innerHTML = '';
        container.appendChild(el('div', { class:'bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 text-sm' }, 'Could not load: ' + (err.message || err))); });
  };

  function reload() {
    const main = document.getElementById('page-content'); if (!main) return;
    main.innerHTML = '<div class="text-sm text-stone-500">Loading...</div>';
    loadAll().then(() => { main.innerHTML = ''; main.appendChild(renderList()); })
      .catch(err => { main.innerHTML=''; main.appendChild(el('div', { class:'bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 text-sm' }, 'Could not load: ' + (err.message || err))); });
  }

  function statusPill(s) {
    const map = { Draft:'text-stone-600 bg-stone-100 border-stone-200',
                  Sent:'text-emerald-700 bg-emerald-50 border-emerald-200',
                  Cancelled:'text-red-700 bg-red-50 border-red-200' };
    return el('span', { class:`inline-flex items-center text-xs font-medium border rounded-full px-2 py-0.5 ${map[s]||map.Draft}` }, s || 'Draft');
  }
  function rsvpPill(s) {
    if (!s) return el('span', { class:'text-xs text-stone-400' }, 'No response');
    const map = { 'Available':'text-emerald-700 bg-emerald-50', 'Not available':'text-red-700 bg-red-50', 'Tentative':'text-amber-700 bg-amber-50' };
    return el('span', { class:`text-xs font-medium px-2 py-0.5 rounded-full ${map[s]||'bg-stone-100 text-stone-600'}` }, s);
  }

  function isPast(i) { return i.meeting_date && new Date(i.meeting_date) < new Date(new Date().toDateString()); }

  function renderList() {
    const wrap = el('div', { class:'space-y-5' });
    wrap.appendChild(el('div', { class:'flex items-start justify-between gap-3' },
      el('div', null,
        el('h2', { class:'text-xl lg:text-2xl font-bold text-stone-900' }, 'Invitations'),
        el('p', { class:'text-sm text-stone-500 mt-1' }, canManage() ? 'Invite members to meetings and production days.' : 'Your meeting invitations. Open one to respond.')),
      canManage() ? el('button', { class:'bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium px-4 py-2 rounded-lg shrink-0',
        onclick: () => openForm() }, 'New invitation') : null,
    ));

    if (invites.length === 0) {
      wrap.appendChild(el('div', { class:'bg-white border border-stone-200 rounded-xl p-8 text-center text-sm text-stone-500' },
        canManage() ? 'No invitations yet. Create one to get started.' : 'You have no invitations yet.'));
      return wrap;
    }

    const upcoming = invites.filter(i => !isPast(i));
    const past = invites.filter(isPast);

    if (upcoming.length) {
      wrap.appendChild(el('div', { class:'text-sm font-semibold text-stone-700' }, 'Upcoming'));
      upcoming.forEach(i => wrap.appendChild(inviteCard(i)));
    }
    if (past.length) {
      wrap.appendChild(el('div', { class:'text-sm font-semibold text-stone-700 mt-4' }, 'Past'));
      past.forEach(i => wrap.appendChild(inviteCard(i)));
    }
    return wrap;
  }

  function inviteCard(i) {
    const needsMyResponse = i.am_invited && i.status === 'Sent' && !i.my_rsvp && !isPast(i);
    const sub = [];
    sub.push(fmtDate(i.meeting_date) + (i.start_time ? ' · ' + i.start_time : ''));
    sub.push(i.mode === 'Virtual' ? 'Virtual' : 'In person');
    if (canManage()) sub.push(`${i.responded_count}/${i.invitee_count} responded`);

    return el('div', { class:`bg-white border rounded-xl p-4 flex items-center justify-between gap-3 ${needsMyResponse ? 'border-brand-300' : 'border-stone-200'}` },
      el('div', { class:'min-w-0' },
        el('div', { class:'flex items-center gap-2 flex-wrap' },
          el('span', { class:'font-medium text-stone-900' }, i.subject),
          canManage() ? statusPill(i.status) : null,
          (!canManage() && i.my_rsvp) ? rsvpPill(i.my_rsvp) : null),
        el('div', { class:'text-xs text-stone-500 mt-1' }, sub.join(' · '))),
      el('div', { class:'shrink-0' },
        el('button', { class:'text-xs text-brand-600 hover:text-brand-700', onclick: () => openDetail(i.id) },
          needsMyResponse ? 'Respond' : 'Open')),
    );
  }

  // ----- Create / edit (managers) -----------------------------------------
  function openForm(existing) {
    const isEdit = !!existing;
    const overlay = el('div', { class:'fixed inset-0 z-50 bg-stone-900/50 flex items-end sm:items-center justify-center p-0 sm:p-4' });
    const dialog  = el('div', { class:'bg-white w-full sm:max-w-xl sm:rounded-2xl rounded-t-2xl shadow-xl max-h-[95vh] flex flex-col' });
    overlay.appendChild(dialog);
    dialog.appendChild(el('div', { class:'px-5 py-4 border-b border-stone-200' },
      el('h3', { class:'text-base font-semibold' }, isEdit ? 'Edit invitation' : 'New invitation')));

    const body = el('div', { class:'flex-1 overflow-y-auto p-5 space-y-4' });

    const fSubject = el('input', { type:'text', class:'w-full rounded-lg border border-stone-300 px-3 py-2 text-sm', value: existing?.subject || '' });
    const fDate = el('input', { type:'date', class:'w-full rounded-lg border border-stone-300 px-3 py-2 text-sm', value: existing?.meeting_date || '' });
    const fStart = el('input', { type:'text', class:'w-full rounded-lg border border-stone-300 px-3 py-2 text-sm', placeholder:'e.g. 14:00', value: existing?.start_time || '' });
    const fEnd = el('input', { type:'text', class:'w-full rounded-lg border border-stone-300 px-3 py-2 text-sm', placeholder:'e.g. 16:00', value: existing?.end_time || '' });
    const fMode = el('select', { class:'w-full rounded-lg border border-stone-300 px-3 py-2 text-sm bg-white' },
      el('option', { value:'Physical', selected: (existing?.mode || 'Physical') === 'Physical' ? '' : null }, 'In person'),
      el('option', { value:'Virtual', selected: existing?.mode === 'Virtual' ? '' : null }, 'Virtual'));

    const fAddress = el('input', { type:'text', class:'w-full rounded-lg border border-stone-300 px-3 py-2 text-sm', placeholder:'Physical address', value: existing?.address || '' });
    const fDirections = el('input', { type:'text', class:'w-full rounded-lg border border-stone-300 px-3 py-2 text-sm', placeholder:'Or paste a maps link (optional)', value: existing?.directions_link || '' });
    const fMeetingLink = el('input', { type:'text', class:'w-full rounded-lg border border-stone-300 px-3 py-2 text-sm', placeholder:'Virtual meeting link', value: existing?.meeting_link || '' });
    const physicalGroup = el('div', { class:'space-y-3' }, lab('Address', fAddress), lab('Directions link', fDirections),
      el('div', { class:'text-xs text-stone-500' }, 'If you enter an address and leave the link blank, a Google Maps directions link is created automatically.'));
    const virtualGroup = el('div', { class:'space-y-3' }, lab('Meeting link', fMeetingLink));
    function applyMode() { const v = fMode.value === 'Virtual'; physicalGroup.style.display = v ? 'none' : ''; virtualGroup.style.display = v ? '' : 'none'; }
    fMode.addEventListener('change', applyMode);

    const fSession = el('select', { class:'w-full rounded-lg border border-stone-300 px-3 py-2 text-sm bg-white' },
      el('option', { value:'' }, 'Stand alone meeting (not a production day)'),
      ...sessions.map(s => el('option', { value:s.id, selected: existing?.session_id === s.id ? '' : null }, s.name + (s.session_date ? ' · ' + fmtDate(s.session_date) : ''))));

    const fAgenda = el('textarea', { class:'w-full rounded-lg border border-stone-300 px-3 py-2 text-sm', rows:'4', placeholder:'One point per line' }, existing?.agenda || '');

    // Member multi-select (checkbox list)
    const memberBox = el('div', { class:'border border-stone-200 rounded-lg p-3 max-h-44 overflow-y-auto space-y-1' });
    const checks = {};
    let preInvited = [];
    members.forEach(m => {
      const cb = el('input', { type:'checkbox', class:'rounded' });
      checks[m.id] = cb;
      memberBox.appendChild(el('label', { class:'flex items-center gap-2 text-sm text-stone-700' }, cb, `${m.full_name}${m.role_name ? ' · ' + m.role_name : ''}`));
    });

    body.append(
      lab('Subject', fSubject),
      el('div', { class:'grid grid-cols-3 gap-3' }, lab('Date', fDate), lab('Start', fStart), lab('End', fEnd)),
      lab('Type', fMode),
      physicalGroup, virtualGroup,
      lab('Link to a production day (optional)', fSession),
      lab('Agenda', fAgenda),
      el('div', null, el('div', { class:'text-sm font-medium text-stone-700 mb-1' }, 'Invite members'), memberBox),
    );
    dialog.appendChild(body);
    applyMode();

    // If editing, load current invitees and tick them
    if (isEdit) {
      supabase.rpc('list_invitation_invitees', { p_invitation_id: existing.id }).then(({ data }) => {
        (data || []).forEach(r => { if (checks[r.user_id]) checks[r.user_id].checked = true; });
      });
    }

    const errBox = el('div', { class:'px-5 text-sm text-red-600', hidden:'' });
    dialog.appendChild(errBox);

    const saveBtn = el('button', { class:'px-4 py-2 text-sm rounded-lg bg-brand-500 hover:bg-brand-600 text-white font-medium' }, isEdit ? 'Save changes' : 'Create');
    saveBtn.addEventListener('click', async () => {
      errBox.hidden = true;
      if (!fSubject.value.trim()) { errBox.textContent = 'A subject is required'; errBox.hidden = false; return; }
      const memberIds = Object.keys(checks).filter(id => checks[id].checked);
      if (memberIds.length === 0) { errBox.textContent = 'Select at least one member to invite'; errBox.hidden = false; return; }
      const mode = fMode.value;
      let directions = fDirections.value.trim();
      if (mode === 'Physical' && !directions && fAddress.value.trim()) directions = mapsLink(fAddress.value.trim());
      saveBtn.disabled = true; saveBtn.textContent = 'Saving...';
      try {
        const { error } = await supabase.rpc('upsert_invitation', {
          p_id: existing?.id || null,
          p_subject: fSubject.value.trim(),
          p_meeting_date: fDate.value || null,
          p_start_time: fStart.value.trim() || null,
          p_end_time: fEnd.value.trim() || null,
          p_mode: mode,
          p_address: mode === 'Physical' ? (fAddress.value.trim() || null) : null,
          p_directions_link: mode === 'Physical' ? (directions || null) : null,
          p_meeting_link: mode === 'Virtual' ? (fMeetingLink.value.trim() || null) : null,
          p_agenda: fAgenda.value.trim() || null,
          p_session_id: fSession.value || null,
          p_member_ids: memberIds,
          p_project_id: projectId(),
        });
        if (error) throw error;
        toast(isEdit ? 'Invitation updated' : 'Invitation created as draft', 'success');
        overlay.remove(); reload();
      } catch (err) { errBox.textContent = err.message || 'Could not save'; errBox.hidden = false;
        saveBtn.disabled = false; saveBtn.textContent = isEdit ? 'Save changes' : 'Create'; }
    });

    dialog.appendChild(el('div', { class:'px-5 py-4 border-t border-stone-200 flex items-center justify-end gap-2' },
      el('button', { class:'px-4 py-2 text-sm rounded-lg hover:bg-stone-100', onclick:()=>overlay.remove() }, 'Cancel'),
      saveBtn));
    document.body.appendChild(overlay);
  }

  // ----- Detail (both manager and member) ---------------------------------
  async function openDetail(id) {
    const i = invites.find(x => x.id === id);
    if (!i) return;
    const [inviteesRes, aobRes] = await Promise.all([
      supabase.rpc('list_invitation_invitees', { p_invitation_id: id }),
      supabase.rpc('list_invitation_aob', { p_invitation_id: id }),
    ]);
    const invitees = inviteesRes.data || [];
    const aob = aobRes.data || [];

    const overlay = el('div', { class:'fixed inset-0 z-50 bg-stone-900/50 flex items-stretch sm:items-center justify-center p-0 sm:p-4' });
    const dialog  = el('div', { class:'bg-white w-full sm:max-w-xl sm:rounded-2xl shadow-xl max-h-[100vh] sm:max-h-[95vh] flex flex-col' });
    overlay.appendChild(dialog);
    dialog.appendChild(el('div', { class:'px-5 py-4 border-b border-stone-200 flex items-center justify-between' },
      el('div', null,
        el('h3', { class:'text-base font-semibold' }, i.subject),
        el('div', { class:'text-xs text-stone-500' }, fmtDate(i.meeting_date) + (i.start_time ? ' · ' + i.start_time : '') + (i.end_time ? ' to ' + i.end_time : ''))),
      el('button', { class:'text-stone-400 hover:text-stone-600 text-xl leading-none', onclick:()=>overlay.remove() }, '×')));

    const body = el('div', { class:'flex-1 overflow-y-auto p-5 space-y-4 text-sm' });

    // Location
    if (i.mode === 'Virtual') {
      body.appendChild(el('div', { class:'bg-stone-50 border border-stone-200 rounded-lg p-3' },
        el('div', { class:'font-medium text-stone-700' }, 'Virtual meeting'),
        i.meeting_link ? el('a', { href:i.meeting_link, target:'_blank', rel:'noopener noreferrer', class:'text-brand-600 hover:text-brand-700 break-all' }, i.meeting_link) : el('div', { class:'text-stone-500' }, 'Link to be confirmed')));
    } else {
      const loc = el('div', { class:'bg-stone-50 border border-stone-200 rounded-lg p-3' },
        el('div', { class:'font-medium text-stone-700' }, 'In person'));
      if (i.address) loc.appendChild(el('div', { class:'text-stone-700' }, i.address));
      if (i.directions_link) loc.appendChild(el('a', { href:i.directions_link, target:'_blank', rel:'noopener noreferrer', class:'text-brand-600 hover:text-brand-700' }, 'Get directions'));
      else if (i.address) loc.appendChild(el('a', { href:mapsLink(i.address), target:'_blank', rel:'noopener noreferrer', class:'text-brand-600 hover:text-brand-700' }, 'Get directions'));
      body.appendChild(loc);
    }

    // Agenda
    if (i.agenda) body.appendChild(el('div', null,
      el('div', { class:'font-medium text-stone-700 mb-1' }, 'Agenda'),
      el('div', { class:'text-stone-700 whitespace-pre-line' }, i.agenda)));

    // Member RSVP area (if I'm invited and it's not cancelled)
    if (i.am_invited && i.status !== 'Cancelled') {
      const rsvpBox = el('div', { class:'border-2 border-brand-200 bg-brand-50 rounded-xl p-4 space-y-3' });
      rsvpBox.appendChild(el('div', { class:'font-semibold text-stone-900' }, 'Your response'));
      const fRsvp = el('select', { class:'w-full rounded-lg border border-stone-300 px-3 py-2 text-sm bg-white' },
        el('option', { value:'' }, 'Select your availability'),
        ...RSVP_OPTIONS.map(o => el('option', { value:o, selected: i.my_rsvp === o ? '' : null }, o)));
      const fDiet = el('input', { type:'text', class:'w-full rounded-lg border border-stone-300 px-3 py-2 text-sm', placeholder:'Dietary requirements (optional)', value: i.my_dietary || '' });
      const saveResp = el('button', { class:'bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium px-4 py-2 rounded-lg' }, 'Save response');
      saveResp.addEventListener('click', async () => {
        if (!fRsvp.value) { toast('Select your availability', 'error'); return; }
        saveResp.disabled = true; saveResp.textContent = 'Saving...';
        try {
          const { error } = await supabase.rpc('respond_to_invitation', { p_invitation_id: i.id, p_rsvp_status: fRsvp.value, p_dietary: fDiet.value.trim() || null });
          if (error) throw error;
          toast('Response saved', 'success'); overlay.remove(); reload();
        } catch (err) { toast(err.message || 'Could not save', 'error'); saveResp.disabled = false; saveResp.textContent = 'Save response'; }
      });
      rsvpBox.append(lab('Availability', fRsvp), lab('Dietary requirements', fDiet), saveResp);
      body.appendChild(rsvpBox);
    }

    // Manager view of responses
    if (canManage()) {
      const respBox = el('div', null, el('div', { class:'font-medium text-stone-700 mb-1' }, 'Responses'));
      if (invitees.length === 0) respBox.appendChild(el('div', { class:'text-stone-500' }, 'No members invited.'));
      else invitees.forEach(r => respBox.appendChild(el('div', { class:'flex items-center justify-between gap-2 border-b border-stone-100 py-1.5' },
        el('div', { class:'min-w-0' },
          el('div', { class:'text-stone-800' }, r.full_name),
          r.dietary_requirements ? el('div', { class:'text-xs text-stone-500' }, 'Dietary: ' + r.dietary_requirements) : null),
        rsvpPill(r.rsvp_status))));
      body.appendChild(respBox);
    }

    // Any Other Business
    const aobBox = el('div', null, el('div', { class:'font-medium text-stone-700 mb-1' }, 'Any Other Business'));
    if (aob.length === 0) aobBox.appendChild(el('div', { class:'text-stone-500 text-xs' }, 'No points raised yet.'));
    else aob.forEach(a => aobBox.appendChild(el('div', { class:'border-b border-stone-100 py-1.5' },
      el('div', { class:'text-stone-800' }, a.point),
      el('div', { class:'text-xs text-stone-500' }, (a.by_name || 'Someone') + ' · ' + fmtDate(a.created_at)))));
    // Add AOB (invited members and managers)
    if ((i.am_invited || canManage()) && i.status !== 'Cancelled') {
      const fPoint = el('input', { type:'text', class:'flex-1 rounded-lg border border-stone-300 px-3 py-2 text-sm', placeholder:'Add a point' });
      const addBtn = el('button', { class:'bg-stone-900 hover:bg-stone-800 text-white text-sm px-4 py-2 rounded-lg shrink-0', onclick: async () => {
        if (!fPoint.value.trim()) return;
        try { const { error } = await supabase.rpc('add_invitation_aob', { p_invitation_id: i.id, p_point: fPoint.value.trim() }); if (error) throw error;
          toast('Point added', 'success'); overlay.remove(); openDetail(i.id);
        } catch (err) { toast(err.message || 'Could not add', 'error'); }
      }}, 'Add');
      aobBox.appendChild(el('div', { class:'flex items-center gap-2 mt-2' }, fPoint, addBtn));
    }
    body.appendChild(aobBox);
    dialog.appendChild(body);

    // Manager actions footer
    if (canManage()) {
      const footer = el('div', { class:'px-5 py-4 border-t border-stone-200 flex items-center justify-end gap-2 flex-wrap' });
      footer.appendChild(el('div', { class:'mr-auto flex items-center gap-2' },
        el('button', { class:'text-sm border border-stone-300 hover:bg-stone-50 px-4 py-2 rounded-lg', onclick: () => { overlay.remove(); openForm(i); } }, 'Edit'),
        el('button', { class:'text-sm border border-red-300 text-red-700 hover:bg-red-50 px-4 py-2 rounded-lg', onclick: async () => {
          if (!confirm('Delete this invitation?')) return;
          try { const { error } = await supabase.rpc('delete_invitation', { p_id: i.id }); if (error) throw error; toast('Deleted', 'success'); overlay.remove(); reload(); }
          catch (err) { toast(err.message || 'Failed', 'error'); }
        }}, 'Delete')));
      if (i.status === 'Draft') footer.appendChild(el('button', { class:'text-sm bg-brand-500 hover:bg-brand-600 text-white px-4 py-2 rounded-lg', onclick: async () => {
        try { const { error } = await supabase.rpc('send_invitation', { p_id: i.id }); if (error) throw error; toast('Invitation sent to members', 'success'); overlay.remove(); reload(); }
        catch (err) { toast(err.message || 'Failed', 'error'); }
      }}, 'Send to members'));
      if (i.status === 'Sent') footer.appendChild(el('button', { class:'text-sm border border-stone-300 hover:bg-stone-50 px-4 py-2 rounded-lg', onclick: async () => {
        if (!confirm('Cancel this invitation?')) return;
        try { const { error } = await supabase.rpc('cancel_invitation', { p_id: i.id }); if (error) throw error; toast('Cancelled', 'success'); overlay.remove(); reload(); }
        catch (err) { toast(err.message || 'Failed', 'error'); }
      }}, 'Cancel meeting'));
      dialog.appendChild(footer);
    }
    document.body.appendChild(overlay);
  }
})();
