// ═══════════════════════════════════════════════════════════════════════════
//  PRIME ALPHA SECURITIES — Enterprise Platform
//  "Flexible Capital Solutions"
//
//  URL Architecture (Route 53 / CloudFront):
//    primealphasecurities.com          → Public site
//    investor.primealphasecurities.com → Investor portal login + dashboard
//    worker.primealphasecurities.com   → Team console login + dashboard
//
//  Backend: AWS DynamoDB — SDK v3 direct (root credentials)
//  Tables provisioned via Terraform:
//    investor           PK: investorId  (S)
//    portfolios         PK: portfolioId (S)
//    documents          PK: docId       (S)
//    workers            PK: workerId    (S)
//    calendar           PK: eventId     (S)
//    pe_companies       PK: dealId      (S)
//    credit_application PK: appId       (S)
//    real_estate        PK: assetId     (S)
//    articles           PK: articleId   (S)
//    inquiries          PK: inquiryId   (S)

import { useState, useEffect, useRef, useCallback, createContext, useContext } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
//  AWS CONFIG  ← paste root credentials from AWS Console → Security credentials
// ─────────────────────────────────────────────────────────────────────────────
// AWS credentials: EC2 IAM role (automatic via IMDS)

// ─────────────────────────────────────────────────────────────────────────────
//  RUNTIME CONTEXT  — detects which subdomain we're on
// ─────────────────────────────────────────────────────────────────────────────
const HOSTNAME    = typeof window !== "undefined" ? window.location.hostname : "";
const IS_INVESTOR = false;  // Now path-based: /investor — not subdomain
const IS_PUBLIC   = true;

// Language context — "en" | "fr"
const LangCtx = createContext(["en", ()=>{}]);
const useLang = () => useContext(LangCtx);

// ── URL path → page name map ──────────────────────────────────────────────────
const ROUTES = {
  "/":                 "home",
  "/who-we-are":       "Overview",
  "/the-team":         "The Team",
  "/culture":          "Culture",
  "/leadership":       "Leadership",
  "/civic-priorities": "Civic Priorities",
  "/what-we-do":       "What We Do",
  "/private-equity":   "Private Equity",
  "/private-credit":   "Private Credit",
  "/real-estate":      "Real Estate",
  "/commodities":      "Commodities",
  "/fund-terms":       "Fund Terms",
  "/careers":          "Careers",
  "/research":         "Research",
  "/contact":          "Contact",
  "/privacy":          "Privacy",
  "/terms":            "Terms",
  "/notices":          "Notices",
  "/disclosures":      "Disclosures",
  "/worker":           "worker",
  "/investor":         "investor",
};
const PAGE_TO_PATH = Object.fromEntries(Object.entries(ROUTES).map(([k,v])=>[v,k]));
PAGE_TO_PATH["home"] = "/";

function navigate(page){
  const path = PAGE_TO_PATH[page] || "/";
  window.history.pushState({page}, "", path);
  window.scrollTo(0, 0);
}
function getPageFromPath(){
  return ROUTES[window.location.pathname] || "home";
}
const DOMAIN      = "primealphasecurities.com";

// ─────────────────────────────────────────────────────────────────────────────
//  PRIMARY KEY MAP  — maps each table name to its partition key attribute
// ─────────────────────────────────────────────────────────────────────────────
const PK = {
  "investor":           "investorId",
  "portfolios":         "portfolioId",
  "documents":          "docId",
  "workers":            "workerId",
  "calendar":           "eventId",
  "pe_companies":       "dealId",
  "credit_application": "appId",
  "real_estate":        "assetId",
  "articles":           "articleId",
  "enquiries":          "enquiryId",
};

// ─────────────────────────────────────────────────────────────────────────────
//  DYNAMODB CLIENT  — singleton using root credentials from AWS_CONFIG
// ─────────────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
//  API LAYER  — thin wrappers around DynamoDB SDK v3 commands
//
//  All write operations are fire-and-update: the calling component updates
//  local React state immediately (optimistic), then this layer persists to
//  DynamoDB asynchronously. If the SDK call throws, the error is logged but
//  the UI is never blocked — the local state change stands.
// ─────────────────────────────────────────────────────────────────────────────
const api = {

  async getAll(table) {
    try {
      const r = await fetch(`/api/${table}`);
      if (!r.ok) throw new Error(await r.text());
      return r.json();
    } catch(e) { console.warn(`[API] getAll ${table}:`, e.message); return SEED[table]||[]; }
  },

  async getOne(table, id) {
    try {
      const r = await fetch(`/api/${table}/${encodeURIComponent(id)}`);
      if (!r.ok) throw new Error(await r.text());
      return r.json();
    } catch(e) { console.warn(`[API] getOne ${table}/${id}:`, e.message); return (SEED[table]||[]).find(x=>x[PK[table]]===id)||null; }
  },

  async put(table, item) {
    try {
      const r = await fetch(`/api/${table}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(item)});
      if (!r.ok) throw new Error(await r.text());
      return r.json();
    } catch(e) { console.warn(`[API] put ${table}:`, e.message); return item; }
  },

  async patch(table, id, fields) {
    try {
      const r = await fetch(`/api/${table}/${encodeURIComponent(id)}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(fields)});
      if (!r.ok) throw new Error(await r.text());
      return r.json();
    } catch(e) { console.warn(`[API] patch ${table}/${id}:`, e.message); return fields; }
  },

  async del(table, id) {
    try {
      const r = await fetch(`/api/${table}/${encodeURIComponent(id)}`,{method:'DELETE'});
      if (!r.ok) throw new Error(await r.text());
      return true;
    } catch(e) { console.warn(`[API] del ${table}/${id}:`, e.message); return true; }
  },
};
// ── Notification helpers — POST /api/notify/* ─────────────────────────────────
const notify = {
  async inquiry(data)    { try { await fetch('/api/notify/inquiry',     {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)}); } catch(e){console.warn('[notify]',e.message);} },
  async credit(data)     { try { await fetch('/api/notify/credit',      {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)}); } catch(e){console.warn('[notify]',e.message);} },
  async calendar(data)   { try { await fetch('/api/notify/calendar',    {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)}); } catch(e){console.warn('[notify]',e.message);} },
  async workerEmail(data){ try { await fetch('/api/notify/worker-email',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)}); } catch(e){console.warn('[notify]',e.message);} },
};

// ─────────────────────────────────────────────────────────────────────────────
//  SEED DATA  — used when AWS endpoint not yet configured
// ─────────────────────────────────────────────────────────────────────────────
const SEED = {
  "investor": [
    {
      investorId: "c001", name: "Meridian Endowment Fund",
      email: "investor@meridianfund.com", phone: "+1 212 555 0101",
      joinDate: "2021-03-15", term: "10 years", aum: 42500000,
      pnl: 7840000, cumulativePnl: 12300000,
      strategy: "Multi-Asset Growth", risk: "Moderate",
      documents: ["Q1-2024-Report.pdf","Portfolio-Overview.pdf","Term-Sheet.pdf"],
      investments: [
        {name:"US Large Cap Equity",value:18000000,pct:42.4},
        {name:"Private Credit",value:10200000,pct:24.0},
        {name:"Real Estate",value:8500000,pct:20.0},
        {name:"Fixed Income",value:5800000,pct:13.6},
      ],
      history:[{month:"Jan",pnl:210000},{month:"Feb",pnl:340000},{month:"Mar",pnl:280000},{month:"Apr",pnl:390000},{month:"May",pnl:520000},{month:"Jun",pnl:410000}],
    },
    {
      investorId: "c002", name: "Vantage Family Office",
      email: "family@vantagefamilyoffice.com", phone: "+1 646 555 0202",
      joinDate: "2020-07-01", term: "Perpetual", aum: 87300000,
      pnl: 14200000, cumulativePnl: 31500000,
      strategy: "Absolute Return", risk: "Conservative",
      documents: ["Annual-Statement-2023.pdf","Investment-Policy.pdf"],
      investments: [
        {name:"Private Equity",value:35000000,pct:40.1},
        {name:"Hedge Overlay",value:22000000,pct:25.2},
        {name:"Private Credit",value:17000000,pct:19.5},
        {name:"Cash & Equivalents",value:13300000,pct:15.2},
      ],
      history:[{month:"Jan",pnl:580000},{month:"Feb",pnl:720000},{month:"Mar",pnl:640000},{month:"Apr",pnl:890000},{month:"May",pnl:1050000},{month:"Jun",pnl:980000}],
    },
    {
      investorId: "c003", name: "Cypress Sovereign Trust",
      email: "trust@cypresssovereign.com", phone: "+44 20 7946 0303",
      joinDate: "2022-11-20", term: "7 years", aum: 23100000,
      pnl: 2900000, cumulativePnl: 4100000,
      strategy: "Income & Preservation", risk: "Low",
      documents: ["Onboarding-Pack.pdf","Q4-2023-Statement.pdf"],
      investments: [
        {name:"Fixed Income",value:12000000,pct:51.9},
        {name:"Real Estate",value:6000000,pct:26.0},
        {name:"Dividend Equity",value:5100000,pct:22.1},
      ],
      history:[{month:"Jan",pnl:95000},{month:"Feb",pnl:110000},{month:"Mar",pnl:88000},{month:"Apr",pnl:130000},{month:"May",pnl:145000},{month:"Jun",pnl:120000}],
    },
  ],
  "workers": [
    {workerId:"w001",name:"Alexandra Renard",email:"worker@primealphasecurities.com",role:"Portfolio Manager",dept:"Investments"},
    {workerId:"w002",name:"James Okafor",email:"james@primealphasecurities.com",role:"Credit Analyst",dept:"Private Credit"},
  ],
  "pe_companies": [
    {dealId:"pe001",company:"NovaTech Systems",sector:"SaaS / B2B",status:"owned",revenue:28000000,ebitda:7200000,ev:86400000,equity:42000000,entryDate:"2021-06-01",analyst:"Alexandra Renard",lastUpdated:"2024-05-10",irr:22.4,moic:1.8,notes:"Strong ARR growth, expanding internationally."},
    {dealId:"pe002",company:"Greenleaf Logistics",sector:"Supply Chain",status:"due_diligence",revenue:15000000,ebitda:3100000,ev:37200000,equity:20000000,entryDate:null,analyst:"James Okafor",lastUpdated:"2024-06-01",irr:null,moic:null,notes:"Awaiting management Q&A and legal review."},
    {dealId:"pe003",company:"Apex Clinics Group",sector:"Healthcare",status:"offer",revenue:44000000,ebitda:9800000,ev:117600000,equity:55000000,entryDate:null,analyst:"Alexandra Renard",lastUpdated:"2024-06-15",irr:null,moic:null,notes:"LOI signed, exclusivity period active."},
    {dealId:"pe004",company:"Solaris Energy Partners",sector:"Renewables",status:"sold",revenue:32000000,ebitda:8400000,ev:100800000,equity:48000000,entryDate:"2019-03-15",analyst:"James Okafor",lastUpdated:"2023-11-30",irr:31.2,moic:3.1,notes:"Exit via strategic sale to utility conglomerate."},
  ],
  "calendar": [
    {eventId:"ev001",date:"2024-07-15",title:"IC Meeting — NovaTech Q2 Review",members:["w001","w002"]},
    {eventId:"ev002",date:"2024-07-22",title:"Client Call — Meridian Endowment",members:["w001"]},
    {eventId:"ev003",date:"2024-07-30",title:"Due Diligence Site Visit — Greenleaf",members:["w002"]},
  ],
  "articles": [
    {articleId:"a001",title:"The Illiquidity Premium in Private Markets",date:"2024-06-12",author:"Alexandra Renard",category:"Private Equity",excerpt:"As public markets compress multiples, sophisticated capital allocators are increasingly turning to private markets to capture the illiquidity premium — but the calculus demands precision and conviction."},
    {articleId:"a002",title:"Credit Cycle Dynamics: Navigating the Turn",date:"2024-05-28",author:"James Okafor",category:"Private Credit",excerpt:"The tightening of senior lending standards creates a compelling entry point for direct lenders with flexible mandates and robust underwriting frameworks."},
    {articleId:"a003",title:"Macro Regime Shifts and Portfolio Construction",date:"2024-04-15",author:"Alexandra Renard",category:"Fixed Income",excerpt:"Higher-for-longer interest rate environments fundamentally alter the correlation structure between asset classes, requiring a rethink of traditional portfolio construction."},
    {articleId:"a004",title:"Real Assets as Inflation Hedges: Evidence from Five Cycles",date:"2024-03-02",author:"Research Team",category:"Real Estate",excerpt:"A longitudinal study of real asset performance across five inflationary regimes reveals consistent outperformance relative to nominal bonds and mixed results versus equities."},
  ],
  "documents": [
    {docId:"r001",title:"Systematic Factor Exposure Model v2.3",date:"2024-06-01",status:"In Testing",description:"An enhanced multi-factor risk model incorporating alternative data signals from satellite imagery, credit card transactions, and ESG metrics."},
    {docId:"r002",title:"AI-Assisted Due Diligence Pipeline",date:"2024-05-15",status:"Deployed",description:"LLM-powered document parsing and financial statement normalization reducing initial DD turnaround from 5 days to under 6 hours."},
    {docId:"r003",title:"Real-Time Portfolio Attribution Engine",date:"2024-04-20",status:"Development",description:"Intraday attribution across 40+ risk factors with natural-language daily summaries delivered to portfolio managers via the internal dashboard."},
  ],
  "real_estate": [
    {assetId:"re001",name:"Metropolitan Logistics Hub",type:"Logistics",location:"New Jersey, USA",status:"owned",purchasePrice:42000000,currentValue:51000000,irr:14.2,occupancy:97,sqft:480000},
    {assetId:"re002",name:"Riverside Multifamily Portfolio",type:"Multifamily",location:"Austin, TX",status:"owned",purchasePrice:28000000,currentValue:34500000,irr:11.8,occupancy:94,sqft:312000},
    {assetId:"re003",name:"Canary Wharf Commercial",type:"Commercial",location:"London, UK",status:"development",purchasePrice:65000000,currentValue:65000000,irr:null,occupancy:0,sqft:220000},
  ],
  "enquiries": [],
  "credit_application": [],
};

// ─────────────────────────────────────────────────────────────────────────────
//  RISK GRADING ENGINE
// ─────────────────────────────────────────────────────────────────────────────
const RISK_GRADES = [
  {grade:1,desc:"Excellent",    pd:"1–2%",  pdMid:0.015,lgd:0.10,color:"#16a34a",notes:"Strong sponsor, low leverage, predictable cash flows"},
  {grade:2,desc:"Very Good",   pd:"2–4%",  pdMid:0.03, lgd:0.15,color:"#22c55e",notes:"Moderate leverage, stable industry, good covenant compliance"},
  {grade:3,desc:"Good",        pd:"4–6%",  pdMid:0.05, lgd:0.25,color:"#84cc16",notes:"Medium leverage, cyclical industry, some concentration"},
  {grade:4,desc:"Satisfactory",pd:"6–8%",  pdMid:0.07, lgd:0.35,color:"#eab308",notes:"Moderate stress risk, EBITDA volatility, mid-market sponsor"},
  {grade:5,desc:"Moderate",    pd:"8–12%", pdMid:0.10, lgd:0.50,color:"#f97316",notes:"High leverage, mid-to-high risk industry, covenant light"},
  {grade:6,desc:"Marginal",    pd:"12–20%",pdMid:0.16, lgd:0.55,color:"#ef4444",notes:"Stressed industry, weak sponsor support, high EBITDA volatility"},
  {grade:7,desc:"Substantial", pd:"20–30%",pdMid:0.25, lgd:0.60,color:"#dc2626",notes:"Distressed / turnaround, single customer dependency, covenant-lite"},
  {grade:8,desc:"High",        pd:"30–50%",pdMid:0.40, lgd:0.75,color:"#b91c1c",notes:"Special situations, speculative cash flows, unitranche / unsecured only"},
  {grade:9,desc:"Very High",   pd:"50–70%",pdMid:0.60, lgd:0.85,color:"#991b1b",notes:"Distressed, limited collateral, short-term recovery possible"},
  {grade:10,desc:"Extreme",    pd:"70–100%",pdMid:0.85,lgd:0.95,color:"#7f1d1d",notes:"Default imminent, restructuring likely, mostly unsecured"},
];

function calcGrade(f) {
  let s = 0;
  const lev = parseFloat(f.leverage)||0, em = parseFloat(f.ebitdaMargin)||0, yrs = parseInt(f.yearsOperating)||0;
  if(lev>8)s+=4;else if(lev>6)s+=3;else if(lev>4)s+=2;else if(lev>2)s+=1;
  if(em<5)s+=3;else if(em<15)s+=2;else if(em<25)s+=1;
  if(yrs<2)s+=3;else if(yrs<5)s+=2;else if(yrs<10)s+=1;
  if(f.hasCollateral!=="yes")s+=2;
  if(f.sponsorQuality==="none")s+=2;else if(f.sponsorQuality==="weak")s+=1;
  if(f.industry==="distressed")s+=3;else if(f.industry==="cyclical")s+=2;else if(f.industry==="mixed")s+=1;
  if(f.covenants==="none")s+=2;else if(f.covenants==="light")s+=1;
  return RISK_GRADES[Math.min(9,Math.max(0,Math.round(s/1.7)-1))];
}

// ─────────────────────────────────────────────────────────────────────────────
//  UTILITIES
// ─────────────────────────────────────────────────────────────────────────────
const $  = (n) => new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",notation:"compact",maximumFractionDigits:1}).format(n);
const $$ = (n) => new Intl.NumberFormat("en-US",{style:"currency",currency:"USD"}).format(n);
const pct= (n) => `${(n*100).toFixed(2)}%`;
const uid= () => Math.random().toString(36).slice(2,10);
const otp= () => Math.random().toString(36).slice(2,12).toUpperCase();
const now= () => new Date().toISOString().slice(0,10);

// ─────────────────────────────────────────────────────────────────────────────
//  GLOBAL STYLES  (Citadel-inspired: white, near-black, electric blue)
// ─────────────────────────────────────────────────────────────────────────────
const THEME = `
/* ── Fonts ─────────────────────────────────────────────────────────────── */
/* TT Commons is self-hosted; fallback chain covers all environments */
*,*::before,*::after { box-sizing: border-box; margin: 0; padding: 0; }

:root {
  /* Brand blues */
  --blue-primary:      #144aa5;
  --blue-dark:         #08225a;
  --blue-secondary:    #002583;
  --blue-dark-alt:     #1c409b;
  --blue-light:        #558ff0;
  --blue-light-alt:    #427fe5;
  --blue-light-accent: #7dadff;
  --blue-dark-sec:     #001a64;
  --base-1:            #1c409b;

  /* Grays */
  --gray-primary:         #555;
  --gray-primary-darker:  #444;
  --gray-primary-light:   #989ca1;
  --gray-primary-lighter: #bfc2c5;
  --gray-primary-lighter2:#f6f6f6;
  --gray-dark:            #535461;
  --gray-dark-alt:        #0f0f14;
  --gray-dark-sec:        #9fa0a1;
  --gray-light:           #d0d1d4;
  --gray-light-alt:       #ece9e4;
  --gray-light-secondary: #efefef;
  --gray-texts:           #68717a;
  --gray-texts-light:     #c4cad7;

  /* Accent */
  --gold-primary:      #f8ce56;
  --gold-sec:          #fae57f;
  --ghost:             #c4cad7;
  --link-water:        #d6e0f6;
  --green:             #6ee8e9;
  --blue-primary-sec:  #29b8ce;
  --blue-primary-sec-alt: #6ee8e9;
  --blue-primary-sec-muted: #182331;
  --dark-text-sec:     #101213;
  --dark-text-sec-alt: #181739;
  --white:             #fff;
  --black:             #000;
  --blue-icon-default: #0039e8;

  /* Semantic aliases used throughout the app */
  --blue:    var(--blue-primary);
  --blue-h:  var(--blue-dark);
  --blue-l:  var(--link-water);
  --blue-m:  rgba(20, 74, 165, 0.10);
  --w:       var(--white);
  --ow:      var(--gray-primary-lighter2);
  --lg:      var(--gray-light-secondary);
  --mg:      var(--gray-light);
  --dim:     var(--gray-primary-light);
  --body:    var(--gray-primary);
  --head:    var(--blue-dark);
  --red:     #C0392B;
  --amber:   #B45309;

  /* Font stack */
  --ff-b: 'TT Commons', 'HelveticaNeueLTStd-Roman', Helvetica, Arial, sans-serif;
  --ff-h: 'TT Commons', 'HelveticaNeueLTStd-Roman', Helvetica, Arial, sans-serif;
  --ff-m: 'Courier New', Courier, monospace;

  /* UI tokens */
  --r:     4px;
  --rl:    8px;
  --bdr:   1px solid var(--gray-light);
  --sh:    0 1px 4px rgba(8,34,90,0.06);
  --sh-md: 0 4px 18px rgba(8,34,90,0.10);
  --sh-lg: 0 12px 40px rgba(8,34,90,0.14);
}

html { scroll-behavior: smooth; }
body {
  font-family: var(--ff-b);
  background: var(--w);
  color: var(--body);
  font-size: 15px;
  line-height: 1.6;
  -webkit-font-smoothing: antialiased;
}
::-webkit-scrollbar { width: 4px; }
::-webkit-scrollbar-track { background: var(--lg); }
::-webkit-scrollbar-thumb { background: var(--mg); border-radius: 2px; }
a { color: inherit; text-decoration: none; }
button { cursor: pointer; border: none; background: none; font-family: inherit; }
input, textarea, select { font-family: inherit; }

@keyframes fadeUp    { from { opacity:0; transform:translateY(18px); } to { opacity:1; transform:translateY(0); } }
@keyframes fadeIn    { from { opacity:0; } to { opacity:1; } }
@keyframes slideRight{ from { opacity:0; transform:translateX(-10px); } to { opacity:1; transform:translateX(0); } }
@keyframes spin      { to { transform:rotate(360deg); } }
@keyframes pulse     { 0%,100% { opacity:1; } 50% { opacity:0.4; } }

.fu  { animation: fadeUp    0.45s cubic-bezier(.4,0,.2,1) both; }
.fi  { animation: fadeIn    0.30s ease both; }
.sr  { animation: slideRight 0.35s ease both; }
.fu-1{ animation-delay:0.08s; } .fu-2{ animation-delay:0.16s; }
.fu-3{ animation-delay:0.24s; } .fu-4{ animation-delay:0.32s; }

/* ── Responsive ─────────────────────────────────────────────────────── */
.desk-nav { display: flex !important; }
.mob-btn  { display: none !important; }

@media (max-width: 900px) {
  .desk-nav { display: none !important; }
  .mob-btn  { display: flex !important; }
  .rg-2  { grid-template-columns: 1fr !important; }
  .rg-4  { grid-template-columns: 1fr 1fr !important; }
  .rg-ft { grid-template-columns: 1fr 1fr !important; }
  .hero-grid  { grid-template-columns: 1fr !important; }
  .px-page    { padding-left: 24px !important; padding-right: 24px !important; }
  .px-hero    { padding-left: 24px !important; padding-right: 24px !important; padding-top: 80px !important; }
}
@media (max-width: 600px) {
  .rg-4        { grid-template-columns: 1fr !important; }
  .rg-ft       { grid-template-columns: 1fr !important; }
  .rg-2        { grid-template-columns: 1fr !important; }
  .px-page     { padding-left: 16px !important; padding-right: 16px !important; }
  .form-2col   { grid-template-columns: 1fr !important; }
  .form-2col > div { padding-left: 0 !important; }
  .stat-grid   { grid-template-columns: 1fr 1fr !important; }
  .hide-sm     { display: none !important; }
}
`;



