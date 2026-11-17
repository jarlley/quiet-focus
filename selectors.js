// The single place where elements to hide are added.
// Loaded by both the content script and the popup: every option listed here
// automatically gets its own switch in the popup.
//
// Option format:
//   {
//     id: "shorts",                 // unique within the site
//     label: "Shorts",              // text shown in the popup
//     css: ['a[href^="/shorts"]'],  // selectors to hide (display: none !important)
//     rules: ['sel { ... }'],       // optional; raw CSS rules, for resizing instead of hiding
//     choices: [{ value, label }],  // optional; shows a dropdown instead of a switch, and
//                                   // `rules` becomes (value) => [...]; "" (default) is off
//     default: false,               // optional; hidden by default unless set to false
//     match: (root) => [...],       // optional; last resort when CSS is not enough
//   }                               // (returns elements; starts a MutationObserver)
//
// New options go at the END of the site's list: the popup shows them in this order.
//
// Prefer: aria-label, data-testid, href, stable ids.
// Avoid: auto-generated classes (e.g. .x1lliihq, .css-175oi2r).

// X: scope every selector to the left column so the same links
// elsewhere on the page (timeline, profiles) are never touched.
const xSidebar = (sel) => `header[role="banner"] ${sel}`;

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
    options: [],
  },
  {
    id: "x",
    label: "X",
    hosts: ["x.com", "twitter.com"],
    options: [
      {
        id: "sidebar-home",
        label: "Sidebar: Home",
        default: false,
        css: [
          xSidebar('a[data-testid="AppTabBar_Home_Link"]'),
          xSidebar('a[href="/home"]'),
        ],
      },
      {
        id: "sidebar-explore",
        label: "Sidebar: Explore",
        default: false,
        css: [
          xSidebar('a[data-testid="AppTabBar_Explore_Link"]'),
          xSidebar('a[href="/explore"]'),
        ],
      },
      {
        id: "sidebar-notifications",
        label: "Sidebar: Notifications",
        default: false,
        css: [
          xSidebar('a[data-testid="AppTabBar_Notifications_Link"]'),
          xSidebar('a[href="/notifications"]'),
        ],
      },
      {
        id: "sidebar-follow",
        label: "Sidebar: Follow",
        default: true,
        css: [xSidebar('a[href^="/i/connect"]')],
      },
      {
        id: "sidebar-chat",
        label: "Sidebar: Chat",
        default: true,
        css: [
          xSidebar('a[data-testid="AppTabBar_DirectMessage_Link"]'),
          xSidebar('a[href="/i/chat"]'),
        ],
      },
      {
        id: "sidebar-calls",
        label: "Sidebar: Calls",
        default: true,
        css: [xSidebar('a[href="/i/calls"]')],
      },
      {
        id: "sidebar-grok",
        label: "Sidebar: Grok",
        default: true,
        css: [xSidebar('a[href="/i/grok"]')],
      },
      {
        id: "sidebar-history",
        label: "Sidebar: History",
        default: false,
        css: [xSidebar('a[href^="/i/history"]')],
      },
      {
        id: "sidebar-premium",
        label: "Sidebar: Premium",
        default: true,
        css: [xSidebar('a[href^="/i/premium"]')],
      },
      {
        id: "sidebar-profile",
        label: "Sidebar: Profile",
        default: false,
        css: [xSidebar('a[data-testid="AppTabBar_Profile_Link"]')],
      },
      {
        id: "sidebar-more",
        label: "Sidebar: More",
        default: false,
        css: [xSidebar('[data-testid="AppTabBar_More_Menu"]')],
      },
      {
        // Hides only the text next to each icon; the Post button and account menu are outside the <nav>.
        id: "sidebar-icons-only",
        label: "Sidebar: icons only (hide names)",
        default: false,
        css: [
          xSidebar('nav a div[dir="ltr"]'),
          xSidebar('nav button div[dir="ltr"]'),
        ],
      },
      {
        id: "sidebar-post-hide",
        label: "Sidebar: Post button (hide)",
        default: true,
        css: [xSidebar('a[data-testid="SideNav_NewTweet_Button"]')],
      },
      {
        id: "sidebar-creator-studio",
        label: "Sidebar: Creator Studio",
        default: true,
        css: [xSidebar('a[href^="/i/jf/creators"]')],
      },
      // Right column. These cards have no data-testid, so they rely on aria-label,
      // which X renders in the interface language (English here). The label sits
      // on an inner element, while the bordered card (and its 1px frame) is a few
      // levels up, so :has() hides the whole card wrapper instead of only its content.
      {
        id: "right-premium",
        label: "Right column: Subscribe to Premium",
        default: true,
        css: [
          'div:has(> div > aside[aria-label="Subscribe to Premium"])',
          // empty divider card that follows it
          'div:has(> div > aside[aria-label="Subscribe to Premium"]) + div',
        ],
      },
      {
        id: "right-trending",
        label: "Right column: What's happening",
        default: false,
        css: ['div:has(> section > div[aria-label="Timeline: Trending now"])'],
      },
      {
        id: "right-who-to-follow",
        label: "Right column: Who to follow",
        default: true,
        css: ['div:has(> div > aside[aria-label="Who to follow"])'],
      },
      {
        id: "right-footer",
        label: "Right column: Footer (Terms, Privacy…)",
        default: true,
        css: [
          'nav[aria-label="Footer"]',
          'nav:has(a[href="/tos"]):has(a[href="/privacy"])', // language-independent fallback
        ],
      },
      // Floating buttons in the bottom-right corner.
      {
        id: "floating-grok",
        label: "Floating: Grok button",
        default: true,
        css: ['[data-testid="GrokDrawer"]'],
      },
      {
        id: "floating-messages",
        label: "Floating: Messages button",
        default: true,
        css: ['[data-testid="chat-drawer-root"]'],
      },
      // Lines: borders are removed rather than the elements hidden. Each rule only
      // touches a known separator, so bordered cards (quoted posts, polls) are untouched.
      {
        id: "lines-all",
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
        label: "Home: post box (What's happening?)",
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
        label: "Home: \"For you\" tab",
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
        label: "Right column: search box (hide)",
        default: false,
        css: [
          '[data-testid="sidebarColumn"] div:has(form[role="search"]):not(:has(aside)):not(:has(section)):not(:has(nav))',
          '[data-testid="sidebarColumn"] form[role="search"]',
        ],
      },
      {
        // Reply, repost, like and view counts live in this container inside the action bar.
        id: "post-counts-hide",
        label: "Posts: action counts (hide, icons only)",
        default: true,
        css: ['article [role="group"] [data-testid="app-text-transition-container"]'],
      },
      {
        // X sets TwitterChirp on <body> and again on many elements, so every element is overridden.
        // The emoji families stay at the end of the stack so emoji still render.
        id: "system-font",
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
    ],
  },
];
