#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
//  Prime Alpha Securities — Backend Server
//
//  Ports:  80 (HTTP)  443 (HTTPS)
//  Routes: /api/notify/*  → SES email + SNS SMS notifications
//          /api/*         → DynamoDB CRUD (IAM role, server-side)
//          /*             → Vite dist/ (React SPA)
//
//  AWS services used (all via IAM role — no hardcoded keys):
//    DynamoDB  — data storage
//    SES       — transactional email
//    SNS       — SMS to worker phones
//
//  REQUIRED ENV VARS (set in systemd service or export before running):
//    SES_FROM_EMAIL   — verified SES sender e.g. noreply@primealphasecurities.com
//    NOTIFY_EMAIL     — inbox that receives contact/credit alerts e.g. ops@primealphasecurities.com
//    AWS_REGION       — defaults to us-east-1
// ═══════════════════════════════════════════════════════════════════════════
'use strict';

const http  = require('http');
const https = require('https');
const fs    = require('fs');
const path  = require('path');

const {
  DynamoDBClient, ScanCommand, GetItemCommand,
  PutItemCommand, UpdateItemCommand, DeleteItemCommand,
} = require('@aws-sdk/client-dynamodb');
const { marshall, unmarshall } = require('@aws-sdk/util-dynamodb');
const { SESv2Client, SendEmailCommand }  = require('@aws-sdk/client-sesv2');
const { SNSClient, PublishCommand }       = require('@aws-sdk/client-sns');

// ── Config ────────────────────────────────────────────────────────────────────
const PORT_HTTP    = Number(process.env.PORT_HTTP)  || 80;
const PORT_HTTPS   = Number(process.env.PORT_HTTPS) || 443;
const REGION       = process.env.AWS_REGION         || 'us-east-1';
const SES_FROM     = process.env.SES_FROM_EMAIL     || '';   // must be SES-verified
const NOTIFY_EMAIL = process.env.NOTIFY_EMAIL       || '';   // ops inbox
const DIST         = path.join(__dirname, 'dist');
const CERTS        = path.join(__dirname, 'certs');

// ── AWS clients — all use EC2 IAM role automatically ─────────────────────────
const ddb = new DynamoDBClient({ region: REGION });
const ses = new SESv2Client({ region: REGION });
const sns = new SNSClient({ region: REGION });

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

// ── SES: send a plain-text + HTML email ───────────────────────────────────────
async function sendEmail({ to, subject, html, text }) {
  if (!SES_FROM) { console.warn('[SES] SES_FROM_EMAIL not set — skipping email'); return; }
  const toList = Array.isArray(to) ? to : [to];
  const validTo = toList.filter(Boolean);
  if (!validTo.length) return;
  try {
    await ses.send(new SendEmailCommand({
      FromEmailAddress: SES_FROM,
      Destination: { ToAddresses: validTo },
      Content: {
        Simple: {
          Subject: { Data: subject, Charset: 'UTF-8' },
          Body: {
            Html: { Data: html,  Charset: 'UTF-8' },
            Text: { Data: text,  Charset: 'UTF-8' },
          },
        },
      },
    }));
    console.log(`[SES] Sent "${subject}" → ${validTo.join(', ')}`);
  } catch (e) {
    console.error('[SES] Failed:', e.message);
  }
}

// ── SNS: send SMS to a phone number ──────────────────────────────────────────
async function sendSMS(phoneNumber, message) {
  if (!phoneNumber) return;
  // E.164 format required: +12125550101
  const phone = phoneNumber.startsWith('+') ? phoneNumber : '+' + phoneNumber.replace(/\D/g, '');
  try {
    await sns.send(new PublishCommand({
      PhoneNumber: phone,
      Message: message,
      MessageAttributes: {
        'AWS.SNS.SMS.SMSType': { DataType: 'String', StringValue: 'Transactional' },
        'AWS.SNS.SMS.SenderID': { DataType: 'String', StringValue: 'PrimeAlpha' },
      },
    }));
    console.log(`[SNS] SMS sent → ${phone}`);
  } catch (e) {
    console.error(`[SNS] Failed (${phone}):`, e.message);
  }
}

// ── Email templates ───────────────────────────────────────────────────────────
function wrapHtml(title, bodyHtml) {
  return `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;background:#f7f8fa;padding:32px 0;margin:0">
<div style="max-width:600px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;border:1px solid #e2e8f0">
  <div style="background:#0B0F1A;padding:24px 32px;display:flex;align-items:center;gap:12px">
    <span style="font-family:Georgia,serif;font-weight:900;font-size:18px;color:#fff;letter-spacing:-0.5px">PRIME ALPHA</span>
    <span style="font-size:10px;font-weight:700;letter-spacing:0.15em;color:#0057FF;text-transform:uppercase">Securities</span>
  </div>
  <div style="padding:32px">${bodyHtml}</div>
  <div style="background:#f7f8fa;padding:16px 32px;font-size:11px;color:#94a3b8;border-top:1px solid #e2e8f0">
    Prime Alpha Securities LLC · 745 Fifth Avenue, 32nd Floor · New York, NY 10151<br>
    This is an automated notification. Do not reply to this email.
  </div>
</div></body></html>`;
}

