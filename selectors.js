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

const FOCO_SITES = [
  {
    id: "youtube",
    label: "YouTube",
    hosts: ["youtube.com"],
    options: [],
  },
  {
    id: "instagram",
    label: "Instagram",
    hosts: ["instagram.com"],
    groups: ["Sidebar", "Feed", "Right column", "Privacy"],
    options: [
      {
        id: "sidebar-home",
        group: "Sidebar",
        label: "Home",
        default: false,
        css: ['a[href="/"]'],
      },
      {
        id: "sidebar-search",
        group: "Sidebar",
        label: "Search",
        default: false,
        css: igIcon("Search", "Pesquisar", "Pesquisa"),
      },
      {
        id: "sidebar-explore",
        group: "Sidebar",
        label: "Explore",
        default: false,
        css: ['a[href="/explore/"]'],
      },
      {
        id: "sidebar-reels",
        group: "Sidebar",
        label: "Reels",
        default: false,
        css: ['a[href="/reels/"]'],
      },
      {
        id: "sidebar-messages",
        group: "Sidebar",
        label: "Messages",
        default: false,
        css: ['a[href="/direct/inbox/"]'],
      },
      {
        id: "sidebar-notifications",
        group: "Sidebar",
        label: "Notifications",
        default: false,
        css: igIcon("Notifications", "Notificações"),
      },
      {
        // Hides the "For you / Following" tabs and always opens the Following feed.
        id: "feed-following-only",
        group: "Feed",
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
        group: "Feed",
        label: "Stories",
        default: false,
        css: ['[data-pagelet="story_tray"]'],
      },
      {
        id: "feed-counts",
        group: "Feed",
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
        group: "Right column",
        label: "Suggested for you",
        default: false,
        css: ['main div:has(a[href="/explore/people/"]):not(:has(article)):not(:has([data-pagelet="story_tray"]))'],
      },
      {
        id: "right-footer",
        group: "Right column",
        label: "Footer (About, Help…)",
        default: false,
        css: ['main footer'],
      },
      {
        // Blurs faces, names, text and media so screenshots show only the layout.
        id: "screenshot-mode",
        group: "Privacy",
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
    ],
  },
  {
    id: "gmail",
    label: "Gmail",
    hosts: ["mail.google.com"],
    // Gmail has almost no stable attributes: nav links are found by their href, the rest
    // by long-lived class names, which Google may change.
    groups: ["Top bar", "Sidebar", "Inbox", "Right side"],
    options: [
      {
        // "Inbox (3) - name@gmail.com - Gmail" becomes "Inbox (3)".
        id: "tab-title",
        group: "Top bar",
        label: "Tab title: folder only (hide email)",
        default: true,
        title: (t) => t.replace(/\s+[-–]\s+\S+@\S+[\s\S]*$/, ""),
      },
      {
        id: "compose",
        group: "Sidebar",
        label: "Compose button",
        default: false,
        css: ['.T-I.T-I-KE.L3'],
      },
      {
        id: "nav-starred",
        group: "Sidebar",
        label: "Starred",
        default: false,
        css: ['.aim:has(a[href$="#starred"])'],
      },
      {
        id: "nav-snoozed",
        group: "Sidebar",
        label: "Snoozed",
        default: false,
        css: ['.aim:has(a[href$="#snoozed"])'],
      },
      {
        id: "nav-important",
        group: "Sidebar",
        label: "Important",
        default: false,
        css: ['.aim:has(a[href$="#imp"])'],
      },
      {
        id: "nav-sent",
        group: "Sidebar",
        label: "Sent",
        default: false,
        css: ['.aim:has(a[href$="#sent"])'],
      },
      {
        id: "nav-drafts",
        group: "Sidebar",
        label: "Drafts",
        default: false,
        css: ['.aim:has(a[href$="#drafts"])'],
      },
      {
        id: "nav-scheduled",
        group: "Sidebar",
        label: "Scheduled",
        default: false,
        css: ['.aim:has(a[href$="#scheduled"])'],
      },
      {
        id: "nav-all",
        group: "Sidebar",
        label: "All Mail",
        default: false,
        css: ['.aim:has(a[href$="#all"])'],
      },
      {
        id: "nav-spam",
        group: "Sidebar",
        label: "Spam",
        default: false,
        css: ['.aim:has(a[href$="#spam"])'],
      },
      {
        id: "nav-trash",
        group: "Sidebar",
        label: "Trash",
        default: false,
        css: ['.aim:has(a[href$="#trash"])'],
      },
      {
        id: "nav-counts",
        group: "Sidebar",
        label: "Unread counts",
        default: false,
        css: ['.aim .bsU'],
      },
      {
        id: "inbox-tabs",
        group: "Inbox",
        label: "Category tabs (Promotions, Social…)",
        default: false,
        css: ['[role="main"] [role="tablist"]'],
      },
      {
        id: "side-panel",
        group: "Right side",
        label: "Side panel (Calendar, Keep, Tasks…)",
        default: false,
        css: ['.bq9', '.brC-aT5-aOt-Jw'],
      },
      {
        id: "gemini",
        group: "Top bar",
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
        group: "Top bar",
        label: "Help (?) button",
        default: false,
        css: [
          'header [data-tooltip="Support"]', 'header [data-tooltip="Suporte"]',
          'header [data-tooltip="Ajuda"]', 'header [data-tooltip="Help"]',
        ],
      },
      {
        id: "upgrade",
        group: "Top bar",
        label: "Upgrade button",
        default: false,
        css: [
          'header [data-pep-id^="global-pep"]',
          'header [data-rp-onramp-container]',
        ],
      },
      {
        id: "settings",
        group: "Top bar",
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
        group: "Top bar",
        label: "Google apps (grid) button",
        default: false,
        css: [
          'header a[href*="/about/products"]',
          'header div:has(> a[href*="/about/products"])',
          'header [aria-label="Google apps"]', 'header [aria-label="Apps Google"]',
          'header [aria-label="Apps do Google"]',
        ],
      },
    ],
  },
  {
    id: "x",
    label: "X",
    hosts: ["x.com", "twitter.com"],
    // Optional order of the popup sub-headings; groups not listed follow in order of first appearance.
    groups: ["Sidebar", "Home", "Posts", "Right column", "Floating buttons", "Appearance", "Privacy"],
    options: [
      {
        id: "sidebar-home",
        group: "Sidebar",
        label: "Home",
        default: false,
        css: [
          xSidebar('a[data-testid="AppTabBar_Home_Link"]'),
          xSidebar('a[href="/home"]'),
        ],
      },
      {
        id: "sidebar-explore",
        group: "Sidebar",
        label: "Explore",
        default: false,
        css: [
          xSidebar('a[data-testid="AppTabBar_Explore_Link"]'),
          xSidebar('a[href="/explore"]'),
        ],
      },
      {
        id: "sidebar-notifications",
        group: "Sidebar",
        label: "Notifications",
        default: false,
        css: [
          xSidebar('a[data-testid="AppTabBar_Notifications_Link"]'),
          xSidebar('a[href="/notifications"]'),
        ],
      },
      {
        id: "sidebar-follow",
        group: "Sidebar",
        label: "Follow",
        default: true,
        css: [xSidebar('a[href^="/i/connect"]')],
      },
      {
        id: "sidebar-chat",
        group: "Sidebar",
        label: "Chat",
        default: true,
        css: [
          xSidebar('a[data-testid="AppTabBar_DirectMessage_Link"]'),
          xSidebar('a[href="/i/chat"]'),
        ],
      },
      {
        id: "sidebar-calls",
        group: "Sidebar",
        label: "Calls",
        default: true,
        css: [xSidebar('a[href="/i/calls"]')],
      },
      {
        id: "sidebar-grok",
        group: "Sidebar",
        label: "Grok",
        default: true,
        css: [xSidebar('a[href="/i/grok"]')],
      },
      {
        id: "sidebar-history",
        group: "Sidebar",
        label: "History",
        default: false,
        css: [xSidebar('a[href^="/i/history"]')],
      },
      {
        id: "sidebar-premium",
        group: "Sidebar",
        label: "Premium",
        default: true,
        css: [xSidebar('a[href^="/i/premium"]')],
      },
      {
        id: "sidebar-profile",
        group: "Sidebar",
        label: "Profile",
        default: false,
        css: [xSidebar('a[data-testid="AppTabBar_Profile_Link"]')],
      },
      {
        id: "sidebar-more",
        group: "Sidebar",
        label: "More",
        default: false,
        css: [xSidebar('[data-testid="AppTabBar_More_Menu"]')],
      },
      {
        // Hides only the text next to each icon; the Post button and account menu are outside the <nav>.
        id: "sidebar-icons-only",
        group: "Sidebar",
        label: "Icons only (hide names)",
        default: false,
        css: [
          xSidebar('nav a div[dir="ltr"]'),
          xSidebar('nav button div[dir="ltr"]'),
        ],
      },
      {
        id: "sidebar-post-hide",
        group: "Sidebar",
        label: "Post button (hide)",
        default: true,
        css: [xSidebar('a[data-testid="SideNav_NewTweet_Button"]')],
      },
      {
        id: "sidebar-creator-studio",
        group: "Sidebar",
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
        group: "Right column",
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
        group: "Right column",
        label: "What's happening",
        default: false,
        css: ['div:has(> section > div[aria-label="Timeline: Trending now"])'],
      },
      {
        id: "right-who-to-follow",
        group: "Right column",
        label: "Who to follow",
        default: true,
        css: ['div:has(> div > aside[aria-label="Who to follow"])'],
      },
      {
        id: "right-footer",
        group: "Right column",
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
        group: "Floating buttons",
        label: "Grok button",
        default: true,
        css: ['[data-testid="GrokDrawer"]'],
      },
      {
        id: "floating-messages",
        group: "Floating buttons",
        label: "Messages button",
        default: true,
        css: ['[data-testid="chat-drawer-root"]'],
      },
      // Lines: borders are removed rather than the elements hidden. Each rule only
      // touches a known separator, so bordered cards (quoted posts, polls) are untouched.
      {
        id: "lines-all",
        group: "Appearance",
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
        group: "Home",
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
        group: "Home",
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
        group: "Right column",
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
        group: "Posts",
        label: "Action counts (hide, icons only)",
        default: true,
        css: ['article [role="group"] [data-testid="app-text-transition-container"]'],
      },
      {
        // X sets TwitterChirp on <body> and again on many elements, so every element is overridden.
        // The emoji families stay at the end of the stack so emoji still render.
        id: "system-font",
        group: "Appearance",
        label: "Use the system font",
        default: true,
        rules: [
          '*, *::before, *::after { font-family: -apple-system, system-ui, "Segoe UI", Roboto, Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji" !important; }',
        ],
      },
      {
        // X paints its pure-black background on many elements through generated classes, so
        // instead of selecting them, a fixed full-screen layer blends over the page with
        // `lighten` (per channel max): pure black becomes the chosen colour, while anything
        // brighter (text, borders, buttons) is untouched. Only dark colours make sense here.
        id: "bg-color",
        group: "Appearance",
        label: "Background color",
        offLabel: "Default (black)",
        default: "121212",
        choices: [
          { value: "15202b", label: "Dim blue" },
          { value: "121212", label: "Charcoal" },
          { value: "1c1c1e", label: "Dark gray" },
          { value: "0f172a", label: "Navy" },
          { value: "1a1410", label: "Warm brown" },
          { value: "0d1b14", label: "Forest" },
        ],
        rules: (hex) => [
          `html::before { content: ""; position: fixed; inset: 0; z-index: 2147483647; pointer-events: none; background: #${hex}; mix-blend-mode: lighten; }`,
        ],
      },
      {
        // Blurs faces, names, text and media so screenshots show only the layout.
        id: "screenshot-mode",
        group: "Privacy",
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
];
