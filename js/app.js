// ============================================================================
// HymnDesk Control · App
// ----------------------------------------------------------------------------
// Skeleton only. Handles:
//   • Supabase Auth login, sign out, password reset
//   • Profile and role load from public.users → public.roles
//   • Hash-based routing for the 17 modules (placeholders for now)
//   • Mobile-friendly sidebar
// No module business logic yet.
// ============================================================================

(function () {
  'use strict';

  // ----- Module catalogue ----------------------------------------------------
  // Order matches the brief. Each module is rendered as a placeholder for now.
  // "roles" lists the roles that can see this module (null = everyone).
  const MODULES = [
    { id: 'home',         title: 'Home',                       icon: 'home',    roles: null },
    { id: 'admin-dash',   title: 'Founder and Admin Dashboard', icon: 'gauge',   roles: ['Admin','Project Manager'] },
    { id: 'mytasks',      title: 'My Tasks',                    icon: 'check',   roles: null },
    { id: 'taskboard',    title: 'Task Status Board',           icon: 'columns', roles: ['Admin','Project Manager'] },
    { id: 'inventory',    title: 'Inventory',                   icon: 'box',     roles: ['Admin','Project Manager','Director / Producer','Videography / Editing Lead','Sound Engineer'] },
    { id: 'tasks',        title: 'Master Task Tracker',         icon: 'list',    roles: null },
    { id: 'phases',       title: 'Project Phases',              icon: 'flag',    roles: null },
    { id: 'sessions',     title: 'Production Schedule',         icon: 'film',    roles: null },
    { id: 'hymns',        title: 'Hymns Catalogue',             icon: 'music',   roles: null },
    { id: 'team',         title: 'Team Register',               icon: 'users',   roles: null },
    { id: 'contracts',    title: 'Contracts',                   icon: 'fileText', roles: null },
    { id: 'royalty',      title: 'Royalty Framework',           icon: 'coins',   roles: ['Admin','Finance','Project Manager','Talent'] },
    { id: 'expenses',     title: 'Member Expenses',             icon: 'receipt', roles: null },
    { id: 'budget',       title: 'Budget Tracker',              icon: 'chart',   roles: ['Admin','Finance','Project Manager'] },
    { id: 'income',       title: 'Income Streams',              icon: 'arrow-up',roles: ['Admin','Finance','Project Manager'] },
    { id: 'sponsorship',  title: 'Sponsorship Pipeline',        icon: 'briefcase', roles: ['Admin','Sponsorship Manager','Project Manager','Finance'] },
    { id: 'marketing',    title: 'Marketing and YouTube',       icon: 'megaphone',roles: ['Admin','Marketing','Project Manager'] },
    { id: 'beta',         title: 'Beta Testing',                icon: 'flask',   roles: ['Admin','Project Manager','Product Development Manager'] },
    { id: 'app-dev',      title: 'App Development Roadmap',     icon: 'code',    roles: ['Admin','Product Development Manager','Project Manager'] },
    { id: 'risks',        title: 'Risk Register',               icon: 'shield',  roles: ['Admin','Project Manager','Finance'] },
    { id: 'advices',      title: 'Payment Advices and Statements', icon: 'file-text', roles: ['Admin','Finance'] },
    { id: 'agm',          title: 'Annual AGM',                  icon: 'calendar',roles: ['Admin','Project Manager','Finance'] }
  ];

  // Simple icon set as inline SVG strings
  const ICONS = {
    home:      '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12l9-9 9 9"/><path d="M5 10v10h14V10"/></svg>',
    gauge:     '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="13" r="8"/><path d="M12 13l4-4"/></svg>',
    list:      '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><circle cx="4" cy="6" r="1"/><circle cx="4" cy="12" r="1"/><circle cx="4" cy="18" r="1"/></svg>',
    check:     '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>',
    flag:      '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 21V4h12l-2 4 2 4H4"/></svg>',
    film:      '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="7" y1="3" x2="7" y2="21"/><line x1="17" y1="3" x2="17" y2="21"/><line x1="3" y1="12" x2="21" y2="12"/></svg>',
    users:     '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="8" r="3"/><path d="M3 20c0-3 3-5 6-5s6 2 6 5"/><circle cx="17" cy="8" r="2"/><path d="M21 20c0-2-1.5-3.5-4-4"/></svg>',
    coins:     '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><ellipse cx="9" cy="7" rx="6" ry="3"/><path d="M3 7v6c0 1.7 2.7 3 6 3"/><ellipse cx="15" cy="14" rx="6" ry="3"/><path d="M9 14v6c0 1.7 2.7 3 6 3"/></svg>',
    fileText:  '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M8 13h8M8 17h8"/></svg>',
    columns:   '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="6" height="18" rx="1"/><rect x="15" y="3" width="6" height="18" rx="1"/></svg>',
    box:       '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></svg>',
    receipt:   '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 3v18l3-2 3 2 3-2 3 2 3-2V3"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="9" y1="12" x2="15" y2="12"/></svg>',
    chart:     '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="21" x2="21" y2="21"/><rect x="6" y="11" width="3" height="9"/><rect x="11" y="6" width="3" height="14"/><rect x="16" y="14" width="3" height="6"/></svg>',
    'arrow-up':'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>',
    briefcase: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5a2 2 0 012-2h2a2 2 0 012 2v2"/></svg>',
    megaphone: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 11v3l13 5V6L3 11z"/><path d="M16 9a4 4 0 010 7"/></svg>',
    flask:     '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 3h6"/><path d="M10 3v6L4 19a2 2 0 002 3h12a2 2 0 002-3l-6-10V3"/></svg>',
    code:      '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>',
    shield:    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3l8 3v6c0 5-3.5 8.5-8 9-4.5-0.5-8-4-8-9V6l8-3z"/></svg>',
    'file-text':'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 3H6a2 2 0 00-2 2v14a2 2 0 002 2h12a2 2 0 002-2V9l-6-6z"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="15" y2="17"/></svg>',
    calendar:  '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="5" width="18" height="16" rx="2"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="8" y1="3" x2="8" y2="7"/><line x1="16" y1="3" x2="16" y2="7"/></svg>',
    music:     '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>'
  };

  // ----- State ---------------------------------------------------------------
  const state = {
    supabase: null,
    session: null,
    profile: null,        // row from public.users
    role: null            // row from public.roles
  };


  // ----- Helpers -------------------------------------------------------------
  const $ = (id) => document.getElementById(id);
  const show = (id) => { $(id).hidden = false; };
  const hide = (id) => { $(id).hidden = true; };

  function setErr(id, msg) {
    const el = $(id);
    el.textContent = msg;
    el.hidden = !msg;
  }

  // Wraps a fetch-like async call with a 20-second abort timeout
  async function withTimeout(promise, ms = 20000) {
    let timer;
    const timeout = new Promise((_, rej) => {
      timer = setTimeout(() => rej(new Error('Request timed out. Please try again.')), ms);
    });
    try {
      return await Promise.race([promise, timeout]);
    } finally {
      clearTimeout(timer);
    }
  }

  // Friendly Supabase error messages
  function friendlyAuthError(err) {
    const m = (err && err.message) || 'Something went wrong. Please try again.';
    if (/invalid login credentials/i.test(m)) return 'That email and password did not match. Please try again.';
    if (/email not confirmed/i.test(m)) return 'Your email is not confirmed yet. Please check your inbox.';
    if (/network/i.test(m)) return 'Network problem. Check your connection and try again.';
    return m;
  }


  // ----- Boot ----------------------------------------------------------------
  async function boot() {
    // Sanity check config
    if (!window.HD_CONFIG || /YOUR_PROJECT_REF|YOUR_ANON_KEY/.test(window.HD_CONFIG.SUPABASE_URL + window.HD_CONFIG.SUPABASE_ANON_KEY)) {
      document.body.innerHTML =
        '<div style="font-family:system-ui;padding:2rem;max-width:480px;margin:2rem auto;border:1px solid #fcc;background:#fff5f5;border-radius:8px;">' +
        '<h2 style="margin:0 0 0.5rem 0;color:#c00;">Configuration required</h2>' +
        '<p>Edit <code>js/config.js</code> and paste your Supabase project URL and anon key, then refresh.</p>' +
        '</div>';
      return;
    }

    $('app-version').textContent = window.HD_CONFIG.APP_VERSION || '';

    // Initialise Supabase client
    state.supabase = window.supabase.createClient(
      window.HD_CONFIG.SUPABASE_URL,
      window.HD_CONFIG.SUPABASE_ANON_KEY,
      {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
      }
    );

    // Detect password recovery redirect (Supabase Auth puts the token in the URL hash)
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    if (hashParams.get('type') === 'recovery') {
      // Wait for Supabase to read the hash, then show set-password screen
      state.supabase.auth.onAuthStateChange((event) => {
        if (event === 'PASSWORD_RECOVERY') {
          showAuthScreen('set-password');
        }
      });
      hide('boot-screen');
      return;
    }

    // Check existing session
    const { data: { session } } = await state.supabase.auth.getSession();
    if (session) {
      state.session = session;
      await loadProfileAndRender();
    } else {
      showAuthScreen('login');
    }
  }


  // ----- Auth screens --------------------------------------------------------
  function showAuthScreen(which) {
    hide('boot-screen');
    hide('app-shell');
    show('auth-screen');

    // Hide all forms in the auth screen, then show the one we want
    ['login-form','forgot-form','set-password-form'].forEach((id) => $(id).hidden = true);
    const map = { login: 'login-form', forgot: 'forgot-form', 'set-password': 'set-password-form' };
    show(map[which] || 'login-form');

    // Reset any error states
    ['login-error','forgot-message','set-password-error'].forEach((id) => $(id).hidden = true);
  }


  // ----- Login ---------------------------------------------------------------
  async function handleLogin(e) {
    e.preventDefault();
    setErr('login-error', '');
    const email = $('login-email').value.trim();
    const password = $('login-password').value;
    const btn = $('login-submit');
    btn.disabled = true;
    btn.textContent = 'Signing in...';
    try {
      const { data, error } = await withTimeout(
        state.supabase.auth.signInWithPassword({ email, password })
      );
      if (error) throw error;
      state.session = data.session;
      await loadProfileAndRender();
    } catch (err) {
      setErr('login-error', friendlyAuthError(err));
    } finally {
      btn.disabled = false;
      btn.textContent = 'Sign in';
    }
  }


  // ----- Forgot password -----------------------------------------------------
  async function handleForgot(e) {
    e.preventDefault();
    const email = $('forgot-email').value.trim();
    const btn = $('forgot-submit');
    btn.disabled = true;
    btn.textContent = 'Sending...';
    try {
      const redirectTo = window.location.origin + window.location.pathname;
      const { error } = await withTimeout(
        state.supabase.auth.resetPasswordForEmail(email, { redirectTo })
      );
      if (error) throw error;
      const el = $('forgot-message');
      el.textContent = 'If that email is registered, a reset link has been sent. Please check your inbox.';
      el.hidden = false;
    } catch (err) {
      const el = $('forgot-message');
      el.textContent = friendlyAuthError(err);
      el.hidden = false;
    } finally {
      btn.disabled = false;
      btn.textContent = 'Send reset link';
    }
  }


  // ----- Set password (after invite or reset) --------------------------------
  async function handleSetPassword(e) {
    e.preventDefault();
    setErr('set-password-error', '');
    const pwd = $('new-password').value;
    const cnf = $('confirm-password').value;
    if (pwd !== cnf) {
      setErr('set-password-error', 'The two passwords do not match.');
      return;
    }
    const btn = $('set-password-submit');
    btn.disabled = true;
    btn.textContent = 'Saving...';
    try {
      const { error } = await withTimeout(
        state.supabase.auth.updateUser({ password: pwd })
      );
      if (error) throw error;
      const { data: { session } } = await state.supabase.auth.getSession();
      if (session) {
        state.session = session;
        await loadProfileAndRender();
      } else {
        showAuthScreen('login');
      }
    } catch (err) {
      setErr('set-password-error', friendlyAuthError(err));
    } finally {
      btn.disabled = false;
      btn.textContent = 'Save password and continue';
    }
  }


  // ----- Profile and role load -----------------------------------------------
  async function loadProfileAndRender() {
    try {
      const userId = state.session.user.id;
      const { data: profile, error: pErr } = await state.supabase
        .from('users')
        .select('id, email, full_name, role_id, department, is_active')
        .eq('id', userId)
        .maybeSingle();

      if (pErr) throw pErr;

      if (!profile) {
        // Auth user exists but no public.users row. This means the invitation
        // accept flow was not completed, or this user was created in the dashboard
        // without a profile row. Sign them out with a clear message.
        await state.supabase.auth.signOut();
        showAuthScreen('login');
        setErr('login-error', 'Your account has no profile yet. Please ask the Admin to complete your invitation.');
        return;
      }

      if (!profile.is_active) {
        await state.supabase.auth.signOut();
        showAuthScreen('login');
        setErr('login-error', 'Your account is currently inactive. Please contact the Admin.');
        return;
      }

      const { data: role, error: rErr } = await state.supabase
        .from('roles')
        .select('id, name, description, default_permissions')
        .eq('id', profile.role_id)
        .maybeSingle();
      if (rErr) throw rErr;

      state.profile = profile;
      state.role = role || { name: 'Unknown', description: '', default_permissions: {} };

      // Initialize the active project (loads list, picks a default if none set)
      if (window.HD_Project) {
        await window.HD_Project.init(state.supabase);
      }

      renderApp();
    } catch (err) {
      console.error('Profile load failed', err);
      await state.supabase.auth.signOut();
      showAuthScreen('login');
      setErr('login-error', friendlyAuthError(err));
    }
  }


  // ----- Render app shell ----------------------------------------------------
  function renderApp() {
    hide('boot-screen');
    hide('auth-screen');
    show('app-shell');

    $('user-name').textContent = state.profile.full_name || state.profile.email;
    $('user-role').textContent = state.role.name;

    renderProjectPicker();
    renderSidebar();

    // Notifications bell in the header
    if (window.HD_Notifications) window.HD_Notifications.mount({ supabase: state.supabase });

    // Re-render the current page whenever the active project changes
    if (window.HD_Project && !state._projectListenerWired) {
      window.HD_Project.onChange(() => {
        renderProjectPicker();
        if (window.HD_Notifications) window.HD_Notifications.refresh();
        handleRouteChange();
      });
      state._projectListenerWired = true;
    }

    handleRouteChange();
  }

  function renderProjectPicker() {
    const host = $('project-picker');
    if (!host || !window.HD_Project) return;
    const list = window.HD_Project.all();
    const current = window.HD_Project.current();
    if (!list || list.length === 0) { host.innerHTML = ''; return; }

    if (list.length === 1) {
      const isAdmin = state.role && state.role.name === 'Admin';
      host.innerHTML = '';
      const badge = document.createElement('span');
      badge.className = 'inline-flex items-center gap-1.5 text-xs bg-brand-50 border border-brand-200 text-brand-700 rounded-full px-2.5 py-1' + (isAdmin ? ' cursor-pointer hover:bg-brand-100' : '');
      badge.title = isAdmin ? 'Click to rename this project' : 'Active project';
      badge.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M9 12l2 2 4-4"/></svg>
        <span class="hidden sm:inline">${escapeHtml(current?.name || 'Project')}</span>
        <span class="sm:hidden">${escapeHtml(current?.code || 'project')}</span>`;
      if (isAdmin) badge.addEventListener('click', () => openRenameProject(current));
      host.appendChild(badge);
      return;
    }

    // Multiple projects: render a select
    const sel = document.createElement('select');
    sel.className = 'text-xs rounded-lg border border-stone-300 bg-white px-2 py-1 max-w-[200px]';
    list.forEach((p) => {
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = p.name;
      if (p.id === current?.id) opt.selected = true;
      sel.appendChild(opt);
    });
    sel.addEventListener('change', (e) => {
      window.HD_Project.setId(e.target.value);
    });
    host.innerHTML = '';
    host.appendChild(sel);
  }

  async function openRenameProject(current) {
    if (!current) return;
    const overlay = document.createElement('div');
    overlay.className = 'fixed inset-0 z-50 bg-stone-900/50 flex items-center justify-center p-4';
    const dlg = document.createElement('div');
    dlg.className = 'bg-white rounded-2xl shadow-xl w-full max-w-sm p-5 space-y-3';
    dlg.innerHTML = `
      <h3 class="text-base font-semibold text-stone-900">Rename project</h3>
      <label class="block text-sm font-medium text-stone-700">Project name</label>
      <input type="text" id="rename-input" class="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm" value="${escapeHtml(current.name || '')}">
      <div id="rename-err" class="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3" hidden></div>
      <div class="flex items-center justify-end gap-2 pt-1">
        <button id="rename-cancel" class="px-4 py-2 text-sm rounded-lg hover:bg-stone-100">Cancel</button>
        <button id="rename-save" class="px-4 py-2 text-sm rounded-lg bg-brand-500 hover:bg-brand-600 text-white font-medium">Save</button>
      </div>`;
    overlay.appendChild(dlg);
    document.body.appendChild(overlay);
    const input = dlg.querySelector('#rename-input');
    const err = dlg.querySelector('#rename-err');
    input.focus();
    dlg.querySelector('#rename-cancel').addEventListener('click', () => overlay.remove());
    dlg.querySelector('#rename-save').addEventListener('click', async () => {
      err.hidden = true;
      const name = input.value.trim();
      if (!name) { err.textContent = 'A project name is required.'; err.hidden = false; return; }
      try {
        const { error } = await state.supabase.rpc('rename_project', { p_project_id: current.id, p_new_name: name });
        if (error) throw error;
        if (window.HD_Project && window.HD_Project.refresh) await window.HD_Project.refresh(state.supabase);
        overlay.remove();
        renderProjectPicker();
      } catch (e) { err.textContent = e.message || 'Could not rename.'; err.hidden = false; }
    });
  }

  function renderSidebar() {
    const nav = $('sidebar-nav');
    nav.innerHTML = '';
    const visible = MODULES.filter((m) => !m.roles || m.roles.includes(state.role.name));
    visible.forEach((m) => {
      const a = document.createElement('a');
      a.href = '#/' + m.id;
      a.className = 'flex items-center gap-3 rounded-lg px-3 py-2 text-stone-700 hover:bg-stone-100 transition-colors';
      a.dataset.moduleId = m.id;
      a.innerHTML = '<span class="text-stone-400">' + (ICONS[m.icon] || ICONS.home) + '</span><span class="truncate">' + m.title + '</span>';
      nav.appendChild(a);
    });
  }

  function highlightActive(moduleId) {
    document.querySelectorAll('#sidebar-nav a').forEach((a) => {
      if (a.dataset.moduleId === moduleId) {
        a.classList.add('bg-brand-50','text-brand-700','font-medium');
        a.classList.remove('text-stone-700');
      } else {
        a.classList.remove('bg-brand-50','text-brand-700','font-medium');
        a.classList.add('text-stone-700');
      }
    });
  }


  // ----- Routing -------------------------------------------------------------
  function currentModuleId() {
    const h = window.location.hash || '';
    const m = h.match(/^#\/([\w-]+)/);
    return m ? m[1] : 'home';
  }

  function handleRouteChange() {
    if (!state.profile) return;
    const requested = currentModuleId();
    const mod = MODULES.find((m) => m.id === requested);
    if (!mod) { window.location.hash = '#/home'; return; }
    if (mod.roles && !mod.roles.includes(state.role.name)) {
      renderForbidden(mod);
      return;
    }
    $('page-title').textContent = mod.title;
    highlightActive(mod.id);
    renderModulePlaceholder(mod);
    if (window.HD_Notifications) window.HD_Notifications.refresh();

    // Close mobile sidebar after navigation
    $('sidebar').classList.remove('open');
    hide('sidebar-backdrop');
  }

  function renderModulePlaceholder(mod) {
    const main = $('page-content');

    // Module 2 — My Dashboard (lives at #/home)
    if (mod.id === 'home' && window.HD_Dashboard) {
      main.innerHTML = '';
      window.HD_Dashboard.render(main, {
        supabase: state.supabase,
        profile:  state.profile,
        role:     state.role,
      });
      return;
    }

    // Fallback home (if dashboard module not loaded for any reason)
    if (mod.id === 'home') {
      main.innerHTML = `
        <section class="bg-white rounded-2xl border border-stone-200 p-6 lg:p-8 shadow-sm">
          <div class="text-sm text-brand-600 font-medium mb-2">Welcome</div>
          <h2 class="text-xl lg:text-2xl font-bold text-stone-900">${escapeHtml(state.profile.full_name || state.profile.email)}</h2>
          <p class="text-sm text-stone-600 mt-2">You are signed in as <span class="font-medium text-stone-900">${escapeHtml(state.role.name)}</span>.</p>
        </section>`;
      return;
    }

    // Module 6 — Team Register
    if (mod.id === 'team' && window.HD_Team) {
      main.innerHTML = '';
      const edgeUrl = window.HD_CONFIG.SUPABASE_URL.replace(/\/$/, '') + '/functions/v1/team-admin';
      window.HD_Team.render(main, { supabase: state.supabase, edgeUrl });
      return;
    }

    if (mod.id === 'contracts' && window.HD_Contracts) {
      main.innerHTML = '';
      window.HD_Contracts.render(main, { supabase: state.supabase });
      return;
    }

    // Module 4 — Project Phases
    if (mod.id === 'phases' && window.HD_Phases) {
      main.innerHTML = '';
      window.HD_Phases.render(main, { supabase: state.supabase });
      return;
    }

    // My Tasks — member view of their assigned tasks
    if (mod.id === 'mytasks' && window.HD_MyTasks) {
      main.innerHTML = '';
      window.HD_MyTasks.render(main, { supabase: state.supabase });
      return;
    }

    if (mod.id === 'taskboard' && window.HD_TaskBoard) {
      main.innerHTML = '';
      window.HD_TaskBoard.render(main, { supabase: state.supabase });
      return;
    }

    if (mod.id === 'inventory' && window.HD_Inventory) {
      main.innerHTML = '';
      window.HD_Inventory.render(main, { supabase: state.supabase });
      return;
    }

    // Module 3 — Master Task Tracker
    if (mod.id === 'tasks' && window.HD_Tasks) {
      main.innerHTML = '';
      window.HD_Tasks.render(main, { supabase: state.supabase });
      return;
    }

    // Module 5 — Production Schedule
    if (mod.id === 'sessions' && window.HD_Sessions) {
      main.innerHTML = '';
      window.HD_Sessions.render(main, { supabase: state.supabase });
      return;
    }

    // Hymns Catalogue
    if (mod.id === 'hymns' && window.HD_Hymns) {
      main.innerHTML = '';
      window.HD_Hymns.render(main, { supabase: state.supabase });
      return;
    }

    // Module 9 — Budget Tracker
    if (mod.id === 'budget' && window.HD_Budget) {
      main.innerHTML = '';
      window.HD_Budget.render(main, { supabase: state.supabase });
      return;
    }

    // Module 10 — Income Streams
    if (mod.id === 'income' && window.HD_Income) {
      main.innerHTML = '';
      window.HD_Income.render(main, { supabase: state.supabase });
      return;
    }

    // Module 8 — Member Expenses
    if (mod.id === 'expenses' && window.HD_Expenses) {
      main.innerHTML = '';
      window.HD_Expenses.render(main, { supabase: state.supabase });
      return;
    }

    // Module 7 — Royalty Framework
    if (mod.id === 'royalty' && window.HD_Royalty) {
      main.innerHTML = '';
      window.HD_Royalty.render(main, { supabase: state.supabase });
      return;
    }

    // Module 16 — Payment Advices and Statements
    if (mod.id === 'advices' && window.HD_Advices) {
      main.innerHTML = '';
      window.HD_Advices.render(main, { supabase: state.supabase });
      return;
    }

    // Module 11 — Sponsorship Pipeline
    if (mod.id === 'sponsorship' && window.HD_Sponsorship) {
      main.innerHTML = '';
      window.HD_Sponsorship.render(main, { supabase: state.supabase });
      return;
    }

    // Module 12 — Marketing and YouTube
    if (mod.id === 'marketing' && window.HD_Marketing) {
      main.innerHTML = '';
      window.HD_Marketing.render(main, { supabase: state.supabase });
      return;
    }

    // Module 13 — Beta Testing
    if (mod.id === 'beta' && window.HD_Beta) {
      main.innerHTML = '';
      window.HD_Beta.render(main, { supabase: state.supabase });
      return;
    }

    // Module 14 — App Development Roadmap
    if (mod.id === 'app-dev' && window.HD_AppDev) {
      main.innerHTML = '';
      window.HD_AppDev.render(main, { supabase: state.supabase });
      return;
    }

    // Module 1 — Founder and Admin Dashboard
    if (mod.id === 'admin-dash' && window.HD_Founder) {
      main.innerHTML = '';
      window.HD_Founder.render(main, { supabase: state.supabase });
      return;
    }

    // Module 15 — Risk Register
    if (mod.id === 'risks' && window.HD_Risks) {
      main.innerHTML = '';
      window.HD_Risks.render(main, { supabase: state.supabase });
      return;
    }

    // Module 17 — Annual AGM and Audit Log
    if (mod.id === 'agm' && window.HD_AGM) {
      main.innerHTML = '';
      window.HD_AGM.render(main, { supabase: state.supabase });
      return;
    }

    main.innerHTML = `
      <section class="bg-white rounded-2xl border border-stone-200 p-6 lg:p-8 shadow-sm">
        <h2 class="text-xl lg:text-2xl font-bold text-stone-900">${escapeHtml(mod.title)}</h2>
        <p class="text-sm text-stone-600 mt-2">This module is part of the project plan but has not been built yet.</p>
        <p class="text-sm text-stone-500 mt-4">We will build this module in the order agreed in the brief.</p>
      </section>
    `;
  }

  function renderForbidden(mod) {
    $('page-title').textContent = mod.title;
    $('page-content').innerHTML = `
      <section class="bg-white rounded-2xl border border-stone-200 p-6 lg:p-8 shadow-sm">
        <h2 class="text-lg font-semibold text-stone-900">Access restricted</h2>
        <p class="text-sm text-stone-600 mt-2">Your current role does not have access to this module.</p>
        <p class="text-sm text-stone-500 mt-4">If this is wrong, please ask the Admin to update your role or permissions.</p>
      </section>
    `;
  }


  // ----- Sign out ------------------------------------------------------------
  async function handleSignOut() {
    await state.supabase.auth.signOut();
    state.session = null;
    state.profile = null;
    state.role = null;
    window.location.hash = '';
    showAuthScreen('login');
  }


  // ----- Mobile sidebar ------------------------------------------------------
  function openSidebar()  { $('sidebar').classList.add('open');    show('sidebar-backdrop'); }
  function closeSidebar() { $('sidebar').classList.remove('open'); hide('sidebar-backdrop'); }


  // ----- Tiny HTML escape ----------------------------------------------------
  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  }


  // ----- Event wiring --------------------------------------------------------
  document.addEventListener('DOMContentLoaded', () => {
    $('login-form').addEventListener('submit', handleLogin);
    $('forgot-form').addEventListener('submit', handleForgot);
    $('set-password-form').addEventListener('submit', handleSetPassword);

    $('forgot-password-link').addEventListener('click', () => showAuthScreen('forgot'));
    $('back-to-login-link').addEventListener('click', () => showAuthScreen('login'));

    $('sign-out-btn').addEventListener('click', handleSignOut);
    $('sidebar-toggle').addEventListener('click', openSidebar);
    $('sidebar-backdrop').addEventListener('click', closeSidebar);

    window.addEventListener('hashchange', handleRouteChange);

    boot();
  });


  // ----- Service worker registration (silent update pattern from HymnDesk) ---
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    });
  }

})();