function row(label, value) {
  if (!value) return '';
  return `<tr><td style="padding:8px 0;font-size:13px;color:#64748b;width:160px;vertical-align:top">${label}</td>
          <td style="padding:8px 0;font-size:13px;color:#0B0F1A;font-weight:600">${value}</td></tr>`;
}

// ── Notification handlers ─────────────────────────────────────────────────────

// POST /api/notify/enquiry  — general contact form
async function notifyEnquiry(data) {
  const html = wrapHtml('New Contact Enquiry', `
    <h2 style="margin:0 0 4px;font-size:22px;color:#0B0F1A">New Contact Enquiry</h2>
    <p style="margin:0 0 24px;color:#64748b;font-size:13px">Submitted via primealphasecurities.com/contact</p>
    <table style="width:100%;border-collapse:collapse">
      ${row('Name', data.name)}
      ${row('Email', data.email)}
      ${row('Organisation', data.org)}
      ${row('Subject', data.subject)}
    </table>
    <div style="margin-top:20px;padding:16px;background:#f7f8fa;border-radius:6px;border-left:3px solid #0057FF">
      <div style="font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#0057FF;margin-bottom:8px">Message</div>
      <p style="margin:0;font-size:14px;color:#0B0F1A;line-height:1.7">${(data.message||'').replace(/\n/g,'<br>')}</p>
    </div>
    <a href="mailto:${data.email}?subject=Re: ${encodeURIComponent(data.subject||'Your enquiry')}" 
       style="display:inline-block;margin-top:24px;background:#0057FF;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:700;font-size:14px">
      Reply to ${data.name}
    </a>`);
  const text = `New enquiry from ${data.name} (${data.email})\nOrg: ${data.org||'—'}\nSubject: ${data.subject||'—'}\n\n${data.message}`;
  await sendEmail({ to: NOTIFY_EMAIL, subject: `[PAS] New enquiry from ${data.name}`, html, text });
}

// POST /api/notify/credit  — private credit application
async function notifyCredit(data) {
  const html = wrapHtml('New Credit Application', `
    <h2 style="margin:0 0 4px;font-size:22px;color:#0B0F1A">New Credit Application</h2>
    <p style="margin:0 0 24px;color:#64748b;font-size:13px">Submitted via primealphasecurities.com/private-credit · App ID: <code>${data.appId||'—'}</code></p>
    <table style="width:100%;border-collapse:collapse">
      ${row('Applicant', data.name)}
      ${row('Email', data.email)}
      ${row('Phone', data.phone)}
      ${row('Type', data.type === 'business' ? 'Business / Corporate' : 'Individual / HNW')}
      ${row('Loan Type', data.loanType)}
      ${row('Amount Requested', data.amount ? `$${Number(data.amount).toLocaleString()}` : data.amount)}
      ${row('Availability', data.availability)}
    </table>
    ${data.purpose ? `<div style="margin-top:20px;padding:16px;background:#f7f8fa;border-radius:6px;border-left:3px solid #0057FF">
      <div style="font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#0057FF;margin-bottom:8px">Purpose / Business Description</div>
      <p style="margin:0;font-size:14px;color:#0B0F1A;line-height:1.7">${data.purpose.replace(/\n/g,'<br>')}</p>
    </div>` : ''}
    <a href="mailto:${data.email}?subject=Re: Your credit application to Prime Alpha Securities"
       style="display:inline-block;margin-top:24px;background:#0057FF;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:700;font-size:14px">
      Contact Applicant
    </a>`);
  const text = `New credit application\nApplicant: ${data.name} (${data.email})\nPhone: ${data.phone||'—'}\nType: ${data.type} / ${data.loanType}\nAmount: ${data.amount}\n\n${data.purpose}`;
  await sendEmail({ to: NOTIFY_EMAIL, subject: `[PAS Credit] New application — ${data.name} — $${data.amount}`, html, text });
}

