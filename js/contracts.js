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
  let supabase = null, myUserId = null, myRole = null;
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
      supabase.from('users').select('role:roles(name)').eq('id', user.id).maybeSingle(),
      supabase.rpc('list_team_members'),
      supabase.rpc('list_contracts', { p_project_id: projectId() }),
    ]);
    myRole = pRes.data?.role?.name || null;
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
  function statusPill(s) {
    const map = { Draft:'text-stone-600 bg-stone-100 border-stone-200',
                  Sent:'text-amber-700 bg-amber-50 border-amber-200',
                  Signed:'text-emerald-700 bg-emerald-50 border-emerald-200' };
    return el('span', { class:`inline-flex items-center text-xs font-medium border rounded-full px-2 py-0.5 ${map[s]||map.Draft}` }, s || 'Draft');
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

    const list = el('div', { class:'space-y-2' });
    contracts.forEach(c => {
      list.appendChild(el('div', { class:'bg-white border border-stone-200 rounded-xl p-4 flex items-center justify-between gap-3' },
        el('div', { class:'min-w-0' },
          el('div', { class:'font-medium text-stone-900 truncate' }, c.full_name),
          el('div', { class:'text-xs text-stone-500 mt-0.5' }, `${c.role_name} · drafted ${fmtDate(c.created_at)}` + (c.signed_at ? ` · signed ${fmtDate(c.signed_at)}` : '')),
        ),
        el('div', { class:'flex items-center gap-3 shrink-0' },
          statusPill(c.status),
          el('button', { class:'text-xs text-brand-600 hover:text-brand-700', onclick: () => openContract(c.id) }, 'Open'),
        ),
      ));
    });
    wrap.appendChild(list);
    return wrap;
  }

  // ----- Draft flow -------------------------------------------------------
  function openDraft() {
    const overlay = el('div', { class:'fixed inset-0 z-50 bg-stone-900/50 flex items-end sm:items-center justify-center p-0 sm:p-4' });
    const dialog  = el('div', { class:'bg-white w-full sm:max-w-2xl sm:rounded-2xl rounded-t-2xl shadow-xl max-h-[95vh] flex flex-col' });
    overlay.appendChild(dialog);
    dialog.appendChild(el('div', { class:'px-5 py-4 border-b border-stone-200' },
      el('h3', { class:'text-base font-semibold' }, 'Draft a contract')));

    const body = el('div', { class:'flex-1 overflow-y-auto p-5 space-y-4' });

    const fMember = el('select', { class:'w-full rounded-lg border border-stone-300 px-3 py-2 text-sm bg-white' },
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

    const errBox = el('div', { class:'px-5 text-sm text-red-600', hidden:'' });
    dialog.appendChild(errBox);

    const saveBtn = el('button', { class:'px-4 py-2 text-sm rounded-lg bg-brand-500 hover:bg-brand-600 text-white font-medium' }, 'Generate draft');
    saveBtn.addEventListener('click', async () => {
      errBox.hidden = true;
      if (!selectedMember) { errBox.textContent = 'Select a member'; errBox.hidden = false; return; }
      const role = selectedMember.role?.name || selectedMember.role_name;
      saveBtn.disabled = true; saveBtn.textContent = 'Generating...';
      try {
        const expenses = Array.from(annexureRows.children).map(r => r._get()).filter(x => x.description);
        const sessionRate = fRateOn.checked ? Number(fRate.value || 0) : null;
        const body = buildContractBody({
          fullName: selectedMember.full_name, idNumber: fId.value.trim(), role,
          startDate: fStart.value || null, endDate: fEnd.value || null,
          contribution: Number(fContrib.value || 0), incentive: Number(fInc.value || 0),
          sessionRate, expenses,
        });
        // Persist the member's ID number back to their record for next time
        if (fId.value.trim()) {
          await supabase.from('users').update({ id_number: fId.value.trim() }).eq('id', selectedMember.id);
        }
        const { data: newId, error } = await supabase.rpc('draft_contract', {
          p_user_id: selectedMember.id,
          p_start_date: fStart.value || null,
          p_end_date: fEnd.value || null,
          p_contribution_percent: Number(fContrib.value || 0),
          p_incentive_percent: Number(fInc.value || 0),
          p_session_rate: sessionRate,
          p_contract_body: body,
          p_annexure_expenses: expenses,
          p_project_id: projectId(),
        });
        if (error) throw error;
        toast('Draft created', 'success');
        overlay.remove();
        await reload();
        openContract(newId);
      } catch (err) { errBox.textContent = err.message || 'Could not create draft'; errBox.hidden = false;
        saveBtn.disabled = false; saveBtn.textContent = 'Generate draft'; }
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
    dialog.appendChild(body);

    const footer = el('div', { class:'px-5 py-4 border-t border-stone-200 flex items-center justify-end gap-2 flex-wrap' });
    footer.appendChild(el('button', { class:'text-sm border border-stone-300 hover:bg-stone-50 px-4 py-2 rounded-lg',
      onclick: () => exportContractPdf(c) }, 'Download PDF'));
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

    // Signature state
    if (c.status === 'Signed') {
      wrap.appendChild(el('div', { class:'bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-emerald-800' },
        el('div', { class:'font-medium' }, 'Signed'),
        el('div', { class:'text-xs' }, `${c.signed_full_name} at ${c.signed_place || 'unspecified place'} on ${fmtDate(c.signed_at)}`)));
    } else {
      wrap.appendChild(el('div', { class:'text-xs text-stone-500' }, 'Not yet signed. Signing is done in app by the member.'));
    }
    return wrap;
  }

  // ----- Contract PDF (print to PDF) --------------------------------------
  function exportContractPdf(c) {
    const w = window.open('', '_blank');
    if (!w) { toast('Allow pop-ups to download the PDF', 'error'); return; }
    const b = c.contract_body || {};
    const duties = (b.responsibilities || []);
    const exp = (c.annexure_expenses || []);
    const dutyHtml = duties.map((d,i)=>`<p style="margin:4px 0 4px 18px">(${String.fromCharCode(97+i)}) ${esc(d)}</p>`).join('');
    const expHtml = exp.length
      ? exp.map(e=>`<tr><td style="padding:5px;border:1px solid #ddd">${esc(e.description)}</td><td style="padding:5px;border:1px solid #ddd">${esc(e.notes||'')}</td><td style="padding:5px;border:1px solid #ddd;text-align:right">${e.amount!=null?money(e.amount):''}</td></tr>`).join('')
      : '<tr><td colspan="3" style="padding:5px;border:1px solid #ddd;color:#888">No agreed expenses recorded.</td></tr>';
    const rateClause = c.session_rate != null
      ? `<p><b>Session rate.</b> The Contractor is paid ${money(c.session_rate)} for each production session they attend, as recorded in the session attendance register. The session rate is paid in addition to the Contribution Royalty and the Incentive Royalty and does not reduce either.</p>` : '';
    const signedHtml = c.status === 'Signed'
      ? `<p style="margin-top:8px"><b>Signed electronically</b> by ${esc(c.signed_full_name)} at ${esc(c.signed_place||'unspecified place')} on ${esc(fmtDate(c.signed_at))}, in accordance with the Electronic Communications and Transactions Act 25 of 2002.</p>`
      : `<p style="margin-top:8px;color:#888">Signature: ______________________   Place: ______________   Date: ____________</p>`;

    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Contract ${esc(c.full_name)}</title>
      <style>body{font-family:system-ui,Arial,sans-serif;max-width:720px;margin:36px auto;padding:0 22px;color:#1c1917;font-size:13px;line-height:1.5}
      .head{display:flex;align-items:center;gap:12px;border-bottom:2px solid #e7e5e4;padding-bottom:14px;margin-bottom:16px}
      h1{font-size:18px;margin:0} h2{font-size:14px;margin:18px 0 6px;color:#1c1917} .muted{color:#78716c;font-size:12px;margin:0}
      table{width:100%;border-collapse:collapse;font-size:12px;margin-top:6px}
      .box{background:#faf9f8;border:1px solid #e7e5e4;border-radius:8px;padding:10px;margin:8px 0}</style></head><body>
      <div class="head">
        <img src="https://control.hymndesk.co.za/icons/icon-192x192.png" alt="" style="width:44px;height:44px;border-radius:10px" />
        <div><h1>Independent Contractor Agreement</h1><p class="muted">${esc(COMPANY.name)} · ${esc(COMPANY.operating)}</p></div>
      </div>
      <div class="box"><b>Company:</b> ${esc(COMPANY.name)}, Reg ${esc(COMPANY.reg)}, represented by ${esc(COMPANY.rep)} (${esc(COMPANY.repRole)})<br/>
      <b>Contractor:</b> ${esc(c.full_name)}${c.id_number?', ID '+esc(c.id_number):''}<br/>
      <b>Role:</b> ${esc(c.role_name)} &nbsp; <b>Term:</b> ${esc(fmtDate(c.start_date))} to ${esc(fmtDate(c.end_date))}</div>

      <h2>2 Services</h2>
      <p>The Contractor is engaged in the capacity of ${esc(c.role_name)}. The specific responsibilities for this role are:</p>
      ${dutyHtml}

      <h2>5 Compensation and Royalty Model</h2>
      <p>The Contractor is compensated under a royalty based model made up of two separate royalty streams, being the Contribution Royalty and the Incentive Royalty. No fixed salary is payable.</p>
      <p>The royalty pool is set at fifty percent of the net revenue of the relevant income, after tax. The remaining fifty percent is allocated to operations and the project reserve.</p>
      <p><b>Contribution Royalty.</b> Earned from audio visual income, prorated by the production sessions in which the Contractor participated, tracked for every member. The Contractor's share is ${Number(c.contribution_percent).toFixed(2)} percent of the audio visual pool. It is retained for as long as the recordings earn, and is forfeited only on dismissal for gross misconduct.</p>
      <p><b>Incentive Royalty.</b> Earned from incentive income, being sponsorships, advertising on the HymnDesk application, and donations from application users. The Contractor's share is ${Number(c.incentive_percent).toFixed(2)} percent of the incentive pool. It is payable only while the Contractor is an active member and is automatically forfeited from the date they cease to be active, for any reason.</p>
      ${rateClause}

      <h2>Annexure A: Agreed Expense Schedule</h2>
      <table><tr><th style="padding:5px;border:1px solid #ddd;text-align:left">Description</th><th style="padding:5px;border:1px solid #ddd;text-align:left">Notes</th><th style="padding:5px;border:1px solid #ddd;text-align:right">Amount</th></tr>${expHtml}</table>

      <h2>Signature</h2>
      ${signedHtml}
      <p class="muted" style="margin-top:24px">This is a working copy generated by HymnDesk Control. The full agreement includes the standard terms and the Non Disclosure Agreement at Annexure B.</p>
      </body></html>`);
    w.document.close();
    setTimeout(() => { w.focus(); w.print(); }, 300);
  }
})();