// ─────────────────────────────────────────────────────────────────────────────
//  STYLE TOKENS
// ─────────────────────────────────────────────────────────────────────────────
const T = {
  btnP:  {background:"var(--blue)",color:"#fff",padding:"11px 28px",fontFamily:"var(--ff-b)",fontWeight:700,fontSize:12,letterSpacing:"0.07em",textTransform:"uppercase",borderRadius:"var(--r)",border:"none",cursor:"pointer",transition:"background 0.15s",whiteSpace:"nowrap"},
  btnO:  {background:"transparent",color:"var(--blue)",border:"1.5px solid var(--blue)",padding:"10px 28px",fontFamily:"var(--ff-b)",fontWeight:700,fontSize:12,letterSpacing:"0.07em",textTransform:"uppercase",borderRadius:"var(--r)",cursor:"pointer",transition:"all 0.15s",whiteSpace:"nowrap"},
  btnG:  {background:"transparent",color:"var(--body)",border:"1px solid var(--mg)",padding:"9px 20px",fontFamily:"var(--ff-b)",fontWeight:500,fontSize:13,borderRadius:"var(--r)",cursor:"pointer",transition:"all 0.15s"},
  btnD:  {background:"var(--red)",color:"#fff",border:"none",padding:"9px 20px",fontFamily:"var(--ff-b)",fontWeight:600,fontSize:13,borderRadius:"var(--r)",cursor:"pointer"},
  btnSm: {background:"var(--blue)",color:"#fff",border:"none",padding:"6px 14px",fontFamily:"var(--ff-b)",fontWeight:600,fontSize:12,letterSpacing:"0.04em",borderRadius:"var(--r)",cursor:"pointer"},
  card:  {background:"var(--w)",border:"var(--bdr)",borderRadius:"var(--rl)",padding:24,boxShadow:"var(--sh)"},
  inp:   {width:"100%",background:"var(--w)",border:"1.5px solid var(--mg)",borderRadius:"var(--r)",padding:"10px 14px",color:"var(--head)",fontFamily:"var(--ff-b)",fontSize:14,outline:"none",transition:"border-color 0.15s, box-shadow 0.15s"},
  lbl:   {display:"block",fontSize:11,letterSpacing:"0.09em",textTransform:"uppercase",color:"var(--dim)",marginBottom:6,fontWeight:700},
  tag:   (c="var(--blue)",bg="var(--blue-l)")=>({display:"inline-flex",alignItems:"center",gap:4,background:bg,color:c,border:`1px solid ${c}33`,borderRadius:2,padding:"2px 9px",fontSize:11,fontWeight:700,letterSpacing:"0.07em",textTransform:"uppercase"}),
  hdg:   {fontFamily:"var(--ff-h)",fontWeight:700,color:"var(--head)",letterSpacing:"-0.3px"},
};

