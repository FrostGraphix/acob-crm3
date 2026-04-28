import { useState } from "react";

const P = "'Poppins', sans-serif";
const M = "'DM Mono', monospace";

const style = `
  @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700;800&family=DM+Mono:wght@400;500&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Poppins', sans-serif; background: #F2F4F2; color: #0d1f10; }
  ::-webkit-scrollbar { width: 5px; }
  ::-webkit-scrollbar-thumb { background: #c8d5c8; border-radius: 4px; }
  @keyframes fadeIn { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
  .section { animation: fadeIn 0.3s ease both; }
  .swatch:hover { transform: translateY(-3px); box-shadow: 0 8px 24px rgba(0,0,0,0.12) !important; }
  .token-row:hover { background: #f6faf6 !important; }
  .nav-btn:hover { background: rgba(255,255,255,0.08) !important; }
`;

/* ── TOKENS ─────────────────────────────────────────────────────────────────── */
const C = {
  // Sidebar / Backgrounds
  sidebar:       { value:"#011508", name:"Sidebar BG",         use:"App sidebar background" },
  sidebarMid:    { value:"#021f0d", name:"Sidebar Mid",        use:"Sidebar header, gradient end" },
  sidebarAccent: { value:"#013b18", name:"Sidebar Accent",     use:"Hero card gradient, dark panels" },

  // Primary — Forest Green
  primary:       { value:"#008000", name:"Primary",            use:"CTA buttons, active nav, success states" },
  primaryDark:   { value:"#006600", name:"Primary Dark",       use:"Hover state of primary" },
  primaryLight:  { value:"#e6f4e6", name:"Primary Light",      use:"Selected bg, chip bg, subtle fills" },

  // Lemon — Brand Accent
  lemon:         { value:"#C6E000", name:"Lemon",              use:"Logo, badge borders, lemon buttons, 2FA CTA" },
  lemonDark:     { value:"#A5BB00", name:"Lemon Dark",         use:"Lemon hover, remote-send accent" },
  lemonLight:    { value:"#F4FAC2", name:"Lemon Light",        use:"Lemon InfoBox bg, maker-checker highlight" },
  lemonText:     { value:"#2B3300", name:"Lemon Text",         use:"Text on lemon backgrounds (WCAG AA)" },

  // Surfaces
  bg:            { value:"#F2F4F2", name:"Page BG",            use:"App page background" },
  surface:       { value:"#FFFFFF", name:"Surface",            use:"Cards, modals, table rows" },
  surface2:      { value:"#FAFBFA", name:"Surface 2",          use:"Table headers, modal footers, alternating rows" },

  // Text
  text:          { value:"#0d1f10", name:"Text Primary",       use:"Headings, body copy, table cells" },
  textMid:       { value:"#374151", name:"Text Mid",           use:"Labels, form labels" },
  muted:         { value:"#6B7280", name:"Text Muted",         use:"Secondary labels, metadata, hints" },
  faint:         { value:"#9CA3AF", name:"Text Faint",         use:"Placeholder, divider labels, timestamps" },

  // Borders
  border:        { value:"#E5EAE5", name:"Border",             use:"Default card/table borders" },
  border2:       { value:"#D1D8D1", name:"Border Strong",      use:"Input borders, focus rings" },

  // Semantic — Success
  success:       { value:"#008000", name:"Success",            use:"Successful badge, success text" },
  successBg:     { value:"#e6f4e6", name:"Success BG",         use:"Success badge bg, InfoBox bg" },
  successText:   { value:"#014d01", name:"Success Text",       use:"Text in success badge/InfoBox" },

  // Semantic — Danger
  danger:        { value:"#DC2626", name:"Danger",             use:"Error badge, danger button, critical exception border" },
  dangerBg:      { value:"#FEF2F2", name:"Danger BG",          use:"Danger badge bg, InfoBox bg" },
  dangerText:    { value:"#991B1B", name:"Danger Text",        use:"Text in danger badge/InfoBox" },

  // Semantic — Warning
  warning:       { value:"#D97706", name:"Warning",            use:"Warning badge, reserved amount text" },
  warningBg:     { value:"#FFFBEB", name:"Warning BG",         use:"Warning badge bg, InfoBox bg" },
  warningText:   { value:"#92400E", name:"Warning Text",       use:"Text in warning badge/InfoBox" },

  // Semantic — Info
  info:          { value:"#2563EB", name:"Info",               use:"Info badge, info button" },
  infoBg:        { value:"#EFF6FF", name:"Info BG",            use:"Info badge bg, InfoBox bg" },
  infoText:      { value:"#1E40AF", name:"Info Text",          use:"Text in info badge/InfoBox" },

  // Semantic — Purple
  purpleBg:      { value:"#F5F3FF", name:"Purple BG",          use:"Receipts quick-action card bg" },
  purpleText:    { value:"#5B21B6", name:"Purple Text",        use:"Receipts accent, system role badge" },
};

const GROUPS = [
  { label:"Sidebar / Backgrounds", keys:["sidebar","sidebarMid","sidebarAccent"] },
  { label:"Primary Green", keys:["primary","primaryDark","primaryLight"] },
  { label:"Lemon Accent", keys:["lemon","lemonDark","lemonLight","lemonText"] },
  { label:"Surfaces", keys:["bg","surface","surface2"] },
  { label:"Typography", keys:["text","textMid","muted","faint"] },
  { label:"Borders", keys:["border","border2"] },
  { label:"Success", keys:["success","successBg","successText"] },
  { label:"Danger", keys:["danger","dangerBg","dangerText"] },
  { label:"Warning", keys:["warning","warningBg","warningText"] },
  { label:"Info", keys:["info","infoBg","infoText"] },
  { label:"Purple", keys:["purpleBg","purpleText"] },
];

/* ── TYPOGRAPHY SCALE ───────────────────────────────────────────────────────── */
const TYPE_SCALE = [
  { name:"Display",      family:"Poppins",  weight:"800",  size:"44px",  lh:"1.0",  use:"Hero wallet balance on dark card" },
  { name:"Heading 1",    family:"Poppins",  weight:"800",  size:"24px",  lh:"1.2",  use:"Page titles on admin dashboard" },
  { name:"Heading 2",    family:"Poppins",  weight:"700",  size:"22px",  lh:"1.25", use:"Section headings (Fund Wallet, Vendors)" },
  { name:"Heading 3",    family:"Poppins",  weight:"700",  size:"16px",  lh:"1.3",  use:"Card titles, modal titles" },
  { name:"Heading 4",    family:"Poppins",  weight:"700",  size:"15px",  lh:"1.35", use:"Card section titles (Today's Summary)" },
  { name:"Body",         family:"Poppins",  weight:"400",  size:"13px",  lh:"1.65", use:"Table cells, form body, descriptions" },
  { name:"Body Strong",  family:"Poppins",  weight:"600",  size:"13px",  lh:"1.65", use:"Table bold cells, key-value values" },
  { name:"Caption",      family:"Poppins",  weight:"400",  size:"12px",  lh:"1.6",  use:"Form hints, modal subtitles, secondary labels" },
  { name:"Label",        family:"Poppins",  weight:"600",  size:"11px",  lh:"1.5",  use:"Form labels, badge text, nav section labels" },
  { name:"Micro",        family:"Poppins",  weight:"700",  size:"10px",  lh:"1.4",  use:"Table headers (uppercase), KPI labels" },
  { name:"Mono",         family:"DM Mono",  weight:"400",  size:"13px",  lh:"1.5",  use:"References, meter SN, account numbers, tokens" },
  { name:"Mono Small",   family:"DM Mono",  weight:"400",  size:"11-12px",lh:"1.5", use:"Audit log entries, batch IDs, timestamps" },
  { name:"Token Display",family:"DM Mono",  weight:"500",  size:"26-28px",lh:"1.2", use:"20-digit electricity token display" },
];

