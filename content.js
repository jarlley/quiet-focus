// Runs at document_start. Injects a <style> with the rules of the active options
// and reacts to chrome.storage.sync changes without reloading the page.
// State stored in chrome.storage.sync["foco"]:
//   { all: boolean, options: { "<site>.<option>": boolean | string } }
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

  function valueOf(state, opt) {
    const saved = (state.options || {})[`${site.id}.${opt.id}`];
    return saved ?? opt.default ?? (opt.choices ? "" : true);
  }

  // [{ opt, value }] for every option that is currently on.
  function activeOptions(state) {
    if (!state || state.all === false) return [];
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
    for (const match of matchers) {
      let found = [];
      try {
        found = match(document) || [];
      } catch (_) {}
      for (const el of found) el.setAttribute(HIDDEN_ATTR, "");
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
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }

  function stopObserver() {
    if (observer) observer.disconnect();
    observer = null;
    sweepQueued = false;
    document.querySelectorAll(`[${HIDDEN_ATTR}]`).forEach((el) =>
      el.removeAttribute(HIDDEN_ATTR)
    );
  }

  function apply(state) {
    const active = activeOptions(state);
    ensureStyleEl().textContent = buildCss(active);

    matchers = active
      .filter((e) => typeof e.opt.match === "function")
      .map((e) => e.opt.match);
    if (matchers.length) {
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
