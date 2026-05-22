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
    const [eRes, phRes, sumRes] = await Promise.all([
      supabase.rpc('list_expenses', { p_project_id: pid, p_status: filterStatus || null, p_mine_only: mineOnly }),
      supabase.rpc('list_phases', { p_project_id: pid }),
      supabase.rpc('expense_summary', { p_project_id: pid }),
    ]);
    if (eRes.error) throw eRes.error;
    expenses = eRes.data || [];
    phases   = phRes.data || [];
    summary  = sumRes.data || null;
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
    const fReceipt = el('input', { type:'text', class:'w-full rounded-lg border border-stone-300 px-3 py-2 text-sm', value: existing?.receipt_file_path || '', placeholder:'Link to receipt (optional)' });
    const errBox = el('div', { class:'text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3', hidden:'' });

    body.append(
      el('div', { class:'grid grid-cols-2 gap-3' }, lab('Date', fDate), lab('Amount (R)', fAmount)),
      lab('Description', fDesc),
      el('div', { class:'grid grid-cols-2 gap-3' }, lab('Category', fCategory), lab('Phase', fPhase)),
      lab('Receipt link', fReceipt),
      el('div', { class:'text-xs text-stone-500' }, 'New claims start as "Claimed". Finance reviews and approves or rejects.'),
      errBox,
    );
    dialog.appendChild(body);

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
