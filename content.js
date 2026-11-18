// Runs at document_start. Injects a <style> with the rules of the active options
// and reacts to chrome.storage.sync changes without reloading the page.
// State stored in chrome.storage.sync["foco"]:
//   { all: boolean, sites: { "<site>": boolean }, options: { "<site>.<option>": boolean | string } }
// Switch options store a boolean; choice options (with `choices`) store the chosen value ("" = off).

(() => {
  const STORAGE_KEY = "foco";
  const STYLE_ID = "foco-style";
  const HIDDEN_ATTR = "data-foco-hidden";

  const host = location.hostname;
  const site = FOCO_SITES.find((s) =>
    s.hosts.some((h) => host === h || host.endsWith("." + h))
  );
  if (!site) return;

  let observer = null;
  let sweepQueued = false;
  let matchers = [];
  let redirects = [];
  let titles = [];

  function valueOf(state, opt) {
    const saved = (state.options || {})[`${site.id}.${opt.id}`];
    return saved ?? opt.default ?? (opt.choices ? "" : true);
  }

  // [{ opt, value }] for every option that is currently on.
  function activeOptions(state) {
    if (!state || state.all === false || (state.sites || {})[site.id] === false) return [];
    return site.options
      .map((opt) => ({ opt, value: valueOf(state, opt) }))
      .filter((e) => e.value);
  }

  function ensureStyleEl() {
    let el = document.getElementById(STYLE_ID);
    if (!el) {
      el = document.createElement("style");
      el.id = STYLE_ID;
      // There may be no <head> yet at document_start.
      (document.head || document.documentElement).appendChild(el);
    }
    return el;
  }

  function buildCss(active) {
    // One rule per selector: an invalid selector must not invalidate the others.
    const rules = active.flatMap(({ opt, value }) => [
      ...(opt.css || []).map((sel) => `${sel} { display: none !important; }`),
      // raw rules, for options that resize instead of hiding (a function for choice options)
      ...(typeof opt.rules === "function" ? opt.rules(value) : opt.rules || []),
    ]);
    rules.push(`[${HIDDEN_ATTR}] { display: none !important; }`);
    return rules.join("\n");
  }

  // JS fallback (only for options with `match`).
  function sweep() {
    sweepQueued = false;
    followRedirects();
    for (const fix of titles) {
      try {
        const t = fix(document.title);
        if (t != null && t !== document.title) document.title = t;
      } catch (_) {}
    }
    for (const match of matchers) {
      let found = [];
      try {
        found = match(document) || [];
      } catch (_) {}
      for (const el of found) el.setAttribute(HIDDEN_ATTR, "");
    }
  }

  // Options with `redirect(url)` send the page elsewhere; checked on load and on every
  // DOM change, since these sites navigate without reloading.
  let lastHref = "";
  function followRedirects() {
    if (!redirects.length || location.href === lastHref) return;
    lastHref = location.href;
    for (const redirect of redirects) {
      let to = null;
      try {
        to = redirect(new URL(location.href));
      } catch (_) {}
      if (to && to !== location.href) {
        location.replace(to);
        return;
      }
    }
  }

  function queueSweep() {
    if (sweepQueued) return;
    sweepQueued = true;
    requestAnimationFrame(sweep);
  }

  function startObserver() {
    if (observer) return;
    observer = new MutationObserver(queueSweep);
    observer.observe(document.documentElement, { childList: true, subtree: true, characterData: titles.length > 0 });
  }

  function stopObserver() {
    if (observer) observer.disconnect();
    observer = null;
    sweepQueued = false;
    document.querySelectorAll(`[${HIDDEN_ATTR}]`).forEach((el) =>
      el.removeAttribute(HIDDEN_ATTR)
    );
  }

  // Options with `setup(value)` run their own code; it returns a cleanup function.
  let cleanups = [];
  function runSetups(active) {
    for (const undo of cleanups) {
      try { undo(); } catch (_) {}
    }
    cleanups = [];
    for (const { opt, value } of active) {
      if (typeof opt.setup !== "function") continue;
      try {
        const undo = opt.setup(value);
        if (typeof undo === "function") cleanups.push(undo);
      } catch (_) {}
    }
  }

  function apply(state) {
    const active = activeOptions(state);
    runSetups(active);
    ensureStyleEl().textContent = buildCss(active);

    matchers = active
      .filter((e) => typeof e.opt.match === "function")
      .map((e) => e.opt.match);
    redirects = active
      .filter((e) => typeof e.opt.redirect === "function")
      .map((e) => e.opt.redirect);
    titles = active
      .filter((e) => typeof e.opt.title === "function")
      .map((e) => e.opt.title);
    lastHref = "";
    if (matchers.length || redirects.length || titles.length) {
      startObserver();
      queueSweep();
    } else {
      stopObserver();
    }
  }

  chrome.storage.sync.get(STORAGE_KEY, (res) => {
    apply(res[STORAGE_KEY] || { all: true, options: {} });
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "sync" && changes[STORAGE_KEY]) {
      apply(changes[STORAGE_KEY].newValue || { all: true, options: {} });
    }
  });
})();
