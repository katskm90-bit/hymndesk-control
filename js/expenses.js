// ============================================================================
// HymnDesk Control · Module 8 · Member Expenses
// ----------------------------------------------------------------------------
// Members claim reimbursable expenses. Finance and Admin approve, reject, or
// mark as paid. Members see their own claims; Finance/Admin/PM see all.
// ============================================================================

(function () {
  'use strict';

  const M = {};
  window.HD_Expenses = M;

  let supabase = null;
  let myRole = null;
  let myUserId = null;
  let expenses = [];
  let receiptCounts = {};
  let phases = [];
  let summary = null;
  let filterStatus = '';
  let mineOnly = false;

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
  function isFinance() { return ['Admin','Finance'].includes(myRole); }
  function projectId() { return window.HD_Project ? window.HD_Project.getId() : null; }

  async function loadAll() {
    const { data: { user } } = await supabase.auth.getUser();
    myUserId = user.id;
    const { data: prof } = await supabase.from('users').select('role:roles(name)').eq('id', user.id).maybeSingle();
    myRole = prof?.role?.name || null;
    const pid = projectId();
    const [eRes, phRes, sumRes, rcRes] = await Promise.all([
      supabase.rpc('list_expenses', { p_project_id: pid, p_status: filterStatus || null, p_mine_only: mineOnly }),
      supabase.rpc('list_phases', { p_project_id: pid }),
      supabase.rpc('expense_summary', { p_project_id: pid }),
      supabase.rpc('expense_receipt_counts', { p_project_id: pid }),
    ]);
    if (eRes.error) throw eRes.error;
    expenses = eRes.data || [];
    phases   = phRes.data || [];
    summary  = sumRes.data || null;
    receiptCounts = {};
    if (!rcRes.error) (rcRes.data || []).forEach(r => { receiptCounts[r.expense_id] = r.receipt_count; });
  }

  M.render = function (container, opts) {
    supabase = opts.supabase;
    container.innerHTML = '<div class="text-sm text-stone-500">Loading expenses...</div>';
    loadAll().then(() => { container.innerHTML = ''; container.appendChild(renderPage()); })
             .catch(err => { container.innerHTML = '';
               container.appendChild(el('div', { class:'bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 text-sm' }, 'Could not load: ' + (err.message || err))); });
  };

  function renderPage() {
    const wrap = el('div', { class:'space-y-6' });

    wrap.appendChild(el('div', { class:'flex items-center justify-between gap-3' },
      el('div', null,
        el('h2', { class:'text-xl lg:text-2xl font-bold text-stone-900' }, 'Member Expenses'),
        el('p', { class:'text-sm text-stone-500 mt-1' }, `${expenses.length} claim${expenses.length === 1 ? '' : 's'}`),
      ),
      el('button', {
        class:'inline-flex items-center gap-2 bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium px-4 py-2 rounded-lg',
        onclick: () => openClaimDialog(null),
      }, '+ New claim'),
    ));

    // Summary (Finance/Admin/PM see totals)
    if (summary && isFinance()) {
      wrap.appendChild(el('div', { class:'grid grid-cols-2 sm:grid-cols-4 gap-3' },
        tile('Claimed', money(summary.claimed_total), summary.claimed_count),
        tile('Approved', money(summary.approved_total), summary.approved_count, 'amber'),
        tile('Paid', money(summary.paid_total), summary.paid_count, 'green'),
        tile('Rejected', '', summary.rejected_count, 'stone'),
      ));
    }

    // Filters
    const filters = el('div', { class:'flex flex-wrap items-center gap-2' });
    ['', 'Claimed', 'Approved', 'Paid', 'Rejected'].forEach(st => {
      const active = filterStatus === st;
      filters.appendChild(el('button', {
        class:`text-xs px-3 py-1.5 rounded-full border ${active ? 'bg-brand-50 border-brand-300 text-brand-700' : 'bg-white border-stone-300 hover:bg-stone-50'}`,
        onclick: () => { filterStatus = st; reload(); },
      }, st || 'All'));
    });
    if (isFinance()) {
      filters.appendChild(el('label', { class:'flex items-center gap-1.5 text-xs text-stone-600 ml-2' },
        (() => { const cb = el('input', { type:'checkbox', class:'rounded', checked: mineOnly ? '' : null });
          cb.addEventListener('change', () => { mineOnly = cb.checked; reload(); }); return cb; })(),
        'Only mine'));
    }
    wrap.appendChild(filters);

    if (expenses.length === 0) {
      wrap.appendChild(el('div', { class:'bg-white border border-stone-200 rounded-xl p-8 text-center text-sm text-stone-500' },
        'No expense claims to show.'));
      return wrap;
    }

    const list = el('div', { class:'space-y-3' });
    expenses.forEach(e => list.appendChild(expenseCard(e)));
    wrap.appendChild(list);
    return wrap;
  }

  function tile(label, value, count, tone) {
    const tones = { amber:'text-amber-700 bg-amber-50 border-amber-200', green:'text-emerald-700 bg-emerald-50 border-emerald-200', stone:'bg-stone-50 border-stone-200' };
    const cls = tones[tone] || 'bg-white border-stone-200';
    return el('div', { class:`border ${cls} rounded-xl p-3` },
      el('div', { class:'text-xs text-stone-500' }, label + (count != null ? ` (${count})` : '')),
      value ? el('div', { class:'text-base font-semibold mt-0.5' }, value) : el('div', { class:'text-base font-semibold mt-0.5' }, String(count || 0)));
  }

  function statusPill(s) {
    const map = {
      'Claimed':'text-blue-700 bg-blue-50 border-blue-200',
      'Approved':'text-amber-700 bg-amber-50 border-amber-200',
      'Paid':'text-emerald-700 bg-emerald-50 border-emerald-200',
      'Rejected':'text-red-700 bg-red-50 border-red-200',
    };
    const cls = map[s] || 'text-stone-600 bg-stone-100 border-stone-200';
    return el('span', { class:`inline-flex items-center text-xs font-medium border rounded-full px-2 py-0.5 ${cls}` }, s || '—');
  }

  function expenseCard(e) {
    const mine = e.user_id === myUserId;
    const canActOnIt = isFinance();
    const canEditClaim = mine && e.status === 'Claimed';
    const canDeleteIt = (mine && e.status === 'Claimed') || myRole === 'Admin';

    const card = el('div', { class:'bg-white border border-stone-200 rounded-xl p-4' },
      el('div', { class:'flex items-start justify-between gap-3' },
        el('div', { class:'min-w-0 flex-1' },
          el('div', { class:'flex items-center gap-2' },
            el('span', { class:'font-medium text-stone-900 truncate' }, e.description),
          ),
          el('div', { class:'text-xs text-stone-500 mt-0.5' },
            [e.user_name, fmtDate(e.expense_date), e.category, e.phase_name].filter(Boolean).join(' · ')),
          e.rejection_reason ? el('div', { class:'text-xs text-red-600 mt-1' }, 'Rejected: ' + e.rejection_reason) : null,
          e.payment_reference ? el('div', { class:'text-xs text-emerald-700 mt-1' }, 'Paid ref: ' + e.payment_reference) : null,
        ),
        el('div', { class:'text-right' },
          el('div', { class:'text-base font-semibold text-stone-900' }, money(e.amount)),
          el('div', { class:'mt-1' }, statusPill(e.status)),
          receiptCounts[e.id] ? el('div', { class:'text-xs text-stone-500 mt-1' }, `${receiptCounts[e.id]} receipt${receiptCounts[e.id] > 1 ? 's' : ''}`) : null,
        ),
      ),
    );

    // Action row
    const actions = el('div', { class:'flex flex-wrap items-center gap-2 mt-3' });
    if (canEditClaim) {
      actions.appendChild(el('button', { class:'text-xs px-3 py-1.5 rounded-lg border border-stone-300 hover:bg-stone-50', onclick: () => openClaimDialog(e) }, 'Edit'));
    }
    if (canActOnIt) {
      if (e.status === 'Claimed') {
        actions.appendChild(el('button', { class:'text-xs px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white', onclick: () => act(e, 'approve') }, 'Approve'));
        actions.appendChild(el('button', { class:'text-xs px-3 py-1.5 rounded-lg border border-red-300 text-red-700 hover:bg-red-50', onclick: () => rejectFlow(e) }, 'Reject'));
      } else if (e.status === 'Approved') {
        actions.appendChild(el('button', { class:'text-xs px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white', onclick: () => payFlow(e) }, 'Mark paid'));
        actions.appendChild(el('button', { class:'text-xs px-3 py-1.5 rounded-lg border border-stone-300 hover:bg-stone-50', onclick: () => act(e, 'reset') }, 'Back to claimed'));
      } else if (e.status === 'Rejected') {
        actions.appendChild(el('button', { class:'text-xs px-3 py-1.5 rounded-lg border border-stone-300 hover:bg-stone-50', onclick: () => act(e, 'reset') }, 'Reopen'));
      }
    }
    if (actions.children.length > 0) card.appendChild(actions);

    // Delete an incorrect claim: owner while still Claimed, or Admin at any time
    if (canDeleteIt) {
      actions.appendChild(el('button', {
        class:'text-xs px-3 py-1.5 rounded-lg border border-red-300 text-red-700 hover:bg-red-50',
        onclick: async () => {
          if (!confirm('Delete this expense claim? This cannot be undone.')) return;
          try {
            const { error } = await supabase.rpc('delete_expense', { p_id: e.id });
            if (error) throw error;
            toast('Claim deleted', 'success'); reload();
          } catch (err) { toast(err.message || 'Could not delete', 'error'); }
        },
      }, 'Delete'));
      if (!card.contains(actions)) card.appendChild(actions);
    }
    return card;
  }

  async function act(e, action, extra = {}) {
    try {
      const { error } = await supabase.rpc('set_expense_status', {
        p_id: e.id, p_action: action,
        p_rejection_reason: extra.reason || null,
        p_payment_reference: extra.reference || null,
      });
      if (error) throw error;
      toast('Updated', 'success');
      reload();
    } catch (err) { toast(err.message || 'Could not update', 'error'); }
  }

  function rejectFlow(e) {
    const reason = prompt('Reason for rejection:');
    if (reason === null) return;
    act(e, 'reject', { reason: reason.trim() || 'No reason given' });
  }
  function payFlow(e) {
    const reference = prompt('Payment reference (e.g. EFT number):');
    if (reference === null) return;
    act(e, 'pay', { reference: reference.trim() || null });
  }

  function openClaimDialog(existing) {
    const isEdit = !!existing;
    const overlay = el('div', { class:'fixed inset-0 z-40 bg-stone-900/50 flex items-end sm:items-center justify-center p-0 sm:p-4' });
    const dialog  = el('div', { class:'bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl shadow-xl max-h-[95vh] flex flex-col' });
    overlay.appendChild(dialog);

    dialog.appendChild(el('div', { class:'px-5 py-4 border-b border-stone-200' },
      el('h3', { class:'text-base font-semibold' }, isEdit ? 'Edit claim' : 'New expense claim')));

    const body = el('div', { class:'flex-1 overflow-y-auto p-5 space-y-3' });
    const fDate = el('input', { type:'date', required:'', class:'w-full rounded-lg border border-stone-300 px-3 py-2 text-sm', value: existing?.expense_date || new Date().toISOString().slice(0,10) });
    const fDesc = el('input', { type:'text', required:'', class:'w-full rounded-lg border border-stone-300 px-3 py-2 text-sm', value: existing?.description || '' });
    const fAmount = el('input', { type:'number', step:'0.01', required:'', class:'w-full rounded-lg border border-stone-300 px-3 py-2 text-sm', value: existing?.amount ?? '' });
    const fCategory = el('input', { type:'text', class:'w-full rounded-lg border border-stone-300 px-3 py-2 text-sm', value: existing?.category || '', placeholder:'e.g. Transport, Materials' });
    const fPhase = el('select', { class:'w-full rounded-lg border border-stone-300 px-3 py-2 text-sm bg-white' },
      el('option', { value:'' }, 'No phase'),
      ...phases.map(p => el('option', { value:p.id, selected: p.id === existing?.phase_id ? '' : null }, `Phase ${p.sort_order}: ${p.name}`)));
    const fReceipt = el('input', { type:'text', class:'w-full rounded-lg border border-stone-300 px-3 py-2 text-sm', value: existing?.receipt_file_path || '', placeholder:'Optional external link' });
    const errBox = el('div', { class:'text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3', hidden:'' });

    // Receipts section: upload and list. Available once the claim exists.
    const receiptsHost = el('div', { class:'space-y-2' });
    const ALLOWED = ['image/jpeg','image/png','image/gif','image/webp','application/pdf',
      'application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    const MAX_BYTES = 30 * 1024 * 1024;

    async function loadReceipts() {
      receiptsHost.innerHTML = '';
      if (!existing) {
        receiptsHost.appendChild(el('div', { class:'text-xs text-stone-500' }, 'Save the claim first, then reopen it to attach receipts.'));
        return;
      }
      let rows = [];
      try { const { data, error } = await supabase.rpc('list_expense_receipts', { p_expense_id: existing.id }); if (error) throw error; rows = data || []; }
      catch (e) { receiptsHost.appendChild(el('div', { class:'text-xs text-red-600' }, 'Could not load receipts')); return; }

      if (rows.length === 0) receiptsHost.appendChild(el('div', { class:'text-xs text-stone-500' }, 'No receipts attached yet.'));
      rows.forEach(r => {
        receiptsHost.appendChild(el('div', { class:'flex items-center justify-between gap-2 bg-stone-50 border border-stone-200 rounded-lg px-3 py-2' },
          el('button', { class:'text-sm text-brand-600 hover:text-brand-700 truncate text-left', onclick: () => viewReceipt(r.file_path) }, r.file_name),
          el('button', { class:'text-stone-400 hover:text-red-600 text-sm shrink-0', onclick: async () => {
            if (!confirm('Remove this receipt?')) return;
            try {
              await supabase.storage.from('receipts').remove([r.file_path]);
              const { error } = await supabase.rpc('delete_expense_receipt', { p_id: r.id });
              if (error) throw error;
              toast('Receipt removed', 'success'); loadReceipts();
            } catch (e) { toast(e.message || 'Could not remove', 'error'); }
          } }, '×'),
        ));
      });
    }

    async function viewReceipt(path) {
      try {
        const { data, error } = await supabase.storage.from('receipts').createSignedUrl(path, 120);
        if (error) throw error;
        window.open(data.signedUrl, '_blank');
      } catch (e) { toast('Could not open receipt', 'error'); }
    }

    const fileInput = el('input', { type:'file', accept:'image/*,.pdf,.doc,.docx', class:'hidden' });
    const uploadBtn = el('button', { class:'text-xs px-3 py-1.5 rounded-lg border border-stone-300 hover:bg-stone-50', onclick: () => fileInput.click() }, 'Attach a receipt');
    fileInput.addEventListener('change', async () => {
      const file = fileInput.files && fileInput.files[0];
      if (!file) return;
      if (file.size > MAX_BYTES) { toast('File is larger than 30 MB', 'error'); fileInput.value=''; return; }
      if (ALLOWED.length && !ALLOWED.includes(file.type) && file.type) { toast('Use an image, PDF, or Word file', 'error'); fileInput.value=''; return; }
      uploadBtn.disabled = true; uploadBtn.textContent = 'Uploading...';
      try {
        const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const path = `${myUserId}/${existing.id}-${Date.now()}-${safe}`;
        const { error: upErr } = await supabase.storage.from('receipts').upload(path, file, { contentType: file.type || 'application/octet-stream', upsert: false });
        if (upErr) throw upErr;
        const { error } = await supabase.rpc('add_expense_receipt', {
          p_expense_id: existing.id, p_file_path: path, p_file_name: file.name,
          p_file_type: file.type || null, p_file_size: file.size,
        });
        if (error) throw error;
        toast('Receipt attached', 'success'); loadReceipts();
      } catch (e) { toast(e.message || 'Upload failed', 'error'); }
      finally { uploadBtn.disabled = false; uploadBtn.textContent = 'Attach a receipt'; fileInput.value=''; }
    });

    body.append(
      el('div', { class:'grid grid-cols-2 gap-3' }, lab('Date', fDate), lab('Amount (R)', fAmount)),
      lab('Description', fDesc),
      el('div', { class:'grid grid-cols-2 gap-3' }, lab('Category', fCategory), lab('Phase', fPhase)),
      el('div', null,
        el('div', { class:'flex items-center justify-between mb-1' },
          el('label', { class:'block text-sm font-medium text-stone-700' }, 'Receipts'),
          uploadBtn),
        receiptsHost, fileInput),
      lab('External link (optional)', fReceipt),
      el('div', { class:'text-xs text-stone-500' }, 'New claims start as "Claimed". Finance reviews and approves or rejects. You can attach more than one receipt, up to 30 MB each.'),
      errBox,
    );
    dialog.appendChild(body);
    loadReceipts();

    const submitBtn = el('button', { class:'px-4 py-2 text-sm rounded-lg bg-brand-500 hover:bg-brand-600 text-white font-medium' }, isEdit ? 'Save' : 'Submit claim');
    submitBtn.addEventListener('click', async () => {
      errBox.hidden = true;
      if (!fDesc.value.trim() || fAmount.value === '') { errBox.textContent = 'Description and amount are required'; errBox.hidden = false; return; }
      submitBtn.disabled = true; submitBtn.textContent = 'Saving...';
      try {
        const { error } = await supabase.rpc('upsert_expense', {
          p_id: existing?.id || null,
          p_expense_date: fDate.value,
          p_description: fDesc.value.trim(),
          p_amount: Number(fAmount.value),
          p_phase_id: fPhase.value || null,
          p_category: fCategory.value.trim() || null,
          p_receipt_file_path: fReceipt.value.trim() || null,
          p_project_id: projectId(),
        });
        if (error) throw error;
        toast(isEdit ? 'Saved' : 'Claim submitted', 'success');
        overlay.remove(); reload();
      } catch (err) { errBox.textContent = err.message || 'Could not save'; errBox.hidden = false;
        submitBtn.disabled = false; submitBtn.textContent = isEdit ? 'Save' : 'Submit claim'; }
    });

    dialog.appendChild(el('div', { class:'px-5 py-4 border-t border-stone-200 flex items-center justify-between' },
      (isEdit && (existing.user_id === myUserId && existing.status === 'Claimed' || myRole === 'Admin'))
        ? el('button', { class:'text-sm text-red-600 hover:text-red-700', onclick: async () => {
            if (!confirm('Delete this claim?')) return;
            try { const { error } = await supabase.rpc('delete_expense', { p_id: existing.id });
              if (error) throw error; overlay.remove(); toast('Deleted', 'success'); reload();
            } catch (err) { toast(err.message || 'Could not delete', 'error'); }
          }}, 'Delete') : el('span'),
      el('div', { class:'flex items-center gap-2' },
        el('button', { class:'px-4 py-2 text-sm rounded-lg hover:bg-stone-100', onclick: () => overlay.remove() }, 'Cancel'),
        submitBtn,
      ),
    ));
    document.body.appendChild(overlay);
    fDesc.focus();
  }

  async function reload() {
    const main = document.getElementById('page-content');
    if (!main) return;
    main.innerHTML = '<div class="text-sm text-stone-500">Loading expenses...</div>';
    try { await loadAll(); main.innerHTML = ''; main.appendChild(renderPage()); }
    catch (err) { main.innerHTML = ''; main.appendChild(el('div', { class:'bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 text-sm' }, 'Could not load: ' + (err.message || err))); }
  }
})();