/* ── SPACING ────────────────────────────────────────────────────────────────── */
const SPACING = [
  { token:"2px",  use:"Micro gaps (icon to text in badge)" },
  { token:"4px",  use:"Badge dot to label" },
  { token:"6px",  use:"Button inner gap, close button" },
  { token:"8px",  use:"Chip gap, filter pill gap, table cell padding (xs)" },
  { token:"10px", use:"Nav item padding horizontal, sidebar role badge padding" },
  { token:"12px", use:"Table cell padding (standard), modal inner gap" },
  { token:"14px", use:"Card section label padding, InfoBox padding" },
  { token:"16px", use:"KPI card padding, table header cell padding" },
  { token:"18px", use:"Sidebar footer padding, topbar horizontal padding" },
  { token:"20px", use:"Modal content padding, exception card padding" },
  { token:"22px", use:"Main card padding (standard card)" },
  { token:"24px", use:"Page padding (all screen edges)" },
  { token:"28px", use:"Hero wallet card padding" },
  { token:"32px", use:"Auth modal inner padding" },
  { token:"36px", use:"Vendor login left panel padding" },
  { token:"44px", use:"Auth page panel top padding" },
];

/* ── BORDER RADIUS ──────────────────────────────────────────────────────────── */
const RADII = [
  { token:"4px",  use:"Very small: table header labels, progress bars" },
  { token:"6px",  use:"Input quick-amount chips, small tags" },
  { token:"7px",  use:"Amount preset buttons" },
  { token:"8px",  use:"Buttons (all sizes), close button, nav items, KPI icon bg" },
  { token:"9px",  use:"Sub-card sections, search result box, reference pill" },
  { token:"10px", use:"Wallet sub-stat boxes, proof upload area, KPI card inner" },
  { token:"12px", use:"InfoBox, modal sub-panels, proof rows, transfer detail box" },
  { token:"14px", use:"Main content cards (tables, vendor cards)" },
  { token:"16px", use:"Buy-units step cards, fund-wallet cards" },
  { token:"18px", use:"Modal container, auth card panel" },
  { token:"20px", use:"Auth split-panel wrapper" },
  { token:"22px", use:"Auth admin login card" },
];

/* ── SHADOW ─────────────────────────────────────────────────────────────────── */
const SHADOWS = [
  { name:"Button Primary",   value:"0 1px 6px rgba(0,128,0,0.30)",         use:"Primary (green) buttons" },
  { name:"Button Lemon",     value:"0 1px 6px rgba(198,224,0,0.40)",        use:"Lemon buttons" },
  { name:"Button Danger",    value:"0 1px 4px rgba(220,38,38,0.25)",        use:"Danger buttons" },
  { name:"Logo Lemon",       value:"0 4px 12px rgba(198,224,0,0.18)",       use:"Sidebar/auth lemon logo mark" },
  { name:"Auth Logo Float",  value:"0 8px 32px rgba(198,224,0,0.35)",       use:"Admin login floating logo" },
  { name:"Card Lift",        value:"0 8px 28px rgba(2,85,34,0.10)",         use:"Hover state on interactive cards" },
  { name:"Hero Wallet",      value:"0 8px 40px rgba(1,21,8,0.22)",          use:"Dashboard hero wallet card" },
  { name:"Auth Panel",       value:"0 32px 120px rgba(0,0,0,0.50)",         use:"Auth split-panel wrapper" },
  { name:"Modal",            value:"0 28px 80px rgba(1,21,8,0.25)",         use:"Modal dialog" },
  { name:"Focus Ring",       value:"0 0 0 3px rgba(0,128,0,0.10)",          use:"Input/select/textarea focus" },
];

