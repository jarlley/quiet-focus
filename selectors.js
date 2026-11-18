// The single place where elements to hide are added.
// Loaded by both the content script and the popup: every option listed here
// automatically gets its own switch in the popup.
//
// Option format:
//   {
//     id: "shorts",                 // unique within the site
//     label: "Shorts",              // text shown in the popup
//     group: "Sidebar",             // optional; sub-heading in the popup (by first appearance)
//     css: ['a[href^="/shorts"]'],  // selectors to hide (display: none !important)
//     rules: ['sel { ... }'],       // optional; raw CSS rules, for resizing instead of hiding
//     choices: [{ value, label }],  // optional; shows a dropdown instead of a switch, and
//                                   // `rules` becomes (value) => [...]; "" (default) is off
//     default: false,               // optional; hidden by default unless set to false
//     match: (root) => [...],       // optional; last resort when CSS is not enough
//                                   // (returns elements; starts a MutationObserver)
//     redirect: (url) => "...",     // optional; given a URL, returns where to go instead (or null)
//     title: (title) => "...",      // optional; rewrites the tab title (or null to leave it)
//   }
//
// New options go at the END of the site's list: the popup shows them in this order.
//
// Prefer: aria-label, data-testid, href, stable ids.
// Avoid: auto-generated classes (e.g. .x1lliihq, .css-175oi2r).

// X: scope every selector to the left column so the same links
// elsewhere on the page (timeline, profiles) are never touched.
const xSidebar = (sel) => `header[role="banner"] ${sel}`;

// Instagram: icons with no stable href are found by their aria-label, which follows
// the UI language, so English and Portuguese are both listed.
const igIcon = (...labels) => labels.map((l) => `a:has(svg[aria-label="${l}"])`);

// YouTube sidebar: the section whose title matches `re`.
function guideSection(root, re) {
  return [...root.querySelectorAll("ytd-guide-section-renderer")].filter((sec) =>
    re.test((sec.querySelector("#guide-section-title")?.textContent || "").trim())
  );
}

// Background colour shared by every site: a blend layer over the page.
// Values are "<mode>:<hex>": `darken` tints white (light theme), `lighten` tints black (dark theme).
const BG_CHOICES = [
  { value: "darken:f5f1e8", label: "Light: Warm paper" },
  { value: "darken:eef2f7", label: "Light: Cool gray" },
  { value: "darken:eef5ee", label: "Light: Soft green" },
  { value: "darken:f0eef7", label: "Light: Lavender" },
  { value: "lighten:121212", label: "Dark theme: Charcoal" },
  { value: "lighten:1c1c1e", label: "Dark theme: Dark gray" },
  { value: "lighten:15202b", label: "Dark theme: Dim blue" },
  { value: "lighten:0f172a", label: "Dark theme: Navy" },
  { value: "lighten:1a1410", label: "Dark theme: Warm brown" },
  { value: "lighten:0d1b14", label: "Dark theme: Forest" },
];
function bgOption(def = "") {
  return {
    id: "bg-color",
    group: "General",
    label: "Background color",
    offLabel: "Default",
    default: def,
    choices: BG_CHOICES,
    rules: (v) => {
      // Older saved values were a bare hex (dark only).
      const [mode, hex] = v.includes(":") ? v.split(":") : ["lighten", v];
      return [
        `html::before { content: ""; position: fixed; inset: 0; z-index: 2147483647; pointer-events: none; background: #${hex}; mix-blend-mode: ${mode}; }`,
      ];
    },
  };
}

