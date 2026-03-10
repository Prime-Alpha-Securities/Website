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
//    enquiries          PK: enquiryId   (S)

import { useState, useEffect, useRef, useCallback } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
//  AWS CONFIG  ← paste root credentials from AWS Console → Security credentials
// ─────────────────────────────────────────────────────────────────────────────
// AWS credentials: EC2 IAM role (automatic via IMDS)

// ─────────────────────────────────────────────────────────────────────────────
//  RUNTIME CONTEXT  — detects which subdomain we're on
// ─────────────────────────────────────────────────────────────────────────────
const HOSTNAME    = typeof window !== "undefined" ? window.location.hostname : "";
const IS_INVESTOR = HOSTNAME.startsWith("investor.");
const IS_WORKER   = HOSTNAME.startsWith("worker.");
const IS_PUBLIC   = !IS_INVESTOR && !IS_WORKER;
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
  async enquiry(data)    { try { await fetch('/api/notify/enquiry',     {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)}); } catch(e){console.warn('[notify]',e.message);} },
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
@import url('https://fonts.googleapis.com/css2?family=Barlow:ital,wght@0,300;0,400;0,500;0,600;0,700;1,300&family=Barlow+Condensed:wght@300;400;500;600;700;800&family=IBM+Plex+Mono:wght@300;400;500&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{
  --w:#FFFFFF;--ow:#F7F8FA;--lg:#ECEEF2;--mg:#D0D4DC;--dim:#8A9099;
  --body:#1E2330;--head:#0B0F1A;
  --blue:#0057FF;--blue-h:#0046CC;--blue-l:#E8EFFE;--blue-m:rgba(0,87,255,0.1);
  --green:#00875A;--red:#C0392B;--amber:#B45309;
  --ff-h:'Barlow Condensed',sans-serif;
  --ff-b:'Barlow',sans-serif;
  --ff-m:'IBM Plex Mono',monospace;
  --r:3px;--rl:6px;
  --bdr:1px solid #DDDFE5;
  --sh:0 1px 3px rgba(0,0,0,0.06);
  --sh-md:0 4px 16px rgba(0,0,0,0.08);
  --sh-lg:0 12px 40px rgba(0,0,0,0.11);
}
html{scroll-behavior:smooth}
body{font-family:var(--ff-b);background:var(--w);color:var(--body);font-size:15px;line-height:1.6;-webkit-font-smoothing:antialiased}
::-webkit-scrollbar{width:4px}::-webkit-scrollbar-track{background:var(--lg)}::-webkit-scrollbar-thumb{background:var(--mg);border-radius:2px}
a{color:inherit;text-decoration:none}button{cursor:pointer;border:none;background:none;font-family:inherit}
input,textarea,select{font-family:inherit}

@keyframes fadeUp{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:translateY(0)}}
@keyframes fadeIn{from{opacity:0}to{opacity:1}}
@keyframes slideRight{from{opacity:0;transform:translateX(-10px)}to{opacity:1;transform:translateX(0)}}
@keyframes spin{to{transform:rotate(360deg)}}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}

