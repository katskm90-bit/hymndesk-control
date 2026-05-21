// ============================================================================
// HymnDesk Control · Hymns Catalogue
// ----------------------------------------------------------------------------
// Browses the full hymn reference library across all books and languages.
// Filters: book, language, status (for active project), free text search.
// Clicking a hymn opens an editor that shows the recording state for the
// CURRENTLY ACTIVE project. Catalogue rows themselves (number, title, book,
// language, classification) are project-agnostic.
// ============================================================================

(function () {
  'use strict';

  const M = {};
  window.HD_Hymns = M;

  let supabase = null;
  let myRole = null;
  let books = [];
  let languages = [];
  let statuses = [];
  let sessions = [];
  let hymns = [];

  let filterBook     = '';
  let filterLanguage = '';
  let filterStatus   = '';
  let filterText     = '';
  const PAGE_SIZE = 100;
  let page = 0;
  let hasMore = false;

  // ----- DOM helpers ------------------------------------------------------
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
  function lab(t, ctrl) { return el('div', null, el('label', { class: 'block text-sm font-medium text-stone-700 mb-1' }, t), ctrl); }
  function canManageHymn()    { return ['Admin','Project Manager','Director / Producer'].includes(myRole); }
  function canManageRecording(){ return ['Admin','Project Manager','Director / Producer'].includes(myRole); }

  // ----- Data load --------------------------------------------------------
  async function loadDependencies() {
    const { data: { user } } = await supabase.auth.getUser();
    const { data: prof } = await supabase.from('users').select('role:roles(name)').eq('id', user.id).maybeSingle();
    myRole = prof?.role?.name || null;

    const [bRes, lRes, stRes, sRes] = await Promise.all([
      supabase.from('books').select('id, name, language_id, hymn_count_expected, sort_order, is_active').eq('is_active',true).order('sort_order'),
      supabase.from('languages').select('id, name, sort_order, is_active').eq('is_active',true).order('sort_order'),
      supabase.from('lookups').select('id, value, sort_order').eq('domain','workflow_state').eq('is_active',true).order('sort_order'),
      supabase.from('production_sessions').select('id, name, session_number, scheduled_date, project_id').order('sort_order'),
    ]);
    if (bRes.error) throw bRes.error;
    if (lRes.error) throw lRes.error;
    if (stRes.error) throw stRes.error;
    if (sRes.error) throw sRes.error;
    books     = bRes.data || [];
    languages = lRes.data || [];
    statuses  = stRes.data || [];
    sessions  = (sRes.data || []).filter(s => !window.HD_Project || s.project_id === window.HD_Project.getId());
  }

  async function loadHymnsPage() {
    const projectId = window.HD_Project ? window.HD_Project.getId() : null;
    const { data, error } = await supabase.rpc('list_hymns', {
      p_book_id:     filterBook || null,
      p_language_id: filterLanguage || null,
      p_search:      filterText || null,
      p_project_id:  projectId,
      p_session_id:  null,
      p_status:      filterStatus || null,
      p_limit:       PAGE_SIZE,
      p_offset:      page * PAGE_SIZE,
    });
    if (error) throw error;
    const rows = data || [];
    hasMore = rows.length === PAGE_SIZE;
    if (page === 0) hymns = rows;
    else hymns = hymns.concat(rows);
  }

  // ----- Public render ----------------------------------------------------
  M.render = async function (container, opts) {
    supabase = opts.supabase;
    container.innerHTML = '<div class="text-sm text-stone-500">Loading hymns...</div>';
    try {
      await loadDependencies();
      page = 0;
      hymns = [];
      await loadHymnsPage();
      container.innerHTML = '';
      container.appendChild(renderPage());
    } catch (err) {
      container.innerHTML = '';
      container.appendChild(el('div', { class:'bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 text-sm' },
        'Could not load: ' + (err.message || err)));
    }
  };

  function renderPage() {
    const wrap = el('div', { class: 'space-y-6' });

    // Header
    wrap.appendChild(el('div', { class:'flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3' },
      el('div', null,
        el('h2', { class:'text-xl lg:text-2xl font-bold text-stone-900' }, 'Hymns Catalogue'),
        el('p', { class:'text-sm text-stone-500 mt-1' },
          `${hymns.length}${hasMore ? '+' : ''} hymn${hymns.length === 1 ? '' : 's'}`),
      ),
      canManageHymn() ? el('button', {
        class: 'inline-flex items-center gap-2 bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium px-4 py-2 rounded-lg',
        onclick: () => openHymnDialog(null),
      }, '+ Add hymn') : null,
    ));

    // Books summary tiles (clickable filters)
    const tiles = el('div', { class:'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2' });
    books.forEach(b => {
      const lang = languages.find(l => l.id === b.language_id);
      const active = filterBook === b.id;
      tiles.appendChild(el('button', {
        class: `text-left p-3 rounded-lg border transition-colors ${active ? 'bg-brand-50 border-brand-300 text-brand-700' : 'bg-white border-stone-200 hover:border-brand-300'}`,
        onclick: () => { filterBook = active ? '' : b.id; page = 0; reload(); },
      },
        el('div', { class: 'text-xs text-stone-500 truncate' }, lang?.name || ''),
        el('div', { class: 'text-sm font-medium truncate' }, b.name),
        el('div', { class: 'text-xs text-stone-500 mt-0.5' }, `${b.hymn_count_expected || '?'} hymns`),
      ));
    });
    wrap.appendChild(tiles);

    // Filters
    const filters = el('div', { class: 'bg-white border border-stone-200 rounded-xl p-3 grid grid-cols-1 sm:grid-cols-4 gap-2' });
    const search = el('input', { type:'search', placeholder:'Search by number or title', value:filterText,
      class:'rounded-lg border border-stone-300 px-3 py-2 text-sm' });
    let searchTimer;
    search.addEventListener('input', e => {
      filterText = e.target.value;
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => { page = 0; reload(); }, 300);
    });

    const bookSel = el('select', { class:'rounded-lg border border-stone-300 px-3 py-2 text-sm bg-white' },
      el('option', { value:'' }, 'All books'),
      ...books.map(b => el('option', { value:b.id, selected: b.id === filterBook ? '' : null }, b.name)),
    );
    bookSel.addEventListener('change', e => { filterBook = e.target.value; page = 0; reload(); });

    const langSel = el('select', { class:'rounded-lg border border-stone-300 px-3 py-2 text-sm bg-white' },
      el('option', { value:'' }, 'All languages'),
      ...languages.map(l => el('option', { value:l.id, selected: l.id === filterLanguage ? '' : null }, l.name)),
    );
    langSel.addEventListener('change', e => { filterLanguage = e.target.value; page = 0; reload(); });

    const statSel = el('select', { class:'rounded-lg border border-stone-300 px-3 py-2 text-sm bg-white' },
      el('option', { value:'' }, 'All recording statuses'),
      ...statuses.map(s => el('option', { value:s.value, selected: s.value === filterStatus ? '' : null }, s.value)),
    );
    statSel.addEventListener('change', e => { filterStatus = e.target.value; page = 0; reload(); });

    filters.append(search, bookSel, langSel, statSel);
    wrap.appendChild(filters);

    // Table
    const tableHost = el('div');
    wrap.appendChild(tableHost);
    renderTable(tableHost);

    return wrap;
  }

  function renderTable(host) {
    host.innerHTML = '';
    if (hymns.length === 0) {
      host.appendChild(el('div', { class: 'bg-white border border-stone-200 rounded-xl p-8 text-center text-sm text-stone-500' },
        'No hymns match the current filters.'));
      return;
    }

    // Desktop table
    const table = el('div', { class: 'hidden md:block bg-white border border-stone-200 rounded-xl overflow-hidden' });
    table.appendChild(el('div', { class: 'grid grid-cols-12 gap-2 px-4 py-3 bg-stone-50 border-b border-stone-200 text-xs font-medium text-stone-500 uppercase tracking-wide' },
      el('div', { class: 'col-span-1' }, '#'),
      el('div', { class: 'col-span-4' }, 'Title'),
      el('div', { class: 'col-span-3' }, 'Book'),
      el('div', { class: 'col-span-2' }, 'Language'),
      el('div', { class: 'col-span-2' }, 'Recording'),
    ));
    hymns.forEach(h => {
      table.appendChild(el('div', {
        class: 'grid grid-cols-12 gap-2 px-4 py-3 border-b border-stone-100 last:border-b-0 hover:bg-stone-50 text-sm items-center cursor-pointer',
        onclick: () => openHymnDialog(h),
      },
        el('div', { class: 'col-span-1 text-stone-700 font-medium' }, h.hymn_number != null ? String(h.hymn_number) : '—'),
        el('div', { class: 'col-span-4 min-w-0' },
          el('div', { class: 'font-medium text-stone-900 truncate' }, h.hymn_title || '—'),
          h.recording_youtube_url ? el('div', { class: 'text-xs text-brand-600 truncate' }, 'YouTube linked') : null,
        ),
        el('div', { class: 'col-span-3 text-stone-600 truncate' }, h.book_name || '—'),
        el('div', { class: 'col-span-2 text-stone-600 truncate' }, h.language_name || '—'),
        el('div', { class: 'col-span-2' }, statusPill(h.recording_status)),
      ));
    });
    host.appendChild(table);

    // Mobile cards
    const cards = el('div', { class: 'md:hidden space-y-3' });
    hymns.forEach(h => {
      cards.appendChild(el('div', {
        class: 'bg-white border border-stone-200 rounded-xl p-4',
        onclick: () => openHymnDialog(h),
      },
        el('div', { class: 'flex items-start justify-between gap-2' },
          el('div', { class: 'min-w-0 flex-1' },
            el('div', { class:'flex items-center gap-2' },
              el('span', { class: 'text-xs font-medium text-stone-500' }, '#' + (h.hymn_number ?? '—')),
              el('span', { class: 'font-medium text-stone-900 truncate' }, h.hymn_title || '—'),
            ),
            el('div', { class: 'text-xs text-stone-500 mt-0.5' },
              [h.book_name, h.language_name].filter(Boolean).join(' · ') || '—'),
          ),
          statusPill(h.recording_status),
        ),
      ));
    });
    host.appendChild(cards);

    // Load-more button
    if (hasMore) {
      host.appendChild(el('div', { class: 'mt-4 text-center' },
        el('button', { class: 'text-sm px-4 py-2 rounded-lg border border-stone-300 hover:bg-stone-50',
          onclick: async () => {
            page += 1;
            try {
              await loadHymnsPage();
              renderTable(host);
              // Update the count in the header
              const countEl = document.querySelector('#page-content p.text-sm.text-stone-500');
              if (countEl) countEl.textContent = `${hymns.length}${hasMore ? '+' : ''} hymn${hymns.length === 1 ? '' : 's'}`;
            } catch (err) {
              toast(err.message || 'Could not load more', 'error');
            }
          }
        }, `Load next ${PAGE_SIZE}`),
      ));
    }
  }

  function statusPill(s) {
    const map = {
      'Edit Complete':'text-emerald-700 bg-emerald-50 border-emerald-200',
      'Uploaded to YouTube':'text-emerald-700 bg-emerald-50 border-emerald-200',
      'Edit In Progress':'text-blue-700 bg-blue-50 border-blue-200',
      'In Progress':'text-blue-700 bg-blue-50 border-blue-200',
      'Footage Uploaded':'text-indigo-700 bg-indigo-50 border-indigo-200',
      'Not Started':'text-stone-600 bg-stone-100 border-stone-200',
    };
    const cls = map[s] || 'text-stone-500 bg-stone-50 border-stone-200';
    return el('span', { class: `inline-flex items-center text-xs font-medium border rounded-full px-2 py-0.5 ${cls}` },
      s || 'Not recorded');
  }

  // ----- Hymn dialog ------------------------------------------------------
  function openHymnDialog(existing) {
    const isEdit = !!existing;
    const overlay = el('div', { class: 'fixed inset-0 z-40 bg-stone-900/50 flex items-end sm:items-center justify-center p-0 sm:p-4' });
    const dialog  = el('div', { class: 'bg-white w-full sm:max-w-2xl sm:rounded-2xl rounded-t-2xl shadow-xl max-h-[95vh] flex flex-col' });
    overlay.appendChild(dialog);

    const projectName = (window.HD_Project && window.HD_Project.current()?.name) || 'current project';

    dialog.appendChild(el('div', { class:'px-5 py-4 border-b border-stone-200 flex items-start justify-between' },
      el('div', null,
        el('h3', { class:'text-base font-semibold' }, isEdit ? (existing.hymn_title || 'Hymn') : 'New hymn'),
        el('p', { class:'text-xs text-stone-500 mt-0.5' },
          isEdit ? `${existing.book_name || ''} · #${existing.hymn_number ?? ''}` : 'Catalogue entry'),
      ),
      el('button', { class:'p-1.5 rounded-lg hover:bg-stone-100',
        html: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="6" y1="6" x2="18" y2="18"/><line x1="6" y1="18" x2="18" y2="6"/></svg>',
        onclick: () => overlay.remove() }),
    ));

    const body = el('div', { class:'flex-1 overflow-y-auto p-5 space-y-4' });

    // ----- Catalogue fields ----------
    const fNum = el('input', { type:'number', class:'w-full rounded-lg border border-stone-300 px-3 py-2 text-sm', value: existing?.hymn_number ?? '' });
    const fTitle = el('input', { type:'text', required:'', class:'w-full rounded-lg border border-stone-300 px-3 py-2 text-sm', value: existing?.hymn_title || '' });
    const fBook = el('select', { class:'w-full rounded-lg border border-stone-300 px-3 py-2 text-sm bg-white' },
      el('option', { value:'' }, '—'),
      ...books.map(b => el('option', { value:b.id, selected: b.id === existing?.book_id ? '' : null }, b.name)));
    const fLang = el('select', { class:'w-full rounded-lg border border-stone-300 px-3 py-2 text-sm bg-white' },
      el('option', { value:'' }, '—'),
      ...languages.map(l => el('option', { value:l.id, selected: l.id === existing?.language_id ? '' : null }, l.name)));
    const fClass = el('select', { class:'w-full rounded-lg border border-stone-300 px-3 py-2 text-sm bg-white' },
      el('option', { value:'' }, '—'),
      el('option', { value:'common',   selected: existing?.classification === 'common'   ? '' : null }, 'Common'),
      el('option', { value:'uncommon', selected: existing?.classification === 'uncommon' ? '' : null }, 'Uncommon'),
    );

    body.appendChild(el('div', null,
      el('h4', { class:'text-xs font-semibold text-stone-500 uppercase tracking-wide mb-2' }, 'Catalogue'),
      el('div', { class:'space-y-3' },
        el('div', { class:'grid grid-cols-3 gap-3' }, lab('Number', fNum), lab('Classification', fClass), el('div', null)),
        lab('Title', fTitle),
        el('div', { class:'grid grid-cols-2 gap-3' }, lab('Book', fBook), lab('Language', fLang)),
      ),
    ));

    // ----- Recording state (only when editing) ----------
    let fRecSession, fRecStatus, fRecYT, fRecShot, fRecEdit, fRecUp, fRecNotes;
    if (isEdit) {
      fRecSession = el('select', { class:'w-full rounded-lg border border-stone-300 px-3 py-2 text-sm bg-white' },
        el('option', { value:'' }, 'Not yet scheduled'),
        ...sessions.map(s => el('option', { value:s.id, selected: s.id === existing.recording_session_id ? '' : null },
          (s.session_number ? `Session ${s.session_number}: ` : '') + s.name)));
      fRecStatus = el('select', { class:'w-full rounded-lg border border-stone-300 px-3 py-2 text-sm bg-white' },
        el('option', { value:'' }, '—'),
        ...statuses.map(st => el('option', { value:st.id, selected: st.id === existing.recording_status_lookup_id ? '' : null }, st.value)));
      fRecYT = el('input', { type:'url', placeholder:'https://youtube.com/watch?v=...',
        class:'w-full rounded-lg border border-stone-300 px-3 py-2 text-sm', value: existing.recording_youtube_url || '' });
      fRecShot = el('input', { type:'date', class:'w-full rounded-lg border border-stone-300 px-3 py-2 text-sm', value: existing.recording_shot_date || '' });
      fRecEdit = el('input', { type:'date', class:'w-full rounded-lg border border-stone-300 px-3 py-2 text-sm', value: existing.recording_edited_date || '' });
      fRecUp   = el('input', { type:'date', class:'w-full rounded-lg border border-stone-300 px-3 py-2 text-sm', value: existing.recording_uploaded_date || '' });
      fRecNotes = el('textarea', { rows:'2', class:'w-full rounded-lg border border-stone-300 px-3 py-2 text-sm' }, existing.recording_notes || '');

      body.appendChild(el('div', null,
        el('h4', { class:'text-xs font-semibold text-stone-500 uppercase tracking-wide mb-2' }, `Recording state — ${projectName}`),
        el('div', { class:'space-y-3' },
          el('div', { class:'grid grid-cols-2 gap-3' }, lab('Session', fRecSession), lab('Workflow status', fRecStatus)),
          lab('YouTube URL', fRecYT),
          el('div', { class:'grid grid-cols-3 gap-3' }, lab('Shot date', fRecShot), lab('Edited date', fRecEdit), lab('Uploaded date', fRecUp)),
          lab('Recording notes', fRecNotes),
        ),
      ));
    }

    const errBox = el('div', { class:'text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3', hidden:'' });
    body.appendChild(errBox);
    dialog.appendChild(body);

    const submitBtn = el('button', { class:'px-4 py-2 text-sm rounded-lg bg-brand-500 hover:bg-brand-600 text-white font-medium' },
      isEdit ? 'Save' : 'Create');
    submitBtn.addEventListener('click', async () => {
      errBox.hidden = true;
      if (!fTitle.value.trim()) { errBox.textContent = 'Title required'; errBox.hidden = false; return; }
      submitBtn.disabled = true; submitBtn.textContent = 'Saving...';
      try {
        // Step 1: save catalogue
        const { data: hymnId, error: he } = await supabase.rpc('upsert_hymn', {
          p_id:             existing?.id || null,
          p_hymn_number:    fNum.value === '' ? null : Number(fNum.value),
          p_hymn_title:     fTitle.value.trim(),
          p_language_id:    fLang.value || null,
          p_book_id:        fBook.value || null,
          p_classification: fClass.value || null,
          p_notes:          null,
        });
        if (he) throw he;

        // Step 2 (edit only): save recording state for active project
        if (isEdit && window.HD_Project) {
          const projectId = window.HD_Project.getId();
          const { error: re } = await supabase.rpc('upsert_hymn_recording', {
            p_hymn_id:           existing.id,
            p_project_id:        projectId,
            p_session_id:        fRecSession.value || null,
            p_status_lookup_id:  fRecStatus.value || null,
            p_youtube_url:       fRecYT.value.trim() || null,
            p_shot_date:         fRecShot.value || null,
            p_edited_date:       fRecEdit.value || null,
            p_uploaded_date:     fRecUp.value || null,
            p_notes:             fRecNotes.value.trim() || null,
          });
          if (re) throw re;
        }

        toast(isEdit ? 'Saved' : 'Hymn added', 'success');
        overlay.remove();
        reload();
      } catch (err) {
        errBox.textContent = err.message || 'Could not save';
        errBox.hidden = false;
        submitBtn.disabled = false; submitBtn.textContent = isEdit ? 'Save' : 'Create';
      }
    });

    dialog.appendChild(el('div', { class:'px-5 py-4 border-t border-stone-200 flex items-center justify-end gap-2 sticky bottom-0 bg-white' },
      el('button', { class:'px-4 py-2 text-sm rounded-lg hover:bg-stone-100', onclick: () => overlay.remove() }, 'Cancel'),
      submitBtn,
    ));

    document.body.appendChild(overlay);
    if (!isEdit) fTitle.focus();
  }

  async function reload() {
    const main = document.getElementById('page-content');
    if (!main) return;
    main.innerHTML = '<div class="text-sm text-stone-500">Loading hymns...</div>';
    try {
      await loadDependencies();
      page = 0;
      hymns = [];
      await loadHymnsPage();
      main.innerHTML = '';
      main.appendChild(renderPage());
    } catch (err) {
      main.innerHTML = '';
      main.appendChild(el('div', { class:'bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 text-sm' },
        'Could not load: ' + (err.message || err)));
    }
  }
})();
