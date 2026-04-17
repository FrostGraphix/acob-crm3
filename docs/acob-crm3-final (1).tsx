import { useState, useRef } from "react";
import {
  LayoutDashboard, Zap, ArrowUpCircle, FileText, Users,
  AlertTriangle, BarChart2, Shield, BookOpen, LogOut,
  Check, X, Printer, Download, Eye, EyeOff, RefreshCw,
  Bell, Clock, AlertCircle, TrendingUp,
  Lock, Unlock, Plus, Wallet, Receipt, Activity,
  UserCheck, Package, Copy, Upload, FileCheck,
  XCircle, CheckCircle2, ArrowRight, ShieldCheck,
  Fingerprint, ChevronLeft, Info, Flag, User,
  PenLine, BadgeCheck, CreditCard, CheckSquare,
} from "lucide-react";

/* ─── FONTS ────────────────────────────────────────────────────────────────── */
const FontImport = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Poppins:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;1,400&family=DM+Mono:wght@400;500&display=swap');
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html, body, #root { height: 100%; }
    ::-webkit-scrollbar { width: 5px; height: 5px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb { background: #c8d5c8; border-radius: 4px; }
    @keyframes fadeUp { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
    @keyframes fadeIn { from { opacity:0; } to { opacity:1; } }
    @keyframes slideRight { from { opacity:0; transform:translateX(-12px); } to { opacity:1; transform:translateX(0); } }
    @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
    @keyframes spin { to { transform:rotate(360deg); } }
    @keyframes glowGreen { 0%,100%{box-shadow:0 0 0 0 rgba(0,128,0,0.3)} 50%{box-shadow:0 0 0 8px rgba(0,128,0,0)} }
    @keyframes glowLemon { 0%,100%{box-shadow:0 0 0 0 rgba(198,224,0,0.3)} 50%{box-shadow:0 0 0 8px rgba(198,224,0,0)} }
    @keyframes float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-5px)} }
    .fadeUp   { animation: fadeUp 0.35s ease both; }
    .fadeIn   { animation: fadeIn 0.25s ease both; }
    .slideRight { animation: slideRight 0.3s ease both; }
    .row-hover:hover { background: #f6faf6 !important; }
    .nav-item:hover  { background: rgba(255,255,255,0.07) !important; color:#fff !important; }
    .card-lift { transition: all 0.2s; }
    .card-lift:hover { transform:translateY(-2px); box-shadow:0 8px 28px rgba(2,85,34,0.1) !important; }
    .btn-press:active { transform:scale(0.97); }
    input:focus, select:focus, textarea:focus {
      outline:none; border-color:#008000 !important;
      box-shadow:0 0 0 3px rgba(0,128,0,0.1);
    }
  `}</style>
);

/* ─── TOKENS ───────────────────────────────────────────────────────────────── */
const T = {
  sidebar:      "#021f0d",
  sidebarBg:    "#011508",
  primary:      "#008000",
  primaryDark:  "#006600",
  primaryLight: "#e6f4e6",
  primaryGlow:  "rgba(0,128,0,0.15)",
  lemon:        "#C6E000",
  lemonDark:    "#A5BB00",
  lemonLight:   "#F4FAC2",
  lemonText:    "#2B3300",
  lemonGlow:    "rgba(198,224,0,0.18)",
  bg:           "#F2F4F2",
  surface:      "#FFFFFF",
  surface2:     "#FAFBFA",
  text:         "#0d1f10",
  textMid:      "#374151",
  muted:        "#6B7280",
  faint:        "#9CA3AF",
  border:       "#E5EAE5",
  border2:      "#D1D8D1",
  success:      "#008000",
  successBg:    "#e6f4e6",
  successText:  "#014d01",
  danger:       "#DC2626",
  dangerBg:     "#FEF2F2",
  dangerText:   "#991B1B",
  warning:      "#D97706",
  warningBg:    "#FFFBEB",
  warningText:  "#92400E",
  info:         "#2563EB",
  infoBg:       "#EFF6FF",
  infoText:     "#1E40AF",
  purpleBg:     "#F5F3FF",
  purpleText:   "#5B21B6",
};
const P = "'Poppins',sans-serif";
const M = "'DM Mono',monospace";

/* ─── FORMAT ───────────────────────────────────────────────────────────────── */
const NGN = n => `₦${Number(n).toLocaleString("en-NG",{minimumFractionDigits:2,maximumFractionDigits:2})}`;

/* ─── MOCK DATA ─────────────────────────────────────────────────────────────── */
const VENDOR_ME = { name:"Bright Future Electrical", code:"VND-001", site:"Lagos North", walletNo:"WLT-LGN-000042" };
const WALLET    = { float:487250, reserved:45000, dailyLimit:500000, dailyUsed:17500, perTxn:100000 };
const AVAIL     = WALLET.float - WALLET.reserved;

const TXNS = [
  { id:"PO-00291", ref:"RCP-20250416-000042", date:"16 Apr 2025, 09:42", desc:"Token gen — MTR-00291 · Adebayo Okafor",  method:"token",       amount:-5000,  status:"successful", receipt:"RCP-20250416-000042" },
  { id:"PO-00290", ref:"RCP-20250416-000041", date:"16 Apr 2025, 08:15", desc:"Remote send — MTR-00418 · Grace Eze",    method:"remote_send", amount:-3000,  status:"successful", receipt:"RCP-20250416-000041" },
  { id:"FND-00023",ref:"FND-20250415-000009", date:"15 Apr 2025, 16:48", desc:"Wallet funding — bank transfer credited", method:null,          amount:200000, status:"posted",     receipt:null },
  { id:"PO-00289", ref:"RCP-20250415-000040", date:"15 Apr 2025, 14:30", desc:"Token gen — MTR-00192 · Fatima Bello",   method:"token",       amount:-8000,  status:"successful", receipt:"RCP-20250415-000040" },
  { id:"PO-00288", ref:"RCP-20250415-000039", date:"15 Apr 2025, 11:20", desc:"Remote send — MTR-00291 · Adebayo",      method:"remote_send", amount:-2500,  status:"failed",     receipt:null },
  { id:"REV-00001",ref:"REV-20250414-000002", date:"14 Apr 2025, 17:00", desc:"Reversal — PO-00285",                    method:null,          amount:2500,   status:"reversed",   receipt:null },
];

const VENDORS_DATA = [
  { id:1, name:"Bright Future Electrical", code:"VND-001", site:"Lagos North",   contact:"08012345678", status:"active",         kyc:"approved",  balance:487250, reserved:45000,  risk:"low",    txns:152, joined:"2 Mar 2025" },
  { id:2, name:"Energize Nigeria Ltd",     code:"VND-002", site:"Abuja Central", contact:"08023456789", status:"active",         kyc:"approved",  balance:654000, reserved:120000, risk:"low",    txns:238, joined:"15 Jan 2025" },
  { id:3, name:"Sunco Vending Services",   code:"VND-003", site:"Lagos North",   contact:"08034567890", status:"active",         kyc:"approved",  balance:92400,  reserved:0,      risk:"medium", txns:89,  joined:"10 Feb 2025" },
  { id:4, name:"PowerPlus Distributors",   code:"VND-004", site:"Kano Central",  contact:"08045678901", status:"pending_review", kyc:"submitted", balance:0,      reserved:0,      risk:"low",    txns:0,   joined:"16 Apr 2025" },
  { id:5, name:"Apex Energy Partners",     code:"VND-005", site:"Port Harcourt", contact:"08056789012", status:"suspended",      kyc:"approved",  balance:34100,  reserved:0,      risk:"high",   txns:44,  joined:"5 Dec 2024" },
];

const FUNDING_QUEUE = [
  { ref:"FND-20250416-000012", vendor:"Bright Future Electrical", amt:200000, channel:"Bank transfer", bankRef:"FBN/2504160012", submitted:"16 Apr, 09:15", status:"under_review" },
  { ref:"FND-20250416-000011", vendor:"Energize Nigeria Ltd",     amt:500000, channel:"Bank transfer", bankRef:"GTB/2504160011", submitted:"16 Apr, 08:42", status:"under_review" },
  { ref:"FND-20250416-000010", vendor:"Sunco Vending Services",   amt:50000,  channel:"Cash branch",   bankRef:"—",             submitted:"16 Apr, 07:30", status:"awaiting_proof" },
  { ref:"FND-20250415-000009", vendor:"Bright Future Electrical", amt:150000, channel:"Bank transfer", bankRef:"FBN/2504150009", submitted:"15 Apr, 16:00", status:"posted" },
];

const MANUAL_CREDIT_REQUESTS = [
  { id:"MCR-001", vendor:"Bright Future Electrical", code:"VND-001", amount:50000, reason:"Balance correction after upstream mismatch on PO-00285. Reversal journal confirmed by ops.", requestedBy:"ops-admin", requestedAt:"16 Apr, 08:30", status:"pending_checker" },
  { id:"MCR-002", vendor:"Sunco Vending Services",   code:"VND-003", amount:2500,  reason:"Reversal credit for failed remote-send REV-00001. Upstream confirmed no debit.",              requestedBy:"finance-admin", requestedAt:"15 Apr, 17:15", status:"approved", checkerApproval:"admin-checker", approvedAt:"15 Apr, 17:45" },
];

const EXCEPTIONS = [
  { id:"EXC-001", sev:"critical", type:"purchase_stuck_reserved",       vendor:"Bright Future Electrical",site:"Lagos North",  ref:"PO-00291",           desc:"Purchase stuck in reserved state for 22 min. Upstream status unknown.", created:"16 Apr, 09:37", sla:"09:52", status:"open",     assignedTo:null },
  { id:"EXC-002", sev:"high",     type:"local_success_upstream_missing", vendor:"Sunco Vending Services",  site:"Lagos North",  ref:"PO-00287",           desc:"Purchase marked successful but no upstream_transaction_id populated.",  created:"16 Apr, 07:14", sla:"08:14", status:"assigned", assignedTo:"Chioma A." },
  { id:"EXC-003", sev:"medium",   type:"commission_mismatch",           vendor:"All vendors",             site:"Lagos North",  ref:"BATCH-20250415-001", desc:"Commission accrual sum mismatches purchase total for 15 Apr.",         created:"15 Apr, 23:35", sla:"16 Apr 23:59", status:"open", assignedTo:null },
];

const PURCHASES_ALL = [
  { id:"PO-00291", date:"16 Apr, 09:42", vendor:"Bright Future", meter:"MTR-00291", method:"token",       amount:5000,  status:"successful", receipt:"RCP-20250416-000042" },
  { id:"PO-00290", date:"16 Apr, 08:15", vendor:"Bright Future", meter:"MTR-00418", method:"remote_send", amount:3000,  status:"successful", receipt:"RCP-20250416-000041" },
  { id:"PO-00289", date:"15 Apr, 14:30", vendor:"Bright Future", meter:"MTR-00192", method:"token",       amount:8000,  status:"successful", receipt:"RCP-20250415-000040" },
  { id:"PO-00288", date:"15 Apr, 11:20", vendor:"Sunco Vending", meter:"MTR-00105", method:"remote_send", amount:2500,  status:"failed",     receipt:null },
  { id:"PO-00287", date:"15 Apr, 09:00", vendor:"Sunco Vending", meter:"MTR-00301", method:"token",       amount:12000, status:"successful", receipt:"RCP-20250415-000039" },
];

const SETTLEMENT_BATCHES = [
  { date:"15 Apr 2025", site:"Lagos North",   purchases:1240000, commission:0, txns:42 },
  { date:"15 Apr 2025", site:"Abuja Central", purchases:890000,  commission:0, txns:31 },
  { date:"14 Apr 2025", site:"Lagos North",   purchases:980000,  commission:0, txns:38 },
  { date:"14 Apr 2025", site:"Kano Central",  purchases:420000,  commission:0, txns:17 },
];

const AUDIT_EVENTS = [
  { time:"10:14:22", actor:"admin",          role:"admin",       event:"manual_credit_approved",  target:"MCR-001",            ip:"197.211.58.14" },
  { time:"09:58:01", actor:"recon-engine",   role:"system",      event:"exception_created",       target:"EXC-001",            ip:"internal" },
  { time:"09:42:15", actor:"brightfuture01", role:"vendor_user", event:"purchase_successful",     target:"PO-00291",           ip:"41.203.68.22" },
  { time:"09:15:44", actor:"brightfuture01", role:"vendor_user", event:"funding_initiated",       target:"FND-20250416-000012",ip:"41.203.68.22" },
  { time:"08:30:00", actor:"ops-admin",      role:"admin",       event:"manual_credit_requested", target:"MCR-001",            ip:"197.211.58.14" },
  { time:"07:55:12", actor:"recon-engine",   role:"system",      event:"reconciliation_run_eod",  target:"BATCH-20250415-001", ip:"internal" },
];

const NOTIFICATIONS = [
  { type:"critical", Icon:AlertTriangle, color:T.danger,  bg:T.dangerBg,    title:"Critical exception: EXC-001",   sub:"Purchase stuck in reserved state — SLA breached 7 min ago", time:"10:21" },
  { type:"warning",  Icon:CreditCard,    color:T.lemon,   bg:T.lemonLight,  title:"Manual credit pending checker", sub:"MCR-001 · Bright Future · ₦50,000 — requires 2nd approval", time:"08:30" },
  { type:"info",     Icon:ArrowUpCircle, color:T.primary, bg:T.primaryLight,title:"Funding approval required",     sub:"FND-20250416-000012 · Bright Future · ₦200,000",            time:"09:15" },
];

/* ─── PRIMITIVES ────────────────────────────────────────────────────────────── */
function Badge({ variant="gray", size="sm", dot, children }) {
  const map = {
    success:{ bg:T.successBg,  color:T.successText, border:"#b7dfc8" },
    danger: { bg:T.dangerBg,   color:T.dangerText,  border:"#fecaca" },
    warning:{ bg:T.warningBg,  color:T.warningText, border:"#fcd34d" },
    info:   { bg:T.infoBg,     color:T.infoText,    border:"#bfdbfe" },
    lemon:  { bg:T.lemonLight, color:T.lemonText,   border:"#d6ee66" },
    gray:   { bg:"#F9FAFB",    color:T.muted,       border:T.border  },
    green:  { bg:T.successBg,  color:T.successText, border:"#b7dfc8" },
    purple: { bg:T.purpleBg,   color:T.purpleText,  border:"#DDD6FE" },
  };
  const s = map[variant]||map.gray;
  return (
    <span style={{ display:"inline-flex", alignItems:"center", gap:5, padding:size==="lg"?"5px 13px":"2px 9px", borderRadius:20, fontSize:size==="lg"?12:11, fontWeight:600, background:s.bg, color:s.color, border:`1px solid ${s.border}`, whiteSpace:"nowrap", fontFamily:P }}>
      {dot && <span style={{ width:5, height:5, borderRadius:"50%", background:s.color, flexShrink:0 }}/>}
      {children}
    </span>
  );
}

function Btn({ variant="primary", size="md", onClick, disabled, children, full, style:extra={} }) {
  const base = { display:"inline-flex", alignItems:"center", gap:6, borderRadius:8, fontWeight:600, cursor:disabled?"not-allowed":"pointer", border:"none", fontFamily:P, fontSize:size==="sm"?12:size==="xs"?11:13, padding:size==="sm"?"6px 14px":size==="xs"?"3px 9px":"9px 18px", opacity:disabled?0.5:1, width:full?"100%":"auto", justifyContent:full?"center":"flex-start", transition:"all 0.15s" };
  const vars = {
    primary: { background:T.primary,  color:"#fff", boxShadow:"0 1px 6px rgba(0,128,0,0.3)" },
    lemon:   { background:T.lemon,    color:T.lemonText, boxShadow:"0 1px 6px rgba(198,224,0,0.4)" },
    danger:  { background:T.danger,   color:"#fff", boxShadow:"0 1px 4px rgba(220,38,38,0.25)" },
    outline: { background:"transparent", color:T.textMid, border:`1px solid ${T.border2}` },
    ghost:   { background:"transparent", color:T.muted, border:`1px solid ${T.border}` },
    subtle:  { background:T.primaryLight, color:T.primary, border:`1px solid #b7dfc8` },
    dark:    { background:T.sidebar,  color:"#fff" },
  };
  return <button className="btn-press" style={{ ...base, ...(vars[variant]||vars.primary), ...extra }} onClick={onClick} disabled={disabled}>{children}</button>;
}

function KPI({ label, value, sub, valueColor, icon:Icon, accent }) {
  return (
    <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:12, padding:"16px 18px", transition:"all 0.2s" }} className="card-lift">
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:10 }}>
        <div style={{ fontSize:10, fontWeight:700, color:T.muted, textTransform:"uppercase", letterSpacing:"0.07em", fontFamily:P }}>{label}</div>
        {Icon && <div style={{ width:30, height:30, background:accent||T.bg, borderRadius:8, display:"flex", alignItems:"center", justifyContent:"center" }}><Icon size={14} color={valueColor||T.muted}/></div>}
      </div>
      <div style={{ color:valueColor||T.text, fontSize:23, fontWeight:700, lineHeight:1, fontFamily:P, letterSpacing:"-0.5px" }}>{value}</div>
      {sub && <div style={{ color:T.faint, fontSize:11, marginTop:6, fontFamily:P }}>{sub}</div>}
    </div>
  );
}

function InfoBox({ type="info", children }) {
  const s = { info:{bg:T.infoBg,border:"#bfdbfe",color:T.infoText,Icon:Info}, warning:{bg:T.warningBg,border:"#fcd34d",color:T.warningText,Icon:AlertTriangle}, success:{bg:T.successBg,border:"#b7dfc8",color:T.successText,Icon:Check}, danger:{bg:T.dangerBg,border:"#fecaca",color:T.dangerText,Icon:XCircle}, lemon:{bg:T.lemonLight,border:"#d6ee66",color:T.lemonText,Icon:Info} }[type]||{bg:T.infoBg,border:"#bfdbfe",color:T.infoText,Icon:Info};
  return (
    <div style={{ background:s.bg, border:`1px solid ${s.border}`, borderRadius:10, padding:"10px 14px", display:"flex", gap:10, alignItems:"flex-start" }}>
      <s.Icon size={14} color={s.color} style={{ flexShrink:0, marginTop:1 }}/>
      <div style={{ color:s.color, fontSize:12, lineHeight:1.65, fontFamily:P }}>{children}</div>
    </div>
  );
}