const FOCO_SITES = [
  {
    id: "youtube",
    label: "YouTube",
    hosts: ["youtube.com"],
    groups: ["Top", "Left", "Center", "Right", "Bottom", "General"],
    options: [
      {
        id: "sidebar-shorts",
        group: "Left",
        label: "Shorts",
        default: true,
        css: [
          'ytd-guide-entry-renderer:has(a[title="Shorts"])',
          'ytd-mini-guide-entry-renderer:has(a[title="Shorts"])',
          'ytd-mini-guide-entry-renderer[aria-label="Shorts"]',
        ],
      },
      {
        id: "sidebar-explore",
        group: "Left",
        label: "Explore section",
        default: true,
        match: (root) => guideSection(root, /^explore$/i),
      },
      {
        id: "sidebar-more-from-youtube",
        group: "Left",
        label: "More from YouTube section",
        default: true,
        match: (root) => guideSection(root, /^more from youtube$/i),
      },
      {
        id: "sidebar-report-history",
        group: "Left",
        label: "Report history",
        default: true,
        css: ['ytd-guide-entry-renderer:has(a[href*="reporthistory"])'],
        match: (root) =>
          [...root.querySelectorAll("ytd-guide-entry-renderer")].filter((el) =>
            /^\s*report history\s*$/i.test(el.textContent || "")
          ),
      },
      {
        id: "sidebar-footer",
        group: "Left",
        label: "Footer (About, Terms…)",
        default: true,
        css: ["ytd-guide-renderer #footer"],
      },
      {
        id: "shorts-shelf",
        group: "Center",
        label: "Shorts shelf",
        default: true,
        css: [
          "ytd-rich-section-renderer:has(ytd-rich-shelf-renderer[is-shorts])",
          "ytd-reel-shelf-renderer",
          "ytd-rich-shelf-renderer[is-shorts]",
        ],
        // Fallback: any shelf whose title is "Shorts".
        match: (root) =>
          [...root.querySelectorAll("ytd-rich-section-renderer, ytd-item-section-renderer")].filter((el) => {
            const t = el.querySelector("#title, #title-text");
            return t && /^\s*shorts\s*$/i.test(t.textContent || "");
          }),
      },
      {
        id: "history-off-nudge",
        group: "Center",
        label: "\"Your watch history is off\" message",
        default: true,
        css: [
          "ytd-rich-section-renderer:has(ytd-feed-nudge-renderer)",
          "ytd-feed-nudge-renderer",
        ],
        // Fallback in case YouTube renames the element: find the box by its text.
        match: (root) =>
          [...root.querySelectorAll("ytd-browse #contents > *, ytd-rich-grid-renderer > *")].filter((el) =>
            /watch history is off/i.test(el.textContent || "") && el.querySelectorAll("ytd-rich-item-renderer").length === 0
          ),
      },
      bgOption(),
    ],
  },
  {
    id: "instagram",
    label: "Instagram",
    hosts: ["instagram.com"],
    groups: ["Top", "Left", "Center", "Right", "Bottom", "General"],
    options: [
      {
        id: "sidebar-home",
        group: "Left",
        label: "Home",
        default: false,
        css: ['a[href="/"]'],
      },
      {
        id: "sidebar-search",
        group: "Left",
        label: "Search",
        default: false,
        css: igIcon("Search", "Pesquisar", "Pesquisa"),
      },
      {
        id: "sidebar-explore",
        group: "Left",
        label: "Explore",
        default: false,
        css: ['a[href="/explore/"]'],
      },
      {
        id: "sidebar-reels",
        group: "Left",
        label: "Reels",
        default: false,
        css: ['a[href="/reels/"]'],
      },
      {
        id: "sidebar-messages",
        group: "Left",
        label: "Messages",
        default: false,
        css: ['a[href="/direct/inbox/"]'],
      },
      {
        id: "sidebar-notifications",
        group: "Left",
        label: "Notifications",
        default: false,
        css: igIcon("Notifications", "Notificações"),
      },
      {
        // Hides the "For you / Following" tabs and always opens the Following feed.
        id: "feed-following-only",
        group: "Center",
        label: "Always \"Following\" (hide feed tabs)",
        default: true,
        // The tabs have no link or attribute to select them by, so they are found by
        // their text: the smallest element holding both, plus every wrapper with no content.
        match: (root) => {
          const forYou = ["For you", "Para si", "Para você"];
          const following = ["Following", "A seguir", "Seguindo"];
          const leaf = (texts) =>
            [...root.querySelectorAll("main span, main div, main a, main [role=tab]")].find(
              (el) => !el.children.length && texts.includes(el.textContent.trim())
            );
          const a = leaf(forYou);
          const b = leaf(following);
          if (!a || !b) return [];
          let box = a.parentElement;
          while (box && !box.contains(b)) box = box.parentElement;
          if (!box || box.querySelector("article, img, video")) return [];
          // Climb through wrappers (and their spacers) up to just below the one that also
          // holds the stories or posts, so the reserved height goes with the tabs.
          const content = "article, img, video, canvas, [data-pagelet]";
          while (box.parentElement && box.parentElement !== root.body && !box.parentElement.matches("main") && !box.parentElement.querySelector(content)) {
            box = box.parentElement;
          }
          return [box];
        },
        redirect: (url) =>
          url.pathname === "/" && url.searchParams.get("variant") !== "following"
            ? `${url.origin}/?variant=following`
            : null,
      },
      {
        id: "feed-stories",
        group: "Center",
        label: "Stories",
        default: false,
        css: ['[data-pagelet="story_tray"]'],
      },
      {
        id: "feed-counts",
        group: "Center",
        label: "Like and comment counts (icons only)",
        default: false,
        css: ['article a[href$="/liked_by/"]', 'article a[href$="/comments/"]'],
        // Newer layout: the count is a bare number next to each action icon, with no
        // attribute to select it by, so it is found by its text near the icon.
        match: (root) => {
          const labels = ["Like", "Unlike", "Comment", "Repost", "Share", "Gosto", "Gostar", "Curtir", "Descurtir", "Comentar", "Comentário", "Republicar", "Partilhar", "Compartilhar"];
          const count = /^\s*[\d.,]+\s*(?:[KkMm]|mil|mi)?\s*$/;
          const out = [];
          for (const svg of root.querySelectorAll(labels.map((l) => `svg[aria-label="${l}"]`).join(","))) {
            let box = svg;
            for (let i = 0; i < 4 && box.parentElement; i++) {
              box = box.parentElement;
              const hits = [...box.querySelectorAll("span, div")].filter(
                (el) => !el.children.length && count.test(el.textContent)
              );
              if (hits.length) {
                out.push(...hits);
                break;
              }
            }
          }
          return out;
        },
      },
      {
        id: "right-suggestions",
        group: "Right",
        label: "Suggested for you",
        default: false,
        css: ['main div:has(a[href="/explore/people/"]):not(:has(article)):not(:has([data-pagelet="story_tray"]))'],
      },
      {
        id: "right-footer",
        group: "Right",
        label: "Footer (About, Help…)",
        default: false,
        css: ['main footer'],
      },
      {
        // Blurs faces, names, text and media so screenshots show only the layout.
        id: "screenshot-mode",
        group: "General",
        label: "Screenshot mode (blur personal content)",
        default: false,
        rules: [
          'img { filter: blur(8px) !important; }',
          'video { filter: blur(8px) !important; }',
          'canvas { filter: blur(8px) !important; }',
          '[data-pagelet="story_tray"] span { filter: blur(8px) !important; }',
          'article header { filter: blur(8px) !important; }',
          'article h1 { filter: blur(8px) !important; }',
          'article span[dir="auto"] { filter: blur(8px) !important; }',
          'main a[href^="/"][role="link"] span { filter: blur(8px) !important; }',
        ],
      },
      bgOption(),
    ],
  },
  {
    id: "gmail",
    label: "Gmail",
    hosts: ["mail.google.com"],
    // Gmail has almost no stable attributes: nav links are found by their href, the rest
    // by long-lived class names, which Google may change.
    groups: ["Top", "Left", "Center", "Right", "Bottom", "General"],
    options: [
      {
        // "Inbox (3) - name@gmail.com - Gmail" becomes "Inbox (3)".
        id: "tab-title",
        group: "General",
        label: "Tab title: folder only (hide email)",
        default: true,
        title: (t) => t.replace(/\s+[-–]\s+\S+@\S+[\s\S]*$/, ""),
      },
      {
        id: "compose",
        group: "Left",
        label: "Compose button",
        default: false,
        css: ['.T-I.T-I-KE.L3'],
      },
      {
        id: "nav-starred",
        group: "Left",
        label: "Starred",
        default: false,
        css: ['.aim:has(a[href$="#starred"])'],
      },
      {
        id: "nav-snoozed",
        group: "Left",
        label: "Snoozed",
        default: false,
        css: ['.aim:has(a[href$="#snoozed"])'],
      },
      {
        id: "nav-important",
        group: "Left",
        label: "Important",
        default: false,
        css: ['.aim:has(a[href$="#imp"])'],
      },
      {
        id: "nav-sent",
        group: "Left",
        label: "Sent",
        default: false,
        css: ['.aim:has(a[href$="#sent"])'],
      },
      {
        id: "nav-drafts",
        group: "Left",
        label: "Drafts",
        default: false,
        css: ['.aim:has(a[href$="#drafts"])'],
      },
      {
        id: "nav-scheduled",
        group: "Left",
        label: "Scheduled",
        default: false,
        css: ['.aim:has(a[href$="#scheduled"])'],
      },
      {
        id: "nav-all",
        group: "Left",
        label: "All Mail",
        default: false,
        css: ['.aim:has(a[href$="#all"])'],
      },
      {
        id: "nav-spam",
        group: "Left",
        label: "Spam",
        default: false,
        css: ['.aim:has(a[href$="#spam"])'],
      },
      {
        id: "nav-trash",
        group: "Left",
        label: "Trash",
        default: false,
        css: ['.aim:has(a[href$="#trash"])'],
      },
      {
        id: "nav-counts",
        group: "Left",
        label: "Unread counts",
        default: false,
        css: ['.aim .bsU'],
      },
      {
        id: "inbox-tabs",
        group: "Center",
        label: "Category tabs (Promotions, Social…)",
        default: false,
        css: ['[role="main"] [role="tablist"]'],
      },
      {
        id: "side-panel",
        group: "Right",
        label: "Side panel (Calendar, Keep, Tasks…)",
        default: false,
        css: ['.bq9', '.brC-aT5-aOt-Jw'],
      },
      {
        id: "gemini",
        group: "Top",
        label: "Gemini button",
        default: false,
        css: [
          // The star has no label; it is the wrapper (jscontroller xdV2Hc) holding .yIGn2b.
          'header [jscontroller="xdV2Hc"]:has(.yIGn2b)',
          'header [data-tooltip*="Gemini"]',
          'header [aria-label*="Gemini"]',
        ],
      },
      {
        id: "support",
        group: "Top",
        label: "Help (?) button",
        default: false,
        css: [
          'header [data-tooltip="Support"]', 'header [data-tooltip="Suporte"]',
          'header [data-tooltip="Ajuda"]', 'header [data-tooltip="Help"]',
        ],
      },
      {
        id: "upgrade",
        group: "Top",
        label: "Upgrade button",
        default: false,
        css: [
          'header [data-pep-id^="global-pep"]',
          'header [data-rp-onramp-container]',
        ],
      },
      {
        id: "settings",
        group: "Top",
        label: "Settings (gear) button",
        default: false,
        css: [
          // Class FI is the gear's wrapper; the tooltip attribute is a fallback.
          'header .gb_v > .FI',
          'header [data-tooltip="Settings"]', 'header [data-tooltip="Configurações"]',
          'header [data-tooltip="Definições"]',
        ],
      },
      {
        id: "apps",
        group: "Top",
        label: "Google apps (grid) button",
        default: false,
        css: [
          'header a[href*="/about/products"]',
          'header div:has(> a[href*="/about/products"])',
          'header [aria-label="Google apps"]', 'header [aria-label="Apps Google"]',
          'header [aria-label="Apps do Google"]',
        ],
      },
      {
        // Gmail marks its main toolbar with gh="tm": select box, refresh, more, pagination
        // and the split-pane / input-tools arrows on the right.
        id: "toolbar",
        group: "Center",
        label: "Toolbar (select, refresh, more…)",
        default: false,
        // Also every wrapper of it that holds no list, so its reserved height and the
        // divider under it go too.
        css: ['[gh="tm"]', '[role="main"] div:has([gh="tm"]):not(:has(table)):not(:has([role="grid"]))'],
      },
      {
        id: "empty-message",
        group: "Center",
        label: "\"No new mail!\" message",
        default: false,
        css: ['[role="main"] td.TC', '[role="main"] table:has(td.TC)'],
        match: (root) =>
          [...root.querySelectorAll('[role="main"] td, [role="main"] div')].filter(
            (el) => !el.children.length && /^(No new mail!|Nenhum e-mail novo!|Não há novos e-mails!|Sem novos e-mails!)$/.test(el.textContent.trim())
          ).map((el) => el.closest("table") || el),
      },
      {
        id: "toolbar-split-pane",
        group: "Center",
        label: "Split pane button",
        default: false,
        css: [
          '[data-tooltip*="split pane"]', '[aria-label*="split pane"]',
          '[data-tooltip*="painel dividido"]', '[aria-label*="painel dividido"]',
          // the dropdown arrow next to it shares the parent
          'div:has(> [data-tooltip*="split pane"])', 'div:has(> [aria-label*="split pane"])',
          'div:has(> [data-tooltip*="painel dividido"])',
        ],
      },
      {
        id: "toolbar-input-tools",
        group: "Center",
        label: "Input tools (keyboard) button",
        default: false,
        css: [
          '#itamenu',
          '[data-tooltip*="Input Tools"]', '[aria-label*="Input Tools"]',
          '[data-tooltip*="Ferramentas de introdução"]', '[data-tooltip*="Ferramentas de entrada"]',
        ],
      },
      {
        // Storage bar, Terms · Privacy and "Last account activity". No stable attributes,
        // so it is the smallest element holding both the Terms link and the storage link.
        id: "footer",
        group: "Bottom",
        label: "Footer (storage, Terms, account activity)",
        default: false,
        match: (root) => {
          const terms = root.querySelector('[role="main"] a[href*="/terms"], [role="main"] ~ * a[href*="/terms"]') ||
            [...root.querySelectorAll('a[href*="/terms"]')].pop();
          if (!terms) return [];
          let box = terms.parentElement;
          while (box && !box.querySelector('a[href*="storage"]')) box = box.parentElement;
          if (!box || box.querySelector('[role="main"] tr, [role="navigation"]')) return [];
          return [box];
        },
      },
      bgOption(),
    ],
  },
  {
    id: "x",
    label: "X",
    hosts: ["x.com", "twitter.com"],
    // Optional order of the popup sub-headings; groups not listed follow in order of first appearance.
    groups: ["Top", "Left", "Center", "Right", "Bottom", "General"],
    options: [
      {
        id: "sidebar-home",
        group: "Left",
        label: "Home",
        default: false,
        css: [
          xSidebar('a[data-testid="AppTabBar_Home_Link"]'),
          xSidebar('a[href="/home"]'),
        ],
      },
      {
        id: "sidebar-explore",
        group: "Left",
        label: "Explore",
        default: false,
        css: [
          xSidebar('a[data-testid="AppTabBar_Explore_Link"]'),
          xSidebar('a[href="/explore"]'),
        ],
      },
      {
        id: "sidebar-notifications",
        group: "Left",
        label: "Notifications",
        default: false,
        css: [
          xSidebar('a[data-testid="AppTabBar_Notifications_Link"]'),
          xSidebar('a[href="/notifications"]'),
        ],
      },
      {
        id: "sidebar-follow",
        group: "Left",
        label: "Follow",
        default: true,
        css: [xSidebar('a[href^="/i/connect"]')],
      },
      {
        id: "sidebar-chat",
        group: "Left",
        label: "Chat",
        default: true,
        css: [
          xSidebar('a[data-testid="AppTabBar_DirectMessage_Link"]'),
          xSidebar('a[href="/i/chat"]'),
        ],
      },
      {
        id: "sidebar-calls",
        group: "Left",
        label: "Calls",
        default: true,
        css: [xSidebar('a[href="/i/calls"]')],
      },
      {
        id: "sidebar-grok",
        group: "Left",
        label: "Grok",
        default: true,
        css: [xSidebar('a[href="/i/grok"]')],
      },
      {
        id: "sidebar-history",
        group: "Left",
        label: "History",
        default: false,
        css: [xSidebar('a[href^="/i/history"]')],
      },
      {
        id: "sidebar-premium",
        group: "Left",
        label: "Premium",
        default: true,
        css: [xSidebar('a[href^="/i/premium"]')],
      },
      {
        id: "sidebar-profile",
        group: "Left",
        label: "Profile",
        default: false,
        css: [xSidebar('a[data-testid="AppTabBar_Profile_Link"]')],
      },
      {
        id: "sidebar-more",
        group: "Left",
        label: "More",
        default: false,
        css: [xSidebar('[data-testid="AppTabBar_More_Menu"]')],
      },
      {
        // Hides only the text next to each icon; the Post button and account menu are outside the <nav>.
        id: "sidebar-icons-only",
        group: "Left",
        label: "Icons only (hide names)",
        default: false,
        css: [
          xSidebar('nav a div[dir="ltr"]'),
          xSidebar('nav button div[dir="ltr"]'),
        ],
      },
      {
        id: "sidebar-post-hide",
        group: "Left",
        label: "Post button (hide)",
        default: true,
        css: [xSidebar('a[data-testid="SideNav_NewTweet_Button"]')],
      },
      {
        id: "sidebar-creator-studio",
        group: "Left",
        label: "Creator Studio",
        default: true,
        css: [xSidebar('a[href^="/i/jf/creators"]')],
      },
      // Right column. These cards have no data-testid, so they rely on aria-label,
      // which X renders in the interface language (English here). The label sits
      // on an inner element, while the bordered card (and its 1px frame) is a few
      // levels up, so :has() hides the whole card wrapper instead of only its content.
      {
        id: "right-premium",
        group: "Right",
        label: "Subscribe to Premium",
        default: true,
        css: [
          'div:has(> div > aside[aria-label="Subscribe to Premium"])',
          // empty divider card that follows it
          'div:has(> div > aside[aria-label="Subscribe to Premium"]) + div',
        ],
      },
      {
        id: "right-trending",
        group: "Right",
        label: "What's happening",
        default: false,
        css: ['div:has(> section > div[aria-label="Timeline: Trending now"])'],
      },
      {
        id: "right-who-to-follow",
        group: "Right",
        label: "Who to follow",
        default: true,
        css: ['div:has(> div > aside[aria-label="Who to follow"])'],
      },
      {
        id: "right-footer",
        group: "Right",
        label: "Footer (Terms, Privacy…)",
        default: true,
        css: [
          'nav[aria-label="Footer"]',
          'nav:has(a[href="/tos"]):has(a[href="/privacy"])', // language-independent fallback
        ],
      },
      // Floating buttons in the bottom-right corner.
      {
        id: "floating-grok",
        group: "Bottom",
        label: "Grok button",
        default: true,
        css: ['[data-testid="GrokDrawer"]'],
      },
      {
        id: "floating-messages",
        group: "Bottom",
        label: "Messages button",
        default: true,
        css: ['[data-testid="chat-drawer-root"]'],
      },
      // Lines: borders are removed rather than the elements hidden. Each rule only
      // touches a known separator, so bordered cards (quoted posts, polls) are untouched.
      {
        id: "lines-all",
        group: "General",
        label: "Remove all lines",
        default: false,
        rules: [
          // sides of the main column
          '[data-testid="primaryColumn"] { border-left-width: 0 !important; border-right-width: 0 !important; }',
          // under the tabs
          '[data-testid="primaryColumn"] div:has([role="tablist"]) { border-bottom-width: 0 !important; }',
          // under the post box (the wrapper that contains its inline Post button / toolbar / field)
          '[data-testid="primaryColumn"] div:has([data-testid="tweetButtonInline"]) { border-bottom-width: 0 !important; }',
          '[data-testid="primaryColumn"] div:has([data-testid="toolBar"]) { border-bottom-width: 0 !important; }',
          '[data-testid="primaryColumn"] div:has([data-testid="tweetTextarea_0"]) { border-bottom-width: 0 !important; }',
          // between posts
          '[data-testid="cellInnerDiv"] > div { border-bottom-width: 0 !important; }',
          // the divider under the post box is a 1px-high <div> with a background colour, not a border;
          // it follows the post box wrapper, so that sibling (and its child) lose their background
          '[data-testid="primaryColumn"] div:has([data-testid="tweetButtonInline"]) + div, [data-testid="primaryColumn"] div:has([data-testid="tweetButtonInline"]) + div > div { background-color: transparent !important; }',
        ],
      },
      // Home timeline. The post box and the tab bar have no stable id of their own, so each
      // option hides every ancestor of a known inner element that stops short of the
      // timeline cells (and, for the post box, of the tab bar), which is the wrapper itself.
      {
        id: "home-post-box",
        group: "Center",
        label: "Post box (What's happening?)",
        default: false,
        // Every ancestor of the field that does not contain a tab (role="tab") or a post cell.
        // That stops just below the shared wrapper, so the last match is the whole post box
        // (avatar, field, icon row, Post button). The icon row is itself a role="tablist",
        // so the exclusion has to look for role="tab", which only the real tab bar has.
        // Only where the tab bar exists (the home timeline): on a post's page the reply box
        // sits in the list of cells, and without a tab bar this rule would hide the post itself.
        css: [
          '[data-testid="primaryColumn"]:has([role="tab"]) div:has([data-testid="tweetTextarea_0"]):not(:has([role="tab"])):not(:has([data-testid="cellInnerDiv"]))',
        ],
      },
      {
        id: "home-for-you-tab",
        group: "Center",
        label: "\"For you\" tab",
        default: false,
        css: [
          // :has([role="tab"]) skips the post box's icon row, which is also a role="tablist"
          '[data-testid="primaryColumn"] [role="tablist"]:has([role="tab"]):not([data-testid="cellInnerDiv"] *) > :first-child',
        ],
      },
      {
        // Scoped to the right column so the search page (/explore) keeps its own box. The
        // first selector hides the sticky wrapper too (every ancestor of the form that holds
        // no card), so no blank strip is left above the other cards.
        id: "right-search-hide",
        group: "Right",
        label: "Search box (hide)",
        default: false,
        css: [
          '[data-testid="sidebarColumn"] div:has(form[role="search"]):not(:has(aside)):not(:has(section)):not(:has(nav))',
          '[data-testid="sidebarColumn"] form[role="search"]',
        ],
      },
      {
        // Reply, repost, like and view counts live in this container inside the action bar.
        id: "post-counts-hide",
        group: "Center",
        label: "Action counts (hide, icons only)",
        default: true,
        css: ['article [role="group"] [data-testid="app-text-transition-container"]'],
      },
      {
        // X sets TwitterChirp on <body> and again on many elements, so every element is overridden.
        // The emoji families stay at the end of the stack so emoji still render.
        id: "system-font",
        group: "General",
        label: "Use the system font",
        default: true,
        rules: [
          '*, *::before, *::after { font-family: -apple-system, system-ui, "Segoe UI", Roboto, Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji" !important; }',
        ],
      },
      bgOption("lighten:121212"),
      {
        // Blurs faces, names, text and media so screenshots show only the layout.
        id: "screenshot-mode",
        group: "General",
        label: "Screenshot mode (blur personal content)",
        default: false,
        rules: [
          '[data-testid="Tweet-User-Avatar"] { filter: blur(8px) !important; }',
          '[data-testid^="UserAvatar-Container"] { filter: blur(8px) !important; }',
          '[data-testid="User-Name"] { filter: blur(8px) !important; }',
          '[data-testid="tweetText"] { filter: blur(8px) !important; }',
          '[data-testid="tweetPhoto"] { filter: blur(8px) !important; }',
          '[data-testid="videoPlayer"] { filter: blur(8px) !important; }',
          '[data-testid="card.wrapper"] { filter: blur(8px) !important; }',
          '[data-testid="SideNav_AccountSwitcher_Button"] { filter: blur(8px) !important; }',
          '[data-testid="UserCell"] { filter: blur(8px) !important; }',
          '[data-testid="trend"] { filter: blur(8px) !important; }',
          '[data-testid="socialContext"] { filter: blur(8px) !important; }',
        ],
      },
    ],
  },
  {
    id: "tradingview",
    label: "TradingView",
    hosts: ["tradingview.com"],
    groups: ["Top", "Left", "Center", "Right", "Bottom", "General"],
    options: [
      {
        // Hides the whole bottom bar (date ranges, time, ETH, B-ADJ) and, if a place is
        // chosen, keeps only the clock there. The bar is made invisible rather than removed
        // so the clock inside it can still be shown with `visibility: visible`.
        id: "bottom-bar",
        group: "Bottom",
        label: "Bottom bar (keep the clock)",
        offLabel: "Show bar",
        default: "top",
        choices: [
          { value: "chart-bottom", label: "Hide bar, clock at chart corner" },
          { value: "top", label: "Hide bar, clock in top bar" },
          { value: "none", label: "Hide bar and clock" },
        ],
        rules: (v) => {
          const bar = '.layout__area--bottom, #footer-chart-panel, [class*="chart-toolbar-bottom"]';
          const clock = '[data-name="time-zone-menu"]';
          const out = [
            `:is(${bar}) { visibility: hidden !important; max-height: 0 !important; min-height: 0 !important; overflow: visible !important; border: 0 !important; }`,
          ];
          if (v === "none") return out;
          const pos = v === "top"
            ? "top: 10px; right: 200px;"
            : "bottom: 12px; right: 90px;";
          out.push(
            `${clock} { visibility: visible !important; position: fixed !important; ${pos} z-index: 100 !important; opacity: 0.8; }`
          );
          return out;
        },
      },
      {
        id: "bottom-date-ranges",
        group: "Bottom",
        label: "Date ranges (1D, 5D… All) and Go to date",
        default: true,
        css: [
          '[data-name="date-ranges-menu"]',
          '[class*="dateRangeExpanded"]',
          '[class*="dateRangeCollapsed"]',
          '[data-name="go-to-date"]',
          '[data-name="go-to-date"] + [class*="separator"]',
        ],
        // Fallback: the bottom-bar button group whose buttons are exactly the ranges.
        match: (root) => {
          const bar = root.querySelector("#footer-chart-panel, [class*='chart-toolbar-bottom']");
          if (!bar) return [];
          const out = [];
          for (const b of bar.querySelectorAll("button, [role='button']")) {
            const t = (b.textContent || "").trim();
            if (/^(1D|5D|1M|3M|6M|YTD|1Y|5Y|All)$/.test(t)) out.push(b);
          }
          return out;
        },
      },
      bgOption(),
    ],
  },
];