// POST /api/notify/calendar  — new event, email+SMS each assigned worker
async function notifyCalendar(data) {
  // data: { event: {...}, workers: [{name,email,phone,...}] }
  const { event, workers = [] } = data;
  if (!workers.length) return;

  const dateStr = event.date ? new Date(event.date + 'T12:00:00').toLocaleDateString('en-US', { weekday:'long', year:'numeric', month:'long', day:'numeric' }) : event.date;

  await Promise.all(workers.map(async (w) => {
    // ── Email ──────────────────────────────────────────────────────────────
    if (w.email) {
      const html = wrapHtml('Calendar Event — You Have Been Assigned', `
        <h2 style="margin:0 0 4px;font-size:22px;color:#0B0F1A">You've been added to a calendar event</h2>
        <p style="margin:0 0 28px;color:#64748b;font-size:13px">Hi ${w.name}, a new event has been scheduled and you have been assigned.</p>
        <div style="background:#0057FF;border-radius:8px;padding:24px 28px;margin-bottom:24px">
          <div style="font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:rgba(255,255,255,0.6);margin-bottom:6px">Event</div>
          <div style="font-family:Georgia,serif;font-size:24px;font-weight:900;color:#fff;margin-bottom:16px">${event.title}</div>
          <div style="display:flex;gap:32px">
            <div>
              <div style="font-size:10px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:rgba(255,255,255,0.6);margin-bottom:4px">Date</div>
              <div style="font-size:15px;font-weight:700;color:#fff">${dateStr}</div>
            </div>
          </div>
        </div>
        <p style="font-size:13px;color:#64748b;margin:0">Please ensure this is in your diary. Contact your team lead if you have any conflicts.</p>`);
      const text = `Hi ${w.name},\n\nYou have been assigned to: ${event.title}\nDate: ${dateStr}\n\nPrime Alpha Securities Team Console`;
      await sendEmail({ to: w.email, subject: `[PAS Calendar] You've been assigned: ${event.title} — ${dateStr}`, html, text });
    }

    // ── SMS ────────────────────────────────────────────────────────────────
    if (w.phone) {
      await sendSMS(w.phone, `Prime Alpha: You've been scheduled for "${event.title}" on ${dateStr}. Check your email for details.`);
    }
  }));
}

// POST /api/notify/worker-email  — worker compose tab sends real email
async function notifyWorkerEmail(data) {
  // data: { to, subject, body, sentBy }
  if (!data.to || !data.subject || !data.body) return;
  const html = wrapHtml(data.subject, `
    <p style="font-size:15px;color:#0B0F1A;line-height:1.8;white-space:pre-line">${data.body.replace(/\n/g,'<br>')}</p>
    <hr style="border:none;border-top:1px solid #e2e8f0;margin:28px 0">
    <p style="font-size:12px;color:#94a3b8">Sent via Prime Alpha Securities Team Console${data.sentBy ? ` by ${data.sentBy}` : ''}</p>`);
  await sendEmail({ to: data.to, subject: data.subject, html, text: data.body });
}

// ── Notification router (/api/notify/<type>) ─────────────────────────────────
async function handleNotify(req, res) {
  if (req.method !== 'POST') return jsonRes(res, 405, { error: 'POST only' });
  const type = req.url.replace(/^\/api\/notify\/?/, '').split('/')[0];
  const data  = await readBody(req);
  try {
    if      (type === 'enquiry')      await notifyEnquiry(data);
    else if (type === 'credit')       await notifyCredit(data);
    else if (type === 'calendar')     await notifyCalendar(data);
    else if (type === 'worker-email') await notifyWorkerEmail(data);
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

// ── Main handler ──────────────────────────────────────────────────────────────
function handler(req, res) {
  if (req.url.startsWith('/api/notify/')) return handleNotify(req, res);
  if (req.url.startsWith('/api/'))        return handleApi(req, res);
  handleStatic(req, res);
}

http.createServer(handler)
  .listen(PORT_HTTP, '0.0.0.0', () => console.log(`[HTTP]  → http://0.0.0.0:${PORT_HTTP}`))
  .on('error', e => console.error('[HTTP] ', e.message));

try {
  const tls = { key: fs.readFileSync(path.join(CERTS,'key.pem')), cert: fs.readFileSync(path.join(CERTS,'cert.pem')) };
  https.createServer(tls, handler)
    .listen(PORT_HTTPS, '0.0.0.0', () => console.log(`[HTTPS] → https://0.0.0.0:${PORT_HTTPS}`))
    .on('error', e => console.error('[HTTPS]', e.message));
} catch { console.warn('[HTTPS] No certs — HTTPS disabled'); }

process.on('SIGTERM', () => process.exit(0));
process.on('SIGINT',  () => process.exit(0));

if (!SES_FROM)     console.warn('[CONFIG] SES_FROM_EMAIL not set — emails will be skipped');
if (!NOTIFY_EMAIL) console.warn('[CONFIG] NOTIFY_EMAIL not set — contact/credit alerts will be skipped');
console.log(`[PAS]   Region: ${REGION} | From: ${SES_FROM||'(not set)'} | Notify: ${NOTIFY_EMAIL||'(not set)'}`);
