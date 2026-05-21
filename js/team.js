// ============================================================================
// HymnDesk Control · Module 6 · Team Register
// ----------------------------------------------------------------------------
// Microsoft 365 Admin Centre style member management:
//   • Searchable, filterable list of all team members
//   • Add member (creates inactive account, no email sent)
//   • Edit member (any field)
//   • Invite member (sends Supabase Auth invitation through Resend)
//   • Deactivate / Reactivate
//   • Delete (refuses if member has financial history)
//   • Pending Invitations panel (resend, revoke)
//
// Exposes:  window.HD_Team.render(container)
// ============================================================================

(function () {
  'use strict';

  const TEAM = {};
  window.HD_Team = TEAM;

  // ----- Shared state ------------------------------------------------------
  let supabase = null;
  let roles = [];
  let contractStatuses = [];
  let departments = [];
  let forfeitureTypes = ['Full', 'Partial', 'Full or Partial'];
  let members = [];
  let invitations = [];
  let filterText = '';
  let filterRole = '';
  let filterActive = 'all';   // all | active | inactive | invited

  // Edge Function URL (set on first render)
  let edgeUrl = '';

  // ----- Tiny DOM helpers --------------------------------------------------
  function el(tag, attrs, ...children) {
    const e = document.createElement(tag);
    if (attrs) {
      for (const k of Object.keys(attrs)) {
        if (k === 'class') e.className = attrs[k];
        else if (k === 'html') e.innerHTML = attrs[k];
        else if (k.startsWith('on') && typeof attrs[k] === 'function') e.addEventListener(k.slice(2), attrs[k]);
        else if (attrs[k] !== undefined && attrs[k] !== null) e.setAttribute(k, attrs[k]);
      }
    }
    for (const c of children) {
      if (c == null) continue;
      e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    }
    return e;
  }
  const esc = (s) => String(s == null ? '' : s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');

  function toast(msg, kind = 'info') {
    const colors = {
      info:    'bg-stone-900 text-white',
      success: 'bg-emerald-600 text-white',
      error:   'bg-red-600 text-white',
    };
    const t = el('div', { class: `fixed bottom-4 left-1/2 -translate-x-1/2 z-50 ${colors[kind]} px-4 py-2 rounded-lg shadow-lg text-sm` });
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 3500);
  }

  async function withTimeout(promise, ms = 20000) {
    let timer;
    const timeout = new Promise((_, rej) => { timer = setTimeout(() => rej(new Error('Request timed out.')), ms); });
    try { return await Promise.race([promise, timeout]); } finally { clearTimeout(timer); }
  }


  // ----- Data load ---------------------------------------------------------
  async function loadAll() {
    const [rRes, csRes, deptRes, mRes, iRes] = await Promise.all([
      supabase.from('roles').select('id, name, sort_order').order('sort_order'),
      supabase.from('lookups').select('id, value').eq('domain', 'contract_status').eq('is_active', true).order('sort_order'),
      supabase.from('lookups').select('id, value').eq('domain', 'department').eq('is_active', true).order('sort_order'),
      supabase.rpc('list_team_members'),
      supabase.rpc('list_pending_invitations'),
    ]);
    if (rRes.error)   throw rRes.error;
    if (csRes.error)  throw csRes.error;
    if (deptRes.error) throw deptRes.error;
    if (mRes.error)   throw mRes.error;
    // invitations RPC is optional — if it fails we still render the rest
    roles            = rRes.data || [];
    contractStatuses = csRes.data || [];
    departments      = (deptRes.data || []).map(d => d.value);
    members          = mRes.data || [];
    invitations      = iRes.error ? [] : (iRes.data || []);
  }


  // ----- Edge Function call -----------------------------------------------
  async function callEdge(payload) {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) throw new Error('Session expired. Please sign in again.');
    const res = await withTimeout(fetch(edgeUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token,
      },
      body: JSON.stringify(payload),
    }));
    const j = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(j.error || ('Request failed (' + res.status + ')'));
    return j;
  }


  // ----- Filter / search ---------------------------------------------------
  function filteredMembers() {
    const q = filterText.trim().toLowerCase();
    return members.filter(m => {
      if (filterRole && m.role_id !== filterRole) return false;
      if (filterActive === 'active'   && !m.is_active)  return false;
      if (filterActive === 'inactive' && m.is_active)   return false;
      if (filterActive === 'invited'  && m.confirmed_status !== 'Invited') return false;
      if (q && !((m.full_name || '').toLowerCase().includes(q) ||
                 (m.email || '').toLowerCase().includes(q) ||
                 (m.role_name || '').toLowerCase().includes(q) ||
                 (m.department || '').toLowerCase().includes(q))) return false;
      return true;
    });
  }


  // ----- Render top-level page --------------------------------------------
  function render(container, opts) {
    supabase = opts.supabase;
    edgeUrl  = opts.edgeUrl;

    container.innerHTML = '';

    // Loading state
    const loading = el('div', { class: 'text-sm text-stone-500' }, 'Loading team...');
    container.appendChild(loading);

    loadAll().then(() => {
      container.innerHTML = '';
      container.appendChild(renderPage());
    }).catch(err => {
      container.innerHTML = '';
      container.appendChild(el('div', { class: 'bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 text-sm' },
        'Could not load team: ' + (err.message || err)));
    });
  }
  TEAM.render = render;


  function renderPage() {
    const wrap = el('div', { class: 'space-y-6' });

    // ---- Header strip ----
    const header = el('div', { class: 'flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3' },
      el('div', null,
        el('h2', { class: 'text-xl lg:text-2xl font-bold text-stone-900' }, 'Team Register'),
        el('p', { class: 'text-sm text-stone-500 mt-1' }, `${members.length} member${members.length === 1 ? '' : 's'}`),
      ),
      el('button', {
        class: 'inline-flex items-center gap-2 bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors',
        onclick: () => openMemberDialog(null),
      },
        el('span', { html: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>' }),
        document.createTextNode('Add member'),
      ),
    );
    wrap.appendChild(header);

    // ---- Filters bar ----
    const filters = el('div', { class: 'bg-white border border-stone-200 rounded-xl p-3 flex flex-col sm:flex-row gap-2' });

    const searchInput = el('input', {
      type: 'search',
      placeholder: 'Search by name, email, role or department',
      value: filterText,
      class: 'focus-ring flex-1 rounded-lg border border-stone-300 px-3 py-2 text-sm',
    });
    searchInput.addEventListener('input', (e) => { filterText = e.target.value; renderTable(); });

    const roleSelect = el('select', { class: 'focus-ring rounded-lg border border-stone-300 px-3 py-2 text-sm bg-white' },
      el('option', { value: '' }, 'All roles'),
      ...roles.map(r => el('option', { value: r.id, selected: r.id === filterRole ? '' : null }, r.name)),
    );
    roleSelect.addEventListener('change', (e) => { filterRole = e.target.value; renderTable(); });

    const activeSelect = el('select', { class: 'focus-ring rounded-lg border border-stone-300 px-3 py-2 text-sm bg-white' },
      el('option', { value: 'all' }, 'All statuses'),
      el('option', { value: 'active' }, 'Active'),
      el('option', { value: 'inactive' }, 'Inactive'),
      el('option', { value: 'invited' }, 'Invited (not signed in yet)'),
    );
    activeSelect.value = filterActive;
    activeSelect.addEventListener('change', (e) => { filterActive = e.target.value; renderTable(); });

    filters.append(searchInput, roleSelect, activeSelect);
    wrap.appendChild(filters);

    // ---- Members table ----
    const tableHost = el('div');
    wrap.appendChild(tableHost);

    function renderTable() {
      tableHost.innerHTML = '';
      const list = filteredMembers();
      if (list.length === 0) {
        tableHost.appendChild(el('div', { class: 'bg-white border border-stone-200 rounded-xl p-8 text-center text-sm text-stone-500' },
          members.length === 0
            ? 'No team members yet. Click "Add member" to get started.'
            : 'No members match the current filters.'));
        return;
      }

      // Desktop: table. Mobile: cards.
      const table = el('div', { class: 'hidden md:block bg-white border border-stone-200 rounded-xl overflow-hidden' });
      const thead = el('div', { class: 'grid grid-cols-12 gap-2 px-4 py-3 bg-stone-50 border-b border-stone-200 text-xs font-medium text-stone-500 uppercase tracking-wide' },
        el('div', { class: 'col-span-3' }, 'Name'),
        el('div', { class: 'col-span-3' }, 'Email'),
        el('div', { class: 'col-span-2' }, 'Role'),
        el('div', { class: 'col-span-2' }, 'Status'),
        el('div', { class: 'col-span-2 text-right' }, 'Actions'),
      );
      table.appendChild(thead);

      list.forEach(m => {
        const statusPill = m.is_active
          ? el('span', { class: 'inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5' }, 'Active')
          : (m.confirmed_status === 'Invited'
              ? el('span', { class: 'inline-flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5' }, 'Invited')
              : el('span', { class: 'inline-flex items-center gap-1 text-xs font-medium text-stone-600 bg-stone-100 border border-stone-200 rounded-full px-2 py-0.5' }, 'Inactive'));

        const row = el('div', { class: 'grid grid-cols-12 gap-2 px-4 py-3 border-b border-stone-100 last:border-b-0 hover:bg-stone-50 transition-colors items-center text-sm' },
          el('div', { class: 'col-span-3 font-medium text-stone-900 truncate' }, m.full_name || '—'),
          el('div', { class: 'col-span-3 text-stone-600 truncate' }, m.email),
          el('div', { class: 'col-span-2 text-stone-600 truncate' }, m.role_name || '—'),
          el('div', { class: 'col-span-2' }, statusPill),
          el('div', { class: 'col-span-2 flex items-center justify-end gap-1' },
            actionMenuButton(m),
          ),
        );
        table.appendChild(row);
      });
      tableHost.appendChild(table);

      // Mobile cards
      const cards = el('div', { class: 'md:hidden space-y-3' });
      list.forEach(m => {
        const card = el('div', { class: 'bg-white border border-stone-200 rounded-xl p-4' },
          el('div', { class: 'flex items-start justify-between gap-3' },
            el('div', { class: 'min-w-0 flex-1' },
              el('div', { class: 'font-medium text-stone-900 truncate' }, m.full_name || '—'),
              el('div', { class: 'text-xs text-stone-500 truncate' }, m.email),
            ),
            actionMenuButton(m),
          ),
          el('div', { class: 'mt-3 flex items-center gap-2 text-xs text-stone-600' },
            el('span', null, m.role_name || '—'),
            el('span', null, '·'),
            m.is_active
              ? el('span', { class: 'text-emerald-700' }, 'Active')
              : (m.confirmed_status === 'Invited'
                  ? el('span', { class: 'text-amber-700' }, 'Invited')
                  : el('span', { class: 'text-stone-500' }, 'Inactive'))
          ),
        );
        cards.appendChild(card);
      });
      tableHost.appendChild(cards);
    }
    renderTable();

    // ---- Pending invitations panel ----
    if (invitations.length > 0) {
      const inv = el('section', { class: 'space-y-3' },
        el('h3', { class: 'text-sm font-semibold text-stone-500 uppercase tracking-wide' }, 'Pending invitations'),
        el('div', { class: 'bg-white border border-stone-200 rounded-xl divide-y divide-stone-100' },
          ...invitations.map(i => el('div', { class: 'flex items-center justify-between gap-3 px-4 py-3 text-sm' },
            el('div', { class: 'min-w-0 flex-1' },
              el('div', { class: 'font-medium text-stone-900 truncate' }, i.full_name || i.email),
              el('div', { class: 'text-xs text-stone-500' },
                `Invited as ${i.role_name}. ` + (i.expired ? 'Expired.' : `Expires ${new Date(i.expires_at).toLocaleDateString()}.`)),
            ),
            el('div', { class: 'flex items-center gap-2' },
              el('button', {
                class: 'text-xs text-brand-600 hover:text-brand-700 font-medium',
                onclick: () => resendInvitation(i.id),
              }, 'Resend'),
              el('button', {
                class: 'text-xs text-red-600 hover:text-red-700 font-medium',
                onclick: () => revokeInvitation(i.id),
              }, 'Revoke'),
            ),
          )),
        ),
      );
      wrap.appendChild(inv);
    }

    return wrap;
  }


  // ----- Action menu button (per row) -------------------------------------
  function actionMenuButton(m) {
    const btn = el('button', {
      class: 'focus-ring p-1.5 rounded-lg hover:bg-stone-100 text-stone-500 hover:text-stone-900',
      'aria-label': 'Actions',
      html: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/></svg>',
    });
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      showActionMenu(btn, m);
    });
    return btn;
  }

  function showActionMenu(anchor, m) {
    document.querySelectorAll('.hd-action-menu').forEach(n => n.remove());
    const menu = el('div', { class: 'hd-action-menu absolute z-40 bg-white border border-stone-200 rounded-lg shadow-lg py-1 text-sm min-w-[180px]' });
    const items = [
      { label: 'Edit details',  onclick: () => openMemberDialog(m) },
      m.confirmed_status === 'Invited'
        ? { label: 'Resend invitation', onclick: () => inviteMember(m) }
        : { label: 'Send invitation',   onclick: () => inviteMember(m) },
      m.is_active
        ? { label: 'Deactivate', onclick: () => setActive(m, false), danger: false }
        : { label: 'Reactivate', onclick: () => setActive(m, true),  danger: false },
      { label: 'Delete', danger: true, onclick: () => deleteMember(m) },
    ];
    items.forEach(it => {
      const b = el('button', {
        class: `w-full text-left px-3 py-2 hover:bg-stone-100 ${it.danger ? 'text-red-600' : 'text-stone-700'}`,
        onclick: () => { menu.remove(); it.onclick(); },
      }, it.label);
      menu.appendChild(b);
    });

    const rect = anchor.getBoundingClientRect();
    menu.style.position = 'fixed';
    menu.style.top  = (rect.bottom + 4) + 'px';
    menu.style.left = Math.max(8, rect.right - 180) + 'px';
    document.body.appendChild(menu);

    setTimeout(() => {
      const close = (e) => {
        if (!menu.contains(e.target)) { menu.remove(); document.removeEventListener('click', close); }
      };
      document.addEventListener('click', close);
    }, 0);
  }


  // ----- Member add/edit dialog -------------------------------------------
  function openMemberDialog(existing) {
    const isEdit = !!existing;

    const overlay = el('div', { class: 'fixed inset-0 z-40 bg-stone-900/50 flex items-end sm:items-center justify-center p-0 sm:p-4' });
    const dialog = el('div', { class: 'bg-white w-full sm:max-w-2xl sm:rounded-2xl rounded-t-2xl shadow-xl max-h-[95vh] flex flex-col' });
    overlay.appendChild(dialog);

    const head = el('div', { class: 'px-5 py-4 border-b border-stone-200 flex items-center justify-between sticky top-0 bg-white sm:rounded-t-2xl rounded-t-2xl' },
      el('div', null,
        el('h3', { class: 'text-base font-semibold' }, isEdit ? 'Edit team member' : 'Add team member'),
        el('p', { class: 'text-xs text-stone-500 mt-0.5' }, isEdit ? esc(existing.email) : 'They will not be able to sign in until you send them an invitation.'),
      ),
      el('button', { class: 'p-1.5 rounded-lg hover:bg-stone-100', onclick: () => overlay.remove(),
        html: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="6" y1="6" x2="18" y2="18"/><line x1="6" y1="18" x2="18" y2="6"/></svg>' }),
    );
    dialog.appendChild(head);

    const body = el('div', { class: 'flex-1 overflow-y-auto p-5 space-y-4' });
    dialog.appendChild(body);

    // Build form fields
    const fld = (label, control, hint) => el('div', null,
      el('label', { class: 'block text-sm font-medium text-stone-700 mb-1' }, label),
      control,
      hint ? el('p', { class: 'text-xs text-stone-500 mt-1' }, hint) : null,
    );

    const fEmail = el('input', { type: 'email', required: '', autocomplete: 'off',
      class: 'focus-ring w-full rounded-lg border border-stone-300 px-3 py-2 text-sm',
      value: existing?.email || '',
      disabled: isEdit ? '' : null,
    });
    const fFullName = el('input', { type: 'text', required: '',
      class: 'focus-ring w-full rounded-lg border border-stone-300 px-3 py-2 text-sm',
      value: existing?.full_name || '',
    });
    const fPhone = el('input', { type: 'tel',
      class: 'focus-ring w-full rounded-lg border border-stone-300 px-3 py-2 text-sm',
      value: existing?.phone || '',
    });
    const fRole = el('select', { class: 'focus-ring w-full rounded-lg border border-stone-300 px-3 py-2 text-sm bg-white' },
      el('option', { value: '' }, 'Select a role...'),
      ...roles.map(r => el('option', { value: r.id, selected: existing?.role_id === r.id ? '' : null }, r.name)),
    );
    const fDept = el('select', { class: 'focus-ring w-full rounded-lg border border-stone-300 px-3 py-2 text-sm bg-white' },
      el('option', { value: '' }, '—'),
      ...departments.map(d => el('option', { value: d, selected: existing?.department === d ? '' : null }, d)),
    );
    const fContract = el('select', { class: 'focus-ring w-full rounded-lg border border-stone-300 px-3 py-2 text-sm bg-white' },
      el('option', { value: '' }, '—'),
      ...contractStatuses.map(c => el('option', { value: c.id, selected: existing?.contract_status_id === c.id ? '' : null }, c.value)),
    );
    const fRoyalty = el('input', { type: 'number', step: '0.01', min: '0', max: '100',
      class: 'focus-ring w-full rounded-lg border border-stone-300 px-3 py-2 text-sm',
      value: existing?.royalty_percent ?? 0,
    });
    const fForf = el('select', { class: 'focus-ring w-full rounded-lg border border-stone-300 px-3 py-2 text-sm bg-white' },
      ...forfeitureTypes.map(t => el('option', { value: t, selected: (existing?.forfeiture_type || 'Full or Partial') === t ? '' : null }, t)),
    );
    const fReason = el('textarea', { rows: '2',
      class: 'focus-ring w-full rounded-lg border border-stone-300 px-3 py-2 text-sm',
    }, existing?.royalty_reasoning || '');
    const fNotes = el('textarea', { rows: '2',
      class: 'focus-ring w-full rounded-lg border border-stone-300 px-3 py-2 text-sm',
    }, existing?.notes || '');

    body.append(
      el('div', { class: 'grid grid-cols-1 sm:grid-cols-2 gap-4' },
        fld('Email', fEmail, isEdit ? 'Email cannot be changed after creation.' : 'A login account is created at this email but no email is sent until you invite them.'),
        fld('Full name', fFullName),
      ),
      el('div', { class: 'grid grid-cols-1 sm:grid-cols-2 gap-4' },
        fld('Phone', fPhone),
        fld('Role', fRole),
      ),
      el('div', { class: 'grid grid-cols-1 sm:grid-cols-2 gap-4' },
        fld('Department', fDept),
        fld('Contract status', fContract),
      ),
      el('div', { class: 'grid grid-cols-1 sm:grid-cols-2 gap-4' },
        fld('Royalty percent', fRoyalty, 'e.g. 3.50 for 3.5 percent.'),
        fld('Forfeiture type', fForf),
      ),
      fld('Royalty reasoning', fReason, 'Optional. Why this percentage was chosen.'),
      fld('Internal notes', fNotes, 'Visible to Admin only.'),
    );

    const errBox = el('div', { class: 'text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3', hidden: '' });
    body.appendChild(errBox);

    const foot = el('div', { class: 'px-5 py-4 border-t border-stone-200 flex items-center justify-end gap-2 sticky bottom-0 bg-white' },
      el('button', { class: 'px-4 py-2 text-sm rounded-lg hover:bg-stone-100', onclick: () => overlay.remove() }, 'Cancel'),
      el('button', { class: 'px-4 py-2 text-sm rounded-lg bg-brand-500 hover:bg-brand-600 text-white font-medium', onclick: submit }, isEdit ? 'Save changes' : 'Create member'),
    );
    dialog.appendChild(foot);

    document.body.appendChild(overlay);
    fFullName.focus();

    async function submit(e) {
      e.preventDefault();
      errBox.hidden = true;
      const payload = {
        email:               fEmail.value.trim().toLowerCase(),
        full_name:           fFullName.value.trim(),
        phone:               fPhone.value.trim() || null,
        role_id:             fRole.value || null,
        department:          fDept.value || null,
        contract_status_id:  fContract.value || null,
        royalty_percent:     fRoyalty.value === '' ? 0 : Number(fRoyalty.value),
        forfeiture_type:     fForf.value || null,
        royalty_reasoning:   fReason.value.trim() || null,
        notes:               fNotes.value.trim() || null,
      };
      if (!payload.email || !payload.full_name || !payload.role_id) {
        errBox.textContent = 'Email, full name, and role are required.';
        errBox.hidden = false;
        return;
      }

      const submitBtn = foot.lastChild;
      submitBtn.disabled = true;
      submitBtn.textContent = 'Saving...';

      try {
        if (isEdit) {
          const { error } = await supabase.rpc('admin_update_team_member', {
            p_user_id:            existing.id,
            p_full_name:          payload.full_name,
            p_phone:              payload.phone,
            p_role_id:            payload.role_id,
            p_department:         payload.department,
            p_contract_status_id: payload.contract_status_id,
            p_royalty_percent:    payload.royalty_percent,
            p_forfeiture_type:    payload.forfeiture_type,
            p_royalty_reasoning:  payload.royalty_reasoning,
            p_notes:              payload.notes,
          });
          if (error) throw error;
          toast('Member updated', 'success');
        } else {
          await callEdge({ op: 'create_member', ...payload });
          toast('Member added', 'success');
        }
        overlay.remove();
        await reloadAndRefresh();
      } catch (err) {
        errBox.textContent = err.message || 'Could not save.';
        errBox.hidden = false;
        submitBtn.disabled = false;
        submitBtn.textContent = isEdit ? 'Save changes' : 'Create member';
      }
    }
  }


  // ----- Action handlers ---------------------------------------------------
  async function inviteMember(m) {
    if (!confirm(`Send an invitation email to ${m.full_name || m.email}?`)) return;
    try {
      await callEdge({ op: 'invite_member', user_id: m.id });
      toast('Invitation sent', 'success');
      await reloadAndRefresh();
    } catch (err) {
      toast(err.message || 'Could not send invitation', 'error');
    }
  }

  async function setActive(m, active) {
    const verb = active ? 'reactivate' : 'deactivate';
    if (!confirm(`Are you sure you want to ${verb} ${m.full_name || m.email}?`)) return;
    try {
      const { error } = await supabase.rpc('admin_set_team_member_active', { p_user_id: m.id, p_is_active: active });
      if (error) throw error;
      toast(active ? 'Member reactivated' : 'Member deactivated', 'success');
      await reloadAndRefresh();
    } catch (err) {
      toast(err.message || 'Could not update', 'error');
    }
  }

  async function deleteMember(m) {
    if (!confirm(`Delete ${m.full_name || m.email}? This cannot be undone. If they have any financial history, you will be prompted to deactivate instead.`)) return;
    try {
      const { error } = await supabase.rpc('admin_delete_team_member', { p_user_id: m.id });
      if (error) throw error;
      toast('Member deleted', 'success');
      await reloadAndRefresh();
    } catch (err) {
      toast(err.message || 'Could not delete', 'error');
    }
  }

  async function resendInvitation(invitation_id) {
    try {
      await callEdge({ op: 'resend_invitation', invitation_id });
      toast('Invitation resent', 'success');
      await reloadAndRefresh();
    } catch (err) {
      toast(err.message || 'Could not resend', 'error');
    }
  }

  async function revokeInvitation(invitation_id) {
    if (!confirm('Revoke this pending invitation?')) return;
    try {
      const { error } = await supabase.rpc('admin_revoke_invitation', { p_invitation_id: invitation_id });
      if (error) throw error;
      toast('Invitation revoked', 'success');
      await reloadAndRefresh();
    } catch (err) {
      toast(err.message || 'Could not revoke', 'error');
    }
  }


  async function reloadAndRefresh() {
    const container = document.getElementById('page-content');
    if (!container) return;
    container.innerHTML = '<div class="text-sm text-stone-500">Loading team...</div>';
    try {
      await loadAll();
      container.innerHTML = '';
      container.appendChild(renderPage());
    } catch (err) {
      container.innerHTML = '';
      container.appendChild(el('div', { class: 'bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 text-sm' },
        'Could not reload: ' + (err.message || err)));
    }
  }
})();
