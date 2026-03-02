// Minimal debug hooks for testers.
// Toggle: localStorage.setItem('bf_debug','1') then reload.
// Disable: localStorage.removeItem('bf_debug') then reload.

(function initBondfireDebug() {
  try {
    if (window.bfDebug) return;

    const isEnabled = () => {
      try {
        return localStorage.getItem('bf_debug') === '1' || new URLSearchParams(window.location.search).has('debug');
      } catch {
        return false;
      }
    };

    const dump = () => {
      const out = {
        now: new Date().toISOString(),
        href: window.location.href,
        helpMounted: !!window.__BF_HELP_MOUNTED,
        swController: !!navigator.serviceWorker?.controller,
      };
      try {
        out.orgs = JSON.parse(localStorage.getItem('bf_orgs') || '[]');
      } catch {
        out.orgs = '(unreadable)';
      }
      return out;
    };

    window.bfDebug = {
      isEnabled,
      enable() {
        try { localStorage.setItem('bf_debug','1'); } catch {}
        return true;
      },
      disable() {
        try { localStorage.removeItem('bf_debug'); } catch {}
        return true;
      },
      dump,
      log(...args) {
        if (!isEnabled()) return;
        // eslint-disable-next-line no-console
        console.log('[BF]', ...args);
      },
    };

    if (isEnabled()) {
      // eslint-disable-next-line no-console
      console.log('[BF] Debug enabled. Try bfDebug.dump()');
    }
  } catch {
    // ignore
  }
})();
