#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
//  Prime Alpha Securities — Backend Server
//
//  Port:   80  (ALB terminates TLS — EC2 only speaks plain HTTP)
//  Routes: /api/notify/*  → email notifications via Resend
//          /api/*         → DynamoDB CRUD (IAM role, server-side)
//          /*             → Vite dist/ (React SPA)
//
//  EMAIL SETUP (Resend — free tier, 3 000 emails/month):
//    RESEND_API_KEY  — from resend.com → API Keys
//    SUPPORT_EMAIL   — receives contact form submissions
//    IR_EMAIL        — receives credit applications
//    AWS_REGION      — DynamoDB region (default: eu-west-2)
// ═══════════════════════════════════════════════════════════════════════════
'use strict';

const http  = require('http');
const fs    = require('fs');
const path  = require('path');

const {
  DynamoDBClient, ScanCommand, GetItemCommand,
  PutItemCommand, UpdateItemCommand, DeleteItemCommand,
} = require('@aws-sdk/client-dynamodb');
const { marshall, unmarshall } = require('@aws-sdk/util-dynamodb');

// ── Config ────────────────────────────────────────────────────────────────────
const PORT_HTTP     = Number(process.env.PORT_HTTP) || 80;
const REGION        = process.env.AWS_REGION        || 'eu-west-2';
const RESEND_KEY    = process.env.RESEND_API_KEY    || 're_Lqr36fGo_8Ev76CnuytPPVaXdXWRY6Z6W';
const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL     || 'support@primealphasecurities.com';
const IR_EMAIL      = process.env.IR_EMAIL          || 'ir@primealphasecurities.com';
const FROM_EMAIL    = 'aurel.botouli@primealphasecurities.com';
const DIST          = path.join(__dirname, 'dist');

// ── AWS clients — all use EC2 IAM role automatically ─────────────────────────
const ddb = new DynamoDBClient({ region: REGION });

// ── Primary key map ───────────────────────────────────────────────────────────
const PK = {
  investor:           'investorId',
  portfolios:         'portfolioId',
  documents:          'docId',
  workers:            'workerId',
  calendar:           'eventId',
  pe_companies:       'dealId',
  credit_application: 'appId',
  real_estate:        'assetId',
  articles:           'articleId',
  enquiries:          'enquiryId',
};
const TABLES = new Set(Object.keys(PK));

const MIME = {
  '.html':'text/html; charset=utf-8', '.js':'application/javascript; charset=utf-8',
  '.mjs':'application/javascript; charset=utf-8', '.css':'text/css; charset=utf-8',
  '.json':'application/json', '.svg':'image/svg+xml', '.png':'image/png',
  '.jpg':'image/jpeg', '.ico':'image/x-icon', '.woff2':'font/woff2',
  '.woff':'font/woff', '.ttf':'font/ttf', '.map':'application/json',
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString() || '{}')); }
      catch { resolve({}); }
    });
    req.on('error', reject);
  });
}

function jsonRes(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body),
    'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
  });
  res.end(body);
}

// ── Resend: send email (resend.com — free tier 3K/month, no packages needed) ──
async function sendEmail({ to, subject, html, text }) {
  const toList = (Array.isArray(to) ? to : [to]).filter(Boolean);
  if (!toList.length) return;

  if (!RESEND_KEY) {
    console.warn(`[EMAIL] RESEND_API_KEY not set — skipping "${subject}"`);
    return;
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method:  'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_KEY}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({
        from:    `Prime Alpha Securities <${FROM_EMAIL}>`,
        to:      toList,
        subject: subject,
        html:    html,
        text:    text,
      }),
    });

    const result = await res.json();
    if (!res.ok) {
      console.error(`[EMAIL] Resend error ${res.status}:`, result.message || JSON.stringify(result));
      return;
    }
    console.log(`[EMAIL] Sent "${subject}" → ${toList.join(', ')} (id: ${result.id})`);
  } catch (e) {
    console.error('[EMAIL] Fetch failed:', e.message);
  }
}


