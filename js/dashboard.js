// ============================================================================
// HymnDesk Control · Module 2 · My Dashboard
// ----------------------------------------------------------------------------
// Role-aware home for each signed-in user:
//   • My open tasks (assigned to me)
//   • Upcoming production sessions in the next 30 days
//   • Totals (PM and Admin only)
//   • Recent audit activity (Admin only)
// ============================================================================

(function () {
  'use strict';

  const M = {};
  window.HD_Dashboard = M;

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
  function fmtDate(d) { return d ? new Date(d).toLocaleDateString('en-ZA', { year:'numeric', month:'short', day:'numeric' }) : '—'; }
  function fmtTime(t) { return t ? t.slice(0,5) : ''; }
  function relTime(d) {
    if (!d) return '';
    const diff = (Date.now() - new Date(d).getTime()) / 1000;
    if (diff < 60) return 'just now';
    if (diff < 3600) return Math.round(diff / 60) + ' min ago';
    if (diff < 86400) return Math.round(diff / 3600) + ' h ago';
    return Math.round(diff / 86400) + ' d ago';
  }

  M.render = async function (container, opts) {
    const supabase = opts.supabase;
    const profile  = opts.profile;
    const role     = opts.role;

    container.innerHTML = '<div class="text-sm text-stone-500">Loading dashboard...</div>';

    try {
      const { data, error } = await supabase.rpc('my_dashboard');
      if (error) throw error;

      container.innerHTML = '';
      container.appendChild(renderDashboard(data || {}, profile, role));
    } catch (err) {
      container.innerHTML = '';
      container.appendChild(el('div', { class: 'bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 text-sm' },
        'Could not load dashboard: ' + (err.message || err)));
    }
  };

  function renderDashboard(d, profile, role) {
    const wrap = el('div', { class: 'space-y-6' });

    // Greeting
    wrap.appendChild(el('section', { class: 'bg-white rounded-2xl border border-stone-200 p-6 lg:p-8 shadow-sm' },
      el('div', { class: 'text-sm text-brand-600 font-medium mb-2' }, 'Welcome'),
      el('h2', { class: 'text-xl lg:text-2xl font-bold text-stone-900' }, profile.full_name || profile.email),
      el('p', { class: 'text-sm text-stone-600 mt-2' },
        document.createTextNode('You are signed in as '),
        el('span', { class: 'font-medium text-stone-900' }, role.name),
        document.createTextNode('.'),
      ),
      role.description ? el('p', { class: 'text-sm text-stone-500 mt-4' }, role.description) : null,
    ));

    // Totals (PM and Admin only)
    if (d.totals) {
      const t = d.totals;
      wrap.appendChild(el('section', null,
        el('h3', { class: 'text-sm font-semibold text-stone-500 uppercase tracking-wide mb-3' }, 'Project totals'),
        el('div', { class: 'grid grid-cols-2 sm:grid-cols-4 gap-3' },
          stat('Tasks open',       `${t.tasks_open ?? 0} / ${t.tasks_total ?? 0}`),
          stat('Tasks blocked',    t.tasks_blocked ?? 0, t.tasks_blocked > 0 ? 'red' : null),
          stat('Sessions done',    `${t.sessions_complete ?? 0} / ${t.sessions_total ?? 0}`),
          stat('Team active',      `${t.team_active ?? 0}` + (t.team_invited ? `  ·  ${t.team_invited} invited` : '')),
        ),
      ));
    }

    // Two-column: my tasks + upcoming sessions
    const cols = el('div', { class: 'grid grid-cols-1 lg:grid-cols-2 gap-4' });

    // My tasks
    const myTasks = Array.isArray(d.my_tasks) ? d.my_tasks : [];
    cols.appendChild(el('section', { class: 'bg-white rounded-2xl border border-stone-200 p-5' },
      el('div', { class: 'flex items-center justify-between mb-3' },
        el('h3', { class: 'text-sm font-semibold text-stone-700' }, 'My open tasks'),
        el('a', { href: '#/tasks', class: 'text-xs text-brand-600 hover:text-brand-700' }, 'See all'),
      ),
      myTasks.length === 0
        ? el('p', { class: 'text-sm text-stone-500' }, 'You have no open tasks. Nice.')
        : el('div', { class: 'space-y-2' },
            ...myTasks.slice(0, 8).map(t => el('a', {
              href: '#/tasks',
              class: 'block rounded-lg border border-stone-200 hover:border-brand-300 p-3 transition-colors'
            },
              el('div', { class: 'flex items-start justify-between gap-2' },
                el('div', { class: 'min-w-0 flex-1' },
                  el('div', { class: 'text-sm font-medium text-stone-900 truncate' }, t.title),
                  el('div', { class: 'text-xs text-stone-500 mt-0.5' },
                    [t.phase_name, t.target_date ? 'Due ' + fmtDate(t.target_date) : null].filter(Boolean).join(' · ')),
                ),
                t.is_blocked ? el('span', { class: 'text-xs text-red-700 bg-red-50 border border-red-200 rounded px-1.5 py-0.5' }, 'Blocked') : null,
              ),
            ))),
    ));

    // Upcoming sessions
    const ups = Array.isArray(d.upcoming_sessions) ? d.upcoming_sessions : [];
    cols.appendChild(el('section', { class: 'bg-white rounded-2xl border border-stone-200 p-5' },
      el('div', { class: 'flex items-center justify-between mb-3' },
        el('h3', { class: 'text-sm font-semibold text-stone-700' }, 'Upcoming production sessions'),
        el('a', { href: '#/sessions', class: 'text-xs text-brand-600 hover:text-brand-700' }, 'See all'),
      ),
      ups.length === 0
        ? el('p', { class: 'text-sm text-stone-500' }, 'Nothing scheduled in the next 30 days.')
        : el('div', { class: 'space-y-2' },
            ...ups.slice(0, 6).map(s => el('a', {
              href: '#/sessions',
              class: 'block rounded-lg border border-stone-200 hover:border-brand-300 p-3 transition-colors'
            },
              el('div', { class: 'flex items-center justify-between gap-2' },
                el('div', { class: 'min-w-0 flex-1' },
                  el('div', { class: 'text-sm font-medium text-stone-900 truncate' }, s.name),
                  el('div', { class: 'text-xs text-stone-500 mt-0.5' },
                    [fmtDate(s.scheduled_date), fmtTime(s.shoot_start_time) || null, s.session_type].filter(Boolean).join(' · ')),
                ),
                s.status ? el('span', { class: 'text-xs text-stone-600 bg-stone-100 border border-stone-200 rounded px-1.5 py-0.5' }, s.status) : null,
              ),
            ))),
    ));

    wrap.appendChild(cols);

    // Recent activity (Admin only)
    if (Array.isArray(d.recent_activity) && d.recent_activity.length > 0) {
      wrap.appendChild(el('section', { class: 'bg-white rounded-2xl border border-stone-200 p-5' },
        el('h3', { class: 'text-sm font-semibold text-stone-700 mb-3' }, 'Recent activity'),
        el('div', { class: 'space-y-1 text-sm' },
          ...d.recent_activity.map(a => el('div', { class: 'flex items-center justify-between gap-2 text-stone-600' },
            el('div', { class: 'min-w-0 flex-1 truncate' },
              el('span', { class: 'text-stone-900 font-medium' }, a.actor_name || 'Someone'),
              document.createTextNode(' · ' + a.action.replace(/\./g, ' ')),
            ),
            el('span', { class: 'text-xs text-stone-400' }, relTime(a.created_at)),
          )),
        ),
      ));
    }

    return wrap;
  }

  function stat(label, value, tone) {
    const tones = {
      red: 'text-red-700 bg-red-50 border-red-200',
    };
    const cls = tones[tone] || 'bg-white border-stone-200';
    return el('div', { class: `border ${cls} rounded-xl p-3` },
      el('div', { class: 'text-xs text-stone-500' }, label),
      el('div', { class: 'text-lg font-semibold mt-0.5' }, String(value)),
    );
  }
})();