/* ── COMPONENTS ─────────────────────────────────────────────────────────────── */
const COMPONENTS = [
  {
    name:"Badge",
    desc:"Inline status indicator. Never interactive — display only.",
    variants:[
      { label:"success", bg:"#e6f4e6", color:"#014d01", border:"#b7dfc8", text:"posted / successful / approved" },
      { label:"danger",  bg:"#FEF2F2", color:"#991B1B", border:"#fecaca", text:"failed / suspended / danger" },
      { label:"warning", bg:"#FFFBEB", color:"#92400E", border:"#fcd34d", text:"under review / pending" },
      { label:"info",    bg:"#EFF6FF", color:"#1E40AF", border:"#bfdbfe", text:"remote send / submitted" },
      { label:"lemon",   bg:"#F4FAC2", color:"#2B3300", border:"#d6ee66", text:"funding / maker-checker" },
      { label:"purple",  bg:"#F5F3FF", color:"#5B21B6", border:"#DDD6FE", text:"system role in audit log" },
      { label:"gray",    bg:"#F9FAFB", color:"#6B7280", border:"#E5EAE5", text:"unknown / neutral" },
    ],
    rules:[
      "font-size: 11px, font-weight: 600, border-radius: 20px",
      "Always include a colored border — never borderless",
      "Optional dot (5×5px) for live/active states",
      "Size 'lg' (12px, 5px 13px) used only in page-level summary badges",
      "Never use for interactive actions — use Btn instead",
    ],
  },
  {
    name:"Btn",
    desc:"All interactive triggers. Seven semantic variants.",
    variants:[
      { label:"primary",  bg:"#008000", color:"#fff",    text:"Confirm Purchase, Sign In, Approve & Post" },
      { label:"lemon",    bg:"#C6E000", color:"#2B3300", text:"Funding Queue Review, Manual Credit Request" },
      { label:"danger",   bg:"#DC2626", color:"#fff",    text:"Reject, Freeze Wallet, Suspend Vendor" },
      { label:"outline",  bg:"transparent", color:"#374151", text:"Cancel, Export CSV, Print, Back" },
      { label:"ghost",    bg:"transparent", color:"#6B7280", text:"View, Change meter, View all →" },
      { label:"subtle",   bg:"#e6f4e6", color:"#008000", text:"Approve (inline table), Reactivate" },
      { label:"dark",     bg:"#011508", color:"#fff",    text:"Reserved for special dark-surface actions" },
    ],
    sizes:[
      { label:"xs (11px, 3px 9px)",  use:"Table row inline actions" },
      { label:"sm (12px, 6px 14px)", use:"Topbar actions, filter pills, card secondary CTAs" },
      { label:"md (13px, 9px 18px)", use:"Modal CTAs, step navigation, primary page actions" },
    ],
    rules:[
      "font-weight: 600, border-radius: 8px",
      "All variants have transition: all 0.15s",
      "btn-press class adds :active { transform: scale(0.97) }",
      "full prop: width 100%, justify-content center",
      "disabled: opacity 0.5, cursor not-allowed",
      "Never use ghost for primary destructive actions",
      "lemon text must always be #2B3300 — never white (contrast failure)",
    ],
  },
  {
    name:"InfoBox",
    desc:"Contextual messaging block. Five semantic types.",
    variants:[
      { label:"info",    bg:"#EFF6FF", color:"#1E40AF", border:"#bfdbfe", icon:"Info",          text:"System notices, API route references" },
      { label:"success", bg:"#e6f4e6", color:"#014d01", border:"#b7dfc8", icon:"Check",         text:"Confirmation (proof submitted, wallet credited)" },
      { label:"warning", bg:"#FFFBEB", color:"#92400E", border:"#fcd34d", icon:"AlertTriangle",  text:"Irreversible action warnings" },
      { label:"danger",  bg:"#FEF2F2", color:"#991B1B", border:"#fecaca", icon:"XCircle",       text:"Critical exceptions, SLA breaches" },
      { label:"lemon",   bg:"#F4FAC2", color:"#2B3300", border:"#d6ee66", icon:"Info",          text:"Funding ≠ Token, maker-checker policy" },
    ],
    rules:[
      "border-radius: 10px, padding: 10px 14px",
      "Icon size: 14px, flexShrink: 0, marginTop: 1px",
      "Body font-size: 12px, line-height: 1.65",
      "Use <strong> and <code> tags inline for emphasis",
      "Always placed before the action button it contextualises",
    ],
  },
  {
    name:"KPI Card",
    desc:"Dashboard metric block. Used in 3–4 column grids.",
    rules:[
      "border-radius: 12px, padding: 16px 18px",
      "Label: 10px, 700, uppercase, 0.07em letter-spacing",
      "Value: 23px, 700, letter-spacing -0.5px",
      "Sub: 11px, T.faint color",
      "Icon: 30×30px bg box, 14px icon, uses 'accent' prop for bg color",
      "card-lift class: hover translateY(-2px) + shadow",
      "valueColor prop overrides default T.text",
      "accent prop sets icon bg (use semantic Bg token e.g. successBg, dangerBg)",
    ],
  },
  {
    name:"Modal",
    desc:"Full-screen overlay dialog.",
    rules:[
      "Backdrop: rgba(1,21,8,0.55), backdropFilter: blur(4px)",
      "Container: border-radius 18px, maxHeight 92vh, flex column",
      "Header: 18px 22px padding, Poppins 700 16px title, Poppins 12px subtitle",
      "Body: 22px padding, overflowY auto, flex: 1",
      "Footer: 14px 22px, background: T.surface2, borderRadius: 0 0 18px 18px",
      "Footer layout: danger action LEFT, flex:1 spacer, cancel + confirm RIGHT",
      "Close button: 30×30px, background: T.bg, border: T.border",
      "wide prop: maxWidth 600px | xwide: maxWidth 800px | default: 480px",
      "Always use fadeIn + fadeUp animation classes",
    ],
  },
  {
    name:"Data Table",
    desc:"Full-width tabular data display.",
    rules:[
      "Table: width 100%, borderCollapse collapse, wrapped in overflowX auto div",
      "<Th>: 10px 16px padding, 10px text, 700, uppercase, letterSpacing 0.07em, background T.surface2",
      "<Td>: 12px 16px padding, 13px text, borderBottom T.border",
      "Mono cells: DM Mono font, 12-13px",
      "Row hover: class row-hover → background #f6faf6",
      "Status cells always use Badge component",
      "Action cells: display flex, gap 6px, no padding changes",
      "Colored text: danger=T.danger, success=T.success, warning=T.warning, muted=T.muted",
      "Never use striped rows — use row-hover only",
    ],
  },
];

/* ── LAYOUT SYSTEM ──────────────────────────────────────────────────────────── */
const LAYOUT = [
  {
    name:"App Shell",
    desc:"Top-level layout: fixed sidebar + flex column main area.",
    spec:`
display: flex
height: 100vh
overflow: hidden

├── Sidebar         width: 230px, flex-shrink: 0, overflowY: auto
│   ├── Logo area   padding: 18px 16px 14px
│   ├── Role badge  padding: 8px 14px 10px
│   ├── <nav>       flex: 1, padding: 8px 10px
│   └── User footer padding: 12px 14px
│
└── Main area       flex: 1, display: flex, flexDirection: column, minWidth: 0
    ├── Topbar      height: 60px, flex-shrink: 0, padding: 0 24px
    └── Content     flex: 1, overflowY: auto
        └── Screen  padding: 24px (all screens)`,
  },
  {
    name:"Grid System",
    desc:"CSS Grid for KPI rows, quick-action cards, and info panels.",
    spec:`
4-column KPI row (Admin Dashboard, Wallets, Purchases, Exceptions)
  grid-template-columns: repeat(4, minmax(0, 1fr))
  gap: 12px

4-column Quick Actions (Vendor Dashboard)
  grid-template-columns: repeat(4, 1fr)
  gap: 12px

2-column Split (Chart + sub-panel)
  grid-template-columns: 2fr 1fr
  gap: 16px

2-column Split (equal)
  grid-template-columns: 1fr 1fr
  gap: 16px

4-column Wallet Stats (inside wallet hero)
  grid-template-columns: repeat(4, 1fr)
  no gap — natural equal spacing

Auto-fill receipt cards
  grid-template-columns: repeat(auto-fill, minmax(270px, 1fr))
  gap: 14px

Form fields (2 columns)
  grid-template-columns: 1fr 1fr
  gap: 12px`,
  },
  {
    name:"Sidebar Nav Structure",
    desc:"Section labels + nav items with active state.",
    spec:`
Section label
  font-size: 10px, font-weight: 700, uppercase
  letter-spacing: 0.1em, color: rgba(255,255,255,0.2)
  padding: 12px 8px 4px

Nav item (inactive)
  background: transparent
  color: rgba(255,255,255,0.5)
  border-left: 3px solid transparent
  font-weight: 400

Nav item (active)
  background: T.primary (#008000)
  color: #fff
  border-left: 3px solid T.lemon (#C6E000)
  font-weight: 600

Badge on nav item
  position: right-aligned
  background: T.lemon or T.danger
  border-radius: 10px, 10px font-size, 700 weight`,
  },
  {
    name:"Topbar",
    desc:"60px fixed header, always visible.",
    spec:`
height: 60px
background: T.surface
border-bottom: 1px solid T.border
padding: 0 24px

Left: Page title (17px, 700, Poppins) + subtitle (11px, T.muted)
Right (left-to-right):
  1. Contextual action button (Buy Units / Vendor Portal link)
  2. Notification bell (36×36px, relative, with pulse dot)
  3. Avatar circle (34×34px, initials, role-colored)`,
  },
  {
    name:"Auth Pages",
    desc:"Two distinct full-screen auth layouts.",
    spec:`
Vendor Login — split panel (max-width: 960px)
  Left panel:  flex 0 0 340px, dark green gradient
               Logo → headline → mini chart → feature list
  Right panel: flex 1, white surface
               Login / Forgot / First-login tabs (fadeIn animated)

Admin Login — centered card (max-width: 440px)
  Dark background (#0d1f10) with radial gradient overlay
  Floating lemon logo (float animation)
  Glassmorphism card: rgba(255,255,255,0.04), backdropFilter blur(12px)
  Step 1: Credentials → Step 2: OTP grid (6 inputs)`,
  },
  {
    name:"Screen Content Areas",
    desc:"Consistent internal structure for every screen.",
    spec:`
Every screen:
  padding: 24px
  fadeUp animation class

Page header block (top of screen)
  Title: Poppins 800 22px
  Subtitle: Poppins 400 13px, T.muted
  Right slot: primary action button or badge

KPI row (admin screens)
  4-column grid, gap 12px, margin-bottom 22px

Primary content (tables, forms, cards)
  Cards: background T.surface, border T.border, borderRadius 14px
  Tables: wrapped in card, overflowX auto

Filter row (above tables)
  display flex, gap 6-8px, flexWrap wrap
  Pills: padding 5px 14px, borderRadius 20px`,
  },
];

