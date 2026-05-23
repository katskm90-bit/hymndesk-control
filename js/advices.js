// ============================================================================
// HymnDesk Control · Module 16 · Payment Advices and Statements
// ----------------------------------------------------------------------------
// Two tabs:
//   • Advices    — generate a payment advice for any PAID expense, view list
//   • Statements — view all generated royalty statements (links to Royalty tab)
//
// A payment advice is a numbered record (PA-YYYY-NNNN) confirming a payment.
// Finance and Admin only. A recipient can see their own advices.
// ============================================================================

(function () {
  'use strict';

  const M = {};
  window.HD_Advices = M;

  let supabase = null;
  let myRole = null;
  let myUserId = null;
  let activeTab = 'advices';

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
  function money(n) { return 'R ' + Number(n||0).toLocaleString('en-ZA', { minimumFractionDigits:2, maximumFractionDigits:2 }); }
  function fmtDate(d) { return d ? new Date(d).toLocaleDateString('en-ZA', { year:'numeric', month:'short', day:'numeric' }) : '—'; }
  function isFinance() { return ['Admin','Finance'].includes(myRole); }
  function projectId() { return window.HD_Project ? window.HD_Project.getId() : null; }

  async function loadBase() {
    const { data: { user } } = await supabase.auth.getUser();
    myUserId = user.id;
    const { data: prof } = await supabase.from('users').select('role:roles(name)').eq('id', user.id).maybeSingle();
    myRole = prof?.role?.name || null;
  }

  M.render = function (container, opts) {
    supabase = opts.supabase;
    container.innerHTML = '<div class="text-sm text-stone-500">Loading...</div>';
    loadBase().then(() => { container.innerHTML = ''; container.appendChild(renderShell()); })
              .catch(err => { container.innerHTML = '';
                container.appendChild(el('div', { class:'bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 text-sm' }, 'Could not load: ' + (err.message || err))); });
  };

  function renderShell() {
    const wrap = el('div', { class:'space-y-6' });
    wrap.appendChild(el('div', null,
      el('h2', { class:'text-xl lg:text-2xl font-bold text-stone-900' }, 'Payment Advices and Statements'),
      el('p', { class:'text-sm text-stone-500 mt-1' }, 'Numbered payment confirmations and royalty statement history'),
    ));

    const tabs = el('div', { class:'flex items-center gap-1 border-b border-stone-200' });
    const body = el('div');
    const allTabs = [['advices','Payment advices'], ['statements','Royalty statements']];

    function renderTabs() {
      tabs.innerHTML = '';
      allTabs.forEach(([key, label]) => {
        const b = el('button', { class:`px-3 py-2 text-sm font-medium border-b-2 ${activeTab === key ? 'border-brand-500 text-brand-700' : 'border-transparent text-stone-500 hover:text-stone-900'}` }, label);
        b.addEventListener('click', () => { activeTab = key; renderTabs(); });
        tabs.appendChild(b);
      });
      body.innerHTML = '';
      if (activeTab === 'advices') renderAdvices(body);
      else renderStatements(body);
    }
    renderTabs();
    wrap.append(tabs, body);
    return wrap;
  }

  // ----- Advices tab ------------------------------------------------------
  async function renderAdvices(host) {
    host.innerHTML = '<div class="text-sm text-stone-500 mt-4">Loading advices...</div>';
    const [advRes, paidRes] = await Promise.all([
      supabase.rpc('list_payment_advices', { p_project_id: projectId() }),
      isFinance()
        ? supabase.rpc('list_expenses', { p_project_id: projectId(), p_status: 'Paid', p_mine_only: false })
        : Promise.resolve({ data: [] }),
    ]);
    host.innerHTML = '';
    if (advRes.error) { host.appendChild(el('div', { class:'text-sm text-red-600' }, advRes.error.message)); return; }
    const advices = advRes.data || [];
    const paidExpenses = paidRes.data || [];

    // Paid expenses without an advice yet (Finance can generate)
    if (isFinance()) {
      const advicedExpenseIds = new Set(advices.map(a => a.expense_id));
      const pending = paidExpenses.filter(e => !advicedExpenseIds.has(e.id));
      const card = el('div', { class:'bg-white border border-stone-200 rounded-xl p-4 mt-4' },
        el('h3', { class:'text-sm font-semibold text-stone-700 mb-2' }, 'Paid expenses awaiting an advice'));
      if (pending.length === 0) {
        card.appendChild(el('div', { class:'text-sm text-stone-500' }, 'All paid expenses have advices.'));
      } else {
        const list = el('div', { class:'divide-y divide-stone-100' });
        pending.forEach(e => {
          list.appendChild(el('div', { class:'flex items-center gap-3 py-2 text-sm' },
            el('div', { class:'flex-1 min-w-0' },
              el('div', { class:'text-stone-900 truncate' }, e.description),
              el('div', { class:'text-xs text-stone-500' }, [e.user_name, money(e.amount), e.payment_reference].filter(Boolean).join(' · ')),
            ),
            el('button', { class:'text-xs bg-brand-500 hover:bg-brand-600 text-white px-3 py-1.5 rounded-lg', onclick: (ev) => doGenerate(e.id, ev.target, host) }, 'Generate advice'),
          ));
        });
        card.appendChild(list);
      }
      host.appendChild(card);
    }

    // Existing advices
    if (advices.length === 0) {
      host.appendChild(el('div', { class:'bg-white border border-stone-200 rounded-xl p-8 text-center text-sm text-stone-500 mt-4' }, 'No payment advices yet.'));
      return;
    }
    const list = el('div', { class:'space-y-2 mt-4' });
    advices.forEach(a => {
      list.appendChild(el('div', { class:'bg-white border border-stone-200 rounded-xl p-4 cursor-pointer hover:border-brand-300', onclick: () => viewAdvice(a) },
        el('div', { class:'flex items-start justify-between gap-3' },
          el('div', { class:'min-w-0 flex-1' },
            el('div', { class:'font-medium text-stone-900' }, a.advice_number),
            el('div', { class:'text-xs text-stone-500 mt-0.5' }, [a.recipient_name, a.expense_description].filter(Boolean).join(' · ')),
            el('div', { class:'text-xs text-stone-500 mt-0.5' }, 'Generated ' + fmtDate(a.generated_at)),
          ),
          el('div', { class:'text-base font-semibold text-stone-900' }, money(a.amount)),
        ),
      ));
    });
    host.appendChild(list);
  }

  async function doGenerate(expenseId, btn, host) {
    if (btn) { btn.disabled = true; btn.textContent = '...'; }
    try {
      const { data, error } = await supabase.rpc('generate_payment_advice', { p_expense_id: expenseId });
      if (error) throw error;
      toast('Advice ' + (data?.advice_number || '') + ' generated', 'success');
      renderAdvices(host);
    } catch (err) { toast(err.message || 'Failed', 'error'); if (btn) { btn.disabled = false; btn.textContent = 'Generate advice'; } }
  }

  function viewAdvice(a) {
    const overlay = el('div', { class:'fixed inset-0 z-50 bg-stone-900/50 flex items-center justify-center p-4' });
    const dlg = el('div', { class:'bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4' });
    const snap = a.snapshot || {};
    dlg.append(
      el('div', { class:'flex items-start justify-between' },
        el('div', null,
          el('div', { class:'text-xs text-stone-500' }, 'Payment Advice'),
          el('div', { class:'text-lg font-bold text-stone-900' }, a.advice_number),
        ),
        el('button', { class:'p-1.5 rounded-lg hover:bg-stone-100',
          html:'<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="6" y1="6" x2="18" y2="18"/><line x1="6" y1="18" x2="18" y2="6"/></svg>',
          onclick: () => overlay.remove() }),
      ),
      el('div', { class:'space-y-2 text-sm' },
        row('Recipient', a.recipient_name),
        row('Description', a.expense_description || snap.expense_description),
        row('Category', snap.category || '—'),
        row('Expense date', fmtDate(snap.expense_date)),
        row('Payment reference', snap.payment_reference || '—'),
        row('Paid on', fmtDate(snap.paid_at)),
        row('Generated', fmtDate(a.generated_at)),
      ),
      el('div', { class:'border-t border-stone-200 pt-3 flex items-center justify-between' },
        el('span', { class:'text-sm font-medium text-stone-700' }, 'Amount'),
        el('span', { class:'text-xl font-bold text-stone-900' }, money(a.amount)),
      ),
      el('div', { class:'flex items-center justify-end pt-1' },
        el('button', { class:'text-sm bg-brand-500 hover:bg-brand-600 text-white px-4 py-2 rounded-lg',
          onclick: () => exportAdvicePdf(a) }, 'Download PDF'),
      ),
    );
    overlay.appendChild(dlg); document.body.appendChild(overlay);
  }

  // Printable payment advice, opened via the browser print dialog (Save as PDF).
  function exportAdvicePdf(a) {
    const snap = a.snapshot || {};
    const w = window.open('', '_blank');
    if (!w) { toast('Allow pop-ups to download the PDF', 'error'); return; }
    const fmtMoney = (n) => 'R ' + Number(n||0).toLocaleString('en-ZA', { minimumFractionDigits:2, maximumFractionDigits:2 });
    const esc = (s) => String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    const line = (k, v) => `<tr><td style="padding:7px 0;color:#57534e">${k}</td><td style="padding:7px 0;text-align:right;color:#1c1917">${esc(v || '—')}</td></tr>`;
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(a.advice_number)}</title>
      <style>body{font-family:system-ui,Arial,sans-serif;max-width:640px;margin:40px auto;padding:0 24px;color:#1c1917}
      .top{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #e7e5e4;padding-bottom:16px;margin-bottom:20px}
      h1{font-size:22px;margin:0} .sub{color:#78716c;font-size:13px;margin:2px 0 0}
      .num{font-size:15px;font-weight:700;color:#ea580c}
      table{width:100%;border-collapse:collapse;font-size:14px}
      .total{border-top:2px solid #e7e5e4;font-weight:700;font-size:18px} .total td{padding-top:14px}
      .foot{color:#a8a29e;font-size:12px;margin-top:36px}</style></head><body>
      <div class="top">
        <div style="display:flex;align-items:center;gap:12px"><img src="https://control.hymndesk.co.za/icons/icon-192x192.png" alt="" style="width:48px;height:48px;border-radius:10px" /><div><h1>Payment Advice</h1><p class="sub">HymnDesk Control</p></div></div>
        <div style="text-align:right"><div class="num">${esc(a.advice_number)}</div><div class="sub">Generated ${esc(fmtDate(a.generated_at))}</div></div>
      </div>
      <table>
        ${line('Recipient', a.recipient_name)}
        ${line('Description', a.expense_description || snap.expense_description)}
        ${line('Category', snap.category)}
        ${line('Expense date', fmtDate(snap.expense_date))}
        ${line('Payment reference', snap.payment_reference)}
        ${line('Paid on', fmtDate(snap.paid_at))}
        <tr class="total"><td>Amount</td><td style="text-align:right">${fmtMoney(a.amount)}</td></tr>
      </table>
      <p class="foot">This payment advice was generated by HymnDesk Control. Advice number ${esc(a.advice_number)}.</p>
      </body></html>`);
    w.document.close();
    setTimeout(() => { w.focus(); w.print(); }, 300);
  }
  function row(label, value) {
    return el('div', { class:'flex items-center justify-between gap-3' },
      el('span', { class:'text-stone-500' }, label),
      el('span', { class:'text-stone-900 text-right' }, value || '—'));
  }

  // ----- Statements tab ---------------------------------------------------
  async function renderStatements(host) {
    host.innerHTML = '<div class="text-sm text-stone-500 mt-4">Loading statements...</div>';
    const { data, error } = await supabase.rpc('list_royalty_statements', {
      p_project_id: projectId(),
      p_user_id: isFinance() ? null : myUserId,
    });
    host.innerHTML = '';
    if (error) { host.appendChild(el('div', { class:'text-sm text-red-600' }, error.message)); return; }
    const rows = data || [];
    if (rows.length === 0) {
      host.appendChild(el('div', { class:'bg-white border border-stone-200 rounded-xl p-8 text-center text-sm text-stone-500 mt-4' },
        'No royalty statements yet. Generate them from the Royalty Framework module.'));
      return;
    }
    const list = el('div', { class:'space-y-2 mt-4' });
    rows.forEach(st => {
      list.appendChild(el('div', { class:'bg-white border border-stone-200 rounded-xl p-4' },
        el('div', { class:'flex items-start justify-between gap-3' },
          el('div', { class:'min-w-0 flex-1' },
            el('div', { class:'font-medium text-stone-900' }, st.user_name),
            el('div', { class:'text-xs text-stone-500 mt-0.5' },
              `${st.period_start ? fmtDate(st.period_start) + ' – ' : 'up to '}${fmtDate(st.period_end)}`),
            el('div', { class:'text-xs text-stone-500 mt-1' },
              `Attended ${st.sessions_attended}/${st.sessions_total} · ${Number(st.user_percentage).toFixed(2)} percent`),
          ),
          el('div', { class:'text-base font-semibold text-emerald-700' }, money(st.final_share)),
        ),
      ));
    });
    host.appendChild(list);
  }
})();
