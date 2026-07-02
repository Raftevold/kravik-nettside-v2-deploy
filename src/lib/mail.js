/**
 * Valfri e-postvarsling for kontaktskjemaet.
 * Aktiverast ved å setje SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS og
 * CONTACT_EMAIL (mottakar). Utan desse blir meldingane berre lagra i
 * admin-innboksen (som uansett alltid skjer).
 */
const nodemailer = require('nodemailer');

const configured = Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);

let transporter = null;
if (configured) {
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
}

async function notifyNewMessage(msg, siteName) {
  if (!configured) return false;
  const to = process.env.CONTACT_EMAIL || process.env.SMTP_USER;
  try {
    await transporter.sendMail({
      from: `"${siteName} – nettside" <${process.env.SMTP_USER}>`,
      to,
      replyTo: msg.email || undefined,
      subject: `Ny melding frå kontaktskjemaet – ${msg.name}`,
      text: [
        `Namn: ${msg.name}`,
        `E-post: ${msg.email}`,
        `Telefon: ${msg.phone || '(ikkje oppgitt)'}`,
        '',
        msg.message,
        '',
        `Sendt: ${msg.sentAt}`,
      ].join('\n'),
    });
    return true;
  } catch (err) {
    console.error('[mail] Sending feila:', err.message);
    return false;
  }
}

module.exports = { configured, notifyNewMessage };