function FI({ label, hint, prefix, ...props }) {
  return (
    <div style={{ marginBottom:14 }}>
      {label && <label style={{ display:"block", fontSize:12, fontWeight:600, color:T.muted, marginBottom:5, fontFamily:P }}>{label}</label>}
      <div style={{ position:"relative" }}>
        {prefix && <span style={{ position:"absolute", left:12, top:"50%", transform:"translateY(-50%)", color:T.muted, fontSize:13, fontWeight:700, pointerEvents:"none" }}>{prefix}</span>}
        <input {...props} style={{ width:"100%", padding:prefix?"9px 12px 9px 28px":"9px 13px", borderRadius:8, border:`1px solid ${T.border2}`, background:T.surface, color:T.text, fontSize:13, fontFamily:P, ...(props.style||{}) }}/>
      </div>
      {hint && <div style={{ color:T.faint, fontSize:11, marginTop:4, fontFamily:P }}>{hint}</div>}
    </div>
  );
}
function FS({ label, children, ...props }) {
  return (
    <div style={{ marginBottom:14 }}>
      {label && <label style={{ display:"block", fontSize:12, fontWeight:600, color:T.muted, marginBottom:5, fontFamily:P }}>{label}</label>}
      <select {...props} style={{ width:"100%", padding:"9px 13px", borderRadius:8, border:`1px solid ${T.border2}`, background:T.surface, color:T.text, fontSize:13, fontFamily:P }}>{children}</select>
    </div>
  );
}
function FT({ label, ...props }) {
  return (
    <div style={{ marginBottom:14 }}>
      {label && <label style={{ display:"block", fontSize:12, fontWeight:600, color:T.muted, marginBottom:5, fontFamily:P }}>{label}</label>}
      <textarea {...props} style={{ width:"100%", padding:"9px 13px", borderRadius:8, border:`1px solid ${T.border2}`, background:T.surface, color:T.text, fontSize:13, resize:"none", fontFamily:P, ...(props.style||{}) }}/>
    </div>
  );
}

function Th({ children, center }) {
  return <th style={{ padding:"10px 16px", textAlign:center?"center":"left", fontSize:10, fontWeight:700, color:T.muted, borderBottom:`1px solid ${T.border}`, whiteSpace:"nowrap", background:T.surface2, textTransform:"uppercase", letterSpacing:"0.07em", fontFamily:P }}>{children}</th>;
}
function Td({ children, mono, muted, bold, danger, success, warning, center }) {
  return <td style={{ padding:"12px 16px", borderBottom:`1px solid ${T.border}`, fontSize:13, fontFamily:mono?M:P, color:danger?T.danger:success?T.success:warning?T.warning:muted?T.muted:T.text, fontWeight:bold?600:400, textAlign:center?"center":"left" }}>{children}</td>;
}

function Divider({ label }) {
  return (
    <div style={{ display:"flex", alignItems:"center", gap:10, margin:"18px 0" }}>
      <div style={{ flex:1, height:1, background:T.border }}/>
      {label && <span style={{ fontSize:10, color:T.faint, fontFamily:P, fontWeight:600, letterSpacing:"0.07em", textTransform:"uppercase" }}>{label}</span>}
      <div style={{ flex:1, height:1, background:T.border }}/>
    </div>
  );
}

/* ─── MODAL ─────────────────────────────────────────────────────────────────── */
function Modal({ title, subtitle, onClose, children, footer, wide, xwide }) {
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(1,21,8,0.55)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:2000, padding:20, backdropFilter:"blur(4px)" }} className="fadeIn">
      <div style={{ background:T.surface, borderRadius:18, border:`1px solid ${T.border}`, width:"100%", maxWidth:xwide?800:wide?600:480, maxHeight:"92vh", display:"flex", flexDirection:"column", boxShadow:"0 28px 80px rgba(1,21,8,0.25)" }} className="fadeUp">
        <div style={{ padding:"18px 22px", borderBottom:`1px solid ${T.border}`, display:"flex", alignItems:"center", justifyContent:"space-between", flexShrink:0 }}>
          <div>
            <div style={{ fontSize:16, fontWeight:700, color:T.text, fontFamily:P }}>{title}</div>
            {subtitle && <div style={{ fontSize:12, color:T.muted, marginTop:2, fontFamily:P }}>{subtitle}</div>}
          </div>
          <button onClick={onClose} style={{ width:30, height:30, borderRadius:8, display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", background:T.bg, border:`1px solid ${T.border}`, color:T.muted }}>
            <X size={15}/>
          </button>
        </div>
        <div style={{ padding:22, overflowY:"auto", flex:1 }}>{children}</div>
        {footer && <div style={{ padding:"14px 22px", borderTop:`1px solid ${T.border}`, display:"flex", gap:8, justifyContent:"flex-end", alignItems:"center", flexShrink:0, background:T.surface2, borderRadius:"0 0 18px 18px" }}>{footer}</div>}
      </div>
    </div>
  );
}

/* ─── VENDOR LOGIN ──────────────────────────────────────────────────────────── */
function VendorLogin({ onLogin }) {
  const [user, setUser] = useState("brightfuture01");
  const [pass, setPass] = useState("Password1!");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err,  setErr]  = useState("");
  const [tab,  setTab]  = useState("login");
  const bars = [40,65,55,80,45,90,70,85,60,75,50,88,72,95];
  const submit = () => { if(!user||!pass){setErr("Please enter your credentials.");return;} setBusy(true); setErr(""); setTimeout(()=>{setBusy(false);onLogin("vendor");},1200); };
  return (
    <div style={{ minHeight:"100vh", background:T.sidebarBg, display:"flex", alignItems:"center", justifyContent:"center", fontFamily:P, padding:20, position:"relative", overflow:"hidden" }}>
      <div style={{ position:"absolute", inset:0, pointerEvents:"none" }}>
        <div style={{ position:"absolute", top:-200, right:-200, width:600, height:600, borderRadius:"50%", background:"radial-gradient(circle, rgba(0,128,0,0.07) 0%, transparent 70%)" }}/>
        <div style={{ position:"absolute", bottom:-150, left:-150, width:500, height:500, borderRadius:"50%", background:"radial-gradient(circle, rgba(198,224,0,0.05) 0%, transparent 70%)" }}/>
        <svg style={{ position:"absolute", inset:0, width:"100%", height:"100%", opacity:0.03 }}><defs><pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M 40 0 L 0 0 0 40" fill="none" stroke="#4ade80" strokeWidth="0.5"/></pattern></defs><rect width="100%" height="100%" fill="url(#grid)"/></svg>
      </div>
      <div style={{ display:"flex", width:"100%", maxWidth:960, borderRadius:22, overflow:"hidden", boxShadow:"0 32px 120px rgba(0,0,0,0.5)", position:"relative" }} className="fadeUp">
        {/* Left */}
        <div style={{ flex:"0 0 340px", background:`linear-gradient(160deg, #021f0d 0%, #013b18 100%)`, padding:"44px 36px", display:"flex", flexDirection:"column", justifyContent:"space-between", position:"relative", overflow:"hidden" }}>
          <div style={{ position:"absolute", right:-60, top:-60, width:280, height:280, borderRadius:"50%", background:"rgba(198,224,0,0.04)", pointerEvents:"none" }}/>
          <div>
            <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:44 }}>
              <div style={{ width:44, height:44, background:T.lemon, borderRadius:11, display:"flex", alignItems:"center", justifyContent:"center", fontFamily:P, fontWeight:800, fontSize:20, color:T.lemonText }}>A</div>
              <div>
                <div style={{ fontFamily:P, fontWeight:800, fontSize:15, color:"#fff" }}>ACOB CRM3</div>
                <div style={{ fontSize:11, color:"rgba(255,255,255,0.4)", marginTop:1 }}>Vending Platform</div>
              </div>
            </div>
            <div style={{ fontFamily:P, fontWeight:800, fontSize:28, color:"#fff", lineHeight:1.2, marginBottom:14 }}>Vendor<br/>Portal</div>
            <div style={{ fontSize:13, color:"rgba(255,255,255,0.5)", lineHeight:1.75, marginBottom:30 }}>Access your wallet, vend electricity units, view transactions, and manage your account.</div>
            <div style={{ background:"rgba(255,255,255,0.04)", borderRadius:12, padding:"14px 16px", border:"1px solid rgba(255,255,255,0.06)", marginBottom:24 }}>
              <div style={{ fontSize:10, color:"rgba(255,255,255,0.35)", textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:10, fontWeight:600 }}>Today's purchase volume</div>
              <div style={{ display:"flex", alignItems:"flex-end", gap:3, height:44 }}>
                {bars.map((h,i) => <div key={i} style={{ flex:1, borderRadius:"2px 2px 0 0", height:`${h}%`, background:i===bars.length-1?T.lemon:"rgba(255,255,255,0.14)", opacity:i===bars.length-1?1:0.7 }}/>)}
              </div>
            </div>
            {[{Icon:Zap,label:"Buy electricity units instantly"},{Icon:Wallet,label:"Manage your prepaid wallet"},{Icon:ShieldCheck,label:"Secure, audited transactions"}].map(({Icon,label}) => (
              <div key={label} style={{ display:"flex", alignItems:"center", gap:10, marginBottom:12 }}>
                <div style={{ width:26, height:26, borderRadius:6, background:"rgba(255,255,255,0.07)", display:"flex", alignItems:"center", justifyContent:"center" }}><Icon size={12} color="rgba(255,255,255,0.5)"/></div>
                <span style={{ fontSize:12, color:"rgba(255,255,255,0.45)" }}>{label}</span>
              </div>
            ))}
          </div>
          <div style={{ fontSize:11, color:"rgba(255,255,255,0.2)" }}>© 2025 ACOB Lighting Technology Ltd</div>
        </div>
        {/* Right */}
        <div style={{ flex:1, background:T.surface, padding:"44px 40px", display:"flex", flexDirection:"column", justifyContent:"center" }}>
          {tab==="login" && (
            <div className="fadeIn">
              <div style={{ marginBottom:32 }}>
                <div style={{ fontFamily:P, fontWeight:800, fontSize:24, color:T.text, marginBottom:6 }}>Welcome back</div>
                <div style={{ fontSize:13, color:T.muted }}>Sign in with your vendor credentials to continue.</div>
              </div>
              {err && <div style={{ background:T.dangerBg, border:`1px solid #fecaca`, borderRadius:10, padding:"10px 14px", marginBottom:16, display:"flex", gap:8, alignItems:"center" }}><AlertCircle size={14} color={T.danger}/><span style={{ fontSize:12, color:T.dangerText, fontFamily:P }}>{err}</span></div>}
              <div style={{ marginBottom:16 }}>
                <label style={{ display:"block", fontSize:12, fontWeight:600, color:T.textMid, marginBottom:6, fontFamily:P }}>Username or Vendor Code</label>
                <div style={{ position:"relative" }}>
                  <User size={14} color={T.faint} style={{ position:"absolute", left:13, top:"50%", transform:"translateY(-50%)", pointerEvents:"none" }}/>
                  <input value={user} onChange={e=>setUser(e.target.value)} placeholder="e.g. brightfuture01" style={{ width:"100%", padding:"11px 13px 11px 38px", borderRadius:10, border:`1.5px solid ${T.border2}`, background:"#FAFBFA", color:T.text, fontSize:14, fontFamily:P }}/>
                </div>
              </div>
              <div style={{ marginBottom:8 }}>
                <label style={{ display:"block", fontSize:12, fontWeight:600, color:T.textMid, marginBottom:6, fontFamily:P }}>Password</label>
                <div style={{ position:"relative" }}>
                  <Lock size={14} color={T.faint} style={{ position:"absolute", left:13, top:"50%", transform:"translateY(-50%)", pointerEvents:"none" }}/>
                  <input value={pass} onChange={e=>setPass(e.target.value)} type={show?"text":"password"} style={{ width:"100%", padding:"11px 42px 11px 38px", borderRadius:10, border:`1.5px solid ${T.border2}`, background:"#FAFBFA", color:T.text, fontSize:14, fontFamily:P }}/>
                  <button onClick={()=>setShow(!show)} style={{ position:"absolute", right:13, top:"50%", transform:"translateY(-50%)", background:"none", border:"none", cursor:"pointer", color:T.faint, display:"flex" }}>{show?<EyeOff size={14}/>:<Eye size={14}/>}</button>
                </div>
              </div>
              <div style={{ display:"flex", justifyContent:"flex-end", marginBottom:24 }}>
                <button onClick={()=>setTab("forgot")} style={{ background:"none", border:"none", fontSize:12, color:T.primary, cursor:"pointer", fontFamily:P, fontWeight:600 }}>Forgot password?</button>
              </div>
              <button onClick={submit} disabled={busy} style={{ width:"100%", padding:"13px", background:busy?T.primaryLight:T.primary, color:busy?T.primary:"#fff", border:"none", borderRadius:10, fontSize:14, fontWeight:700, cursor:busy?"not-allowed":"pointer", fontFamily:P, display:"flex", alignItems:"center", justifyContent:"center", gap:8, boxShadow:busy?"none":"0 4px 16px rgba(0,128,0,0.3)", transition:"all 0.2s" }}>
                {busy?<><div style={{ width:16,height:16,border:"2px solid",borderColor:`${T.primary} transparent`,borderRadius:"50%",animation:"spin 0.7s linear infinite" }}/> Signing in…</>:<>Sign In <ArrowRight size={16}/></>}
              </button>
              <Divider label="or"/>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
                <button onClick={()=>onLogin("vendor")} style={{ padding:"10px", background:T.bg, border:`1px solid ${T.border}`, borderRadius:10, cursor:"pointer", fontSize:12, color:T.muted, fontFamily:P, display:"flex", alignItems:"center", justifyContent:"center", gap:6 }}><Zap size={13} color={T.primary}/> Demo Vendor</button>
                <button onClick={()=>onLogin("admin")} style={{ padding:"10px", background:T.lemonLight, border:`1px solid ${T.lemon}`, borderRadius:10, cursor:"pointer", fontSize:12, color:T.lemonText, fontFamily:P, fontWeight:600, display:"flex", alignItems:"center", justifyContent:"center", gap:6 }}><Shield size={13}/> Admin Login →</button>
              </div>
              <div style={{ marginTop:22, padding:"13px 16px", background:"#FFFBEB", border:`1px solid #fcd34d`, borderRadius:10, fontSize:12, color:"#92400E", fontFamily:P }}>
                <strong>First-time login?</strong> You must change your temporary password before accessing wallet features.{" "}
                <button onClick={()=>setTab("first_login")} style={{ background:"none", border:"none", color:T.warning, cursor:"pointer", fontWeight:700, fontSize:12, textDecoration:"underline", fontFamily:P }}>Set new password →</button>
              </div>
            </div>
          )}
          {tab==="forgot" && (
            <div className="fadeIn">
              <button onClick={()=>setTab("login")} style={{ background:"none", border:"none", cursor:"pointer", color:T.muted, display:"flex", alignItems:"center", gap:6, fontSize:13, marginBottom:28, fontFamily:P }}>
                <ChevronLeft size={15}/> Back to sign in
              </button>
              <div style={{ fontFamily:P, fontWeight:800, fontSize:22, color:T.text, marginBottom:8 }}>Reset Password</div>
              <div style={{ fontSize:13, color:T.muted, marginBottom:28, lineHeight:1.65 }}>Enter your registered phone number. We'll send a reset code via SMS.</div>
              <FI label="Registered Phone Number" placeholder="080XXXXXXXX"/>
              <Btn full onClick={()=>setTab("login")}>Send Reset Code</Btn>
            </div>
          )}
          {tab==="first_login" && (
            <div className="fadeIn">
              <button onClick={()=>setTab("login")} style={{ background:"none", border:"none", cursor:"pointer", color:T.muted, display:"flex", alignItems:"center", gap:6, fontSize:13, marginBottom:28, fontFamily:P }}>
                <ChevronLeft size={15}/> Back to sign in
              </button>
              <div style={{ fontFamily:P, fontWeight:800, fontSize:22, color:T.text, marginBottom:8 }}>Set New Password</div>
              <div style={{ fontSize:13, color:T.muted, marginBottom:28, lineHeight:1.65 }}>Your temporary password expires in 72 hours. Set a permanent password to unlock full access.</div>
              <FI label="Temporary Password" type="password" placeholder="Enter temporary password"/>
              <FI label="New Password" type="password" placeholder="Min 8 chars, 1 number, 1 special"/>
              <FI label="Confirm New Password" type="password" placeholder="Repeat new password"/>
              <InfoBox type="warning">Password must be at least 8 characters, include one uppercase letter, one number, and one special character.</InfoBox>
              <div style={{ marginTop:16 }}><Btn full onClick={()=>setTab("login")}>Set Password & Sign In</Btn></div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── ADMIN LOGIN ───────────────────────────────────────────────────────────── */
function AdminLogin({ onLogin }) {
  const [user, setUser] = useState("admin");
  const [pass, setPass] = useState("Admin@1234");
  const [show, setShow] = useState(false);
  const [otp,  setOtp]  = useState(["","","","","",""]);
  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false);
  const otpRefs = useRef([]);
  const nextStep = () => { if(!user||!pass)return; setBusy(true); setTimeout(()=>{setBusy(false);setStep(2);},1000); };
  const handleOtp = (i,val) => { if(!/^\d*$/.test(val))return; const n=[...otp]; n[i]=val.slice(-1); setOtp(n); if(val&&i<5)otpRefs.current[i+1]?.focus(); };
  const verify = () => { setBusy(true); setTimeout(()=>{setBusy(false);onLogin("admin");},1000); };
  return (
    <div style={{ minHeight:"100vh", background:"#0d1f10", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:P, padding:20, position:"relative", overflow:"hidden" }}>
      <div style={{ position:"absolute", inset:0, pointerEvents:"none" }}>
        <div style={{ position:"absolute", top:"30%", left:"50%", transform:"translateX(-50%)", width:700, height:700, borderRadius:"50%", background:"radial-gradient(circle, rgba(0,128,0,0.06) 0%, transparent 65%)" }}/>
        <svg style={{ position:"absolute", inset:0, width:"100%", height:"100%", opacity:0.03 }}><defs><pattern id="grid2" width="60" height="60" patternUnits="userSpaceOnUse"><path d="M 60 0 L 0 0 0 60" fill="none" stroke="#4ade80" strokeWidth="0.5"/></pattern></defs><rect width="100%" height="100%" fill="url(#grid2)"/></svg>
      </div>
      <div style={{ width:"100%", maxWidth:440, position:"relative" }} className="fadeUp">
        <div style={{ display:"flex", flexDirection:"column", alignItems:"center", marginBottom:36 }}>
          <div style={{ width:56, height:56, background:T.lemon, borderRadius:14, display:"flex", alignItems:"center", justifyContent:"center", fontFamily:P, fontWeight:800, fontSize:24, color:T.lemonText, marginBottom:14, boxShadow:`0 8px 32px ${T.lemonGlow}`, animation:"float 3s ease-in-out infinite" }}>A</div>
          <div style={{ fontFamily:P, fontWeight:800, fontSize:20, color:"#fff" }}>ACOB CRM3</div>
          <div style={{ fontSize:12, color:"rgba(255,255,255,0.35)", marginTop:3 }}>Finance Administration Portal</div>
        </div>
        <div style={{ background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:18, padding:"32px", backdropFilter:"blur(12px)" }}>
          {step===1 && (
            <div className="fadeIn">
              <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:28 }}>
                <div style={{ width:32, height:32, background:"rgba(255,255,255,0.06)", borderRadius:8, display:"flex", alignItems:"center", justifyContent:"center" }}><Shield size={15} color={T.lemon}/></div>
                <div>
                  <div style={{ fontSize:15, fontWeight:700, color:"#fff", fontFamily:P }}>Admin Sign In</div>
                  <div style={{ fontSize:11, color:"rgba(255,255,255,0.35)" }}>2-factor authentication required</div>
                </div>
              </div>
              {["Admin Username","Password"].map((lbl,li) => (
                <div key={lbl} style={{ marginBottom:li===0?16:24 }}>
                  <label style={{ display:"block", fontSize:11, fontWeight:600, color:"rgba(255,255,255,0.45)", marginBottom:6, textTransform:"uppercase", letterSpacing:"0.07em", fontFamily:P }}>{lbl}</label>
                  <div style={{ position:"relative" }}>
                    {li===0 ? <User size={14} color="rgba(255,255,255,0.25)" style={{ position:"absolute", left:13, top:"50%", transform:"translateY(-50%)", pointerEvents:"none" }}/> : <Lock size={14} color="rgba(255,255,255,0.25)" style={{ position:"absolute", left:13, top:"50%", transform:"translateY(-50%)", pointerEvents:"none" }}/>}
                    <input value={li===0?user:pass} onChange={e=>li===0?setUser(e.target.value):setPass(e.target.value)} type={li===1&&!show?"password":"text"} style={{ width:"100%", padding:"11px 42px 11px 38px", borderRadius:10, border:"1px solid rgba(255,255,255,0.1)", background:"rgba(255,255,255,0.05)", color:"#fff", fontSize:14, fontFamily:P }}/>
                    {li===1 && <button onClick={()=>setShow(!show)} style={{ position:"absolute", right:13, top:"50%", transform:"translateY(-50%)", background:"none", border:"none", cursor:"pointer", color:"rgba(255,255,255,0.3)", display:"flex" }}>{show?<EyeOff size={14}/>:<Eye size={14}/>}</button>}
                  </div>
                </div>
              ))}
              <button onClick={nextStep} disabled={busy} style={{ width:"100%", padding:"13px", background:busy?"rgba(198,224,0,0.2)":T.lemon, color:busy?"rgba(198,224,0,0.7)":T.lemonText, border:"none", borderRadius:10, fontSize:14, fontWeight:700, cursor:busy?"not-allowed":"pointer", fontFamily:P, display:"flex", alignItems:"center", justifyContent:"center", gap:8, boxShadow:`0 4px 20px ${T.lemonGlow}`, transition:"all 0.2s" }}>
                {busy?<><div style={{ width:16,height:16,border:"2px solid",borderColor:`${T.lemonText} transparent`,borderRadius:"50%",animation:"spin 0.7s linear infinite" }}/> Verifying…</>:<>Continue to 2FA <ArrowRight size={16}/></>}
              </button>
              <div style={{ marginTop:18, textAlign:"center" }}><button onClick={()=>onLogin("vendor")} style={{ background:"none", border:"none", fontSize:12, color:"rgba(255,255,255,0.3)", cursor:"pointer", fontFamily:P }}>← Back to Vendor Portal</button></div>
            </div>
          )}
          {step===2 && (
            <div className="fadeIn">
              <div style={{ textAlign:"center", marginBottom:24 }}>
                <div style={{ width:52, height:52, background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 12px" }}><Fingerprint size={24} color={T.lemon}/></div>
                <div style={{ fontSize:16, fontWeight:700, color:"#fff", marginBottom:6, fontFamily:P }}>Two-Factor Authentication</div>
                <div style={{ fontSize:12, color:"rgba(255,255,255,0.4)", lineHeight:1.65 }}>Enter the 6-digit OTP sent to your mobile ending in <strong style={{ color:"rgba(255,255,255,0.65)" }}>•••• 7821</strong></div>
              </div>
              <div style={{ display:"flex", gap:8, justifyContent:"center", marginBottom:24 }}>
                {otp.map((v,i) => <input key={i} ref={el=>otpRefs.current[i]=el} value={v} onChange={e=>handleOtp(i,e.target.value)} maxLength={1} inputMode="numeric" style={{ width:46, height:54, textAlign:"center", fontSize:22, fontWeight:800, fontFamily:M, borderRadius:10, border:v?`2px solid ${T.lemon}`:"1px solid rgba(255,255,255,0.12)", background:"rgba(255,255,255,0.05)", color:"#fff" }}/>)}
              </div>
              <button onClick={verify} disabled={busy||otp.some(d=>!d)} style={{ width:"100%", padding:"13px", background:(busy||otp.some(d=>!d))?"rgba(0,128,0,0.2)":T.primary, color:"#fff", border:"none", borderRadius:10, fontSize:14, fontWeight:700, cursor:"pointer", fontFamily:P, display:"flex", alignItems:"center", justifyContent:"center", gap:8, transition:"all 0.2s" }}>
                {busy?<><div style={{ width:16,height:16,border:"2px solid",borderColor:"rgba(255,255,255,0.5) transparent",borderRadius:"50%",animation:"spin 0.7s linear infinite" }}/> Verifying…</>:<>Verify & Sign In <ShieldCheck size={15}/></>}
              </button>
              <div style={{ marginTop:14, textAlign:"center", fontSize:12, color:"rgba(255,255,255,0.3)", fontFamily:P }}>
                Didn't receive code?{" "}
                <button onClick={()=>setOtp(["","","","","",""])} style={{ background:"none", border:"none", color:T.lemon, cursor:"pointer", fontSize:12, fontFamily:P, fontWeight:600 }}>Resend</button>
              </div>
              <div style={{ marginTop:10, textAlign:"center" }}><button onClick={()=>setStep(1)} style={{ background:"none", border:"none", fontSize:12, color:"rgba(255,255,255,0.3)", cursor:"pointer", fontFamily:P }}>← Back</button></div>
            </div>
          )}
        </div>
        <div style={{ marginTop:20, textAlign:"center", fontSize:11, color:"rgba(255,255,255,0.18)", fontFamily:P }}>ACOB Lighting Technology Ltd · Secure Admin Access · All actions audited</div>
      </div>
    </div>
  );
}

/* ─── SIDEBAR ───────────────────────────────────────────────────────────────── */
const VENDOR_NAV = [
  { section:"Overview" },
  { key:"v-dashboard",    label:"Dashboard",     Icon:LayoutDashboard },
  { section:"Transactions" },
  { key:"v-buy",          label:"Buy Units",     Icon:Zap },
  { key:"v-topup",        label:"Fund Wallet",   Icon:ArrowUpCircle },
  { key:"v-transactions", label:"Transactions",  Icon:Activity },
  { key:"v-receipts",     label:"Receipts",      Icon:Receipt },
  { key:"v-statement",    label:"Statement",     Icon:FileText },
  { section:"Account" },
  { key:"v-profile",      label:"My Profile",    Icon:Shield },
];
const ADMIN_NAV = [
  { section:"Overview" },
  { key:"a-dashboard",  label:"Dashboard",       Icon:LayoutDashboard },
  { section:"Vendors" },
  { key:"a-vendors",    label:"Vendors",         Icon:Users,         badge:4 },
  { key:"a-wallets",    label:"All Wallets",     Icon:Wallet },
  { section:"Finance" },
  { key:"a-funding",    label:"Funding & Credits",Icon:CheckSquare,  badge:3 },
  { key:"a-purchases",  label:"Purchase Monitor",Icon:Package },
  { section:"Operations" },
  { key:"a-exceptions", label:"Exceptions",      Icon:Flag,          badge:2, badgeDanger:true },
  { key:"a-settlement", label:"Settlement",      Icon:BarChart2 },
  { section:"Reports" },
  { key:"a-audit",      label:"Audit Log",       Icon:BookOpen },
];

function Sidebar({ role, view, setView, onSignOut }) {
  const nav = role==="vendor" ? VENDOR_NAV : ADMIN_NAV;
  return (
    <div style={{ width:230, background:T.sidebarBg, display:"flex", flexDirection:"column", flexShrink:0, overflowY:"auto", borderRight:"1px solid rgba(255,255,255,0.04)" }}>
      <div style={{ padding:"18px 16px 14px", borderBottom:"1px solid rgba(255,255,255,0.05)" }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <div style={{ width:38, height:38, background:T.lemon, borderRadius:10, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, fontFamily:P, fontWeight:800, fontSize:18, color:T.lemonText, boxShadow:`0 4px 12px ${T.lemonGlow}` }}>A</div>
          <div>
            <div style={{ fontFamily:P, fontWeight:800, fontSize:13, color:"#fff" }}>ACOB CRM3</div>
            <div style={{ fontSize:10, color:"rgba(255,255,255,0.3)", marginTop:1 }}>Lighting Technology Ltd</div>
          </div>
        </div>
      </div>
      <div style={{ padding:"8px 14px 10px", borderBottom:"1px solid rgba(255,255,255,0.05)" }}>
        <div style={{ background:role==="admin"?`rgba(198,224,0,0.1)`:"rgba(0,128,0,0.12)", borderRadius:8, padding:"5px 10px", display:"flex", alignItems:"center", gap:7 }}>
          <div style={{ width:6, height:6, borderRadius:"50%", background:role==="admin"?T.lemon:"#4ade80", flexShrink:0 }}/>
          <span style={{ fontSize:11, color:role==="admin"?T.lemon:"#4ade80", fontWeight:600, fontFamily:P }}>
            {role==="admin" ? "Finance Admin" : `${VENDOR_ME.site} · ${VENDOR_ME.code}`}
          </span>
        </div>
      </div>
      <nav style={{ flex:1, padding:"8px 10px" }}>
        {nav.map((item,idx) => {
          if(item.section) return <div key={idx} style={{ fontSize:10, fontWeight:700, color:"rgba(255,255,255,0.2)", textTransform:"uppercase", letterSpacing:"0.1em", padding:"12px 8px 4px", fontFamily:P }}>{item.section}</div>;
          const active = view===item.key;
          return (
            <button key={item.key} className="nav-item" onClick={()=>setView(item.key)} style={{ width:"100%", display:"flex", alignItems:"center", gap:9, padding:"8px 10px", borderRadius:8, border:"none", cursor:"pointer", marginBottom:2, textAlign:"left", background:active?T.primary:"transparent", color:active?"#fff":"rgba(255,255,255,0.5)", fontSize:13, fontWeight:active?600:400, fontFamily:P, transition:"all 0.15s", borderLeft:active?`3px solid ${T.lemon}`:"3px solid transparent" }}>
              <item.Icon size={15} style={{ flexShrink:0 }}/>
              <span style={{ flex:1 }}>{item.label}</span>
              {item.badge && <span style={{ fontSize:10, fontWeight:700, padding:"1px 7px", borderRadius:10, background:item.badgeDanger?T.danger:T.lemon, color:item.badgeDanger?"#fff":T.lemonText }}>{item.badge}</span>}
            </button>
          );
        })}
      </nav>
      <div style={{ padding:"12px 14px", borderTop:"1px solid rgba(255,255,255,0.05)" }}>
        <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:10 }}>
          <div style={{ width:32, height:32, borderRadius:"50%", background:role==="vendor"?T.primary:T.lemon, display:"flex", alignItems:"center", justifyContent:"center", fontSize:12, fontWeight:700, color:role==="vendor"?"#fff":T.lemonText, flexShrink:0 }}>{role==="vendor"?"BF":"AD"}</div>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ color:"#fff", fontSize:12, fontWeight:600, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", fontFamily:P }}>{role==="vendor"?"Bright Future":"Finance Admin"}</div>
            <div style={{ color:"rgba(255,255,255,0.3)", fontSize:10, fontFamily:P }}>{role==="vendor"?"vendor_user":"super_admin"}</div>
          </div>
        </div>
        <button onClick={onSignOut} style={{ width:"100%", padding:"7px", background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:8, cursor:"pointer", color:"rgba(255,255,255,0.4)", fontSize:12, display:"flex", alignItems:"center", justifyContent:"center", gap:6, fontFamily:P }}>
          <LogOut size={12}/> Sign Out
        </button>
      </div>
    </div>
  );
}