// ─────────────────────────────────────────────────────────────────────────────
//  PRIMITIVE COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────
function Inp({label,style:xs,...p}){
  const [f,sf]=useState(false);
  return(
    <div style={{marginBottom:16}}>
      {label&&<label style={T.lbl}>{label}</label>}
      <input style={{...T.inp,...(f?{borderColor:"var(--blue)",boxShadow:"0 0 0 3px var(--blue-m)"}:{}),...xs}}
        onFocus={()=>sf(true)} onBlur={()=>sf(false)} {...p}/>
    </div>
  );
}
function Sel({label,options,...p}){
  return(
    <div style={{marginBottom:16}}>
      {label&&<label style={T.lbl}>{label}</label>}
      <select style={{...T.inp,appearance:"none",cursor:"pointer"}} {...p}>
        {options.map(o=><option key={o.value??o} value={o.value??o}>{o.label??o}</option>)}
      </select>
    </div>
  );
}
function TA({label,...p}){
  return(
    <div style={{marginBottom:16}}>
      {label&&<label style={T.lbl}>{label}</label>}
      <textarea style={{...T.inp,minHeight:100,resize:"vertical"}} {...p}/>
    </div>
  );
}
function KV({k,v,mono,accent}){
  return(
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",padding:"10px 0",borderBottom:"1px solid var(--lg)"}}>
      <span style={{fontSize:11,color:"var(--dim)",textTransform:"uppercase",letterSpacing:"0.07em",marginRight:16,flexShrink:0}}>{k}</span>
      <span style={{fontFamily:mono?"var(--ff-m)":"var(--ff-b)",fontWeight:600,fontSize:14,color:accent||"var(--head)",textAlign:"right"}}>{v}</span>
    </div>
  );
}
function StatCard({label,value,sub,accent,trend}){
  return(
    <div style={{...T.card,flex:1,minWidth:160,borderTop:`3px solid ${accent?"var(--blue)":"var(--lg)"}`}}>
      <div style={{fontSize:10,fontWeight:700,letterSpacing:"0.12em",textTransform:"uppercase",color:"var(--dim)",marginBottom:10}}>{label}</div>
      <div style={{fontFamily:"var(--ff-h)",fontSize:32,fontWeight:800,color:accent?"var(--blue)":"var(--head)",lineHeight:1,letterSpacing:"-0.5px"}}>{value}</div>
      {sub&&<div style={{fontSize:12,color:"var(--dim)",marginTop:6}}>{sub}</div>}
      {trend!==undefined&&<div style={{fontSize:12,fontWeight:700,color:trend>=0?"var(--green)":"var(--red)",marginTop:4}}>{trend>=0?"▲":"▼"} {Math.abs(trend).toFixed(1)}%</div>}
    </div>
  );
}
function Bar({label,pct:p,value}){
  return(
    <div style={{marginBottom:14}}>
      <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
        <span style={{fontSize:13,color:"var(--body)"}}>{label}</span>
        <span style={{fontSize:12,fontFamily:"var(--ff-m)",color:"var(--blue)",fontWeight:500}}>{value||`${p.toFixed(1)}%`}</span>
      </div>
      <div style={{height:5,background:"var(--lg)",borderRadius:3,overflow:"hidden"}}>
        <div style={{width:`${Math.min(100,p)}%`,height:"100%",background:"var(--blue)",borderRadius:3,transition:"width 0.9s cubic-bezier(.4,0,.2,1)"}}/>
      </div>
    </div>
  );
}
function Spark({data,color="var(--blue)"}){
  if(!data||data.length<2)return null;
  const vals=data.map(d=>d.pnl),min=Math.min(...vals),max=Math.max(...vals),rng=max-min||1;
  const W=300,H=72,P=8;
  const cx=(i)=>P+(i/(vals.length-1))*(W-P*2);
  const cy=(v)=>H-P-((v-min)/rng)*(H-P*2);
  const pts=vals.map((v,i)=>`${cx(i)},${cy(v)}`).join(" ");
  const area=`M ${vals.map((v,i)=>`${cx(i)},${cy(v)}`).join(" L ")} L ${W-P},${H} L ${P},${H} Z`;
  return(
    <svg viewBox={`0 0 ${W} ${H}`} style={{width:"100%",height:72}}>
      <defs><linearGradient id="sg" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor={color} stopOpacity="0.18"/>
        <stop offset="100%" stopColor={color} stopOpacity="0.01"/>
      </linearGradient></defs>
      <path d={area} fill="url(#sg)"/>
      <polyline fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" points={pts}/>
      {vals.map((v,i)=><circle key={i} cx={cx(i)} cy={cy(v)} r={3} fill={color}/>)}
    </svg>
  );
}
function Modal({open,onClose,title,width=620,children}){
  useEffect(()=>{document.body.style.overflow=open?"hidden":"";return()=>{document.body.style.overflow=""};},[open]);
  if(!open)return null;
  return(
    <div className="fi" style={{position:"fixed",inset:0,background:"rgba(11,15,26,0.52)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:20}} onClick={onClose}>
      <div className="fu" style={{...T.card,maxWidth:width,width:"100%",maxHeight:"92vh",overflowY:"auto",padding:32,boxShadow:"var(--sh-lg)"}} onClick={e=>e.stopPropagation()}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:24,paddingBottom:16,borderBottom:"var(--bdr)"}}>
          <h2 style={{...T.hdg,fontSize:20}}>{title}</h2>
          <button onClick={onClose} style={{width:30,height:30,borderRadius:"50%",background:"var(--lg)",color:"var(--dim)",fontSize:17,display:"flex",alignItems:"center",justifyContent:"center"}}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}
function Toast({msg,type="success",onClose}){
  useEffect(()=>{if(msg){const t=setTimeout(onClose,3800);return()=>clearTimeout(t);}},[msg,onClose]);
  if(!msg)return null;
  const C={success:{bg:"#f0fdf4",bd:"#86efac",tx:"#166534"},error:{bg:"#fef2f2",bd:"#fca5a5",tx:"#991b1b"},info:{bg:"var(--blue-l)",bd:"#93c5fd",tx:"#1d4ed8"}};
  const c=C[type]||C.success;
  return(
    <div className="sr" style={{position:"fixed",bottom:28,right:28,background:c.bg,border:`1px solid ${c.bd}`,color:c.tx,padding:"13px 18px",borderRadius:"var(--rl)",fontWeight:600,fontSize:13,zIndex:9999,boxShadow:"var(--sh-md)",maxWidth:360,display:"flex",gap:10,alignItems:"center"}}>
      <span>{type==="success"?"✓":type==="error"?"✕":"ℹ"}</span>
      {msg}
      <button onClick={onClose} style={{marginLeft:"auto",color:c.tx,opacity:0.5,fontSize:15}}>✕</button>
    </div>
  );
}
function Spinner({text="Loading…"}){
  return(
    <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:80,gap:16}}>
      <div style={{width:34,height:34,border:"3px solid var(--lg)",borderTop:"3px solid var(--blue)",borderRadius:"50%",animation:"spin 0.75s linear infinite"}}/>
      <span style={{color:"var(--dim)",fontSize:13}}>{text}</span>
    </div>
  );
}
function DBBadge({table,count}){
  return <span style={{fontSize:11,color:"var(--dim)",fontFamily:"var(--ff-m)"}}>DynamoDB · pas-{table} · {count} records</span>;
}
function SideBtn({label,active,onClick,badge}){
  return(
    <button onClick={onClick} style={{display:"flex",alignItems:"center",justifyContent:"space-between",width:"100%",textAlign:"left",padding:"9px 14px",borderRadius:"var(--r)",color:active?"var(--blue)":"var(--body)",background:active?"var(--blue-l)":"none",fontSize:13,fontWeight:active?700:400,marginBottom:2,transition:"all 0.12s",borderLeft:active?"3px solid var(--blue)":"3px solid transparent"}}>
      <span>{label}</span>
      {badge&&<span style={{...T.tag(),padding:"1px 6px",fontSize:10}}>{badge}</span>}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  BRAND LOGO
// ─────────────────────────────────────────────────────────────────────────────
// Logo — full stacked version (footer, large placements)
function Logo({height=40,dark=false}){
  return(
    <img
      src="/logo.png"
      alt="Prime Alpha Securities"
      style={{
        height,
        width:"auto",
        display:"block",
        // PNG is transparent — on dark backgrounds apply white tint if needed
        filter: dark ? "brightness(0) invert(1)" : "none",
        userSelect:"none",
      }}
    />
  );
}
// LogoInline — compact horizontal version (nav, portal sidebars)
function LogoInline({height=28,dark=false}){
  return(
    <img
      src="/logo.png"
      alt="Prime Alpha Securities"
      style={{
        height,
        width:"auto",
        display:"block",
        filter: dark ? "brightness(0) invert(1)" : "none",
        userSelect:"none",
      }}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  SHARED LAYOUT COMPONENTS
//  These are used across multiple public pages and portal views.
// ─────────────────────────────────────────────────────────────────────────────

// Dark hero banner used at the top of every public inner page.
// Usage: <PageHero eyebrow="Who We Are" title="LEADERSHIP" body="..."/>
function PageHero({eyebrow, title, body}){
  return(
    <div style={{paddingTop:66}}>
      <div style={{background:"var(--head)",padding:"80px 40px"}}>
        <div style={{maxWidth:960,margin:"0 auto"}}>
          {eyebrow&&<div style={{fontSize:10,fontWeight:700,letterSpacing:"0.16em",textTransform:"uppercase",color:"var(--blue)",marginBottom:12}}>{eyebrow}</div>}
          <h1 style={{fontFamily:"var(--ff-h)",fontSize:"clamp(38px,6vw,70px)",fontWeight:800,color:"#fff",letterSpacing:"-0.5px"}}>{title}</h1>
          {body&&<p style={{fontSize:16,color:"rgba(255,255,255,0.6)",maxWidth:620,lineHeight:1.85,marginTop:20}}>{body}</p>}
        </div>
      </div>
    </div>
  );
}

// Tiny uppercase blue eyebrow label used above section headings.
// Usage: <SectionLabel>Capital Solutions</SectionLabel>
function SectionLabel({children}){
  return(
    <div style={{fontSize:10,fontWeight:700,letterSpacing:"0.16em",textTransform:"uppercase",color:"var(--blue)",marginBottom:10}}>
      {children}
    </div>
  );
}

// Success confirmation shown after a form is submitted.
// Usage: <SubmitSuccess email="x@y.com" message="We'll respond in 2 business days."/>
function SubmitSuccess({email, message}){
  return(
    <div style={{textAlign:"center",padding:"48px 0"}}>
      <div style={{width:60,height:60,background:"var(--blue)",borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 16px",fontSize:26,color:"#fff"}}>✓</div>
      <h3 style={{fontFamily:"var(--ff-h)",fontWeight:700,color:"var(--head)",fontSize:26,marginBottom:8}}>Submitted</h3>
      {email&&<p style={{color:"var(--dim)"}}>We'll reach out to <strong>{email}</strong>.</p>}
      {message&&<p style={{color:"var(--dim)",marginTop:4}}>{message}</p>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  PUBLIC NAV
// ─────────────────────────────────────────────────────────────────────────────
function PublicNav(){
  const [lang,setLang]=useLang();
  const [scrolled,ss]=useState(false);
  const [open,so]=useState(null);
  const [menuOpen,sm]=useState(false);
  useEffect(()=>{
    const fn=()=>ss(window.scrollY>30);
    window.addEventListener("scroll",fn);return()=>window.removeEventListener("scroll",fn);
  },[]);
  const groups=[
    {label:"Who We Are",items:["Overview","Our Story","The Team","Culture","Civic Priorities"]},
    {label:"What We Do",items:["Overview","Private Equity","Private Credit","Commodities","Real Estate"]},
    {label:"Fund Terms",items:[]},
    {label:"Research",items:[]},
    {label:"Contact",items:[]},
  ];
  return(
    <nav style={{position:"fixed",top:0,left:0,right:0,zIndex:500,background:scrolled?"rgba(255,255,255,0.97)":"var(--w)",borderBottom:"var(--bdr)",backdropFilter:"blur(10px)",boxShadow:scrolled?"var(--sh)":"none",transition:"box-shadow 0.2s",overflow:"visible"}}>
      <div style={{maxWidth:1300,margin:"0 auto",padding:"0 40px",height:66,display:"flex",alignItems:"center",gap:0}}>
        <button onClick={()=>navigate("home")} style={{flexShrink:0,lineHeight:1}}><LogoInline size={17}/></button>

        {/* Desktop nav links */}
        <div className="desk-nav" style={{display:"flex",flex:1,alignItems:"stretch",height:"100%",marginLeft:32}} onMouseLeave={()=>so(null)}>
          {groups.map(g=>(
            <div key={g.label} style={{position:"relative",height:"100%",display:"flex",alignItems:"center"}} onMouseEnter={()=>so(g.label)}>
              <button onClick={()=>g.items.length===0&&navigate(g.label)}
                style={{padding:"0 12px",height:"100%",fontSize:13,fontWeight:500,whiteSpace:"nowrap",
                  color:open===g.label?"var(--blue)":"var(--body)",background:"none",
                  borderBottom:open===g.label?"2px solid var(--blue)":"2px solid transparent",transition:"all 0.15s"}}>
                {g.label}
              </button>
              {g.items.length>0&&open===g.label&&(
                <div className="fu" style={{position:"absolute",top:"100%",left:0,background:"var(--w)",border:"var(--bdr)",borderRadius:"var(--rl)",minWidth:210,zIndex:200,boxShadow:"var(--sh-lg)",overflow:"hidden"}}>
                  {g.items.map(item=>(
                    <button key={item} onClick={()=>{navigate(item);so(null);}}
                      style={{display:"block",width:"100%",textAlign:"left",padding:"11px 18px",fontSize:13,color:"var(--body)",background:"none",borderBottom:"1px solid var(--lg)",transition:"background 0.1s"}}
                      onMouseEnter={e=>e.currentTarget.style.background="var(--blue-l)"}
                      onMouseLeave={e=>e.currentTarget.style.background="none"}>
                      {item}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
        <div className="desk-nav" style={{display:"flex",gap:8,marginLeft:16,flexShrink:0,alignItems:"center"}}>
          <button
            onClick={()=>setLang(l=>l==="en"?"fr":"en")}
            style={{padding:"7px 12px",fontSize:11,fontWeight:700,letterSpacing:"0.08em",
              background:"none",border:"1px solid var(--lg)",borderRadius:"var(--r)",
              color:"var(--dim)",cursor:"pointer",transition:"all 0.15s"}}
            onMouseEnter={e=>{e.currentTarget.style.borderColor="var(--blue)";e.currentTarget.style.color="var(--blue)";}}
            onMouseLeave={e=>{e.currentTarget.style.borderColor="var(--lg)";e.currentTarget.style.color="var(--dim)";}}>
            {lang==="en"?"FR":"EN"}
          </button>
          <button style={{...T.btnP,padding:"9px 20px",fontSize:11}} onClick={()=>navigate("investor")}>Investor Portal</button>
        </div>

        {/* Hamburger (mobile) */}
        <button className="mob-btn"
          onClick={()=>sm(v=>!v)}
          aria-label="Menu"
          style={{display:"none",flexDirection:"column",justifyContent:"center",gap:5,padding:"8px",background:"none",border:"none",cursor:"pointer",marginLeft:12,flexShrink:0}}>
          <span style={{display:"block",width:22,height:2,background:"var(--head)",borderRadius:1,transition:"all 0.2s",transform:menuOpen?"rotate(45deg) translate(5px,5px)":"none"}}/>
          <span style={{display:"block",width:22,height:2,background:"var(--head)",borderRadius:1,transition:"opacity 0.2s",opacity:menuOpen?0:1}}/>
          <span style={{display:"block",width:22,height:2,background:"var(--head)",borderRadius:1,transition:"all 0.2s",transform:menuOpen?"rotate(-45deg) translate(5px,-5px)":"none"}}/>
        </button>
      </div>

      {/* Mobile drawer */}
      {menuOpen&&(
        <div style={{position:"absolute",top:"100%",left:0,right:0,background:"var(--w)",borderBottom:"var(--bdr)",boxShadow:"var(--sh-lg)",zIndex:498,maxHeight:"80vh",overflowY:"auto"}}>
          {groups.map(g=>(
            <div key={g.label}>
              {g.items.length===0?(
                <button onClick={()=>{navigate(g.label);sm(false);}}
                  style={{display:"block",width:"100%",textAlign:"left",padding:"14px 24px",fontSize:15,fontWeight:500,color:"var(--body)",background:"none",borderBottom:"1px solid var(--lg)"}}>
                  {g.label}
                </button>
              ):(
                <>
                  <div style={{padding:"14px 24px 4px",fontSize:10,fontWeight:700,letterSpacing:"0.12em",textTransform:"uppercase",color:"var(--blue)",borderBottom:"1px solid var(--lg)"}}>{g.label}</div>
                  {g.items.map(item=>(
                    <button key={item} onClick={()=>{navigate(item);sm(false);}}
                      style={{display:"block",width:"100%",textAlign:"left",padding:"12px 24px 12px 36px",fontSize:14,color:"var(--body)",background:"none",borderBottom:"1px solid var(--lg)"}}>
                      {item}
                    </button>
                  ))}
                </>
              )}
            </div>
          ))}
          <div style={{padding:"16px 24px",display:"flex",flexDirection:"column",gap:10}}>
            <button style={{...T.btnO,width:"100%"}} onClick={()=>setLang(l=>l==="en"?"fr":"en")}>
              {lang==="en"?"Voir en Français 🇫🇷":"View in English 🇬🇧"}
            </button>
            <button style={{...T.btnP,width:"100%"}} onClick={()=>navigate("investor")}>Investor Portal</button>
          </div>
        </div>
      )}
    </nav>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  PUBLIC FOOTER
// ─────────────────────────────────────────────────────────────────────────────
function PublicFooter(){
  const [lang]=useLang();
  const navLinks=lang==="en"
    ?[["Company",["Overview","Our Story","The Team","Civic Priorities","Research"]],
      ["Capital Solutions",["Private Equity","Private Credit","Commodities","Real Estate"]],
      ["Legal",["Privacy","Terms","Notices","Disclosures"]]]
    :[["Entreprise",["Overview","Our Story","The Team","Civic Priorities","Research"]],
      ["Stratégies",["Private Equity","Private Credit","Commodities","Real Estate"]],
      ["Légal",["Privacy","Terms","Notices","Disclosures"]]];
  return(
    <footer style={{background:"var(--head)",color:"rgba(255,255,255,0.65)"}}>
      <div className="px-page" style={{maxWidth:1300,margin:"0 auto",padding:"60px 40px 32px"}}>
        <div className="rg-ft" style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr 1fr",gap:48,marginBottom:48}}>
          <div>
            <div style={{marginBottom:16}}><Logo height={32} dark/></div>
          </div>
          {navLinks.map(([h,items])=>(
            <div key={h}>
              <div style={{fontSize:10,fontWeight:700,letterSpacing:"0.14em",textTransform:"uppercase",color:"var(--blue)",marginBottom:16}}>{h}</div>
              {items.map(i=>(
                <button key={i} onClick={()=>navigate(i)} style={{display:"block",color:"rgba(255,255,255,0.5)",fontSize:13,marginBottom:9,background:"none",transition:"color 0.15s"}}
                  onMouseEnter={e=>e.currentTarget.style.color="#fff"}
                  onMouseLeave={e=>e.currentTarget.style.color="rgba(255,255,255,0.5)"}>{i}</button>
              ))}
            </div>
          ))}
        </div>
        <div style={{borderTop:"1px solid rgba(255,255,255,0.08)",paddingTop:24,display:"flex",justifyContent:"space-between",fontSize:12}}>
          <span>© {new Date().getFullYear()} Prime Alpha Securities. {lang==="en"?"All rights reserved.":"Tous droits réservés."}</span>
          <span>{DOMAIN} · CEMAC · West Africa · USA</span>
        </div>
      </div>
    </footer>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  PUBLIC HOME
// ─────────────────────────────────────────────────────────────────────────────
function PublicHome(){
  const [lang]=useLang();
  return(
    <div>

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section style={{
        minHeight:"100vh",display:"flex",flexDirection:"column",justifyContent:"center",
        background:"var(--head)",color:"#fff",
        padding:"120px max(24px,6vw) 80px",
        position:"relative",overflow:"hidden",
      }}>
        <div style={{position:"absolute",inset:0,
          backgroundImage:"linear-gradient(rgba(255,255,255,0.03) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.03) 1px,transparent 1px)",
          backgroundSize:"80px 80px",pointerEvents:"none"}}/>
        <div style={{position:"absolute",top:0,left:0,width:4,bottom:0,background:"var(--blue)"}}/>
        <div style={{maxWidth:1100,margin:"0 auto",width:"100%",position:"relative",zIndex:1}}>
          <div className="fu" style={{maxWidth:680}}>
            <SectionLabel>{lang==="en"?"Alternative Investment Management":"Gestion d'Investissements Alternatifs"}</SectionLabel>
            <h1 style={{
              fontFamily:"var(--ff-h)",
              fontSize:"clamp(48px,6.5vw,96px)",
              fontWeight:800,lineHeight:0.9,
              color:"#fff",letterSpacing:"-1.5px",
              marginBottom:32,marginTop:8,
            }}>
              {lang==="en"?<>PAN-AFRICAN<br/>ALTERNATIVE<br/><span style={{color:"var(--blue)"}}>PLATFORM.</span></>:<>PLATEFORME<br/>D'INVESTISSEMENT<br/><span style={{color:"var(--blue)"}}>PANAFRICAINE.</span></>}
            </h1>
            <p style={{fontSize:17,color:"rgba(255,255,255,0.55)",maxWidth:520,lineHeight:1.85,marginBottom:40,fontWeight:300}}>
              {lang==="en"
                ?"We deploy capital across Private Equity, Private Credit, Commodities, and Real Estate — building the infrastructure Africa needs, one deal at a time."
                :"Nous déployons des capitaux en Private Equity, Crédit Privé, Matières Premières et Immobilier — construisant les infrastructures dont l'Afrique a besoin, un deal à la fois."}
            </p>
            <div style={{display:"flex",gap:14,flexWrap:"wrap"}}>
              <button style={T.btnP} onClick={()=>navigate("What We Do")}>{lang==="en"?"Our Strategies":"Nos Stratégies"}</button>
              <button style={{...T.btnO,borderColor:"rgba(255,255,255,0.3)",color:"#fff"}} onClick={()=>navigate("Contact")}>{lang==="en"?"Get In Touch":"Nous Contacter"}</button>
            </div>
          </div>
          <div className="fu fu-2" style={{
            display:"grid",gridTemplateColumns:"repeat(4,1fr)",
            gap:0,marginTop:80,paddingTop:48,
            borderTop:"1px solid rgba(255,255,255,0.1)",
          }}>
            {(lang==="en"
              ?[["$1.92M","Assets Under Management"],["153.7%","Blended Return — All Capital"],["4","Active Strategies"],["June 2024","Founded"]]
              :[["1,92 M$","Actifs sous Gestion"],["153,7%","Rendement Pondéré — Tout Capital"],["4","Stratégies Actives"],["Juin 2024","Fondé"]]
            ).map(([v,l],i)=>(
              <div key={l} style={{padding:"0 32px 0 0",borderRight:i<3?"1px solid rgba(255,255,255,0.08)":"none"}}>
                <div style={{fontFamily:"var(--ff-h)",fontSize:"clamp(22px,3vw,40px)",fontWeight:800,color:"#fff",letterSpacing:"-0.5px",lineHeight:1}}>{v}</div>
                <div style={{fontSize:11,letterSpacing:"0.1em",textTransform:"uppercase",color:"rgba(255,255,255,0.4)",marginTop:8}}>{l}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── What We Do ───────────────────────────────────────────────────── */}
      <section style={{padding:"96px max(24px,6vw)",background:"var(--w)"}}>
        <div style={{maxWidth:1100,margin:"0 auto"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end",marginBottom:56}}>
            <div>
              <SectionLabel>{lang==="en"?"Capital Solutions":"Stratégies d'Investissement"}</SectionLabel>
              <h2 style={{fontFamily:"var(--ff-h)",fontSize:"clamp(32px,4vw,52px)",fontWeight:800,color:"var(--head)",letterSpacing:"-0.5px"}}>{lang==="en"?"WHAT WE DO":"CE QUE NOUS FAISONS"}</h2>
            </div>
            <button style={T.btnG} onClick={()=>navigate("What We Do")}>{lang==="en"?"View all →":"Tout voir →"}</button>
          </div>
          <div className="rg-4" style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:1,background:"var(--lg)"}}>
            {(lang==="en"
              ?[
                {code:"PE",name:"Private Equity",desc:"Controlling and meaningful stakes in African businesses — retail, consumer staples, high-growth sectors. 3–7 year hold.",p:"Private Equity"},
                {code:"PC",name:"Private Credit",desc:"Structured direct lending to mid-market businesses underserved by traditional banks. West Africa & Asia. Zero drawdowns to date.",p:"Private Credit"},
                {code:"COM",name:"Commodities",desc:"Physical commodity trading across textiles, luxury goods, agriculture, and livestock. Regional sourcing networks across CEMAC.",p:"Commodities"},
                {code:"RE",name:"Real Estate",desc:"U.S.-based strategy targeting residential and multifamily assets. Fix-and-flip, buy-and-hold, and distressed situations. Currently fundraising.",p:"Real Estate"},
              ]
              :[
                {code:"PE",name:"Private Equity",desc:"Participations majoritaires dans des entreprises africaines — distribution, conso. de base, secteurs à forte croissance. 3–7 ans.",p:"Private Equity"},
                {code:"PC",name:"Crédit Privé",desc:"Prêts structurés aux PME non servies par les banques traditionnelles. Afrique de l'Ouest & Asie. Zéro défaut à ce jour.",p:"Private Credit"},
                {code:"MAT",name:"Matières Premières",desc:"Commerce de matières premières physiques — textile, luxe, agriculture et bétail. Réseaux d'approvisionnement en CEMAC.",p:"Commodities"},
                {code:"IMM",name:"Immobilier",desc:"Stratégie basée aux États-Unis — résidentiel et multifamilial. Réhabilitation-revente, buy-and-hold, situations spéciales. En levée.",p:"Real Estate"},
              ]
            ).map((s,i)=>(
              <div key={s.code} className={`fu fu-${i+1}`}
                style={{background:"var(--w)",padding:32,cursor:"pointer",transition:"background 0.15s"}}
                onMouseEnter={e=>e.currentTarget.style.background="var(--ow)"}
                onMouseLeave={e=>e.currentTarget.style.background="var(--w)"}
                onClick={()=>navigate(s.p)}>
                <div style={{fontSize:11,fontWeight:700,letterSpacing:"0.12em",color:"var(--blue)",marginBottom:14,textTransform:"uppercase"}}>{s.code}</div>
                <h3 style={{fontFamily:"var(--ff-h)",fontSize:20,fontWeight:700,color:"var(--head)",marginBottom:12}}>{s.name}</h3>
                <p style={{fontSize:13,color:"var(--dim)",lineHeight:1.8,marginBottom:20}}>{s.desc}</p>
                <div style={{fontSize:12,color:"var(--blue)",fontWeight:700,letterSpacing:"0.05em"}}>{lang==="en"?"EXPLORE →":"EXPLORER →"}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── About strip ──────────────────────────────────────────────────── */}
      <section style={{background:"var(--head)",padding:"80px max(24px,6vw)"}}>
        <div style={{maxWidth:1100,margin:"0 auto",display:"grid",gridTemplateColumns:"1fr 1fr",gap:80,alignItems:"center"}} className="hero-grid">
          <div>
            <SectionLabel>{lang==="en"?"Our Story":"Notre Histoire"}</SectionLabel>
            <h2 style={{fontFamily:"var(--ff-h)",fontSize:"clamp(28px,3.5vw,48px)",fontWeight:800,color:"#fff",letterSpacing:"-0.5px",marginBottom:20}}>
              {lang==="en"?"FROM DORM ROOMS\nTO A PAN-AFRICAN\nPLATFORM.":"DES SALLES DE COURS\nÀ UNE PLATEFORME\nPANAFRICAINE."}
            </h2>
            <p style={{color:"rgba(255,255,255,0.55)",fontSize:15,lineHeight:1.9,marginBottom:24}}>
              {lang==="en"
                ?"A group of students — engineers, a roboticist, and one very persistent finance guy — started lending money to friends in June 2024. What began as $56,719 in seed capital has grown to $1.92M in AUM across four strategies."
                :"Un groupe d'étudiants — ingénieurs, roboticien et un homme de finance très tenace — ont commencé à prêter de l'argent à leurs amis en juin 2024. Ce qui a commencé avec 56 719 $ est devenu 1,92 M$ d'AUM sur quatre stratégies."}
            </p>
            <blockquote style={{borderLeft:"3px solid var(--blue)",paddingLeft:16,marginBottom:28}}>
              <p style={{color:"rgba(255,255,255,0.65)",fontSize:13,fontStyle:"italic",lineHeight:1.7}}>
                {lang==="en"
                  ?"\"Everyone is running to where the system is already working. We want to build the system.\" — Noe Ikoué, CIO"
                  :"« Tout le monde court là où le système fonctionne déjà. Nous, nous voulons construire le système. » — Noe Ikoué, DII"}
              </p>
            </blockquote>
            <button style={{...T.btnO,borderColor:"rgba(255,255,255,0.3)",color:"#fff"}} onClick={()=>navigate("Overview")}>{lang==="en"?"Who We Are →":"Qui Sommes-Nous →"}</button>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:1,background:"rgba(255,255,255,0.06)"}}>
            {(lang==="en"
              ?[["$56K → $1.92M","Total capital growth since June 2024"],["153.7%","Blended return — all capital deployed"],["+195%","Return in first 11 months (no outside capital)"],["$20M","Conservative AUM target by 2030"]]
              :[["56 K$ → 1,92 M$","Croissance totale depuis juin 2024"],["153,7%","Rendement pondéré — tout capital déployé"],["+195%","Rendement dans les 11 premiers mois"],["20 M$","Objectif AUM conservateur d'ici 2030"]]
            ).map(([k,v])=>(
              <div key={k} style={{background:"rgba(255,255,255,0.03)",padding:"24px 20px"}}>
                <div style={{fontFamily:"var(--ff-h)",fontSize:18,fontWeight:800,color:"var(--blue)",marginBottom:6,lineHeight:1.1}}>{k}</div>
                <div style={{fontSize:11,color:"rgba(255,255,255,0.4)",lineHeight:1.6}}>{v}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Research ─────────────────────────────────────────────────────── */}
      <section style={{padding:"96px max(24px,6vw)",background:"var(--ow)"}}>
        <div style={{maxWidth:1100,margin:"0 auto"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end",marginBottom:48}}>
            <div>
              <SectionLabel>{lang==="en"?"Latest Thinking":"Réflexions Récentes"}</SectionLabel>
              <h2 style={{fontFamily:"var(--ff-h)",fontSize:"clamp(32px,4vw,52px)",fontWeight:800,color:"var(--head)",letterSpacing:"-0.5px"}}>{lang==="en"?"RESEARCH & INSIGHTS":"RECHERCHE & ANALYSES"}</h2>
            </div>
            <button style={T.btnG} onClick={()=>navigate("Research")}>{lang==="en"?"All articles →":"Tous les articles →"}</button>
          </div>
          <div className="rg-2" style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20}}>
            {SEED["articles"].slice(0,2).map((a,i)=>(
              <div key={a.articleId} className={`fu fu-${i+1}`}
                style={{...T.card,display:"flex",flexDirection:"column",gap:14,cursor:"pointer",transition:"all 0.2s",borderLeft:"3px solid transparent"}}
                onMouseEnter={e=>{e.currentTarget.style.borderLeftColor="var(--blue)";e.currentTarget.style.boxShadow="var(--sh-md)";}}
                onMouseLeave={e=>{e.currentTarget.style.borderLeftColor="transparent";e.currentTarget.style.boxShadow="var(--sh)";}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <span style={T.tag()}>{a.category}</span>
                  <span style={{fontSize:11,color:"var(--dim)",fontFamily:"var(--ff-m)"}}>{a.date}</span>
                </div>
                <h3 style={{fontFamily:"var(--ff-h)",fontSize:20,fontWeight:700,color:"var(--head)",lineHeight:1.25}}>{a.title}</h3>
                <p style={{fontSize:13,color:"var(--dim)",lineHeight:1.8,flex:1}}>{a.excerpt}</p>
                <div style={{fontSize:12,color:"var(--dim)",borderTop:"1px solid var(--lg)",paddingTop:12}}>{a.author}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────────────────────── */}
      <section style={{background:"var(--blue)",padding:"80px max(24px,6vw)"}}>
        <div style={{maxWidth:1100,margin:"0 auto",display:"flex",justifyContent:"space-between",alignItems:"center",gap:40,flexWrap:"wrap"}}>
          <div>
            <div style={{fontSize:10,fontWeight:700,letterSpacing:"0.18em",textTransform:"uppercase",color:"rgba(255,255,255,0.6)",marginBottom:10}}>{lang==="en"?"Speak With Us":"Parlez-Nous"}</div>
            <h2 style={{fontFamily:"var(--ff-h)",fontSize:"clamp(28px,4vw,48px)",fontWeight:800,color:"#fff",letterSpacing:"-0.5px"}}>{lang==="en"?"READY TO INVEST?":"PRÊT À INVESTIR ?"}</h2>
          </div>
          <div style={{display:"flex",gap:14,flexWrap:"wrap"}}>
            <button style={{...T.btnP,background:"#fff",color:"var(--blue)"}} onClick={()=>navigate("Contact")}>{lang==="en"?"Get In Touch":"Nous Contacter"}</button>
            <button style={{...T.btnO,borderColor:"rgba(255,255,255,0.4)",color:"#fff"}} onClick={()=>navigate("investor")}>{lang==="en"?"Investor Portal":"Espace Investisseur"}</button>
          </div>
        </div>
      </section>

    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  WHO WE ARE
// ─────────────────────────────────────────────────────────────────────────────
function WhoWeAre({sub}){
  const [lang]=useLang();
  const C={
    Overview:{
      en:{h:"Who We Are",body:"Prime Alpha Securities is a Pan-African alternative investment management firm founded in June 2024 by three co-founders — an economist, a commodity engineer, and a technologist. We deploy flexible capital across Private Equity, Private Credit, Commodities, and Real Estate — primarily across CEMAC and West African markets, with an expanding U.S. Real Estate platform. We exist to correct a specific capital market failure: the Missing Middle of African business — companies too large for microfinance and too informal for institutional PE.",
        stats:[["June 2024","Founded","CEMAC / West Africa"],["$1.92M","AUM — Dec. 2026","Across 4 strategies"],["153.7%","Blended Return","All capital ever deployed"],["$20M","2030 Target","Conservative AUM target"]]},
      fr:{h:"Qui Sommes-Nous",body:"Prime Alpha Securities est une firme panafricaine de gestion d'investissements alternatifs fondée en juin 2024 par trois co-fondateurs. Nous déployons des capitaux flexibles en Private Equity, Crédit Privé, Matières Premières et Immobilier — principalement sur les marchés CEMAC et Afrique de l'Ouest, avec une plateforme Immobilier en expansion aux États-Unis.",
        stats:[["Juin 2024","Fondé","CEMAC / Afrique de l'Ouest"],["1,92 M$","AUM — Déc. 2026","Sur 4 stratégies"],["153,7%","Rendement Pondéré","Tout capital déployé"],["20 M$","Objectif 2030","Scénario conservateur"]]},
    },
    Culture:{
      en:{h:"Our Culture",body:"Culture is not what you say you believe. It is what you do when you are under pressure, short on time, and the right answer is inconvenient. These are the non-negotiables that define how we operate — built before pressure tested them.",
        pillars:[
          ["Eat What You Kill","Every deal team is directly accountable for the returns they generate. No hiding behind aggregated fund performance. We hunt together, but individual accountability is absolute."],
          ["Zero Tolerance for Bribery","Any engagement in bribery of public officials — by any team member or portfolio company — results in immediate divestment and disclosure to LPs. No exceptions for 'how business is done here.'"],
          ["Fiduciary Primacy","LP interests are never subordinated to personal founder interests. All conflicts of interest are disclosed within 24 hours of identification. This is not a guideline — it is a non-negotiable."],
          ["First-Mover Mindset","We are not replicating Wall Street in Africa. We are building something only Africa could create — with its own rhythm, ambition, and rules. The CEMAC region's structural constraints are our competitive moat, not a limitation."],
          ["Legal Compliance — Always","We do not make investments in markets where operating legally is structurally impossible, regardless of return opportunity. Tone at the top is a behavioral pattern, not a communication strategy."],
          ["Disagreement on the Record","When founders disagree on an investment or strategic decision and one is overruled, the dissenting position is recorded in investment committee minutes. We prevent revisionism by documenting it."],
        ]},
      fr:{h:"Notre Culture",body:"La culture n'est pas ce que vous dites croire. C'est ce que vous faites sous pression, en manque de temps, quand la bonne réponse est inconfortable. Ce sont les non-négociables qui définissent notre façon d'opérer.",
        pillars:[
          ["On Mange Ce Qu'on Chasse","Chaque équipe de deal est directement responsable des rendements qu'elle génère. Pas de refuge derrière une performance agrégée. Nous chassons ensemble, mais la responsabilité individuelle est absolue."],
          ["Tolérance Zéro pour la Corruption","Tout engagement dans la corruption de fonctionnaires — par tout membre de l'équipe ou société du portefeuille — entraîne une désinvestissement immédiat et une divulgation aux LPs. Aucune exception."],
          ["Primauté Fiduciaire","Les intérêts des LPs ne sont jamais subordonnés aux intérêts personnels des fondateurs. Tous les conflits d'intérêts sont divulgués dans les 24 heures suivant leur identification."],
          ["Esprit Pionnier","Nous ne répliquons pas Wall Street en Afrique. Nous construisons quelque chose que seule l'Afrique pouvait créer — avec son rythme, ses ambitions, ses règles."],
          ["Conformité Légale — Toujours","Nous n'investissons pas dans des marchés où opérer légalement est structurellement impossible, quelle que soit l'opportunité de rendement."],
          ["Désaccord Consigné","Quand les fondateurs ne sont pas d'accord sur une décision, la position dissidente est enregistrée dans les procès-verbaux du comité d'investissement."],
        ]},
    },
    "Our Story":{
      en:{eyebrow:"Genesis",h:"OUR STORY",body:"The unlikely origin story nobody saw coming — except us.",
        timeline:[
          ["June 2024","The Spark","A group of college students — engineers, a roboticist, and one very persistent finance guy — started lending money to friends. Informally. Profitably. Repeatedly. What began as peer-to-peer credit became the kernel of an institutional investment firm."],
          ["Q3 2024","The Realization","Noe Ikoué looked at the group's chaotic deals and said: 'We're already running a fund. Let's make it official.' The informal activity had a track record. It just needed a structure — and the discipline to turn it into something institutional."],
          ["Q4 2024","The Pivot","They explored a hedge fund model — until they looked carefully at CEMAC markets. Illiquid. Limited derivatives. No short-selling infrastructure. The data said change. They pivoted to Private Equity and built a flexible capital thesis around the specific failures of the markets they knew."],
          ["2025","Formalization","The multi-strategy framework took shape. Original capital of $56,719 grew to $167,388 — a +195% return in 11 months with zero outside capital. A verifiable track record was underway. The firm's DNA was written."],
          ["2026","The Platform","A $700K capital raise grew to $1.285M. The original capital base continued compounding to $634,800. After partial profit distributions, total AUM reached $1.92M across four active strategies. Real Estate fundraising launched in the U.S."],
        ],
        quote:"\"Everyone is running to where the system is already working. We want to build the system.\" — Noe Ikoué, CIO"},
      fr:{eyebrow:"Genèse",h:"NOTRE HISTOIRE",body:"L'histoire improbable que personne n'avait vue venir — sauf nous.",
        timeline:[
          ["Juin 2024","L'Étincelle","Un groupe d'étudiants — ingénieurs, roboticien et un homme de finance très tenace — ont commencé à prêter de l'argent à leurs amis. Informellement. Avec profit. Régulièrement."],
          ["T3 2024","La Prise de Conscience","Noe Ikoué regarda les transactions chaotiques du groupe et dit : « On gère déjà un fonds. Formalisons la chose. » L'activité informelle avait un historique. Il lui fallait juste une structure."],
          ["T4 2024","Le Pivot","Ils envisagèrent un hedge fund — jusqu'à l'analyse approfondie des marchés CEMAC. Illiquides. Peu de dérivés. Short selling quasi inexistant. Les données imposaient un changement. Pivot vers le Private Equity."],
          ["2025","Formalisation","Le cadre multi-stratégies a pris forme. Le capital initial de 56 719 $ a crû jusqu'à 167 388 $ — un rendement de +195% en 11 mois sans capital extérieur."],
          ["2026","La Plateforme","Une levée de 700 K$ est passée à 1 285 200 $. L'AUM total a atteint 1,92 M$ sur quatre stratégies actives. Lancement de la levée Immobilier aux États-Unis."],
        ],
        quote:"« Tout le monde court là où le système fonctionne déjà. Nous, nous voulons construire le système. » — Noe Ikoué, DII"},
    },
    "The Team":{
      en:{h:"The Team",
        people:[
          {n:"Noe Désiré Ikoué",t:"Co-Founder & CIO",b:"The architect behind Prime Alpha's multi-strategy framework. With a background in economics, finance, and derivatives, Noe leads cross-strategy risk coordination and portfolio design. He formalized the firm's lending operations and built the pivot to the private equity model — from scratch, while still a student.",creds:"BBA Finance · M.Sc. Financial Mathematics"},
          {n:"Balde Ibrahima",t:"Co-Founder & COO",b:"Leads Prime Commodities Capital with operational depth no spreadsheet can replicate. A Quality Engineer at Michelin, Ibrahima manages physical commodity trading across livestock, textiles, and agriculture — building local sourcing networks across the CEMAC and West African corridor.",creds:"B.Sc. Chemical Engineering · Agribusiness & Trade Flow Specialist"},
          {n:"Johan A. Botouli",t:"Co-Founder & CTO",b:"Leads all technology infrastructure across the firm and its portfolio holdings. Johan builds the systems that support Prime Alpha's scalability — data pipelines, cloud architecture, and tech-enabled value creation. His robotics and AI background brings systems thinking to investment operations.",creds:"B.Eng. Robotics & AI · AWS-Certified Cloud Engineer, Python Specialist"},
        ]},
      fr:{h:"L'Équipe",
        people:[
          {n:"Noe Désiré Ikoué",t:"Co-Fondateur & DII",b:"L'architecte du cadre multi-stratégies de Prime Alpha. Avec une formation en économie, finance et dérivés, Noe dirige la coordination des risques inter-stratégies et la conception du portefeuille. Il a formalisé les opérations de prêt de la firme et structuré le pivot vers le private equity — encore étudiant.",creds:"BBA Finance · M.Sc. Mathématiques Financières"},
          {n:"Balde Ibrahima",t:"Co-Fondateur & DGO",b:"Dirige Prime Commodities Capital avec une profondeur opérationnelle qu'aucun tableur ne peut reproduire. Ingénieur qualité chez Michelin, Ibrahima gère le négoce de matières premières physiques — bétail, textile, agriculture — en construisant des réseaux d'approvisionnement locaux dans le corridor CEMAC et Afrique de l'Ouest.",creds:"B.Sc. Génie Chimique · Spécialiste Agrobusiness & Flux Commerciaux"},
          {n:"Johan A. Botouli",t:"Co-Fondateur & DTC",b:"Dirige toute l'infrastructure technologique de la firme et de ses participations. Johan construit les systèmes qui soutiennent la scalabilité de Prime Alpha — pipelines de données, architecture cloud, création de valeur technologique.",creds:"B.Eng. Robotique & IA · Ingénieur Cloud AWS Certifié, Spécialiste Python"},
        ]},
    },
    Leadership:{
      en:{h:"The Team",
        people:[
          {n:"Noe Désiré Ikoué",t:"Co-Founder & CIO",b:"The architect behind Prime Alpha's multi-strategy framework. With a background in economics, finance, and derivatives, Noe leads cross-strategy risk coordination and portfolio design. He formalized the firm's lending operations and built the pivot to the private equity model — from scratch, while still a student.",creds:"BBA Finance · M.Sc. Financial Mathematics"},
          {n:"Balde Ibrahima",t:"Co-Founder & COO",b:"Leads Prime Commodities Capital with operational depth no spreadsheet can replicate. A Quality Engineer at Michelin, Ibrahima manages physical commodity trading across livestock, textiles, and agriculture.",creds:"B.Sc. Chemical Engineering · Agribusiness & Trade Flow Specialist"},
          {n:"Johan A. Botouli",t:"Co-Founder & CTO",b:"Leads all technology infrastructure across the firm and its portfolio holdings.",creds:"B.Eng. Robotics & AI · AWS-Certified Cloud Engineer, Python Specialist"},
        ]},
      fr:{h:"L'Équipe",
        people:[
          {n:"Noe Désiré Ikoué",t:"Co-Fondateur & DII",b:"L'architecte du cadre multi-stratégies de Prime Alpha. Avec une formation en économie, finance et dérivés, Noe dirige la coordination des risques inter-stratégies et la conception du portefeuille. Il a formalisé les opérations de prêt de la firme et structuré le pivot vers le private equity — encore étudiant.",creds:"BBA Finance · M.Sc. Mathématiques Financières"},
          {n:"Balde Ibrahima",t:"Co-Fondateur & DGO",b:"Dirige Prime Commodities Capital avec une profondeur opérationnelle qu'aucun tableur ne peut reproduire. Ingénieur qualité chez Michelin, Ibrahima gère le négoce de matières premières physiques — bétail, textile, agriculture — en construisant des réseaux d'approvisionnement locaux dans le corridor CEMAC et Afrique de l'Ouest.",creds:"B.Sc. Génie Chimique · Spécialiste Agrobusiness & Flux Commerciaux"},
          {n:"Johan A. Botouli",t:"Co-Fondateur & DTC",b:"Dirige toute l'infrastructure technologique de la firme et de ses participations. Johan construit les systèmes qui soutiennent la scalabilité de Prime Alpha — pipelines de données, architecture cloud, création de valeur technologique. Son background en robotique et IA apporte une pensée systémique.",creds:"B.Eng. Robotique & IA · Ingénieur Cloud AWS Certifié, Spécialiste Python"},
        ]},
    },
    "Civic Priorities":{
      en:{h:"Civic Priorities",body:"We believe flexible capital carries civic responsibility. The capital market failure we exist to correct is not a generic 'Africa needs capital' story — it is a specific diagnosis of where the system fails and why. Our priorities are built from that diagnosis.",
        civics:[
          ["We are dedicated problem solvers committed to driving impact within our firm and across our communities. By giving our time, talent and expertise, we are working to advance opportunity and improve lives."]
        ]},
      fr:{h:"Priorités Civiques",body:"Nous croyons que le capital flexible porte une responsabilité civique. La défaillance du marché des capitaux que nous existons pour corriger n'est pas une histoire générique — c'est un diagnostic précis de l'endroit où le système échoue et pourquoi.",
        civics:[
          ["Le Maillon Manquant","Les entreprises générant 500 K$–10 M$ de chiffre d'affaires annuel, employant 20 à 200 personnes, et nécessitant des capitaux de croissance de 500 K$ à 15 M$ n'ont pas de foyer institutionnel. Trop grandes pour la microfinance, trop informelles pour le PE institutionnel."],
          ["Pourquoi les Banques Échouent","Les banques commerciales au Sénégal et au Cameroun répondent rationnellement à leurs propres structures d'incitation — souscription basée sur les garanties, dépôts à court terme, KYC calibré pour les entreprises formelles. La plupart des entreprises à forte croissance ne correspondent pas."],
          ["Inclusion Financière","57% de la population africaine est non bancarisée. Le crédit privé comble un vide structurel de financement. L'accès au capital patient n'est pas un luxe — c'est la différence entre une entreprise qui grandit et une qui stagne."],
          ["Présence Locale, Standards Internationaux","Présence locale signifie présence physique sur le marché, personnel local avec des réseaux opérationnels. Standards internationaux signifie comptabilité IFRS et structures de gouvernance que les LPs institutionnels peuvent auditer sans friction."],
        ]},
    },
  };
  const c=C[sub]||C.Overview;
  const d=c[lang]||c.en;
  return(
    <div>
      <PageHero eyebrow={lang==="en"?"Who We Are":"Qui Sommes-Nous"} title={d.h.toUpperCase()} body={d.body}/>
      <div style={{maxWidth:960,margin:"0 auto",padding:"64px max(16px,4vw)"}}>
        {d.stats&&<div className="rg-4" style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:20}}>
          {d.stats.map(([v,l,s])=>(
            <div key={l} style={{...T.card,borderTop:"3px solid var(--blue)"}}>
              <div style={{fontFamily:"var(--ff-h)",fontSize:38,fontWeight:800,color:"var(--blue)"}}>{v}</div>
              <div style={{fontWeight:700,color:"var(--head)",marginTop:4}}>{l}</div>
              <div style={{color:"var(--dim)",fontSize:13}}>{s}</div>
            </div>
          ))}
        </div>}
        {d.pillars&&d.pillars.map(([t,desc])=>(
          <div key={t} style={{...T.card,marginBottom:14,borderLeft:"3px solid var(--blue)"}}>
            <h3 style={{...T.hdg,fontSize:18,marginBottom:8}}>{t}</h3>
            <p style={{color:"var(--dim)",lineHeight:1.85}}>{desc}</p>
          </div>
        ))}
        {d.people&&<div className="rg-2" style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20}}>
          {d.people.map(p=>(
            <div key={p.n} style={T.card}>
              <div style={{width:50,height:50,background:"var(--blue)",borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontFamily:"var(--ff-h)",fontSize:18,fontWeight:800,marginBottom:14}}>
                {p.n.split(" ").map(x=>x[0]).join("")}
              </div>
              <h3 style={{...T.hdg,fontSize:17}}>{p.n}</h3>
              <div style={{fontSize:10,fontWeight:700,letterSpacing:"0.09em",textTransform:"uppercase",color:"var(--blue)",marginBottom:10}}>{p.t}</div>
              <p style={{fontSize:13,color:"var(--dim)",lineHeight:1.75,marginBottom:10}}>{p.b}</p>
              <div style={{fontSize:11,color:"var(--dim)",borderTop:"1px solid var(--lg)",paddingTop:10}}>{p.creds}</div>
            </div>
          ))}
        </div>}
        {d.timeline&&<div style={{marginTop:8}}>
          {d.timeline.map(([date,title,body],i)=>(
            <div key={date} style={{display:"grid",gridTemplateColumns:"100px 1fr",gap:20,paddingBottom:32,position:"relative"}}>
              {i<d.timeline.length-1&&<div style={{position:"absolute",left:44,top:28,bottom:0,width:1,background:"var(--lg)"}}/>}
              <div style={{paddingTop:2}}>
                <div style={{width:10,height:10,background:"var(--blue)",borderRadius:"50%",marginBottom:6,marginLeft:40}}/>
                <div style={{fontSize:10,fontWeight:700,color:"var(--blue)",letterSpacing:"0.07em",lineHeight:1.4}}>{date}</div>
              </div>
              <div style={{...T.card}}>
                <h3 style={{fontFamily:"var(--ff-h)",fontSize:19,fontWeight:700,color:"var(--head)",marginBottom:8}}>{title}</h3>
                <p style={{fontSize:14,color:"var(--dim)",lineHeight:1.8}}>{body}</p>
              </div>
            </div>
          ))}
          {d.quote&&<blockquote style={{borderLeft:"3px solid var(--blue)",paddingLeft:20,marginTop:8}}>
            <p style={{color:"var(--body)",fontSize:15,fontStyle:"italic",lineHeight:1.7}}>{d.quote}</p>
          </blockquote>}
        </div>}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  WHAT WE DO
// ─────────────────────────────────────────────────────────────────────────────
function WhatWeDo({ sub }) {
  const [lang] = useLang();

  // ── Strategy content ──────────────────────────────────────────────────────
  const STRATEGIES = {

    "Private Equity": {
      en: {
        eyebrow: "Capital Solutions",
        body: "We acquire controlling or meaningful stakes in private businesses across Africa, with a focus on operational transformation and long-term value creation. Our approach spans buy-and-build programs, sector consolidation and selective public-to-private transactions in markets where we have deep local knowledge.",
        items: [
          "Geographic focus on CEMAC and West African markets, primarily in retail, consumer staples and high-growth sectors.",
          "We pursue buy-and-build programs and sector consolidation where fragmented markets create a structural opportunity.",
          "Target hold periods typically range from three to seven years, with exits designed to preserve and extend the value created.",
          "We prioritise businesses with strong cash generation and defensible market positions, particularly in consumer-facing sectors.",
        ],
      },
      fr: {
        eyebrow: "Stratégies d'Investissement",
        body: "Nous acquérons des participations significatives ou majoritaires dans des entreprises privées africaines, avec pour objectif une transformation opérationnelle et une création de valeur à long terme. Notre approche couvre les build-ups, la consolidation sectorielle et des sorties de cote dans des marchés où nous disposons d'une connaissance locale approfondie.",
        items: [
          "Focus géographique sur les marchés CEMAC et Afrique de l'Ouest, principalement dans la distribution, la consommation courante et les secteurs à forte croissance.",
          "Nous menons des programmes de build-up et de consolidation sectorielle là où la fragmentation crée une opportunité structurelle.",
          "Les durées de détention visées s'étendent généralement de trois à sept ans, avec des sorties conçues pour préserver et amplifier la valeur créée.",
          "Nous privilégions les entreprises à forte génération de trésorerie et à position de marché défendable.",
        ],
      },
    },

    "Commodities": {
      en: {
        eyebrow: "Capital Solutions",
        body: "We invest in and trade physical commodities across a wide range of commodities due to their high demand and stability. Our edge is built on regional sourcing networks and deep supply chain knowledge developed on the ground across the CEMAC and West African corridor.",
        items: [
          "Textile and cotton trade across CEMAC and West Africa, leveraging established sourcing relationships.",
          "Luxury goods serving rising urban demand in Senegal, Cameroon and West Africa more broadly.",
          "Agricultural commodities including grains and soft commodities with logistics managed regionally.",
          "Livestock and cattle sourced through local networks with strong operational oversight.",
          "We focus on commodities with strong local demand and supply dynamics, where our regional expertise creates a competitive advantage.",
        ],
      },
      fr: {
        eyebrow: "Stratégies d'Investissement",
        body: "Nous investissons et négocions des matières premières physiques sur quatre verticaux : textile et coton, produits de luxe, matières premières agricoles incluant céréales et cultures tendres, et élevage. Notre avantage repose sur des réseaux d'approvisionnement régionaux et une connaissance approfondie de la chaîne logistique dans le corridor CEMAC et Afrique de l'Ouest.",
        items: [
          "Commerce du textile et du coton à travers le CEMAC et l'Afrique de l'Ouest, en s'appuyant sur des relations d'approvisionnement établies.",
          "Produits de luxe répondant à la demande urbaine croissante au Sénégal, au Cameroun et dans l'Afrique de l'Ouest.",
          "Matières premières agricoles incluant céréales et cultures tendres avec une logistique gérée régionalement.",
          "Bétail et élevage approvisionnés via des réseaux locaux avec un suivi opérationnel solide.",
        ],
      },
    },

    "Real Estate": {
      en: {
        eyebrow: "Capital Solutions",
        body: " We target wide range of properties through different strategies. Renovation and resale, long-term buy-and-hold, and distressed or special situation acquisitions. As capital scales, the mandate expands into commercial, office and warehouse assets.",
        items: [
          "Primary market focus on the United States, targeting residential and multifamily properties where value-add opportunities are clearly identifiable.",
          "Core strategies include renovation and resale programs, long-term income-generating holdings, and distressed or special situation acquisitions.",
          "The mandate is designed to expand into commercial, office and warehouse properties as the capital base grows.",
          "This strategy is currently in active fundraising. Reach out to discuss participation and allocation.",
        ],
      },
      fr: {
        eyebrow: "Stratégies d'Investissement",
        body: " Nous ciblons une large gamme de biens à travers différentes stratégies. Rénovation-revente, détention à long terme génératrice de revenus, et acquisitions en difficulté ou situations spéciales. À mesure que le capital augmente, le mandat s'étend aux actifs commerciaux, bureaux et entrepôts.",
        items: [
          "Focus principal sur les États-Unis, ciblant les biens résidentiels et multifamiliaux où les opportunités de création de valeur sont clairement identifiables.",
          "Les stratégies principales incluent les programmes de réhabilitation-revente, les détentions génératrices de revenus à long terme, et les acquisitions en difficulté ou situations spéciales.",
          "Le mandat est conçu pour s'étendre aux biens commerciaux, bureaux et entrepôts au fur et à mesure de la croissance du capital.",
          "Cette stratégie est en levée de fonds active. Contactez-nous pour discuter de votre participation et allocation.",
        ],
      },
    },
  };

  // ── Overview page ─────────────────────────────────────────────────────────
  if (sub === "Overview") {
    const cards = [
      { key: "Private Equity",  label: lang === "en" ? "Private Equity"  : "Private Equity"  },
      { key: "Private Credit",  label: lang === "en" ? "Private Credit"  : "Crédit Privé"    },
      { key: "Commodities",     label: lang === "en" ? "Commodities"     : "Matières Premières" },
      { key: "Real Estate",     label: lang === "en" ? "Real Estate"     : "Immobilier"      },
    ];
    return (
      <div>
        <PageHero
          eyebrow={lang === "en" ? "Capital Solutions" : "Stratégies d'Investissement"}
          title={lang === "en" ? "WHAT WE DO" : "CE QUE NOUS FAISONS"}
          body={lang === "en"
            ? "Prime Alpha Securities operates four integrated capital platforms, each with dedicated teams and independent mandates coordinated at the portfolio level."
            : "Prime Alpha Securities opère quatre plateformes de capital intégrées, chacune avec des équipes dédiées et des mandats indépendants coordonnés au niveau du portefeuille global."}
        />
        <div style={{ maxWidth: 960, margin: "0 auto", padding: "64px max(16px,4vw)" }}>
          <div className="rg-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
            {cards.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => navigate(key)}
                style={{ ...T.card, textAlign: "left", cursor: "pointer", borderLeft: "3px solid var(--blue)", transition: "box-shadow 0.15s" }}
                onMouseEnter={e => e.currentTarget.style.boxShadow = "var(--sh-md)"}
                onMouseLeave={e => e.currentTarget.style.boxShadow = "var(--sh)"}
              >
                <h3 style={{ ...T.hdg, fontSize: 20, marginBottom: 6 }}>{label}</h3>
                <div style={{ color: "var(--blue)", fontSize: 13, fontWeight: 700 }}>
                  {lang === "en" ? "Explore →" : "Explorer →"}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ── Private Credit delegates to its own component ─────────────────────────
  if (sub === "Private Credit") return <PrivateCreditPublic />;

  // ── PE / Commodities / Real Estate ────────────────────────────────────────
  const strategy = STRATEGIES[sub];
  const d = strategy ? (strategy[lang] || strategy.en) : null;

  if (!d) return (
    <div style={{ padding: "120px 40px", textAlign: "center", color: "var(--dim)" }}>
      {lang === "en" ? "Strategy not found." : "Stratégie introuvable."}
    </div>
  );

  return (
    <div>
      <PageHero eyebrow={d.eyebrow} title={sub.toUpperCase()} body={d.body} />
      <div style={{ maxWidth: 960, margin: "0 auto", padding: "64px max(16px,4vw)" }}>
        {d.items.map((item, i) => (
          <div key={i} style={{ display: "flex", gap: 16, padding: "16px 0", borderBottom: "1px solid var(--lg)" }}>
            <div style={{ width: 8, height: 8, background: "var(--blue)", borderRadius: "50%", flexShrink: 0, marginTop: 8 }} />
            <span style={{ color: "var(--body)", fontSize: 15, lineHeight: 1.75 }}>{item}</span>
          </div>
        ))}
        <div style={{ marginTop: 40 }}>
          <button style={T.btnP} onClick={() => navigate("Contact")}>
            {lang === "en" ? "Discuss This Strategy" : "Discuter de cette Stratégie"}
          </button>
        </div>
      </div>
    </div>
  );
}

function PrivateCreditPublic(){
  const [form,sf]=useState({type:"business",loanType:"secured",name:"",email:"",phone:"",amount:"",purpose:"",availability:""});
  const [sub,ss]=useState(false);
  const [saving,sv]=useState(false);
  const set=k=>e=>sf(p=>({...p,[k]:e.target.value}));
  const submit=async()=>{
    if(!form.name||!form.email||!form.amount){alert("Please complete required fields.");return;}
    sv(true);
    await notify.credit({ ...form, submittedAt: now() });
    sv(false);ss(true);
  };
  return(
    <div>
      <PageHero eyebrow="Direct Lending" title="PRIVATE CREDIT" body="Bespoke credit solutions for businesses and individuals where speed, certainty, and structural flexibility are paramount."/>
      <div style={{maxWidth:960,margin:"0 auto",padding:"64px max(16px,4vw)"}}>
        <div className="rg-2" style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:18,marginBottom:56}}>
          {[
            ["Direct Lending",          "Senior secured loans to established businesses with predictable cash flows and identifiable collateral."],
            ["Unitranche",              "One-stop financing that combines senior and subordinated debt into a single facility, simplifying the capital structure for the borrower."],
            ["Secured Personal Credit", "Asset-backed facilities against liquid and illiquid collateral for high-net-worth individuals."],
            ["Unsecured Business Credit","Cash-flow-based lending for businesses with strong and recurring revenue visibility."],
          ].map(([t, d]) => (
            <div key={t} style={{...T.card,borderLeft:"3px solid var(--blue)"}}>
              <h3 style={{...T.hdg,fontSize:17,marginBottom:8}}>{t}</h3>
              <p style={{fontSize:13,color:"var(--dim)",lineHeight:1.75}}>{d}</p>
            </div>
          ))}
        </div>
        <div style={T.card}>
          <h2 style={{ ...T.hdg, fontSize: 26, marginBottom: 6 }}>Loan Inquiry</h2>
          <p style={{ color: "var(--dim)", fontSize: 13, marginBottom: 28 }}>
            Submit your inquiry and our credit team will contact you within two business days to schedule a call.
          </p>
          {sub?(
            <SubmitSuccess email={form.email} message="Our credit team will contact you within 2 business days."/>
          ):(
            <div>
              <div className="form-2col" style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:0}}>
                <Sel label="Applicant Type" value={form.type} onChange={set("type")} options={[{value:"business",label:"Business / Corporate"},{value:"individual",label:"Individual / HNW"}]}/>
                <div style={{paddingLeft:16}}><Sel label="Loan Type" value={form.loanType} onChange={set("loanType")} options={[{value:"secured",label:"Secured"},{value:"unsecured",label:"Unsecured"}]}/></div>
                <Inp label="Full Name / Company *" value={form.name} onChange={set("name")}/>
                <div style={{paddingLeft:16}}><Inp label="Email *" type="email" value={form.email} onChange={set("email")}/></div>
                <Inp label="Phone" value={form.phone} onChange={set("phone")}/>
                <div style={{paddingLeft:16}}><Inp label="Amount Requested (USD) *" value={form.amount} onChange={set("amount")}/></div>
              </div>
              <TA label="Purpose / Business Description" value={form.purpose} onChange={set("purpose")}/>
              <Inp label="Availability for Call" value={form.availability} onChange={set("availability")} placeholder="e.g. Weekdays 9am–12pm EST"/>
              <button style={T.btnP} onClick={submit} disabled={saving}>{saving?"Submitting…":"Submit Inquiry"}</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
//  FUND TERMS
// ─────────────────────────────────────────────────────────────────────────────
function FundTerms(){
  const [lang]=useLang();
  const copy={
    en:{
      eyebrow:"Structure",h:"FUND TERMS",
      sub:"Clear terms. Aligned incentives. We want investors who share our values, our patience, and our conviction in what Africa can become. If you trust us, we will make you a great deal of money.",
      terms:[["2.0%","Management Fee","Annual, on committed capital"],["20%","Performance Fee","Of profits above the hurdle rate"],["12%","Hurdle Rate","Annual — investors paid first"],["1 Year","Lock-Up Period","Strategy-dependent; capital call structure"]],
      thesisTitle:"The Flexible Capital Thesis",
      thesis:"Flexible capital means the ability to deploy across the capital structure — equity, mezzanine, senior secured debt, and convertible instruments — depending on what a given company actually needs at a given stage. The same company needs different instruments at different stages of its lifecycle. A fund that can only offer one instrument is forced to either pass on good companies at the wrong stage or deploy the wrong instrument. Flexible capital removes that constraint.",
      thesisPoints:[
        "A company raising its first institutional round needs equity and founder alignment — lead with minority equity, preserve upside.",
        "A company with proven revenue but tight margins needs working capital that doesn't dilute — use revenue-based finance or a senior facility.",
        "A company making a major capital investment needs long-tenor debt — provide a mezzanine bridge while it waits for bank eligibility.",
        "A company approaching acquisition readiness needs bridge equity and valuation support — provide convertible notes with strategic rights.",
      ],
      howTitle:"How the Fund Works",
      steps:[[
        "Each strategy operates under its own mandate with a dedicated team — PE, Private Credit, Commodities, and Real Estate each have distinct investment processes.",
        "Capital calls are deployed across strategies based on mandate and opportunity set. Investors may participate in one or more fund verticals.",
        "Performance is calculated per fund. An 'eat what you kill' culture means every deal team is directly accountable for the returns they generate.",
        "Minimum investment levels and co-investment opportunities are available on a case-by-case basis. Contact us to discuss your allocation.",
      ],
        ["2025", "Foundation",  "Multi-strategy fund formalised. First institutional-quality track record established with zero outside capital."],
        ["2026", "Scale",       "Four active strategies running simultaneously. Real Estate fundraise launched in the United States."]
        ["2027 onward", "TBC",  "Milestones and targets for subsequent years are being formalised and will be published once confirmed."]
      ],
      cta:"Get In Touch",
    },
    fr:{
      eyebrow:"Structure",h:"CONDITIONS DU FONDS",
      sub:"Des conditions claires. Des intérêts alignés. Nous cherchons des investisseurs qui partagent nos valeurs, notre patience et notre conviction dans ce que l'Afrique peut devenir.",
      terms:[["2,0%","Frais de Gestion","Annuels, sur le capital engagé"],["20%","Frais de Performance","Des profits au-dessus du taux plancher"],["12%","Taux Plancher","Annuel — les investisseurs sont payés en premier"],["1 An","Période de Blocage","Selon la stratégie ; structure de capital calls"]],
      thesisTitle:"La Thèse du Capital Flexible",
      thesis:"Le capital flexible signifie la capacité de déployer sur toute la structure du capital — equity, mezzanine, dette senior sécurisée, instruments convertibles — selon ce dont une entreprise a réellement besoin à un stade donné. La même entreprise a besoin d'instruments différents à différentes étapes de son cycle de vie.",
      thesisPoints:[
        "Une entreprise levant son premier tour institutionnel a besoin d'equity et d'alignement avec les fondateurs.",
        "Une entreprise avec des revenus prouvés mais des marges serrées a besoin de fonds de roulement sans dilution.",
        "Une entreprise réalisant un investissement en capital majeur a besoin d'une dette à long terme — nous fournissons un bridge mezzanine.",
        "Une entreprise approchant de l'acquisition a besoin d'equity bridge — nous fournissons des billets convertibles avec droits stratégiques.",
      ],
      howTitle:"Comment Fonctionne le Fonds",
      steps:[[
        "Chaque stratégie opère sous son propre mandat avec une équipe dédiée — PE, Crédit Privé, Matières Premières et Immobilier ont chacun leurs propres processus d'investissement.",
        "Les capital calls sont déployés selon le mandat et les opportunités. Les investisseurs participent à un ou plusieurs fonds verticaux.",
        "Les commissions de performance sont calculées par fonds. La culture 'on mange ce qu'on chasse' signifie que chaque équipe est comptable des rendements générés.",
        "Les montants minimums d'investissement et les opportunités de co-investissement sont disponibles au cas par cas. Contactez-nous.",
      ],
        ["2025", "Fondation",        "Fonds multi-stratégies formalisé. Premier track record de qualité institutionnelle établi sans capital extérieur."],
        ["2026", "Montée en Échelle","Quatre stratégies actives simultanément. Lancement de la levée immobilière aux États-Unis."],
        ["2027 et au-delà", "TBC",   "Les jalons et objectifs des années suivantes sont en cours de formalisation et seront publiés une fois confirmés."],]
      ,
      cta:"Nous Contacter",
    },
  };
  const c=copy[lang];
  return(
    <div>
      <PageHero eyebrow={c.eyebrow} title={c.h} body={c.sub}/>
      <div style={{maxWidth:960,margin:"0 auto",padding:"64px max(16px,4vw)"}}>
        {/* Terms grid */}
        <div className="rg-4" style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:20,marginBottom:56}}>
          {c.terms.map(([v,l,s])=>(
            <div key={l} style={{...T.card,textAlign:"center",borderTop:"3px solid var(--blue)"}}>
              <div style={{fontFamily:"var(--ff-h)",fontSize:40,fontWeight:800,color:"var(--blue)",lineHeight:1}}>{v}</div>
              <div style={{fontWeight:700,color:"var(--head)",marginTop:8,fontSize:15}}>{l}</div>
              <div style={{color:"var(--dim)",fontSize:12,marginTop:4,lineHeight:1.5}}>{s}</div>
            </div>
          ))}
        </div>
        {/* Flexible Capital Thesis */}
        <div style={{...T.card,marginBottom:40,borderLeft:"3px solid var(--blue)"}}>
          <h2 style={{...T.hdg,fontSize:22,marginBottom:14}}>{c.thesisTitle}</h2>
          <p style={{color:"var(--body)",fontSize:14,lineHeight:1.85,marginBottom:20}}>{c.thesis}</p>
          {c.thesisPoints.map((pt,i)=>(
            <div key={i} style={{display:"flex",gap:14,marginBottom:12}}>
              <div style={{width:6,height:6,borderRadius:"50%",background:"var(--blue)",marginTop:8,flexShrink:0}}/>
              <p style={{color:"var(--dim)",fontSize:14,lineHeight:1.8,margin:0}}>{pt}</p>
            </div>
          ))}
        </div>
        {/* How it works */}
        <div style={{...T.card,marginBottom:40}}>
          <h2 style={{...T.hdg,fontSize:22,marginBottom:24}}>{c.howTitle}</h2>
          {c.steps.map((step,i)=>(
            <div key={i} style={{display:"flex",gap:16,marginBottom:18}}>
              <div style={{width:26,height:26,borderRadius:"50%",background:"var(--blue)",color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"var(--ff-h)",fontSize:13,fontWeight:800,flexShrink:0}}>{i+1}</div>
              <p style={{color:"var(--body)",fontSize:14,lineHeight:1.8,margin:0}}>{step}</p>
            </div>
          ))}
        </div>
        <div style={{marginTop:32}}>
          <button style={T.btnP} onClick={()=>navigate("Contact")}>{c.cta}</button>
        </div>
      </div>
    </div>
  );
}
// ─────────────────────────────────────────────────────────────────────────────
//  CAREERS
// ─────────────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
//  CAREERS
// ─────────────────────────────────────────────────────────────────────────────
function Careers() {
  const [lang] = useLang();
  const [selected, setSelected] = useState(null);

  // ── Values / culture points ───────────────────────────────────────────────
  const VALUES = {
    en: [
      { icon: "◆", title: "Eat What You Kill",        body: "Every deal team is directly accountable for the returns they generate. There are no passengers at Prime Alpha." },
      { icon: "◆", title: "First-Mover Mindset",      body: "We move into markets and structures others find too early, too informal or too complex. That is precisely where the opportunity lives." },
      { icon: "◆", title: "Intellectual Honesty",     body: "We write dissenting positions into IC minutes. Disagreement on the record is a feature, not a flaw." },
      { icon: "◆", title: "Fiduciary Primacy",        body: "Investor interests come first. Conflicts are disclosed within 24 hours. There is no grey zone on this." },
    ],
    fr: [
      { icon: "◆", title: "On Mange Ce Qu'on Chasse", body: "Chaque équipe est directement responsable des rendements qu'elle génère. Il n'y a pas de passagers chez Prime Alpha." },
      { icon: "◆", title: "Esprit de Premier Arrivant", body: "Nous entrons sur des marchés et des structures que d'autres trouvent trop tôt, trop informels ou trop complexes. C'est précisément là que se trouve l'opportunité." },
      { icon: "◆", title: "Honnêteté Intellectuelle", body: "Les positions dissidentes sont consignées dans les procès-verbaux du comité d'investissement. Le désaccord officiel est une caractéristique, pas un défaut." },
      { icon: "◆", title: "Primauté Fiduciaire",     body: "Les intérêts des investisseurs passent en premier. Les conflits sont divulgués dans les 24 heures. Il n'y a pas de zone grise sur ce point." },
    ],
  };

  // ── Open roles ────────────────────────────────────────────────────────────
  const ROLES = {
    en: [
      {
        id: "pe-associate",
        title: "Associate, Private Equity",
        dept: "Investments",
        location: "Remote",
        type: "Full-time",
        description: "You will work directly with the CIO on sourcing, structuring and monitoring equity investments across CEMAC and West African markets. The role requires the ability to move from financial modelling to on-the-ground relationship management without losing rigour at either end.",
        requirements: [
          "Demonstrated interest in African private markets, ideally with regional exposure.",
          "Ability to build financial models from scratch and defend assumptions under pressure.",
          "Strong written and verbal communication in English and French.",
          "Comfort operating in environments with limited data and high ambiguity.",
        ],
      },
      {
        id: "credit-analyst",
        title: "Credit Analyst, Direct Lending",
        dept: "Private Credit",
        location: "Douala / Paris",
        type: "Full-time",
        description: "You will evaluate credit applications, structure loan facilities and monitor portfolio positions across the private credit book. The role sits at the intersection of underwriting discipline and relationship-driven deal flow.",
        requirements: [
          "Understanding of credit underwriting, cash flow analysis and collateral assessment.",
          "Experience or strong academic grounding in structured finance or direct lending.",
          "Attention to detail and comfort with legal documentation.",
          "Bilingual English and French strongly preferred.",
        ],
      },
      {
        id: "commodities-trader",
        title: "Commodities Trader",
        dept: "Commodities",
        location: "Douala",
        type: "Full-time",
        description: "You will manage physical commodity positions across our four trading verticals: textile and cotton, luxury goods, agricultural commodities, and livestock. The role requires hands-on supply chain engagement, not just screen-based trading.",
        requirements: [
          "Practical knowledge of physical commodity markets in West or Central Africa.",
          "Established sourcing or trading relationships in at least one of our verticals.",
          "Operational mindset with the ability to manage logistics and counterparty risk simultaneously.",
          "Willingness to travel within the CEMAC and West African corridor.",
        ],
      },
      {
        id: "re-analyst",
        title: "Real Estate Analyst",
        dept: "Real Assets",
        location: "USA / Remote",
        type: "Full-time",
        description: "You will support the build-out of the U.S. real estate strategy, covering deal sourcing, property underwriting and portfolio monitoring. The strategy is early-stage, which means significant exposure and significant responsibility.",
        requirements: [
          "Understanding of U.S. residential and multifamily real estate markets.",
          "Ability to underwrite fix-and-flip, buy-and-hold and distressed acquisitions.",
          "Comfort with early-stage environments where processes are still being built.",
          "Strong quantitative skills and attention to detail.",
        ],
      },
      {
        id: "tech-associate",
        title: "Technology Associate",
        dept: "Engineering",
        location: "Remote",
        type: "Full-time",
        description: "You will work with the CTO to build and maintain the technology infrastructure that supports all four strategies. This includes data pipelines, internal tooling, the investor platform and cloud architecture on AWS.",
        requirements: [
          "Proficiency in Python and JavaScript, with exposure to React and Node.js.",
          "Experience with AWS services, ideally including DynamoDB, SES and EC2.",
          "Systems thinking and the ability to design for scale from the start.",
          "Comfort working independently and shipping without heavy process overhead.",
        ],
      },
    ],
    fr: [
      {
        id: "pe-associate",
        title: "Associé, Private Equity",
        dept: "Investissements",
        location: "Douala / Télétravail",
        type: "Temps plein",
        description: "Vous travaillerez directement avec le DII sur le sourcing, la structuration et le suivi des investissements en equity dans les marchés CEMAC et Afrique de l'Ouest. Le rôle exige de pouvoir passer de la modélisation financière à la gestion relationnelle terrain sans perdre en rigueur.",
        requirements: [
          "Intérêt démontré pour les marchés privés africains, idéalement avec une exposition régionale.",
          "Capacité à construire des modèles financiers de zéro et à défendre les hypothèses sous pression.",
          "Excellente communication écrite et orale en français et en anglais.",
          "Aisance dans des environnements à données limitées et forte ambiguïté.",
        ],
      },
      {
        id: "credit-analyst",
        title: "Analyste Crédit, Prêt Direct",
        dept: "Crédit Privé",
        location: "Douala / Paris",
        type: "Temps plein",
        description: "Vous évaluerez les dossiers de crédit, structurerez les facilités de prêt et suivrez les positions du portefeuille de crédit privé. Le rôle est à l'intersection de la rigueur du crédit et du deal flow relationnel.",
        requirements: [
          "Compréhension de la notation de crédit, de l'analyse des flux de trésorerie et de l'évaluation des garanties.",
          "Expérience ou solide formation académique en finance structurée ou prêt direct.",
          "Souci du détail et aisance avec la documentation juridique.",
          "Bilingue français et anglais fortement souhaité.",
        ],
      },
      {
        id: "commodities-trader",
        title: "Trader Matières Premières",
        dept: "Matières Premières",
        location: "Douala",
        type: "Temps plein",
        description: "Vous gérerez des positions en matières premières physiques sur nos quatre verticaux : textile et coton, produits de luxe, matières premières agricoles et élevage. Le rôle exige un engagement opérationnel direct sur la chaîne d'approvisionnement.",
        requirements: [
          "Connaissance pratique des marchés physiques de matières premières en Afrique de l'Ouest ou Centrale.",
          "Relations établies de sourcing ou de négoce dans au moins l'un de nos verticaux.",
          "Sens opérationnel avec capacité à gérer logistique et risque de contrepartie simultanément.",
          "Disponibilité pour des déplacements dans le corridor CEMAC et Afrique de l'Ouest.",
        ],
      },
      {
        id: "re-analyst",
        title: "Analyste Immobilier",
        dept: "Actifs Réels",
        location: "USA / Télétravail",
        type: "Temps plein",
        description: "Vous soutiendrez le développement de la stratégie immobilière américaine, couvrant le sourcing, l'évaluation des biens et le suivi du portefeuille. La stratégie est en phase initiale, ce qui implique une forte exposition et une responsabilité significative.",
        requirements: [
          "Compréhension des marchés immobiliers résidentiels et multifamiliaux américains.",
          "Capacité à évaluer des acquisitions de réhabilitation-revente, buy-and-hold et situations de détresse.",
          "Aisance dans les environnements early-stage où les processus sont encore en construction.",
          "Solides compétences quantitatives et souci du détail.",
        ],
      },
      {
        id: "tech-associate",
        title: "Associé Technologie",
        dept: "Ingénierie",
        location: "Télétravail",
        type: "Temps plein",
        description: "Vous travaillerez avec le DTC pour construire et maintenir l'infrastructure technologique qui soutient les quatre stratégies : pipelines de données, outils internes, plateforme investisseurs et architecture cloud AWS.",
        requirements: [
          "Maîtrise de Python et JavaScript, avec exposition à React et Node.js.",
          "Expérience avec les services AWS, idéalement DynamoDB, SES et EC2.",
          "Pensée systémique et capacité à concevoir pour la scalabilité dès le départ.",
          "Autonomie et capacité à livrer sans processus lourd.",
        ],
      },
    ],
  };

  const roles = ROLES[lang] || ROLES.en;
  const values = VALUES[lang] || VALUES.en;
  const activeRole = selected ? roles.find(r => r.id === selected) : null;

  return (
    <div>
      <PageHero
        eyebrow={lang === "en" ? "Join Us" : "Nous Rejoindre"}
        title={lang === "en" ? "CAREERS" : "CARRIÈRES"}
        body={lang === "en"
          ? "We are a small team building something that did not exist before. If you want to work on hard problems in markets that the rest of the world has underestimated, we should talk."
          : "Nous sommes une petite équipe qui construit quelque chose qui n'existait pas avant. Si vous voulez travailler sur des problèmes difficiles dans des marchés que le reste du monde a sous-estimés, nous devrions nous parler."}
      />

      <div style={{ maxWidth: 960, margin: "0 auto", padding: "64px max(16px,4vw)" }}>

        {/* Culture values */}
        <h2 style={{ ...T.hdg, fontSize: 22, marginBottom: 8 }}>
          {lang === "en" ? "How We Work" : "Comment Nous Travaillons"}
        </h2>
        <p style={{ color: "var(--dim)", fontSize: 14, marginBottom: 32, lineHeight: 1.75 }}>
          {lang === "en"
            ? "These are not aspirational values written for a website. They are the operating principles we hold each other to every day."
            : "Ce ne sont pas des valeurs aspirationnelles écrites pour un site web. Ce sont les principes opérationnels que nous nous imposons mutuellement chaque jour."}
        </p>
        <div className="rg-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 56 }}>
          {values.map(v => (
            <div key={v.title} style={{ ...T.card, borderTop: "3px solid var(--blue)" }}>
              <h3 style={{ ...T.hdg, fontSize: 15, marginBottom: 8 }}>{v.title}</h3>
              <p style={{ color: "var(--dim)", fontSize: 13, lineHeight: 1.75 }}>{v.body}</p>
            </div>
          ))}
        </div>

        {/* Open roles */}
        <h2 style={{ ...T.hdg, fontSize: 22, marginBottom: 8 }}>
          {lang === "en" ? "Open Roles" : "Postes Ouverts"}
        </h2>
        <p style={{ color: "var(--dim)", fontSize: 14, marginBottom: 32, lineHeight: 1.75 }}>
          {lang === "en"
            ? "All roles are open until filled. We hire on a rolling basis and move quickly when we find the right person."
            : "Tous les postes sont ouverts jusqu'à pourvus. Nous recrutons en continu et agissons rapidement lorsque nous trouvons la bonne personne."}
        </p>

        {roles.map(role => (
          <div key={role.id} style={{ marginBottom: 12 }}>
            {/* Role header row */}
            <div
              style={{ ...T.card, cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center",
                borderLeft: selected === role.id ? "3px solid var(--blue)" : "3px solid transparent",
                transition: "border-color 0.15s, box-shadow 0.15s" }}
              onClick={() => setSelected(selected === role.id ? null : role.id)}
              onMouseEnter={e => e.currentTarget.style.boxShadow = "var(--sh-md)"}
              onMouseLeave={e => e.currentTarget.style.boxShadow = "var(--sh)"}
            >
              <div>
                <h3 style={{ ...T.hdg, fontSize: 17, marginBottom: 6 }}>{role.title}</h3>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <span style={T.tag()}>{role.dept}</span>
                  <span style={{ fontSize: 13, color: "var(--dim)" }}>{role.location}</span>
                  <span style={{ fontSize: 13, color: "var(--dim)" }}>{role.type}</span>
                </div>
              </div>
              <div style={{ color: "var(--blue)", fontWeight: 700, fontSize: 20, flexShrink: 0, marginLeft: 16 }}>
                {selected === role.id ? "−" : "+"}
              </div>
            </div>

            {/* Expanded role detail */}
            {selected === role.id && (
              <div style={{ ...T.card, marginTop: 2, borderTop: "none", background: "var(--ow)" }}>
                <p style={{ color: "var(--body)", fontSize: 14, lineHeight: 1.85, marginBottom: 24 }}>
                  {role.description}
                </p>
                <h4 style={{ ...T.hdg, fontSize: 13, marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                  {lang === "en" ? "What We're Looking For" : "Ce Que Nous Recherchons"}
                </h4>
                {role.requirements.map((req, i) => (
                  <div key={i} style={{ display: "flex", gap: 12, marginBottom: 10 }}>
                    <div style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--blue)", flexShrink: 0, marginTop: 8 }} />
                    <p style={{ color: "var(--dim)", fontSize: 13, lineHeight: 1.75, margin: 0 }}>{req}</p>
                  </div>
                ))}
                <div style={{ marginTop: 24 }}>
                  <button
                    style={T.btnP}
                    onClick={() => {
                      const sub = encodeURIComponent(`Application: ${role.title}`);
                      window.location.href = `mailto:aurel.botouli@primealphasecurities.com?subject=${sub}`;
                    }}
                  >
                    {lang === "en" ? "Apply for This Role" : "Postuler à ce Poste"}
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}

        {/* Speculative applications */}
        <div style={{ ...T.card, marginTop: 32, borderTop: "3px solid var(--blue-light)", textAlign: "center" }}>
          <h3 style={{ ...T.hdg, fontSize: 18, marginBottom: 8 }}>
            {lang === "en" ? "Don't See Your Role?" : "Vous ne voyez pas votre poste ?"}
          </h3>
          <p style={{ color: "var(--dim)", fontSize: 13, lineHeight: 1.75, maxWidth: 520, margin: "0 auto 20px" }}>
            {lang === "en"
              ? "We are always open to exceptional people, even when we do not have a specific opening. Send a short note about yourself and what you are looking to build."
              : "Nous sommes toujours ouverts aux personnes exceptionnelles, même lorsque nous n'avons pas d'ouverture spécifique. Envoyez une courte note sur vous-même et ce que vous souhaitez construire."}
          </p>
          <button
            style={T.btnO}
            onClick={() => {
              window.location.href = "mailto:aurel.botouli@primealphasecurities.com?subject=Speculative%20Application";
            }}
          >
            {lang === "en" ? "Send a Speculative Application" : "Envoyer une Candidature Spontanée"}
          </button>
        </div>

      </div>
    </div>
  );
}


function Research(){
  const [lang]=useLang();
  const [articles,sa]=useState([]);
  const [loading,sl]=useState(true);
  const [active,sact]=useState(null);
  useEffect(()=>{api.getAll("articles").then(r=>{sa([...r].sort((a,b)=>b.date.localeCompare(a.date)));sl(false);});},[]);
  return(
    <div>
      <PageHero eyebrow={lang==="en"?"Perspectives":"Perspectives"} title={lang==="en"?"RESEARCH & INSIGHTS":"RECHERCHE & ANALYSES"}/>
      <div style={{maxWidth:1100,margin:"0 auto",padding:"64px max(16px,4vw)"}}>
        {loading?<Spinner/>:(
          <div className="rg-2" style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20}}>
            {articles.map((a,i)=>(
              <div key={a.articleId} className={`fu fu-${Math.min(i+1,4)}`} onClick={()=>sact(a)} style={{...T.card,cursor:"pointer",display:"flex",flexDirection:"column",transition:"all 0.2s"}}
                onMouseEnter={e=>{e.currentTarget.style.boxShadow="var(--sh-md)";e.currentTarget.style.borderColor="var(--blue)";}}
                onMouseLeave={e=>{e.currentTarget.style.boxShadow="var(--sh)";e.currentTarget.style.borderColor="#DDDFE5";}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:12}}>
                  <span style={T.tag()}>{a.category}</span>
                  <span style={{fontSize:11,color:"var(--dim)",fontFamily:"var(--ff-m)"}}>{a.date}</span>
                </div>
                <h3 style={{...T.hdg,fontSize:19,lineHeight:1.3,marginBottom:10,flex:1}}>{a.title}</h3>
                <p style={{fontSize:13,color:"var(--dim)",lineHeight:1.75,marginBottom:12}}>{a.excerpt}</p>
                <div style={{fontSize:12,color:"var(--dim)"}}>{a.author}</div>
              </div>
            ))}
          </div>
        )}
      </div>
      <Modal open={!!active} onClose={()=>sact(null)} title={active?.title||""}>
        {active&&<>
          <div style={{display:"flex",gap:12,marginBottom:20,alignItems:"center"}}>
            <span style={T.tag()}>{active.category}</span>
            <span style={{fontSize:12,color:"var(--dim)"}}>{active.date} · {active.author}</span>
          </div>
          <p style={{color:"var(--body)",lineHeight:1.9,marginBottom:16}}>{active.excerpt}</p>
          <p style={{color:"var(--dim)",fontSize:12,fontStyle:"italic"}}>This analysis represents the views of Prime Alpha Securities' research team and does not constitute investment advice. Past performance is not indicative of future results.</p>
        </>}
      </Modal>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  CONTACT
// ─────────────────────────────────────────────────────────────────────────────
function Contact(){
  const [lang]=useLang();
  const [form,sf]=useState({name:"",email:"",org:"",subject:"",message:""});
  const [sent,ss]=useState(false);
  const [saving,sv]=useState(false);
  const set=k=>e=>sf(p=>({...p,[k]:e.target.value}));
  const submit=async()=>{
    if(!form.name||!form.email||!form.message){alert(lang==="en"?"Fill required fields.":"Veuillez remplir les champs obligatoires.");return;}
    sv(true);
    await notify.inquiry(form);
    sv(false);ss(true);
  };
  const subjects=lang==="en"
    ?[{value:"",label:"Select…"},{value:"IR",label:"Investor Relations"},{value:"media",label:"Media"},{value:"credit",label:"Credit Inquiry"},{value:"strategy",label:"Discuss Strategy"},{value:"careers",label:"Careers"},{value:"other",label:"Other"}]
    :[{value:"",label:"Sélectionner…"},{value:"IR",label:"Relations Investisseurs"},{value:"media",label:"Médias"},{value:"credit",label:"Demande de Crédit"},{value:"careers",label:"Carrières"},{value:"other",label:"Autre"}];
  return(
    <div>
      <PageHero eyebrow={lang==="en"?"Get In Touch":"Nous Contacter"} title={lang==="en"?"CONTACT":"CONTACT"}/>
      <div style={{maxWidth:1100,margin:"0 auto",padding:"64px max(16px,4vw)",display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(280px,1fr))",gap:40}}>
        <div>
          {[
            [lang==="en"?"Compliance":"Conformité","compliance@primealphasecurities.com"],
            [lang==="en"?"Investor Relations":"Relations Investisseurs","ir@primealphasecurities.com"],
            [lang==="en"?"Website":"Site Web","www.primealphasecurities.com"],
            [lang==="en"?"Markets":"Marchés","CEMAC · West Africa · USA"],
            [lang==="en"?"Founded":"Fondé","June 2024"],
          ].map(([k,v])=>(
            <div key={k} style={{marginBottom:24}}>
              <div style={{fontSize:10,fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase",color:"var(--blue)",marginBottom:6}}>{k}</div>
              <div style={{color:"var(--body)",fontSize:14,lineHeight:1.75,whiteSpace:"pre-line"}}>{v}</div>
            </div>
          ))}
        </div>
        <div style={T.card}>
          {sent?(
            <SubmitSuccess message={lang==="en"?"We'll respond within 2 business days.":"Nous vous répondrons dans les 2 jours ouvrables."}/>
          ):(
            <>
              <h2 style={{...T.hdg,fontSize:24,marginBottom:24}}>{lang==="en"?"Send an Inquiry":"Envoyer une Demande"}</h2>
              <div className="form-2col" style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:0}}>
                <Inp label={lang==="en"?"Full Name *":"Nom Complet *"} value={form.name} onChange={set("name")}/>
                <div style={{paddingLeft:16}}><Inp label={lang==="en"?"Email *":"Email *"} type="email" value={form.email} onChange={set("email")}/></div>
              </div>
              <Inp label={lang==="en"?"Organisation":"Organisation"} value={form.org} onChange={set("org")}/>
              <Sel label={lang==="en"?"Subject":"Sujet"} value={form.subject} onChange={set("subject")} options={subjects}/>
              <TA label={lang==="en"?"Message *":"Message *"} value={form.message} onChange={set("message")}/>
              <button style={T.btnP} onClick={submit} disabled={saving}>{saving?(lang==="en"?"Sending…":"Envoi…"):(lang==="en"?"Send Message":"Envoyer")}</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  LEGAL
// ─────────────────────────────────────────────────────────────────────────────
function Legal({type}){
  const [lang]=useLang();
  const T2={
    Privacy:"Prime Alpha Securities LLC and its affiliates ('Prime Alpha', 'we', 'our') collect information you provide directly and information collected automatically. We do not sell personal data. Data is retained only as long as necessary to fulfill the purposes for which it was collected or as required by applicable law. Contact privacy@primealphasecurities.com to access, correct, or delete your data.",
    Terms:"These Terms of Use govern your access to primealphasecurities.com and associated portals. The information herein is for informational purposes only and does not constitute an offer or solicitation to buy or sell any security. Investment involves risk, including possible loss of principal.",
    Notices:"Prime Alpha Securities LLC is registered as an investment adviser with the U.S. Securities and Exchange Commission. Registration does not imply a certain level of skill or training. Securities may not be offered in jurisdictions where such offering would be unlawful.",
    Disclosures:"IMPORTANT: Alternative investments involve high risk, are speculative and illiquid, and are not suitable for all investors. These investments are offered only to qualified investors. Performance data shown may not be representative of all client outcomes. Net returns are after management fees and carried interest.",
  };
  const T2fr={
    Privacy:"Prime Alpha Securities LLC et ses affiliés collectent les informations que vous fournissez directement. Nous ne vendons pas de données personnelles. Contactez privacy@primealphasecurities.com pour accéder à vos données, les corriger ou les supprimer.",
    Terms:"Ces Conditions d'Utilisation régissent votre accès à primealphasecurities.com et aux portails associés. Les informations ici sont à titre informatif uniquement et ne constituent pas une offre ou sollicitation d'achat ou de vente de valeurs mobilières.",
    Notices:"Prime Alpha Securities LLC est enregistrée en tant que conseiller en investissement. L'enregistrement n'implique pas un certain niveau de compétence ou de formation. Les valeurs mobilières peuvent ne pas être offertes dans les juridictions où une telle offre serait illégale.",
    Disclosures:"IMPORTANT : Les investissements alternatifs comportent des risques élevés, sont spéculatifs et illiquides, et ne sont pas adaptés à tous les investisseurs. Ces investissements sont offerts uniquement aux investisseurs qualifiés.",
  };
  const titles={Privacy:"Privacy Policy",Terms:"Terms of Use",Notices:"Legal Notices",Disclosures:"Disclosures"};
  const titlesFr={Privacy:"Politique de Confidentialité",Terms:"Conditions d'Utilisation",Notices:"Mentions Légales",Disclosures:"Informations Réglementaires"};
  const content=lang==="en"?(T2[type]||""):(T2fr[type]||T2[type]||"");
  const title=lang==="en"?(titles[type]||type).toUpperCase():(titlesFr[type]||type).toUpperCase();
  return(
    <div>
      <PageHero title={title}/>
      <div style={{maxWidth:800,margin:"0 auto",padding:"64px max(16px,4vw)"}}>
        <div style={T.card}><p style={{color:"var(--body)",lineHeight:1.9}}>{content}</p></div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  LOGIN PAGE  (shared for investor + worker, 2FA)
// ─────────────────────────────────────────────────────────────────────────────
function LoginPage({type,onSuccess}){
  const [step,ss]=useState("creds");
  const [email,se]=useState("");
  const [pass,sp]=useState("");
  const [code,sc]=useState("");
  const [gen,sg]=useState("");
  const [secs,st]=useState(300);
  const [err,serr]=useState("");
  const [busy,sb]=useState(false);
  const timer=useRef(null);

  const DEMO={
    investor:{"investor@meridianfund.com":"demo1234","family@vantagefamilyoffice.com":"demo1234","trust@cypresssovereign.com":"demo1234"},
    worker:{"worker@primealphasecurities.com":"worker123","james@primealphasecurities.com":"worker123"},
  }[type];

  const startTimer=()=>{
    clearInterval(timer.current);st(300);
    timer.current=setInterval(()=>st(s=>{if(s<=1){clearInterval(timer.current);return 0;}return s-1;}),1000);
  };
  useEffect(()=>()=>clearInterval(timer.current),[]);

  const doCreds=async()=>{
    if(!DEMO[email]||DEMO[email]!==pass){serr("Invalid email or password.");return;}
    serr("");sb(true);
    const c=otp();sg(c);
    await new Promise(r=>setTimeout(r,600));
    sb(false);ss("otp");startTimer();
    alert(`[PRIME ALPHA — DEMO]\n\n2FA Code for ${email}:\n\n${c}\n\nValid for 5 minutes.`);
  };
  const doOtp=async()=>{
    if(secs<=0){serr("Code expired. Request a new one.");return;}
    if(code.trim().toUpperCase()!==gen){serr("Incorrect code.");return;}
    serr("");sb(true);
    const table=type==="investor"?"investor":"workers";
    const rows=await api.getAll(table);
    const user=rows.find(x=>x.email===email);
    sb(false);
    if(user)onSuccess(user);
    else serr("User not found in database.");
  };
  const mins=String(Math.floor(secs/60)).padStart(2,"0");
  const s2=String(secs%60).padStart(2,"0");

  return(
    <div style={{minHeight:"100vh",display:"flex",background:"var(--ow)"}}>
      {/* Left */}
      <div style={{width:"42%",background:"var(--head)",display:"flex",flexDirection:"column",justifyContent:"space-between",padding:52}}>
        <LogoInline size={17} dark/>
        <div>
          <div style={{fontSize:10,fontWeight:700,letterSpacing:"0.16em",textTransform:"uppercase",color:"var(--blue)",marginBottom:16}}>
            {type==="investor"?"Investor Portal":"Team Console"}
          </div>
          <h2 style={{fontFamily:"var(--ff-h)",fontSize:42,fontWeight:800,color:"#fff",lineHeight:0.95,marginBottom:20}}>
            {type==="investor"?"YOUR\nPORTFOLIO\nAWAITS":"TEAM\nCONSOLE\nACCESS"}
          </h2>
          <p style={{color:"rgba(255,255,255,0.45)",fontSize:14,lineHeight:1.8}}>
            Secure two-factor authentication protects your access. A one-time code will be dispatched to your registered email upon credential verification.
          </p>
          <div style={{marginTop:32,padding:"14px 18px",background:"rgba(0,87,255,0.15)",borderRadius:"var(--r)",fontSize:12,color:"rgba(255,255,255,0.6)",fontFamily:"var(--ff-m)",lineHeight:1.7}}>
            {type==="investor"
              ? "primealphasecurities.com/investor"
              : "primealphasecurities.com/worker"}
          </div>
        </div>
        <div style={{fontSize:11,color:"rgba(255,255,255,0.2)"}}>© {new Date().getFullYear()} Prime Alpha Securities LLC</div>
      </div>
      {/* Right */}
      <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",padding:52}}>
        <div style={{width:"100%",maxWidth:420}}>
          {step==="creds"?(
            <div className="fu">
              <h1 style={{...T.hdg,fontSize:30,marginBottom:8}}>Sign In</h1>
              <p style={{color:"var(--dim)",fontSize:14,marginBottom:32}}>Enter your credentials to continue.</p>
              <Inp label="Email Address" type="email" value={email} onChange={e=>se(e.target.value)} placeholder={type==="investor"?"you@fund.com":"you@primealphasecurities.com"}/>
              <Inp label="Password" type="password" value={pass} onChange={e=>sp(e.target.value)} placeholder="••••••••"/>
              {err&&<div style={{color:"var(--red)",fontSize:13,marginBottom:14,padding:"10px 14px",background:"#fef2f2",borderRadius:"var(--r)",border:"1px solid #fca5a5"}}>{err}</div>}
              <button style={{...T.btnP,width:"100%"}} onClick={doCreds} disabled={busy}>{busy?"Verifying…":"Continue →"}</button>
              <div style={{marginTop:20,padding:14,background:"var(--blue-l)",borderRadius:"var(--r)",fontSize:12,color:"var(--blue)"}}>
                <strong>Demo:</strong>{" "}
                {type==="investor"?"investor@meridianfund.com / demo1234":"worker@primealphasecurities.com / worker123"}
              </div>
            </div>
          ):(
            <div className="fu">
              <h1 style={{...T.hdg,fontSize:30,marginBottom:8}}>Two-Factor Auth</h1>
              <p style={{color:"var(--dim)",fontSize:14,marginBottom:8}}>Enter the 10-character code sent to <strong style={{color:"var(--head)"}}>{email}</strong>.</p>
              <div style={{fontFamily:"var(--ff-m)",fontSize:13,color:secs<60?"var(--red)":"var(--blue)",marginBottom:24}}>Expires in {mins}:{s2}</div>
              <Inp label="One-Time Code" value={code} onChange={e=>sc(e.target.value)} placeholder="XXXXXXXXXX" style={{fontFamily:"var(--ff-m)",fontSize:20,letterSpacing:"0.25em",textAlign:"center",textTransform:"uppercase"}}/>
              {err&&<div style={{color:"var(--red)",fontSize:13,marginBottom:14,padding:"10px 14px",background:"#fef2f2",borderRadius:"var(--r)",border:"1px solid #fca5a5"}}>{err}</div>}
              {secs===0&&<div style={{fontSize:13,color:"var(--red)",marginBottom:14}}>Code expired.{" "}<button onClick={()=>{ss("creds");sc("");serr("");clearInterval(timer.current);}} style={{color:"var(--blue)",background:"none",textDecoration:"underline"}}>Request new code</button></div>}
              <button style={{...T.btnP,width:"100%"}} onClick={doOtp} disabled={busy}>{busy?"Verifying…":"Verify & Enter →"}</button>
              <button style={{width:"100%",marginTop:12,fontSize:13,color:"var(--dim)",background:"none",textAlign:"center"}} onClick={()=>{ss("creds");sc("");serr("");clearInterval(timer.current);}}>← Use different account</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  INVESTOR PORTAL
// ─────────────────────────────────────────────────────────────────────────────
function InvestorPortal({user,setUser,onLogout}){
  const [tab,st]=useState("Dashboard");
  const [toast,stt]=useState({msg:"",type:"success"});
  const tabs=["Dashboard","Portfolio","Documents","R&D","Profile"];
  const showToast=(msg,type="success")=>stt({msg,type});

  return(
    <div style={{minHeight:"100vh",background:"var(--ow)",display:"flex"}}>
      <div style={{width:240,background:"var(--w)",borderRight:"var(--bdr)",display:"flex",flexDirection:"column",position:"fixed",top:0,bottom:0,left:0}}>
        <div style={{padding:"20px 18px",borderBottom:"var(--bdr)",lineHeight:1}}><LogoInline size={14}/><div style={{fontSize:10,fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase",color:"var(--blue)",marginTop:6}}>INVESTOR PORTAL</div></div>
        <div style={{padding:"14px 10px",flex:1}}>{tabs.map(t=><SideBtn key={t} label={t} active={tab===t} onClick={()=>st(t)}/>)}</div>
        <div style={{padding:"16px 18px",borderTop:"var(--bdr)"}}>
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
            <div style={{width:36,height:36,background:"var(--blue)",borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontFamily:"var(--ff-h)",fontSize:15,fontWeight:800,flexShrink:0}}>{(user.name||"U")[0]}</div>
            <div style={{minWidth:0}}>
              <div style={{fontSize:13,fontWeight:700,color:"var(--head)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{user.name}</div>
              <div style={{fontSize:11,color:"var(--dim)",overflow:"hidden",textOverflow:"ellipsis"}}>{user.email}</div>
            </div>
          </div>
          <button style={{...T.btnG,width:"100%",fontSize:12}} onClick={onLogout}>Sign Out</button>
        </div>
      </div>
      <div style={{marginLeft:240,flex:1,padding:"36px 44px"}}>
        {tab==="Dashboard" &&<IDash   user={user}/>}
        {tab==="Portfolio" &&<IPort   user={user}/>}
        {tab==="Documents" &&<IDocs   user={user}/>}
        {tab==="R&D"       &&<IRD/>}
        {tab==="Profile"   &&<IProf   user={user} setUser={setUser} showToast={showToast}/>}
      </div>
      <Toast msg={toast.msg} type={toast.type} onClose={()=>stt({msg:"",type:"success"})}/>
    </div>
  );
}

function IDash({user}){
  const roi=user.aum>0?((user.pnl/user.aum)*100).toFixed(2):0;
  return(
    <div className="fu">
      <div style={{marginBottom:32}}>
        <h1 style={{...T.hdg,fontSize:34}}>Overview</h1>
        <p style={{color:"var(--dim)",marginTop:4}}>{new Date().toLocaleDateString("en-GB",{weekday:"long",year:"numeric",month:"long",day:"numeric"})}</p>
      </div>
      <div style={{display:"flex",gap:16,marginBottom:24,flexWrap:"wrap"}}>
        <StatCard label="Total AUM" value={$(user.aum)} sub="Assets Under Management" accent/>
        <StatCard label="Net P&L (YTD)" value={$(user.pnl)} sub={`+${roi}% return`} trend={+parseFloat(roi)}/>
        <StatCard label="Cumulative P&L" value={$(user.cumulativePnl)} sub="Since inception"/>
        <StatCard label="Strategy" value={user.strategy} sub={`Risk: ${user.risk}`}/>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"3fr 2fr",gap:20}}>
        <div style={T.card}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
            <h3 style={{...T.hdg,fontSize:17}}>Monthly P&L</h3>
            <span style={T.tag()}>YTD</span>
          </div>
          <Spark data={user.history}/>
          <div style={{display:"flex",justifyContent:"space-between",marginTop:8}}>
            {(user.history||[]).map(h=><div key={h.month} style={{fontSize:11,color:"var(--dim)"}}>{h.month}</div>)}
          </div>
          <div style={{display:"flex",gap:10,marginTop:14,paddingTop:14,borderTop:"var(--bdr)"}}>
            {(user.history||[]).map(h=>(
              <div key={h.month} style={{flex:1,textAlign:"center"}}>
                <div style={{fontFamily:"var(--ff-m)",fontSize:11,color:"var(--blue)",fontWeight:500}}>{$(h.pnl)}</div>
              </div>
            ))}
          </div>
        </div>
        <div style={T.card}>
          <h3 style={{...T.hdg,fontSize:17,marginBottom:16}}>Allocation</h3>
          {(user.investments||[]).map(i=><Bar key={i.name} label={i.name} pct={i.pct} value={`${i.pct}%`}/>)}
        </div>
      </div>
    </div>
  );
}
function IPort({user}){
  return(
    <div className="fu">
      <h1 style={{...T.hdg,fontSize:34,marginBottom:28}}>Portfolio</h1>
      <div style={{display:"flex",gap:16,marginBottom:24,flexWrap:"wrap"}}>
        {(user.investments||[]).map((inv,i)=>(
          <div key={inv.name} style={{...T.card,flex:1,minWidth:190,borderTop:"3px solid var(--blue)"}}>
            <div style={{fontSize:10,fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase",color:"var(--dim)",marginBottom:8}}>{inv.name}</div>
            <div style={{fontFamily:"var(--ff-h)",fontSize:28,fontWeight:800,color:"var(--head)"}}>{$(inv.value)}</div>
            <div style={{fontSize:12,color:"var(--dim)",marginTop:4}}>{inv.pct}% of portfolio</div>
            <div style={{marginTop:12,height:4,background:"var(--lg)",borderRadius:2}}><div style={{width:`${inv.pct}%`,height:"100%",background:"var(--blue)",borderRadius:2}}/></div>
          </div>
        ))}
      </div>
      <div style={T.card}>
        <h3 style={{...T.hdg,fontSize:18,marginBottom:20}}>Position Detail</h3>
        <table style={{width:"100%",borderCollapse:"collapse"}}>
          <thead><tr style={{borderBottom:"2px solid var(--lg)"}}>
            {["Investment","Market Value","Allocation","Est. Return YTD"].map(h=>(
              <th key={h} style={{textAlign:"left",padding:"8px 20px 12px 0",fontSize:10,fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase",color:"var(--dim)"}}>{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {(user.investments||[]).map((inv,i)=>(
              <tr key={inv.name} style={{borderBottom:"1px solid var(--lg)"}}>
                <td style={{padding:"13px 20px 13px 0",fontWeight:700,color:"var(--head)"}}>{inv.name}</td>
                <td style={{padding:"13px 20px 13px 0",fontFamily:"var(--ff-m)",color:"var(--body)"}}>{$$(inv.value)}</td>
                <td style={{padding:"13px 20px 13px 0",color:"var(--dim)"}}>{inv.pct}%</td>
                <td style={{padding:"13px 0",fontFamily:"var(--ff-m)",color:"var(--green)",fontWeight:700}}>+{(7+i*2.3).toFixed(1)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
function IDocs({user}){
  return(
    <div className="fu">
      <h1 style={{...T.hdg,fontSize:34,marginBottom:28}}>Documents</h1>
      <div style={{display:"grid",gap:12,marginBottom:28}}>
        {(user.documents||[]).map(doc=>(
          <div key={doc} style={{...T.card,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div style={{display:"flex",gap:14,alignItems:"center"}}>
              <div style={{width:42,height:42,background:"var(--blue-l)",borderRadius:"var(--r)",display:"flex",alignItems:"center",justifyContent:"center",color:"var(--blue)",fontSize:20}}>📄</div>
              <div><div style={{color:"var(--head)",fontWeight:700}}>{doc}</div><div style={{fontSize:12,color:"var(--dim)"}}>Confidential · PDF</div></div>
            </div>
            <button style={T.btnSm} onClick={()=>alert("Download initiated (demo)")}>Download</button>
          </div>
        ))}
      </div>
      <div style={T.card}>
        <h3 style={{...T.hdg,fontSize:18,marginBottom:18}}>Updates</h3>
        {[["Q2 2024 NAV Update","Net asset value statements distributed. Q2 performance reflects strong credit spread compression.","2024-06-30"],["Annual Meeting Notice","Annual meeting scheduled for September 15, 2024. Dial-in details to follow.","2024-06-01"],["Portfolio Company Exit","Solaris Energy Partners exit completed at 3.1x MOIC. Proceeds to be distributed per LP agreement.","2023-11-30"]].map(([t,d,dt])=>(
          <div key={t} style={{borderBottom:"1px solid var(--lg)",paddingBottom:16,marginBottom:16}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
              <span style={{fontWeight:700,color:"var(--head)"}}>{t}</span>
              <span style={{fontSize:11,color:"var(--dim)",fontFamily:"var(--ff-m)"}}>{dt}</span>
            </div>
            <p style={{fontSize:13,color:"var(--dim)",lineHeight:1.75}}>{d}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
function IRD(){
  const [rds,sr]=useState([]);const [load,sl]=useState(true);
  useEffect(()=>{api.getAll("documents").then(r=>{sr(r);sl(false);});},[]);
  const sc2=(s)=>s==="Deployed"?"var(--green)":s==="In Testing"?"var(--amber)":"var(--blue)";
  return(
    <div className="fu">
      <h1 style={{...T.hdg,fontSize:34,marginBottom:8}}>Research & Development</h1>
      <p style={{color:"var(--dim)",marginBottom:28}}>Proprietary technology initiatives advancing Prime Alpha's capital deployment capabilities.</p>
      {load?<Spinner/>:rds.map(r=>(
        <div key={r.docId} style={{...T.card,marginBottom:14}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
            <h3 style={{...T.hdg,fontSize:17}}>{r.title}</h3>
            <span style={T.tag(sc2(r.status),`${sc2(r.status)}11`)}>{r.status}</span>
          </div>
          <p style={{color:"var(--dim)",fontSize:13,lineHeight:1.75}}>{r.description}</p>
          <div style={{fontSize:11,color:"var(--dim)",marginTop:10,fontFamily:"var(--ff-m)"}}>{r.date}</div>
        </div>
      ))}
    </div>
  );
}
function IProf({user,setUser,showToast}){
  const [showPw,spw]=useState(false);
  const [pw,sP]=useState("");
  const [edit,se]=useState(false);
  const [form,sf]=useState({phone:user.phone||"",name:user.name||""});

  const saveDetails=async()=>{
    const updated={...user,...form};
    await api.patch("investor",user.investorId,form);
    setUser(updated);
    showToast("Profile updated.");se(false);
  };

  return(
    <div className="fu">
      <h1 style={{...T.hdg,fontSize:34,marginBottom:28}}>Profile</h1>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:24}}>
        <div style={T.card}>
          <h3 style={{...T.hdg,fontSize:18,marginBottom:18}}>Account Details</h3>
          {[["Name",user.name],["Email",user.email],["Phone",user.phone],["Member Since",user.joinDate],["Investment Term",user.term],["Strategy",user.strategy],["Risk Profile",user.risk]].map(([k,v])=><KV key={k} k={k} v={v}/>)}
          {!edit&&<button style={{...T.btnO,marginTop:16,width:"100%"}} onClick={()=>{sf({phone:user.phone||"",name:user.name||""});se(true);}}>Edit Details</button>}
          {edit&&(
            <div style={{marginTop:16,paddingTop:16,borderTop:"var(--bdr)"}}>
              <Inp label="Display Name" value={form.name} onChange={e=>sf(p=>({...p,name:e.target.value}))}/>
              <Inp label="Phone" value={form.phone} onChange={e=>sf(p=>({...p,phone:e.target.value}))}/>
              <div style={{display:"flex",gap:10}}>
                <button style={T.btnP} onClick={saveDetails}>Save</button>
                <button style={T.btnG} onClick={()=>se(false)}>Cancel</button>
              </div>
            </div>
          )}
        </div>
        <div>
          <div style={T.card}>
            <h3 style={{...T.hdg,fontSize:18,marginBottom:14}}>Security</h3>
            <span style={T.tag("var(--green)","#f0fdf4")}>2FA Active</span>
            <p style={{fontSize:13,color:"var(--dim)",lineHeight:1.75,marginTop:10}}>A one-time code is dispatched to your registered email at each login. Codes expire after 5 minutes and are invalidated on page refresh.</p>
            <button style={{...T.btnG,marginTop:16,width:"100%"}} onClick={()=>spw(true)}>Change Password</button>
          </div>
        </div>
      </div>
      <Modal open={showPw} onClose={()=>spw(false)} title="Change Password" width={440}>
        <Inp label="New Password" type="password" value={pw} onChange={e=>sP(e.target.value)}/>
        <button style={T.btnP} onClick={()=>{showToast("Password updated successfully.");spw(false);sP("");}}>Update Password</button>
      </Modal>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  WORKER PORTAL  — all mutations sync to DynamoDB immediately
// ─────────────────────────────────────────────────────────────────────────────
function WorkerPortal({user,onLogout}){
  // Shared state — changes here propagate to all sub-views
  const [clients,sc]=useState([]);
  const [deals,sd]=useState([]);
  const [events,se]=useState([]);
  const [re,sr]=useState([]);
  const [workers,sw]=useState([]);
  const [loading,sl]=useState(true);
  const [tab,st]=useState("Clients");
  const [toast,stt]=useState({msg:"",type:"success"});

  const showToast=(msg,type="success")=>stt({msg,type});

  // Load everything once on mount
  useEffect(()=>{
    Promise.all([
      api.getAll("investor"),
      api.getAll("pe_companies"),
      api.getAll("calendar"),
      api.getAll("real_estate"),
      api.getAll("workers"),
    ]).then(([c,p,ev,r,w])=>{
      sc(c);sd(p);se(ev);sr(r);
      sw(w.length?w:SEED["workers"]);
      sl(false);
    });
  },[]);

  // Wrapped setters that sync state AND DynamoDB atomically
  const addClient=useCallback(async(item)=>{
    sc(prev=>[...prev,item]);
    await api.put("investor",item);
    showToast("Client added to DynamoDB.");
  },[]);
  const updateClient=useCallback(async(id,fields)=>{
    sc(prev=>prev.map(c=>c.investorId===id?{...c,...fields}:c));
    await api.patch("investor",id,fields);
    showToast("Client saved to DynamoDB.");
  },[]);
  const removeClient=useCallback(async(id)=>{
    sc(prev=>prev.filter(c=>c.investorId!==id));
    await api.del("investor",id);
    showToast("Client removed.","error");
  },[]);

  const addDeal=useCallback(async(item)=>{
    sd(prev=>[...prev,item]);
    await api.put("pe_companies",item);
    showToast("Deal added to DynamoDB.");
  },[]);
  const updateDeal=useCallback(async(id,fields)=>{
    sd(prev=>prev.map(d=>d.dealId===id?{...d,...fields}:d));
    await api.patch("pe_companies",id,fields);
    showToast(`Deal updated.`);
  },[]);
  const removeDeal=useCallback(async(id)=>{
    sd(prev=>prev.filter(d=>d.dealId!==id));
    await api.del("pe_companies",id);
    showToast("Deal removed.","error");
  },[]);

  const addEvent=useCallback(async(item)=>{
    se(prev=>[...prev,item]);
    await api.put("calendar",item);
    showToast(`Event "${item.title}" added.`);
  },[]);
  const removeEvent=useCallback(async(id)=>{
    se(prev=>prev.filter(e=>e.eventId!==id));
    await api.del("calendar",id);
    showToast("Event removed.","error");
  },[]);

  const addWorker=useCallback(async(item)=>{
    sw(prev=>[...prev,item]);
    await api.put("workers",item);
    showToast("Worker added.");
  },[]);
  const updateWorker=useCallback(async(id,fields)=>{
    sw(prev=>prev.map(w=>w.workerId===id?{...w,...fields}:w));
    await api.patch("workers",id,fields);
    showToast("Worker saved.");
  },[]);
  const removeWorker=useCallback(async(id)=>{
    sw(prev=>prev.filter(w=>w.workerId!==id));
    await api.del("workers",id);
    showToast("Worker removed.","error");
  },[]);

  const tabs=["Clients","Private Equity","Private Credit","Real Estate","Dashboard","Calendar","Email","Workers"];

  if(loading)return<div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center"}}><Spinner text="Connecting to AWS DynamoDB…"/></div>;

  return(
    <div style={{minHeight:"100vh",background:"var(--ow)",display:"flex"}}>
      <div style={{width:228,background:"var(--w)",borderRight:"var(--bdr)",display:"flex",flexDirection:"column",position:"fixed",top:0,bottom:0,left:0}}>
        <div style={{padding:"18px 16px",borderBottom:"var(--bdr)",lineHeight:1}}><LogoInline size={13}/><div style={{fontSize:9,fontWeight:700,letterSpacing:"0.12em",textTransform:"uppercase",color:"var(--blue)",marginTop:6}}>TEAM CONSOLE</div></div>
        <div style={{padding:"12px 9px",flex:1}}>{tabs.map(t=><SideBtn key={t} label={t} active={tab===t} onClick={()=>st(t)}/>)}</div>
        <div style={{padding:"14px 16px",borderTop:"var(--bdr)"}}>
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
            <div style={{width:34,height:34,background:"var(--blue)",borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontFamily:"var(--ff-h)",fontSize:14,fontWeight:800}}>{(user.name||"W")[0]}</div>
            <div style={{minWidth:0}}>
              <div style={{fontSize:12,fontWeight:700,color:"var(--head)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{user.name}</div>
              <div style={{fontSize:11,color:"var(--dim)"}}>{user.role}</div>
            </div>
          </div>
          <button style={{...T.btnG,width:"100%",fontSize:11}} onClick={onLogout}>Sign Out</button>
        </div>
      </div>
      <div style={{marginLeft:228,flex:1,padding:"32px 40px"}}>
        {tab==="Clients"       &&<WClients clients={clients} addClient={addClient} updateClient={updateClient} removeClient={removeClient} showToast={showToast}/>}
        {tab==="Private Equity"&&<WPE deals={deals} addDeal={addDeal} updateDeal={updateDeal} removeDeal={removeDeal} workers={workers} showToast={showToast}/>}
        {tab==="Private Credit"&&<WCredit showToast={showToast}/>}
        {tab==="Real Estate"   &&<WRE assets={re} setAssets={sr} showToast={showToast}/>}
        {tab==="Dashboard"     &&<WDash clients={clients} deals={deals} re={re}/>}
        {tab==="Calendar"      &&<WCal events={events} addEvent={addEvent} removeEvent={removeEvent} workers={workers}/>}
        {tab==="Email"         &&<WEmail clients={clients} workers={workers} user={user} showToast={showToast}/>}
        {tab==="Workers"       &&<WWorkers workers={workers} addWorker={addWorker} updateWorker={updateWorker} removeWorker={removeWorker} showToast={showToast}/>}
      </div>
      <Toast msg={toast.msg} type={toast.type} onClose={()=>stt({msg:"",type:"success"})}/>
    </div>
  );
}

// ── WORKER: CLIENTS ───────────────────────────────────────────────────────────
function WClients({clients,addClient,updateClient,removeClient,showToast}){
  const [view,sv]=useState("list");
  const [sel,ss]=useState(null);
  const [form,sf]=useState({});
  const blank={name:"",email:"",phone:"",joinDate:"",term:"",aum:"",pnl:"",cumulativePnl:"",strategy:"",risk:"Moderate"};
  const fset=k=>e=>sf(p=>({...p,[k]:e.target.value}));

  const doAdd=async()=>{
    if(!form.name||!form.email){alert("Name and email required.");return;}
    await addClient({...form,investorId:`c_${uid()}`,aum:+form.aum||0,pnl:+form.pnl||0,cumulativePnl:+form.cumulativePnl||0,investments:[],history:[],documents:[]});
    sf(blank);sv("list");
  };
  const doSave=async()=>{
    await updateClient(form.investorId,{...form,aum:+form.aum,pnl:+form.pnl,cumulativePnl:+form.cumulativePnl});
    sv("list");
  };
  const doDel=async(id)=>{
    if(!confirm("Permanently delete this client from DynamoDB?"))return;
    await removeClient(id);sv("list");
  };

  const FormPanel=({isEdit})=>(
    <div>
      <div style={{display:"flex",gap:14,alignItems:"center",marginBottom:28}}>
        <button style={{...T.btnG,fontSize:12}} onClick={()=>sv("list")}>← Back</button>
        <h1 style={{...T.hdg,fontSize:32}}>{isEdit?"Edit Client":"New Client"}</h1>
      </div>
      <div style={{...T.card,maxWidth:700}}>
        <div className="form-2col" style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:0}}>
          <Inp label="Name / Organisation *" value={form.name||""} onChange={fset("name")}/>
          <div style={{paddingLeft:16}}><Inp label="Email *" type="email" value={form.email||""} onChange={fset("email")}/></div>
          <Inp label="Phone" value={form.phone||""} onChange={fset("phone")}/>
          <div style={{paddingLeft:16}}><Inp label="Join Date" type="date" value={form.joinDate||""} onChange={fset("joinDate")}/></div>
          <Inp label="Investment Term" value={form.term||""} onChange={fset("term")} placeholder="e.g. 10 years"/>
          <div style={{paddingLeft:16}}><Inp label="Strategy" value={form.strategy||""} onChange={fset("strategy")}/></div>
          <Inp label="AUM (USD)" type="number" value={form.aum||""} onChange={fset("aum")}/>
          <div style={{paddingLeft:16}}><Inp label="Net P&L (USD)" type="number" value={form.pnl||""} onChange={fset("pnl")}/></div>
          <Inp label="Cumulative P&L (USD)" type="number" value={form.cumulativePnl||""} onChange={fset("cumulativePnl")}/>
          <div style={{paddingLeft:16}}><Sel label="Risk Profile" value={form.risk||"Moderate"} onChange={fset("risk")} options={["Conservative","Low","Moderate","Moderate-High","High","Aggressive"]}/></div>
        </div>
        <div style={{display:"flex",gap:12,marginTop:8}}>
          <button style={T.btnP} onClick={isEdit?doSave:doAdd}>{isEdit?"Save to DynamoDB":"Create Client"}</button>
          {isEdit&&<button style={T.btnD} onClick={()=>doDel(form.investorId)}>Delete</button>}
          <button style={T.btnG} onClick={()=>sv("list")}>Cancel</button>
        </div>
      </div>
    </div>
  );

  if(view==="add")return<FormPanel isEdit={false}/>;
  if(view==="edit"&&form.investorId)return<FormPanel isEdit/>;

  if(view==="profile"&&sel){
    const c=clients.find(x=>x.investorId===sel)||sel;
    return(
      <div className="fu">
        <div style={{display:"flex",gap:14,alignItems:"center",marginBottom:28}}>
          <button style={{...T.btnG,fontSize:12}} onClick={()=>sv("list")}>← Back</button>
          <h1 style={{...T.hdg,fontSize:32}}>{c.name}</h1>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20,marginBottom:20}}>
          <div style={T.card}>
            <h3 style={{...T.hdg,fontSize:17,marginBottom:16}}>Profile</h3>
            {[["Email",c.email],["Phone",c.phone],["Joined",c.joinDate],["Term",c.term],["Strategy",c.strategy],["Risk",c.risk]].map(([k,v])=><KV key={k} k={k} v={v}/>)}
            <button style={{...T.btnO,marginTop:16,width:"100%"}} onClick={()=>{sf({...c});sv("edit");}}>Edit Client</button>
          </div>
          <div>
            <div style={{display:"flex",gap:16,marginBottom:16,flexWrap:"wrap"}}>
              <StatCard label="AUM" value={$(c.aum)} accent/>
              <StatCard label="Net P&L YTD" value={$(c.pnl)}/>
            </div>
            <StatCard label="Cumulative P&L" value={$(c.cumulativePnl)}/>
          </div>
        </div>
        {(c.investments||[]).length>0&&(
          <div style={T.card}>
            <h3 style={{...T.hdg,fontSize:17,marginBottom:16}}>Portfolio Allocation</h3>
            {c.investments.map(i=><Bar key={i.name} label={i.name} pct={i.pct} value={`${$(i.value)} (${i.pct}%)`}/>)}
          </div>
        )}
      </div>
    );
  }

  return(
    <div className="fu">
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:24}}>
        <div>
          <h1 style={{...T.hdg,fontSize:34}}>Clients</h1>
          <DBBadge table="investor" count={clients.length}/>
        </div>
        <button style={T.btnP} onClick={()=>{sf(blank);sv("add");}}>+ Add Client</button>
      </div>
      <div style={T.card}>
        <table style={{width:"100%",borderCollapse:"collapse"}}>
          <thead><tr style={{borderBottom:"2px solid var(--lg)"}}>
            {["Client","Email","AUM","P&L YTD","Strategy","Risk",""].map(h=>(
              <th key={h} style={{textAlign:"left",padding:"8px 16px 12px 0",fontSize:10,fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase",color:"var(--dim)"}}>{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {clients.map(c=>(
              <tr key={c.investorId} style={{borderBottom:"1px solid var(--lg)",transition:"background 0.1s"}}
                onMouseEnter={e=>e.currentTarget.style.background="var(--ow)"}
                onMouseLeave={e=>e.currentTarget.style.background="none"}>
                <td style={{padding:"13px 16px 13px 0",fontWeight:700,color:"var(--head)"}}>{c.name}</td>
                <td style={{padding:"13px 16px 13px 0",color:"var(--dim)",fontSize:13}}>{c.email}</td>
                <td style={{padding:"13px 16px 13px 0",fontFamily:"var(--ff-m)",fontWeight:600}}>{$(c.aum)}</td>
                <td style={{padding:"13px 16px 13px 0",fontFamily:"var(--ff-m)",color:"var(--green)",fontWeight:700}}>{$(c.pnl)}</td>
                <td style={{padding:"13px 16px 13px 0",color:"var(--dim)",fontSize:13}}>{c.strategy}</td>
                <td style={{padding:"13px 16px 13px 0"}}><span style={T.tag()}>{c.risk}</span></td>
                <td style={{padding:"13px 0"}}>
                  <div style={{display:"flex",gap:8}}>
                    <button style={T.btnSm} onClick={()=>{ss(c.investorId);sv("profile");}}>View</button>
                    <button style={{...T.btnSm,background:"var(--ow)",color:"var(--body)",border:"var(--bdr)"}} onClick={()=>{sf({...c});sv("edit");}}>Edit</button>
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

// ── WORKER: PRIVATE EQUITY ─────────────────────────────────────────────────────
function WPE({deals,addDeal,updateDeal,removeDeal,workers,showToast}){
  const [sel,ss]=useState(null);
  const [showAdd,sa]=useState(false);
  const [af,saf]=useState({company:"",sector:"",revenue:"",ebitda:"",ev:"",equity:"",analyst:"Alexandra Renard",notes:"",status:"due_diligence"});
  const SC={owned:"#16a34a",due_diligence:"var(--amber)",offer:"var(--blue)",sold:"var(--dim)",rejected:"var(--red)"};
  const SL={owned:"Owned",due_diligence:"Due Diligence",offer:"Offer Stage",sold:"Sold",rejected:"Rejected"};

  const doStatus=async(id,status)=>{
    await updateDeal(id,{status,lastUpdated:now()});
  };
  const doAdd=async()=>{
    const d={...af,dealId:`pe_${uid()}`,entryDate:null,irr:null,moic:null,lastUpdated:now(),revenue:+af.revenue||0,ebitda:+af.ebitda||0,ev:+af.ev||0,equity:+af.equity||0};
    await addDeal(d);
    sa(false);saf({company:"",sector:"",revenue:"",ebitda:"",ev:"",equity:"",analyst:"Alexandra Renard",notes:"",status:"due_diligence"});
  };

  if(sel){
    const d=deals.find(x=>x.dealId===sel);
    if(!d){ss(null);return null;}
    const margin=d.ebitda&&d.revenue?((d.ebitda/d.revenue)*100).toFixed(1):"—";
    const evEb=d.ebitda&&d.ev?(d.ev/d.ebitda).toFixed(1)+"x":"—";
    return(
      <div className="fu">
        <div style={{display:"flex",gap:14,alignItems:"center",marginBottom:28}}>
          <button style={{...T.btnG,fontSize:12}} onClick={()=>ss(null)}>← Pipeline</button>
          <h1 style={{...T.hdg,fontSize:32}}>{d.company}</h1>
          <span style={T.tag(SC[d.status],`${SC[d.status]}11`)}>{SL[d.status]}</span>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20,marginBottom:20}}>
          <div style={T.card}>
            <h3 style={{...T.hdg,fontSize:17,marginBottom:16}}>Company</h3>
            {[["Sector",d.sector,false],["Revenue",$$(d.revenue),true],["EBITDA",$$(d.ebitda),true],["EBITDA Margin",`${margin}%`,true],["Enterprise Value",$$(d.ev),true],["Equity Value",$$(d.equity),true],["EV / EBITDA",evEb,true],["Analyst",d.analyst,false],["Last Updated",d.lastUpdated,true]].map(([k,v,m])=><KV key={k} k={k} v={v} mono={m}/>)}
          </div>
          <div>
            {(d.status==="owned"||d.status==="sold")&&(
              <div style={{...T.card,marginBottom:16}}>
                <h3 style={{...T.hdg,fontSize:17,marginBottom:16}}>Performance</h3>
                {[["IRR",`${d.irr}%`],["MOIC",`${d.moic}x`],["Entry Date",d.entryDate||"—"]].map(([k,v])=><KV key={k} k={k} v={v} mono accent={k==="IRR"||k==="MOIC"?"var(--green)":undefined}/>)}
              </div>
            )}
            <div style={T.card}>
              <h3 style={{...T.hdg,fontSize:17,marginBottom:14}}>Actions</h3>
              {d.status==="due_diligence"&&<><button style={{...T.btnP,width:"100%",marginBottom:10}} onClick={()=>doStatus(d.dealId,"offer")}>Advance to Offer Stage</button><button style={{...T.btnD,width:"100%"}} onClick={()=>{doStatus(d.dealId,"rejected");ss(null);}}>Reject Deal</button></>}
              {d.status==="offer"&&<><button style={{...T.btnP,width:"100%",marginBottom:10}} onClick={()=>doStatus(d.dealId,"owned")}>Accept — Mark Owned</button><button style={{...T.btnD,width:"100%"}} onClick={()=>{doStatus(d.dealId,"rejected");ss(null);}}>Reject Offer</button></>}
              {d.status==="owned"&&<button style={T.btnO} onClick={()=>doStatus(d.dealId,"sold")}>Process Sale / Mark Sold</button>}
              {(d.status==="sold"||d.status==="rejected")&&<p style={{color:"var(--dim)",fontSize:13}}>This deal is closed ({SL[d.status]}).</p>}
            </div>
          </div>
        </div>
        <div style={T.card}>
          <h3 style={{...T.hdg,fontSize:17,marginBottom:10}}>Due Diligence Notes</h3>
          <p style={{color:"var(--dim)",lineHeight:1.85}}>{d.notes}</p>
        </div>
      </div>
    );
  }

  return(
    <div className="fu">
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:24}}>
        <div>
          <h1 style={{...T.hdg,fontSize:34}}>Private Equity Pipeline</h1>
          <DBBadge table="pe_companies" count={deals.length}/>
        </div>
        <button style={T.btnP} onClick={()=>sa(true)}>+ Add Company</button>
      </div>
      {["due_diligence","offer","owned","sold","rejected"].map(status=>{
        const bucket=deals.filter(d=>d.status===status);
        if(!bucket.length)return null;
        return(
          <div key={status} style={{marginBottom:28}}>
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
              <span style={{fontFamily:"var(--ff-h)",fontSize:13,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.1em",color:SC[status]}}>{SL[status]}</span>
              <span style={{fontSize:12,color:"var(--dim)"}}>({bucket.length})</span>
            </div>
            <div style={{display:"grid",gap:10}}>
              {bucket.map(d=>(
                <div key={d.dealId} onClick={()=>ss(d.dealId)} style={{...T.card,cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center",borderLeft:`3px solid ${SC[d.status]}`,transition:"box-shadow 0.15s"}}
                  onMouseEnter={e=>e.currentTarget.style.boxShadow="var(--sh-md)"}
                  onMouseLeave={e=>e.currentTarget.style.boxShadow="var(--sh)"}>
                  <div>
                    <div style={{...T.hdg,fontSize:16,marginBottom:2}}>{d.company}</div>
                    <span style={{fontSize:12,color:"var(--dim)"}}>{d.sector} · {d.analyst} · Updated {d.lastUpdated}</span>
                  </div>
                  <div style={{textAlign:"right"}}>
                    <div style={{fontFamily:"var(--ff-m)",color:"var(--blue)",fontWeight:600}}>{$(d.ev)}</div>
                    <div style={{fontSize:10,color:"var(--dim)"}}>EV</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
      <Modal open={showAdd} onClose={()=>sa(false)} title="Add New Deal">
        <div className="form-2col" style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:0}}>
          <Inp label="Company Name" value={af.company} onChange={e=>saf(p=>({...p,company:e.target.value}))}/>
          <div style={{paddingLeft:16}}><Inp label="Sector" value={af.sector} onChange={e=>saf(p=>({...p,sector:e.target.value}))}/></div>
          <Inp label="Revenue (USD)" type="number" value={af.revenue} onChange={e=>saf(p=>({...p,revenue:e.target.value}))}/>
          <div style={{paddingLeft:16}}><Inp label="EBITDA (USD)" type="number" value={af.ebitda} onChange={e=>saf(p=>({...p,ebitda:e.target.value}))}/></div>
          <Inp label="Enterprise Value (USD)" type="number" value={af.ev} onChange={e=>saf(p=>({...p,ev:e.target.value}))}/>
          <div style={{paddingLeft:16}}><Inp label="Equity Value (USD)" type="number" value={af.equity} onChange={e=>saf(p=>({...p,equity:e.target.value}))}/></div>
          <Inp label="Analyst" value={af.analyst} onChange={e=>saf(p=>({...p,analyst:e.target.value}))}/>
          <div style={{paddingLeft:16}}><Sel label="Status" value={af.status} onChange={e=>saf(p=>({...p,status:e.target.value}))} options={[{value:"due_diligence",label:"Due Diligence"},{value:"offer",label:"Offer Stage"}]}/></div>
        </div>
        <TA label="Due Diligence Notes" value={af.notes} onChange={e=>saf(p=>({...p,notes:e.target.value}))}/>
        <div style={{display:"flex",gap:12}}>
          <button style={T.btnP} onClick={doAdd}>Add to DynamoDB</button>
          <button style={T.btnG} onClick={()=>sa(false)}>Cancel</button>
        </div>
      </Modal>
    </div>
  );
}

// ── WORKER: PRIVATE CREDIT UNDERWRITING ──────────────────────────────────────
function WCredit({showToast}){
  const [form,sf]=useState({borrowerType:"business",borrowerName:"",loanAmount:"",leverage:"",ebitdaMargin:"",yearsOperating:"",hasCollateral:"no",sponsorQuality:"none",industry:"stable",covenants:"standard"});
  const [res,sr]=useState(null);
  const [saving,ss]=useState(false);
  const set=k=>e=>sf(p=>({...p,[k]:e.target.value}));

  const grade=()=>{
    if(!form.borrowerName||!form.loanAmount){alert("Borrower name and loan amount required.");return;}
    sr(calcGrade(form));
  };
  const saveReport=async()=>{
    if(!res)return;ss(true);
    const doc={appId:`cred_${uid()}`,...form,gradeNumber:res.grade,gradeDesc:res.desc,pd:res.pd,lgd:res.lgd,el:(res.pdMid*res.lgd*100).toFixed(2),createdAt:now()};
    await api.put("credit_application",doc);
    ss(false);showToast("Underwriting report saved to DynamoDB.");
  };

  return(
    <div className="fu">
      <h1 style={{...T.hdg,fontSize:34,marginBottom:8}}>Credit Underwriting</h1>
      <p style={{color:"var(--dim)",marginBottom:28}}>Internal risk grading engine · All reports saved to pas-credit-apps</p>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:28}}>
        <div style={T.card}>
          <h3 style={{...T.hdg,fontSize:17,marginBottom:18}}>Borrower Inputs</h3>
          <Sel label="Borrower Type" value={form.borrowerType} onChange={set("borrowerType")} options={[{value:"business",label:"Business / Corporate"},{value:"individual",label:"Individual / HNW"}]}/>
          <Inp label="Borrower Name" value={form.borrowerName} onChange={set("borrowerName")}/>
          <Inp label="Loan Amount (USD)" type="number" value={form.loanAmount} onChange={set("loanAmount")}/>
          <Inp label="Leverage (Debt/EBITDA)" type="number" value={form.leverage} onChange={set("leverage")} placeholder="e.g. 5.5"/>
          <Inp label="EBITDA Margin (%)" type="number" value={form.ebitdaMargin} onChange={set("ebitdaMargin")}/>
          <Inp label="Years in Operation" type="number" value={form.yearsOperating} onChange={set("yearsOperating")}/>
          <Sel label="Collateral" value={form.hasCollateral} onChange={set("hasCollateral")} options={[{value:"yes",label:"Secured (collateral available)"},{value:"no",label:"Unsecured"}]}/>
          <Sel label="Sponsor Quality" value={form.sponsorQuality} onChange={set("sponsorQuality")} options={[{value:"strong",label:"Strong sponsor"},{value:"moderate",label:"Moderate sponsor"},{value:"weak",label:"Weak sponsor"},{value:"none",label:"No sponsor"}]}/>
          <Sel label="Industry Risk" value={form.industry} onChange={set("industry")} options={[{value:"stable",label:"Stable / Defensive"},{value:"mixed",label:"Mixed / Moderate"},{value:"cyclical",label:"Cyclical"},{value:"distressed",label:"Distressed Sector"}]}/>
          <Sel label="Covenant Package" value={form.covenants} onChange={set("covenants")} options={[{value:"standard",label:"Full covenants"},{value:"light",label:"Covenant light"},{value:"none",label:"Covenant free"}]}/>
          <button style={{...T.btnP,width:"100%"}} onClick={grade}>Run Risk Assessment</button>
        </div>
        <div>
          {res?(
            <>
              <div style={{...T.card,marginBottom:16,borderTop:`4px solid ${res.color}`}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                  <div>
                    <div style={{fontSize:10,fontWeight:700,letterSpacing:"0.12em",textTransform:"uppercase",color:"var(--dim)",marginBottom:6}}>Risk Grade</div>
                    <div style={{fontFamily:"var(--ff-h)",fontSize:80,fontWeight:800,color:res.color,lineHeight:1}}>{res.grade}</div>
                    <div style={{fontFamily:"var(--ff-h)",fontSize:24,fontWeight:700,color:res.color}}>{res.desc}</div>
                  </div>
                  <div style={{textAlign:"right",marginTop:8}}>
                    <div style={{fontSize:10,color:"var(--dim)",marginBottom:4}}>PD RANGE</div>
                    <div style={{fontFamily:"var(--ff-m)",fontSize:20,fontWeight:600,color:"var(--head)"}}>{res.pd}</div>
                  </div>
                </div>
              </div>
              <div style={T.card}>
                <h3 style={{...T.hdg,fontSize:17,marginBottom:16}}>Risk Parameters</h3>
                {[
                  ["Probability of Default",res.pd,true],
                  ["Loss Given Default (LGD)",pct(res.lgd),true],
                  ["Expected Loss (EL)",`${(res.pdMid*res.lgd*100).toFixed(2)}%`,true],
                  ["Expected Loss (Amount)",$$(res.pdMid*res.lgd*(+form.loanAmount||0)),true],
                  ["Suggested Floor Pricing",`Base + ${(res.pdMid*100+3).toFixed(1)}%`,true],
                ].map(([k,v,m])=><KV key={k} k={k} v={v} mono={m}/>)}
                <div style={{marginTop:16,padding:14,background:"var(--ow)",borderRadius:"var(--r)",fontSize:13,color:"var(--body)",lineHeight:1.75}}>
                  <strong>Analyst Notes: </strong>{res.notes}
                </div>
                {res.grade>=8&&<div style={{marginTop:12,padding:12,background:"#fef2f2",border:"1px solid #fca5a5",borderRadius:"var(--r)",fontSize:12,color:"var(--red)",fontWeight:700}}>⚠ Grade {res.grade} — IC approval required. Consider distressed fund allocation only.</div>}
                <button style={{...T.btnO,marginTop:16,width:"100%"}} onClick={saveReport} disabled={saving}>{saving?"Saving…":"Save Report to DynamoDB"}</button>
              </div>
            </>
          ):(
            <div style={{...T.card,textAlign:"center",padding:60}}>
              <div style={{fontSize:44,color:"var(--mg)",marginBottom:16}}>◈</div>
              <p style={{color:"var(--dim)",marginBottom:32}}>Complete borrower inputs and run the assessment to see risk parameters.</p>
              <div style={{textAlign:"left"}}>
                <div style={{fontSize:10,fontWeight:700,letterSpacing:"0.12em",textTransform:"uppercase",color:"var(--dim)",marginBottom:12}}>Grade Reference</div>
                {RISK_GRADES.map(g=>(
                  <div key={g.grade} style={{display:"flex",gap:10,padding:"5px 0",borderBottom:"1px solid var(--lg)",fontSize:12}}>
                    <span style={{fontFamily:"var(--ff-m)",color:g.color,fontWeight:700,width:18}}>{g.grade}</span>
                    <span style={{...T.hdg,fontSize:12,width:90}}>{g.desc}</span>
                    <span style={{color:"var(--dim)"}}>PD {g.pd}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── WORKER: REAL ESTATE ────────────────────────────────────────────────────────
function WRE({assets,setAssets,showToast}){
  const [showAdd,sa]=useState(false);
  const [af,saf]=useState({name:"",type:"Logistics",location:"",status:"development",purchasePrice:"",currentValue:"",irr:"",occupancy:"",sqft:""});

  const doAdd=async()=>{
    if(!af.name||!af.purchasePrice){alert("Name and purchase price required.");return;}
    const a={...af,assetId:`re_${uid()}`,purchasePrice:+af.purchasePrice||0,currentValue:+af.currentValue||0,irr:af.irr?+af.irr:null,occupancy:+af.occupancy||0,sqft:+af.sqft||0};
    setAssets(p=>[...p,a]);
    await api.put("real_estate",a);
    showToast("Asset added to DynamoDB.");
    sa(false);saf({name:"",type:"Logistics",location:"",status:"development",purchasePrice:"",currentValue:"",irr:"",occupancy:"",sqft:""});
  };

  const total=assets.reduce((s,a)=>s+a.currentValue,0);
  const gain=assets.reduce((s,a)=>s+(a.currentValue-a.purchasePrice),0);
  const SC2={owned:"var(--green)",development:"var(--amber)",sold:"var(--dim)"};

  return(
    <div className="fu">
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:24}}>
        <div>
          <h1 style={{...T.hdg,fontSize:34}}>Real Estate</h1>
          <DBBadge table="real_estate" count={assets.length}/>
        </div>
        <button style={T.btnP} onClick={()=>sa(true)}>+ Add Asset</button>
      </div>
      <div style={{display:"flex",gap:16,marginBottom:24,flexWrap:"wrap"}}>
        <StatCard label="Portfolio Value" value={$(total)} accent/>
        <StatCard label="Total Gain" value={$(gain)} sub={total>0?`+${((gain/(total-gain||1))*100).toFixed(1)}%`:"—"}/>
        <StatCard label="Assets" value={assets.length} sub="Active positions"/>
      </div>
      <div style={{display:"grid",gap:16}}>
        {assets.map(a=>(
          <div key={a.assetId} style={{...T.card,borderLeft:`3px solid ${SC2[a.status]||"var(--dim)"}`}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
              <div>
                <h3 style={{...T.hdg,fontSize:17,marginBottom:6}}>{a.name}</h3>
                <div style={{display:"flex",gap:10}}><span style={T.tag()}>{a.type}</span><span style={{fontSize:13,color:"var(--dim)"}}>{a.location}</span></div>
              </div>
              <div style={{textAlign:"right"}}>
                <div style={{fontFamily:"var(--ff-h)",fontSize:24,fontWeight:800,color:"var(--blue)"}}>{$(a.currentValue)}</div>
                <div style={{fontSize:12,fontWeight:700,color:a.currentValue>=a.purchasePrice?"var(--green)":"var(--red)"}}>
                  {a.currentValue>=a.purchasePrice?"+":""}{$(a.currentValue-a.purchasePrice)} ({(((a.currentValue-a.purchasePrice)/(a.purchasePrice||1))*100).toFixed(1)}%)
                </div>
              </div>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:16,marginTop:16,paddingTop:14,borderTop:"1px solid var(--lg)"}}>
              {[["Purchase",$$(a.purchasePrice)],["Gross IRR",a.irr?`${a.irr}%`:"—"],["Occupancy",a.occupancy?`${a.occupancy}%`:"—"],["Status",a.status.charAt(0).toUpperCase()+a.status.slice(1)]].map(([k,v])=>(
                <div key={k}><div style={{fontSize:10,color:"var(--dim)",textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:2}}>{k}</div><div style={{fontFamily:"var(--ff-m)",fontSize:13,fontWeight:600}}>{v}</div></div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <Modal open={showAdd} onClose={()=>sa(false)} title="Add Real Estate Asset">
        <div className="form-2col" style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:0}}>
          <Inp label="Asset Name *" value={af.name} onChange={e=>saf(p=>({...p,name:e.target.value}))}/>
          <div style={{paddingLeft:16}}><Sel label="Type" value={af.type} onChange={e=>saf(p=>({...p,type:e.target.value}))} options={["Logistics","Multifamily","Commercial","Life Science","Retail","Mixed-Use"]}/></div>
          <Inp label="Location" value={af.location} onChange={e=>saf(p=>({...p,location:e.target.value}))}/>
          <div style={{paddingLeft:16}}><Sel label="Status" value={af.status} onChange={e=>saf(p=>({...p,status:e.target.value}))} options={[{value:"development",label:"Development"},{value:"owned",label:"Owned"},{value:"sold",label:"Sold"}]}/></div>
          <Inp label="Purchase Price (USD) *" type="number" value={af.purchasePrice} onChange={e=>saf(p=>({...p,purchasePrice:e.target.value}))}/>
          <div style={{paddingLeft:16}}><Inp label="Current Value (USD)" type="number" value={af.currentValue} onChange={e=>saf(p=>({...p,currentValue:e.target.value}))}/></div>
          <Inp label="Gross IRR (%)" type="number" value={af.irr} onChange={e=>saf(p=>({...p,irr:e.target.value}))}/>
          <div style={{paddingLeft:16}}><Inp label="Occupancy (%)" type="number" value={af.occupancy} onChange={e=>saf(p=>({...p,occupancy:e.target.value}))}/></div>
        </div>
        <div style={{display:"flex",gap:12}}>
          <button style={T.btnP} onClick={doAdd}>Add to DynamoDB</button>
          <button style={T.btnG} onClick={()=>sa(false)}>Cancel</button>
        </div>
      </Modal>
    </div>
  );
}

// ── WORKER: DASHBOARD ──────────────────────────────────────────────────────────
function WDash({clients,deals,re}){
  const totalAUM=clients.reduce((s,c)=>s+(c.aum||0),0);
  const totalPnL=clients.reduce((s,c)=>s+(c.pnl||0),0);
  const ret=totalAUM>0?((totalPnL/totalAUM)*100).toFixed(1):0;
  const peOwned=deals.filter(d=>d.status==="owned");
  const peEV=peOwned.reduce((s,d)=>s+(d.ev||0),0);
  const reTotal=re.reduce((s,a)=>s+(a.currentValue||0),0);
  const strats={};clients.forEach(c=>{if(c.strategy)strats[c.strategy]=(strats[c.strategy]||0)+c.aum;});
  return(
    <div className="fu">
      <h1 style={{...T.hdg,fontSize:34,marginBottom:28}}>Firm Dashboard</h1>
      <div style={{display:"flex",gap:16,marginBottom:24,flexWrap:"wrap"}}>
        <StatCard label="Total AUM" value={$(totalAUM)} sub={`${clients.length} clients`} accent/>
        <StatCard label="Blended Return YTD" value={`${ret}%`} trend={+ret}/>
        <StatCard label="Total P&L YTD" value={$(totalPnL)} sub="Net across all accounts"/>
        <StatCard label="PE Portfolio EV" value={$(peEV)} sub={`${peOwned.length} owned`}/>
        <StatCard label="Real Estate" value={$(reTotal)} sub={`${re.length} assets`}/>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20,marginBottom:20}}>
        <div style={T.card}>
          <h3 style={{...T.hdg,fontSize:17,marginBottom:18}}>AUM by Strategy</h3>
          {Object.entries(strats).map(([s,v])=><Bar key={s} label={s} pct={totalAUM>0?(v/totalAUM)*100:0} value={`${$(v)} (${totalAUM>0?((v/totalAUM)*100).toFixed(0):0}%)`}/>)}
        </div>
        <div style={T.card}>
          <h3 style={{...T.hdg,fontSize:17,marginBottom:18}}>PE Pipeline</h3>
          {[["Owned","owned","#16a34a"],["Due Diligence","due_diligence","var(--amber)"],["Offer Stage","offer","var(--blue)"],["Sold","sold","var(--dim)"],["Rejected","rejected","var(--red)"]].map(([l,s,c])=>(
            <div key={s} style={{display:"flex",justifyContent:"space-between",padding:"10px 0",borderBottom:"1px solid var(--lg)"}}>
              <span style={{color:"var(--body)"}}>{l}</span>
              <span style={{fontFamily:"var(--ff-m)",color:c,fontWeight:700}}>{deals.filter(d=>d.status===s).length}</span>
            </div>
          ))}
        </div>
      </div>
      <div style={T.card}>
        <h3 style={{...T.hdg,fontSize:17,marginBottom:18}}>AUM Growth Projections</h3>
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:16}}>
          {[["12-Month",totalAUM*1.18,18],["24-Month",totalAUM*1.38,38],["36-Month",totalAUM*1.62,62]].map(([l,v,p])=>(
            <div key={l} style={{textAlign:"center",padding:20,background:"var(--ow)",borderRadius:"var(--r)"}}>
              <div style={{fontSize:10,fontWeight:700,letterSpacing:"0.12em",textTransform:"uppercase",color:"var(--dim)",marginBottom:8}}>{l} Target</div>
              <div style={{fontFamily:"var(--ff-h)",fontSize:26,fontWeight:800,color:"var(--blue)"}}>{$(v)}</div>
              <div style={{fontSize:12,color:"var(--green)",fontWeight:700,marginTop:4}}>+{p}% growth</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── WORKER: CALENDAR ───────────────────────────────────────────────────────────
function WCal({events,addEvent,removeEvent,workers}){
  const [showAdd,sa]=useState(false);
  const [form,sf]=useState({date:"",title:"",members:[]});
  const doAdd=async()=>{
    if(!form.date||!form.title){alert("Date and title required.");return;}
    const ev={...form,eventId:`ev_${uid()}`};
    await addEvent(ev);
    // Notify each assigned worker by email
    const assignedWorkers=workers.filter(w=>form.members.includes(w.workerId));
    if(assignedWorkers.length){await notify.calendar({event:ev,workers:assignedWorkers});}
    sa(false);sf({date:"",title:"",members:[]});
  };
  const sorted=[...events].sort((a,b)=>a.date.localeCompare(b.date));
  const MONTHS=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return(
    <div className="fu">
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:24}}>
        <div>
          <h1 style={{...T.hdg,fontSize:34}}>Team Calendar</h1>
          <DBBadge table="calendar" count={events.length}/>
        </div>
        <button style={T.btnP} onClick={()=>sa(true)}>+ Add Event</button>
      </div>
      <div style={{display:"grid",gap:12}}>
        {sorted.map(ev=>{
          const [,m,d]=ev.date.split("-");
          return(
            <div key={ev.eventId} style={{...T.card,display:"flex",gap:20,alignItems:"center"}}>
              <div style={{width:54,background:"var(--blue)",borderRadius:"var(--r)",padding:"8px 0",textAlign:"center",flexShrink:0}}>
                <div style={{fontSize:9,fontWeight:700,color:"rgba(255,255,255,0.65)",letterSpacing:"0.1em"}}>{MONTHS[+m-1]}</div>
                <div style={{fontFamily:"var(--ff-h)",fontSize:26,fontWeight:800,color:"#fff",lineHeight:1}}>{d}</div>
              </div>
              <div style={{flex:1}}>
                <div style={{fontWeight:700,color:"var(--head)",marginBottom:3}}>{ev.title}</div>
                <div style={{fontSize:12,color:"var(--dim)"}}>
                  {(ev.members||[]).map(m=>workers.find(w=>w.workerId===m)?.name).filter(Boolean).join(", ")||"All team"}
                </div>
              </div>
              <button style={T.btnD} onClick={()=>removeEvent(ev.eventId)}>Remove</button>
            </div>
          );
        })}
      </div>
      <Modal open={showAdd} onClose={()=>sa(false)} title="Add Calendar Event" width={480}>
        <Inp label="Date" type="date" value={form.date} onChange={e=>sf(p=>({...p,date:e.target.value}))}/>
        <Inp label="Event Title" value={form.title} onChange={e=>sf(p=>({...p,title:e.target.value}))}/>
        <div style={{marginBottom:20}}>
          <label style={T.lbl}>Assign Team Members</label>
          {workers.map(w=>(
            <label key={w.workerId} style={{display:"flex",gap:10,alignItems:"center",marginBottom:10,cursor:"pointer"}}>
              <input type="checkbox" checked={form.members.includes(w.workerId)} onChange={e=>sf(p=>({...p,members:e.target.checked?[...p.members,w.workerId]:p.members.filter(m=>m!==w.workerId)}))} style={{width:16,height:16,accentColor:"var(--blue)"}}/>
              <span style={{fontSize:14}}>{w.name} <span style={{color:"var(--dim)"}}>— {w.role}</span></span>
            </label>
          ))}
        </div>
        <div style={{display:"flex",gap:12}}>
          <button style={T.btnP} onClick={doAdd}>Save to DynamoDB</button>
          <button style={T.btnG} onClick={()=>sa(false)}>Cancel</button>
        </div>
      </Modal>
    </div>
  );
}

// ── WORKER: EMAIL ──────────────────────────────────────────────────────────────
function WEmail({clients,workers,user,showToast}){
  const [to,st]=useState("");
  const [custom,sc]=useState("");
  const [subject,ss]=useState("");
  const [body,sb]=useState("");
  const [sending,ssn]=useState(false);
  const [sent,sse]=useState(false);
  const finalTo=to==="custom"?custom:to;

  const send=async()=>{
    if(!finalTo||!subject||!body){alert("Fill all fields.");return;}
    ssn(true);
    const sentBy=typeof user!=="undefined"?user?.name:"worker";
    // Save log to DynamoDB and send real email via SES
    await Promise.all([
      api.put("enquiries",{inquiryId:`em_${uid()}`,to:finalTo,subject,body,sentAt:now(),sentBy}),
      notify.workerEmail({to:finalTo,subject,body,sentBy}),
    ]);
    ssn(false);sse(true);showToast(`Email sent to ${finalTo}`);
    setTimeout(()=>{sse(false);st("");sc("");ss("");sb("");},2500);
  };

  return(
    <div className="fu">
      <h1 style={{...T.hdg,fontSize:34,marginBottom:8}}>Draft & Send Email</h1>
      <p style={{color:"var(--dim)",marginBottom:28}}>Compose emails to clients or new contacts. All emails logged to pas-emails.</p>
      <div style={{...T.card,maxWidth:720}}>
        <div style={{marginBottom:16}}>
          <label style={T.lbl}>Recipient</label>
          <select style={{...T.inp,marginBottom:8}} value={to} onChange={e=>st(e.target.value)}>
            <option value="">Select client from list…</option>
            {clients.map(c=><option key={c.investorId} value={c.email}>{c.name} ({c.email})</option>)}
            <option value="custom">New contact (enter manually)</option>
          </select>
          {to==="custom"&&<Inp label="Email Address" type="email" value={custom} onChange={e=>sc(e.target.value)} placeholder="contact@fund.com"/>}
        </div>
        <Inp label="Subject" value={subject} onChange={e=>ss(e.target.value)} placeholder="e.g. Q2 2024 Portfolio Update"/>
        <TA label="Body" value={body} onChange={e=>sb(e.target.value)} style={{minHeight:220}} placeholder={"Dear [Name],\n\nI hope this message finds you well…"}/>
        <button style={{...T.btnP,opacity:sent?0.6:1}} onClick={send} disabled={sending||sent}>{sent?"Sent ✓":sending?"Saving to DB…":"Send Email"}</button>
      </div>
    </div>
  );
}

// ── WORKER: WORKERS MANAGEMENT ────────────────────────────────────────────────
function WWorkers({workers,addWorker,updateWorker,removeWorker,showToast}){
  const blank={name:"",email:"",phone:"",role:"",dept:""};
  const [showAdd,sa]=useState(false);
  const [editId,sei]=useState(null);
  const [form,sf]=useState(blank);
  const [saving,sv]=useState(false);

  const openEdit=(w)=>{sf({name:w.name||"",email:w.email||"",phone:w.phone||"",role:w.role||"",dept:w.dept||""});sei(w.workerId);sa(true);};

  const save=async()=>{
    if(!form.name||!form.email){showToast("Name and email required.","error");return;}
    sv(true);
    if(editId){
      await updateWorker(editId,form);
    } else {
      await addWorker({workerId:`w_${Date.now()}`,joinedAt:new Date().toISOString().slice(0,10),...form});
    }
    sv(false);sa(false);sf(blank);sei(null);
  };

  const ROLES=["Portfolio Manager","Credit Analyst","Associate","Analyst","Vice President","Managing Director","Operations","Compliance","Technology","Other"];
  const DEPTS=["Investments","Private Credit","Private Equity","Real Estate","Operations","Technology","Compliance","Finance","Other"];

  return(
    <div className="fu">
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:24}}>
        <div>
          <h1 style={{...T.hdg,fontSize:34,marginBottom:4}}>Team Members</h1>
          <DBBadge table="workers" count={workers.length}/>
        </div>
        <button style={T.btnP} onClick={()=>{sf(blank);sei(null);sa(true);}}>+ Add Worker</button>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(340px,1fr))",gap:16}}>
        {workers.map(w=>(
          <div key={w.workerId} style={{...T.card}}>
            <div style={{display:"flex",alignItems:"flex-start",gap:14,marginBottom:16}}>
              <div style={{width:44,height:44,background:"var(--blue)",borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontFamily:"var(--ff-h)",fontSize:18,fontWeight:800,flexShrink:0}}>
                {(w.name||"?")[0].toUpperCase()}
              </div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontWeight:700,color:"var(--head)",fontSize:15,marginBottom:2}}>{w.name}</div>
                <div style={{fontSize:12,color:"var(--blue)",fontWeight:600}}>{w.role||"—"}</div>
                <div style={{fontSize:11,color:"var(--dim)"}}>{w.dept||""}</div>
              </div>
            </div>
            <div style={{display:"grid",gap:6,marginBottom:16}}>
              <KV k="Email" v={w.email||"—"}/>
              <KV k="Phone" v={w.phone||"—"}/>
            </div>
            <div style={{display:"flex",gap:8}}>
              <button style={{...T.btnSm,flex:1}} onClick={()=>openEdit(w)}>Edit</button>
              <button style={{...T.btnD,fontSize:12,padding:"6px 14px"}} onClick={()=>{if(window.confirm(`Remove ${w.name}?`))removeWorker(w.workerId);}}>Remove</button>
            </div>
          </div>
        ))}
      </div>

      <div style={{...T.card,marginTop:32,borderLeft:"3px solid var(--blue)"}}>
        <h3 style={{...T.hdg,fontSize:15,marginBottom:12}}>Notification Reference</h3>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          {[["📧 Calendar Email","Worker receives an email when assigned to a calendar event."],["📧 Compose (Email tab)","Real email sent via SES, not just a DynamoDB log."],["📧 Contact Form","Inquiries trigger an email alert to your ops inbox."],["📧 Credit Form","New credit applications trigger an alert to your ops inbox."]].map(([t,d])=>(
            <div key={t} style={{background:"var(--ow)",borderRadius:6,padding:"12px 14px"}}>
              <div style={{fontWeight:700,fontSize:13,marginBottom:4}}>{t}</div>
              <div style={{fontSize:12,color:"var(--dim)",lineHeight:1.6}}>{d}</div>
            </div>
          ))}
        </div>
      </div>

      <Modal open={showAdd} onClose={()=>{sa(false);sei(null);sf(blank);}} title={editId?"Edit Worker":"Add New Worker"} width={520}>
        <div className="form-2col" style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:0}}>
          <Inp label="Full Name *" value={form.name} onChange={e=>sf(p=>({...p,name:e.target.value}))}/>
          <div style={{paddingLeft:16}}><Inp label="Email Address *" type="email" value={form.email} onChange={e=>sf(p=>({...p,email:e.target.value}))}/></div>
          <Inp label="Phone" value={form.phone} onChange={e=>sf(p=>({...p,phone:e.target.value}))} placeholder="+12125550101"/>
          <div style={{paddingLeft:16}}>
            <label style={T.lbl}>Role</label>
            <select style={T.inp} value={form.role} onChange={e=>sf(p=>({...p,role:e.target.value}))}>
              <option value="">Select role…</option>
              {ROLES.map(r=><option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div style={{gridColumn:"1/-1"}}>
            <label style={T.lbl}>Department</label>
            <select style={T.inp} value={form.dept} onChange={e=>sf(p=>({...p,dept:e.target.value}))}>
              <option value="">Select department…</option>
              {DEPTS.map(d=><option key={d} value={d}>{d}</option>)}
            </select>
          </div>
        </div>
        <div style={{display:"flex",gap:12,marginTop:8}}>
          <button style={T.btnP} onClick={save} disabled={saving}>{saving?"Saving…":editId?"Save Changes":"Add Worker"}</button>
          <button style={T.btnG} onClick={()=>{sa(false);sei(null);sf(blank);}}>Cancel</button>
        </div>
      </Modal>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  APP ROOT — URL-aware router
// ─────────────────────────────────────────────────────────────────────────────
export default function App(){
  const [page,sp]=useState(()=>IS_PUBLIC?getPageFromPath():"home");
  const [investorUser,siu]=useState(null);
  const [workerUser,swu]=useState(null);
  const [lang,setLang]=useState("en");

  // Inject global styles
  useEffect(()=>{
    let el=document.getElementById("pas-theme");
    if(!el){el=document.createElement("style");el.id="pas-theme";document.head.appendChild(el);}
    el.textContent=THEME;
    return()=>el.remove();
  },[]);

  // Document title
  useEffect(()=>{
    document.title = page==="investor" ? "Investor Portal — Prime Alpha Securities" : page==="worker" ? "Team Console — Prime Alpha Securities" : "Prime Alpha Securities";
  },[]);

  // Browser back/forward
  useEffect(()=>{
    if(!IS_PUBLIC)return;
    const onPop=()=>sp(getPageFromPath());
    window.addEventListener("popstate",onPop);
    return()=>window.removeEventListener("popstate",onPop);
  },[]);

  // Patch pushState so navigate() triggers re-render
  useEffect(()=>{
    if(!IS_PUBLIC)return;
    const orig=window.history.pushState.bind(window.history);
    window.history.pushState=function(state,...args){
      orig(state,...args);
      sp(getPageFromPath());
    };
    return()=>{window.history.pushState=orig;};
  },[]);

  // ── Public URL routing ────────────────────────────────────────────
  const renderPage=()=>{
    switch(page){
      case"investor":         return investorUser?<InvestorPortal user={investorUser} setUser={siu} onLogout={()=>{siu(null);navigate("home");}}/>:<LoginPage type="investor" onSuccess={u=>siu(u)}/>;
      case"worker":          return workerUser?<WorkerPortal user={workerUser} onLogout={()=>{swu(null);navigate("home");}}/>:<LoginPage type="worker" onSuccess={u=>swu(u)}/>;
      case"home":             return<PublicHome/>;
      case"Overview":         return<WhoWeAre sub="Overview"/>;
      case"The Team":         return<WhoWeAre sub="The Team"/>;
      case"Culture":          return<WhoWeAre sub="Culture"/>;
      case"Leadership":       return<WhoWeAre sub="The Team"/>;
      case"Civic Priorities": return<WhoWeAre sub="Civic Priorities"/>;
      case"Who We Are":       return<WhoWeAre sub="Overview"/>;
      case"What We Do":       return<WhatWeDo sub="Overview"/>;
      case"Private Equity":   return<WhatWeDo sub="Private Equity"/>;
      case"Private Credit":   return<WhatWeDo sub="Private Credit"/>;
      case"Real Estate":      return<WhatWeDo sub="Real Estate"/>;
      case"Commodities":      return<WhatWeDo sub="Commodities"/>;
      case"Fund Terms":        return<FundTerms/>;
      case"Careers":          return<Careers/>;
      case"Research":         return<Research/>;
      case"Contact":          return<Contact/>;
      case"Privacy":
      case"Terms":
      case"Notices":
      case"Disclosures":      return<Legal type={page}/>;
      default:                return<PublicHome/>;
    }
  };

  return(
    <LangCtx.Provider value={[lang,setLang]}>
    <div style={{minHeight:"100vh",background:"var(--w)"}}>
      <PublicNav/>
      {renderPage()}
      <PublicFooter/>
    </div>
    </LangCtx.Provider>
  );
}
