// ============================================================================
// HymnDesk Control · Contracts
// ----------------------------------------------------------------------------
// Admin and Project Manager draft contracts for members. Selecting a role
// auto-fills that role's responsibilities from the embedded library. The PM
// captures the member's ID number, dates, the two royalty percentages and an
// optional session rate, and fills Annexure A. The contract assembles on
// screen and a document is generated and stored immediately on save.
//
// Members see their own contracts and sign them in app (signing screen is
// built in the next stage).
// ============================================================================

(function () {
  'use strict';
  const M = {}; window.HD_Contracts = M;
  let supabase = null, myUserId = null, myRole = null, myFullName = '';
  let members = [], contracts = [];

  // ----- helpers ----------------------------------------------------------
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
  function esc(s) { return String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
  function fmtDate(d) { return d ? new Date(d).toLocaleDateString('en-ZA', { year:'numeric', month:'short', day:'numeric' }) : '—'; }
  function projectId() { return window.HD_Project ? window.HD_Project.getId() : null; }
  function isPmOrAdmin() { return ['Admin','Project Manager'].includes(myRole); }

  // ----- Company details (fixed, pre-populated) ---------------------------
  const COMPANY = {
    name: 'Serenza Deluxe Atelier (Pty) Ltd',
    reg: '2026/308434/07',
    rep: 'Katleho Mokoena',
    repRole: 'Founder',
    operating: 'Serenza Music Realm, HymnDesk Project',
  };

  // ----- Role responsibilities library (matches the approved document) -----
  // Each entry: array of responsibility lines (the (a),(b)... duties).
  const ROLE_LIBRARY = {
    'Project Manager': [
      'Managing the overall project schedule, including all production sessions, rehearsals, the mock up day, and all team meetings, and ensuring all contributors are informed of dates and changes in a timely manner.',
      'Maintaining the contributor tracker, the royalty ledger, and all project documentation in an accurate and up to date condition at all times.',
      'Acting as the primary point of contact for contributors who need to communicate with project leadership, and escalating matters to the Founder where necessary.',
      'Coordinating the session readiness checklist before each production day, including confirming venue availability, catering, equipment, and contributor attendance.',
      'Receiving and recording all expense claims submitted by contributors and presenting them to management for approval.',
      'Conducting the royalty ledger review with each contributor no later than ten business days before the Annual General Meeting and managing the signing of the Royalty Amount Acknowledgement Form.',
      'Receiving and managing all grievances raised by contributors in the first instance and escalating unresolved matters to management.',
      'Determining and communicating the dress code for each production day to all contributors in writing before each session.',
      'Managing administration related to people, including attendance records, written warnings, and all disciplinary documentation.',
    ],
    'Director / Producer': [
      'Leading the creative direction of every production session, including the staging, visual treatment, and overall presentation of each hymn recording.',
      'Calling and running each production day, directing contributors during recording, and making the final decision on whether a take is accepted.',
      'Confirming that the technical setup, including audio capture, camera placement, and lighting, meets the standard required before recording begins.',
      'Coordinating with the Videography and Editing Lead on the handover of footage and the agreed treatment for editing.',
      'Coordinating with the Music Co-Director on musical readiness and arrangement before each session.',
      'Communicating creative requirements to the Project Manager in advance so that the session readiness checklist reflects what each production day needs.',
      'Maintaining order, professionalism, and a respectful working environment on set at all times, in keeping with the religious nature of the project.',
    ],
    'Music Co-Director': [
      'Preparing and finalising the musical arrangement of each hymn before its production day.',
      'Leading vocal rehearsals and confirming that all vocal parts, including soprano, alto, tenor, and bass, are prepared to the required standard before recording.',
      'Working alongside the Director during recording to confirm musical accuracy and to identify when a take meets the musical standard.',
      'Guiding contributors on pitch, timing, blend, and phrasing during rehearsals and sessions.',
      'Advising the Project Manager on the rehearsal schedule and on any additional vocal preparation required.',
      'Maintaining the agreed musical style and tone of the project across all recordings.',
    ],
    'Videography / Editing Lead': [
      'Operating and maintaining the camera and recording equipment on each production day, and confirming that all footage is captured to the agreed technical standard.',
      'Managing the safe storage and backup of all raw footage immediately after each session.',
      'Editing recorded sessions into the final audio visual product in line with the creative direction set by the Director.',
      'Delivering edited content to project leadership for review within the timelines agreed with the Project Manager.',
      'Applying revisions requested by the Director or project management until the content meets the required standard.',
      'Preparing final approved content in the formats required for publication on the project chosen platforms.',
      'Maintaining an organised archive of raw and edited material for the duration of the project.',
    ],
    'Marketing': [
      'Developing and carrying out the marketing plan for the project across the agreed channels.',
      'Managing the project presence on its chosen platforms, including the scheduling and publication of approved content.',
      'Growing the project audience and tracking the agreed performance measures, including reach, engagement, and subscriber growth.',
      'Coordinating with the Director and project management on the release schedule of content.',
      'Preparing promotional material only from content approved for release by project management.',
      'Reporting marketing performance to project management at the intervals agreed with the Project Manager.',
      'Protecting the reputation and religious character of the project in all public communication.',
    ],
    'Sponsorship Manager': [
      'Identifying and approaching prospective sponsors and funding partners aligned to the values of the project.',
      'Managing the sponsorship pipeline and recording the status of each prospect accurately and in good time.',
      'Preparing sponsorship proposals and presenting them to prospects, with the approval of project management.',
      'Negotiating sponsorship terms within the limits agreed with project management and referring final approval to the Founder.',
      'Maintaining a professional and accountable relationship with all secured sponsors for the duration of their support.',
      'Reporting sponsorship progress and secured funding to project management at the agreed intervals.',
    ],
    'Finance': [
      'Recording all income received by the project accurately and in good time.',
      'Processing expense claims submitted through the Project Manager, including the approval, rejection, and payment workflow, in line with the approved budget.',
      'Maintaining the budget and reporting on planned and actual spending to project management.',
      'Calculating royalty entitlements in line with the royalty model and preparing royalty statements for the Annual General Meeting.',
      'Preparing payment advices for approved payments and maintaining accurate financial records for the project.',
      'Supporting the Project Manager and Founder in the royalty ledger review before the Annual General Meeting.',
      'Treating all financial information as confidential in line with the Non Disclosure Agreement.',
    ],
    'Product Development Manager': [
      'Managing the development roadmap for the project digital products and platforms.',
      'Coordinating the beta testing programme, including the management of testers and the recording and triage of feedback.',
      'Prioritising fixes and improvements in consultation with project management.',
      'Reporting development progress and product readiness to project management at the agreed intervals.',
      'Confirming that the project digital products meet the required standard before release.',
      'Treating all product and project information as confidential in line with the Non Disclosure Agreement.',
    ],
    'Talent': [
      'Attending all rehearsals and production sessions for which they are scheduled, prepared and on time.',
      'Learning their assigned vocal part to the standard required before each production day.',
      'Following the direction of the Director and the Music Co-Director during rehearsals and recording.',
      'Conducting themselves professionally on set and complying with the communicated dress code for every production day.',
      'Notifying the Project Manager as early as possible where they are unable to attend a session for which they are scheduled.',
      'Refraining from posting behind the scenes or project related content publicly without the prior written approval of project management.',
    ],
  };
  function responsibilitiesFor(role) { return ROLE_LIBRARY[role] || []; }

  // ----- load -------------------------------------------------------------
  async function loadAll() {
    const { data: { user } } = await supabase.auth.getUser();
    myUserId = user.id;
    const [pRes, mRes, cRes] = await Promise.all([
      supabase.from('users').select('full_name, role:roles(name)').eq('id', user.id).maybeSingle(),
      supabase.rpc('list_team_members'),
      supabase.rpc('list_contracts', { p_project_id: projectId() }),
    ]);
    myRole = pRes.data?.role?.name || null;
    myFullName = pRes.data?.full_name || '';
    members = mRes.error ? [] : (mRes.data || []);
    contracts = cRes.error ? [] : (cRes.data || []);
  }

  M.render = function (container, opts) {
    supabase = opts.supabase;
    container.innerHTML = '<div class="text-sm text-stone-500">Loading...</div>';
    loadAll().then(() => { container.innerHTML = ''; container.appendChild(renderList()); })
      .catch(err => { container.innerHTML = '';
        container.appendChild(el('div', { class:'bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 text-sm' }, 'Could not load: ' + (err.message || err))); });
  };

  async function reload() {
    const main = document.getElementById('page-content'); if (!main) return;
    main.innerHTML = '<div class="text-sm text-stone-500">Loading...</div>';
    try { await loadAll(); main.innerHTML = ''; main.appendChild(renderList()); }
    catch (err) { main.innerHTML=''; main.appendChild(el('div', { class:'bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 text-sm' }, 'Could not load: ' + (err.message || err))); }
  }

  // ----- List view --------------------------------------------------------
  function statusLabel(s) {
    return ({ Draft:'Draft', Sent:'Awaiting member', MemberSigned:'Awaiting company', Signed:'Signed', Returned:'Returned to member' })[s] || s || 'Draft';
  }
  function statusPill(s) {
    const map = { Draft:'text-stone-600 bg-stone-100 border-stone-200',
                  Sent:'text-amber-700 bg-amber-50 border-amber-200',
                  MemberSigned:'text-blue-700 bg-blue-50 border-blue-200',
                  Returned:'text-red-700 bg-red-50 border-red-200',
                  Signed:'text-emerald-700 bg-emerald-50 border-emerald-200' };
    return el('span', { class:`inline-flex items-center text-xs font-medium border rounded-full px-2 py-0.5 ${map[s]||map.Draft}` }, statusLabel(s));
  }

  function renderList() {
    const wrap = el('div', { class:'space-y-5' });
    const header = el('div', { class:'flex items-start justify-between gap-3' },
      el('div', null,
        el('h2', { class:'text-xl lg:text-2xl font-bold text-stone-900' }, 'Contracts'),
        el('p', { class:'text-sm text-stone-500 mt-1' }, isPmOrAdmin() ? 'Draft, issue, and manage contributor contracts.' : 'Your contracts. Open one to review and sign.'),
      ),
      isPmOrAdmin() ? el('button', { class:'bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium px-4 py-2 rounded-lg shrink-0',
        onclick: () => openDraft() }, 'Draft a contract') : null,
    );
    wrap.appendChild(header);

    if (contracts.length === 0) {
      wrap.appendChild(el('div', { class:'bg-white border border-stone-200 rounded-xl p-8 text-center text-sm text-stone-500' },
        isPmOrAdmin() ? 'No contracts yet. Draft one to get started.' : 'You have no contracts yet.'));
      return wrap;
    }

    // For a member, surface any contract awaiting their signature at the top
    const myPending = contracts.filter(c => c.user_id === myUserId && (c.status === 'Sent' || c.status === 'Returned'));
    if (!isPmOrAdmin() && myPending.length > 0) {
      const banner = el('div', { class:'bg-brand-50 border-2 border-brand-200 rounded-xl p-4 flex items-center justify-between gap-3' },
        el('div', null,
          el('div', { class:'font-semibold text-stone-900' }, myPending.length === 1 ? 'You have a contract to sign' : `You have ${myPending.length} contracts to sign`),
          el('div', { class:'text-xs text-stone-600 mt-0.5' }, 'Open it to review and sign.')),
        el('button', { class:'bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium px-4 py-2 rounded-lg shrink-0',
          onclick: () => openContract(myPending[0].id) }, 'Review and sign'));
      wrap.appendChild(banner);
    }

    const list = el('div', { class:'space-y-2' });
    contracts.forEach(c => {
      const awaitingMe = c.user_id === myUserId && (c.status === 'Sent' || c.status === 'Returned');
      list.appendChild(el('div', { class:`bg-white border rounded-xl p-4 flex items-center justify-between gap-3 ${awaitingMe ? 'border-brand-300' : 'border-stone-200'}` },
        el('div', { class:'min-w-0' },
          el('div', { class:'font-medium text-stone-900 truncate' }, c.full_name),
          el('div', { class:'text-xs text-stone-500 mt-0.5' }, `${c.role_name} · drafted ${fmtDate(c.created_at)}` + (c.signed_at ? ` · signed ${fmtDate(c.signed_at)}` : '')),
        ),
        el('div', { class:'flex items-center gap-3 shrink-0' },
          statusPill(c.status),
          el('button', { class:'text-xs text-brand-600 hover:text-brand-700', onclick: () => openContract(c.id) }, awaitingMe ? 'Review and sign' : 'Open'),
        ),
      ));
    });
    wrap.appendChild(list);
    return wrap;
  }

  // ----- Draft flow -------------------------------------------------------
  function openDraft(editContract) {
    const isEditing = !!editContract;
    const overlay = el('div', { class:'fixed inset-0 z-50 bg-stone-900/50 flex items-end sm:items-center justify-center p-0 sm:p-4' });
    const dialog  = el('div', { class:'bg-white w-full sm:max-w-2xl sm:rounded-2xl rounded-t-2xl shadow-xl max-h-[95vh] flex flex-col' });
    overlay.appendChild(dialog);
    dialog.appendChild(el('div', { class:'px-5 py-4 border-b border-stone-200' },
      el('h3', { class:'text-base font-semibold' }, isEditing ? 'Edit contract' : 'Draft a contract')));

    const body = el('div', { class:'flex-1 overflow-y-auto p-5 space-y-4' });

    const fMember = el('select', { class:'w-full rounded-lg border border-stone-300 px-3 py-2 text-sm bg-white', disabled: isEditing ? '' : null },
      el('option', { value:'' }, 'Select a member'),
      ...members.filter(m => m.is_active).map(m => el('option', { value:m.id }, `${m.full_name} (${m.role?.name || m.role_name || 'No role'})`)));
    const roleLine = el('div', { class:'text-xs text-stone-500' }, '');
    const fId = el('input', { type:'text', class:'w-full rounded-lg border border-stone-300 px-3 py-2 text-sm', placeholder:'ID or passport number' });
    const fStart = el('input', { type:'date', class:'w-full rounded-lg border border-stone-300 px-3 py-2 text-sm' });
    const fEnd = el('input', { type:'date', class:'w-full rounded-lg border border-stone-300 px-3 py-2 text-sm' });
    const fContrib = el('input', { type:'number', step:'0.01', min:'0', class:'w-full rounded-lg border border-stone-300 px-3 py-2 text-sm', value:'0' });
    const fInc = el('input', { type:'number', step:'0.01', min:'0', class:'w-full rounded-lg border border-stone-300 px-3 py-2 text-sm', value:'0' });
    const fRateOn = el('input', { type:'checkbox', class:'rounded' });
    const fRate = el('input', { type:'number', step:'0.01', min:'0', class:'w-full rounded-lg border border-stone-300 px-3 py-2 text-sm', disabled:'' });
    fRateOn.addEventListener('change', () => { fRate.disabled = !fRateOn.checked; if (!fRateOn.checked) fRate.value=''; });

    const dutiesBox = el('div', { class:'text-xs text-stone-600 bg-stone-50 border border-stone-200 rounded-lg p-3 space-y-1' }, 'Select a member to load their role responsibilities.');
    let selectedMember = null;
    fMember.addEventListener('change', async () => {
      selectedMember = members.find(m => m.id === fMember.value) || null;
      const role = selectedMember ? (selectedMember.role?.name || selectedMember.role_name) : null;
      roleLine.textContent = role ? `Role: ${role}` : '';
      // Fetch the member's current royalty settings and id number directly
      if (selectedMember) {
        try {
          const { data } = await supabase.from('users')
            .select('id_number, contribution_percent, incentive_percent, session_rate')
            .eq('id', selectedMember.id).maybeSingle();
          if (data) {
            fId.value = data.id_number || '';
            fContrib.value = data.contribution_percent ?? '0';
            fInc.value = data.incentive_percent ?? '0';
            if (data.session_rate != null) { fRateOn.checked = true; fRate.disabled = false; fRate.value = data.session_rate; }
            else { fRateOn.checked = false; fRate.disabled = true; fRate.value = ''; }
          }
        } catch (e) { /* non-fatal; fields stay at defaults */ }
      }
      const duties = responsibilitiesFor(role);
      dutiesBox.innerHTML = '';
      if (duties.length === 0) { dutiesBox.appendChild(el('div', null, 'No responsibilities on file for this role. You can still draft the contract.')); }
      else {
        dutiesBox.appendChild(el('div', { class:'font-medium text-stone-700 mb-1' }, 'Responsibilities for this role (clause 2.2):'));
        duties.forEach((d, i) => dutiesBox.appendChild(el('div', null, `(${String.fromCharCode(97+i)}) ${d}`)));
      }
    });

    // Annexure A expense rows
    const annexureRows = el('div', { class:'space-y-2' });
    function addExpenseRow(desc='', notes='', amount='') {
      const d = el('input', { type:'text', class:'rounded-lg border border-stone-300 px-2 py-1.5 text-sm', placeholder:'Description', value:desc });
      const n = el('input', { type:'text', class:'rounded-lg border border-stone-300 px-2 py-1.5 text-sm', placeholder:'Notes', value:notes });
      const a = el('input', { type:'number', step:'0.01', class:'rounded-lg border border-stone-300 px-2 py-1.5 text-sm', placeholder:'Amount', value:amount });
      const row = el('div', { class:'grid grid-cols-[1fr_1fr_90px_28px] gap-2 items-center' }, d, n, a,
        el('button', { class:'text-stone-400 hover:text-red-600 text-sm', onclick:()=>row.remove() }, '×'));
      row._get = () => ({ description:d.value.trim(), notes:n.value.trim(), amount: a.value === '' ? null : Number(a.value) });
      annexureRows.appendChild(row);
    }
    addExpenseRow();

    body.append(
      lab('Member', fMember),
      roleLine,
      lab('ID or passport number', fId),
      el('div', { class:'grid grid-cols-2 gap-3' }, lab('Start date', fStart), lab('End date', fEnd)),
      el('div', { class:'grid grid-cols-2 gap-3' },
        lab('Contribution percent (audio visual)', fContrib),
        lab('Incentive percent (sponsorship, ads, donations)', fInc)),
      el('label', { class:'flex items-center gap-2 text-sm text-stone-700' }, fRateOn, 'This member has a session rate'),
      lab('Session rate (Rand per session)', fRate),
      el('div', null,
        el('div', { class:'text-sm font-medium text-stone-700 mb-1' }, 'Role responsibilities'),
        dutiesBox),
      el('div', null,
        el('div', { class:'flex items-center justify-between mb-1' },
          el('div', { class:'text-sm font-medium text-stone-700' }, 'Annexure A: agreed expenses'),
          el('button', { class:'text-xs text-brand-600 hover:text-brand-700', onclick:()=>addExpenseRow() }, '+ Add row')),
        annexureRows),
    );
    dialog.appendChild(body);

    // When editing, pre-seed the form from the existing contract and lock the member
    if (isEditing) {
      const ec = editContract;
      selectedMember = members.find(m => m.id === ec.user_id)
        || { id: ec.user_id, full_name: ec.full_name, role_name: ec.role_name };
      fMember.value = ec.user_id;
      roleLine.textContent = `Role: ${ec.role_name}`;
      fId.value = ec.id_number || '';
      fStart.value = ec.start_date || '';
      fEnd.value = ec.end_date || '';
      fContrib.value = ec.contribution_percent ?? '0';
      fInc.value = ec.incentive_percent ?? '0';
      if (ec.session_rate != null) { fRateOn.checked = true; fRate.disabled = false; fRate.value = ec.session_rate; }
      const duties = responsibilitiesFor(ec.role_name);
      dutiesBox.innerHTML = '';
      if (duties.length === 0) dutiesBox.appendChild(el('div', null, 'No responsibilities on file for this role.'));
      else { dutiesBox.appendChild(el('div', { class:'font-medium text-stone-700 mb-1' }, 'Responsibilities for this role (clause 2.2):'));
        duties.forEach((d, i) => dutiesBox.appendChild(el('div', null, `(${String.fromCharCode(97+i)}) ${d}`))); }
      // Seed annexure rows
      annexureRows.innerHTML = '';
      const rows = ec.annexure_expenses || [];
      if (rows.length === 0) addExpenseRow();
      else rows.forEach(r => addExpenseRow(r.description || '', r.notes || '', r.amount ?? ''));
    }

    const errBox = el('div', { class:'px-5 text-sm text-red-600', hidden:'' });
    dialog.appendChild(errBox);

    const saveBtn = el('button', { class:'px-4 py-2 text-sm rounded-lg bg-brand-500 hover:bg-brand-600 text-white font-medium' }, isEditing ? 'Save changes' : 'Generate draft');
    saveBtn.addEventListener('click', async () => {
      errBox.hidden = true;
      if (!selectedMember) { errBox.textContent = 'Select a member'; errBox.hidden = false; return; }
      const role = selectedMember.role?.name || selectedMember.role_name;
      saveBtn.disabled = true; saveBtn.textContent = 'Saving...';
      try {
        const expenses = Array.from(annexureRows.children).map(r => r._get()).filter(x => x.description);
        const sessionRate = fRateOn.checked ? Number(fRate.value || 0) : null;
        const bodyJson = buildContractBody({
          fullName: selectedMember.full_name, idNumber: fId.value.trim(), role,
          startDate: fStart.value || null, endDate: fEnd.value || null,
          contribution: Number(fContrib.value || 0), incentive: Number(fInc.value || 0),
          sessionRate, expenses,
        });
        if (fId.value.trim()) {
          await supabase.rpc('set_member_id_number', { p_user_id: selectedMember.id, p_id_number: fId.value.trim() });
        }
        if (isEditing) {
          const { error } = await supabase.rpc('update_contract', {
            p_contract_id: editContract.id,
            p_start_date: fStart.value || null,
            p_end_date: fEnd.value || null,
            p_contribution_percent: Number(fContrib.value || 0),
            p_incentive_percent: Number(fInc.value || 0),
            p_session_rate: sessionRate,
            p_contract_body: bodyJson,
            p_annexure_expenses: expenses,
          });
          if (error) throw error;
          toast('Contract updated', 'success');
          overlay.remove(); await reload(); openContract(editContract.id);
        } else {
          const { data: newId, error } = await supabase.rpc('draft_contract', {
            p_user_id: selectedMember.id,
            p_start_date: fStart.value || null,
            p_end_date: fEnd.value || null,
            p_contribution_percent: Number(fContrib.value || 0),
            p_incentive_percent: Number(fInc.value || 0),
            p_session_rate: sessionRate,
            p_contract_body: bodyJson,
            p_annexure_expenses: expenses,
            p_project_id: projectId(),
          });
          if (error) throw error;
          toast('Draft created', 'success');
          overlay.remove(); await reload(); openContract(newId);
        }
      } catch (err) { errBox.textContent = err.message || 'Could not save'; errBox.hidden = false;
        saveBtn.disabled = false; saveBtn.textContent = isEditing ? 'Save changes' : 'Generate draft'; }
    });

    dialog.appendChild(el('div', { class:'px-5 py-4 border-t border-stone-200 flex items-center justify-end gap-2' },
      el('button', { class:'px-4 py-2 text-sm rounded-lg hover:bg-stone-100', onclick:()=>overlay.remove() }, 'Cancel'),
      saveBtn));
    document.body.appendChild(overlay);
  }

  // Assemble the structured contract body (stored as jsonb, rendered to text/PDF)
  function buildContractBody(d) {
    const hasRate = d.sessionRate != null;
    return {
      company: COMPANY,
      member: { full_name: d.fullName, id_number: d.idNumber, role: d.role },
      dates: { start: d.startDate, end: d.endDate },
      royalties: { contribution: d.contribution, incentive: d.incentive, session_rate: d.sessionRate },
      responsibilities: responsibilitiesFor(d.role),
      expenses: d.expenses,
      has_session_rate: hasRate,
      generated_at: new Date().toISOString(),
    };
  }

  // ----- Open a single contract (review; signing added next stage) --------
  async function openContract(id) {
    let c;
    try { const { data, error } = await supabase.rpc('get_contract', { p_contract_id: id }); if (error) throw error; c = data; }
    catch (err) { toast(err.message || 'Could not open', 'error'); return; }

    const overlay = el('div', { class:'fixed inset-0 z-50 bg-stone-900/50 flex items-stretch sm:items-center justify-center p-0 sm:p-4' });
    const dialog  = el('div', { class:'bg-white w-full sm:max-w-2xl sm:rounded-2xl shadow-xl max-h-[100vh] sm:max-h-[95vh] flex flex-col' });
    overlay.appendChild(dialog);
    dialog.appendChild(el('div', { class:'px-5 py-4 border-b border-stone-200 flex items-center justify-between' },
      el('div', null,
        el('h3', { class:'text-base font-semibold' }, 'Contract'),
        el('div', { class:'text-xs text-stone-500' }, `${c.full_name} · ${c.role_name} · ${c.status}`)),
      el('button', { class:'text-stone-400 hover:text-stone-600 text-xl leading-none', onclick:()=>overlay.remove() }, '×')));

    const body = el('div', { class:'flex-1 overflow-y-auto p-5' });
    body.appendChild(renderContractPreview(c));

    // Signing area: shown to the member named on the contract when it is not
    // yet signed. Both tick boxes are required before the Sign button activates.
    const isMine = c.user_id === myUserId;

    // If the contract was returned, show the reason prominently
    if (c.status === 'Returned' && c.returned_reason) {
      body.appendChild(el('div', { class:'mt-5 border-2 border-red-200 bg-red-50 rounded-xl p-4' },
        el('div', { class:'font-semibold text-red-800' }, 'Returned for changes'),
        el('div', { class:'text-sm text-red-700 mt-1' }, c.returned_reason),
        el('div', { class:'text-xs text-red-600 mt-2' }, isMine ? 'Please edit the contract if needed, then sign again below.' : 'Waiting for the member to amend and sign again.')));
    }

    // ANNEXURE A expenses: editable by the member (their own) or PM/Admin while
    // the contract is Draft, Sent, or Returned. Locked once the member signs.
    const canEditExpenses = (isMine || isPmOrAdmin()) && ['Draft','Sent','Returned'].includes(c.status);
    if (canEditExpenses) {
      const expBox = el('div', { class:'mt-5 border border-stone-200 bg-white rounded-xl p-4 space-y-3' });
      expBox.appendChild(el('div', { class:'font-semibold text-stone-900' }, 'Annexure A: your expenses'));
      expBox.appendChild(el('div', { class:'text-xs text-stone-600' },
        isMine ? 'Add the expenses you have agreed for this engagement. The Project Manager and the Founder approve these when they sign. Once you sign, these are locked unless the contract is returned to you.'
               : 'These expenses belong to the member. You may amend them if needed while the contract is not yet signed by the member.'));

      const rowsHost = el('div', { class:'space-y-2' });
      function addRow(desc='', notes='', amount='') {
        const d = el('input', { type:'text', class:'rounded-lg border border-stone-300 px-2 py-1.5 text-sm', placeholder:'Description', value:desc });
        const n = el('input', { type:'text', class:'rounded-lg border border-stone-300 px-2 py-1.5 text-sm', placeholder:'Notes', value:notes });
        const a = el('input', { type:'number', step:'0.01', class:'rounded-lg border border-stone-300 px-2 py-1.5 text-sm', placeholder:'Amount', value:amount });
        const row = el('div', { class:'grid grid-cols-[1fr_1fr_90px_28px] gap-2 items-center' }, d, n, a,
          el('button', { class:'text-stone-400 hover:text-red-600 text-sm', onclick:()=>row.remove() }, '×'));
        row._get = () => ({ description:d.value.trim(), notes:n.value.trim(), amount: a.value === '' ? null : Number(a.value) });
        rowsHost.appendChild(row);
      }
      const existingRows = c.annexure_expenses || [];
      if (existingRows.length === 0) addRow();
      else existingRows.forEach(r => addRow(r.description || '', r.notes || '', r.amount ?? ''));

      const saveExpBtn = el('button', { class:'text-sm bg-stone-900 hover:bg-stone-800 text-white px-4 py-2 rounded-lg' }, 'Save expenses');
      const expErr = el('div', { class:'text-sm text-red-600', hidden:'' });
      saveExpBtn.addEventListener('click', async () => {
        expErr.hidden = true; saveExpBtn.disabled = true; saveExpBtn.textContent = 'Saving...';
        try {
          const rows = Array.from(rowsHost.children).map(r => r._get()).filter(x => x.description);
          const { error } = await supabase.rpc('update_contract_expenses', { p_contract_id: c.id, p_annexure_expenses: rows });
          if (error) throw error;
          toast('Expenses saved', 'success');
          overlay.remove(); openContract(c.id);
        } catch (err) { expErr.textContent = err.message || 'Could not save'; expErr.hidden = false;
          saveExpBtn.disabled = false; saveExpBtn.textContent = 'Save expenses'; }
      });

      expBox.append(
        rowsHost,
        el('div', { class:'flex items-center justify-between' },
          el('button', { class:'text-xs text-brand-600 hover:text-brand-700', onclick:()=>addRow() }, '+ Add expense'),
          saveExpBtn),
        expErr);
      body.appendChild(expBox);
    }

    // MEMBER signing area: only when it is the member's turn (Sent or Returned)
    if (isMine && (c.status === 'Sent' || c.status === 'Returned')) {
      const signBox = el('div', { class:'mt-5 border-2 border-brand-200 bg-brand-50 rounded-xl p-4 space-y-3' });
      signBox.appendChild(el('div', { class:'font-semibold text-stone-900' }, 'Sign this contract'));
      signBox.appendChild(el('div', { class:'text-xs text-stone-600' },
        'Signing electronically has the same legal effect as a handwritten signature, under the Electronic Communications and Transactions Act 25 of 2002. Once you sign, your contract goes to the Project Manager and the Founder for their signatures.'));

      const fSignName = el('input', { type:'text', class:'w-full rounded-lg border border-stone-300 px-3 py-2 text-sm', placeholder:'Type your full name', value: c.full_name || '' });
      const fSignPlace = el('input', { type:'text', class:'w-full rounded-lg border border-stone-300 px-3 py-2 text-sm', placeholder:'e.g. Johannesburg' });
      const tickAgree = el('input', { type:'checkbox', class:'rounded mt-0.5' });
      const tickNda = el('input', { type:'checkbox', class:'rounded mt-0.5' });
      const signBtn = el('button', { class:'w-full px-4 py-2.5 text-sm rounded-lg bg-stone-300 text-stone-500 font-medium cursor-not-allowed', disabled:'' }, 'Sign contract');
      const signErr = el('div', { class:'text-sm text-red-600', hidden:'' });

      function refreshSignState() {
        const ok = tickAgree.checked && tickNda.checked && fSignName.value.trim() && fSignPlace.value.trim();
        signBtn.disabled = !ok;
        signBtn.className = ok
          ? 'w-full px-4 py-2.5 text-sm rounded-lg bg-brand-500 hover:bg-brand-600 text-white font-medium'
          : 'w-full px-4 py-2.5 text-sm rounded-lg bg-stone-300 text-stone-500 font-medium cursor-not-allowed';
      }
      [tickAgree, tickNda].forEach(t => t.addEventListener('change', refreshSignState));
      [fSignName, fSignPlace].forEach(f => f.addEventListener('input', refreshSignState));

      signBox.append(
        lab('Full name', fSignName),
        lab('Place of signing', fSignPlace),
        el('label', { class:'flex items-start gap-2 text-sm text-stone-700' }, tickAgree,
          el('span', null, 'I have read and agree to be bound by this Independent Contractor Agreement.')),
        el('label', { class:'flex items-start gap-2 text-sm text-stone-700' }, tickNda,
          el('span', null, 'I have read and agree to the Non Disclosure Agreement at Annexure B.')),
        signErr,
        signBtn,
      );

      signBtn.addEventListener('click', async () => {
        if (signBtn.disabled) return;
        signErr.hidden = true; signBtn.disabled = true; signBtn.textContent = 'Signing...';
        try {
          const snapshot = {
            contract_body: c.contract_body, annexure_expenses: c.annexure_expenses,
            contribution_percent: c.contribution_percent, incentive_percent: c.incentive_percent,
            session_rate: c.session_rate, role_name: c.role_name,
            agreed_contract: true, agreed_nda: true,
          };
          const { error } = await supabase.rpc('sign_contract', {
            p_contract_id: c.id, p_signed_name: fSignName.value.trim(),
            p_signed_place: fSignPlace.value.trim(), p_signed_snapshot: snapshot,
          });
          if (error) throw error;
          // No file stored yet: the signed copy is produced only when fully signed.
          toast('Signed. Sent to the company for signature.', 'success');
          overlay.remove(); reload();
        } catch (err) { signErr.textContent = err.message || 'Could not sign'; signErr.hidden = false;
          signBtn.disabled = false; signBtn.textContent = 'Sign contract'; refreshSignState(); }
      });

      body.appendChild(signBox);
    }

    // COMPANY signing area: PM or Founder signs after the member, with a Return option
    if (isPmOrAdmin() && c.status === 'MemberSigned') {
      const iAmPm = myRole === 'Project Manager';
      const myDesignation = iAmPm ? 'Project Manager' : 'Founder';
      const alreadySigned = iAmPm ? c.pm_signed_at : c.founder_signed_at;

      const compBox = el('div', { class:'mt-5 border-2 border-blue-200 bg-blue-50 rounded-xl p-4 space-y-3' });
      compBox.appendChild(el('div', { class:'font-semibold text-stone-900' }, 'Company signature'));
      compBox.appendChild(el('div', { class:'text-xs text-stone-600' },
        `The member has signed. Signing here approves the contract and its Annexure A expenses as the ${myDesignation}. Both the Project Manager and the Founder must sign for the contract to become valid.`));

      // Show who has and has not signed yet
      const sigState = el('div', { class:'text-xs text-stone-600 space-y-0.5' },
        el('div', null, `Project Manager: ${c.pm_signed_name ? 'signed ' + fmtDate(c.pm_signed_at) : 'not yet signed'}`),
        el('div', null, `Founder: ${c.founder_signed_name ? 'signed ' + fmtDate(c.founder_signed_at) : 'not yet signed'}`));
      compBox.appendChild(sigState);

      if (alreadySigned) {
        compBox.appendChild(el('div', { class:'text-sm text-emerald-700 font-medium' }, `You have signed as ${myDesignation}. Waiting for the other signature.`));
      } else {
        const fCompName = el('input', { type:'text', class:'w-full rounded-lg border border-stone-300 px-3 py-2 text-sm', placeholder:'Type your full name', value: myFullName || '' });
        const tickApprove = el('input', { type:'checkbox', class:'rounded mt-0.5' });
        const compBtn = el('button', { class:'w-full px-4 py-2.5 text-sm rounded-lg bg-stone-300 text-stone-500 font-medium cursor-not-allowed', disabled:'' }, `Sign as ${myDesignation}`);
        const compErr = el('div', { class:'text-sm text-red-600', hidden:'' });
        function refreshComp() {
          const ok = tickApprove.checked && fCompName.value.trim();
          compBtn.disabled = !ok;
          compBtn.className = ok ? 'w-full px-4 py-2.5 text-sm rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium'
                                 : 'w-full px-4 py-2.5 text-sm rounded-lg bg-stone-300 text-stone-500 font-medium cursor-not-allowed';
        }
        tickApprove.addEventListener('change', refreshComp);
        fCompName.addEventListener('input', refreshComp);

        compBox.append(
          lab('Full name', fCompName),
          el('label', { class:'flex items-start gap-2 text-sm text-stone-700' }, tickApprove,
            el('span', null, `I approve this contract and its Annexure A expenses, and sign as ${myDesignation}.`)),
          compErr, compBtn);

        compBtn.addEventListener('click', async () => {
          if (compBtn.disabled) return;
          compErr.hidden = true; compBtn.disabled = true; compBtn.textContent = 'Signing...';
          try {
            const { data, error } = await supabase.rpc('company_sign_contract', { p_contract_id: c.id, p_signed_name: fCompName.value.trim() });
            if (error) throw error;
            if (data && data.fully_signed) {
              // Build the fully signed copy and store it now
              const signedCopy = Object.assign({}, c, {
                status: 'Signed',
                pm_signed_name: iAmPm ? fCompName.value.trim() : c.pm_signed_name,
                pm_signed_at: iAmPm ? new Date().toISOString() : c.pm_signed_at,
                founder_signed_name: iAmPm ? c.founder_signed_name : fCompName.value.trim(),
                founder_signed_at: iAmPm ? c.founder_signed_at : new Date().toISOString(),
                fully_signed_at: new Date().toISOString(),
              });
              await storeSignedContractFile(signedCopy);
              toast('Contract fully signed and valid', 'success');
            } else {
              toast(`Signed as ${myDesignation}. Waiting for the other signature.`, 'success');
            }
            overlay.remove(); reload();
          } catch (err) { compErr.textContent = err.message || 'Could not sign'; compErr.hidden = false;
            compBtn.disabled = false; compBtn.textContent = `Sign as ${myDesignation}`; refreshComp(); }
        });
      }

      // Return to member action
      const returnBtn = el('button', { class:'w-full px-4 py-2 text-sm rounded-lg border border-red-300 text-red-700 hover:bg-red-50 font-medium' }, 'Return to member for changes');
      returnBtn.addEventListener('click', async () => {
        const reason = prompt('Reason for returning this contract to the member (for example, an expense to remove or a receipt needed):');
        if (reason == null) return;
        if (!reason.trim()) { toast('A reason is required', 'error'); return; }
        try {
          const { error } = await supabase.rpc('return_contract', { p_contract_id: c.id, p_reason: reason.trim() });
          if (error) throw error;
          toast('Returned to the member', 'success'); overlay.remove(); reload();
        } catch (err) { toast(err.message || 'Could not return', 'error'); }
      });
      compBox.appendChild(returnBtn);
      body.appendChild(compBox);
    }

    dialog.appendChild(body);

    const footer = el('div', { class:'px-5 py-4 border-t border-stone-200 flex items-center justify-end gap-2 flex-wrap' });

    // Admin and PM management actions on the left
    if (isPmOrAdmin()) {
      const left = el('div', { class:'mr-auto flex items-center gap-2' });
      if (['Draft','Sent','Returned'].includes(c.status)) {
        left.appendChild(el('button', { class:'text-sm border border-stone-300 hover:bg-stone-50 px-4 py-2 rounded-lg',
          onclick: () => { overlay.remove(); openDraft(c); } }, 'Edit'));
      }
      left.appendChild(el('button', { class:'text-sm border border-red-300 text-red-700 hover:bg-red-50 px-4 py-2 rounded-lg',
        onclick: async () => {
          const warn = c.status === 'Signed'
            ? 'This contract is SIGNED. Deleting it permanently removes a signed agreement. Are you sure?'
            : 'Delete this contract? This cannot be undone.';
          if (!confirm(warn)) return;
          try { const { error } = await supabase.rpc('delete_contract', { p_contract_id: c.id }); if (error) throw error;
            toast('Contract deleted', 'success'); overlay.remove(); reload();
          } catch (err) { toast(err.message || 'Could not delete', 'error'); }
        } }, 'Delete'));
      footer.appendChild(left);
    }

    footer.appendChild(el('button', { class:'text-sm border border-stone-300 hover:bg-stone-50 px-4 py-2 rounded-lg',
      onclick: () => exportContractPdf(c) }, 'Download PDF'));
    if (c.status === 'Signed' && c.file_path) {
      footer.appendChild(el('button', { class:'text-sm border border-stone-300 hover:bg-stone-50 px-4 py-2 rounded-lg',
        onclick: async () => {
          try {
            const { data, error } = await supabase.storage.from('contracts').createSignedUrl(c.file_path, 120);
            if (error) throw error;
            const resp = await fetch(data.signedUrl);
            const html = await resp.text();
            const w = window.open('', '_blank');
            if (!w) { toast('Allow pop-ups to view the signed copy', 'error'); return; }
            w.document.write(html);
            w.document.close();
          } catch (e) { toast('Could not open the signed copy', 'error'); }
        } }, 'Signed copy'));
    }
    if (isPmOrAdmin() && c.status === 'Draft') {
      footer.appendChild(el('button', { class:'text-sm bg-stone-900 hover:bg-stone-800 text-white px-4 py-2 rounded-lg',
        onclick: async () => {
          try { const { error } = await supabase.rpc('send_contract', { p_contract_id: c.id }); if (error) throw error;
            toast('Marked as sent for signing', 'success'); overlay.remove(); reload();
          } catch (err) { toast(err.message || 'Failed', 'error'); }
        } }, 'Mark as sent for signing'));
    }
    dialog.appendChild(footer);
    document.body.appendChild(overlay);
  }

  function renderContractPreview(c) {
    const b = c.contract_body || {};
    const wrap = el('div', { class:'space-y-4 text-sm text-stone-700' });
    wrap.appendChild(el('div', { class:'text-center' },
      el('div', { class:'font-bold text-brand-600' }, COMPANY.name),
      el('div', { class:'text-xs text-stone-500' }, COMPANY.operating),
      el('div', { class:'font-semibold mt-2' }, 'Independent Contractor Agreement'),
      el('div', { class:'text-xs text-stone-500' }, c.role_name)));

    wrap.appendChild(el('div', { class:'grid grid-cols-2 gap-3' },
      el('div', { class:'bg-stone-50 border border-stone-200 rounded-lg p-3' },
        el('div', { class:'font-medium' }, 'Company'),
        el('div', null, COMPANY.name),
        el('div', { class:'text-xs text-stone-500' }, `Reg ${COMPANY.reg}`),
        el('div', { class:'text-xs text-stone-500' }, `${COMPANY.rep}, ${COMPANY.repRole}`)),
      el('div', { class:'bg-stone-50 border border-stone-200 rounded-lg p-3' },
        el('div', { class:'font-medium' }, 'Contractor'),
        el('div', null, c.full_name),
        el('div', { class:'text-xs text-stone-500' }, c.id_number ? `ID ${c.id_number}` : 'ID not captured'),
        el('div', { class:'text-xs text-stone-500' }, c.role_name))));

    wrap.appendChild(el('div', { class:'text-xs text-stone-500' },
      `Term: ${fmtDate(c.start_date)} to ${fmtDate(c.end_date)}`));

    // Royalties summary
    const roy = el('div', { class:'bg-stone-50 border border-stone-200 rounded-lg p-3 space-y-1' },
      el('div', { class:'font-medium' }, 'Compensation'),
      el('div', null, `Contribution royalty: ${Number(c.contribution_percent).toFixed(2)} percent of the audio visual pool, prorated by attendance.`),
      el('div', null, `Incentive royalty: ${Number(c.incentive_percent).toFixed(2)} percent of the incentive pool, while an active member.`));
    if (c.session_rate != null) roy.appendChild(el('div', null, `Session rate: ${money(c.session_rate)} for each session attended, in addition to royalties.`));
    wrap.appendChild(roy);

    // Responsibilities
    const duties = (b.responsibilities || []);
    if (duties.length) {
      const box = el('div', null, el('div', { class:'font-medium mb-1' }, 'Responsibilities (clause 2.2)'));
      const ol = el('div', { class:'space-y-1' });
      duties.forEach((d, i) => ol.appendChild(el('div', null, `(${String.fromCharCode(97+i)}) ${d}`)));
      box.appendChild(ol); wrap.appendChild(box);
    }

    // Annexure A
    const exp = (c.annexure_expenses || []);
    const annex = el('div', null, el('div', { class:'font-medium mb-1' }, 'Annexure A: agreed expenses'));
    if (exp.length === 0) annex.appendChild(el('div', { class:'text-stone-500' }, 'No agreed expenses recorded.'));
    else exp.forEach(e => annex.appendChild(el('div', { class:'flex justify-between border-b border-stone-100 py-1' },
      el('span', null, e.description + (e.notes ? ' — ' + e.notes : '')),
      el('span', null, e.amount != null ? money(e.amount) : '—'))));
    wrap.appendChild(annex);

    // Signature state, all three parties
    if (c.status === 'Signed') {
      wrap.appendChild(el('div', { class:'bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-emerald-800 space-y-1' },
        el('div', { class:'font-medium' }, 'Fully signed and valid'),
        el('div', { class:'text-xs' }, `Member: ${c.signed_full_name} at ${c.signed_place || 'unspecified place'} on ${fmtDate(c.signed_at)}`),
        el('div', { class:'text-xs' }, `Project Manager: ${c.pm_signed_name || '—'}${c.pm_signed_at ? ' on ' + fmtDate(c.pm_signed_at) : ''}`),
        el('div', { class:'text-xs' }, `Founder: ${c.founder_signed_name || '—'}${c.founder_signed_at ? ' on ' + fmtDate(c.founder_signed_at) : ''}`),
        el('div', { class:'text-xs font-medium mt-1' }, `Official date: ${fmtDate(c.fully_signed_at || c.signed_at)}`)));
    } else if (c.status === 'MemberSigned') {
      wrap.appendChild(el('div', { class:'bg-blue-50 border border-blue-200 rounded-lg p-3 text-blue-800 space-y-1' },
        el('div', { class:'font-medium' }, 'Signed by the member, awaiting company signatures'),
        el('div', { class:'text-xs' }, `Member: ${c.signed_full_name} at ${c.signed_place || 'unspecified place'} on ${fmtDate(c.signed_at)}`),
        el('div', { class:'text-xs' }, `Project Manager: ${c.pm_signed_name ? c.pm_signed_name + ' on ' + fmtDate(c.pm_signed_at) : 'not yet signed'}`),
        el('div', { class:'text-xs' }, `Founder: ${c.founder_signed_name ? c.founder_signed_name + ' on ' + fmtDate(c.founder_signed_at) : 'not yet signed'}`)));
    } else if (c.status === 'Returned') {
      wrap.appendChild(el('div', { class:'text-xs text-red-600' }, 'Returned to the member for changes. Signatures have been cleared.'));
    } else {
      wrap.appendChild(el('div', { class:'text-xs text-stone-500' }, 'Not yet signed. The member signs first, then the Project Manager and the Founder.'));
    }
    return wrap;
  }

  // ----- Contract PDF (print to PDF) — full agreement ---------------------
  function buildContractHtml(c) {
    const b = c.contract_body || {};
    const duties = (b.responsibilities || []);
    const exp = (c.annexure_expenses || []);
    const hasRate = c.session_rate != null;
    const cShare = Number(c.contribution_percent).toFixed(2);
    const iShare = Number(c.incentive_percent).toFixed(2);

    const dutyHtml = duties.length
      ? duties.map((d,i)=>`<p class="sub">(${String.fromCharCode(97+i)}) ${esc(d)}</p>`).join('')
      : '<p class="muted">No specific responsibilities are recorded for this role.</p>';
    const expHtml = exp.length
      ? exp.map(e=>`<tr><td>${esc(e.description)}</td><td>${esc(e.notes||'')}</td><td style="text-align:right">${e.amount!=null?money(e.amount):''}</td></tr>`).join('')
      : '<tr><td colspan="3" class="muted">No agreed expenses recorded.</td></tr>';

    // Clause numbering for compensation depends on whether a session rate exists
    const sessionClause = hasRate
      ? `<p class="cl"><b>5.9 Session Rate.</b> A session rate has been agreed with the Contractor. The Contractor is paid ${money(c.session_rate)} for each production session they attend, as recorded in the session attendance register. The session rate is paid in addition to the Contribution Royalty and the Incentive Royalty and does not reduce either.</p>` : '';
    const gnum = hasRate ? 10 : 9;

    const signedBlock = c.status === 'Signed'
      ? `<div class="box">
           <b>This agreement has been signed electronically by all parties</b><br/><br/>
           <b>Contractor:</b> ${esc(c.signed_full_name)} at ${esc(c.signed_place||'unspecified place')} on ${esc(fmtDate(c.signed_at))}.<br/>
           <b>Project Manager:</b> ${esc(c.pm_signed_name||'')} on ${esc(fmtDate(c.pm_signed_at))}.<br/>
           <b>Founder:</b> ${esc(c.founder_signed_name||'')} on ${esc(fmtDate(c.founder_signed_at))}.<br/><br/>
           Official date of agreement: ${esc(fmtDate(c.fully_signed_at||c.signed_at))}.<br/>
           These electronic signatures have the same legal effect as handwritten signatures, in accordance with the Electronic Communications and Transactions Act 25 of 2002.</div>`
      : `<table class="sig"><tr>
           <td><b>Signed by the Contractor</b><br/><br/>Signature: ____________________<br/>Name: ${esc(c.full_name)}<br/>Place: ____________<br/>Date: ____________</td>
           <td><b>Signed by the Project Manager</b><br/><br/>Signature: ____________________<br/>Name: ____________________<br/>Date: ____________</td>
         </tr><tr><td colspan="2" style="padding-top:14px"><b>Signed by the Founder</b><br/><br/>Signature: ____________________ &nbsp; Name: ${esc(COMPANY.rep)} &nbsp; Date: ____________</td></tr></table>`;

    return `<!doctype html><html><head><meta charset="utf-8"><title>Contract ${esc(c.full_name)}</title>
      <style>
      body{font-family:system-ui,Arial,sans-serif;max-width:740px;margin:34px auto;padding:0 24px;color:#1c1917;font-size:12.5px;line-height:1.55}
      .head{display:flex;align-items:center;gap:12px;border-bottom:2px solid #e7e5e4;padding-bottom:14px;margin-bottom:16px}
      h1{font-size:18px;margin:0} h2{font-size:13.5px;margin:18px 0 6px;color:#1c1917;border-bottom:1px solid #eee;padding-bottom:3px}
      h3{font-size:12.5px;margin:12px 0 4px;color:#9a3412}
      .muted{color:#78716c} .cl{margin:5px 0} .sub{margin:3px 0 3px 18px}
      .box{background:#faf9f8;border:1px solid #e7e5e4;border-radius:8px;padding:10px;margin:10px 0}
      table{width:100%;border-collapse:collapse;font-size:12px;margin-top:6px}
      th,td{padding:5px 6px;border:1px solid #ddd;text-align:left;vertical-align:top}
      table.sig td{border:none;width:50%;vertical-align:top;padding:4px 10px}
      .pb{page-break-before:always}
      </style></head><body>

      <div class="head">
        <img src="https://control.hymndesk.co.za/icons/icon-192x192.png" alt="" style="width:46px;height:46px;border-radius:10px" />
        <div><h1>Independent Contractor Agreement</h1><p class="muted" style="margin:2px 0 0">${esc(COMPANY.name)} · ${esc(COMPANY.operating)}</p></div>
      </div>

      <div class="box">
        <b>Company:</b> ${esc(COMPANY.name)}, registration number ${esc(COMPANY.reg)}, represented by ${esc(COMPANY.rep)} (${esc(COMPANY.repRole)}).<br/>
        <b>Contractor:</b> ${esc(c.full_name)}${c.id_number?', identity number '+esc(c.id_number):''}.<br/>
        <b>Role:</b> ${esc(c.role_name)} &nbsp;|&nbsp; <b>Term:</b> ${esc(fmtDate(c.start_date))} to ${esc(fmtDate(c.end_date))}.
      </div>

      <h2>Preamble</h2>
      <p>This Agreement is entered into between ${esc(COMPANY.name)}, a company incorporated in the Republic of South Africa and represented by its Founder, ${esc(COMPANY.rep)}, and the Contractor named above. The Company is engaged in the production of audio visual hymn recordings under the HymnDesk Project, operating under Serenza Music Realm. The Company wishes to engage the Contractor in the capacity stated above for the duration of this project, and the Contractor accepts this engagement on the terms set out in this Agreement. Both parties enter into this Agreement freely and confirm that they have had the opportunity to read it in full and to seek independent legal advice before signing.</p>

      <h2>1 Definitions</h2>
      <p class="cl"><b>1.1</b> "Company" means ${esc(COMPANY.name)}.</p>
      <p class="cl"><b>1.2</b> "Contractor" means the individual named above.</p>
      <p class="cl"><b>1.3</b> "Project" means the HymnDesk audio visual hymn recording initiative operated under Serenza Music Realm.</p>
      <p class="cl"><b>1.4</b> "Royalty Ledger" means the record maintained of all income received by the Project and the corresponding royalty entitlement accrued to each contributor.</p>
      <p class="cl"><b>1.5</b> "Annual General Meeting" or "AGM" means the annual meeting held in the last week of January each year at which the financial position of the Project is presented, and royalties are approved for payment.</p>
      <p class="cl"><b>1.6</b> "NDA" means the Non Disclosure Agreement signed as Annexure B and as a condition of the Contractor's engagement.</p>

      <h2>2 Services</h2>
      <p class="cl"><b>2.1</b> The Contractor is engaged in the capacity of ${esc(c.role_name)}. The specific responsibilities for this role are set out below.</p>
      <p class="cl"><b>2.2</b> The Contractor's specific responsibilities include the following:</p>
      ${dutyHtml}
      <p class="cl"><b>2.3</b> The Contractor's role is limited to the HymnDesk Project. The Contractor is not engaged to perform services for any other Serenza Deluxe Atelier project unless a separate agreement is entered into.</p>
      <p class="cl"><b>2.4</b> The Contractor is expected to be available during all production days, all scheduled team meetings, and all administrative deadlines set by project leadership. Where the Contractor is unavailable, they must notify the Founder with as much advance notice as possible.</p>
      <p class="cl"><b>2.5</b> The Contractor's royalty entitlement is made up of a Contribution Royalty and an Incentive Royalty, as set out in clause 5 and recorded in the Contractor's individual royalty ledger.</p>

      <h2>3 Nature of the Relationship</h2>
      <p class="cl"><b>3.1</b> The Contractor is engaged as an independent contractor and not as an employee of ${esc(COMPANY.name)}. Nothing in this Agreement creates an employment relationship, a partnership, or any other legal entity between the parties.</p>
      <p class="cl"><b>3.2</b> The Contractor is free to perform services for other clients during the term of this Agreement, provided that such engagements do not conflict with the obligations set out in this Agreement and do not result in a breach of the confidentiality provisions in clause 7.</p>
      <p class="cl"><b>3.3</b> The Contractor is responsible for their own tax obligations, including income tax and any other statutory deductions that may apply to their earnings under this Agreement. The Company will not make any deductions from the Contractor's compensation on their behalf.</p>

      <h2>4 Term of This Agreement</h2>
      <p class="cl"><b>4.1</b> This Agreement commences on the date on which it is signed by both parties and continues until the end date stated above, unless terminated earlier in accordance with clause 12.</p>
      <p class="cl"><b>4.2</b> Before the expiry of this Agreement, the parties will meet to discuss whether the engagement will be renewed. Renewal is not automatic and is subject to a fresh agreement being entered into in writing by both parties.</p>
      <p class="cl"><b>4.3</b> The Contractor has no right to expect or demand renewal of this Agreement upon its expiry.</p>

      <h2>5 Compensation and Royalty Model</h2>
      <p class="cl"><b>5.1</b> The Contractor is compensated under a royalty based model made up of two separate royalty streams, being the Contribution Royalty and the Incentive Royalty. No fixed salary is payable under this Agreement.</p>
      <p class="cl"><b>5.2</b> The royalty pool is set at fifty percent of the net revenue of the relevant income in the first financial year, after tax. The remaining fifty percent is allocated to the operating costs and project reserve of the HymnDesk Project. Operating costs must be recovered in full before the royalty pool is activated.</p>
      <h3>Contribution Royalty</h3>
      <p class="cl"><b>5.3</b> The Contribution Royalty is earned from audio visual income, being income generated by the published recordings of the Project, including YouTube advertising income. The Contractor earns this royalty in respect of the production sessions in which they participated, as recorded in the session attendance register. Participation is tracked for every member of the team and is not limited to vocal contributors.</p>
      <p class="cl"><b>5.4</b> The Contractor's Contribution Royalty share is ${cShare} percent of the audio visual royalty pool, prorated according to the production sessions in which the Contractor participated.</p>
      <p class="cl"><b>5.5</b> The Contribution Royalty is retained by the Contractor for as long as the relevant recordings continue to generate income, including after the Contractor's engagement has ended. It is forfeited only where the Contractor is dismissed for gross misconduct as set out in clause 11.</p>
      <h3>Incentive Royalty</h3>
      <p class="cl"><b>5.6</b> The Incentive Royalty is earned from incentive income, being income from sources other than the audio visual recordings, including sponsorships, advertising carried on the HymnDesk application, and donations made by users of the HymnDesk application.</p>
      <p class="cl"><b>5.7</b> The Contractor's Incentive Royalty share is ${iShare} percent of the incentive royalty pool.</p>
      <p class="cl"><b>5.8</b> The Incentive Royalty is payable only while the Contractor is an active member of the Project. If the Contractor ceases to be an active member, for any reason whatsoever, the Contractor automatically forfeits all entitlement to the Incentive Royalty from the date they cease to be active.</p>
      ${sessionClause}
      <h3>General</h3>
      <p class="cl"><b>5.${gnum}</b> The royalty split and the overall income distribution model may be reviewed at the Annual General Meeting. Any change to the model requires a majority vote by active contributors and the written approval of company management. No unilateral change may be made by either party.</p>
      <p class="cl"><b>5.${gnum+1}</b> The Contractor's royalty entitlement accrues from the date on which income is received by the company and is recorded in the royalty ledger. The ledger is available for review by the Contractor at the scheduled annual review.</p>

      <h2 class="pb">6 Royalty Review and Payment Process</h2>
      <p class="cl"><b>6.1</b> No later than ten business days before the Annual General Meeting, the Contractor will be given the opportunity to review their individual royalty ledger, in the presence of the Project Manager and the Founder.</p>
      <p class="cl"><b>6.2</b> Upon completing the review to their satisfaction, the Contractor will sign a Royalty Amount Acknowledgement Form confirming that the amount recorded is accurate and agreed.</p>
      <p class="cl"><b>6.3</b> Provided no dispute has been raised, all royalties due will be paid within thirty days following the Annual General Meeting.</p>
      <p class="cl"><b>6.4</b> Where a dispute is raised, royalties will be withheld pending resolution. Once resolved, the company will pay the affected Contractor as soon as practically possible.</p>
      <p class="cl"><b>6.5</b> Where a Contractor is in breach of this Agreement or the NDA at the time of the Annual General Meeting, their royalties may be withheld pending resolution. Forfeiture of royalties, whether in full or in part, will be applied only where the nature and severity of the breach justify such a consequence.</p>

      <h2>7 Confidentiality and Non Disclosure</h2>
      <p class="cl"><b>7.1</b> The Contractor acknowledges that during their engagement they will receive confidential information belonging to the Company and the Project.</p>
      <p class="cl"><b>7.2</b> The Contractor is bound by the terms of the project Non Disclosure Agreement signed as Annexure B. The obligations in that agreement are incorporated into this Agreement by reference.</p>
      <p class="cl"><b>7.3</b> A breach of the Non Disclosure Agreement constitutes a breach of this Agreement and will be addressed in accordance with the consequences set out in both documents.</p>

      <h2>8 Intellectual Property</h2>
      <p class="cl"><b>8.1</b> All creative output produced by the Contractor during their engagement vests immediately and exclusively in the HymnDesk Project. This includes all audio recordings, video footage, edited content, musical arrangements, written material, and any other work product created in connection with the Project.</p>
      <p class="cl"><b>8.2</b> The Contractor waives any moral rights they may have in connection with such output, to the extent permitted by the Copyright Act 98 of 1978.</p>
      <p class="cl"><b>8.3</b> The Contractor may not reproduce, distribute, publish, or commercialise any project output without the prior written consent of the Company.</p>

      <h2>9 Code of Conduct</h2>
      <p class="cl"><b>9.1</b> The Contractor will conduct themselves professionally at all times, including on set, at the recording venue, in digital communications, and in any public space where they may be identifiable as a contributor to this project.</p>
      <p class="cl"><b>9.2</b> The dress code for all production days will be determined and communicated in writing by the Project Manager before each production day. Given that the project serves a religious audience, the dress code is designed to ensure that the appearance of the team does not become a distraction from the content being produced. The Contractor is expected to comply without exception.</p>
      <p class="cl"><b>9.3</b> The Contractor must not post any behind the scenes content, project announcements, financial information, or other project related material on social media or any public platform without the prior written approval of project management.</p>
      <p class="cl"><b>9.4</b> Any breach of the code of conduct will be addressed in accordance with the disciplinary process set out in the Contributor Handbook.</p>

      <h2>10 Expenses</h2>
      <p class="cl"><b>10.1</b> The expenses agreed between the Contractor and the company prior to the signing of this Agreement are set out in Annexure A, which forms part of this Agreement. These are the only expenses the company is obligated to cover.</p>
      <p class="cl"><b>10.2</b> Any additional expense that arises after signing must be reported to the Project Manager in writing as soon as reasonably possible. The company may approve or decline at its sole discretion and is not bound to cover any unapproved expense.</p>

      <h2>11 Forfeiture of Royalties</h2>
      <p class="cl"><b>11.1</b> Forfeiture is applied differently to the two royalty streams.</p>
      <p class="sub">(a) Incentive Royalty: the Contractor automatically forfeits all entitlement to the Incentive Royalty from the date they cease to be an active member, for any reason whatsoever.</p>
      <p class="sub">(b) Contribution Royalty on gross misconduct: the Contractor forfeits their Contribution Royalty in full only where found to have committed gross misconduct, including wilful breach of the NDA, fraud or financial dishonesty, deliberate sabotage of project property, conduct bringing the company into serious disrepute, or breach of confidentiality causing material harm.</p>
      <p class="sub">(c) Contribution Royalty in all other cases: where the Contractor leaves for any reason other than gross misconduct, they retain the Contribution Royalty earned for the sessions in which they participated, for as long as the recordings earn.</p>
      <p class="cl"><b>11.2</b> Any forfeiture of the Contribution Royalty on the grounds of gross misconduct will be applied in accordance with South African law and the principles of fairness. The Contractor will be given the opportunity to be heard before such a decision is made.</p>
      <p class="cl"><b>11.3</b> Forfeited royalties revert to the HymnDesk project reserve fund.</p>

      <h2>12 Termination</h2>
      <p class="cl"><b>12.1</b> Either party may terminate this Agreement by giving thirty calendar days written notice, except in cases of gross misconduct where the company may terminate immediately.</p>
      <p class="cl"><b>12.2</b> On termination, the Contractor must return all company property, project files, and access credentials within five business days and confirm this in writing to the Founder.</p>
      <p class="cl"><b>12.3</b> The confidentiality obligations, intellectual property provisions, and applicable forfeiture provisions survive termination and remain in force for the periods specified in the Non Disclosure Agreement.</p>

      <h2>13 General Provisions</h2>
      <p class="cl"><b>13.1</b> Governing Law: This Agreement is governed by the laws of the Republic of South Africa. Any dispute is subject to the jurisdiction of the High Court of South Africa, Gauteng Division.</p>
      <p class="cl"><b>13.2</b> Entire Agreement: This Agreement, together with Annexure A and the Non Disclosure Agreement at Annexure B, constitutes the entire agreement between the parties.</p>
      <p class="cl"><b>13.3</b> Amendments: No amendment is valid unless made in writing and signed by both parties.</p>
      <p class="cl"><b>13.4</b> Severability: If any provision is found to be invalid or unenforceable, the remaining provisions continue in full force.</p>
      <p class="cl"><b>13.5</b> Electronic Signatures: Both parties agree that an electronic signature has the same legal effect as a handwritten signature, in accordance with the Electronic Communications and Transactions Act 25 of 2002.</p>

      <h2>14 Signatures</h2>
      <p>By signing below, both parties confirm that they have read, understood, and agree to be bound by all the terms of this Agreement, including Annexure A and the Non Disclosure Agreement at Annexure B.</p>
      ${signedBlock}

      <h2 class="pb">Annexure A: Agreed Expense Schedule</h2>
      <p class="muted">${esc(c.full_name)} · ${esc(c.role_name)}</p>
      <p>This Annexure lists the expenses agreed before signing. In line with clause 10, these are the only expenses the company is obligated to cover.</p>
      <table><tr><th>Description</th><th>Notes</th><th style="text-align:right">Amount</th></tr>${expHtml}</table>

      <h2 class="pb">Annexure B: Non Disclosure Agreement</h2>
      <p>This Non Disclosure Agreement is entered into between ${esc(COMPANY.name)}, represented by ${esc(COMPANY.rep)} (the Company), and ${esc(c.full_name)} (the Receiving Party). It is a condition of the Receiving Party's engagement on the HymnDesk Project.</p>
      <h3>1 Purpose</h3>
      <p>In the course of their engagement, the Receiving Party will be given access to confidential information belonging to the Company and the Project. This Agreement sets out how that information must be treated.</p>
      <h3>2 Confidential Information</h3>
      <p>Confidential Information means any information disclosed to or learned by the Receiving Party that is not in the public domain, including financial information, royalty figures and calculations, the identities and details of contributors, sponsors and funding partners, unreleased recordings, footage, edited content and musical arrangements, the Project's plans, schedules and internal communications, and the contents of the contributor tracker and royalty ledger.</p>
      <h3>3 Obligations</h3>
      <p>The Receiving Party must keep all Confidential Information strictly confidential, use it only for the purpose of performing their role, take reasonable care to protect it, and must not post or share it on any public platform. The Receiving Party must not copy or remove Confidential Information from the Project's systems except as required to perform their role.</p>
      <h3>4 Protection of Personal Information</h3>
      <p>The Receiving Party acknowledges that some Confidential Information may include personal information as defined in the Protection of Personal Information Act 4 of 2013, and must handle all such information lawfully and only for the purpose of the Project.</p>
      <h3>5 Duration</h3>
      <p>The obligations apply from the date of signing, continue for the duration of the engagement, and continue for three years after the engagement ends, except in respect of trade secrets and unreleased creative output, where they continue for as long as the information remains confidential.</p>
      <h3>6 Return of Information</h3>
      <p>On the ending of the engagement, or on the written request of the Company, the Receiving Party must return or destroy all Confidential Information in their possession and confirm in writing that they have done so.</p>
      <h3>7 Breach</h3>
      <p>A breach of this Agreement is a breach of the Independent Contractor Agreement and may result in the consequences set out there, including the forfeiture of royalties where the nature and severity of the breach justify it. The Company may pursue any remedy available in law, including an interdict and a claim for damages.</p>
      <h3>8 General</h3>
      <p>This Agreement is governed by the laws of the Republic of South Africa, subject to the jurisdiction of the High Court of South Africa, Gauteng Division. An electronic signature has the same legal effect as a handwritten signature under the Electronic Communications and Transactions Act 25 of 2002.</p>
      ${c.status === 'Signed'
        ? `<div class="box"><b>NDA accepted electronically by</b> ${esc(c.signed_full_name)} at ${esc(c.signed_place||'unspecified place')} on ${esc(fmtDate(c.signed_at))}, as part of signing this Agreement.</div>`
        : `<table class="sig"><tr><td><b>For the Company</b><br/><br/>Signature: ____________________<br/>Name: ${esc(COMPANY.rep)}<br/>Date: ____________</td><td><b>Receiving Party</b><br/><br/>Signature: ____________________<br/>Name: ${esc(c.full_name)}<br/>Place: ____________<br/>Date: ____________</td></tr></table>`}

      <p class="muted" style="margin-top:24px">Generated by HymnDesk Control. This document should be reviewed by a legal practitioner before reliance.</p>
      </body></html>`;
  }

  function exportContractPdf(c) {
    const w = window.open('', '_blank');
    if (!w) { toast('Allow pop-ups to download the PDF', 'error'); return; }
    w.document.write(buildContractHtml(c));
    w.document.close();
    setTimeout(() => { w.focus(); w.print(); }, 300);
  }

  // After signing, store a permanent self contained HTML copy of the signed
  // contract in the contracts bucket, under <user_id>/<filename>.
  async function storeSignedContractFile(c) {
    try {
      const html = buildContractHtml(c);
      const blob = new Blob([html], { type: 'text/html' });
      const path = `${c.user_id}/contract-${c.id}-signed-${Date.now()}.html`;
      const { error: upErr } = await supabase.storage.from('contracts').upload(path, blob, { contentType: 'text/html', upsert: true });
      if (upErr) throw upErr;
      await supabase.rpc('set_signed_contract_file', { p_contract_id: c.id, p_file_path: path });
    } catch (e) {
      // Non fatal: signing already succeeded; the file copy is a convenience.
      console.warn('Could not store signed contract file:', e.message || e);
    }
  }
})();
