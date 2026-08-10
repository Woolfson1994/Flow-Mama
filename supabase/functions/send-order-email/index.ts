// Triggered by a Postgres trigger on every INSERT into public.orders.
// Sends the order details by email via Gmail SMTP, independent of whether
// any local machine is online, with the full up-to-date orders CSV attached.

import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";
import { encodeBase64 } from "https://deno.land/std@0.224.0/encoding/base64.ts";

const WEBHOOK_SECRET = Deno.env.get("WEBHOOK_SECRET")!;
const GMAIL_USER = Deno.env.get("GMAIL_USER")!;
const GMAIL_APP_PASSWORD = Deno.env.get("GMAIL_APP_PASSWORD")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RECIPIENTS = ["odeya265@gmail.com", "o.woolfson@gmail.com"];

// NOTE: keep this ASCII-only. denomailer's RFC2047 subject encoder is buggy —
// it wraps a multi-line quoted-printable blob in a single "=?utf-8?Q?...?="
// word, which corrupts (and un-renders) the whole email in Gmail once the
// encoded text is long enough to need line-folding (any real Hebrew subject
// triggers this). Pure ASCII subjects skip that code path entirely.
const SUBJECT = "Flow Mama - New Order";

const FIELD_LABELS: [string, string][] = [
  ["created_at", "תאריך הזמנה"],
  ["id", "מספר הזמנה"],
  ["name", "שם מלא"],
  ["phone", "טלפון"],
  ["email", "אימייל"],
  ["delivery_type", "סוג משלוח"],
  ["address", "כתובת"],
  ["city", "עיר"],
  ["postal", "מיקוד"],
  ["pickup_location", "מיקום איסוף"],
  ["color", "צבע"],
  ["size", "מידה"],
  ["total_price", "סכום (₪)"],
  ["status", "סטטוס"],
];

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function formatDate(iso: string): string {
  try {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Jerusalem",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(new Date(iso));
    return parts.replace(",", "");
  } catch {
    return iso;
  }
}

function buildHtml(order: Record<string, unknown>): string {
  const rows = FIELD_LABELS
    .filter(([key]) => order[key] !== undefined && order[key] !== null && order[key] !== "")
    .map(([key, label]) => {
      let val = String(order[key]);
      if (key === "created_at") val = formatDate(val);
      else if (key === "delivery_type") val = val === "shipping" ? "משלוח" : "איסוף עצמי";
      else if (key === "total_price") val = `₪${val}`;
      return `<tr><td style="padding:6px 14px;color:#666;white-space:nowrap;">${escapeHtml(label)}</td><td style="padding:6px 14px;font-weight:600;">${escapeHtml(val)}</td></tr>`;
    })
    .join("");

  return `<div dir="rtl" style="font-family:Arial,sans-serif;font-size:15px;color:#222;">
    <h2 style="color:#2A4B7C;">הזמנה חדשה התקבלה 🎉</h2>
    <table style="border-collapse:collapse;">${rows}</table>
    <p style="color:#999;font-size:12px;margin-top:20px;">נשלח אוטומטית מ-Flow Mama (שרת ענן, לא תלוי במחשב) — קובץ ה-CSV המעודכן מצורף.</p>
  </div>`;
}

function csvField(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function buildCsv(orders: Record<string, unknown>[]): string {
  const lines = [FIELD_LABELS.map(([, label]) => csvField(label)).join(",")];
  for (const order of orders) {
    const row = FIELD_LABELS.map(([key]) => {
      let val = order[key] == null ? "" : String(order[key]);
      if (key === "created_at" && val) val = formatDate(val);
      else if (key === "delivery_type") val = val === "shipping" ? "משלוח" : "איסוף עצמי";
      else if (key === "total_price" && val) val = `₪${val}`;
      return csvField(val);
    });
    lines.push(row.join(","));
  }
  return "﻿" + lines.join("\r\n");
}

async function fetchAllOrders(): Promise<Record<string, unknown>[]> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/orders?select=*&order=created_at.desc`, {
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
    },
  });
  if (!res.ok) throw new Error(`orders fetch failed: ${res.status}`);
  return await res.json();
}

Deno.serve(async (req) => {
  if (req.headers.get("x-webhook-secret") !== WEBHOOK_SECRET) {
    return new Response("unauthorized", { status: 401 });
  }

  let payload: { record?: Record<string, unknown> };
  try {
    payload = await req.json();
  } catch {
    return new Response("bad request", { status: 400 });
  }

  const order = payload.record;
  if (!order) {
    return new Response("no record in payload", { status: 400 });
  }

  const orders = await fetchAllOrders();
  const csv = buildCsv(orders);
  const csvBase64 = encodeBase64(new TextEncoder().encode(csv));

  const client = new SMTPClient({
    connection: {
      hostname: "smtp.gmail.com",
      port: 465,
      tls: true,
      auth: { username: GMAIL_USER, password: GMAIL_APP_PASSWORD },
    },
  });

  try {
    await client.send({
      from: GMAIL_USER,
      to: RECIPIENTS,
      subject: SUBJECT,
      html: buildHtml(order),
      attachments: [
        {
          filename: "flow_mama_orders.csv",
          contentType: "text/csv; charset=utf-8",
          encoding: "base64",
          content: csvBase64,
        },
      ],
    });
  } finally {
    await client.close();
  }

  return new Response("ok", { status: 200 });
});
