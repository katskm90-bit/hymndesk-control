// ============================================================================
// HymnDesk Control · Module 1 · Founder and Admin Dashboard
// ----------------------------------------------------------------------------
// Read-only cross-module snapshot for the active project. Admin and PM.
// Pulls one aggregate RPC and lays out summary cards across all areas.
// ============================================================================

(function () {
  'use strict';
  const M = {}; window.HD_Founder = M;
  let supabase = null;

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
  function money(n) { return 'R ' + Number(n||0).toLocaleString('en-ZA', { minimumFractionDigits:0, maximumFractionDigits:0 }); }
  function relTime(d) {
    if (!d) return '';
    const diff = (Date.now() - new Date(d).getTime()) / 1000;
    if (diff < 60) return 'just now';
    if (diff < 3600) return Math.round(diff/60) + ' min ago';
    if (diff < 86400) return Math.round(diff/3600) + ' h ago';
    return Math.round(diff/86400) + ' d ago';
  }
  function projectId() { return window.HD_Project ? window.HD_Project.getId() : null; }

  M.render = async function (container, opts) {
    supabase = opts.supabase;
    container.innerHTML = '<div class="text-sm text-stone-500">Loading dashboard...</div>';
    try {
      const { data, error } = await supabase.rpc('founder_dashboard', { p_project_id: projectId() });
      if (error) throw error;
      container.innerHTML = '';
      container.appendChild(renderPage(data || {}));
    } catch (err) {
      container.innerHTML = '';
      container.appendChild(el('div', { class:'bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 text-sm' }, 'Could not load: ' + (err.message || err)));
    }
  };

  function renderPage(d) {
    const wrap = el('div', { class:'space-y-6' });
    wrap.appendChild(el('div', null,
      el('h2', { class:'text-xl lg:text-2xl font-bold text-stone-900' }, 'Founder and Admin Dashboard'),
      el('p', { class:'text-sm text-stone-500 mt-1' }, d.project_name || 'Active project'),
    ));

    // Production
    wrap.appendChild(section('Production', [
      stat('Tasks open', `${d.tasks?.open ?? 0} / ${d.tasks?.total ?? 0}`, d.tasks?.blocked > 0 ? null : null),
      stat('Tasks blocked', d.tasks?.blocked ?? 0, d.tasks?.blocked > 0 ? 'red' : null),
      stat('Sessions done', `${d.sessions?.complete ?? 0} / ${d.sessions?.total ?? 0}`),
      stat('Hymns recorded', `${d.hymns?.recorded ?? 0} / ${d.hymns?.in_progress ?? 0}`),
    ]));

    // Finance
    wrap.appendChild(section('Finance', [
      stat('Budget actual', money(d.budget?.actual), null, 'of ' + money(d.budget?.planned) + ' planned'),
      stat('Net income', money(d.income?.net), 'green', 'gross ' + money(d.income?.gross)),
      stat('Expenses paid', money(d.expenses?.paid), null, money(d.expenses?.claimed) + ' awaiting'),
      stat('Sponsorship signed', money(d.sponsorship?.signed), null, 'target ' + money(d.sponsorship?.target)),
    ]));

    // Governance and people
    wrap.appendChild(section('Governance and people', [
      stat('Active risks', d.risks?.active ?? 0, d.risks?.high_severity > 0 ? 'amber' : null,
           (d.risks?.high_severity ?? 0) + ' high severity'),
      stat('Team active', `${d.team?.active ?? 0}`, null, (d.team?.invited ?? 0) + ' invited'),
      stat('Open beta feedback', d.beta?.open_feedback ?? 0),
    ]));

    // Recent activity
    const acts = Array.isArray(d.recent_activity) ? d.recent_activity : [];
    if (acts.length > 0) {
      wrap.appendChild(el('section', { class:'bg-white rounded-2xl border border-stone-200 p-5' },
        el('h3', { class:'text-sm font-semibold text-stone-700 mb-3' }, 'Recent activity'),
        el('div', { class:'space-y-1 text-sm' },
          ...acts.map(a => el('div', { class:'flex items-center justify-between gap-2 text-stone-600' },
            el('div', { class:'min-w-0 flex-1 truncate' },
              el('span', { class:'text-stone-900 font-medium' }, a.actor_name || 'Someone'),
              document.createTextNode(' · ' + (a.action || '').replace(/\./g, ' ')),
            ),
            el('span', { class:'text-xs text-stone-400' }, relTime(a.created_at)),
          )),
        ),
      ));
    }

    return wrap;
  }

  function section(title, tiles) {
    return el('section', null,
      el('h3', { class:'text-sm font-semibold text-stone-500 uppercase tracking-wide mb-3' }, title),
      el('div', { class:'grid grid-cols-2 lg:grid-cols-4 gap-3' }, ...tiles),
    );
  }

  function stat(label, value, tone, sub) {
    const tones = { red:'text-red-700 bg-red-50 border-red-200', green:'text-emerald-700 bg-emerald-50 border-emerald-200', amber:'text-amber-700 bg-amber-50 border-amber-200' };
    const cls = tones[tone] || 'bg-white border-stone-200';
    return el('div', { class:`border ${cls} rounded-xl p-4` },
      el('div', { class:'text-xs text-stone-500' }, label),
      el('div', { class:'text-lg font-semibold mt-0.5' }, String(value)),
      sub ? el('div', { class:'text-xs text-stone-400 mt-0.5' }, sub) : null,
    );
  }
})();
