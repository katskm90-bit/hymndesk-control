// ============================================================================
// HymnDesk Control · Inventory
// ----------------------------------------------------------------------------
// A register of equipment. Visible to Admin, Project Manager, Director /
// Producer, Videography / Editing Lead, and Sound Engineer. Only Admin and PM
// can add, edit, or delete; the others are view only.
//
// Fields adapt to the ownership type: owned shows purchase cost; rented shows
// rental amount, period and unit, return by date and source; borrowed shows
// return by date and source.
// ============================================================================

(function () {
  'use strict';
  const M = {}; window.HD_Inventory = M;
  let supabase = null, myRole = null, items = [], members = [];

  const CATEGORIES = ['Camera', 'Audio', 'Lighting', 'Cabling', 'Power', 'Staging', 'Computing', 'Storage', 'Other'];
  const CONDITIONS = ['Good', 'Fair', 'Needs repair', 'Out of service'];
  const OWNERSHIPS = ['Owned', 'Rented', 'Borrowed'];
  const UNITS = ['Hours', 'Days', 'Weeks', 'Months'];

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
  function money(n) { return 'R ' + Number(n||0).toLocaleString('en-ZA', { minimumFractionDigits:2, maximumFractionDigits:2 }); }
  function fmtDate(d) { return d ? new Date(d).toLocaleDateString('en-ZA', { year:'numeric', month:'short', day:'numeric' }) : '—'; }
  function projectId() { return window.HD_Project ? window.HD_Project.getId() : null; }
  function canManage() { return ['Admin','Project Manager'].includes(myRole); }

  async function loadAll() {
    const { data: { user } } = await supabase.auth.getUser();
    const [pRes, iRes, mRes] = await Promise.all([
      supabase.from('users').select('role:roles(name)').eq('id', user.id).maybeSingle(),
      supabase.rpc('list_inventory', { p_project_id: projectId() }),
      supabase.rpc('list_team_members'),
    ]);
    myRole = pRes.data?.role?.name || null;
    items = iRes.error ? [] : (iRes.data || []);
    members = mRes.error ? [] : (mRes.data || []);
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

  function ownershipPill(o) {
    const map = { Owned:'text-emerald-700 bg-emerald-50 border-emerald-200',
                  Rented:'text-amber-700 bg-amber-50 border-amber-200',
                  Borrowed:'text-blue-700 bg-blue-50 border-blue-200' };
    return el('span', { class:`inline-flex items-center text-xs font-medium border rounded-full px-2 py-0.5 ${map[o]||map.Owned}` }, o || 'Owned');
  }

  function renderList() {
    const wrap = el('div', { class:'space-y-5' });
    wrap.appendChild(el('div', { class:'flex items-start justify-between gap-3' },
      el('div', null,
        el('h2', { class:'text-xl lg:text-2xl font-bold text-stone-900' }, 'Inventory'),
        el('p', { class:'text-sm text-stone-500 mt-1' }, canManage() ? 'Equipment register. Add, edit, and track who holds each item.' : 'Equipment register. View only.')),
      canManage() ? el('button', { class:'bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium px-4 py-2 rounded-lg shrink-0',
        onclick: () => openForm() }, 'Add item') : null,
    ));

    if (items.length === 0) {
      wrap.appendChild(el('div', { class:'bg-white border border-stone-200 rounded-xl p-8 text-center text-sm text-stone-500' },
        canManage() ? 'No items yet. Add the first piece of equipment.' : 'No items in the register yet.'));
      return wrap;
    }

    // Group by category
    const byCat = {};
    items.forEach(i => { const c = i.category || 'Other'; (byCat[c] ||= []).push(i); });
    Object.keys(byCat).sort().forEach(cat => {
      const sec = el('div', { class:'space-y-2' });
      sec.appendChild(el('div', { class:'text-sm font-semibold text-stone-700' }, cat));
      byCat[cat].forEach(i => sec.appendChild(itemCard(i)));
      wrap.appendChild(sec);
    });
    return wrap;
  }

  function itemCard(i) {
    const meta = [];
    if (i.serial_number) meta.push('Serial ' + i.serial_number);
    if (i.condition) meta.push(i.condition);
    if (i.holder_display) meta.push('Held by ' + i.holder_display);
    if (i.ownership === 'Owned' && i.purchase_cost != null) meta.push('Cost ' + money(i.purchase_cost));
    if (i.ownership === 'Rented') {
      if (i.rental_amount != null) meta.push('Rental ' + money(i.rental_amount) + (i.rental_period ? ` for ${i.rental_period} ${(i.rental_unit||'').toLowerCase()}` : ''));
      if (i.source_name) meta.push('From ' + i.source_name);
      if (i.return_by) meta.push('Return by ' + fmtDate(i.return_by));
    }
    if (i.ownership === 'Borrowed') {
      if (i.source_name) meta.push('From ' + i.source_name);
      if (i.return_by) meta.push('Return by ' + fmtDate(i.return_by));
    }

    return el('div', { class:'bg-white border border-stone-200 rounded-xl p-4 flex items-start justify-between gap-3' },
      el('div', { class:'min-w-0' },
        el('div', { class:'flex items-center gap-2 flex-wrap' },
          el('span', { class:'font-medium text-stone-900' }, i.name),
          ownershipPill(i.ownership)),
        el('div', { class:'text-xs text-stone-500 mt-1' }, meta.join(' · ') || '—')),
      canManage() ? el('div', { class:'flex items-center gap-2 shrink-0' },
        el('button', { class:'text-xs text-brand-600 hover:text-brand-700', onclick: () => openForm(i) }, 'Edit'),
        el('button', { class:'text-xs text-red-600 hover:text-red-700', onclick: () => removeItem(i) }, 'Delete'),
      ) : null,
    );
  }

  async function removeItem(i) {
    if (!confirm(`Delete "${i.name}" from the inventory? This cannot be undone.`)) return;
    try { const { error } = await supabase.rpc('delete_inventory_item', { p_id: i.id }); if (error) throw error;
      toast('Item deleted', 'success'); reload();
    } catch (err) { toast(err.message || 'Could not delete', 'error'); }
  }

  function openForm(existing) {
    const isEdit = !!existing;
    const overlay = el('div', { class:'fixed inset-0 z-50 bg-stone-900/50 flex items-end sm:items-center justify-center p-0 sm:p-4' });
    const dialog  = el('div', { class:'bg-white w-full sm:max-w-xl sm:rounded-2xl rounded-t-2xl shadow-xl max-h-[95vh] flex flex-col' });
    overlay.appendChild(dialog);
    dialog.appendChild(el('div', { class:'px-5 py-4 border-b border-stone-200' },
      el('h3', { class:'text-base font-semibold' }, isEdit ? 'Edit item' : 'Add item')));

    const body = el('div', { class:'flex-1 overflow-y-auto p-5 space-y-4' });

    const fName = el('input', { type:'text', class:'w-full rounded-lg border border-stone-300 px-3 py-2 text-sm', value: existing?.name || '' });
    const fCategory = el('select', { class:'w-full rounded-lg border border-stone-300 px-3 py-2 text-sm bg-white' },
      el('option', { value:'' }, 'Select category'),
      ...CATEGORIES.map(c => el('option', { value:c, selected: existing?.category === c ? '' : null }, c)));
    const fCondition = el('select', { class:'w-full rounded-lg border border-stone-300 px-3 py-2 text-sm bg-white' },
      el('option', { value:'' }, 'Select condition'),
      ...CONDITIONS.map(c => el('option', { value:c, selected: existing?.condition === c ? '' : null }, c)));
    const fOwnership = el('select', { class:'w-full rounded-lg border border-stone-300 px-3 py-2 text-sm bg-white' },
      ...OWNERSHIPS.map(o => el('option', { value:o, selected: (existing?.ownership || 'Owned') === o ? '' : null }, o)));
    const fSerial = el('input', { type:'text', class:'w-full rounded-lg border border-stone-300 px-3 py-2 text-sm', value: existing?.serial_number || '' });

    // Holder: a team member or free text
    const fHolderMember = el('select', { class:'w-full rounded-lg border border-stone-300 px-3 py-2 text-sm bg-white' },
      el('option', { value:'' }, 'Not a team member / unassigned'),
      ...members.map(m => el('option', { value:m.id, selected: existing?.holder_user_id === m.id ? '' : null }, m.full_name)));
    const fHolderText = el('input', { type:'text', class:'w-full rounded-lg border border-stone-300 px-3 py-2 text-sm', placeholder:'Or type a name (if not a team member)', value: (!existing?.holder_user_id && existing?.holder_display) ? existing.holder_display : '' });

    // Conditional groups
    const fCost = el('input', { type:'number', step:'0.01', min:'0', class:'w-full rounded-lg border border-stone-300 px-3 py-2 text-sm', value: existing?.purchase_cost ?? '' });
    const ownedGroup = lab('Purchase cost (R)', fCost);

    const fRentAmount = el('input', { type:'number', step:'0.01', min:'0', class:'w-full rounded-lg border border-stone-300 px-3 py-2 text-sm', value: existing?.rental_amount ?? '' });
    const fRentPeriod = el('input', { type:'number', step:'1', min:'0', class:'w-full rounded-lg border border-stone-300 px-3 py-2 text-sm', value: existing?.rental_period ?? '' });
    const fRentUnit = el('select', { class:'w-full rounded-lg border border-stone-300 px-3 py-2 text-sm bg-white' },
      ...UNITS.map(u => el('option', { value:u, selected: existing?.rental_unit === u ? '' : null }, u)));
    const fReturnBy = el('input', { type:'date', class:'w-full rounded-lg border border-stone-300 px-3 py-2 text-sm', value: existing?.return_by || '' });
    const fSource = el('input', { type:'text', class:'w-full rounded-lg border border-stone-300 px-3 py-2 text-sm', value: existing?.source_name || '' });

    const rentedGroup = el('div', { class:'space-y-3' },
      el('div', { class:'grid grid-cols-3 gap-3' },
        lab('Rental amount (R)', fRentAmount), lab('Period', fRentPeriod), lab('Unit', fRentUnit)),
      lab('Rented from', fSource),
      lab('Return by', fReturnBy));

    const borrowedGroup = el('div', { class:'space-y-3' });
    const fSourceB = el('input', { type:'text', class:'w-full rounded-lg border border-stone-300 px-3 py-2 text-sm', value: existing?.source_name || '' });
    const fReturnByB = el('input', { type:'date', class:'w-full rounded-lg border border-stone-300 px-3 py-2 text-sm', value: existing?.return_by || '' });
    borrowedGroup.append(lab('Borrowed from', fSourceB), lab('Return by', fReturnByB));

    const fNotes = el('textarea', { class:'w-full rounded-lg border border-stone-300 px-3 py-2 text-sm', rows:'2' }, existing?.notes || '');

    function applyOwnership() {
      const o = fOwnership.value;
      ownedGroup.style.display    = o === 'Owned' ? '' : 'none';
      rentedGroup.style.display   = o === 'Rented' ? '' : 'none';
      borrowedGroup.style.display = o === 'Borrowed' ? '' : 'none';
    }
    fOwnership.addEventListener('change', applyOwnership);

    body.append(
      lab('Name', fName),
      el('div', { class:'grid grid-cols-2 gap-3' }, lab('Category', fCategory), lab('Condition', fCondition)),
      el('div', { class:'grid grid-cols-2 gap-3' }, lab('Ownership', fOwnership), lab('Serial number', fSerial)),
      lab('Current holder (team member)', fHolderMember),
      fHolderText,
      ownedGroup, rentedGroup, borrowedGroup,
      lab('Notes', fNotes),
    );
    dialog.appendChild(body);
    applyOwnership();

    const errBox = el('div', { class:'px-5 text-sm text-red-600', hidden:'' });
    dialog.appendChild(errBox);

    const saveBtn = el('button', { class:'px-4 py-2 text-sm rounded-lg bg-brand-500 hover:bg-brand-600 text-white font-medium' }, isEdit ? 'Save changes' : 'Add item');
    saveBtn.addEventListener('click', async () => {
      errBox.hidden = true;
      if (!fName.value.trim()) { errBox.textContent = 'A name is required'; errBox.hidden = false; return; }
      const o = fOwnership.value;
      saveBtn.disabled = true; saveBtn.textContent = 'Saving...';
      try {
        const source = o === 'Borrowed' ? fSourceB.value.trim() : fSource.value.trim();
        const returnBy = o === 'Borrowed' ? (fReturnByB.value || null) : (fReturnBy.value || null);
        const { error } = await supabase.rpc('upsert_inventory_item', {
          p_id: existing?.id || null,
          p_name: fName.value.trim(),
          p_category: fCategory.value || null,
          p_condition: fCondition.value || null,
          p_ownership: o,
          p_serial_number: fSerial.value.trim() || null,
          p_holder_user_id: fHolderMember.value || null,
          p_holder_name: fHolderMember.value ? null : (fHolderText.value.trim() || null),
          p_purchase_cost: o === 'Owned' && fCost.value !== '' ? Number(fCost.value) : null,
          p_rental_amount: o === 'Rented' && fRentAmount.value !== '' ? Number(fRentAmount.value) : null,
          p_rental_period: o === 'Rented' && fRentPeriod.value !== '' ? Number(fRentPeriod.value) : null,
          p_rental_unit: o === 'Rented' ? (fRentUnit.value || null) : null,
          p_return_by: returnBy,
          p_source_name: source || null,
          p_notes: fNotes.value.trim() || null,
          p_project_id: projectId(),
        });
        if (error) throw error;
        toast(isEdit ? 'Item updated' : 'Item added', 'success');
        overlay.remove(); reload();
      } catch (err) { errBox.textContent = err.message || 'Could not save'; errBox.hidden = false;
        saveBtn.disabled = false; saveBtn.textContent = isEdit ? 'Save changes' : 'Add item'; }
    });

    dialog.appendChild(el('div', { class:'px-5 py-4 border-t border-stone-200 flex items-center justify-end gap-2' },
      el('button', { class:'px-4 py-2 text-sm rounded-lg hover:bg-stone-100', onclick:()=>overlay.remove() }, 'Cancel'),
      saveBtn));
    document.body.appendChild(overlay);
  }
})();