/* ─── TOPBAR ────────────────────────────────────────────────────────────────── */
function Topbar({ title, sub, right, role, notifCount, onNotif }) {
  return (
    <div style={{ height:60, background:T.surface, borderBottom:`1px solid ${T.border}`, display:"flex", alignItems:"center", padding:"0 24px", gap:14, flexShrink:0 }}>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:17, fontWeight:700, color:T.text, fontFamily:P }}>{title}</div>
        {sub && <div style={{ fontSize:11, color:T.muted, marginTop:1, fontFamily:P }}>{sub}</div>}
      </div>
      <div style={{ display:"flex", alignItems:"center", gap:10 }}>
        {right}
        <button onClick={onNotif} style={{ position:"relative", width:36, height:36, borderRadius:9, background:T.bg, border:`1px solid ${T.border}`, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>
          <Bell size={15} color={T.muted}/>
          {notifCount>0 && <span style={{ position:"absolute", top:5, right:5, width:8, height:8, borderRadius:"50%", background:T.danger, border:"2px solid #fff", animation:"pulse 2s ease-in-out infinite" }}/>}
        </button>
        <div style={{ width:34, height:34, borderRadius:"50%", background:role==="vendor"?T.primary:T.lemon, display:"flex", alignItems:"center", justifyContent:"center", fontSize:12, fontWeight:700, color:role==="vendor"?"#fff":T.lemonText, cursor:"pointer" }}>{role==="vendor"?"BF":"AD"}</div>
      </div>
    </div>
  );
}