.fu{animation:fadeUp 0.45s cubic-bezier(.4,0,.2,1) both}
.fi{animation:fadeIn 0.3s ease both}
.sr{animation:slideRight 0.35s ease both}
.fu-1{animation-delay:0.08s}.fu-2{animation-delay:0.16s}.fu-3{animation-delay:0.24s}.fu-4{animation-delay:0.32s}
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
function Logo({size=18,dark=false}){
  const c=dark?"#fff":"var(--head)";
  return(
    <span style={{fontFamily:"var(--ff-h)",fontSize:size,fontWeight:800,letterSpacing:"0.05em",color:c,userSelect:"none"}}>
      PRIME <span style={{color:"var(--blue)"}}>ALPHA</span>
      <span style={{fontSize:size*0.65,fontWeight:500,color:dark?"rgba(255,255,255,0.5)":"var(--dim)",letterSpacing:"0.1em",display:"block",marginTop:-2}}>SECURITIES</span>
    </span>
  );
}
function LogoInline({size=16,dark=false}){
  const c=dark?"#fff":"var(--head)";
  return(
    <span style={{fontFamily:"var(--ff-h)",fontSize:size,fontWeight:800,letterSpacing:"0.05em",color:c,whiteSpace:"nowrap"}}>
      PRIME <span style={{color:"var(--blue)"}}>ALPHA</span><span style={{fontSize:size*0.7,fontWeight:500,color:dark?"rgba(255,255,255,0.55)":"var(--dim)",letterSpacing:"0.1em"}}> SECURITIES</span>
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  PUBLIC NAV
// ─────────────────────────────────────────────────────────────────────────────
function PublicNav({page,setPage}){
  const [scrolled,ss]=useState(false);
  const [open,so]=useState(null);
  useEffect(()=>{
    const fn=()=>ss(window.scrollY>30);
    window.addEventListener("scroll",fn);return()=>window.removeEventListener("scroll",fn);
  },[]);
  const groups=[
    {label:"Who We Are",items:["Overview","Culture","Leadership","Civic Priorities"]},
    {label:"What We Do",items:["Overview","Private Equity","Private Credit","Real Estate","Fixed Income & FX"]},
    {label:"Careers",items:[]},
    {label:"Research",items:[]},
    {label:"Contact",items:[]},
  ];
  return(
    <nav style={{position:"fixed",top:0,left:0,right:0,zIndex:500,background:scrolled?"rgba(255,255,255,0.97)":"var(--w)",borderBottom:"var(--bdr)",backdropFilter:"blur(10px)",boxShadow:scrolled?"var(--sh)":"none",transition:"box-shadow 0.2s"}}>
      <div style={{maxWidth:1300,margin:"0 auto",padding:"0 40px",height:66,display:"flex",alignItems:"center"}}>
        <button onClick={()=>setPage("home")} style={{marginRight:52,flexShrink:0,lineHeight:1}}><LogoInline size={17}/></button>
        <div style={{display:"flex",flex:1,alignItems:"stretch",height:"100%"}} onMouseLeave={()=>so(null)}>
          {groups.map(g=>(
            <div key={g.label} style={{position:"relative",height:"100%",display:"flex",alignItems:"center"}} onMouseEnter={()=>so(g.label)}>
              <button onClick={()=>g.items.length===0&&setPage(g.label)} style={{padding:"0 15px",height:"100%",fontSize:13,fontWeight:500,color:open===g.label?"var(--blue)":"var(--body)",background:"none",borderBottom:open===g.label?"2px solid var(--blue)":"2px solid transparent",transition:"all 0.15s"}}>
                {g.label}
              </button>
              {g.items.length>0&&open===g.label&&(
                <div className="fu" style={{position:"absolute",top:"100%",left:0,background:"var(--w)",border:"var(--bdr)",borderRadius:"var(--rl)",minWidth:210,zIndex:200,boxShadow:"var(--sh-lg)",overflow:"hidden"}}>
                  {g.items.map(item=>(
                    <button key={item} onClick={()=>{setPage(item);so(null);}} style={{display:"block",width:"100%",textAlign:"left",padding:"11px 18px",fontSize:13,color:"var(--body)",background:"none",borderBottom:"1px solid var(--lg)",transition:"background 0.1s"}}
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
        <div style={{display:"flex",gap:10}}>
          <button style={T.btnO} onClick={()=>window.location.href=`https://investor.${DOMAIN}`}>Investor Portal</button>
          <button style={T.btnP} onClick={()=>window.location.href=`https://worker.${DOMAIN}`}>Team Access</button>
        </div>
      </div>
    </nav>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  PUBLIC FOOTER
// ─────────────────────────────────────────────────────────────────────────────
function PublicFooter({setPage}){
  return(
    <footer style={{background:"var(--head)",color:"rgba(255,255,255,0.65)"}}>
      <div style={{maxWidth:1300,margin:"0 auto",padding:"60px 40px 32px"}}>
        <div style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr 1fr",gap:48,marginBottom:48}}>
          <div>
            <div style={{marginBottom:16}}><Logo size={18} dark/></div>
            <p style={{fontSize:13,lineHeight:1.85,maxWidth:270}}>Flexible capital solutions across private equity, credit, real estate, and fixed income — delivered with precision and integrity.</p>
            <div style={{marginTop:20,fontSize:10,letterSpacing:"0.1em",textTransform:"uppercase",color:"rgba(255,255,255,0.3)"}}>Registered Investment Adviser · SEC · FCA · MAS</div>
          </div>
          {[["Company",["Overview","Culture","Leadership","Civic Priorities","Careers"]],
            ["Capital Solutions",["Private Equity","Private Credit","Real Estate","Fixed Income & FX"]],
            ["Legal",["Privacy","Terms","Notices","Disclosures"]]].map(([h,items])=>(
            <div key={h}>
              <div style={{fontSize:10,fontWeight:700,letterSpacing:"0.14em",textTransform:"uppercase",color:"var(--blue)",marginBottom:16}}>{h}</div>
              {items.map(i=>(
                <button key={i} onClick={()=>setPage(i)} style={{display:"block",color:"rgba(255,255,255,0.5)",fontSize:13,marginBottom:9,background:"none",transition:"color 0.15s"}}
                  onMouseEnter={e=>e.currentTarget.style.color="#fff"}
                  onMouseLeave={e=>e.currentTarget.style.color="rgba(255,255,255,0.5)"}>{i}</button>
              ))}
            </div>
          ))}
        </div>
        <div style={{borderTop:"1px solid rgba(255,255,255,0.08)",paddingTop:24,display:"flex",justifyContent:"space-between",fontSize:12}}>
          <span>© {new Date().getFullYear()} Prime Alpha Securities LLC. All rights reserved.</span>
          <span>{DOMAIN} · New York · London · Singapore</span>
        </div>
      </div>
    </footer>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  PUBLIC HOME
// ─────────────────────────────────────────────────────────────────────────────
function PublicHome({setPage}){
  return(
    <div>
      {/* Hero */}
      <section style={{minHeight:"100vh",display:"flex",alignItems:"center",background:"var(--w)",padding:"100px 40px 80px",position:"relative",overflow:"hidden"}}>
        <div style={{position:"absolute",inset:0,backgroundImage:"linear-gradient(var(--lg) 1px,transparent 1px),linear-gradient(90deg,var(--lg) 1px,transparent 1px)",backgroundSize:"72px 72px",opacity:0.55,pointerEvents:"none"}}/>
        <div style={{position:"absolute",right:0,top:0,bottom:0,width:"44%",background:"var(--blue)",clipPath:"polygon(7% 0%,100% 0%,100% 100%,0% 100%)"}}/>
        <div style={{maxWidth:1300,margin:"0 auto",width:"100%",display:"grid",gridTemplateColumns:"1fr 1fr",position:"relative",zIndex:1}}>
          <div className="fu">
            <div style={{fontSize:10,fontWeight:700,letterSpacing:"0.2em",textTransform:"uppercase",color:"var(--blue)",marginBottom:20}}>Flexible Capital Solutions</div>
            <h1 style={{fontFamily:"var(--ff-h)",fontSize:"clamp(50px,7vw,88px)",fontWeight:800,lineHeight:0.92,color:"var(--head)",marginBottom:28,letterSpacing:"-1px"}}>
              PRIME<br/>
              <span style={{color:"var(--blue)"}}>ALPHA</span><br/>
              SECURITIES
            </h1>
            <p style={{fontSize:16,color:"var(--dim)",maxWidth:440,lineHeight:1.85,marginBottom:36}}>
              We deploy flexible capital across private equity, private credit, real estate, and fixed income — structuring bespoke solutions where conventional finance falls short.
            </p>
            <div style={{display:"flex",gap:14}}>
              <button style={T.btnP} onClick={()=>setPage("What We Do")}>Our Solutions</button>
              <button style={T.btnO} onClick={()=>setPage("Contact")}>Get In Touch</button>
            </div>
            <div style={{display:"flex",gap:40,marginTop:48,paddingTop:40,borderTop:"var(--bdr)"}}>
              {[["$4.2B+","AUM"],["18%","Avg Net IRR"],["140+","Clients"],["23 yrs","Track Record"]].map(([v,l])=>(
                <div key={l}>
                  <div style={{fontFamily:"var(--ff-h)",fontSize:28,fontWeight:800,color:"var(--head)",letterSpacing:"-0.5px"}}>{v}</div>
                  <div style={{fontSize:11,letterSpacing:"0.1em",textTransform:"uppercase",color:"var(--dim)",marginTop:2}}>{l}</div>
                </div>
              ))}
            </div>
          </div>
          <div style={{display:"flex",flexDirection:"column",justifyContent:"center",padding:"0 0 0 72px"}}>
            {[["$4.2B+","Assets Under Management"],["23","Years of Operation"],["140+","Clients Served"],["18%","Avg. Net IRR (PE)"]].map(([v,l],i)=>(
              <div key={l} className={`fu fu-${i+1}`} style={{marginBottom:24,borderBottom:"1px solid rgba(255,255,255,0.12)",paddingBottom:22}}>
                <div style={{fontFamily:"var(--ff-h)",fontSize:44,fontWeight:800,color:"#fff",lineHeight:1,letterSpacing:"-1px"}}>{v}</div>
                <div style={{fontSize:11,letterSpacing:"0.1em",textTransform:"uppercase",color:"rgba(255,255,255,0.55)",marginTop:6}}>{l}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Solutions */}
      <section style={{padding:"88px 40px",background:"var(--ow)"}}>
        <div style={{maxWidth:1300,margin:"0 auto"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end",marginBottom:48}}>
            <div>
              <div style={{fontSize:10,fontWeight:700,letterSpacing:"0.16em",textTransform:"uppercase",color:"var(--blue)",marginBottom:10}}>Capital Solutions</div>
              <h2 style={{...T.hdg,fontSize:44,letterSpacing:"-0.5px"}}>WHAT WE DO</h2>
            </div>
            <button style={T.btnG} onClick={()=>setPage("What We Do")}>View all →</button>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:20}}>
            {[{name:"Private Equity",icon:"◆",desc:"Control and minority investments in market-leading businesses with durable competitive advantages.",p:"Private Equity"},
              {name:"Private Credit",icon:"◈",desc:"Direct lending, unitranche, and structured credit solutions from $2M to $100M+.",p:"Private Credit"},
              {name:"Real Estate",icon:"◇",desc:"Value-add and core-plus strategies in logistics, multifamily, and commercial assets.",p:"Real Estate"},
              {name:"Fixed Income & FX",icon:"◉",desc:"Discretionary macro and systematic overlays for institutional portfolios.",p:"Fixed Income & FX"},
            ].map((s,i)=>(
              <div key={s.name} className={`fu fu-${i+1}`} style={{...T.card,cursor:"pointer",borderTop:"3px solid transparent",transition:"all 0.2s"}}
                onMouseEnter={e=>{e.currentTarget.style.borderTopColor="var(--blue)";e.currentTarget.style.transform="translateY(-4px)";e.currentTarget.style.boxShadow="var(--sh-md)";}}
                onMouseLeave={e=>{e.currentTarget.style.borderTopColor="transparent";e.currentTarget.style.transform="translateY(0)";e.currentTarget.style.boxShadow="var(--sh)";}}
                onClick={()=>setPage(s.p)}>
                <div style={{fontSize:22,color:"var(--blue)",marginBottom:16}}>{s.icon}</div>
                <h3 style={{...T.hdg,fontSize:18,marginBottom:10}}>{s.name}</h3>
                <p style={{fontSize:13,color:"var(--dim)",lineHeight:1.75}}>{s.desc}</p>
                <div style={{marginTop:18,fontSize:13,color:"var(--blue)",fontWeight:700}}>Explore →</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Research teaser */}
      <section style={{padding:"88px 40px",background:"var(--w)"}}>
        <div style={{maxWidth:1300,margin:"0 auto"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end",marginBottom:40}}>
            <div>
              <div style={{fontSize:10,fontWeight:700,letterSpacing:"0.16em",textTransform:"uppercase",color:"var(--blue)",marginBottom:10}}>Latest Thinking</div>
              <h2 style={{...T.hdg,fontSize:40,letterSpacing:"-0.5px"}}>RESEARCH & INSIGHTS</h2>
            </div>
            <button style={T.btnG} onClick={()=>setPage("Research")}>All articles →</button>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20}}>
            {SEED["articles"].slice(0,2).map((a,i)=>(
              <div key={a.articleId} className={`fu fu-${i+1}`} style={{...T.card,display:"flex",flexDirection:"column",gap:12,cursor:"pointer",transition:"box-shadow 0.15s,border-color 0.15s"}}
                onMouseEnter={e=>{e.currentTarget.style.boxShadow="var(--sh-md)";e.currentTarget.style.borderColor="var(--blue)";}}
                onMouseLeave={e=>{e.currentTarget.style.boxShadow="var(--sh)";e.currentTarget.style.borderColor="#DDDFE5";}}>
                <div style={{display:"flex",justifyContent:"space-between"}}>
                  <span style={T.tag()}>{a.category}</span>
                  <span style={{fontSize:11,color:"var(--dim)",fontFamily:"var(--ff-m)"}}>{a.date}</span>
                </div>
                <h3 style={{...T.hdg,fontSize:18,lineHeight:1.3}}>{a.title}</h3>
                <p style={{fontSize:13,color:"var(--dim)",lineHeight:1.75,flex:1}}>{a.excerpt}</p>
                <div style={{fontSize:12,color:"var(--dim)"}}>{a.author}</div>
              </div>
            ))}
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
  const C={
    Overview:{h:"Who We Are",body:"Founded in 2001, Prime Alpha Securities is a global alternative asset manager specialising in flexible capital solutions. With offices in New York, London, and Singapore, we deploy over $4.2 billion across four core strategies — providing capital where conventional finance is too rigid, too slow, or too constrained.",stats:[["2001","Founded","New York, NY"],["$4.2B+","AUM","Across 4 strategies"],["140+","Clients","Individuals & family offices"],["23","Countries","Global reach"]]},
    Culture:{h:"Our Culture",body:"At Prime Alpha Securities, culture is built through the accumulation of high-conviction decisions made under pressure. We believe intellectual honesty, structural flexibility, and operational precision are not competing values — they are the same value, expressed differently.",pillars:[["Intellectual Rigor","We challenge every assumption and subject each thesis to rigorous stress-testing before capital is deployed."],["Flexibility as Philosophy","We were built to structure solutions where others can't. Adaptability is our core competency."],["Integrity Above Returns","We decline mandates that conflict with our values, even when the financial case is compelling."],["Collaborative Excellence","Exceptional people, working in systems that amplify rather than constrain."]]},
    Leadership:{h:"Leadership",people:[{n:"Eleanor Marsh",t:"Chief Executive Officer",b:"30 years in alternative asset management. Former MD at Goldman Sachs Private Equity. MBA Harvard, JD Columbia."},{n:"David Osei",t:"Chief Investment Officer",b:"Pioneer in systematic credit analysis. Built Prime Alpha's private credit platform from inception. MSc Mathematical Finance, Oxford."},{n:"Priya Anand",t:"Chief Risk Officer",b:"Quantitative risk architect with deep expertise in cross-asset portfolio construction. PhD Statistics, MIT."},{n:"Marcus Webb",t:"Head of Private Equity",b:"20+ years sourcing and executing control buyouts across healthcare, technology, and industrials. MBA Wharton."}]},
    "Civic Priorities":{h:"Civic Priorities & Aim",body:"Prime Alpha Securities believes that flexible capital carries civic responsibility. Our priorities reflect a conviction that markets function best when they serve broader society.",civics:[["Financial Literacy Initiative","Annual $2M commitment to financial education programs in underserved communities across our operating markets."],["Climate Transition Capital","25% of new PE deployments screened against net-zero frameworks; dedicated renewables allocation in real assets."],["Diverse Manager Program","Seeding and mentoring emerging managers led by women and underrepresented minorities via our $150M DMP fund-of-funds."],["Governance Excellence","Active stewardship across portfolio companies; voting records published annually; board diversity targets embedded in investment criteria."]]},
  };
  const c=C[sub]||C.Overview;
  return(
    <div style={{paddingTop:66}}>
      <div style={{background:"var(--head)",padding:"80px 40px"}}>
        <div style={{maxWidth:960,margin:"0 auto"}}>
          <div style={{fontSize:10,fontWeight:700,letterSpacing:"0.16em",textTransform:"uppercase",color:"var(--blue)",marginBottom:12}}>Who We Are</div>
          <h1 style={{fontFamily:"var(--ff-h)",fontSize:"clamp(38px,6vw,70px)",fontWeight:800,color:"#fff",letterSpacing:"-0.5px"}}>{c.h.toUpperCase()}</h1>
          {c.body&&<p style={{fontSize:16,color:"rgba(255,255,255,0.6)",maxWidth:620,lineHeight:1.85,marginTop:20}}>{c.body}</p>}
        </div>
      </div>
      <div style={{maxWidth:960,margin:"0 auto",padding:"64px 40px"}}>
        {c.stats&&<div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:20}}>
          {c.stats.map(([v,l,s])=>(
            <div key={l} style={{...T.card,borderTop:"3px solid var(--blue)"}}>
              <div style={{fontFamily:"var(--ff-h)",fontSize:38,fontWeight:800,color:"var(--blue)"}}>{v}</div>
              <div style={{fontWeight:700,color:"var(--head)",marginTop:4}}>{l}</div>
              <div style={{color:"var(--dim)",fontSize:13}}>{s}</div>
            </div>
          ))}
        </div>}
        {c.pillars&&c.pillars.map(([t,d])=>(
          <div key={t} style={{...T.card,marginBottom:14,borderLeft:"3px solid var(--blue)"}}>
            <h3 style={{...T.hdg,fontSize:18,marginBottom:8}}>{t}</h3>
            <p style={{color:"var(--dim)",lineHeight:1.85}}>{d}</p>
          </div>
        ))}
        {c.people&&<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20}}>
          {c.people.map(p=>(
            <div key={p.n} style={T.card}>
              <div style={{width:50,height:50,background:"var(--blue)",borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontFamily:"var(--ff-h)",fontSize:18,fontWeight:800,marginBottom:14}}>
                {p.n.split(" ").map(x=>x[0]).join("")}
              </div>
              <h3 style={{...T.hdg,fontSize:17}}>{p.n}</h3>
              <div style={{fontSize:10,fontWeight:700,letterSpacing:"0.09em",textTransform:"uppercase",color:"var(--blue)",marginBottom:10}}>{p.t}</div>
              <p style={{fontSize:13,color:"var(--dim)",lineHeight:1.75}}>{p.b}</p>
            </div>
          ))}
        </div>}
        {c.civics&&c.civics.map(([t,d])=>(
          <div key={t} style={{...T.card,marginBottom:14,display:"flex",gap:18,alignItems:"flex-start"}}>
            <div style={{width:38,height:38,background:"var(--blue)",borderRadius:"var(--r)",display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontSize:16,flexShrink:0}}>◆</div>
            <div>
              <h3 style={{...T.hdg,fontSize:17,marginBottom:6}}>{t}</h3>
              <p style={{color:"var(--dim)",lineHeight:1.85}}>{d}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  WHAT WE DO
// ─────────────────────────────────────────────────────────────────────────────
function WhatWeDo({sub,setPage}){
  if(sub==="Private Credit")return <PrivateCreditPublic/>;
  const PageHero=({title,body})=>(
    <div style={{paddingTop:66}}>
      <div style={{background:"var(--head)",padding:"80px 40px"}}>
        <div style={{maxWidth:960,margin:"0 auto"}}>
          <div style={{fontSize:10,fontWeight:700,letterSpacing:"0.16em",textTransform:"uppercase",color:"var(--blue)",marginBottom:12}}>Capital Solutions</div>
          <h1 style={{fontFamily:"var(--ff-h)",fontSize:"clamp(38px,6vw,70px)",fontWeight:800,color:"#fff",letterSpacing:"-0.5px"}}>{title.toUpperCase()}</h1>
          {body&&<p style={{fontSize:16,color:"rgba(255,255,255,0.6)",maxWidth:600,lineHeight:1.85,marginTop:20}}>{body}</p>}
        </div>
      </div>
    </div>
  );
  if(sub==="Overview")return(
    <div>
      <PageHero title="What We Do" body="Prime Alpha Securities operates four integrated capital platforms, each with dedicated teams, proprietary deal flow, and flexible mandate structures built to serve clients that conventional managers cannot."/>
      <div style={{maxWidth:960,margin:"0 auto",padding:"64px 40px"}}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:18}}>
          {["Private Equity","Private Credit","Real Estate","Fixed Income & FX"].map(s=>(
            <button key={s} onClick={()=>setPage(s)} style={{...T.card,textAlign:"left",cursor:"pointer",borderLeft:"3px solid var(--blue)",transition:"box-shadow 0.15s"}}
              onMouseEnter={e=>e.currentTarget.style.boxShadow="var(--sh-md)"}
              onMouseLeave={e=>e.currentTarget.style.boxShadow="var(--sh)"}>
              <h3 style={{...T.hdg,fontSize:20,marginBottom:6}}>{s}</h3>
              <div style={{color:"var(--blue)",fontSize:13,fontWeight:700}}>Explore →</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
  const strats={
    "Private Equity":{body:"We pursue control and significant minority investments in market-leading businesses with durable competitive advantages, partnering with management teams to build category-defining companies.",items:["Control buyouts in healthcare, technology, and industrial sectors","Revenue target: $15M–$200M","Primary markets: North America and Northern Europe","Typical hold: 5–7 years","Value creation via operational improvement, M&A, and geographic expansion"]},
    "Real Estate":{body:"Our real estate platform deploys capital across logistics, multifamily, and commercial assets in high-conviction markets, combining local market expertise with institutional asset management.",items:["Value-add and core-plus strategies","Focus markets: Gateway cities and high-growth secondary markets","Asset types: Logistics, multifamily, life science, and select retail","ESG integration in development and renovation mandates"]},
    "Fixed Income & FX":{body:"Our macro and systematic fixed income capabilities deliver differentiated exposure to global interest rate and currency markets through both long-only and absolute-return mandates.",items:["Discretionary global macro fixed income","Systematic FX and rates overlays","Credit-oriented fixed income with PE credit integration","Custom liability-driven solutions"]},
  };
  const s=strats[sub];
  return(
    <div>
      <PageHero title={sub} body={s?.body}/>
      <div style={{maxWidth:960,margin:"0 auto",padding:"64px 40px"}}>
        {s?.items.map(item=>(
          <div key={item} style={{display:"flex",gap:16,padding:"14px 0",borderBottom:"1px solid var(--lg)"}}>
            <div style={{width:8,height:8,background:"var(--blue)",borderRadius:"50%",flexShrink:0,marginTop:8}}/>
            <span style={{color:"var(--body)",fontSize:15}}>{item}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  PRIVATE CREDIT PUBLIC (with DynamoDB-backed loan form)
// ─────────────────────────────────────────────────────────────────────────────
function PrivateCreditPublic(){
  const [form,sf]=useState({type:"business",loanType:"secured",name:"",email:"",phone:"",amount:"",purpose:"",availability:""});
  const [sub,ss]=useState(false);
  const [saving,sv]=useState(false);
  const set=k=>e=>sf(p=>({...p,[k]:e.target.value}));
  const submit=async()=>{
    if(!form.name||!form.email||!form.amount){alert("Please complete required fields.");return;}
    sv(true);
    const appId=`app_${uid()}`;
    const record={appId,...form,submittedAt:now(),status:"pending"};
    await api.put("credit_application",record);
    await notify.credit(record);
    sv(false);ss(true);
  };
  return(
    <div style={{paddingTop:66}}>
      <div style={{background:"var(--head)",padding:"80px 40px"}}>
        <div style={{maxWidth:960,margin:"0 auto"}}>
          <div style={{fontSize:10,fontWeight:700,letterSpacing:"0.16em",textTransform:"uppercase",color:"var(--blue)",marginBottom:12}}>Direct Lending</div>
          <h1 style={{fontFamily:"var(--ff-h)",fontSize:"clamp(38px,6vw,70px)",fontWeight:800,color:"#fff"}}>PRIVATE CREDIT</h1>
          <p style={{fontSize:16,color:"rgba(255,255,255,0.6)",maxWidth:580,lineHeight:1.85,marginTop:20}}>Bespoke credit solutions for businesses and individuals where speed, certainty, and structural flexibility are paramount.</p>
        </div>
      </div>
      <div style={{maxWidth:960,margin:"0 auto",padding:"64px 40px"}}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:18,marginBottom:56}}>
          {[["Direct Lending","Senior secured loans to businesses with EBITDA of $3M–$50M."],["Unitranche","One-stop financing combining senior and subordinated debt in a single tranche."],["Secured Personal Credit","Asset-backed facilities against liquid and illiquid collateral."],["Unsecured Business Credit","Cash-flow-based lending for businesses with strong revenue visibility."]].map(([t,d])=>(
            <div key={t} style={{...T.card,borderLeft:"3px solid var(--blue)"}}>
              <h3 style={{...T.hdg,fontSize:17,marginBottom:8}}>{t}</h3>
              <p style={{fontSize:13,color:"var(--dim)",lineHeight:1.75}}>{d}</p>
            </div>
          ))}
        </div>
        <div style={T.card}>
          <h2 style={{...T.hdg,fontSize:26,marginBottom:6}}>Loan Enquiry</h2>
          <p style={{color:"var(--dim)",fontSize:13,marginBottom:28}}>Submit your enquiry and our credit team will contact you within 2 business days to schedule a call. Submitted directly to pas-credit-apps.</p>
          {sub?(
            <div style={{textAlign:"center",padding:"48px 0"}}>
              <div style={{width:60,height:60,background:"var(--blue)",borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 16px",fontSize:26,color:"#fff"}}>✓</div>
              <h3 style={{...T.hdg,fontSize:26,marginBottom:8}}>Enquiry Submitted</h3>
              <p style={{color:"var(--dim)"}}>We'll reach out to <strong>{form.email}</strong> within 2 business days.</p>
            </div>
          ):(
            <div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:0}}>
                <Sel label="Applicant Type" value={form.type} onChange={set("type")} options={[{value:"business",label:"Business / Corporate"},{value:"individual",label:"Individual / HNW"}]}/>
                <div style={{paddingLeft:16}}><Sel label="Loan Type" value={form.loanType} onChange={set("loanType")} options={[{value:"secured",label:"Secured"},{value:"unsecured",label:"Unsecured"}]}/></div>
                <Inp label="Full Name / Company *" value={form.name} onChange={set("name")}/>
                <div style={{paddingLeft:16}}><Inp label="Email *" type="email" value={form.email} onChange={set("email")}/></div>
                <Inp label="Phone" value={form.phone} onChange={set("phone")}/>
                <div style={{paddingLeft:16}}><Inp label="Amount Requested (USD) *" value={form.amount} onChange={set("amount")}/></div>
              </div>
              <TA label="Purpose / Business Description" value={form.purpose} onChange={set("purpose")}/>
              <Inp label="Availability for Call" value={form.availability} onChange={set("availability")} placeholder="e.g. Weekdays 9am–12pm EST"/>
              <button style={T.btnP} onClick={submit} disabled={saving}>{saving?"Submitting…":"Submit Enquiry"}</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  CAREERS
// ─────────────────────────────────────────────────────────────────────────────
function Careers(){
  const roles=[{t:"Associate, Private Equity",d:"Investments",l:"New York"},{t:"Credit Analyst, Direct Lending",d:"Private Credit",l:"London"},{t:"Quantitative Researcher",d:"Risk",l:"New York / Remote"},{t:"Real Estate Associate",d:"Real Assets",l:"Singapore"},{t:"Fund Accounting Manager",d:"Finance",l:"New York"}];
  return(
    <div style={{paddingTop:66}}>
      <div style={{background:"var(--head)",padding:"80px 40px"}}>
        <div style={{maxWidth:960,margin:"0 auto"}}>
          <div style={{fontSize:10,fontWeight:700,letterSpacing:"0.16em",textTransform:"uppercase",color:"var(--blue)",marginBottom:12}}>Join Us</div>
          <h1 style={{fontFamily:"var(--ff-h)",fontSize:"clamp(38px,6vw,70px)",fontWeight:800,color:"#fff"}}>CAREERS</h1>
          <p style={{fontSize:16,color:"rgba(255,255,255,0.6)",maxWidth:520,lineHeight:1.85,marginTop:20}}>We hire exceptional thinkers who combine intellectual rigour with the flexibility to structure solutions others cannot.</p>
        </div>
      </div>
      <div style={{maxWidth:960,margin:"0 auto",padding:"64px 40px"}}>
        {roles.map(r=>(
          <div key={r.t} style={{...T.card,marginBottom:12,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div>
              <h3 style={{...T.hdg,fontSize:17,marginBottom:6}}>{r.t}</h3>
              <div style={{display:"flex",gap:10}}><span style={T.tag()}>{r.d}</span><span style={{fontSize:13,color:"var(--dim)"}}>{r.l}</span></div>
            </div>
            <button style={T.btnO} onClick={()=>alert("Send CV to careers@primealphasecurities.com")}>Apply</button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  RESEARCH
// ─────────────────────────────────────────────────────────────────────────────
function Research(){
  const [articles,sa]=useState([]);
  const [loading,sl]=useState(true);
  const [active,sact]=useState(null);
  useEffect(()=>{api.getAll("articles").then(r=>{sa([...r].sort((a,b)=>b.date.localeCompare(a.date)));sl(false);});},[]);
  return(
    <div style={{paddingTop:66}}>
      <div style={{background:"var(--head)",padding:"80px 40px"}}>
        <div style={{maxWidth:1100,margin:"0 auto"}}>
          <div style={{fontSize:10,fontWeight:700,letterSpacing:"0.16em",textTransform:"uppercase",color:"var(--blue)",marginBottom:12}}>Perspectives</div>
          <h1 style={{fontFamily:"var(--ff-h)",fontSize:"clamp(38px,6vw,70px)",fontWeight:800,color:"#fff"}}>RESEARCH & INSIGHTS</h1>
        </div>
      </div>
      <div style={{maxWidth:1100,margin:"0 auto",padding:"64px 40px"}}>
        {loading?<Spinner/>:(
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20}}>
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
  const [form,sf]=useState({name:"",email:"",org:"",subject:"",message:""});
  const [sent,ss]=useState(false);
  const [saving,sv]=useState(false);
  const set=k=>e=>sf(p=>({...p,[k]:e.target.value}));
  const submit=async()=>{
    if(!form.name||!form.email||!form.message){alert("Fill required fields.");return;}
    sv(true);
    await api.put("enquiries",{enquiryId:`enq_${uid()}`,type:"contact",...form,submittedAt:now()});
    await notify.enquiry(form);
    sv(false);ss(true);
  };
  return(
    <div style={{paddingTop:66}}>
      <div style={{background:"var(--head)",padding:"80px 40px"}}>
        <div style={{maxWidth:1100,margin:"0 auto"}}>
          <div style={{fontSize:10,fontWeight:700,letterSpacing:"0.16em",textTransform:"uppercase",color:"var(--blue)",marginBottom:12}}>Get In Touch</div>
          <h1 style={{fontFamily:"var(--ff-h)",fontSize:"clamp(38px,6vw,70px)",fontWeight:800,color:"#fff"}}>CONTACT</h1>
        </div>
      </div>
      <div style={{maxWidth:1100,margin:"0 auto",padding:"64px 40px",display:"grid",gridTemplateColumns:"1fr 1.6fr",gap:60}}>
        <div>
          {[["New York HQ","745 Fifth Avenue, 32nd Floor\nNew York, NY 10151"],["London","1 Grosvenor Square\nLondon W1K 6AB, UK"],["Singapore","Marina Bay Financial Centre\nTower 3 #23-01"],["General","info@primealphasecurities.com"],["Investor Relations","ir@primealphasecurities.com"]].map(([k,v])=>(
            <div key={k} style={{marginBottom:24}}>
              <div style={{fontSize:10,fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase",color:"var(--blue)",marginBottom:6}}>{k}</div>
              <div style={{color:"var(--body)",fontSize:14,lineHeight:1.75,whiteSpace:"pre-line"}}>{v}</div>
            </div>
          ))}
        </div>
        <div style={T.card}>
          {sent?(
            <div style={{textAlign:"center",padding:"48px 0"}}>
              <div style={{width:60,height:60,background:"var(--blue)",borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 16px",fontSize:26,color:"#fff"}}>✓</div>
              <h3 style={{...T.hdg,fontSize:26,marginBottom:8}}>Message Sent</h3>
              <p style={{color:"var(--dim)"}}>We'll respond within 2 business days.</p>
            </div>
          ):(
            <>
              <h2 style={{...T.hdg,fontSize:24,marginBottom:24}}>Send an Enquiry</h2>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:0}}>
                <Inp label="Full Name *" value={form.name} onChange={set("name")}/>
                <div style={{paddingLeft:16}}><Inp label="Email *" type="email" value={form.email} onChange={set("email")}/></div>
              </div>
              <Inp label="Organisation" value={form.org} onChange={set("org")}/>
              <Sel label="Subject" value={form.subject} onChange={set("subject")} options={[{value:"",label:"Select…"},{value:"IR",label:"Investor Relations"},{value:"media",label:"Media"},{value:"credit",label:"Credit Enquiry"},{value:"careers",label:"Careers"},{value:"other",label:"Other"}]}/>
              <TA label="Message *" value={form.message} onChange={set("message")}/>
              <button style={T.btnP} onClick={submit} disabled={saving}>{saving?"Sending…":"Send Message"}</button>
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
  const T2={
    Privacy:"Prime Alpha Securities LLC and its affiliates ('Prime Alpha', 'we', 'our') collect information you provide directly and information collected automatically. We do not sell personal data. Data is retained only as long as necessary to fulfill the purposes for which it was collected or as required by applicable law. Contact privacy@primealphasecurities.com to access, correct, or delete your data.",
    Terms:"These Terms of Use govern your access to primealphasecurities.com and associated portals. The information herein is for informational purposes only and does not constitute an offer or solicitation to buy or sell any security. Investment involves risk, including possible loss of principal.",
    Notices:"Prime Alpha Securities LLC is registered as an investment adviser with the U.S. Securities and Exchange Commission. Registration does not imply a certain level of skill or training. Securities may not be offered in jurisdictions where such offering would be unlawful.",
    Disclosures:"IMPORTANT: Alternative investments involve high risk, are speculative and illiquid, and are not suitable for all investors. These investments are offered only to qualified investors. Performance data shown may not be representative of all client outcomes. Net returns are after management fees and carried interest.",
  };
  return(
    <div style={{paddingTop:66}}>
      <div style={{background:"var(--head)",padding:"64px 40px"}}>
        <div style={{maxWidth:800,margin:"0 auto"}}><h1 style={{fontFamily:"var(--ff-h)",fontSize:48,fontWeight:800,color:"#fff"}}>{type.toUpperCase()}</h1></div>
      </div>
      <div style={{maxWidth:800,margin:"0 auto",padding:"64px 40px"}}>
        <div style={T.card}><p style={{color:"var(--body)",lineHeight:1.9}}>{T2[type]}</p></div>
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
              ? "investor.primealphasecurities.com"
              : "worker.primealphasecurities.com"}
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
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:0}}>
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
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:0}}>
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
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:0}}>
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
      api.put("enquiries",{enquiryId:`em_${uid()}`,to:finalTo,subject,body,sentAt:now(),sentBy}),
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

// ─────────────────────────────────────────────────────────────────────────────
//  APP ROOT — URL-aware router
// ─────────────────────────────────────────────────────────────────────────────
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
          {[["📧 Calendar Email","Worker receives an email when assigned to a calendar event."],["📧 Compose (Email tab)","Real email sent via SES, not just a DynamoDB log."],["📧 Contact Form","Enquiries trigger an email alert to your ops inbox."],["📧 Credit Form","New credit applications trigger an alert to your ops inbox."]].map(([t,d])=>(
            <div key={t} style={{background:"var(--ow)",borderRadius:6,padding:"12px 14px"}}>
              <div style={{fontWeight:700,fontSize:13,marginBottom:4}}>{t}</div>
              <div style={{fontSize:12,color:"var(--dim)",lineHeight:1.6}}>{d}</div>
            </div>
          ))}
        </div>
      </div>

      <Modal open={showAdd} onClose={()=>{sa(false);sei(null);sf(blank);}} title={editId?"Edit Worker":"Add New Worker"} width={520}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:0}}>
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


export default function App(){
  const [page,sp]=useState("home");
  const [investorUser,siu]=useState(null);
  const [workerUser,swu]=useState(null);

  // Inject global styles once
  useEffect(()=>{
    let el=document.getElementById("pas-theme");
    if(!el){el=document.createElement("style");el.id="pas-theme";document.head.appendChild(el);}
    el.textContent=THEME;
    return()=>el.remove();
  },[]);

  // Set document title
  useEffect(()=>{
    document.title=IS_INVESTOR?"Investor Portal — Prime Alpha Securities":IS_WORKER?"Team Console — Prime Alpha Securities":"Prime Alpha Securities";
  },[]);

  // ── Subdomain routing ─────────────────────────────────────────────
  // investor.primealphasecurities.com
  if(IS_INVESTOR){
    if(investorUser)return<InvestorPortal user={investorUser} setUser={siu} onLogout={()=>{siu(null);}}/>;
    return<LoginPage type="investor" onSuccess={u=>{siu(u);}}/>;
  }
  // worker.primealphasecurities.com
  if(IS_WORKER){
    if(workerUser)return<WorkerPortal user={workerUser} onLogout={()=>{swu(null);}}/>;
    return<LoginPage type="worker" onSuccess={u=>{swu(u);}}/>;
  }

  // ── Main site routing ─────────────────────────────────────────────
  const setPage=p=>sp(p);
  const renderPage=()=>{
    switch(page){
      case"home":             return<PublicHome setPage={setPage}/>;
      case"Overview":         return<WhoWeAre sub="Overview"/>;
      case"Culture":          return<WhoWeAre sub="Culture"/>;
      case"Leadership":       return<WhoWeAre sub="Leadership"/>;
      case"Civic Priorities": return<WhoWeAre sub="Civic Priorities"/>;
      case"Who We Are":       return<WhoWeAre sub="Overview"/>;
      case"What We Do":       return<WhatWeDo sub="Overview" setPage={setPage}/>;
      case"Private Equity":   return<WhatWeDo sub="Private Equity" setPage={setPage}/>;
      case"Private Credit":   return<WhatWeDo sub="Private Credit" setPage={setPage}/>;
      case"Real Estate":      return<WhatWeDo sub="Real Estate" setPage={setPage}/>;
      case"Fixed Income & FX":return<WhatWeDo sub="Fixed Income & FX" setPage={setPage}/>;
      case"Careers":          return<Careers/>;
      case"Research":         return<Research/>;
      case"Contact":          return<Contact/>;
      case"Privacy":
      case"Terms":
      case"Notices":
      case"Disclosures":      return<Legal type={page}/>;
      default:                return<PublicHome setPage={setPage}/>;
    }
  };

  return(
    <div style={{minHeight:"100vh",background:"var(--w)"}}>
      <PublicNav page={page} setPage={setPage}/>
      {renderPage()}
      <PublicFooter setPage={setPage}/>
    </div>
  );
}
