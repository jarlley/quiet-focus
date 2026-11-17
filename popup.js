// The popup is built from FOCO_SITES (selectors.js):
// adding an option there creates its control here automatically
// (a switch, or a dropdown when the option has `choices`).

const STORAGE_KEY = "foco";
const master = document.getElementById("master");
const groupsEl = document.getElementById("groups");

let state = { all: true, options: {} };

function valueOf(key, opt) {
  return state.options[key] ?? opt.default ?? (opt.choices ? "" : true);
}

function save() {
  chrome.storage.sync.set({ [STORAGE_KEY]: state });
}

function makeSwitch(checked, onChange) {
  const label = document.createElement("label");
  label.className = "switch";
  const input = document.createElement("input");
  input.type = "checkbox";
  input.checked = checked;
  input.addEventListener("change", () => onChange(input.checked));
  const track = document.createElement("span");
  track.className = "track";
  label.append(input, track);
  return { el: label, input };
}

function makeSelect(opt, value, onChange) {
  const select = document.createElement("select");
  select.className = "choice";
  select.append(
    new Option(opt.offLabel || "Default", ""),
    ...opt.choices.map((c) => new Option(c.label, c.value))
  );
  select.value = value;
  select.addEventListener("change", () => onChange(select.value));
  return { el: select, input: select };
}

// Which site sections are expanded. The site of the current tab opens by default;
// anything the user opens or closes is remembered for this browser only.
let currentSiteId = null;
function loadOpen() {
  try { return JSON.parse(localStorage.getItem("open") || "null"); } catch { return null; }
}
function saveOpen(open) {
  try { localStorage.setItem("open", JSON.stringify(open)); } catch {}
}

function makeRow(site, opt) {
  const key = `${site.id}.${opt.id}`;
  const row = document.createElement("div");
  row.className = "row";

  const text = document.createElement("span");
  text.textContent = opt.label;

  const onChange = (value) => {
    state.options[key] = value;
    save();
    updateCount(site);
  };
  const value = valueOf(key, opt);
  const { el, input } = opt.choices
    ? makeSelect(opt, value, onChange)
    : makeSwitch(value, onChange);
  input.setAttribute("aria-label", `${site.label}: ${opt.group ? opt.group + ": " : ""}${opt.label}`);

  row.append(text, el);
  return row;
}

// Simple monochrome glyphs per site (inline SVG, drawn with currentColor).
const SITE_ICONS = {
  youtube:
    '<rect x="2" y="5" width="20" height="14" rx="4"/><path d="M10 9.5v5l4.5-2.5z" fill="currentColor" stroke="none"/>',
  instagram:
    '<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.3" cy="6.7" r="0.6" fill="currentColor"/>',
  gmail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3.5 6.5L12 13l8.5-6.5"/>',
  x: '<path d="M5 4l14 16M19 4L5 20"/>',
};

function siteIcon(id) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  svg.classList.add("site-icon");
  svg.innerHTML = SITE_ICONS[id] || '<circle cx="12" cy="12" r="9"/>';
  return svg;
}

const countEls = {};
function updateCount(site) {
  const el = countEls[site.id];
  if (!el) return;
  const on = site.options.filter((o) => valueOf(`${site.id}.${o.id}`, o)).length;
  el.textContent = site.options.length ? `${on}/${site.options.length}` : "";
}

function render() {
  master.checked = state.all;
  document.body.classList.toggle("disabled", !state.all);
  groupsEl.replaceChildren();
  const open = loadOpen() || {};

  for (const site of FOCO_SITES) {
    const group = document.createElement("details");
    group.className = "group";
    group.open = open[site.id] ?? site.id === currentSiteId;
    group.addEventListener("toggle", () => {
      const now = loadOpen() || {};
      now[site.id] = group.open;
      saveOpen(now);
    });

    const title = document.createElement("summary");
    const name = document.createElement("span");
    name.textContent = site.label;
    const count = document.createElement("span");
    count.className = "count";
    countEls[site.id] = count;
    title.append(siteIcon(site.id), name, count);
    group.append(title);
    updateCount(site);

    if (!site.options.length) {
      const empty = document.createElement("p");
      empty.className = "empty";
      empty.textContent = "No options yet.";
      group.append(empty);
    }

    // Sub-groups in order of first appearance; options without a group come first.
    const sub = new Map((site.groups || []).map((g) => [g, []]));
    for (const opt of site.options) {
      const g = opt.group || "";
      if (!sub.has(g)) sub.set(g, []);
      sub.get(g).push(opt);
    }
    for (const [name, opts] of sub) {
      if (!opts.length) continue;
      if (name) {
        const h = document.createElement("h3");
        h.textContent = name;
        group.append(h);
      }
      for (const opt of opts) group.append(makeRow(site, opt));
    }

    groupsEl.append(group);
  }
}

master.addEventListener("change", () => {
  state.all = master.checked;
  document.body.classList.toggle("disabled", !state.all);
  save();
});

function currentTabHost() {
  return new Promise((resolve) => {
    try {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        try { resolve(new URL(tabs[0].url).hostname); } catch { resolve(""); }
      });
    } catch { resolve(""); }
  });
}

Promise.all([chrome.storage.sync.get(STORAGE_KEY), currentTabHost()]).then(([res, host]) => {
  const site = FOCO_SITES.find((s) => s.hosts.some((h) => host === h || host.endsWith("." + h)));
  currentSiteId = site ? site.id : null;
  state = { all: true, options: {}, ...(res[STORAGE_KEY] || {}) };
  render();
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "sync" && changes[STORAGE_KEY]?.newValue) {
    state = { all: true, options: {}, ...changes[STORAGE_KEY].newValue };
    render();
  }
});