/* ─── VENDOR: DASHBOARD ─────────────────────────────────────────────────────── */
function VDashboard({ setView }) {
  const pct = ((WALLET.dailyUsed/WALLET.dailyLimit)*100).toFixed(0);
  const bars = [52,68,44,79,63,88,55,91,74,96,81,70,87,73];
  return (
    <div style={{ padding:24 }} className="fadeUp">
      <div style={{ background:`linear-gradient(135deg, ${T.sidebarBg} 0%, #013b18 100%)`, borderRadius:18, padding:"26px 28px", color:"#fff", marginBottom:20, position:"relative", overflow:"hidden", boxShadow:"0 8px 40px rgba(1,21,8,0.22)" }}>
        <div style={{ position:"absolute", right:-50, top:-50, width:260, height:260, borderRadius:"50%", background:"rgba(198,224,0,0.05)", pointerEvents:"none" }}/>
        <div style={{ position:"relative" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
            <div>
              <div style={{ fontSize:11, color:"rgba(255,255,255,0.45)", textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:8, fontWeight:600 }}>Available Balance</div>
              <div style={{ fontSize:44, fontWeight:800, letterSpacing:"-1.5px", lineHeight:1, fontFamily:P }}>{NGN(AVAIL)}</div>
              <div style={{ fontSize:12, color:"rgba(255,255,255,0.35)", marginTop:8, fontFamily:M }}>{VENDOR_ME.walletNo} · NGN · {VENDOR_ME.site}</div>
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:8, alignItems:"flex-end" }}>
              <span style={{ background:"rgba(74,222,128,0.15)", border:"1px solid rgba(74,222,128,0.25)", color:"#4ade80", padding:"4px 12px", borderRadius:20, fontSize:12, fontWeight:600, display:"flex", alignItems:"center", gap:5 }}>
                <span style={{ width:6,height:6,borderRadius:"50%",background:"#4ade80",animation:"pulse 2s ease-in-out infinite" }}/>Active
              </span>
              <Btn size="sm" onClick={()=>setView("v-buy")} style={{ background:T.lemon, color:T.lemonText, boxShadow:`0 4px 14px ${T.lemonGlow}`, fontWeight:700 }}><Zap size={12}/> Buy Units</Btn>
            </div>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", marginTop:24, paddingTop:20, borderTop:"1px solid rgba(255,255,255,0.07)" }}>
            {[{lbl:"Posted Float",val:NGN(WALLET.float)},{lbl:"Reserved",val:NGN(WALLET.reserved),warn:true},{lbl:"Today's Spend",val:NGN(WALLET.dailyUsed)},{lbl:"Daily Remaining",val:NGN(WALLET.dailyLimit-WALLET.dailyUsed)}].map(({lbl,val,warn}) => (
              <div key={lbl}>
                <div style={{ fontSize:10, color:"rgba(255,255,255,0.35)", marginBottom:5, textTransform:"uppercase", letterSpacing:"0.06em", fontFamily:P, fontWeight:600 }}>{lbl}</div>
                <div style={{ fontSize:16, fontWeight:700, color:warn?"#fcd34d":"#fff", fontFamily:P }}>{val}</div>
              </div>
            ))}
          </div>
          <div style={{ marginTop:18 }}>
            <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, color:"rgba(255,255,255,0.35)", marginBottom:7, fontFamily:P }}>
              <span>Daily Limit Usage — {pct}%</span>
              <span style={{ fontFamily:M }}>{NGN(WALLET.dailyUsed)} / {NGN(WALLET.dailyLimit)}</span>
            </div>
            <div style={{ height:6, background:"rgba(255,255,255,0.08)", borderRadius:3 }}>
              <div style={{ height:6, borderRadius:3, width:`${pct}%`, background:Number(pct)>80?T.danger:T.lemon, boxShadow:`0 0 8px ${Number(pct)>80?"rgba(220,38,38,0.5)":T.lemonGlow}`, transition:"width 0.6s ease" }}/>
            </div>
          </div>
        </div>
      </div>

      {/* ⚠️ Wallet Funding Info Box */}
      <div style={{ marginBottom:16 }}>
        <InfoBox type="lemon">
          <strong>Wallet funding does not generate a token.</strong> Funding is purely a wallet balance top-up. You receive electricity tokens only when you <em>buy units</em> for a customer meter using your funded balance.
        </InfoBox>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12, marginBottom:20 }}>
        {[{label:"Buy Units",desc:"Get token or remote send",Icon:Zap,color:T.primary,bg:T.primaryLight,view:"v-buy"},{label:"Fund Wallet",desc:"Bank transfer top-up",Icon:ArrowUpCircle,color:T.lemonDark,bg:T.lemonLight,view:"v-topup"},{label:"Receipts",desc:"All purchase receipts",Icon:Receipt,color:"#7C3AED",bg:T.purpleBg,view:"v-receipts"},{label:"Statement",desc:"Download or view",Icon:FileText,color:T.info,bg:T.infoBg,view:"v-statement"}].map(({label,desc,Icon,color,bg,view:v}) => (
          <button key={label} className="card-lift" onClick={()=>setView(v)} style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:14, padding:"18px 16px", textAlign:"left", cursor:"pointer" }}
            onMouseOver={e=>{e.currentTarget.style.borderColor=color;e.currentTarget.style.background=bg;}} onMouseOut={e=>{e.currentTarget.style.borderColor=T.border;e.currentTarget.style.background=T.surface;}}>
            <div style={{ width:38,height:38,background:bg,borderRadius:9,display:"flex",alignItems:"center",justifyContent:"center",marginBottom:12 }}><Icon size={18} color={color}/></div>
            <div style={{ fontSize:13,fontWeight:700,color:T.text,marginBottom:3,fontFamily:P }}>{label}</div>
            <div style={{ fontSize:11,color:T.muted,fontFamily:P }}>{desc}</div>
          </button>
        ))}
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"2fr 1fr", gap:16, marginBottom:20 }}>
        <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:14, padding:22 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
            <div style={{ fontSize:14,fontWeight:700,color:T.text,fontFamily:P }}>Purchase Volume — Last 14 Days</div>
            <Badge variant="success" dot>₦2.8M total</Badge>
          </div>
          <div style={{ display:"flex", alignItems:"flex-end", gap:5, height:88 }}>
            {bars.map((h,i) => <div key={i} style={{ flex:1,borderRadius:"3px 3px 0 0",height:`${h}%`,background:i===bars.length-1?T.primary:"#b7dfc8",cursor:"pointer",transition:"opacity 0.2s" }} onMouseOver={e=>e.currentTarget.style.opacity="0.7"} onMouseOut={e=>e.currentTarget.style.opacity="1"}/>)}
          </div>
          <div style={{ display:"flex", justifyContent:"space-between", fontSize:10, color:T.faint, marginTop:8, fontFamily:M }}><span>3 Apr</span><span>Today</span></div>
        </div>
        <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:14, padding:22 }}>
          <div style={{ fontSize:14,fontWeight:700,color:T.text,marginBottom:16,fontFamily:P }}>Today's Summary</div>
          {[{lbl:"Purchases",val:"₦17,500",color:T.text},{lbl:"Transactions",val:"7",color:T.text},{lbl:"Successful",val:"6",color:T.success},{lbl:"Failed",val:"1",color:T.danger},{lbl:"Commission",val:"₦0.00",color:T.muted}].map(({lbl,val,color}) => (
            <div key={lbl} style={{ display:"flex",justifyContent:"space-between",padding:"7px 0",borderBottom:`1px solid ${T.border}`,fontSize:13 }}>
              <span style={{ color:T.muted,fontFamily:P }}>{lbl}</span>
              <span style={{ fontWeight:700,color,fontFamily:P }}>{val}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ background:T.surface,border:`1px solid ${T.border}`,borderRadius:14 }}>
        <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",padding:"14px 20px",borderBottom:`1px solid ${T.border}` }}>
          <div style={{ fontSize:14,fontWeight:700,color:T.text,fontFamily:P }}>Recent Transactions</div>
          <Btn variant="ghost" size="sm" onClick={()=>setView("v-transactions")}>View all →</Btn>
        </div>
        <div style={{ overflowX:"auto" }}>
          <table style={{ width:"100%",borderCollapse:"collapse" }}>
            <thead><tr><Th>Date</Th><Th>Reference</Th><Th>Description</Th><Th>Method</Th><Th>Debit</Th><Th>Credit</Th><Th>Status</Th></tr></thead>
            <tbody>
              {TXNS.slice(0,5).map(t => (
                <tr key={t.id} className="row-hover" style={{ cursor:"pointer" }}>
                  <Td muted>{t.date}</Td>
                  <Td mono><span style={{ color:T.primary,fontWeight:600 }}>{t.ref}</span></Td>
                  <Td>{t.desc}</Td>
                  <Td>{t.method?<Badge variant={t.method==="remote_send"?"info":"success"}>{t.method==="remote_send"?"Remote Send":"Token"}</Badge>:<span style={{ color:T.faint,fontFamily:P,fontSize:12 }}>— funding</span>}</Td>
                  <Td danger>{t.amount<0?NGN(Math.abs(t.amount)):"—"}</Td>
                  <Td success>{t.amount>0?NGN(t.amount):"—"}</Td>
                  <Td><Badge variant={t.status==="successful"||t.status==="posted"?"success":t.status==="reversed"?"info":"danger"}>{t.status}</Badge></Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ─── VENDOR: BUY UNITS (token delivery flow) ───────────────────────────────── */
function VBuy() {
  const [step, setStep]    = useState(1);
  const [delivery, setDel] = useState("token");
  const [amount,  setAmt]  = useState("5000");
  const [busy,    setBusy] = useState(false);
  const amtNum = parseFloat(amount)||0;
  const valid  = amtNum>=100 && amtNum<=Math.min(WALLET.perTxn,AVAIL);

  const StepBar = () => (
    <div style={{ display:"flex",alignItems:"center",marginBottom:24 }}>
      {["Select Meter","Amount & Delivery","Confirm","Receipt"].map((lbl,i) => {
        const n=i+1,done=step>n,active=step===n;
        return (
          <div key={lbl} style={{ display:"flex",alignItems:"center",flex:i<3?1:"none" }}>
            <div style={{ display:"flex",alignItems:"center",gap:7 }}>
              <div style={{ width:26,height:26,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:800,background:done||active?T.primary:T.border,color:done||active?"#fff":T.faint,boxShadow:active?`0 0 0 4px ${T.primaryLight}`:"none",transition:"all 0.2s" }}>{done?<Check size={12}/>:n}</div>
              <span style={{ fontSize:12,color:active?T.text:done?T.primary:T.muted,fontWeight:active?700:400,fontFamily:P }}>{lbl}</span>
            </div>
            {i<3 && <div style={{ flex:1,height:2,background:done?T.primary:T.border,margin:"0 10px",borderRadius:1 }}/>}
          </div>
        );
      })}
    </div>
  );

  return (
    <div style={{ padding:24,maxWidth:640 }} className="fadeUp">
      <div style={{ marginBottom:20 }}>
        <div style={{ fontFamily:P,fontWeight:800,fontSize:22,color:T.text,marginBottom:4 }}>Buy Units</div>
        <div style={{ fontSize:13,color:T.muted,fontFamily:P }}>Available balance: <strong style={{ color:T.primary }}>{NGN(AVAIL)}</strong></div>
      </div>
      <StepBar/>

      {step===1 && (
        <div style={{ background:T.surface,border:`1px solid ${T.border}`,borderRadius:16,padding:24 }} className="slideRight">
          <div style={{ fontSize:15,fontWeight:700,color:T.text,marginBottom:16,fontFamily:P }}>Search for a meter</div>
          <FI label="Meter serial number or customer name" placeholder="e.g. MTR-00291 or Adebayo Okafor" defaultValue="MTR-00291" hint="Only meters in Lagos North site are shown"/>
          <div style={{ background:T.bg,borderRadius:12,padding:16,marginBottom:18,border:`1px solid ${T.border}` }}>
            <div style={{ fontSize:10,color:T.muted,marginBottom:10,textTransform:"uppercase",letterSpacing:"0.07em",fontWeight:700,fontFamily:P }}>Search Result</div>
            <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10 }}>
              <div>
                <div style={{ fontWeight:700,fontSize:15,color:T.text,fontFamily:P }}>Adebayo Okafor</div>
                <div style={{ fontSize:12,color:T.muted,fontFamily:M,marginTop:3 }}>MTR-00291 · Single Phase · Lagos North</div>
              </div>
              <Badge variant="success" dot>Active</Badge>
            </div>
            <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,fontSize:12,fontFamily:P }}>
              <div style={{ color:T.muted }}>Account ref: <strong style={{ color:T.text }}>ACC-00291</strong></div>
              <div style={{ color:T.muted }}>Last vended: <strong style={{ color:T.text }}>12 Apr 2025</strong></div>
            </div>
          </div>
          <Btn full onClick={()=>setStep(2)}>Select this meter →</Btn>
        </div>
      )}

      {step===2 && (
        <div style={{ background:T.surface,border:`1px solid ${T.border}`,borderRadius:16,padding:24 }} className="slideRight">
          <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18 }}>
            <div style={{ fontSize:15,fontWeight:700,color:T.text,fontFamily:P }}>Amount & Delivery</div>
            <button onClick={()=>setStep(1)} style={{ background:"none",border:"none",color:T.primary,fontSize:12,cursor:"pointer",fontFamily:P,fontWeight:600 }}>← Change meter</button>
          </div>
          <div style={{ background:T.bg,borderRadius:9,padding:"8px 13px",marginBottom:18,display:"flex",gap:8,alignItems:"center",fontSize:12,border:`1px solid ${T.border}` }}>
            <Wallet size={12} color={T.muted}/><span style={{ color:T.muted,fontFamily:P }}>MTR-00291 · Adebayo Okafor · ACC-00291</span>
          </div>
          <div style={{ marginBottom:16 }}>
            <label style={{ display:"block",fontSize:12,fontWeight:600,color:T.muted,marginBottom:6,fontFamily:P }}>Purchase Amount (NGN) *</label>
            <div style={{ position:"relative" }}>
              <span style={{ position:"absolute",left:13,top:"50%",transform:"translateY(-50%)",color:T.muted,fontWeight:700,fontFamily:P }}>₦</span>
              <input value={amount} onChange={e=>setAmt(e.target.value)} type="number" style={{ width:"100%",padding:"12px 13px 12px 28px",borderRadius:10,border:`2px solid ${T.border2}`,fontSize:22,fontWeight:800,color:T.text,background:T.surface,fontFamily:P }}/>
            </div>
            <div style={{ display:"flex",justifyContent:"space-between",fontSize:11,marginTop:5,fontFamily:P }}>
              <span style={{ color:T.muted }}>Min ₦100 · Per-txn max {NGN(WALLET.perTxn)}</span>
              <span style={{ color:T.primary,fontWeight:600 }}>Balance after: {NGN(AVAIL-amtNum)}</span>
            </div>
            <div style={{ display:"flex",gap:6,marginTop:10,flexWrap:"wrap" }}>
              {[1000,2000,5000,10000,20000].map(q => (
                <button key={q} onClick={()=>setAmt(String(q))} style={{ background:amount==q?T.primaryLight:T.bg,border:`1px solid ${amount==q?T.primary:T.border}`,borderRadius:7,padding:"5px 11px",color:amount==q?T.primary:T.muted,fontSize:12,cursor:"pointer",fontWeight:amount==q?700:400,fontFamily:P,transition:"all 0.15s" }}>{NGN(q)}</button>
              ))}
            </div>
          </div>

          {/* Delivery method — key flow: token OR remote-send */}
          <div style={{ marginBottom:20 }}>
            <div style={{ fontSize:12,fontWeight:700,color:T.muted,marginBottom:10,fontFamily:P }}>Delivery Method *</div>
            <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:12 }}>
              {[
                { val:"token",       label:"Generate Token",  desc:"Returns a 20-digit code the customer enters on their meter keypad. No meter connectivity needed.", icon:"🔢", selColor:T.primary, selBg:T.primaryLight },
                { val:"remote_send", label:"Remote Send",     desc:"Sends credit electronically to the meter. No visible token code — you receive a remote-send reference.", icon:"📡", selColor:T.lemonDark, selBg:T.lemonLight },
              ].map(opt => {
                const sel=delivery===opt.val;
                return (
                  <button key={opt.val} onClick={()=>setDel(opt.val)} style={{ background:sel?opt.selBg:T.surface,borderRadius:12,textAlign:"left",cursor:"pointer",border:sel?`2px solid ${opt.selColor}`:`1px solid ${T.border}`,padding:16,transition:"all 0.2s" }}>
                    <div style={{ fontSize:22,marginBottom:8 }}>{opt.icon}</div>
                    <div style={{ fontSize:13,fontWeight:700,color:sel?opt.selColor:T.text,fontFamily:P }}>{opt.label}</div>
                    <div style={{ fontSize:11,color:T.muted,marginTop:4,lineHeight:1.55,fontFamily:P }}>{opt.desc}</div>
                    {sel && <div style={{ fontSize:11,fontWeight:700,color:opt.selColor,marginTop:8,display:"flex",alignItems:"center",gap:4,fontFamily:P }}><Check size={11}/>Selected</div>}
                  </button>
                );
              })}
            </div>
          </div>
          <div style={{ display:"flex",gap:8 }}>
            <Btn variant="ghost" onClick={()=>setStep(1)}>← Back</Btn>
            <Btn full disabled={!valid} onClick={()=>setStep(3)}>Review Purchase →</Btn>
          </div>
        </div>
      )}

      {step===3 && (
        <div style={{ background:T.surface,border:`1px solid ${T.border}`,borderRadius:16,padding:24 }} className="slideRight">
          <div style={{ fontSize:15,fontWeight:700,color:T.text,marginBottom:18,fontFamily:P }}>Confirm Purchase</div>
          <div style={{ border:`1px solid ${T.border}`,borderRadius:12,overflow:"hidden",marginBottom:16 }}>
            {[["Customer","Adebayo Okafor"],["Meter SN","MTR-00291"],["Account ref","ACC-00291"],["Site","Lagos North"],["Amount",NGN(amtNum)],["Delivery",delivery==="token"?"Generate Token (20-digit code)":"Remote Send to Meter (reference only)"],["Wallet balance after",NGN(AVAIL-amtNum)]].map(([k,v],i,arr) => (
              <div key={k} style={{ display:"flex",justifyContent:"space-between",padding:"11px 16px",borderBottom:i<arr.length-1?`1px solid ${T.border}`:"none",fontSize:13,background:i%2===0?T.surface:T.surface2 }}>
                <span style={{ color:T.muted,fontFamily:P }}>{k}</span>
                <span style={{ fontWeight:700,color:k==="Wallet balance after"?T.primary:T.text,fontFamily:k==="Meter SN"||k==="Account ref"?M:P }}>{v}</span>
              </div>
            ))}
          </div>
          <InfoBox type="warning">This will debit <strong>{NGN(amtNum)}</strong> from your wallet immediately. The token/receipt is only issued after successful purchase. Funding credits do not generate tokens.</InfoBox>
          <div style={{ display:"flex",gap:8,marginTop:16 }}>
            <Btn variant="ghost" onClick={()=>setStep(2)}>← Back</Btn>
            <Btn full disabled={busy} onClick={()=>{setBusy(true);setTimeout(()=>{setBusy(false);setStep(4);},1600);}}>
              {busy?<><div style={{ width:14,height:14,border:"2px solid",borderColor:"rgba(255,255,255,0.5) transparent",borderRadius:"50%",animation:"spin 0.7s linear infinite" }}/> Processing…</>:"Confirm Purchase"}
            </Btn>
          </div>
        </div>
      )}

      {step===4 && (
        <div style={{ background:T.surface,border:`1px solid ${T.border}`,borderRadius:16,overflow:"hidden" }} className="fadeIn">
          <div style={{ background:`linear-gradient(135deg, ${T.sidebarBg}, #013b18)`,padding:"24px 28px",textAlign:"center" }}>
            <div style={{ width:52,height:52,background:"rgba(74,222,128,0.15)",border:"1px solid rgba(74,222,128,0.3)",borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 12px",animation:"glowGreen 2s ease-in-out infinite" }}>
              <Check size={24} color="#4ade80"/>
            </div>
            <div style={{ color:"#fff",fontWeight:800,fontSize:20,fontFamily:P }}>Purchase Successful!</div>
            <div style={{ color:"rgba(255,255,255,0.45)",fontSize:13,marginTop:4,fontFamily:P }}>{delivery==="token"?"20-Digit Token Generated":"Remote Credit Sent to Meter"}</div>
          </div>
          <div style={{ padding:22 }}>
            <div style={{ background:T.bg,borderRadius:9,padding:"8px 14px",display:"flex",justifyContent:"space-between",marginBottom:18,fontSize:11,border:`1px solid ${T.border}` }}>
              <span style={{ color:T.muted,fontFamily:P }}>ACOB Lighting Technology Limited — Vending Receipt</span>
              <span style={{ color:T.primary,fontFamily:M,fontWeight:700 }}>RCP-20250416-000043</span>
            </div>
            {[["Date / Time (WAT)","16 Apr 2025, 10:22 WAT"],["Transaction type",delivery==="token"?"Token Generated (POST /api/wallet/purchase/generate-token)":"Remote Send (POST /api/wallet/purchase/remote-send)"],["Vendor",`${VENDOR_ME.name} (${VENDOR_ME.code})`],["Site",VENDOR_ME.site],["Meter SN","MTR-00291"],["Customer","Adebayo Okafor"],["Amount",NGN(amtNum)]].map(([k,v]) => (
              <div key={k} style={{ display:"flex",justifyContent:"space-between",padding:"7px 0",borderBottom:`1px solid ${T.border}`,fontSize:12 }}>
                <span style={{ color:T.muted,fontFamily:P }}>{k}</span>
                <span style={{ fontFamily:k.includes("type")?M:P,fontWeight:600,color:T.text,maxWidth:"60%",textAlign:"right" }}>{v}</span>
              </div>
            ))}

            {/* Token delivery */}
            {delivery==="token" ? (
              <div style={{ margin:"18px 0",background:T.primaryLight,border:`2px solid ${T.primary}`,borderRadius:14,padding:"18px 22px",textAlign:"center" }}>
                <div style={{ fontSize:11,color:T.successText,fontWeight:800,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:10,fontFamily:P }}>🔢 Token Code — Hand to Customer for Keypad Entry</div>
                <div style={{ fontSize:28,fontWeight:900,fontFamily:M,letterSpacing:"4px",color:T.sidebarBg,wordSpacing:14 }}>3821 5647 9012 3847 6521</div>
                <div style={{ fontSize:11,color:T.primary,marginTop:8,fontFamily:P }}>This 20-digit code is generated by the upstream vending server</div>
              </div>
            ) : (
              <div style={{ margin:"18px 0" }}>
                <div style={{ background:T.successBg,border:`1px solid #b7dfc8`,borderRadius:12,padding:"14px 18px",textAlign:"center",marginBottom:8 }}>
                  <div style={{ fontSize:14,fontWeight:800,color:T.successText,marginBottom:4,display:"flex",alignItems:"center",justifyContent:"center",gap:6,fontFamily:P }}><CheckCircle2 size={16}/> REMOTELY DELIVERED</div>
                  <div style={{ fontSize:11,fontFamily:M,color:T.primary }}>TXN-UP-20250416-84921</div>
                </div>
                <InfoBox type="info">Remote send does not produce a visible token string. The meter receives credit directly. The reference above is your upstream delivery confirmation.</InfoBox>
              </div>
            )}
            <div style={{ display:"flex",gap:8,marginTop:8 }}>
              <Btn variant="outline"><Printer size={13}/> Print Receipt</Btn>
              <Btn full onClick={()=>setStep(1)}>New Purchase</Btn>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── VENDOR: FUND WALLET (no token — balance top-up only) ─────────────────── */
function VTopup() {
  const [step, setStep] = useState(1);
  const trackSteps = ["Initiate","Upload Proof","Under Review","Confirmed","Posted to Wallet"];
  const cur = step===1?1:step===2?2:3;
  return (
    <div style={{ padding:24,maxWidth:600 }} className="fadeUp">
      <div style={{ marginBottom:8 }}>
        <div style={{ fontFamily:P,fontWeight:800,fontSize:22,color:T.text,marginBottom:4 }}>Fund Wallet</div>
        <div style={{ fontSize:13,color:T.muted,fontFamily:P }}>Request a wallet balance top-up via bank transfer</div>
      </div>
      <div style={{ marginBottom:22 }}>
        <InfoBox type="lemon">
          <strong>Funding ≠ Token.</strong> Funding credits your wallet balance only. No electricity token or remote-send is issued during funding. Tokens are only generated when you buy units for a customer meter.
        </InfoBox>
      </div>

      {/* Progress */}
      <div style={{ display:"flex",alignItems:"flex-start",marginBottom:28 }}>
        {trackSteps.map((lbl,i) => {
          const done=i<cur-1,active=i===cur-1;
          return (
            <div key={lbl} style={{ display:"flex",alignItems:"center",flex:i<trackSteps.length-1?1:"none" }}>
              <div style={{ display:"flex",flexDirection:"column",alignItems:"center" }}>
                <div style={{ width:26,height:26,borderRadius:"50%",fontSize:11,fontWeight:800,display:"flex",alignItems:"center",justifyContent:"center",background:done?T.primary:active?T.lemon:T.border,color:done?"#fff":active?T.lemonText:T.faint }}>
                  {done?<Check size={12}/>:i+1}
                </div>
                <div style={{ fontSize:9,color:active?T.lemon:done?T.primary:T.faint,marginTop:5,whiteSpace:"nowrap",fontFamily:P,fontWeight:600,maxWidth:64,textAlign:"center" }}>{lbl}</div>
              </div>
              {i<trackSteps.length-1 && <div style={{ flex:1,height:2,background:done?T.primary:T.border,marginBottom:16,margin:"0 4px 14px 4px",borderRadius:1 }}/>}
            </div>
          );
        })}
      </div>

      {step===1 && (
        <div style={{ background:T.surface,border:`1px solid ${T.border}`,borderRadius:16,padding:24 }} className="slideRight">
          <div style={{ fontSize:15,fontWeight:700,color:T.text,marginBottom:18,fontFamily:P }}>Step 1 — Initiate Funding Request</div>
          <FI label="Amount (NGN) *" prefix="₦" placeholder="e.g. 200,000.00" defaultValue="200,000.00" style={{ fontSize:16,fontWeight:700 }}/>
          <FS label="Funding Channel *"><option>Bank transfer</option><option>Cash at branch</option><option>Payment gateway</option></FS>
          <InfoBox type="info">A unique funding reference will be generated. Include it exactly in your bank transfer narration so finance can match your payment.</InfoBox>
          <div style={{ marginTop:16 }}><Btn full onClick={()=>setStep(2)}>Generate Reference →</Btn></div>
        </div>
      )}

      {step===2 && (
        <div style={{ background:T.surface,border:`1px solid ${T.border}`,borderRadius:16,padding:24 }} className="slideRight">
          <div style={{ fontSize:15,fontWeight:700,color:T.text,marginBottom:18,fontFamily:P }}>Step 2 — Transfer & Upload Proof</div>
          <div style={{ textAlign:"center",background:T.bg,borderRadius:12,padding:"20px 16px",marginBottom:20,border:`1px solid ${T.border}` }}>
            <div style={{ fontSize:12,color:T.muted,marginBottom:6,fontFamily:P }}>Your unique funding reference</div>
            <div style={{ fontSize:26,fontWeight:900,fontFamily:M,color:T.sidebarBg,letterSpacing:2 }}>FND-20250416-000013</div>
            <div style={{ fontSize:12,color:T.danger,marginTop:6,fontWeight:700,fontFamily:P }}>⏱ Expires in 72 hours</div>
          </div>
          <div style={{ background:T.bg,borderRadius:12,padding:16,marginBottom:18,border:`1px solid ${T.border}` }}>
            <div style={{ fontSize:11,color:T.muted,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:10,fontFamily:P }}>Bank Transfer Details</div>
            {[["Bank","First Bank of Nigeria"],["Account Name","ACOB Lighting Technology Ltd"],["Account Number","2047839201"],["Amount","₦200,000.00"],["Reference / Narration","FND-20250416-000013"]].map(([k,v]) => (
              <div key={k} style={{ display:"flex",justifyContent:"space-between",padding:"6px 0",borderBottom:`1px solid ${T.border}`,fontSize:13 }}>
                <span style={{ color:T.muted,fontFamily:P }}>{k}</span>
                <span style={{ fontWeight:k==="Reference / Narration"?800:600,color:k==="Reference / Narration"?T.primary:T.text,fontFamily:k==="Reference / Narration"||k==="Account Number"?M:P,display:"flex",alignItems:"center",gap:6 }}>
                  {v}{(k==="Reference / Narration"||k==="Account Number")&&<Copy size={11} color={T.faint} style={{ cursor:"pointer" }}/>}
                </span>
              </div>
            ))}
          </div>
          <div style={{ marginBottom:16 }}>
            <label style={{ display:"block",fontSize:12,fontWeight:600,color:T.muted,marginBottom:6,fontFamily:P }}>Upload Payment Proof *</label>
            <div style={{ border:`2px dashed ${T.border2}`,borderRadius:12,padding:26,textAlign:"center",cursor:"pointer",transition:"all 0.2s" }} onMouseOver={e=>e.currentTarget.style.borderColor=T.primary} onMouseOut={e=>e.currentTarget.style.borderColor=T.border2}>
              <Upload size={26} color={T.faint} style={{ margin:"0 auto 10px",display:"block" }}/>
              <div style={{ fontSize:13,color:T.muted,fontFamily:P }}>Drop file here or click to browse</div>
              <div style={{ fontSize:11,color:T.faint,marginTop:4,fontFamily:P }}>PDF, JPG or PNG · max 5 MB</div>
            </div>
          </div>
          <Btn full onClick={()=>setStep(3)}>Submit Proof for Review</Btn>
        </div>
      )}

      {step===3 && (
        <div style={{ background:T.surface,border:`1px solid ${T.border}`,borderRadius:16,padding:32,textAlign:"center" }} className="fadeIn">
          <div style={{ width:58,height:58,background:T.successBg,border:`1px solid #b7dfc8`,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 16px",animation:"glowGreen 2s ease-in-out infinite" }}>
            <CheckCircle2 size={30} color={T.primary}/>
          </div>
          <div style={{ fontSize:20,fontWeight:800,color:T.text,marginBottom:8,fontFamily:P }}>Proof Submitted!</div>
          <div style={{ fontSize:13,color:T.muted,maxWidth:380,margin:"0 auto 20px",lineHeight:1.75,fontFamily:P }}>
            <strong>FND-20250416-000013</strong> is under review by finance. Your wallet balance will be credited after admin approval — typically within 2 hours. <strong>No token is issued for funding.</strong>
          </div>
          <InfoBox type="success">Finance will verify your transfer proof, then post a <code>funding_credit</code> journal to your wallet ledger.</InfoBox>
          <div style={{ marginTop:18 }}><Btn variant="outline" full onClick={()=>setStep(1)}>Submit Another Request</Btn></div>
        </div>
      )}
    </div>
  );
}

/* ─── VENDOR: TRANSACTIONS ──────────────────────────────────────────────────── */
function VTransactions() {
  const [filter, setFilter] = useState("all");
  const filtered = filter==="all"?TXNS:TXNS.filter(t=>filter==="debit"?t.amount<0:filter==="credit"?t.amount>0:t.status===filter);
  const bals = [487250,482250,479250,285250,277250,274750,274750];
  return (
    <div style={{ padding:24 }} className="fadeUp">
      <div style={{ display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:20 }}>
        <div>
          <div style={{ fontFamily:P,fontWeight:800,fontSize:22,color:T.text }}>Transactions</div>
          <div style={{ fontSize:13,color:T.muted,marginTop:2,fontFamily:P }}>All wallet activity — credits, debits, reversals</div>
        </div>
        <Btn variant="outline" size="sm"><Download size={12}/> Export CSV</Btn>
      </div>
      <div style={{ display:"flex",gap:8,marginBottom:16,flexWrap:"wrap" }}>
        {[["all","All"],["debit","Debits"],["credit","Credits"],["successful","Successful"],["failed","Failed"]].map(([v,l]) => (
          <button key={v} onClick={()=>setFilter(v)} style={{ padding:"5px 14px",borderRadius:20,fontSize:12,cursor:"pointer",border:`1px solid ${filter===v?T.primary:T.border}`,background:filter===v?T.primaryLight:T.surface,color:filter===v?T.primary:T.muted,fontWeight:filter===v?700:400,fontFamily:P,transition:"all 0.15s" }}>{l}</button>
        ))}
      </div>
      <div style={{ background:T.surface,border:`1px solid ${T.border}`,borderRadius:14,overflowX:"auto" }}>
        <table style={{ width:"100%",borderCollapse:"collapse" }}>
          <thead><tr><Th>Date</Th><Th>Reference</Th><Th>Description</Th><Th>Method</Th><Th>Debit</Th><Th>Credit</Th><Th>Balance After</Th><Th>Status</Th></tr></thead>
          <tbody>
            {filtered.map((t,i) => (
              <tr key={t.id} className="row-hover">
                <Td muted>{t.date}</Td>
                <Td mono><span style={{ color:T.primary }}>{t.ref}</span></Td>
                <Td>{t.desc}</Td>
                <Td>{t.method?<Badge variant={t.method==="remote_send"?"info":"success"}>{t.method==="remote_send"?"Remote Send":"Token"}</Badge>:<Badge variant="lemon">Funding</Badge>}</Td>
                <Td danger>{t.amount<0?NGN(Math.abs(t.amount)):"—"}</Td>
                <Td success>{t.amount>0?NGN(t.amount):"—"}</Td>
                <Td mono bold>{NGN(bals[i]||280000)}</Td>
                <Td><Badge variant={t.status==="successful"||t.status==="posted"?"success":t.status==="reversed"?"info":"danger"}>{t.status}</Badge></Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ─── VENDOR: RECEIPTS ──────────────────────────────────────────────────────── */
function VReceipts({ setModal }) {
  const receipts = TXNS.filter(t=>t.receipt);
  return (
    <div style={{ padding:24 }} className="fadeUp">
      <div style={{ marginBottom:20 }}>
        <div style={{ fontFamily:P,fontWeight:800,fontSize:22,color:T.text }}>Receipts</div>
        <div style={{ fontSize:13,color:T.muted,marginTop:2,fontFamily:P }}>Vending receipts only — issued after unit purchase, not after funding</div>
      </div>
      <div style={{ display:"grid",gridTemplateColumns:"repeat(auto-fill, minmax(270px,1fr))",gap:14 }}>
        {receipts.map(t => (
          <div key={t.id} className="card-lift" onClick={()=>setModal("receipt")} style={{ background:T.surface,border:`1px solid ${T.border}`,borderRadius:14,padding:18,cursor:"pointer",transition:"all 0.2s" }}
            onMouseOver={e=>{e.currentTarget.style.borderColor=T.primary;e.currentTarget.style.boxShadow=`0 0 0 2px ${T.primaryLight}`;}} onMouseOut={e=>{e.currentTarget.style.borderColor=T.border;e.currentTarget.style.boxShadow="none";}}>
            <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12 }}>
              <div>
                <div style={{ fontSize:11,color:T.muted,fontFamily:M }}>{t.receipt}</div>
                <div style={{ fontSize:14,fontWeight:700,color:T.text,marginTop:3,fontFamily:P }}>{t.desc.split("—")[1]?.trim()||"Purchase"}</div>
              </div>
              <Badge variant={t.method==="remote_send"?"info":"success"}>{t.method==="remote_send"?"Remote Send":"Token"}</Badge>
            </div>
            <div style={{ display:"flex",justifyContent:"space-between",fontSize:13,fontFamily:P }}>
              <span style={{ color:T.muted }}>{t.date.split(",")[0]}</span>
              <span style={{ fontWeight:800,color:T.text }}>{NGN(Math.abs(t.amount))}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── VENDOR: STATEMENT ─────────────────────────────────────────────────────── */
function VStatement() {
  const bals=[487250,482250,479250,285250,277250,274750,274750];
  return (
    <div style={{ padding:24 }} className="fadeUp">
      <div style={{ marginBottom:20 }}>
        <div style={{ fontFamily:P,fontWeight:800,fontSize:22,color:T.text }}>Wallet Statement</div>
        <div style={{ fontSize:13,color:T.muted,marginTop:2,fontFamily:P }}>Download or view full wallet statement</div>
      </div>
      <div style={{ background:T.surface,border:`1px solid ${T.border}`,borderRadius:14,padding:22,maxWidth:560,marginBottom:18 }}>
        <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:12 }}>
          <FI label="From Date" type="date" defaultValue="2025-04-01"/>
          <FI label="To Date"   type="date" defaultValue="2025-04-16"/>
        </div>
        <FS label="Format"><option>CSV</option><option>PDF</option></FS>
        <Btn full><Download size={13}/> Download Statement</Btn>
      </div>
      <div style={{ background:T.surface,border:`1px solid ${T.border}`,borderRadius:14,overflowX:"auto" }}>
        <div style={{ padding:"14px 20px",borderBottom:`1px solid ${T.border}`,fontSize:14,fontWeight:700,color:T.text,fontFamily:P }}>Preview — 1 Apr to 16 Apr 2025</div>
        <table style={{ width:"100%",borderCollapse:"collapse" }}>
          <thead><tr><Th>Date / Time</Th><Th>Reference</Th><Th>Type</Th><Th>Description</Th><Th>Debit (₦)</Th><Th>Credit (₦)</Th><Th>Balance After</Th></tr></thead>
          <tbody>
            {TXNS.map((t,i) => (
              <tr key={t.id} className="row-hover">
                <Td muted>{t.date}</Td>
                <Td mono><span style={{ color:T.primary }}>{t.ref}</span></Td>
                <Td><Badge variant={t.amount<0?"danger":t.amount>0?"success":"gray"}>{t.amount<0?"Debit":t.amount>0?"Credit":"—"}</Badge></Td>
                <Td>{t.desc}</Td>
                <Td danger>{t.amount<0?NGN(Math.abs(t.amount)):"—"}</Td>
                <Td success>{t.amount>0?NGN(t.amount):"—"}</Td>
                <Td mono bold>{NGN(bals[i]||280000)}</Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ─── VENDOR: PROFILE ───────────────────────────────────────────────────────── */
function VProfile() {
  return (
    <div style={{ padding:24,maxWidth:620 }} className="fadeUp">
      <div style={{ marginBottom:20 }}>
        <div style={{ fontFamily:P,fontWeight:800,fontSize:22,color:T.text }}>My Profile</div>
        <div style={{ fontSize:13,color:T.muted,marginTop:2,fontFamily:P }}>Account details and KYC — read only</div>
      </div>
      {[{section:"Account Information",rows:[["Vendor Name","Bright Future Electrical"],["Vendor Code","VND-001"],["Site","Lagos North"],["Wallet Number","WLT-LGN-000042"],["Account Status","Active"]]},{section:"Contact Details",rows:[["Primary Phone","08012345678"],["Email","accounts@brightfuture.ng"],["Contact Person","Emeka Bright"]]},{section:"KYC Status",rows:[["KYC Status","Approved"],["CAC Number","RC-0923847"],["Tax ID (TIN)","12938471-0001"],["KYC Approved","2 Mar 2025"],["KYC Expiry","2 Mar 2026"]]}].map(({section,rows}) => (
        <div key={section} style={{ background:T.surface,border:`1px solid ${T.border}`,borderRadius:14,marginBottom:16 }}>
          <div style={{ padding:"12px 20px",borderBottom:`1px solid ${T.border}`,fontSize:13,fontWeight:700,color:T.text,background:T.surface2,borderRadius:"14px 14px 0 0",fontFamily:P }}>{section}</div>
          <div style={{ padding:"0 20px" }}>
            {rows.map(([k,v]) => (
              <div key={k} style={{ display:"flex",justifyContent:"space-between",padding:"11px 0",borderBottom:`1px solid ${T.border}`,fontSize:13 }}>
                <span style={{ color:T.muted,fontFamily:P }}>{k}</span>
                <span style={{ fontWeight:600,color:k==="Account Status"||k==="KYC Status"?T.success:T.text,fontFamily:P }}>{v}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ─── ADMIN: DASHBOARD ──────────────────────────────────────────────────────── */
function ADashboard({ setView }) {
  const bars=[52,68,44,79,63,88,55,91,74,96,81,70,87,73];
  return (
    <div style={{ padding:24 }} className="fadeUp">
      <div style={{ marginBottom:22 }}>
        <div style={{ fontFamily:P,fontWeight:800,fontSize:24,color:T.text }}>Finance Dashboard</div>
        <div style={{ fontSize:13,color:T.muted,marginTop:3,fontFamily:P }}>16 April 2025, 10:14 WAT &nbsp;·&nbsp; <span style={{ color:T.success,fontWeight:600,display:"inline-flex",alignItems:"center",gap:4 }}><span style={{ width:7,height:7,borderRadius:"50%",background:T.success,display:"inline-block",animation:"pulse 2s ease-in-out infinite" }}/>Reconciliation engine active</span></div>
      </div>
      <div style={{ display:"grid",gridTemplateColumns:"repeat(4,minmax(0,1fr))",gap:12,marginBottom:22 }}>
        <KPI label="Total Vendor Float"  value={NGN(2017650)} sub="4 active wallets"   icon={Wallet}       accent={T.successBg} />
        <KPI label="Total Reserved"       value={NGN(165000)}  sub="3 in-flight orders" icon={Clock}        valueColor={T.warning} accent={T.warningBg} />
        <KPI label="Today's Purchases"    value={NGN(312500)}  sub="47 transactions"    icon={TrendingUp}   valueColor={T.primary} accent={T.primaryLight} />
        <KPI label="Open Exceptions"      value="3"            sub={<><span style={{ color:T.danger,fontWeight:700 }}>1 critical</span> · 1 high · 1 medium</>} icon={AlertTriangle} valueColor={T.danger} accent={T.dangerBg} />
      </div>
      <div style={{ display:"grid",gridTemplateColumns:"2fr 1fr",gap:16,marginBottom:18 }}>
        <div style={{ background:T.surface,border:`1px solid ${T.border}`,borderRadius:14,padding:22 }}>
          <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16 }}>
            <div style={{ fontSize:15,fontWeight:700,color:T.text,fontFamily:P }}>Purchase Volume — Last 14 Days</div>
            <Badge variant="success" dot>₦2.8M total</Badge>
          </div>
          <div style={{ display:"flex",alignItems:"flex-end",gap:5,height:110 }}>
            {bars.map((h,i) => <div key={i} style={{ flex:1,borderRadius:"3px 3px 0 0",height:`${h}%`,background:i===bars.length-1?T.primary:"#b7dfc8",cursor:"pointer",transition:"opacity 0.2s" }} onMouseOver={e=>e.currentTarget.style.opacity="0.7"} onMouseOut={e=>e.currentTarget.style.opacity="1"}/>)}
          </div>
          <div style={{ display:"flex",justifyContent:"space-between",fontSize:10,color:T.faint,marginTop:8,fontFamily:M }}><span>3 Apr</span><span>16 Apr (today)</span></div>
        </div>
        <div style={{ background:T.surface,border:`1px solid ${T.border}`,borderRadius:14,padding:22 }}>
          <div style={{ fontSize:15,fontWeight:700,color:T.text,marginBottom:16,fontFamily:P }}>Wallets Near Exhaustion</div>
          {[{name:"Sunco Vending",bal:92400,pct:18},{name:"Apex Energy",bal:34100,pct:7}].map(w => (
            <div key={w.name} style={{ marginBottom:16 }}>
              <div style={{ display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:5,fontFamily:P }}>
                <span style={{ color:T.text,fontWeight:600 }}>{w.name}</span>
                <span style={{ color:w.pct<20?T.danger:T.muted,fontWeight:700 }}>{NGN(w.bal)}</span>
              </div>
              <div style={{ height:6,background:T.bg,borderRadius:3 }}><div style={{ height:6,width:`${w.pct}%`,background:w.pct<20?T.danger:T.primary,borderRadius:3 }}/></div>
              <div style={{ fontSize:10,color:T.faint,marginTop:3,fontFamily:P }}>{w.pct}% of limit</div>
            </div>
          ))}
          <Btn variant="ghost" size="sm" full onClick={()=>setView("a-wallets")}>View all wallets →</Btn>
        </div>
      </div>
      <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:16 }}>
        <div style={{ background:T.surface,border:`1px solid ${T.border}`,borderRadius:14,padding:22 }}>
          <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16 }}>
            <div style={{ fontSize:15,fontWeight:700,color:T.text,fontFamily:P }}>Funding & Manual Credits</div>
            <Btn variant="lemon" size="sm" onClick={()=>setView("a-funding")}>View queue</Btn>
          </div>
          {FUNDING_QUEUE.filter(f=>f.status!=="posted").slice(0,2).map(r => (
            <div key={r.ref} style={{ display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 12px",background:T.bg,borderRadius:10,marginBottom:8,border:`1px solid ${T.border}` }}>
              <div>
                <div style={{ fontSize:13,fontWeight:700,color:T.text,fontFamily:P }}>{r.vendor}</div>
                <div style={{ fontSize:11,color:T.muted,marginTop:2,fontFamily:P }}>{r.submitted} · {r.channel}</div>
              </div>
              <div style={{ textAlign:"right" }}>
                <div style={{ fontSize:15,fontWeight:800,color:T.text,fontFamily:P }}>{NGN(r.amt)}</div>
                <Badge variant="lemon">{r.status.replace("_"," ")}</Badge>
              </div>
            </div>
          ))}
          <div style={{ padding:"10px 12px",background:T.lemonLight,borderRadius:10,border:`1px solid ${T.lemon}`,marginBottom:0 }}>
            <div style={{ fontSize:12,fontWeight:700,color:T.lemonText,marginBottom:2,display:"flex",alignItems:"center",gap:6,fontFamily:P }}><PenLine size={12}/>Manual Credit — MCR-001</div>
            <div style={{ fontSize:11,color:T.lemonText,fontFamily:P }}>Bright Future · ₦50,000 — awaiting 2nd approver</div>
          </div>
        </div>
        <div style={{ background:T.surface,border:`1px solid ${T.border}`,borderRadius:14,padding:22 }}>
          <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16 }}>
            <div style={{ fontSize:15,fontWeight:700,color:T.text,fontFamily:P }}>Open Exceptions</div>
            <Btn variant="ghost" size="sm" onClick={()=>setView("a-exceptions")}>View all →</Btn>
          </div>
          {EXCEPTIONS.map(e => (
            <div key={e.id} style={{ padding:"10px 0",borderBottom:`1px solid ${T.border}`,display:"flex",gap:10,alignItems:"flex-start" }}>
              <Badge variant={e.sev==="critical"?"danger":e.sev==="high"?"warning":"info"}>{e.sev.toUpperCase()}</Badge>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:12,fontWeight:700,color:T.text,marginBottom:2,fontFamily:P }}>{e.vendor}</div>
                <div style={{ fontSize:11,color:T.muted,lineHeight:1.5,fontFamily:P }}>{e.desc.substring(0,55)}…</div>
              </div>
              <div style={{ fontSize:10,color:T.faint,whiteSpace:"nowrap",fontFamily:P }}>SLA: {e.sla}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── ADMIN: VENDORS ────────────────────────────────────────────────────────── */
function AVendors({ setModal }) {
  const [tab, setTab] = useState("all");
  const tabs=["all","active","pending_review","suspended"];
  const filtered=tab==="all"?VENDORS_DATA:VENDORS_DATA.filter(v=>v.status===tab);
  return (
    <div style={{ padding:24 }} className="fadeUp">
      <div style={{ display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:20 }}>
        <div>
          <div style={{ fontFamily:P,fontWeight:800,fontSize:22,color:T.text }}>Vendors</div>
          <div style={{ fontSize:13,color:T.muted,marginTop:2,fontFamily:P }}>Manage vendor accounts, KYC, and site assignments</div>
        </div>
        <Btn onClick={()=>setModal("create-vendor")}><Plus size={13}/> Create Vendor Account</Btn>
      </div>
      <div style={{ display:"flex",gap:6,marginBottom:16 }}>
        {tabs.map(t => <button key={t} onClick={()=>setTab(t)} style={{ padding:"5px 14px",borderRadius:20,fontSize:12,cursor:"pointer",background:tab===t?T.sidebarBg:T.surface,color:tab===t?"#fff":T.muted,border:`1px solid ${tab===t?T.sidebarBg:T.border}`,fontWeight:tab===t?700:400,fontFamily:P,transition:"all 0.15s" }}>{t==="all"?"All":t==="pending_review"?"Pending Review":t.charAt(0).toUpperCase()+t.slice(1)}</button>)}
      </div>
      <div style={{ background:T.surface,border:`1px solid ${T.border}`,borderRadius:14,overflowX:"auto" }}>
        <table style={{ width:"100%",borderCollapse:"collapse" }}>
          <thead><tr><Th>Vendor</Th><Th>Code</Th><Th>Site</Th><Th>Status</Th><Th>KYC</Th><Th>Balance</Th><Th>Txns</Th><Th>Risk</Th><Th>Actions</Th></tr></thead>
          <tbody>
            {filtered.map(v => (
              <tr key={v.id} className="row-hover">
                <Td><div style={{ fontWeight:700,color:T.text,fontFamily:P }}>{v.name}</div><div style={{ fontSize:11,color:T.muted,fontFamily:P }}>{v.contact} · {v.joined}</div></Td>
                <Td mono>{v.code}</Td>
                <Td muted>{v.site}</Td>
                <Td><Badge dot variant={v.status==="active"?"success":v.status==="pending_review"?"warning":"danger"}>{v.status.replace("_"," ")}</Badge></Td>
                <Td><Badge variant={v.kyc==="approved"?"success":v.kyc==="submitted"?"info":"gray"}>{v.kyc}</Badge></Td>
                <Td bold>{v.balance>0?NGN(v.balance):"—"}</Td>
                <Td muted>{v.txns}</Td>
                <Td><span style={{ fontWeight:700,color:v.risk==="low"?T.success:v.risk==="medium"?T.warning:T.danger,textTransform:"uppercase",fontSize:11,fontFamily:P }}>{v.risk}</span></Td>
                <td style={{ padding:"10px 16px",borderBottom:`1px solid ${T.border}` }}>
                  <div style={{ display:"flex",gap:6 }}>
                    {v.status==="pending_review" && <Btn variant="lemon" size="xs" onClick={()=>setModal("approve-vendor")}>Review</Btn>}
                    {v.status==="active"         && <Btn variant="ghost" size="xs" onClick={()=>setModal("view-vendor")}><Eye size={10}/> View</Btn>}
                    {v.status==="suspended"      && <Btn variant="subtle" size="xs">Reactivate</Btn>}
                    {v.status==="active"         && <Btn variant="ghost" size="xs">Suspend</Btn>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ─── ADMIN: ALL WALLETS ────────────────────────────────────────────────────── */
function AWallets({ setModal }) {
  return (
    <div style={{ padding:24 }} className="fadeUp">
      <div style={{ marginBottom:22 }}>
        <div style={{ fontFamily:P,fontWeight:800,fontSize:22,color:T.text }}>All Wallets</div>
        <div style={{ fontSize:13,color:T.muted,marginTop:2,fontFamily:P }}>Balances and status. Manual credits require maker-checker approval.</div>
      </div>
      <div style={{ display:"grid",gridTemplateColumns:"repeat(4,minmax(0,1fr))",gap:12,marginBottom:22 }}>
        <KPI label="Total Float"       value={NGN(2017650)} icon={Wallet}       accent={T.successBg} />
        <KPI label="Total Reserved"     value={NGN(165000)}  icon={Clock}        valueColor={T.warning} accent={T.warningBg} />
        <KPI label="Active Wallets"     value="4 / 5"        icon={CheckCircle2} valueColor={T.success} accent={T.successBg} />
        <KPI label="Manual Cr. Pending" value="1"            icon={PenLine}      valueColor={T.lemonDark} accent={T.lemonLight} />
      </div>
      <InfoBox type="lemon"><strong>Admin Credit Policy:</strong> Admins cannot directly edit wallet balances. Credits are posted either via approved vendor funding requests or via the maker-checker manual credit flow (two separate admins required).</InfoBox>
      <div style={{ height:16 }}/>
      <div style={{ display:"flex",flexDirection:"column",gap:14 }}>
        {VENDORS_DATA.filter(v=>v.status!=="pending_review").map(v => (
          <div key={v.id} style={{ background:T.surface,border:`1px solid ${T.border}`,borderRadius:14,padding:22 }}>
            <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:16 }}>
              <div>
                <div style={{ fontSize:16,fontWeight:800,color:T.text,fontFamily:P }}>{v.name}</div>
                <div style={{ fontSize:12,color:T.muted,marginTop:2,fontFamily:P }}>{v.code} · {v.site}</div>
              </div>
              <Badge dot variant={v.status==="active"?"success":"danger"}>{v.status}</Badge>
            </div>
            <div style={{ display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginBottom:16 }}>
              {[{lbl:"Available Balance",val:NGN(v.balance-v.reserved),color:T.text},{lbl:"Posted Float",val:NGN(v.balance),color:T.text},{lbl:"Reserved",val:NGN(v.reserved),color:v.reserved>0?T.warning:T.muted},{lbl:"Risk Rating",val:v.risk.toUpperCase(),color:v.risk==="low"?T.success:v.risk==="medium"?T.warning:T.danger}].map(({lbl,val,color}) => (
                <div key={lbl} style={{ background:T.bg,borderRadius:10,padding:"12px 14px",border:`1px solid ${T.border}` }}>
                  <div style={{ fontSize:10,color:T.faint,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:5,fontFamily:P,fontWeight:600 }}>{lbl}</div>
                  <div style={{ fontSize:16,fontWeight:800,color,fontFamily:P }}>{val}</div>
                </div>
              ))}
            </div>
            <div style={{ display:"flex",gap:8 }}>
              <Btn variant="ghost" size="sm">View Ledger</Btn>
              <Btn variant="ghost" size="sm">Transactions</Btn>
              {v.status==="active" && <Btn variant="lemon" size="sm" onClick={()=>setModal("manual-credit-request")}><PenLine size={11}/> Request Manual Credit</Btn>}
              {v.status==="active" && <Btn variant="danger" size="sm" onClick={()=>setModal("freeze-wallet")}><Lock size={11}/> Freeze</Btn>}
              {v.status==="suspended" && <Btn variant="subtle" size="sm"><Unlock size={11}/> Unfreeze</Btn>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── ADMIN: FUNDING & CREDITS (normal approval + maker-checker) ────────────── */
function AFunding({ setModal }) {
  const [tab, setTab]   = useState("funding");
  const [items, setItems] = useState(FUNDING_QUEUE);
  const [mcItems, setMcItems] = useState(MANUAL_CREDIT_REQUESTS);
  const [busy, setBusy] = useState(null);

  const approveF = ref => { setBusy(ref); setTimeout(()=>{ setItems(p=>p.map(f=>f.ref===ref?{...f,status:"posted"}:f)); setBusy(null); },900); };
  const approveMc = id => { setBusy(id); setTimeout(()=>{ setMcItems(p=>p.map(m=>m.id===id?{...m,status:"approved",checkerApproval:"admin-checker-2",approvedAt:"16 Apr, 10:20"}:m)); setBusy(null); },900); };

  return (
    <div style={{ padding:24 }} className="fadeUp">
      <div style={{ display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:20 }}>
        <div>
          <div style={{ fontFamily:P,fontWeight:800,fontSize:22,color:T.text }}>Funding & Manual Credits</div>
          <div style={{ fontSize:13,color:T.muted,marginTop:2,fontFamily:P }}>Vendor funding approvals · Maker-checker manual credit queue</div>
        </div>
        <Badge variant="lemon" size="lg" dot>3 pending</Badge>
      </div>

      {/* Tabs */}
      <div style={{ display:"flex",gap:0,marginBottom:20,borderBottom:`1px solid ${T.border}` }}>
        {[["funding","Vendor Funding Requests"],["manual_credits","Manual Credit Requests (Maker-Checker)"]].map(([v,l]) => (
          <button key={v} onClick={()=>setTab(v)} style={{ padding:"10px 20px",borderBottom:tab===v?`2px solid ${T.primary}`:"2px solid transparent",background:"none",border:"none",borderBottom:tab===v?`2px solid ${T.primary}`:"2px solid transparent",color:tab===v?T.primary:T.muted,fontSize:13,fontWeight:tab===v?700:400,cursor:"pointer",fontFamily:P,transition:"all 0.15s" }}>{l}</button>
        ))}
      </div>

      {tab==="funding" && (
        <>
          <div style={{ background:T.surface,border:`1px solid ${T.border}`,borderRadius:14,overflowX:"auto" }}>
            <table style={{ width:"100%",borderCollapse:"collapse" }}>
              <thead><tr><Th>Reference</Th><Th>Vendor</Th><Th>Amount</Th><Th>Channel</Th><Th>Bank Ref</Th><Th>Submitted</Th><Th>Status</Th><Th>Actions</Th></tr></thead>
              <tbody>
                {items.map(r => (
                  <tr key={r.ref} className="row-hover">
                    <Td mono><span style={{ color:T.primary,fontSize:11 }}>{r.ref}</span></Td>
                    <Td bold>{r.vendor}</Td>
                    <Td bold>{NGN(r.amt)}</Td>
                    <Td muted>{r.channel}</Td>
                    <Td mono>{r.bankRef}</Td>
                    <Td muted>{r.submitted}</Td>
                    <Td><Badge variant={r.status==="posted"?"success":r.status==="under_review"?"warning":"info"}>{r.status.replace(/_/g," ")}</Badge></Td>
                    <td style={{ padding:"10px 16px",borderBottom:`1px solid ${T.border}` }}>
                      {r.status!=="posted"?(
                        <div style={{ display:"flex",gap:6 }}>
                          <Btn variant="ghost" size="xs"><Eye size={10}/> Proof</Btn>
                          <Btn variant="lemon" size="xs" onClick={()=>setModal("approve-funding")}>Review</Btn>
                          <Btn variant="subtle" size="xs" onClick={()=>approveF(r.ref)} disabled={busy===r.ref} style={{ color:T.success }}>
                            {busy===r.ref?"…":<><Check size={10}/> Approve</>}
                          </Btn>
                        </div>
                      ):<span style={{ color:T.muted,fontSize:12,display:"flex",alignItems:"center",gap:4,fontFamily:P }}><CheckCircle2 size={13} color={T.success}/> Posted to wallet</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ marginTop:14 }}>
            <InfoBox type="info">Approving a funding request posts a <code>funding_credit</code> journal to the vendor's wallet ledger and increases their balance. Finance must verify the bank proof before approving.</InfoBox>
          </div>
        </>
      )}

      {tab==="manual_credits" && (
        <>
          <InfoBox type="lemon">
            <strong>Maker-Checker Flow:</strong> An internal user (maker) submits a manual credit request. A <em>different</em> admin (checker) must approve it. No admin can approve their own request. After checker approval, a <code>manual_credit</code> journal is posted to the wallet ledger automatically.
          </InfoBox>
          <div style={{ height:14 }}/>
          <div style={{ background:T.surface,border:`1px solid ${T.border}`,borderRadius:14,overflowX:"auto" }}>
            <table style={{ width:"100%",borderCollapse:"collapse" }}>
              <thead><tr><Th>Request ID</Th><Th>Vendor</Th><Th>Amount</Th><Th>Reason</Th><Th>Maker</Th><Th>Requested At</Th><Th>Status</Th><Th>Actions</Th></tr></thead>
              <tbody>
                {mcItems.map(m => (
                  <tr key={m.id} className="row-hover">
                    <Td mono><span style={{ color:T.lemonDark,fontWeight:700,fontSize:11 }}>{m.id}</span></Td>
                    <Td bold>{m.vendor}<div style={{ fontSize:10,color:T.muted,fontFamily:P }}>{m.code}</div></Td>
                    <Td bold>{NGN(m.amount)}</Td>
                    <Td><span style={{ fontSize:12,color:T.muted,fontFamily:P }}>{m.reason.substring(0,55)}…</span></Td>
                    <Td mono>{m.requestedBy}</Td>
                    <Td muted>{m.requestedAt}</Td>
                    <Td><Badge variant={m.status==="approved"?"success":"lemon"}>{m.status==="pending_checker"?"Awaiting Checker":"Approved & Posted"}</Badge></Td>
                    <td style={{ padding:"10px 16px",borderBottom:`1px solid ${T.border}` }}>
                      {m.status==="pending_checker"?(
                        <div style={{ display:"flex",gap:6 }}>
                          <Btn variant="ghost" size="xs" onClick={()=>setModal("approve-manual-credit")}><Eye size={10}/> Review</Btn>
                          <Btn variant="primary" size="xs" onClick={()=>approveMc(m.id)} disabled={busy===m.id} style={{ background:T.success }}>
                            {busy===m.id?"…":<><BadgeCheck size={10}/> Approve as Checker</>}
                          </Btn>
                        </div>
                      ):<span style={{ color:T.muted,fontSize:12,display:"flex",alignItems:"center",gap:4,fontFamily:P }}><CheckCircle2 size={13} color={T.success}/> Posted · {m.checkerApproval}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

/* ─── ADMIN: PURCHASES ──────────────────────────────────────────────────────── */
function APurchases({ setModal }) {
  return (
    <div style={{ padding:24 }} className="fadeUp">
      <div style={{ marginBottom:22 }}>
        <div style={{ fontFamily:P,fontWeight:800,fontSize:22,color:T.text }}>Purchase Monitor</div>
        <div style={{ fontSize:13,color:T.muted,marginTop:2,fontFamily:P }}>All vendor purchase orders (generate-token & remote-send) across all sites</div>
      </div>
      <div style={{ display:"grid",gridTemplateColumns:"repeat(4,minmax(0,1fr))",gap:12,marginBottom:22 }}>
        <KPI label="Today's Total"   value={NGN(312500)} icon={TrendingUp}   valueColor={T.primary} accent={T.primaryLight} />
        <KPI label="Successful"      value="44"          icon={CheckCircle2} valueColor={T.success} accent={T.successBg} />
        <KPI label="Failed"          value="3"           icon={XCircle}      valueColor={T.danger}  accent={T.dangerBg} />
        <KPI label="Reversal Rate"   value="1.2%"        icon={RefreshCw} />
      </div>
      <div style={{ background:T.surface,border:`1px solid ${T.border}`,borderRadius:14,overflowX:"auto" }}>
        <table style={{ width:"100%",borderCollapse:"collapse" }}>
          <thead><tr><Th>Order ID</Th><Th>Date</Th><Th>Vendor</Th><Th>Meter SN</Th><Th>Delivery</Th><Th>Amount</Th><Th>Status</Th><Th>Receipt</Th></tr></thead>
          <tbody>
            {PURCHASES_ALL.map(p => (
              <tr key={p.id} className="row-hover">
                <Td mono><span style={{ color:T.primary }}>{p.id}</span></Td>
                <Td muted>{p.date}</Td>
                <Td>{p.vendor}</Td>
                <Td mono>{p.meter}</Td>
                <Td>
                  {p.method==="remote_send"
                    ? <Badge variant="info">Remote Send</Badge>
                    : <Badge variant="success">Token (20-digit)</Badge>}
                </Td>
                <Td bold>{NGN(p.amount)}</Td>
                <Td><Badge dot variant={p.status==="successful"?"success":"danger"}>{p.status}</Badge></Td>
                <Td>{p.receipt?<Btn variant="ghost" size="xs" onClick={()=>setModal("receipt")}><Eye size={10}/> View</Btn>:"—"}</Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ─── ADMIN: EXCEPTIONS ─────────────────────────────────────────────────────── */
function AExceptions({ setModal }) {
  const [items] = useState(EXCEPTIONS);
  const [sev, setSev] = useState("all");
  const filtered = sev==="all"?items:items.filter(e=>e.sev===sev);
  return (
    <div style={{ padding:24 }} className="fadeUp">
      <div style={{ display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:22 }}>
        <div>
          <div style={{ fontFamily:P,fontWeight:800,fontSize:22,color:T.text }}>Exception Board</div>
          <div style={{ fontSize:13,color:T.muted,marginTop:2,fontFamily:P }}>Reconciliation exceptions, SLA tracking, and resolution</div>
        </div>
        <Btn variant="outline"><RefreshCw size={13}/> Run Reconciliation</Btn>
      </div>
      <div style={{ display:"grid",gridTemplateColumns:"repeat(4,minmax(0,1fr))",gap:12,marginBottom:22 }}>
        {[{label:"Critical",val:1,color:T.danger,sub:"SLA: 15 min",accent:T.dangerBg},{label:"High",val:1,color:T.warning,sub:"SLA: 1 hour",accent:T.warningBg},{label:"Medium",val:1,color:T.info,sub:"SLA: EOD",accent:T.infoBg},{label:"Total Open",val:3,color:T.text,sub:"0 resolved today"}].map(({label,val,color,sub,accent}) => (
          <KPI key={label} label={label} value={val} sub={sub} valueColor={color} icon={Flag} accent={accent}/>
        ))}
      </div>
      <div style={{ display:"flex",gap:6,marginBottom:16 }}>
        {[["all","All"],["critical","Critical"],["high","High"],["medium","Medium"]].map(([v,l]) => (
          <button key={v} onClick={()=>setSev(v)} style={{ padding:"5px 14px",borderRadius:20,fontSize:12,cursor:"pointer",background:sev===v?T.sidebarBg:T.surface,color:sev===v?"#fff":T.muted,border:`1px solid ${sev===v?T.sidebarBg:T.border}`,fontWeight:sev===v?700:400,fontFamily:P,transition:"all 0.15s" }}>{l}</button>
        ))}
      </div>
      <div style={{ display:"flex",flexDirection:"column",gap:12 }}>
        {filtered.map(e => (
          <div key={e.id} style={{ background:T.surface,border:`1px solid ${T.border}`,borderLeft:`4px solid ${e.sev==="critical"?T.danger:e.sev==="high"?T.warning:T.info}`,borderRadius:14,padding:20 }}>
            <div style={{ display:"flex",alignItems:"flex-start",justifyContent:"space-between" }}>
              <div style={{ flex:1 }}>
                <div style={{ display:"flex",alignItems:"center",gap:8,marginBottom:10,flexWrap:"wrap" }}>
                  <Badge variant={e.sev==="critical"?"danger":e.sev==="high"?"warning":"info"}>{e.sev.toUpperCase()}</Badge>
                  <span style={{ fontSize:11,fontFamily:M,color:T.primary,fontWeight:700 }}>{e.id}</span>
                  <span style={{ fontSize:11,fontFamily:M,color:T.muted }}>{e.type}</span>
                  <Badge variant={e.status==="open"?"danger":e.status==="assigned"?"lemon":"success"}>{e.status}</Badge>
                  {e.assignedTo && <span style={{ fontSize:11,color:T.muted,fontFamily:P }}>→ {e.assignedTo}</span>}
                </div>
                <div style={{ fontSize:15,fontWeight:700,color:T.text,marginBottom:5,fontFamily:P }}>{e.vendor} · {e.site}</div>
                <div style={{ fontSize:13,color:T.muted,marginBottom:8,lineHeight:1.65,fontFamily:P }}>{e.desc}</div>
                <div style={{ fontSize:11,color:T.faint,fontFamily:P }}>Created: {e.created} &nbsp;·&nbsp; SLA: <strong style={{ color:T.danger }}>{e.sla}</strong> &nbsp;·&nbsp; Ref: <span style={{ fontFamily:M }}>{e.ref}</span></div>
              </div>
              <div style={{ display:"flex",gap:6,flexShrink:0,marginLeft:18 }}>
                {e.status!=="resolved" && <><Btn variant="ghost" size="sm">Assign</Btn><Btn size="sm" onClick={()=>setModal("resolve-exception")}>Resolve</Btn></>}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── ADMIN: SETTLEMENT ─────────────────────────────────────────────────────── */
function ASettlement() {
  return (
    <div style={{ padding:24 }} className="fadeUp">
      <div style={{ marginBottom:20 }}>
        <div style={{ fontFamily:P,fontWeight:800,fontSize:22,color:T.text }}>Settlement</div>
        <div style={{ fontSize:13,color:T.muted,marginTop:2,fontFamily:P }}>Daily settlement batches and commission summaries</div>
      </div>
      <InfoBox type="info">Commission rate is currently <strong>0.00%</strong>. The commission engine is wired and activates automatically when finance configures a non-zero rate.</InfoBox>
      <div style={{ height:18 }}/>
      {SETTLEMENT_BATCHES.map(b => (
        <div key={`${b.date}-${b.site}`} style={{ background:T.surface,border:`1px solid ${T.border}`,borderRadius:14,padding:22,marginBottom:14 }}>
          <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:16 }}>
            <div>
              <div style={{ fontSize:16,fontWeight:800,color:T.text,fontFamily:P }}>{b.date} — {b.site}</div>
              <div style={{ fontSize:12,color:T.muted,marginTop:3,fontFamily:P }}>Commission: 0.00% (pending activation) · {b.txns} txns</div>
            </div>
            <Badge variant="success"><Lock size={10} style={{ marginRight:4 }}/>locked</Badge>
          </div>
          <div style={{ display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12 }}>
            {[{lbl:"Total Purchases",val:NGN(b.purchases),color:T.text},{lbl:"Commission",val:NGN(b.commission),color:T.muted},{lbl:"Transactions",val:b.txns,color:T.text},{lbl:"Exceptions",val:"0",color:T.success}].map(({lbl,val,color}) => (
              <div key={lbl} style={{ background:T.bg,borderRadius:10,padding:"12px 14px",border:`1px solid ${T.border}` }}>
                <div style={{ fontSize:10,color:T.faint,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:5,fontFamily:P,fontWeight:600 }}>{lbl}</div>
                <div style={{ fontSize:17,fontWeight:800,color,fontFamily:P }}>{val}</div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ─── ADMIN: AUDIT LOG ──────────────────────────────────────────────────────── */
function AAudit() {
  return (
    <div style={{ padding:24 }} className="fadeUp">
      <div style={{ display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:20 }}>
        <div>
          <div style={{ fontFamily:P,fontWeight:800,fontSize:22,color:T.text }}>Audit Log</div>
          <div style={{ fontSize:13,color:T.muted,marginTop:2,fontFamily:P }}>Immutable append-only record of all system events</div>
        </div>
        <Btn variant="outline" size="sm"><Download size={12}/> Export</Btn>
      </div>
      <InfoBox type="info">No policy permits UPDATE or DELETE on this table for any role, including service_role. Manual credit approvals appear as <code>manual_credit_approved</code> events.</InfoBox>
      <div style={{ height:16 }}/>
      <div style={{ background:T.surface,border:`1px solid ${T.border}`,borderRadius:14,overflowX:"auto" }}>
        <table style={{ width:"100%",borderCollapse:"collapse" }}>
          <thead><tr><Th>Time (WAT)</Th><Th>Actor</Th><Th>Role</Th><Th>Event</Th><Th>Target</Th><Th>IP</Th></tr></thead>
          <tbody>
            {AUDIT_EVENTS.map((e,i) => (
              <tr key={i} className="row-hover">
                <Td mono><span style={{ fontSize:12 }}>16 Apr {e.time}</span></Td>
                <Td bold>{e.actor}</Td>
                <Td><Badge variant={e.role==="admin"?"info":e.role==="system"?"purple":"success"}>{e.role}</Badge></Td>
                <Td mono><span style={{ fontSize:12,color:e.event.includes("manual_credit")?T.lemonDark:T.primary }}>{e.event}</span></Td>
                <Td mono><span style={{ fontSize:11,color:T.muted }}>{e.target}</span></Td>
                <Td muted>{e.ip}</Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ─── MODALS ────────────────────────────────────────────────────────────────── */
function MApproveVendor({ onClose }) {
  return (
    <Modal title="Review Vendor Application" subtitle="VND-004 · PowerPlus Distributors" onClose={onClose} wide
      footer={<><Btn variant="danger" onClick={onClose}>Reject</Btn><div style={{ flex:1 }}/><Btn variant="outline" onClick={onClose}>Cancel</Btn><Btn onClick={onClose}>Approve & Activate</Btn></>}>
      <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:16 }}>
        {[["Vendor Name","PowerPlus Distributors"],["Contact","08045678901"],["Site","Kano Central"],["CAC","RC-0948372"],["TIN","09384712-0001"],["Submitted","16 Apr 2025, 08:30"]].map(([k,v]) => (
          <div key={k} style={{ background:T.bg,borderRadius:10,padding:"12px 14px",border:`1px solid ${T.border}` }}>
            <div style={{ fontSize:11,color:T.muted,marginBottom:3,fontFamily:P }}>{k}</div>
            <div style={{ fontSize:13,fontWeight:700,color:T.text,fontFamily:P }}>{v}</div>
          </div>
        ))}
      </div>
      <div style={{ marginBottom:16 }}>
        {[["CAC Certificate","PDF · 2.1 MB","approved"],["Director's ID","PDF · 1.4 MB","approved"],["Utility Bill","PDF · 0.8 MB","pending"]].map(([n,s,st]) => (
          <div key={n} style={{ display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 14px",background:T.bg,borderRadius:10,marginBottom:8,border:`1px solid ${T.border}` }}>
            <div style={{ display:"flex",gap:10,alignItems:"center" }}><FileCheck size={15} color={T.primary}/><div><div style={{ fontSize:13,fontWeight:600,color:T.text,fontFamily:P }}>{n}</div><div style={{ fontSize:11,color:T.muted,fontFamily:P }}>{s}</div></div></div>
            <div style={{ display:"flex",gap:6 }}><Badge variant={st==="approved"?"success":"warning"}>{st}</Badge><Btn variant="ghost" size="xs"><Eye size={10}/> View</Btn></div>
          </div>
        ))}
      </div>
      <FT label="Review Note (optional)" placeholder="Add any notes…" style={{ height:70 }}/>
    </Modal>
  );
}

function MApproveFunding({ onClose }) {
  return (
    <Modal title="Review Funding Request" subtitle="FND-20250416-000012 · Approving credits wallet — no token issued" onClose={onClose}
      footer={<><Btn variant="danger" onClick={onClose}>Reject</Btn><div style={{ flex:1 }}/><Btn variant="outline" onClick={onClose}>Cancel</Btn><Btn onClick={onClose}>Approve & Post to Wallet</Btn></>}>
      <div style={{ background:T.bg,borderRadius:12,padding:16,marginBottom:16,border:`1px solid ${T.border}` }}>
        {[["Vendor","Bright Future Electrical (VND-001)"],["Amount","₦200,000.00"],["Channel","Bank Transfer"],["Bank Ref","FBN/2504160012"],["Submitted","16 Apr 2025, 09:15"],["Current Balance",NGN(AVAIL)]].map(([k,v]) => (
          <div key={k} style={{ display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:`1px solid ${T.border}`,fontSize:13 }}>
            <span style={{ color:T.muted,fontFamily:P }}>{k}</span>
            <span style={{ fontWeight:700,color:T.text,fontFamily:k==="Amount"||k==="Bank Ref"?M:P }}>{v}</span>
          </div>
        ))}
      </div>
      <div style={{ marginBottom:16 }}>
        <div style={{ background:T.bg,borderRadius:10,padding:"12px 14px",display:"flex",gap:10,alignItems:"center",border:`1px solid ${T.border}` }}>
          <FileCheck size={16} color={T.primary}/>
          <div style={{ flex:1 }}><div style={{ fontSize:13,fontWeight:600,color:T.text,fontFamily:P }}>bank_proof_april16.pdf</div><div style={{ fontSize:11,color:T.muted,fontFamily:P }}>Uploaded 16 Apr 2025, 09:14 · 1.2 MB</div></div>
          <Btn variant="ghost" size="xs"><Eye size={10}/> View</Btn>
        </div>
      </div>
      <FT label="Reviewer Note" placeholder="Document verification steps taken…" style={{ height:70 }}/>
      <InfoBox type="info">Approving posts a <code>funding_credit</code> journal to the vendor ledger, increasing their wallet balance. No electricity token is issued — tokens are issued only via unit purchases.</InfoBox>
    </Modal>
  );
}

function MManualCreditRequest({ onClose }) {
  const [step, setStep] = useState(1);
  return (
    <Modal title="Request Manual Credit — Maker Step" subtitle="Requires a separate checker to approve before wallet is credited" onClose={onClose} wide
      footer={step===1?<><Btn variant="outline" onClick={onClose}>Cancel</Btn><Btn onClick={()=>setStep(2)}>Submit for Checker Approval →</Btn></>:<><Btn variant="outline" onClick={()=>setStep(1)}>← Back</Btn><Btn onClick={onClose}>Confirm Submission</Btn></>}>
      {step===1 && (
        <>
          <InfoBox type="lemon"><strong>Maker-Checker:</strong> You are the maker. You cannot approve your own request. A different admin (checker) must approve this before the journal is posted.</InfoBox>
          <div style={{ height:14 }}/>
          <div style={{ background:T.bg,borderRadius:10,padding:"10px 14px",marginBottom:14,border:`1px solid ${T.border}` }}>
            <div style={{ fontSize:12,color:T.muted,fontFamily:P }}>Target Vendor: <strong style={{ color:T.text }}>Bright Future Electrical (VND-001)</strong></div>
          </div>
          <FI label="Credit Amount (NGN) *" prefix="₦" placeholder="e.g. 50,000.00" style={{ fontSize:15,fontWeight:700 }}/>
          <FT label="Reason / Justification * (min 30 characters)" placeholder="Explain the business reason for this manual credit. Reference any related purchase orders, reversals, or upstream failures." style={{ height:90 }}/>
          <FS label="Credit Type *">
            <option>Balance correction — upstream mismatch</option>
            <option>Reversal credit — failed purchase</option>
            <option>Goodwill adjustment</option>
            <option>Other (explain in reason)</option>
          </FS>
        </>
      )}
      {step===2 && (
        <>
          <div style={{ background:T.lemonLight,border:`2px solid ${T.lemon}`,borderRadius:12,padding:18,marginBottom:16 }}>
            <div style={{ fontSize:13,fontWeight:700,color:T.lemonText,marginBottom:10,fontFamily:P }}>Review before submitting</div>
            {[["Target Vendor","Bright Future Electrical (VND-001)"],["Credit Amount","₦50,000.00"],["Type","Balance correction — upstream mismatch"],["Maker (you)","ops-admin"],["Next step","Awaiting checker approval from a different admin"]].map(([k,v]) => (
              <div key={k} style={{ display:"flex",justifyContent:"space-between",padding:"6px 0",borderBottom:`1px solid #d6ee66`,fontSize:12 }}>
                <span style={{ color:T.lemonText,fontFamily:P }}>{k}</span>
                <span style={{ fontWeight:700,color:T.lemonText,fontFamily:P }}>{v}</span>
              </div>
            ))}
          </div>
          <InfoBox type="warning">Once submitted, you will not be able to modify this request. A checker will be notified to review and approve.</InfoBox>
        </>
      )}
    </Modal>
  );
}

function MApproveManualCredit({ onClose }) {
  return (
    <Modal title="Approve Manual Credit — Checker Step" subtitle="MCR-001 · You are a different admin from the maker" onClose={onClose} wide
      footer={<><Btn variant="danger" onClick={onClose}>Reject</Btn><div style={{ flex:1 }}/><Btn variant="outline" onClick={onClose}>Cancel</Btn><Btn onClick={onClose}><BadgeCheck size={13}/> Approve & Post Journal</Btn></>}>
      <div style={{ background:T.lemonLight,border:`1px solid ${T.lemon}`,borderRadius:10,padding:"12px 16px",marginBottom:16,display:"flex",gap:10,alignItems:"flex-start" }}>
        <PenLine size={14} color={T.lemonText} style={{ flexShrink:0,marginTop:1 }}/>
        <div>
          <div style={{ fontSize:12,fontWeight:800,color:T.lemonText,marginBottom:3,fontFamily:P }}>You are acting as CHECKER</div>
          <div style={{ fontSize:12,color:T.lemonText,fontFamily:P }}>The maker was <code>ops-admin</code>. You must be a different user. Your approval posts the <code>manual_credit</code> journal immediately.</div>
        </div>
      </div>
      <div style={{ background:T.bg,borderRadius:12,padding:16,marginBottom:16,border:`1px solid ${T.border}` }}>
        {[["Request ID","MCR-001"],["Target Vendor","Bright Future Electrical (VND-001)"],["Credit Amount","₦50,000.00"],["Credit Type","Balance correction — upstream mismatch"],["Maker","ops-admin"],["Requested At","16 Apr 2025, 08:30"]].map(([k,v]) => (
          <div key={k} style={{ display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:`1px solid ${T.border}`,fontSize:13 }}>
            <span style={{ color:T.muted,fontFamily:P }}>{k}</span>
            <span style={{ fontWeight:700,color:T.text,fontFamily:k==="Request ID"?M:P }}>{v}</span>
          </div>
        ))}
      </div>
      <div style={{ background:T.bg,borderRadius:10,padding:"12px 14px",marginBottom:14,border:`1px solid ${T.border}` }}>
        <div style={{ fontSize:12,fontWeight:600,color:T.muted,marginBottom:4,fontFamily:P }}>Maker's Justification</div>
        <div style={{ fontSize:13,color:T.text,lineHeight:1.65,fontFamily:P }}>Balance correction after upstream mismatch on PO-00285. Reversal journal confirmed by ops.</div>
      </div>
      <FT label="Checker Note *" placeholder="Document your verification of the maker's justification…" style={{ height:70 }}/>
      <InfoBox type="info">Approval will post a <code>manual_credit</code> journal entry to the vendor wallet ledger and increase their balance by <strong>₦50,000.00</strong>. This action is immutable and logged to the audit trail under your username.</InfoBox>
    </Modal>
  );
}

function MReceipt({ onClose }) {
  return (
    <Modal title="Vending Receipt" subtitle="RCP-20250416-000042 — Token Purchase" onClose={onClose}
      footer={<><Btn variant="outline"><Printer size={13}/> Print</Btn><Btn onClick={onClose}>Close</Btn></>}>
      <div style={{ background:`linear-gradient(135deg, ${T.sidebarBg}, #013b18)`,borderRadius:12,padding:"18px 22px",textAlign:"center" }}>
        <div style={{ fontSize:11,color:"rgba(255,255,255,0.4)",marginBottom:3,fontFamily:P }}>ACOB Lighting Technology Limited</div>
        <div style={{ fontSize:16,fontWeight:800,color:"#fff",fontFamily:P }}>Vending Receipt — Token Generation</div>
        <div style={{ fontSize:12,color:T.lemon,marginTop:3,fontFamily:M }}>RCP-20250416-000042</div>
      </div>
      <div style={{ border:`1px solid ${T.border}`,borderTop:"none",borderRadius:"0 0 12px 12px",padding:"0 18px" }}>
        {[["Date / Time","16 Apr 2025, 09:42 WAT"],["Vendor","Bright Future (VND-001)"],["Site","Lagos North"],["Meter SN","MTR-00291"],["Customer","Adebayo Okafor"],["Account Ref","ACC-00291"],["Amount","₦5,000.00"]].map(([k,v]) => (
          <div key={k} style={{ display:"flex",justifyContent:"space-between",padding:"9px 0",borderBottom:`1px solid ${T.border}`,fontSize:13 }}>
            <span style={{ color:T.muted,fontFamily:P }}>{k}</span>
            <span style={{ fontWeight:600,color:T.text,fontFamily:k==="Meter SN"||k==="Account Ref"?M:P }}>{v}</span>
          </div>
        ))}
        <div style={{ padding:"16px 0" }}>
          <div style={{ background:T.primaryLight,border:`2px solid ${T.primary}`,borderRadius:12,padding:"16px 20px",textAlign:"center" }}>
            <div style={{ fontSize:11,fontWeight:800,color:T.successText,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:10,fontFamily:P }}>🔢 Token Code — Enter on Meter Keypad</div>
            <div style={{ fontSize:26,fontWeight:900,fontFamily:M,letterSpacing:"4px",color:T.sidebarBg }}>3821 5647 9012 3847 6521</div>
          </div>
        </div>
      </div>
    </Modal>
  );
}

function MResolveException({ onClose }) {
  return (
    <Modal title="Resolve Exception" subtitle="EXC-001 · CRITICAL — SLA Breached" onClose={onClose}
      footer={<><Btn variant="outline" onClick={onClose}>Cancel</Btn><Btn onClick={onClose}>Post Resolution</Btn></>}>
      <div style={{ background:T.dangerBg,border:`1px solid #fecaca`,borderRadius:10,padding:"12px 16px",marginBottom:16,display:"flex",gap:10 }}>
        <AlertTriangle size={15} color={T.danger} style={{ flexShrink:0,marginTop:1 }}/>
        <div><div style={{ fontSize:12,fontWeight:800,color:T.dangerText,marginBottom:3,fontFamily:P }}>CRITICAL — SLA Breached</div><div style={{ fontSize:12,color:T.dangerText,fontFamily:P }}>PO-00291 stuck in reserved state for 22 min. Upstream status unknown.</div></div>
      </div>
      <FS label="Resolution Action *">
        <option>Release reservation — upstream confirmed failure</option>
        <option>Finalise purchase — upstream confirmed success</option>
        <option>Escalate to engineering</option>
        <option>Manual compensating entry</option>
      </FS>
      <FT label="Resolution Note * (min 20 characters)" placeholder="Document investigation steps and corrective action taken…" style={{ height:90 }}/>
      <InfoBox type="info">Resolution is immutable and logged to audit. Releasing the reservation restores the vendor's balance automatically.</InfoBox>
    </Modal>
  );
}

function MFreezeWallet({ onClose }) {
  return (
    <Modal title="Freeze Wallet" subtitle="Immediately blocks all new purchases" onClose={onClose}
      footer={<><Btn variant="outline" onClick={onClose}>Cancel</Btn><Btn variant="danger" onClick={onClose}><Lock size={12}/> Freeze Wallet</Btn></>}>
      <FS label="Freeze Reason *">
        <option>Suspicious purchase pattern</option><option>Fraud investigation</option><option>AML flag</option><option>Compliance hold</option>
      </FS>
      <FT label="Internal Note *" placeholder="Document the reason…" style={{ height:80 }}/>
      <InfoBox type="danger">Unfreezing requires dual approval from ops and finance (maker-checker). Existing reservations are preserved.</InfoBox>
    </Modal>
  );
}

function MNotifications({ onClose }) {
  return (
    <Modal title="Notifications" subtitle="3 unread" onClose={onClose} footer={<><Btn variant="outline" onClick={onClose}>Mark all read</Btn></>}>
      {NOTIFICATIONS.map((n,i) => (
        <div key={i} style={{ display:"flex",gap:14,padding:"14px 0",borderBottom:i<NOTIFICATIONS.length-1?`1px solid ${T.border}`:"none" }}>
          <div style={{ width:38,height:38,borderRadius:10,background:n.bg,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0 }}><n.Icon size={16} color={n.color}/></div>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:13,fontWeight:700,color:T.text,marginBottom:3,fontFamily:P }}>{n.title}</div>
            <div style={{ fontSize:12,color:T.muted,lineHeight:1.5,fontFamily:P }}>{n.sub}</div>
          </div>
          <div style={{ fontSize:11,color:T.faint,flexShrink:0,marginTop:2,fontFamily:P }}>{n.time}</div>
        </div>
      ))}
    </Modal>
  );
}

function MCreateVendor({ onClose }) {
  const [step, setStep] = useState(1);
  return (
    <Modal title="Create Vendor Account" subtitle={`Step ${step} of 3`} onClose={onClose} wide
      footer={<>{step>1&&<Btn variant="outline" onClick={()=>setStep(s=>s-1)}>← Back</Btn>}<div style={{ flex:1 }}/><Btn variant="ghost" onClick={onClose}>Cancel</Btn>{step<3?<Btn onClick={()=>setStep(s=>s+1)}>Next →</Btn>:<Btn onClick={onClose}>Create Account & Send Credentials</Btn>}</>}>
      <div style={{ display:"flex",alignItems:"center",marginBottom:22 }}>
        {["Vendor Details","Site & Limits","Credentials"].map((lbl,i) => {
          const done=i<step-1,active=i===step-1;
          return (<div key={lbl} style={{ display:"flex",alignItems:"center",flex:i<2?1:"none" }}>
            <div style={{ display:"flex",alignItems:"center",gap:7 }}>
              <div style={{ width:22,height:22,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:800,background:done||active?T.primary:T.border,color:done||active?"#fff":T.faint }}>{done?<Check size={10}/>:i+1}</div>
              <span style={{ fontSize:12,color:active?T.text:T.muted,fontFamily:P,fontWeight:active?600:400 }}>{lbl}</span>
            </div>
            {i<2&&<div style={{ flex:1,height:2,background:done?T.primary:T.border,margin:"0 10px",borderRadius:1 }}/>}
          </div>);
        })}
      </div>
      {step===1 && <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:12 }}>
        <FI label="Vendor / Business Name *" placeholder="e.g. Bright Future Electrical"/>
        <FI label="Primary Phone *" placeholder="08012345678"/>
        <FI label="Email Address" placeholder="accounts@vendor.ng"/>
        <FI label="Contact Person *" placeholder="Full name"/>
        <FI label="CAC Number *" placeholder="RC-0000000"/>
        <FI label="Tax ID (TIN)" placeholder="12345678-0001"/>
      </div>}
      {step===2 && <>
        <FS label="Assigned Site *"><option>Lagos North</option><option>Abuja Central</option><option>Kano Central</option><option>Port Harcourt</option></FS>
        <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:12 }}>
          <FI label="Daily Limit (NGN)" defaultValue="500000" prefix="₦"/>
          <FI label="Per-Transaction Limit (NGN)" defaultValue="100000" prefix="₦"/>
        </div>
        <FS label="Commission Rule"><option>Standard (0.00% — activation pending)</option><option>Custom rate</option></FS>
        <InfoBox type="info">Commission is wired from day one at 0.00%. Finance activates the rate when business policy is set.</InfoBox>
      </>}
      {step===3 && <>
        <div style={{ background:T.successBg,border:`1px solid #b7dfc8`,borderRadius:12,padding:18,marginBottom:16 }}>
          <div style={{ fontSize:12,fontWeight:800,color:T.successText,marginBottom:10,fontFamily:P }}>Credentials generated automatically</div>
          {[["Username","brightfuture01 (auto-generated)"],["Temp Password","Generated securely on creation"],["Expiry","72 hours — must change on first login"]].map(([k,v]) => (
            <div key={k} style={{ display:"flex",justifyContent:"space-between",padding:"6px 0",borderBottom:`1px solid #b7dfc8`,fontSize:12 }}>
              <span style={{ color:T.successText,fontFamily:P }}>{k}</span><span style={{ fontWeight:700,color:T.sidebarBg,fontFamily:P }}>{v}</span>
            </div>
          ))}
        </div>
        <FS label="Deliver credentials via"><option>SMS to registered phone</option><option>Email</option><option>Display on screen</option></FS>
        <InfoBox type="warning">Vendor must change password on first login before any wallet operation is permitted.</InfoBox>
      </>}
    </Modal>
  );
}

function MViewVendor({ onClose }) {
  const v=VENDORS_DATA[0];
  return (
    <Modal title={v.name} subtitle={`${v.code} · ${v.site}`} onClose={onClose} wide
      footer={<><Btn variant="danger">Suspend</Btn><div style={{ flex:1 }}/><Btn variant="outline" onClick={onClose}>Close</Btn></>}>
      <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:16 }}>
        {[["Code",v.code],["Site",v.site],["Contact","08012345678"],["Status","Active"],["KYC","Approved"],["Risk","Low"],["Joined",v.joined],["Total Txns",String(v.txns)]].map(([k,val]) => (
          <div key={k} style={{ background:T.bg,borderRadius:10,padding:"12px 14px",border:`1px solid ${T.border}` }}>
            <div style={{ fontSize:11,color:T.muted,marginBottom:3,fontFamily:P }}>{k}</div>
            <div style={{ fontSize:13,fontWeight:700,color:k==="Status"||k==="KYC"?T.success:k==="Risk"?T.success:T.text,fontFamily:P }}>{val}</div>
          </div>
        ))}
      </div>
      <Divider label="WALLET SUMMARY"/>
      <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10 }}>
        {[["Posted Float",NGN(v.balance)],["Reserved",NGN(v.reserved)],["Available",NGN(v.balance-v.reserved)]].map(([k,val]) => (
          <div key={k} style={{ background:T.bg,borderRadius:10,padding:"12px 14px",textAlign:"center",border:`1px solid ${T.border}` }}>
            <div style={{ fontSize:10,color:T.faint,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:5,fontFamily:P,fontWeight:600 }}>{k}</div>
            <div style={{ fontSize:17,fontWeight:800,color:T.text,fontFamily:P }}>{val}</div>
          </div>
        ))}
      </div>
    </Modal>
  );
}

/* ─── ROOT ──────────────────────────────────────────────────────────────────── */
export default function App() {
  const [authState, setAuthState] = useState("vendor-login");
  const [role,      setRole]      = useState("vendor");
  const [view,      setView]      = useState("v-dashboard");
  const [modal,     setModal]     = useState(null);

  const handleLogin = r => { setRole(r); setView(r==="vendor"?"v-dashboard":"a-dashboard"); setAuthState("app"); };
  const handleSignOut = () => { setAuthState(role==="vendor"?"vendor-login":"admin-login"); setModal(null); };

  if(authState==="vendor-login") return <><FontImport/><VendorLogin onLogin={handleLogin}/></>;
  if(authState==="admin-login")  return <><FontImport/><AdminLogin  onLogin={handleLogin}/></>;

  const navMap    = role==="vendor" ? VENDOR_NAV : ADMIN_NAV;
  const activeNav = navMap.find(n=>n.key===view);

  return (
    <>
      <FontImport/>
      <div style={{ display:"flex", height:"100vh", background:T.bg, fontFamily:P, overflow:"hidden" }}>
        <Sidebar role={role} view={view} setView={setView} onSignOut={handleSignOut}/>
        <div style={{ flex:1, display:"flex", flexDirection:"column", minWidth:0 }}>
          <Topbar
            title={activeNav?.label||""}
            sub={role==="vendor"?`${VENDOR_ME.name} · ${VENDOR_ME.site}`:"Finance Admin · ACOB Lighting Technology Ltd"}
            role={role} notifCount={3} onNotif={()=>setModal("notifications")}
            right={role==="vendor"
              ? <Btn size="sm" onClick={()=>setView("v-buy")} style={{ background:T.lemon,color:T.lemonText,fontWeight:700,boxShadow:`0 2px 10px ${T.lemonGlow}` }}><Zap size={12}/> Buy Units</Btn>
              : <button onClick={()=>setAuthState("vendor-login")} style={{ display:"flex",alignItems:"center",gap:6,background:"none",border:`1px solid ${T.border}`,borderRadius:8,padding:"5px 12px",cursor:"pointer",fontSize:12,color:T.muted,fontFamily:P }}><ArrowRight size={12}/> Vendor Portal</button>
            }
          />
          <div style={{ flex:1, overflowY:"auto" }}>
            {role==="vendor" ? (
              view==="v-dashboard"    ? <VDashboard setView={setView}/> :
              view==="v-buy"          ? <VBuy/> :
              view==="v-topup"        ? <VTopup/> :
              view==="v-transactions" ? <VTransactions/> :
              view==="v-receipts"     ? <VReceipts setModal={setModal}/> :
              view==="v-statement"    ? <VStatement/> :
              view==="v-profile"      ? <VProfile/> : <VDashboard setView={setView}/>
            ) : (
              view==="a-dashboard"  ? <ADashboard setView={setView}/> :
              view==="a-vendors"    ? <AVendors setModal={setModal}/> :
              view==="a-wallets"    ? <AWallets setModal={setModal}/> :
              view==="a-funding"    ? <AFunding setModal={setModal}/> :
              view==="a-purchases"  ? <APurchases setModal={setModal}/> :
              view==="a-exceptions" ? <AExceptions setModal={setModal}/> :
              view==="a-settlement" ? <ASettlement/> :
              view==="a-audit"      ? <AAudit/> : <ADashboard setView={setView}/>
            )}
          </div>
        </div>
      </div>

      {modal==="approve-vendor"       && <MApproveVendor       onClose={()=>setModal(null)}/>}
      {modal==="approve-funding"      && <MApproveFunding       onClose={()=>setModal(null)}/>}
      {modal==="manual-credit-request"&& <MManualCreditRequest  onClose={()=>setModal(null)}/>}
      {modal==="approve-manual-credit"&& <MApproveManualCredit  onClose={()=>setModal(null)}/>}
      {modal==="receipt"              && <MReceipt              onClose={()=>setModal(null)}/>}
      {modal==="resolve-exception"    && <MResolveException     onClose={()=>setModal(null)}/>}
      {modal==="freeze-wallet"        && <MFreezeWallet         onClose={()=>setModal(null)}/>}
      {modal==="notifications"        && <MNotifications        onClose={()=>setModal(null)}/>}
      {modal==="create-vendor"        && <MCreateVendor         onClose={()=>setModal(null)}/>}
      {modal==="view-vendor"          && <MViewVendor           onClose={()=>setModal(null)}/>}
    </>
  );
}