// ── Email templates ───────────────────────────────────────────────────────────
function wrapHtml(title, bodyHtml, { accentColor = '#0057FF' } = {}) {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F7F8FA;font-family:'Helvetica Neue',Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#F7F8FA;padding:40px 0">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:4px;overflow:hidden;border:1px solid #E2E8F0;max-width:600px">
  <!-- Header -->
  <tr>
    <td style="background:#0B0F1A;padding:28px 36px">
      <table cellpadding="0" cellspacing="0">
        <tr>
          <td style="border-left:3px solid ${accentColor};padding-left:14px">
            <div style="font-family:Georgia,serif;font-size:20px;font-weight:900;color:#fff;letter-spacing:-0.5px">PRIME ALPHA</div>
            <div style="font-size:9px;font-weight:700;letter-spacing:0.18em;color:${accentColor};text-transform:uppercase;margin-top:2px">SECURITIES LLC</div>
          </td>
        </tr>
      </table>
    </td>
  </tr>
  <!-- Body -->
  <tr><td style="padding:36px">${bodyHtml}</td></tr>
  <!-- Footer -->
  <tr>
    <td style="background:#F7F8FA;padding:20px 36px;border-top:1px solid #E2E8F0">
      <p style="margin:0;font-size:11px;color:#94A3B8;line-height:1.6">
        Prime Alpha Securities LLC · 745 Fifth Avenue, 32nd Floor · New York, NY 10151<br>
        Registered Investment Adviser · SEC · FCA · MAS<br>
        <span style="color:#CBD5E1">This is an automated notification from Prime Alpha Securities. Please do not reply to this email.</span>
      </p>
    </td>
  </tr>
</table>
</td></tr></table>
</body></html>`;
}

function row(label, value) {
  if (!value) return '';
  return `<tr>
    <td style="padding:9px 0;font-size:12px;color:#64748B;width:150px;vertical-align:top;text-transform:uppercase;letter-spacing:0.06em;font-weight:600">${label}</td>
    <td style="padding:9px 0;font-size:13px;color:#0B0F1A;font-weight:600;border-bottom:1px solid #F1F5F9">${value}</td>
  </tr>`;
}

function pill(text, color = '#0057FF') {
  return `<span style="display:inline-block;background:${color}18;color:${color};border:1px solid ${color}33;border-radius:2px;padding:2px 10px;font-size:10px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase">${text}</span>`;
}

function ctaButton(text, href, bg = '#0057FF') {
  return `<a href="${href}" style="display:inline-block;margin-top:24px;background:${bg};color:#fff;padding:13px 28px;border-radius:3px;text-decoration:none;font-weight:700;font-size:13px;letter-spacing:0.05em;text-transform:uppercase">${text}</a>`;
}

// ── Notification handlers ─────────────────────────────────────────────────────

// POST /api/notify/inquiry  — general contact form
async function notifyEnquiry(data) {
  const html = wrapHtml('New Contact Enquiry', `
    <p style="margin:0 0 6px;font-size:22px;font-weight:800;color:#0B0F1A;font-family:Georgia,serif">New Contact Enquiry</p>
    <p style="margin:0 0 28px;color:#64748B;font-size:13px">Submitted via primealphasecurities.com/contact · ${new Date().toUTCString()}</p>
    <table style="width:100%;border-collapse:collapse;margin-bottom:20px">
      ${row('Name', data.name)}
      ${row('Email', data.email)}
      ${row('Organisation', data.org || '—')}
      ${row('Subject', data.subject || '—')}
    </table>
    <div style="margin-top:20px;padding:20px;background:#F7F8FA;border-radius:3px;border-left:3px solid #0057FF">
      <div style="font-size:10px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#0057FF;margin-bottom:10px">Message</div>
      <p style="margin:0;font-size:14px;color:#0B0F1A;line-height:1.75">${(data.message||'').replace(/\n/g,'<br>')}</p>
    </div>
    ${ctaButton(`Reply to ${data.name}`, `mailto:${data.email}?subject=Re: ${encodeURIComponent(data.subject||'Your inquiry — Prime Alpha Securities')}`)}
  `);
  const text = `NEW CONTACT ENQUIRY — Prime Alpha Securities\n\nName: ${data.name}\nEmail: ${data.email}\nOrg: ${data.org||'—'}\nSubject: ${data.subject||'—'}\n\n${data.message}`;
  await sendEmail({ to: SUPPORT_EMAIL, subject: `[PAS] Inquiry from ${data.name}${data.org?' ('+data.org+')':''}`, html, text });
}

// POST /api/notify/credit  — private credit application
async function notifyCredit(data) {
  const fmtAmount = data.amount ? `$${Number(data.amount).toLocaleString('en-US')}` : '—';
  const html = wrapHtml('New Credit Application', `
    <p style="margin:0 0 6px;font-size:22px;font-weight:800;color:#0B0F1A;font-family:Georgia,serif">New Credit Application</p>
    <p style="margin:0 0 6px;color:#64748B;font-size:13px">Submitted via primealphasecurities.com/private-credit · ${new Date().toUTCString()}</p>
    <p style="margin:0 0 28px">${pill('App ID: ' + (data.appId||'—'))} ${pill(data.type==='business'?'Business / Corporate':'Individual / HNW','#0B0F1A')} ${pill(data.loanType==='secured'?'Secured':'Unsecured', data.loanType==='secured'?'#00875A':'#B45309')}</p>
    <table style="width:100%;border-collapse:collapse;margin-bottom:20px">
      ${row('Applicant', data.name)}
      ${row('Email', data.email)}
      ${row('Phone', data.phone || '—')}
      ${row('Amount Requested', fmtAmount)}
      ${row('Availability', data.availability || '—')}
    </table>
    ${data.purpose ? `<div style="padding:20px;background:#F7F8FA;border-radius:3px;border-left:3px solid #0057FF;margin-bottom:20px">
      <div style="font-size:10px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#0057FF;margin-bottom:10px">Purpose / Business Description</div>
      <p style="margin:0;font-size:14px;color:#0B0F1A;line-height:1.75">${data.purpose.replace(/\n/g,'<br>')}</p>
    </div>` : ''}
    ${ctaButton('Contact Applicant', `mailto:${data.email}?subject=Re: Your credit application — Prime Alpha Securities`)}
  `);
  const text = `NEW CREDIT APPLICATION — Prime Alpha Securities\n\nApp ID: ${data.appId||'—'}\nApplicant: ${data.name} (${data.email})\nPhone: ${data.phone||'—'}\nType: ${data.type} / ${data.loanType}\nAmount: ${fmtAmount}\nAvailability: ${data.availability||'—'}\n\nPurpose:\n${data.purpose||'—'}`;
  await sendEmail({ to: IR_EMAIL, subject: `[PAS Credit] ${fmtAmount} application — ${data.name}`, html, text });
}

// POST /api/notify/calendar  — new event, email each assigned worker
async function notifyCalendar(data) {
  const { event, workers = [] } = data;
  if (!workers.length) return;
  const dateStr = event.date
    ? new Date(event.date + 'T12:00:00').toLocaleDateString('en-US', { weekday:'long', year:'numeric', month:'long', day:'numeric' })
    : event.date;

  await Promise.all(workers.map(async (w) => {
    if (!w.email) return;
    const html = wrapHtml('Calendar Assignment', `
      <p style="margin:0 0 6px;font-size:22px;font-weight:800;color:#0B0F1A;font-family:Georgia,serif">You've been assigned to an event</p>
      <p style="margin:0 0 28px;color:#64748B;font-size:13px">Hi ${w.name}, the following event has been added to your schedule.</p>
      <div style="background:#0B0F1A;border-radius:3px;padding:28px;margin-bottom:24px">
        <div style="font-size:10px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:#0057FF;margin-bottom:10px">Calendar Event</div>
        <div style="font-family:Georgia,serif;font-size:22px;font-weight:900;color:#fff;margin-bottom:20px;line-height:1.2">${event.title}</div>
        <table cellpadding="0" cellspacing="0">
          <tr>
            <td style="padding-right:40px">
              <div style="font-size:10px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:rgba(255,255,255,0.4);margin-bottom:4px">Date</div>
              <div style="font-size:15px;font-weight:700;color:#fff">${dateStr}</div>
            </td>
            <td>
              <div style="font-size:10px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:rgba(255,255,255,0.4);margin-bottom:4px">Assigned By</div>
              <div style="font-size:15px;font-weight:700;color:#fff">Prime Alpha Team Console</div>
            </td>
          </tr>
        </table>
      </div>
      <p style="font-size:13px;color:#64748B;margin:0;line-height:1.7">Please ensure this is in your diary. If you have a conflict, contact your team lead as soon as possible.</p>
    `);
    const text = `Hi ${w.name},\n\nYou have been assigned to: ${event.title}\nDate: ${dateStr}\n\nPrime Alpha Securities · Team Console`;
    await sendEmail({ to: w.email, subject: `[PAS] Calendar: ${event.title} — ${dateStr}`, html, text });
  }));
}

// POST /api/notify/worker-email  — worker compose tab sends real email
async function notifyWorkerEmail(data) {
  if (!data.to || !data.subject || !data.body) return;
  const html = wrapHtml(data.subject, `
    <p style="font-size:15px;color:#0B0F1A;line-height:1.85;white-space:pre-line">${data.body.replace(/\n/g,'<br>')}</p>
    <hr style="border:none;border-top:1px solid #E2E8F0;margin:32px 0">
    <p style="font-size:12px;color:#94A3B8;margin:0">
      Sent via Prime Alpha Securities Team Console${data.sentBy ? ` by <strong style="color:#64748B">${data.sentBy}</strong>` : ''}
    </p>
  `);
  await sendEmail({ to: data.to, subject: data.subject, html, text: data.body });
}

// POST /api/notify/apply — career application with optional file attachments
async function notifyApply(data) {
  const attachments = [];
  if (data.cvFile)    attachments.push({ filename: data.cvFileName || 'cv.pdf',           content: data.cvFile });
  if (data.clFile)    attachments.push({ filename: data.clFileName || 'cover-letter.pdf', content: data.clFile });
  const html = wrapHtml('New Career Application', `
    <h2 style="font-family:sans-serif;font-size:20px;color:#0B0F1A;margin:0 0 20px">New Application: ${data.role}</h2>
    <table style="width:100%;border-collapse:collapse">
      ${row('Name',  data.name)}
      ${row('Email', data.email)}
      ${row('Phone', data.phone || '—')}
      ${row('Role',  data.role)}
    </table>
    <div style="padding:20px;background:#F7F8FA;border-radius:6px;margin-top:20px">
      <p style="font-size:13px;font-weight:700;color:#0B0F1A;margin:0 0 10px">Cover Letter / Message:</p>
      <p style="font-size:14px;color:#475569;line-height:1.75;margin:0">${(data.message || '—').replace(/\n/g, '<br>')}</p>
    </div>
    <p style="color:#64748B;font-size:12px;margin-top:16px">${attachments.length} file(s) attached.</p>
    ${ctaButton('Reply to Applicant', 'mailto:' + data.email)}
  `);
  await sendEmail({
    to: 'careers@primealphasecurities.com',
    subject: `[PAS Careers] ${data.role} — ${data.name}`,
    html,
    text: `Application for ${data.role}\nFrom: ${data.name} (${data.email})\nPhone: ${data.phone || '—'}\n\n${data.message || ''}`,
  });
}

// ── Notification router (/api/notify/<type>) ─────────────────────────────────
async function handleNotify(req, res) {
  if (req.method !== 'POST') return jsonRes(res, 405, { error: 'POST only' });
  const type = req.url.replace(/^\/api\/notify\/?/, '').split('/')[0];
  const data  = await readBody(req);
  try {
    if      (type === 'inquiry')      await notifyEnquiry(data);
    else if (type === 'credit')       await notifyCredit(data);
    else if (type === 'calendar')     await notifyCalendar(data);
    else if (type === 'worker-email') await notifyWorkerEmail(data);
    else if (type === 'apply')        await notifyApply(data);
    else return jsonRes(res, 404, { error: `Unknown notify type: ${type}` });
    jsonRes(res, 200, { ok: true });
  } catch (e) {
    console.error(`[NOTIFY] ${type}:`, e.message);
    jsonRes(res, 500, { error: e.message });
  }
}

// ── DynamoDB CRUD (/api/<table>[/<id>]) ───────────────────────────────────────
async function handleApi(req, res) {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, { 'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'Content-Type','Access-Control-Allow-Methods':'GET,POST,PUT,PATCH,DELETE,OPTIONS' });
    return res.end();
  }

  const parts  = req.url.replace(/^\/api\/?/, '').split('/').filter(Boolean);
  const table  = parts[0];
  const id     = parts[1];
  const method = req.method.toUpperCase();

  if (!table || !TABLES.has(table)) return jsonRes(res, 404, { error: `Unknown table: ${table}` });
  const pkAttr = PK[table];

  try {
    if (method === 'GET' && !id) {
      const r = await ddb.send(new ScanCommand({ TableName: table }));
      return jsonRes(res, 200, (r.Items || []).map(unmarshall));
    }
    if (method === 'GET' && id) {
      const r = await ddb.send(new GetItemCommand({ TableName: table, Key: marshall({ [pkAttr]: id }) }));
      return jsonRes(res, 200, r.Item ? unmarshall(r.Item) : null);
    }
    if (method === 'POST') {
      const item = await readBody(req);
      await ddb.send(new PutItemCommand({ TableName: table, Item: marshall(item, { removeUndefinedValues: true }) }));
      return jsonRes(res, 200, item);
    }
    if (method === 'PATCH' && id) {
      const fields = await readBody(req);
      const keys = Object.keys(fields).filter(k => k !== pkAttr);
      if (!keys.length) return jsonRes(res, 200, fields);
      const EAN = {}, EAV = {};
      const setClauses = keys.map((k, i) => { EAN[`#f${i}`] = k; EAV[`:v${i}`] = fields[k]; return `#f${i} = :v${i}`; });
      await ddb.send(new UpdateItemCommand({ TableName: table, Key: marshall({ [pkAttr]: id }), UpdateExpression: `SET ${setClauses.join(', ')}`, ExpressionAttributeNames: EAN, ExpressionAttributeValues: marshall(EAV, { removeUndefinedValues: true }), ReturnValues: 'UPDATED_NEW' }));
      return jsonRes(res, 200, fields);
    }
    if (method === 'DELETE' && id) {
      await ddb.send(new DeleteItemCommand({ TableName: table, Key: marshall({ [pkAttr]: id }) }));
      return jsonRes(res, 200, { deleted: true });
    }
    jsonRes(res, 405, { error: 'Method not allowed' });
  } catch (err) {
    console.error(`[API] ${method} /api/${table}${id?'/'+id:''}:`, err.message);
    jsonRes(res, 500, { error: err.message });
  }
}

