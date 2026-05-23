// ============================================================================
// HymnDesk Control · Module 7 · Royalty Framework
// ----------------------------------------------------------------------------
// Tabs:
//   • Calculate — run the attendance-based prorate for all members, preview,
//     then generate statements
//   • Members   — view and edit each member's royalty percentage (Admin)
//   • Forfeitures — apply and remove deductions (Finance, Admin)
//   • Settings  — pool share percent and deductions description (Finance, Admin)
//
// A Talent member sees only their own statement history.
// ============================================================================

(function () {
  'use strict';

  const M = {};
  window.HD_Royalty = M;

  let supabase = null;
  let myRole = null;
  let myUserId = null;
  let members = [];
  let sessions = [];
  let activeTab = 'calculate';

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
  function pct(n) { return Number(n||0).toLocaleString('en-ZA', { minimumFractionDigits:2, maximumFractionDigits:2 }); }
  function fmtDate(d) { return d ? new Date(d).toLocaleDateString('en-ZA', { year:'numeric', month:'short', day:'numeric' }) : '—'; }
  function isFinance() { return ['Admin','Finance'].includes(myRole); }
  function isAdmin() { return myRole === 'Admin'; }
  function isPmOrAdmin() { return ['Admin','Project Manager'].includes(myRole); }
  function canView() { return ['Admin','Finance','Project Manager','Talent'].includes(myRole); }
  function projectId() { return window.HD_Project ? window.HD_Project.getId() : null; }

  async function loadBase() {
    const { data: { user } } = await supabase.auth.getUser();
    myUserId = user.id;
    const { data: prof } = await supabase.from('users').select('role:roles(name)').eq('id', user.id).maybeSingle();
    myRole = prof?.role?.name || null;
    const pid = projectId();
    const [mRes, sRes] = await Promise.all([
      supabase.from('users').select('id, full_name, contribution_percent, incentive_percent, session_rate, royalty_percent, is_active, role:roles(name)').order('full_name'),
      supabase.rpc('list_sessions', { p_project_id: pid }),
    ]);
    members  = mRes.data || [];
    sessions = sRes.data || [];
  }

  M.render = function (container, opts) {
    supabase = opts.supabase;
    container.innerHTML = '<div class="text-sm text-stone-500">Loading royalty framework...</div>';
    loadBase().then(() => { container.innerHTML = ''; container.appendChild(renderShell()); })
              .catch(err => { container.innerHTML = '';
                container.appendChild(el('div', { class:'bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 text-sm' }, 'Could not load: ' + (err.message || err))); });
  };

  function renderShell() {
    const wrap = el('div', { class:'space-y-6' });
    wrap.appendChild(el('div', null,
      el('h2', { class:'text-xl lg:text-2xl font-bold text-stone-900' }, 'Royalty Framework'),
      el('p', { class:'text-sm text-stone-500 mt-1' }, 'Attendance-based prorate of the income pool'),
    ));

    // Tabs (Talent only sees "My statements")
    const tabs = el('div', { class:'flex items-center gap-1 border-b border-stone-200 overflow-x-auto' });
    const body = el('div');

    const allTabs = isFinance()
      ? [['calculate','Calculate'], ['members','Members'], ['forfeitures','Forfeitures'], ['statements','Statements'], ['settings','Settings']]
      : (myRole === 'Project Manager'
          ? [['calculate','Calculate'], ['statements','Statements']]
          : [['statements','My statements']]);

    if (!allTabs.find(t => t[0] === activeTab)) activeTab = allTabs[0][0];

    function renderTabs() {
      tabs.innerHTML = '';
      allTabs.forEach(([key, label]) => {
        const b = el('button', { class:`px-3 py-2 text-sm font-medium border-b-2 whitespace-nowrap ${activeTab === key ? 'border-brand-500 text-brand-700' : 'border-transparent text-stone-500 hover:text-stone-900'}` }, label);
        b.addEventListener('click', () => { activeTab = key; renderTabs(); });
        tabs.appendChild(b);
      });
      body.innerHTML = '';
      if (activeTab === 'calculate') renderCalculate(body);
      else if (activeTab === 'members') renderMembers(body);
      else if (activeTab === 'forfeitures') renderForfeitures(body);
      else if (activeTab === 'statements') renderStatements(body);
      else if (activeTab === 'settings') renderSettings(body);
    }
    renderTabs();

    wrap.append(tabs, body);
    return wrap;
  }

  // ----- Calculate tab ----------------------------------------------------
  function renderCalculate(host) {
    host.innerHTML = '';
    const card = el('div', { class:'bg-white border border-stone-200 rounded-xl p-5 mt-4 space-y-3' });
    const today = new Date().toISOString().slice(0,10);
    const fStart = el('input', { type:'date', class:'rounded-lg border border-stone-300 px-3 py-2 text-sm' });
    const fEnd   = el('input', { type:'date', class:'rounded-lg border border-stone-300 px-3 py-2 text-sm', value: today });
    card.append(
      el('p', { class:'text-sm text-stone-600' }, 'Run the royalty calculation for all members up to a chosen period end date. This previews the split. You can then generate a saved statement for each member.'),
      el('div', { class:'grid grid-cols-2 gap-3 max-w-md' },
        lab('Period start (optional)', fStart),
        lab('Period end', fEnd),
      ),
      el('button', { class:'bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium px-4 py-2 rounded-lg',
        onclick: () => runCalc(fStart.value || null, fEnd.value, resultHost) }, 'Run calculation'),
    );
    host.appendChild(card);
    const resultHost = el('div', { class:'mt-4' });
    host.appendChild(resultHost);
  }

  async function runCalc(start, end, resultHost) {
    if (!end) { toast('Choose a period end date', 'error'); return; }
    resultHost.innerHTML = '<div class="text-sm text-stone-500">Calculating...</div>';
    try {
      const { data, error } = await supabase.rpc('calculate_royalty_run', {
        p_period_end: end, p_period_start: start, p_project_id: projectId(),
      });
      if (error) throw error;
      const statements = (data && data.statements) || [];
      resultHost.innerHTML = '';

      if (statements.length === 0) {
        resultHost.appendChild(el('div', { class:'text-sm text-stone-500 text-center py-6' }, 'No members to calculate.'));
        return;
      }

      const avPool = statements[0]?.av_pool || 0;
      const incPool = statements[0]?.incentive_pool || 0;
      const totalFinal = statements.reduce((s, x) => s + Number(x.final_total || 0), 0);

      resultHost.appendChild(el('div', { class:'grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4' },
        tile('Contribution pool', money(avPool)),
        tile('Incentive pool', money(incPool)),
        tile('Total to pay', money(totalFinal), 'green'),
      ));

      const anySession = statements.some(s => s.session_rate != null);
      const table = el('div', { class:'bg-white border border-stone-200 rounded-xl overflow-hidden overflow-x-auto' });
      table.appendChild(el('div', { class:'grid grid-cols-12 gap-2 px-4 py-3 bg-stone-50 border-b border-stone-200 text-xs font-medium text-stone-500 uppercase min-w-[640px]' },
        el('div', { class:'col-span-3' }, 'Member'),
        el('div', { class:'col-span-2 text-right' }, 'Contribution'),
        el('div', { class:'col-span-2 text-right' }, 'Incentive'),
        el('div', { class:'col-span-2 text-right' }, anySession ? 'Session' : ''),
        el('div', { class:'col-span-2 text-right' }, 'Total'),
        el('div', { class:'col-span-1 text-right' }, ''),
      ));
      statements.forEach(s => {
        table.appendChild(el('div', { class:'grid grid-cols-12 gap-2 px-4 py-3 border-b border-stone-100 last:border-b-0 text-sm items-center min-w-[640px]' },
          el('div', { class:'col-span-3 min-w-0' },
            el('div', { class:'text-stone-900 truncate' }, s.user_name),
            el('div', { class:'text-xs text-stone-500' }, `attended ${s.sessions_attended}/${s.sessions_total}`),
            !s.is_active ? el('div', { class:'text-xs text-amber-600' }, 'inactive') : null,
            s.forfeitures_total > 0 ? el('div', { class:'text-xs text-red-600' }, 'forfeit ' + money(s.forfeitures_total)) : null,
          ),
          el('div', { class:'col-span-2 text-right text-stone-700' }, money(s.contribution_amount)),
          el('div', { class:'col-span-2 text-right text-stone-700' }, s.is_active ? money(s.incentive_amount) : el('span', { class:'text-stone-400' }, money(0))),
          el('div', { class:'col-span-2 text-right text-stone-600' }, s.session_rate != null ? money(s.session_pay) : '—'),
          el('div', { class:'col-span-2 text-right font-medium text-stone-900' }, money(s.final_total)),
          el('div', { class:'col-span-1 text-right' },
            isFinance() ? el('button', { class:'text-xs text-brand-600 hover:text-brand-700',
              onclick: (ev) => genStatement(s, end, start, ev.target) }, 'Save') : null,
          ),
        ));
      });
      resultHost.appendChild(table);

      if (isFinance()) {
        resultHost.appendChild(el('div', { class:'mt-4 flex items-center justify-end gap-2' },
          el('button', { class:'text-sm border border-stone-300 hover:bg-stone-50 px-4 py-2 rounded-lg',
            onclick: () => exportRunCsv(statements, start, end) }, 'Export CSV'),
          el('button', { class:'text-sm bg-stone-900 hover:bg-stone-800 text-white px-4 py-2 rounded-lg',
            onclick: (ev) => genAll(statements, end, start, ev.target) }, 'Generate all statements')));
      }
    } catch (err) {
      resultHost.innerHTML = '';
      resultHost.appendChild(el('div', { class:'bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 text-sm' }, err.message || 'Calculation failed'));
    }
  }

  async function genStatement(s, end, start, btn) {
    if (btn) { btn.disabled = true; btn.textContent = '...'; }
    try {
      const { error } = await supabase.rpc('generate_royalty_statement', {
        p_user_id: s.user_id, p_period_end: end, p_period_start: start, p_project_id: projectId(),
      });
      if (error) throw error;
      if (btn) { btn.textContent = 'Saved'; }
      toast('Statement generated for ' + s.user_name, 'success');
    } catch (err) { toast(err.message || 'Failed', 'error'); if (btn) { btn.disabled = false; btn.textContent = 'Generate'; } }
  }

  async function genAll(statements, end, start, btn) {
    if (!confirm(`Generate ${statements.length} statements for this period?`)) return;
    if (btn) { btn.disabled = true; btn.textContent = 'Generating...'; }
    let ok = 0;
    for (const s of statements) {
      try {
        const { error } = await supabase.rpc('generate_royalty_statement', {
          p_user_id: s.user_id, p_period_end: end, p_period_start: start, p_project_id: projectId(),
        });
        if (!error) ok++;
      } catch (e) { /* continue */ }
    }
    toast(`Generated ${ok} of ${statements.length} statements`, 'success');
    if (btn) { btn.disabled = false; btn.textContent = 'Generate all statements'; }
  }

  // ----- Members tab ------------------------------------------------------
  function renderMembers(host) {
    host.innerHTML = '';
    const note = el('p', { class:'text-sm text-stone-600 mt-4 mb-3' },
      'Each member has a Contribution percentage (audio visual royalties, retained for life) and an Incentive percentage (sponsorship, advertising and donation royalties, paid only while active). A session rate is optional and only shows where it has been set. Only Admin and Project Manager can change these.');
    host.appendChild(note);

    const totalContrib = members.filter(m => m.is_active).reduce((s, m) => s + Number(m.contribution_percent || 0), 0);
    const totalInc = members.filter(m => m.is_active).reduce((s, m) => s + Number(m.incentive_percent || 0), 0);
    host.appendChild(el('div', { class:'grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4' },
      tile('Active Contribution total', pct(totalContrib) + ' percent', Math.abs(totalContrib - 100) < 0.01 ? 'green' : 'amber'),
      tile('Active Incentive total', pct(totalInc) + ' percent', Math.abs(totalInc - 100) < 0.01 ? 'green' : 'amber'),
    ));

    const table = el('div', { class:'bg-white border border-stone-200 rounded-xl overflow-hidden' });
    table.appendChild(el('div', { class:'grid grid-cols-12 gap-2 px-4 py-3 bg-stone-50 border-b border-stone-200 text-xs font-medium text-stone-500 uppercase' },
      el('div', { class:'col-span-4' }, 'Member'),
      el('div', { class:'col-span-2 text-right' }, 'Contribution'),
      el('div', { class:'col-span-2 text-right' }, 'Incentive'),
      el('div', { class:'col-span-2 text-right' }, 'Session rate'),
      el('div', { class:'col-span-2 text-right' }, ''),
    ));
    members.forEach(m => {
      const row = el('div', { class:'grid grid-cols-12 gap-2 px-4 py-3 border-b border-stone-100 last:border-b-0 text-sm items-center' },
        el('div', { class:'col-span-4 min-w-0' },
          el('div', { class:`text-stone-900 truncate ${m.is_active ? '' : 'text-stone-400'}` }, m.full_name),
          el('div', { class:'text-xs text-stone-500 truncate' }, m.role?.name || '—'),
          m.is_active ? null : el('div', { class:'text-xs text-amber-600' }, 'Inactive · incentive not paid'),
        ),
        el('div', { class:'col-span-2 text-right text-stone-900' }, pct(m.contribution_percent) + '%'),
        el('div', { class:'col-span-2 text-right text-stone-900' }, pct(m.incentive_percent) + '%'),
        el('div', { class:'col-span-2 text-right text-stone-600' }, m.session_rate != null ? money(m.session_rate) : '—'),
        el('div', { class:'col-span-2 text-right' },
          isPmOrAdmin() ? el('button', { class:'text-xs text-brand-600 hover:text-brand-700', onclick: () => editRoyalty(m) }, 'Edit') : null,
        ),
      );
      table.appendChild(row);
    });
    host.appendChild(table);
  }

  function editRoyalty(m) {
    const overlay = el('div', { class:'fixed inset-0 z-50 bg-stone-900/50 flex items-center justify-center p-4' });
    const dlg = el('div', { class:'bg-white rounded-2xl shadow-xl w-full max-w-sm p-5 space-y-3' });
    const fContrib = el('input', { type:'number', step:'0.01', min:'0', class:'w-full rounded-lg border border-stone-300 px-3 py-2 text-sm', value: m.contribution_percent ?? '0' });
    const fInc = el('input', { type:'number', step:'0.01', min:'0', class:'w-full rounded-lg border border-stone-300 px-3 py-2 text-sm', value: m.incentive_percent ?? '0' });
    // Session rate optional: a checkbox reveals the field. Off means not applicable.
    const hasRate = m.session_rate != null;
    const fRateOn = el('input', { type:'checkbox', class:'rounded', checked: hasRate ? '' : null });
    const fRate = el('input', { type:'number', step:'0.01', min:'0', class:'w-full rounded-lg border border-stone-300 px-3 py-2 text-sm', value: m.session_rate ?? '', disabled: hasRate ? null : '' });
    fRateOn.addEventListener('change', () => { fRate.disabled = !fRateOn.checked; if (!fRateOn.checked) fRate.value = ''; });
    const errBox = el('div', { class:'text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-2', hidden:'' });

    dlg.append(
      el('h4', { class:'font-semibold' }, m.full_name),
      el('p', { class:'text-xs text-stone-500' }, m.is_active ? 'Active member' : 'Inactive. Set the incentive percentage to 0 if they have left.'),
      lab('Contribution percent (audio visual)', fContrib),
      lab('Incentive percent (sponsorship, ads, donations)', fInc),
      el('label', { class:'flex items-center gap-2 text-sm text-stone-700 pt-1' }, fRateOn, 'This member has a session rate'),
      lab('Session rate (Rand per session attended)', fRate),
      errBox,
      el('div', { class:'flex items-center justify-end gap-2 pt-1' },
        el('button', { class:'px-4 py-2 text-sm rounded-lg hover:bg-stone-100', onclick: () => overlay.remove() }, 'Cancel'),
        el('button', { class:'px-4 py-2 text-sm rounded-lg bg-brand-500 hover:bg-brand-600 text-white font-medium', onclick: async () => {
          errBox.hidden = true;
          try {
            const { error } = await supabase.rpc('set_member_royalty', {
              p_user_id: m.id,
              p_contribution_percent: Number(fContrib.value || 0),
              p_incentive_percent: Number(fInc.value || 0),
              p_session_rate: fRateOn.checked ? Number(fRate.value || 0) : null,
            });
            if (error) throw error;
            overlay.remove(); toast('Updated', 'success');
            await loadBase(); const b = document.querySelector('#page-content'); if (b) { b.innerHTML=''; b.appendChild(renderShell()); }
          } catch (err) { errBox.textContent = err.message || 'Failed'; errBox.hidden = false; }
        }}, 'Save'),
      ),
    );
    overlay.appendChild(dlg); document.body.appendChild(overlay); fContrib.focus();
  }

  // ----- Forfeitures tab --------------------------------------------------
  async function renderForfeitures(host) {
    host.innerHTML = '<div class="text-sm text-stone-500 mt-4">Loading forfeitures...</div>';
    const { data, error } = await supabase.rpc('list_forfeitures', { p_project_id: projectId(), p_user_id: null });
    host.innerHTML = '';
    if (error) { host.appendChild(el('div', { class:'text-sm text-red-600' }, error.message)); return; }
    const rows = data || [];

    host.appendChild(el('div', { class:'flex items-center justify-between mt-4 mb-3' },
      el('p', { class:'text-sm text-stone-600' }, 'Deductions applied to members outside the normal prorate.'),
      el('button', { class:'text-sm bg-brand-500 hover:bg-brand-600 text-white px-3 py-1.5 rounded-lg', onclick: () => openForfeitDialog(host) }, '+ Apply forfeiture'),
    ));

    if (rows.length === 0) {
      host.appendChild(el('div', { class:'bg-white border border-stone-200 rounded-xl p-8 text-center text-sm text-stone-500' }, 'No forfeitures applied.'));
      return;
    }
    const list = el('div', { class:'bg-white border border-stone-200 rounded-xl divide-y divide-stone-100' });
    rows.forEach(f => {
      list.appendChild(el('div', { class:'flex items-center gap-3 px-4 py-3 text-sm' },
        el('div', { class:'flex-1 min-w-0' },
          el('div', { class:'text-stone-900' }, f.user_name + ' · ' + f.forfeit_type + (f.forfeit_type === 'Partial' ? ' ' + money(f.forfeit_amount) : '')),
          el('div', { class:'text-xs text-stone-500' }, [f.reason, f.session_name].filter(Boolean).join(' · ')),
        ),
        el('button', { class:'text-xs text-red-600 hover:text-red-700', onclick: async () => {
          if (!confirm('Remove this forfeiture?')) return;
          const { error } = await supabase.rpc('delete_forfeiture', { p_id: f.id });
          if (error) toast(error.message, 'error'); else renderForfeitures(host);
        }}, 'Remove'),
      ));
    });
    host.appendChild(list);
  }

  function openForfeitDialog(host) {
    const overlay = el('div', { class:'fixed inset-0 z-50 bg-stone-900/50 flex items-center justify-center p-4' });
    const dlg = el('div', { class:'bg-white rounded-2xl shadow-xl w-full max-w-md p-5 space-y-3 max-h-[95vh] overflow-y-auto' });
    const fUser = el('select', { class:'w-full rounded-lg border border-stone-300 px-3 py-2 text-sm bg-white' },
      ...members.filter(m => m.is_active).map(m => el('option', { value:m.id }, m.full_name)));
    const fType = el('select', { class:'w-full rounded-lg border border-stone-300 px-3 py-2 text-sm bg-white' },
      el('option', { value:'Full' }, 'Full (forfeit entire share)'),
      el('option', { value:'Partial' }, 'Partial (specific amount)'));
    const fAmount = el('input', { type:'number', step:'0.01', class:'w-full rounded-lg border border-stone-300 px-3 py-2 text-sm', placeholder:'Amount for partial' });
    const fSession = el('select', { class:'w-full rounded-lg border border-stone-300 px-3 py-2 text-sm bg-white' },
      el('option', { value:'' }, 'Not tied to a session'),
      ...sessions.map(s => el('option', { value:s.id }, s.name)));
    const fReason = el('textarea', { rows:'2', class:'w-full rounded-lg border border-stone-300 px-3 py-2 text-sm' });
    const errBox = el('div', { class:'text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3', hidden:'' });

    dlg.append(
      el('h4', { class:'font-semibold' }, 'Apply forfeiture'),
      lab('Member', fUser),
      lab('Type', fType),
      lab('Amount (partial only)', fAmount),
      lab('Session (optional)', fSession),
      lab('Reason', fReason),
      errBox,
      el('div', { class:'flex items-center justify-end gap-2' },
        el('button', { class:'px-4 py-2 text-sm rounded-lg hover:bg-stone-100', onclick: () => overlay.remove() }, 'Cancel'),
        el('button', { class:'px-4 py-2 text-sm rounded-lg bg-brand-500 hover:bg-brand-600 text-white font-medium', onclick: async () => {
          errBox.hidden = true;
          if (!fReason.value.trim()) { errBox.textContent = 'Reason required'; errBox.hidden = false; return; }
          if (fType.value === 'Partial' && (!fAmount.value || Number(fAmount.value) <= 0)) { errBox.textContent = 'Partial needs a positive amount'; errBox.hidden = false; return; }
          try {
            const { error } = await supabase.rpc('apply_forfeiture', {
              p_user_id: fUser.value, p_session_id: fSession.value || null,
              p_forfeit_type: fType.value, p_forfeit_amount: fType.value === 'Partial' ? Number(fAmount.value) : null,
              p_reason: fReason.value.trim(), p_applies_from: null, p_applies_to: null, p_project_id: projectId(),
            });
            if (error) throw error;
            overlay.remove(); toast('Forfeiture applied', 'success'); renderForfeitures(host);
          } catch (err) { errBox.textContent = err.message || 'Failed'; errBox.hidden = false; }
        }}, 'Apply'),
      ),
    );
    overlay.appendChild(dlg); document.body.appendChild(overlay);
  }

  // ----- Statements tab ---------------------------------------------------
  async function renderStatements(host) {
    host.innerHTML = '<div class="text-sm text-stone-500 mt-4">Loading statements...</div>';
    const { data, error } = await supabase.rpc('list_royalty_statements', {
      p_project_id: projectId(),
      p_user_id: (isFinance() || myRole === 'Project Manager') ? null : myUserId,
    });
    host.innerHTML = '';
    if (error) { host.appendChild(el('div', { class:'text-sm text-red-600' }, error.message)); return; }
    const rows = data || [];

    if (rows.length === 0) {
      host.appendChild(el('div', { class:'bg-white border border-stone-200 rounded-xl p-8 text-center text-sm text-stone-500 mt-4' }, 'No statements generated yet.'));
      return;
    }
    const list = el('div', { class:'space-y-2 mt-4' });
    rows.forEach(st => {
      list.appendChild(el('div', { class:'bg-white border border-stone-200 rounded-xl p-4' },
        el('div', { class:'flex items-start justify-between gap-3' },
          el('div', { class:'min-w-0 flex-1' },
            el('div', { class:'font-medium text-stone-900' }, st.user_name),
            el('div', { class:'text-xs text-stone-500 mt-0.5' },
              `${st.period_start ? fmtDate(st.period_start) + ' – ' : 'up to '}${fmtDate(st.period_end)} · generated ${fmtDate(st.generated_at)}`),
            el('div', { class:'text-xs text-stone-500 mt-1' },
              (() => {
                const snap = st.calculation_snapshot || {};
                const parts = [`attended ${st.sessions_attended}/${st.sessions_total}`,
                  `contribution ${money(snap.contribution_amount || 0)}`,
                  `incentive ${money(snap.incentive_amount || 0)}`];
                if (snap.session_rate != null) parts.push(`session ${money(snap.session_pay || 0)}`);
                return parts.join(' · ');
              })()),
          ),
          el('div', { class:'text-right' },
            el('div', { class:'text-base font-semibold text-emerald-700' }, money(st.final_share)),
            el('div', { class:'flex items-center gap-2 justify-end mt-1' },
              el('button', { class:'text-xs text-brand-600 hover:text-brand-700', onclick: () => exportStatementPdf(st) }, 'PDF'),
              isFinance() ? el('button', { class:'text-xs text-red-600 hover:text-red-700', onclick: async () => {
                if (!confirm('Delete this statement?')) return;
                const { error } = await supabase.rpc('delete_royalty_statement', { p_id: st.id });
                if (error) toast(error.message, 'error'); else renderStatements(host);
              }}, 'Delete') : null,
            ),
          ),
        ),
      ));
    });
    host.appendChild(list);
  }

  // ----- Settings tab -----------------------------------------------------
  async function renderSettings(host) {
    host.innerHTML = '<div class="text-sm text-stone-500 mt-4">Loading settings...</div>';
    const { data, error } = await supabase.rpc('get_royalty_settings', { p_project_id: projectId() });
    host.innerHTML = '';
    if (error) { host.appendChild(el('div', { class:'text-sm text-red-600' }, error.message)); return; }
    const s = data || {};

    const fPool = el('input', { type:'number', step:'0.01', class:'w-full rounded-lg border border-stone-300 px-3 py-2 text-sm', value: s.total_pool_percent ?? '50' });
    const fDeduct = el('input', { type:'text', class:'w-full rounded-lg border border-stone-300 px-3 py-2 text-sm', value: s.deductions_description || '' });
    const fNotes = el('textarea', { rows:'3', class:'w-full rounded-lg border border-stone-300 px-3 py-2 text-sm' }, s.notes || '');
    const errBox = el('div', { class:'text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3', hidden:'' });

    const card = el('div', { class:'bg-white border border-stone-200 rounded-xl p-5 mt-4 space-y-3 max-w-lg' },
      el('p', { class:'text-sm text-stone-600' }, 'The pool share percent is the portion of net income that is distributable to members. The rest is retained by the project.'),
      lab('Pool share percent', fPool),
      lab('Deductions description', fDeduct),
      lab('Notes', fNotes),
      errBox,
      el('button', { class:'bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium px-4 py-2 rounded-lg', onclick: async () => {
        errBox.hidden = true;
        try {
          const { error } = await supabase.rpc('update_royalty_settings', {
            p_project_id: projectId(),
            p_total_pool_percent: Number(fPool.value || 0),
            p_deductions_description: fDeduct.value.trim() || null,
            p_notes: fNotes.value.trim() || null,
          });
          if (error) throw error;
          toast('Settings saved', 'success');
        } catch (err) { errBox.textContent = err.message || 'Failed'; errBox.hidden = false; }
      }}, 'Save settings'),
    );
    host.appendChild(card);
  }

  // ----- Exports ----------------------------------------------------------
  function csvCell(v) {
    const s = (v == null ? '' : String(v));
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }
  function downloadFile(filename, content, mime) {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
  }

  function exportRunCsv(statements, start, end) {
    const headers = ['Member','Active','Contribution percent','Incentive percent',
                     'Sessions attended','Sessions total','Prorate factor',
                     'Contribution pool','Incentive pool','Contribution amount',
                     'Incentive amount','Session rate','Session pay','Forfeitures','Total'];
    const lines = [headers.map(csvCell).join(',')];
    statements.forEach(s => {
      lines.push([
        s.user_name, s.is_active ? 'Yes' : 'No', s.contribution_percent, s.incentive_percent,
        s.sessions_attended, s.sessions_total, s.prorate_factor,
        s.av_pool, s.incentive_pool, s.contribution_amount,
        s.incentive_amount, s.session_rate == null ? '' : s.session_rate, s.session_pay,
        s.forfeitures_total, s.final_total,
      ].map(csvCell).join(','));
    });
    const periodLabel = (start ? start + '_to_' : 'upto_') + (end || 'today');
    downloadFile(`royalty_run_${periodLabel}.csv`, lines.join('\n'), 'text/csv;charset=utf-8');
  }

  // Per-statement PDF, opened via the browser print dialog (Save as PDF).
  function exportStatementPdf(st) {
    const w = window.open('', '_blank');
    if (!w) { toast('Allow pop-ups to download the PDF', 'error'); return; }
    const snap = st.calculation_snapshot || {};
    const fmt = (n) => 'R ' + Number(n||0).toLocaleString('en-ZA', { minimumFractionDigits:2, maximumFractionDigits:2 });
    const row = (k, v) => `<tr><td style="padding:6px 0;color:#57534e">${k}</td><td style="padding:6px 0;text-align:right;color:#1c1917">${v}</td></tr>`;
    const hasSession = snap.session_rate != null;
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Royalty statement ${esc(st.user_name)}</title>
      <style>body{font-family:system-ui,Arial,sans-serif;max-width:640px;margin:40px auto;padding:0 20px;color:#1c1917}
      .head{display:flex;align-items:center;gap:12px;border-bottom:2px solid #e7e5e4;padding-bottom:14px;margin-bottom:18px}
      .muted{color:#78716c;font-size:13px;margin:0 0 16px}
      table{width:100%;border-collapse:collapse;font-size:14px} .sub{font-weight:700;padding-top:14px;color:#1c1917}
      .total{border-top:2px solid #e7e5e4;font-weight:700;font-size:16px} .total td{padding-top:12px}</style></head><body>
      <div class="head">
        <img src="https://control.hymndesk.co.za/icons/icon-192x192.png" alt="" style="width:44px;height:44px;border-radius:10px" />
        <div><div style="font-size:18px;font-weight:700">Royalty statement</div><div class="muted" style="margin:0">HymnDesk Control</div></div>
      </div>
      <p class="muted">${esc(st.user_name)} · period ${st.period_start ? esc(st.period_start) + ' to ' : 'up to '}${esc(st.period_end || '')}</p>
      <table>
        <tr><td class="sub" colspan="2">Contribution royalty (audio visual)</td></tr>
        ${row('Contribution percent', Number(snap.contribution_percent||0).toFixed(2) + ' percent')}
        ${row('Sessions attended', (snap.sessions_attended||0) + ' of ' + (snap.sessions_total||0))}
        ${row('Prorate factor', Number(snap.prorate_factor||0).toFixed(4))}
        ${row('Contribution amount', fmt(snap.contribution_amount))}
        <tr><td class="sub" colspan="2">Incentive royalty</td></tr>
        ${row('Incentive percent', Number(snap.incentive_percent||0).toFixed(2) + ' percent')}
        ${row('Status', snap.is_active ? 'Active' : 'Inactive (incentive not paid)')}
        ${row('Incentive amount', fmt(snap.incentive_amount))}
        ${hasSession ? `<tr><td class="sub" colspan="2">Session rate</td></tr>${row('Rate per session', fmt(snap.session_rate))}${row('Session pay', fmt(snap.session_pay))}` : ''}
        ${Number(snap.forfeitures_total||0) > 0 ? row('Forfeitures', fmt(snap.forfeitures_total)) : ''}
        <tr class="total"><td>Total due</td><td style="text-align:right">${fmt(st.final_share)}</td></tr>
      </table>
      <p class="muted" style="margin-top:30px">Generated from HymnDesk Control</p>
      </body></html>`);
    w.document.close();
    setTimeout(() => { w.focus(); w.print(); }, 300);
  }
  function esc(s) { return String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

  function tile(label, value, tone) {
    const tones = { green:'text-emerald-700 bg-emerald-50 border-emerald-200' };
    const cls = tones[tone] || 'bg-white border-stone-200';
    return el('div', { class:`border ${cls} rounded-xl p-4` },
      el('div', { class:'text-xs text-stone-500' }, label),
      el('div', { class:'text-lg font-semibold mt-0.5' }, value));
  }
})();
