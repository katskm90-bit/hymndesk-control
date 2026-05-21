// ============================================================================
// HymnDesk Control · Module 5 · Production Schedule
// ----------------------------------------------------------------------------
// 8 production days: Mock Up, Rehearsal, Sessions 1-6. Each session has:
//   • Header details (date, times, hymn range, status)
//   • Call sheet (time-slot table)
//   • Equipment checklist
//   • Attendance register
// ============================================================================

(function () {
  'use strict';

  const M = {};
  window.HD_Sessions = M;

  let supabase = null;
  let sessions = [];
  let members  = [];
  let statuses = [];
  let myRole = null;

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
    const c = { info: 'bg-stone-900 text-white', success: 'bg-emerald-600 text-white', error: 'bg-red-600 text-white' };
    const t = el('div', { class: `fixed bottom-4 left-1/2 -translate-x-1/2 z-50 ${c[kind]} px-4 py-2 rounded-lg shadow-lg text-sm` });
    t.textContent = msg; document.body.appendChild(t); setTimeout(() => t.remove(), 3500);
  }
  function canManage() { return ['Admin','Project Manager','Director / Producer'].includes(myRole); }
  function canManageEquipment() { return ['Admin','Project Manager','Director / Producer','Videography / Editing Lead'].includes(myRole); }
  function fmtDate(d) { return d ? new Date(d).toLocaleDateString('en-ZA', { year:'numeric', month:'short', day:'numeric' }) : '—'; }
  function fmtTime(t) { return t ? t.slice(0,5) : '—'; }

  async function loadAll() {
    const { data: { user } } = await supabase.auth.getUser();
    const { data: prof } = await supabase.from('users').select('role:roles(name)').eq('id', user.id).maybeSingle();
    myRole = prof?.role?.name || null;
    const [sRes, mRes, stRes] = await Promise.all([
      supabase.rpc('list_sessions'),
      supabase.from('users').select('id, full_name').eq('is_active', true).order('full_name'),
      supabase.from('lookups').select('id, value, sort_order').eq('domain','workflow_state').eq('is_active',true).order('sort_order'),
    ]);
    if (sRes.error) throw sRes.error;
    sessions = sRes.data || [];
    members  = mRes.data || [];
    statuses = stRes.data || [];
  }

  M.render = function (container, opts) {
    supabase = opts.supabase;
    container.innerHTML = '<div class="text-sm text-stone-500">Loading schedule...</div>';
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
        el('h2', { class: 'text-xl lg:text-2xl font-bold text-stone-900' }, 'Production Schedule'),
        el('p', { class: 'text-sm text-stone-500 mt-1' }, `${sessions.length} session${sessions.length === 1 ? '' : 's'}`),
      ),
      canManage() ? el('button', {
        class: 'inline-flex items-center gap-2 bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium px-4 py-2 rounded-lg',
        onclick: () => openSessionDialog(null),
      }, '+ Add session') : null,
    ));

    if (sessions.length === 0) {
      wrap.appendChild(el('div', { class: 'bg-white border border-stone-200 rounded-xl p-8 text-center text-sm text-stone-500' },
        'No sessions scheduled yet.'));
      return wrap;
    }

    const list = el('div', { class: 'space-y-3' });
    sessions.forEach(s => list.appendChild(sessionCard(s)));
    wrap.appendChild(list);
    return wrap;
  }

  function sessionCard(s) {
    return el('div', {
      class: 'bg-white border border-stone-200 rounded-xl p-4 lg:p-5 cursor-pointer hover:border-brand-300',
      onclick: () => openSessionDetail(s),
    },
      el('div', { class: 'flex items-start justify-between gap-3' },
        el('div', { class: 'min-w-0 flex-1' },
          el('div', { class: 'flex items-center gap-2 text-xs text-stone-500' },
            s.session_number ? `Session ${s.session_number}` : s.session_type,
          ),
          el('h3', { class: 'text-base lg:text-lg font-semibold text-stone-900 mt-0.5' }, s.name),
          el('p', { class: 'text-xs text-stone-500 mt-1' },
            `${fmtDate(s.scheduled_date)}` +
            (s.shoot_start_time ? ` · Shoot ${fmtTime(s.shoot_start_time)}` : '') +
            (s.hymn_range_label ? ` · ${s.hymn_range_label}` : '')
          ),
        ),
        statusPill(s.status),
      ),
      el('div', { class: 'mt-3 flex flex-wrap items-center gap-3 text-xs text-stone-600' },
        statTile('Call sheet', s.call_sheet_items),
        statTile('Equipment', `${s.equipment_checked}/${s.equipment_items}`),
        statTile('Attendance', `${s.attendees_present}/${s.attendees_total}`),
        s.hymn_count ? statTile('Hymns', s.hymn_count) : null,
      ),
    );
  }
  function statTile(label, val) { return el('span', { class: 'inline-flex items-center gap-1.5 bg-stone-50 border border-stone-200 rounded-lg px-2 py-1' },
    el('span', { class: 'text-stone-500' }, label), el('span', { class: 'font-medium text-stone-900' }, String(val ?? 0))); }
  function statusPill(s) {
    const map = {
      'Edit Complete':'text-emerald-700 bg-emerald-50 border-emerald-200',
      'Uploaded to YouTube':'text-emerald-700 bg-emerald-50 border-emerald-200',
      'Edit In Progress':'text-blue-700 bg-blue-50 border-blue-200',
      'In Progress':'text-blue-700 bg-blue-50 border-blue-200',
      'Footage Uploaded':'text-indigo-700 bg-indigo-50 border-indigo-200',
      'Not Started':'text-stone-600 bg-stone-100 border-stone-200',
    };
    const cls = map[s] || 'text-stone-600 bg-stone-100 border-stone-200';
    return el('span', { class: `inline-flex items-center text-xs font-medium border rounded-full px-2 py-0.5 ${cls}` }, s || 'Not Started');
  }

  // ----- Add / Edit session dialog -----------------------------------------
  function openSessionDialog(existing) {
    const isEdit = !!existing;
    const overlay = el('div', { class: 'fixed inset-0 z-40 bg-stone-900/50 flex items-end sm:items-center justify-center p-0 sm:p-4' });
    const dialog  = el('div', { class: 'bg-white w-full sm:max-w-xl sm:rounded-2xl rounded-t-2xl shadow-xl max-h-[95vh] flex flex-col' });
    overlay.appendChild(dialog);

    dialog.appendChild(el('div', { class: 'px-5 py-4 border-b border-stone-200' },
      el('h3', { class: 'text-base font-semibold' }, isEdit ? 'Edit session' : 'New session')));

    const body = el('div', { class: 'flex-1 overflow-y-auto p-5 space-y-3' });

    const fType = el('select', { class: 'w-full rounded-lg border border-stone-300 px-3 py-2 text-sm bg-white' },
      ...['Session','Mock Up','Rehearsal','Other'].map(v => el('option', { value: v, selected: (existing?.session_type || 'Session') === v ? '' : null }, v)));
    const fNum = el('input', { type: 'number', class: 'w-full rounded-lg border border-stone-300 px-3 py-2 text-sm', value: existing?.session_number ?? '' });
    const fName = el('input', { type: 'text', required: '', class: 'w-full rounded-lg border border-stone-300 px-3 py-2 text-sm', value: existing?.name || '' });
    const fRange = el('input', { type: 'text', class: 'w-full rounded-lg border border-stone-300 px-3 py-2 text-sm', value: existing?.hymn_range_label || '' });
    const fCount = el('input', { type: 'number', class: 'w-full rounded-lg border border-stone-300 px-3 py-2 text-sm', value: existing?.hymn_count ?? 0 });
    const fDate = el('input', { type: 'date', class: 'w-full rounded-lg border border-stone-300 px-3 py-2 text-sm', value: existing?.scheduled_date || '' });
    const fSetup = el('input', { type: 'time', class: 'w-full rounded-lg border border-stone-300 px-3 py-2 text-sm', value: existing?.setup_time || '' });
    const fShoot = el('input', { type: 'time', class: 'w-full rounded-lg border border-stone-300 px-3 py-2 text-sm', value: existing?.shoot_start_time || '' });
    const fEdit = el('input', { type: 'date', class: 'w-full rounded-lg border border-stone-300 px-3 py-2 text-sm', value: existing?.edit_deadline || '' });
    const fUpload = el('input', { type: 'date', class: 'w-full rounded-lg border border-stone-300 px-3 py-2 text-sm', value: existing?.upload_date || '' });
    const fStatus = el('select', { class: 'w-full rounded-lg border border-stone-300 px-3 py-2 text-sm bg-white' },
      el('option', { value: '' }, '—'),
      ...statuses.map(st => el('option', { value: st.id, selected: st.id === existing?.status_lookup_id ? '' : null }, st.value)));
    const fNotes = el('textarea', { rows: '2', class: 'w-full rounded-lg border border-stone-300 px-3 py-2 text-sm' }, existing?.notes || '');
    const errBox = el('div', { class: 'text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3', hidden: '' });

    body.append(
      el('div', { class: 'grid grid-cols-2 gap-3' }, lab('Type', fType), lab('Number', fNum)),
      lab('Name', fName),
      el('div', { class: 'grid grid-cols-2 gap-3' }, lab('Hymn range label', fRange), lab('Hymn count', fCount)),
      el('div', { class: 'grid grid-cols-3 gap-3' }, lab('Scheduled date', fDate), lab('Setup time', fSetup), lab('Shoot start', fShoot)),
      el('div', { class: 'grid grid-cols-2 gap-3' }, lab('Edit deadline', fEdit), lab('Upload date', fUpload)),
      lab('Status', fStatus),
      lab('Notes', fNotes),
      errBox,
    );
    dialog.appendChild(body);

    const submitBtn = el('button', { class: 'px-4 py-2 text-sm rounded-lg bg-brand-500 hover:bg-brand-600 text-white font-medium' }, isEdit ? 'Save' : 'Create');
    submitBtn.addEventListener('click', async () => {
      errBox.hidden = true;
      if (!fName.value.trim()) { errBox.textContent = 'Session name required'; errBox.hidden = false; return; }
      submitBtn.disabled = true; submitBtn.textContent = 'Saving...';
      try {
        const { error } = await supabase.rpc('upsert_session', {
          p_id: existing?.id || null,
          p_session_number: fNum.value === '' ? null : Number(fNum.value),
          p_session_type:   fType.value,
          p_name:           fName.value.trim(),
          p_hymn_range_label: fRange.value.trim() || null,
          p_hymn_count:     fCount.value === '' ? 0 : Number(fCount.value),
          p_scheduled_date: fDate.value || null,
          p_setup_time:     fSetup.value || null,
          p_shoot_start_time: fShoot.value || null,
          p_edit_deadline:  fEdit.value || null,
          p_upload_date:    fUpload.value || null,
          p_status_lookup_id: fStatus.value || null,
          p_notes:          fNotes.value.trim() || null,
          p_sort_order:     existing?.sort_order ?? sessions.length + 1,
        });
        if (error) throw error;
        toast(isEdit ? 'Session saved' : 'Session created', 'success');
        overlay.remove(); reload();
      } catch (err) { errBox.textContent = err.message || 'Could not save'; errBox.hidden = false;
        submitBtn.disabled = false; submitBtn.textContent = isEdit ? 'Save' : 'Create'; }
    });

    dialog.appendChild(el('div', { class: 'px-5 py-4 border-t border-stone-200 flex items-center justify-between' },
      (canManage() && isEdit) ? el('button', { class: 'text-sm text-red-600 hover:text-red-700', onclick: async () => {
        if (!confirm(`Delete session "${existing.name}"? This also removes its call sheet, equipment and attendance.`)) return;
        try {
          const { error } = await supabase.rpc('delete_session', { p_id: existing.id });
          if (error) throw error;
          overlay.remove(); toast('Session deleted', 'success'); reload();
        } catch (err) { toast(err.message || 'Could not delete', 'error'); }
      }}, 'Delete') : el('span'),
      el('div', { class: 'flex items-center gap-2' },
        el('button', { class: 'px-4 py-2 text-sm rounded-lg hover:bg-stone-100', onclick: () => overlay.remove() }, 'Cancel'),
        submitBtn,
      ),
    ));
    document.body.appendChild(overlay);
    fName.focus();
  }

  // ----- Detail drawer (call sheet, equipment, attendance) -----------------
  async function openSessionDetail(s) {
    const overlay = el('div', { class: 'fixed inset-0 z-40 bg-stone-900/50 flex items-end sm:items-center justify-center p-0 sm:p-4' });
    const dialog  = el('div', { class: 'bg-white w-full sm:max-w-3xl sm:rounded-2xl rounded-t-2xl shadow-xl max-h-[95vh] flex flex-col' });
    overlay.appendChild(dialog);

    const head = el('div', { class: 'px-5 py-4 border-b border-stone-200 flex items-start justify-between' },
      el('div', null,
        el('h3', { class: 'text-base font-semibold' }, s.name),
        el('p', { class: 'text-xs text-stone-500 mt-1' }, `${fmtDate(s.scheduled_date)} · ${s.hymn_range_label || ''}`),
      ),
      el('div', { class: 'flex items-center gap-2' },
        canManage() ? el('button', { class: 'text-xs px-3 py-1.5 rounded-lg hover:bg-stone-100', onclick: () => { overlay.remove(); openSessionDialog(s); } }, 'Edit') : null,
        el('button', { class: 'p-1.5 rounded-lg hover:bg-stone-100',
          html: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="6" y1="6" x2="18" y2="18"/><line x1="6" y1="18" x2="18" y2="6"/></svg>',
          onclick: () => overlay.remove() }),
      ),
    );
    dialog.appendChild(head);

    // Tabs
    const tabs = el('div', { class: 'flex items-center gap-1 px-5 pt-3 border-b border-stone-200 sticky top-0 bg-white' });
    const body = el('div', { class: 'flex-1 overflow-y-auto p-5' });
    dialog.append(tabs, body);

    let activeTab = 'call_sheet';
    const tabButton = (key, label) => {
      const b = el('button', { class: `px-3 py-2 text-sm font-medium border-b-2 ${activeTab === key ? 'border-brand-500 text-brand-700' : 'border-transparent text-stone-500 hover:text-stone-900'}` }, label);
      b.addEventListener('click', () => { activeTab = key; renderTabs(); });
      return b;
    };
    function renderTabs() {
      tabs.innerHTML = '';
      tabs.append(tabButton('call_sheet','Call sheet'), tabButton('equipment','Equipment'), tabButton('attendance','Attendance'));
      body.innerHTML = '<div class="text-sm text-stone-500">Loading...</div>';
      if (activeTab === 'call_sheet') renderCallSheet(s, body);
      else if (activeTab === 'equipment') renderEquipment(s, body);
      else renderAttendance(s, body);
    }
    renderTabs();
    document.body.appendChild(overlay);
  }

  async function renderCallSheet(s, body) {
    const { data, error } = await supabase.from('session_call_sheet_items')
      .select('id, sort_order, time_slot, activity, responsible_user_id, notes')
      .eq('session_id', s.id).order('sort_order');
    if (error) { body.innerHTML = ''; body.appendChild(el('div', { class: 'text-sm text-red-600' }, error.message)); return; }

    body.innerHTML = '';
    const items = data || [];
    if (items.length === 0) {
      body.appendChild(el('div', { class: 'text-sm text-stone-500 text-center py-6' }, 'No call sheet items yet.'));
    } else {
      const table = el('div', { class: 'border border-stone-200 rounded-xl overflow-hidden' });
      table.appendChild(el('div', { class: 'grid grid-cols-12 gap-2 px-3 py-2 bg-stone-50 border-b border-stone-200 text-xs font-medium text-stone-500 uppercase' },
        el('div', { class: 'col-span-3' }, 'Time'), el('div', { class: 'col-span-6' }, 'Activity'), el('div', { class: 'col-span-3' }, 'Responsible')));
      items.forEach(it => {
        const member = members.find(m => m.id === it.responsible_user_id);
        const row = el('div', { class: 'grid grid-cols-12 gap-2 px-3 py-2 border-b border-stone-100 last:border-b-0 text-sm items-center' },
          el('div', { class: 'col-span-3 text-stone-700' }, it.time_slot || '—'),
          el('div', { class: 'col-span-6 text-stone-900' }, it.activity),
          el('div', { class: 'col-span-3 flex items-center justify-between gap-2' },
            el('span', { class: 'text-stone-600 truncate' }, member?.full_name || '—'),
            canManage() ? el('button', { class: 'text-xs text-red-600', onclick: async () => {
              if (!confirm('Delete this row?')) return;
              const { error } = await supabase.rpc('delete_call_sheet_item', { p_id: it.id });
              if (error) toast(error.message || 'Failed', 'error'); else renderCallSheet(s, body);
            }}, '✕') : null,
          ));
        table.appendChild(row);
      });
      body.appendChild(table);
    }

    if (canManage()) {
      body.appendChild(el('div', { class: 'mt-4 flex items-center justify-end' },
        el('button', { class: 'text-sm bg-brand-500 hover:bg-brand-600 text-white px-3 py-1.5 rounded-lg',
          onclick: () => openCallSheetItem(s, null, body) }, '+ Add row')));
    }
  }

  function openCallSheetItem(s, existing, body) {
    const overlay = el('div', { class: 'fixed inset-0 z-50 bg-stone-900/50 flex items-center justify-center p-4' });
    const dlg = el('div', { class: 'bg-white rounded-2xl shadow-xl w-full max-w-md p-5 space-y-3' });
    const fTime = el('input', { type: 'text', placeholder: 'e.g. 08:00 - 08:30', class: 'w-full rounded-lg border border-stone-300 px-3 py-2 text-sm', value: existing?.time_slot || '' });
    const fAct  = el('input', { type: 'text', class: 'w-full rounded-lg border border-stone-300 px-3 py-2 text-sm', value: existing?.activity || '' });
    const fResp = el('select', { class: 'w-full rounded-lg border border-stone-300 px-3 py-2 text-sm bg-white' },
      el('option', { value: '' }, 'Unassigned'),
      ...members.map(m => el('option', { value: m.id, selected: m.id === existing?.responsible_user_id ? '' : null }, m.full_name)));
    const fOrder = el('input', { type: 'number', class: 'w-full rounded-lg border border-stone-300 px-3 py-2 text-sm', value: existing?.sort_order ?? 99 });
    dlg.append(
      el('h4', { class: 'font-semibold' }, 'Call sheet row'),
      lab('Time slot', fTime), lab('Activity', fAct), lab('Responsible', fResp), lab('Sort order', fOrder),
      el('div', { class: 'flex items-center justify-end gap-2' },
        el('button', { class: 'px-4 py-2 text-sm rounded-lg hover:bg-stone-100', onclick: () => overlay.remove() }, 'Cancel'),
        el('button', { class: 'px-4 py-2 text-sm rounded-lg bg-brand-500 hover:bg-brand-600 text-white font-medium', onclick: async () => {
          if (!fAct.value.trim()) return;
          const { error } = await supabase.rpc('upsert_call_sheet_item', {
            p_id: existing?.id || null, p_session_id: s.id,
            p_sort_order: Number(fOrder.value) || 0,
            p_time_slot: fTime.value || null, p_activity: fAct.value.trim(),
            p_responsible_user_id: fResp.value || null, p_status_lookup_id: null,
            p_notes: null,
          });
          if (error) toast(error.message || 'Failed', 'error');
          else { overlay.remove(); renderCallSheet(s, body); }
        }}, 'Save'),
      ),
    );
    overlay.appendChild(dlg); document.body.appendChild(overlay);
  }

  async function renderEquipment(s, body) {
    const { data, error } = await supabase.from('session_equipment')
      .select('id, item_name, quantity, checked, notes')
      .eq('session_id', s.id).order('item_name');
    if (error) { body.innerHTML = ''; body.appendChild(el('div', { class: 'text-sm text-red-600' }, error.message)); return; }
    body.innerHTML = '';

    const items = data || [];
    if (items.length === 0) {
      body.appendChild(el('div', { class: 'text-sm text-stone-500 text-center py-6' }, 'No equipment items yet.'));
    } else {
      const list = el('div', { class: 'border border-stone-200 rounded-xl divide-y divide-stone-100' });
      items.forEach(it => {
        const cb = el('input', { type: 'checkbox', class: 'rounded', checked: it.checked ? '' : null, disabled: canManageEquipment() ? null : '' });
        cb.addEventListener('change', async () => {
          const { error } = await supabase.rpc('upsert_equipment_item', {
            p_id: it.id, p_session_id: s.id, p_item_name: it.item_name, p_quantity: it.quantity, p_checked: cb.checked, p_notes: it.notes,
          });
          if (error) { toast(error.message || 'Failed', 'error'); cb.checked = it.checked; }
          else renderEquipment(s, body);
        });
        list.appendChild(el('div', { class: 'flex items-center gap-3 px-3 py-2' },
          cb,
          el('div', { class: 'flex-1 min-w-0' },
            el('div', { class: `text-sm ${it.checked ? 'text-stone-400 line-through' : 'text-stone-900'}` }, it.item_name),
            el('div', { class: 'text-xs text-stone-500' }, `Qty ${it.quantity}` + (it.notes ? ' · ' + it.notes : '')),
          ),
          canManageEquipment() ? el('button', { class: 'text-xs text-red-600', onclick: async () => {
            if (!confirm('Remove this item?')) return;
            const { error } = await supabase.rpc('delete_equipment_item', { p_id: it.id });
            if (error) toast(error.message || 'Failed', 'error'); else renderEquipment(s, body);
          }}, '✕') : null,
        ));
      });
      body.appendChild(list);
    }

    if (canManageEquipment()) {
      const addBar = el('div', { class: 'mt-4 flex items-center gap-2' });
      const fName = el('input', { type: 'text', placeholder: 'New item name', class: 'flex-1 rounded-lg border border-stone-300 px-3 py-2 text-sm' });
      const fQty  = el('input', { type: 'number', placeholder: 'Qty', value: 1, class: 'w-20 rounded-lg border border-stone-300 px-3 py-2 text-sm' });
      const btn = el('button', { class: 'text-sm bg-brand-500 hover:bg-brand-600 text-white px-3 py-1.5 rounded-lg', onclick: async () => {
        if (!fName.value.trim()) return;
        const { error } = await supabase.rpc('upsert_equipment_item', {
          p_id: null, p_session_id: s.id, p_item_name: fName.value.trim(), p_quantity: Number(fQty.value) || 1, p_checked: false, p_notes: null,
        });
        if (error) toast(error.message || 'Failed', 'error'); else { fName.value = ''; renderEquipment(s, body); }
      }}, 'Add');
      addBar.append(fName, fQty, btn);
      body.appendChild(addBar);
    }
  }

  async function renderAttendance(s, body) {
    const { data, error } = await supabase.rpc('list_session_attendance', { p_session_id: s.id });
    if (error) { body.innerHTML = ''; body.appendChild(el('div', { class: 'text-sm text-red-600' }, error.message)); return; }
    body.innerHTML = '';
    const rows = data || [];
    if (rows.length === 0) {
      body.appendChild(el('div', { class: 'text-sm text-stone-500 text-center py-6' }, 'No active team members.'));
      return;
    }
    const list = el('div', { class: 'border border-stone-200 rounded-xl divide-y divide-stone-100' });
    rows.forEach(r => {
      const cbPresent = el('input', { type: 'checkbox', class: 'rounded', checked: r.present ? '' : null, disabled: canManage() ? null : '' });
      const cbForfeit = el('input', { type: 'checkbox', class: 'rounded', checked: r.forfeit ? '' : null, disabled: canManage() ? null : '' });
      const fReason = el('input', { type: 'text', placeholder: 'Reason (if forfeit)', class: 'w-44 rounded-lg border border-stone-300 px-2 py-1 text-xs', value: r.forfeit_reason || '', disabled: canManage() ? null : '' });
      const update = async () => {
        const { error } = await supabase.rpc('set_session_attendance', {
          p_session_id: s.id, p_user_id: r.user_id,
          p_present: cbPresent.checked, p_forfeit: cbForfeit.checked,
          p_forfeit_reason: fReason.value || null,
        });
        if (error) toast(error.message || 'Failed', 'error');
      };
      cbPresent.addEventListener('change', update);
      cbForfeit.addEventListener('change', update);
      fReason.addEventListener('blur', update);

      list.appendChild(el('div', { class: 'flex items-center gap-3 px-3 py-2 text-sm' },
        el('div', { class: 'flex-1 min-w-0' },
          el('div', { class: 'text-stone-900 truncate' }, r.full_name),
          el('div', { class: 'text-xs text-stone-500' }, r.role_name || '—'),
        ),
        el('label', { class: 'flex items-center gap-1 text-xs' }, cbPresent, 'Present'),
        el('label', { class: 'flex items-center gap-1 text-xs' }, cbForfeit, 'Forfeit'),
        fReason,
      ));
    });
    body.appendChild(list);
  }

  function lab(t, ctrl) { return el('div', null, el('label', { class: 'block text-sm font-medium text-stone-700 mb-1' }, t), ctrl); }

  async function reload() {
    const main = document.getElementById('page-content');
    if (!main) return;
    main.innerHTML = '<div class="text-sm text-stone-500">Loading schedule...</div>';
    try { await loadAll(); main.innerHTML = ''; main.appendChild(renderPage()); }
    catch (err) {
      main.innerHTML = '';
      main.appendChild(el('div', { class: 'bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 text-sm' }, 'Could not load: ' + (err.message || err)));
    }
  }
})();