/* ── ANIMATION SYSTEM ───────────────────────────────────────────────────────── */
const ANIMATIONS = [
  { name:"fadeUp",     keyframes:"opacity 0→1, translateY 10px→0",  duration:"0.35s ease",  use:"Page screens on mount (class: fadeUp)" },
  { name:"fadeIn",     keyframes:"opacity 0→1",                      duration:"0.25s ease",  use:"Modal overlay, tab switches, step changes (class: fadeIn)" },
  { name:"slideRight", keyframes:"opacity 0→1, translateX -12px→0", duration:"0.30s ease",  use:"Multi-step form card transitions (class: slideRight)" },
  { name:"pulse",      keyframes:"opacity 1→0.4→1",                  duration:"2s ease-in-out infinite", use:"Notification dot, active status dot" },
  { name:"spin",       keyframes:"rotate 0→360deg",                  duration:"0.7s linear infinite",    use:"Loading spinner inside buttons" },
  { name:"glowGreen",  keyframes:"box-shadow 0→8px rgba(0,128,0)→0",duration:"2s ease-in-out infinite",  use:"Success state icon (purchase complete, proof submitted)" },
  { name:"glowLemon",  keyframes:"box-shadow 0→8px rgba(198,224,0)→0",duration:"2s ease-in-out infinite","use":"Lemon accent glow (reserved for special states)" },
  { name:"float",      keyframes:"translateY 0→-5px→0",              duration:"3s ease-in-out infinite", use:"Admin login logo mark" },
];

/* ── NAMING CONVENTIONS ─────────────────────────────────────────────────────── */
const NAMING = [
  { category:"Files",         rules:["Components: PascalCase  →  VDashboard.jsx, AFunding.jsx","Hooks: camelCase  →  useWallet.js","Utilities: camelCase  →  formatCurrency.js","Screens prefixed by role: V = Vendor, A = Admin"] },
  { category:"CSS Classes",   rules:["Utility classes: kebab-case  →  row-hover, card-lift, btn-press","Animation classes: camelCase  →  fadeUp, fadeIn, slideRight","nav-item: used on sidebar nav buttons"] },
  { category:"Token Objects", rules:["All tokens in single T object","Keys: camelCase  →  T.primaryLight, T.lemonText, T.border2","Font constants: P = Poppins string, M = DM Mono string"] },
  { category:"Props",         rules:["Variant prop: always lowercase string  →  variant='primary'","Size prop: 'xs' | 'sm' | 'md'","Boolean shortcuts: full, dot, mono, muted, bold, danger, success"] },
  { category:"State",         rules:["Screen state: view string  →  'v-dashboard', 'a-funding'","Role state: 'vendor' | 'admin'","Auth state: 'vendor-login' | 'admin-login' | 'app'","Modal state: null | string key  →  'approve-funding', 'receipt'"] },
  { category:"Mock Data",     rules:["Arrays: SCREAMING_SNAKE_CASE  →  VENDORS_DATA, TXNS, AUDIT_EVENTS","Constants: SCREAMING_SNAKE_CASE  →  VENDOR_ME, WALLET","Computed constants at module level  →  const AVAIL = WALLET.float - WALLET.reserved"] },
];

/* ── DO / DON'T ─────────────────────────────────────────────────────────────── */
const RULES = [
  { do:"Use T.lemon (#C6E000) with T.lemonText (#2B3300) — always dark text on lemon",    dont:"Never use white text on lemon background — WCAG contrast fails" },
  { do:"Use DM Mono for all references, IDs, meter SNs, tokens, account numbers",          dont:"Never use Poppins for 20-digit token display or transaction references" },
  { do:"Use Badge for status display; use Btn for interactive triggers",                    dont:"Never make a Badge clickable; never style a Btn to look like a Badge" },
  { do:"InfoBox type='lemon' for all funding ≠ token clarifications",                       dont:"Never omit the funding/token distinction on the Fund Wallet and Dashboard screens" },
  { do:"Modal footer: destructive action LEFT, confirm action RIGHT",                       dont:"Never place both confirm and cancel on the same side" },
  { do:"Every screen: padding 24px, fadeUp animation, page title Poppins 800 22px",        dont:"Never vary screen padding — no 16px, 20px, 32px for screen edges" },
  { do:"row-hover class on all interactive <tr> elements",                                  dont:"Never use striped table rows or alternating row backgrounds" },
  { do:"Animation: fadeIn for modals/tab switches; slideRight for step card transitions",   dont:"Never animate page scrolling or use motion for decorative-only elements" },
  { do:"lemon sidebar border-left on active nav item",                                      dont:"Never use a background-only active nav state — the lemon border is mandatory" },
  { do:"Maker-checker: always show which role the user is playing (maker vs checker)",      dont:"Never allow the same user to approve their own manual credit request" },
];

/* ═══════════════════════════════════════════════════════════════════════════════
   RENDER
═══════════════════════════════════════════════════════════════════════════════ */

const TABS = ["Colors","Typography","Spacing & Radius","Shadows","Components","Layout","Animation","Conventions","Rules"];