// ── Static file handler ───────────────────────────────────────────────────────
function handleStatic(req, res) {
  const urlPath = req.url.split('?')[0];
  const resolved = path.resolve(DIST, '.' + urlPath);
  if (!resolved.startsWith(DIST)) { res.writeHead(403); return res.end('Forbidden'); }
  const serve = (fp, fb) => fs.readFile(fp, (err, data) => {
    if (err) { if (fb) return serve(fb, null); res.writeHead(404); return res.end('Not found'); }
    const ext = path.extname(fp).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME[ext]||'application/octet-stream', 'Content-Length': data.length, 'Cache-Control': urlPath.startsWith('/assets/') ? 'public,max-age=31536000,immutable' : 'no-cache' });
    res.end(data);
  });
  if (urlPath === '/' || !path.extname(urlPath)) serve(path.join(DIST,'index.html'), null);
  else serve(resolved, path.join(DIST,'index.html'));
}

// ── Single handler — ALB terminates TLS, EC2 always receives plain HTTP ───────
// The ALB handles HTTP→HTTPS redirect if needed. Server just serves everything.
function handler(req, res) {
  if (req.url.startsWith('/api/notify/')) return handleNotify(req, res);
  if (req.url.startsWith('/api/'))        return handleApi(req, res);
  handleStatic(req, res);
}

http.createServer(handler)
  .listen(PORT_HTTP, '0.0.0.0', () => console.log(`[HTTP]  → http://0.0.0.0:${PORT_HTTP}`))
  .on('error', e => console.error('[HTTP] ', e.message));

process.on('SIGTERM', () => process.exit(0));