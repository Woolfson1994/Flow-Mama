// Triggered by a Postgres webhook (see supabase/functions/send-order-email/README.md)
// on every INSERT into public.orders. Sends the order details by email via Gmail SMTP,
// independent of whether any local machine is online.

import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const WEBHOOK_SECRET = Deno.env.get("WEBHOOK_SECRET")!;
const GMAIL_USER = Deno.env.get("GMAIL_USER")!;
const GMAIL_APP_PASSWORD = Deno.env.get("GMAIL_APP_PASSWORD")!;
const RECIPIENTS = ["odeya265@gmail.com", "o.woolfson@gmail.com"];

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
    return new Date(iso).toLocaleString("he-IL", {
      timeZone: "Asia/Jerusalem",
      dateStyle: "short",
      timeStyle: "short",
    });
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
    <p style="color:#999;font-size:12px;margin-top:20px;">נשלח אוטומטית מ-Flow Mama (שרת ענן, לא תלוי במחשב)</p>
  </div>`;
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
      subject: "Flow Mama — הזמנה חדשה התקבלה",
      html: buildHtml(order),
    });
  } finally {
    await client.close();
  }

  return new Response("ok", { status: 200 });
});