export default function App() {
  const [tab, setTab] = useState("Colors");

  const Tag = ({ children, bg="#e6f4e6", color="#014d01", mono }: { children: any; bg?: string; color?: string; mono?: boolean }) => (
    <span style={{ background:bg, color, borderRadius:5, padding:"2px 8px", fontSize:11, fontWeight:600, fontFamily:mono?M:P, border:`1px solid ${color}22`, whiteSpace:"nowrap" }}>{children}</span>
  );

  return (
    <>
      <style>{style}</style>
      <div style={{ display:"flex", height:"100vh", fontFamily:P, overflow:"hidden" }}>

        {/* ── SIDEBAR ── */}
        <div style={{ width:220, background:"#011508", flexShrink:0, display:"flex", flexDirection:"column", overflowY:"auto" }}>
          <div style={{ padding:"20px 18px 16px", borderBottom:"1px solid rgba(255,255,255,0.06)" }}>
            <div style={{ width:40, height:40, background:"#C6E000", borderRadius:10, display:"flex", alignItems:"center", justifyContent:"center", fontWeight:800, fontSize:18, color:"#2B3300", marginBottom:12 }}>A</div>
            <div style={{ color:"#fff", fontWeight:800, fontSize:14 }}>ACOB CRM3</div>
            <div style={{ color:"rgba(255,255,255,0.35)", fontSize:11, marginTop:2 }}>Design System v1.0</div>
          </div>
          <div style={{ flex:1, padding:"10px 10px" }}>
            {["Colors","Typography","Spacing & Radius","Shadows","Components","Layout","Animation","Conventions","Rules"].map(t => (
              <button key={t} className="nav-btn" onClick={()=>setTab(t)} style={{ width:"100%", display:"flex", alignItems:"center", gap:8, padding:"8px 10px", borderRadius:8, border:"none", cursor:"pointer", marginBottom:2, textAlign:"left", background:tab===t?"#008000":"transparent", color:tab===t?"#fff":"rgba(255,255,255,0.5)", fontSize:12, fontWeight:tab===t?600:400, fontFamily:P, transition:"all 0.15s", borderLeft:tab===t?"3px solid #C6E000":"3px solid transparent" }}>{t}</button>
            ))}
          </div>
          <div style={{ padding:"12px 16px", borderTop:"1px solid rgba(255,255,255,0.06)", fontSize:10, color:"rgba(255,255,255,0.2)" }}>© 2025 ACOB Lighting Technology Ltd</div>
        </div>

        {/* ── MAIN ── */}
        <div style={{ flex:1, overflowY:"auto", padding:28 }}>

          {/* COLORS */}
          {tab==="Colors" && (
            <div className="section">
              <div style={{ marginBottom:24 }}>
                <div style={{ fontSize:22, fontWeight:800, color:"#0d1f10" }}>Color System</div>
                <div style={{ fontSize:13, color:"#6B7280", marginTop:4 }}>All tokens live in the <Tag mono>T</Tag> object. Reference as <Tag mono>T.primary</Tag>, <Tag mono>T.lemon</Tag>, etc.</div>
              </div>
              {GROUPS.map(g => (
                <div key={g.label} style={{ marginBottom:30 }}>
                  <div style={{ fontSize:12, fontWeight:700, color:"#6B7280", textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:12 }}>{g.label}</div>
                  <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(200px,1fr))", gap:12 }}>
                    {g.keys.map(k => {
                      const tok = (C as any)[k];
                      const isDark = ["#011508","#021f0d","#013b18","#008000","#006600","#DC2626","#D97706","#2563EB","#5B21B6","#014d01","#991B1B","#92400E","#1E40AF","#2B3300"].includes(tok.value);
                      return (
                        <div key={k} className="swatch" style={{ borderRadius:12, overflow:"hidden", border:"1px solid #E5EAE5", transition:"all 0.2s", cursor:"default" }}>
                          <div style={{ height:64, background:tok.value, display:"flex", alignItems:"flex-end", padding:"8px 12px" }}>
                            <span style={{ fontFamily:M, fontSize:11, fontWeight:500, color:isDark?"rgba(255,255,255,0.7)":"rgba(0,0,0,0.45)" }}>{tok.value}</span>
                          </div>
                          <div style={{ padding:"10px 12px", background:"#fff" }}>
                            <div style={{ fontWeight:700, fontSize:12, color:"#0d1f10" }}>{tok.name}</div>
                            <div style={{ fontFamily:M, fontSize:10, color:"#6B7280", marginTop:2 }}>T.{k}</div>
                            <div style={{ fontSize:11, color:"#9CA3AF", marginTop:4, lineHeight:1.5 }}>{tok.use}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}

              {/* Pairings */}
              <div style={{ marginBottom:14 }}>
                <div style={{ fontSize:12, fontWeight:700, color:"#6B7280", textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:12 }}>Approved Pairings</div>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10 }}>
                  {[
                    { bg:"#008000", fg:"#fff",    label:"Primary on White",   use:"Primary buttons" },
                    { bg:"#C6E000", fg:"#2B3300",  label:"Lemon on Lemon Text",use:"Lemon buttons, logo" },
                    { bg:"#011508", fg:"#C6E000",  label:"Lemon on Dark",      use:"Active nav border, sidebar logo" },
                    { bg:"#011508", fg:"#fff",     label:"White on Sidebar",   use:"Nav items, sidebar text" },
                    { bg:"#e6f4e6", fg:"#014d01",  label:"Success pair",        use:"Success badge" },
                    { bg:"#FEF2F2", fg:"#991B1B",  label:"Danger pair",         use:"Danger badge" },
                  ].map(p => (
                    <div key={p.label} style={{ borderRadius:10, overflow:"hidden", border:"1px solid #E5EAE5" }}>
                      <div style={{ background:p.bg, padding:"12px 14px", color:p.fg, fontWeight:700, fontSize:13, fontFamily:P }}>{p.label}</div>
                      <div style={{ padding:"8px 14px", background:"#fff" }}>
                        <div style={{ fontSize:11, color:"#6B7280" }}>{p.use}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TYPOGRAPHY */}
          {tab==="Typography" && (
            <div className="section">
              <div style={{ marginBottom:24 }}>
                <div style={{ fontSize:22, fontWeight:800, color:"#0d1f10" }}>Typography</div>
                <div style={{ fontSize:13, color:"#6B7280", marginTop:4 }}>Two typefaces: <Tag>Poppins</Tag> for all UI text · <Tag mono>DM Mono</Tag> for codes, IDs, tokens, timestamps.</div>
              </div>
              <div style={{ background:"#fff", borderRadius:14, border:"1px solid #E5EAE5", overflow:"hidden" }}>
                <table style={{ width:"100%", borderCollapse:"collapse" }}>
                  <thead>
                    <tr style={{ background:"#FAFBFA" }}>
                      {["Style","Font","Weight","Size","Line-Height","Usage"].map(h => (
                        <th key={h} style={{ padding:"10px 16px", textAlign:"left", fontSize:10, fontWeight:700, color:"#6B7280", borderBottom:"1px solid #E5EAE5", textTransform:"uppercase", letterSpacing:"0.07em", fontFamily:P, whiteSpace:"nowrap" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {TYPE_SCALE.map((t,i) => (
                      <tr key={t.name} className="token-row" style={{ background:i%2===0?"#fff":"#FAFBFA" }}>
                        <td style={{ padding:"12px 16px", fontFamily:t.family==="Poppins"?P:M, fontSize:t.size.includes("-")?13:parseInt(t.size), fontWeight:parseInt(t.weight), color:"#0d1f10", borderBottom:"1px solid #E5EAE5" }}>{t.name}</td>
                        <td style={{ padding:"12px 16px", fontFamily:P, fontSize:12, color:"#6B7280", borderBottom:"1px solid #E5EAE5" }}>{t.family}</td>
                        <td style={{ padding:"12px 16px", fontFamily:M, fontSize:12, color:"#008000", borderBottom:"1px solid #E5EAE5" }}>{t.weight}</td>
                        <td style={{ padding:"12px 16px", fontFamily:M, fontSize:12, color:"#0d1f10", borderBottom:"1px solid #E5EAE5" }}>{t.size}</td>
                        <td style={{ padding:"12px 16px", fontFamily:M, fontSize:12, color:"#6B7280", borderBottom:"1px solid #E5EAE5" }}>{t.lh}</td>
                        <td style={{ padding:"12px 16px", fontFamily:P, fontSize:12, color:"#6B7280", borderBottom:"1px solid #E5EAE5", lineHeight:1.5 }}>{t.use}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div style={{ marginTop:24, display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>
                <div style={{ background:"#011508", borderRadius:14, padding:24 }}>
                  <div style={{ fontSize:10, color:"rgba(255,255,255,0.35)", fontWeight:700, textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:16 }}>Poppins on Dark</div>
                  <div style={{ fontSize:44, fontWeight:800, color:"#fff", letterSpacing:"-1.5px", marginBottom:8 }}>₦442,250.00</div>
                  <div style={{ fontSize:12, color:"rgba(255,255,255,0.35)", fontFamily:M }}>WLT-LGN-000042 · NGN · Lagos North</div>
                  <div style={{ marginTop:16, display:"flex", gap:16 }}>
                    <div><div style={{ fontSize:10, color:"rgba(255,255,255,0.35)", textTransform:"uppercase", letterSpacing:"0.06em", fontWeight:600, marginBottom:4 }}>Reserved</div><div style={{ fontSize:16, fontWeight:700, color:"#fcd34d" }}>₦45,000.00</div></div>
                    <div><div style={{ fontSize:10, color:"rgba(255,255,255,0.35)", textTransform:"uppercase", letterSpacing:"0.06em", fontWeight:600, marginBottom:4 }}>Today's Spend</div><div style={{ fontSize:16, fontWeight:700, color:"#fff" }}>₦17,500.00</div></div>
                  </div>
                </div>
                <div style={{ background:"#fff", borderRadius:14, border:"1px solid #E5EAE5", padding:24 }}>
                  <div style={{ fontSize:10, color:"#9CA3AF", fontWeight:700, textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:16 }}>Token Display (DM Mono)</div>
                  <div style={{ background:"#e6f4e6", border:"2px solid #008000", borderRadius:12, padding:"16px 18px", textAlign:"center" }}>
                    <div style={{ fontSize:11, fontWeight:800, color:"#014d01", textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:10 }}>🔢 Token Code — Meter Keypad</div>
                    <div style={{ fontSize:26, fontWeight:900, fontFamily:M, letterSpacing:"4px", color:"#011508" }}>3821 5647 9012</div>
                    <div style={{ fontSize:26, fontWeight:900, fontFamily:M, letterSpacing:"4px", color:"#011508", marginTop:4 }}>3847 6521</div>
                  </div>
                  <div style={{ marginTop:16 }}>
                    <div style={{ fontSize:12, color:"#6B7280", marginBottom:6 }}>Reference (DM Mono, 11px)</div>
                    <div style={{ fontFamily:M, fontSize:11, color:"#008000", fontWeight:700 }}>RCP-20250416-000042</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* SPACING + RADIUS */}
          {tab==="Spacing & Radius" && (
            <div className="section">
              <div style={{ marginBottom:24 }}>
                <div style={{ fontSize:22, fontWeight:800, color:"#0d1f10" }}>Spacing & Border Radius</div>
                <div style={{ fontSize:13, color:"#6B7280", marginTop:4 }}>All values in pixels. No spacing tokens (CSS vars) — use inline values directly from this scale.</div>
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:20 }}>
                <div>
                  <div style={{ fontSize:12, fontWeight:700, color:"#6B7280", textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:12 }}>Spacing Scale</div>
                  <div style={{ background:"#fff", borderRadius:14, border:"1px solid #E5EAE5", overflow:"hidden" }}>
                    {SPACING.map((s,i) => (
                      <div key={s.token} className="token-row" style={{ display:"flex", alignItems:"center", gap:14, padding:"10px 16px", borderBottom:i<SPACING.length-1?"1px solid #E5EAE5":"none", background:i%2===0?"#fff":"#FAFBFA" }}>
                        <div style={{ width:60, flexShrink:0 }}>
                          <div style={{ height:12, background:"#e6f4e6", borderRadius:3, width:s.token }} />
                        </div>
                        <div style={{ fontFamily:M, fontSize:12, color:"#008000", fontWeight:700, width:36, flexShrink:0 }}>{s.token}</div>
                        <div style={{ fontSize:12, color:"#6B7280" }}>{s.use}</div>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize:12, fontWeight:700, color:"#6B7280", textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:12 }}>Border Radius Scale</div>
                  <div style={{ background:"#fff", borderRadius:14, border:"1px solid #E5EAE5", overflow:"hidden" }}>
                    {RADII.map((r,i) => (
                      <div key={r.token} className="token-row" style={{ display:"flex", alignItems:"center", gap:14, padding:"10px 16px", borderBottom:i<RADII.length-1?"1px solid #E5EAE5":"none", background:i%2===0?"#fff":"#FAFBFA" }}>
                        <div style={{ width:44, height:30, background:"#e6f4e6", border:"2px solid #b7dfc8", borderRadius:r.token, flexShrink:0 }} />
                        <div style={{ fontFamily:M, fontSize:12, color:"#008000", fontWeight:700, width:36, flexShrink:0 }}>{r.token}</div>
                        <div style={{ fontSize:12, color:"#6B7280", lineHeight:1.5 }}>{r.use}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* SHADOWS */}
          {tab==="Shadows" && (
            <div className="section">
              <div style={{ marginBottom:24 }}>
                <div style={{ fontSize:22, fontWeight:800, color:"#0d1f10" }}>Shadow System</div>
                <div style={{ fontSize:13, color:"#6B7280", marginTop:4 }}>Shadows are always tinted — never pure black. They reinforce spatial hierarchy and semantic role.</div>
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(280px,1fr))", gap:14 }}>
                {SHADOWS.map(s => (
                  <div key={s.name} style={{ background:"#fff", borderRadius:12, padding:18, border:"1px solid #E5EAE5" }}>
                    <div style={{ height:56, borderRadius:8, background:"#fff", boxShadow:s.value, marginBottom:14, display:"flex", alignItems:"center", justifyContent:"center" }}>
                      <span style={{ fontSize:11, color:"#9CA3AF", fontFamily:P }}>shadow preview</span>
                    </div>
                    <div style={{ fontWeight:700, fontSize:13, color:"#0d1f10", marginBottom:4 }}>{s.name}</div>
                    <div style={{ fontFamily:M, fontSize:10, color:"#008000", marginBottom:6, wordBreak:"break-all", lineHeight:1.5 }}>{s.value}</div>
                    <div style={{ fontSize:11, color:"#6B7280" }}>{s.use}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* COMPONENTS */}
          {tab==="Components" && (
            <div className="section">
              <div style={{ marginBottom:24 }}>
                <div style={{ fontSize:22, fontWeight:800, color:"#0d1f10" }}>Component Reference</div>
                <div style={{ fontSize:13, color:"#6B7280", marginTop:4 }}>Every reusable primitive with all variants, sizes, and usage rules.</div>
              </div>
              {COMPONENTS.map(comp => (
                <div key={comp.name} style={{ background:"#fff", borderRadius:14, border:"1px solid #E5EAE5", marginBottom:20, overflow:"hidden" }}>
                  <div style={{ padding:"14px 20px", borderBottom:"1px solid #E5EAE5", background:"#FAFBFA", display:"flex", alignItems:"center", gap:12 }}>
                    <div style={{ fontWeight:800, fontSize:16, color:"#0d1f10" }}>{comp.name}</div>
                    <div style={{ fontFamily:M, fontSize:11, color:"#008000" }}>&lt;{comp.name}/&gt;</div>
                  </div>
                  <div style={{ padding:20 }}>
                    <div style={{ fontSize:13, color:"#6B7280", marginBottom:16 }}>{comp.desc}</div>

                    {/* Badge + InfoBox + Btn visual previews */}
                    {comp.name==="Badge" && (
                      <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom:16 }}>
                        {comp.variants?.map(v => (
                          <span key={v.label} style={{ display:"inline-flex", alignItems:"center", gap:5, padding:"2px 9px", borderRadius:20, fontSize:11, fontWeight:600, background:v.bg, color:v.color, border:`1px solid ${(v as any).border || "#eee"}`, fontFamily:P }}>{v.label}</span>
                        ))}
                      </div>
                    )}
                    {comp.name==="Btn" && (
                      <>
                        <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom:12 }}>
                          {comp.variants?.map(v => (
                            <button key={v.label} style={{ padding:"7px 14px", borderRadius:8, border:v.label==="outline"?"1px solid #D1D8D1":v.label==="ghost"?"1px solid #E5EAE5":v.label==="subtle"?"1px solid #b7dfc8":"none", background:v.bg, color:v.color, fontSize:12, fontWeight:600, cursor:"default", fontFamily:P }}>{v.label}</button>
                          ))}
                        </div>
                        <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom:12 }}>
                          {comp.sizes?.map(sz => (
                            <span key={sz.label} style={{ background:"#e6f4e6", color:"#014d01", padding:"3px 10px", borderRadius:6, fontSize:11, fontWeight:600, fontFamily:P }}>{sz.label} → {sz.use}</span>
                          ))}
                        </div>
                      </>
                    )}
                    {comp.name==="InfoBox" && (
                      <div style={{ display:"flex", flexDirection:"column", gap:8, marginBottom:16 }}>
                        {comp.variants?.map(v => (
                          <div key={v.label} style={{ background:v.bg, border:`1px solid ${(v as any).border || "#eee"}`, borderRadius:10, padding:"9px 14px", display:"flex", gap:10, alignItems:"center" }}>
                            <span style={{ fontSize:11, fontWeight:700, color:v.color, fontFamily:P, textTransform:"uppercase", letterSpacing:"0.06em" }}>{v.label}</span>
                            <span style={{ fontSize:12, color:v.color, fontFamily:P }}>— {v.text}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Rules */}
                    {comp.rules && (
                      <div style={{ background:"#F2F4F2", borderRadius:10, padding:14 }}>
                        <div style={{ fontSize:10, fontWeight:700, color:"#6B7280", textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:10 }}>Rules</div>
                        {comp.rules.map((r,i) => (
                          <div key={i} style={{ display:"flex", gap:8, marginBottom:6, fontSize:12, color:"#374151", fontFamily:P }}>
                            <span style={{ color:"#008000", fontWeight:700, flexShrink:0 }}>→</span>{r}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* LAYOUT */}
          {tab==="Layout" && (
            <div className="section">
              <div style={{ marginBottom:24 }}>
                <div style={{ fontSize:22, fontWeight:800, color:"#0d1f10" }}>Layout System</div>
                <div style={{ fontSize:13, color:"#6B7280", marginTop:4 }}>All layout is CSS Grid and Flexbox only — no external layout libraries.</div>
              </div>
              {LAYOUT.map(l => (
                <div key={l.name} style={{ background:"#fff", borderRadius:14, border:"1px solid #E5EAE5", marginBottom:16, overflow:"hidden" }}>
                  <div style={{ padding:"14px 20px", borderBottom:"1px solid #E5EAE5", background:"#FAFBFA" }}>
                    <div style={{ fontWeight:800, fontSize:15, color:"#0d1f10" }}>{l.name}</div>
                    <div style={{ fontSize:12, color:"#6B7280", marginTop:2 }}>{l.desc}</div>
                  </div>
                  <div style={{ padding:20 }}>
                    <pre style={{ fontFamily:M, fontSize:12, color:"#0d1f10", background:"#F2F4F2", borderRadius:10, padding:16, overflowX:"auto", lineHeight:1.8, whiteSpace:"pre-wrap" }}>{l.spec.trim()}</pre>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ANIMATION */}
          {tab==="Animation" && (
            <div className="section">
              <div style={{ marginBottom:24 }}>
                <div style={{ fontSize:22, fontWeight:800, color:"#0d1f10" }}>Animation System</div>
                <div style={{ fontSize:13, color:"#6B7280", marginTop:4 }}>All animations are CSS <Tag mono>@keyframes</Tag>. Applied via class names or inline <Tag mono>animation</Tag> properties. No JS animation libraries.</div>
              </div>
              <div style={{ background:"#fff", borderRadius:14, border:"1px solid #E5EAE5", overflow:"hidden" }}>
                <table style={{ width:"100%", borderCollapse:"collapse" }}>
                  <thead>
                    <tr style={{ background:"#FAFBFA" }}>
                      {["Name","Keyframes","Duration","Usage"].map(h => (
                        <th key={h} style={{ padding:"10px 16px", textAlign:"left", fontSize:10, fontWeight:700, color:"#6B7280", borderBottom:"1px solid #E5EAE5", textTransform:"uppercase", letterSpacing:"0.07em", fontFamily:P, whiteSpace:"nowrap" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {ANIMATIONS.map((a,i) => (
                      <tr key={a.name} className="token-row" style={{ background:i%2===0?"#fff":"#FAFBFA" }}>
                        <td style={{ padding:"12px 16px", borderBottom:"1px solid #E5EAE5" }}><Tag mono>{a.name}</Tag></td>
                        <td style={{ padding:"12px 16px", fontFamily:M, fontSize:11, color:"#374151", borderBottom:"1px solid #E5EAE5" }}>{a.keyframes}</td>
                        <td style={{ padding:"12px 16px", fontFamily:M, fontSize:11, color:"#008000", borderBottom:"1px solid #E5EAE5", whiteSpace:"nowrap" }}>{a.duration}</td>
                        <td style={{ padding:"12px 16px", fontFamily:P, fontSize:12, color:"#6B7280", borderBottom:"1px solid #E5EAE5" }}>{a.use}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{ marginTop:20, background:"#fff", borderRadius:14, border:"1px solid #E5EAE5", padding:20 }}>
                <div style={{ fontSize:12, fontWeight:700, color:"#6B7280", textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:14 }}>Performance Rules</div>
                {["Animate only transform, opacity, box-shadow — never width, height, top, left (causes layout thrash)","All transitions use transition: all 0.15s — override per component where needed","Infinite animations (pulse, spin, float, glowGreen) only on intentionally live/loading elements","Never animate decorative elements — motion must communicate state change","Loading spinners: border trick only — 16×16px, 2px border, spin 0.7s linear infinite"].map((r,i) => (
                  <div key={i} style={{ display:"flex", gap:8, marginBottom:8, fontSize:12, color:"#374151", fontFamily:P }}>
                    <span style={{ color:"#008000", fontWeight:700, flexShrink:0 }}>→</span>{r}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* CONVENTIONS */}
          {tab==="Conventions" && (
            <div className="section">
              <div style={{ marginBottom:24 }}>
                <div style={{ fontSize:22, fontWeight:800, color:"#0d1f10" }}>Naming Conventions</div>
                <div style={{ fontSize:13, color:"#6B7280", marginTop:4 }}>Consistent naming across all files, components, props, state, and data.</div>
              </div>
              {NAMING.map(n => (
                <div key={n.category} style={{ background:"#fff", borderRadius:14, border:"1px solid #E5EAE5", marginBottom:14, overflow:"hidden" }}>
                  <div style={{ padding:"12px 20px", borderBottom:"1px solid #E5EAE5", background:"#FAFBFA", fontWeight:700, fontSize:14, color:"#0d1f10" }}>{n.category}</div>
                  <div style={{ padding:"14px 20px" }}>
                    {n.rules.map((r,i) => {
                      const [label, ...rest] = r.split("→");
                      return (
                        <div key={i} style={{ display:"flex", gap:10, marginBottom:8, alignItems:"flex-start", fontSize:13 }}>
                          <span style={{ color:"#008000", fontWeight:700, flexShrink:0 }}>→</span>
                          <span style={{ color:"#374151", fontFamily:P }}>{label.trim()}</span>
                          {rest.length>0 && <span style={{ fontFamily:M, fontSize:11, color:"#008000", background:"#e6f4e6", padding:"1px 7px", borderRadius:5, flexShrink:0 }}>{rest.join("→").trim()}</span>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}

              <div style={{ background:"#fff", borderRadius:14, border:"1px solid #E5EAE5", overflow:"hidden" }}>
                <div style={{ padding:"12px 20px", borderBottom:"1px solid #E5EAE5", background:"#FAFBFA", fontWeight:700, fontSize:14, color:"#0d1f10" }}>Screen Key Map</div>
                <div style={{ padding:20, display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
                  {[["v-dashboard","Vendor Dashboard"],["v-buy","Buy Units (token/remote-send flow)"],["v-topup","Fund Wallet (no token)"],["v-transactions","Transaction history"],["v-receipts","Vending receipts only"],["v-statement","Wallet statement"],["v-profile","Vendor profile / KYC"],["a-dashboard","Admin Finance Dashboard"],["a-vendors","Vendor management"],["a-wallets","All wallets + manual credit"],["a-funding","Funding queue + maker-checker"],["a-purchases","Purchase monitor"],["a-exceptions","Exception board"],["a-settlement","Settlement batches"],["a-audit","Audit log"]].map(([k,v]) => (
                    <div key={k} style={{ display:"flex", gap:10, alignItems:"center" }}>
                      <Tag mono>{k}</Tag>
                      <span style={{ fontSize:12, color:"#6B7280", fontFamily:P }}>{v}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* RULES */}
          {tab==="Rules" && (
            <div className="section">
              <div style={{ marginBottom:24 }}>
                <div style={{ fontSize:22, fontWeight:800, color:"#0d1f10" }}>Do / Don't Rules</div>
                <div style={{ fontSize:13, color:"#6B7280", marginTop:4 }}>Non-negotiable design and implementation rules. These resolve ambiguity before it becomes a bug or inconsistency.</div>
              </div>
              <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                {RULES.map((r,i) => (
                  <div key={i} style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:0, borderRadius:12, overflow:"hidden", border:"1px solid #E5EAE5" }}>
                    <div style={{ padding:"14px 18px", background:"#e6f4e6", borderRight:"1px solid #b7dfc8", display:"flex", gap:10, alignItems:"flex-start" }}>
                      <span style={{ fontWeight:800, fontSize:14, color:"#008000", flexShrink:0 }}>✓</span>
                      <div style={{ fontSize:13, color:"#014d01", lineHeight:1.6, fontFamily:P }}>{r.do}</div>
                    </div>
                    <div style={{ padding:"14px 18px", background:"#FEF2F2", display:"flex", gap:10, alignItems:"flex-start" }}>
                      <span style={{ fontWeight:800, fontSize:14, color:"#DC2626", flexShrink:0 }}>✗</span>
                      <div style={{ fontSize:13, color:"#991B1B", lineHeight:1.6, fontFamily:P }}>{r.dont}</div>
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ marginTop:24, background:"#fff", borderRadius:14, border:"1px solid #E5EAE5", padding:20 }}>
                <div style={{ fontSize:12, fontWeight:700, color:"#6B7280", textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:14 }}>Business Logic Rules (Design-enforced)</div>
                {[
                  "Funding screen (VTopup) must always show the lemon InfoBox: 'Funding ≠ Token'",
                  "Token display only appears in the Buy Units step-4 receipt — never on funding screens",
                  "Remote-send receipt must show TXN reference, NOT a 20-digit code",
                  "Manual credit modals must identify maker vs checker role explicitly in the UI",
                  "Audit log must highlight manual_credit events in T.lemonDark to distinguish from normal events",
                  "Active nav item must always show lemon (#C6E000) left border — not just a background change",
                  "Lemon color (#C6E000) must always be paired with T.lemonText (#2B3300) — never with white",
                ].map((r,i) => (
                  <div key={i} style={{ display:"flex", gap:8, marginBottom:8, fontSize:12, color:"#374151", fontFamily:P }}>
                    <span style={{ color:"#C6E000", fontWeight:800, flexShrink:0, background:"#011508", width:20, height:20, borderRadius:4, display:"flex", alignItems:"center", justifyContent:"center", fontSize:10 }}>!</span>
                    {r}
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      </div>
    </>
  );
}
