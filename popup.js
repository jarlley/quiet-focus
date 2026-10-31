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

function render() {
  master.checked = state.all;
  document.body.classList.toggle("disabled", !state.all);
  groupsEl.replaceChildren();

  for (const site of FOCO_SITES) {
    const group = document.createElement("section");
    group.className = "group";

    const title = document.createElement("h2");
    title.textContent = site.label;
    group.append(title);

    if (!site.options.length) {
      const empty = document.createElement("p");
      empty.className = "empty";
      empty.textContent = "No options yet.";
      group.append(empty);
    }

    for (const opt of site.options) {
      const key = `${site.id}.${opt.id}`;
      const row = document.createElement("div");
      row.className = "row";

      const text = document.createElement("span");
      text.textContent = opt.label;

      const onChange = (value) => {
        state.options[key] = value;
        save();
      };
      const value = valueOf(key, opt);
      const { el, input } = opt.choices
        ? makeSelect(opt, value, onChange)
        : makeSwitch(value, onChange);
      input.setAttribute("aria-label", `${site.label}: ${opt.label}`);

      row.append(text, el);
      group.append(row);
    }

    groupsEl.append(group);
  }
}

master.addEventListener("change", () => {
  state.all = master.checked;
  document.body.classList.toggle("disabled", !state.all);
  save();
});

chrome.storage.sync.get(STORAGE_KEY, (res) => {
  state = { all: true, options: {}, ...(res[STORAGE_KEY] || {}) };
  render();
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "sync" && changes[STORAGE_KEY]?.newValue) {
    state = { all: true, options: {}, ...changes[STORAGE_KEY].newValue };
    render();
  }
});
