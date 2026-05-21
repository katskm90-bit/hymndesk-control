// ============================================================================
// HymnDesk Control · Active Project state
// ----------------------------------------------------------------------------
// Lives on window.HD_Project. Provides:
//   • getId()        — current active project UUID (or null on first run)
//   • setId(id)      — set active project, persist to localStorage, fire event
//   • onChange(fn)   — register listener for project changes
//   • init(supabase) — load project list and resolve a default if none set
//   • all()          — last-known list of all projects
// ============================================================================

(function () {
  'use strict';

  const KEY = 'hd_active_project_id';
  let _id = null;
  let _projects = [];
  let _listeners = [];

  function notify() {
    _listeners.forEach(fn => { try { fn(_id); } catch (e) { console.error(e); } });
  }

  window.HD_Project = {
    async init(supabase) {
      _id = localStorage.getItem(KEY) || null;
      try {
        const { data, error } = await supabase.rpc('list_projects');
        if (error) throw error;
        _projects = data || [];
        if (!_id || !_projects.find(p => p.id === _id)) {
          // Default to the first active project
          const def = _projects.find(p => p.is_active) || _projects[0];
          if (def) {
            _id = def.id;
            localStorage.setItem(KEY, _id);
          }
        }
      } catch (err) {
        console.error('Failed to load projects:', err);
        _projects = [];
      }
      return _id;
    },
    getId() { return _id; },
    setId(id) {
      if (id === _id) return;
      _id = id;
      if (id) localStorage.setItem(KEY, id); else localStorage.removeItem(KEY);
      notify();
    },
    onChange(fn) { _listeners.push(fn); return () => { _listeners = _listeners.filter(x => x !== fn); }; },
    all() { return _projects.slice(); },
    current() { return _projects.find(p => p.id === _id) || null; },
    async refresh(supabase) {
      const { data } = await supabase.rpc('list_projects');
      _projects = data || [];
      return _projects;
    },
  };
})();
