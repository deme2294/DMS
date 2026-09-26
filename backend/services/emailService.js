/**
 * emailService.js
 * Lightweight email wrapper around nodemailer.
 *
 * Required .env variables (optional — emails are silently skipped if absent):
 *   SMTP_HOST        e.g. smtp.gmail.com
 *   SMTP_PORT        e.g. 587
 *   SMTP_SECURE      true | false  (true = port 465 TLS, false = STARTTLS)
 *   SMTP_USER        your SMTP username / email address
 *   SMTP_PASS        your SMTP password / app-password
 *   EMAIL_FROM       "Help Desk <noreply@yourdomain.gov>"
 *
 * For local dev without a real SMTP server, install Ethereal:
 *   Just leave SMTP_* vars empty — emails will be logged to console instead.
 */

import nodemailer from 'nodemailer';

// ── Build transporter lazily so missing env vars don't crash the server ──────
let _transporter = null;

const getTransporter = () => {
    if (_transporter) return _transporter;

    if (!process.env.SMTP_HOST || !process.env.SMTP_USER) {
        // No SMTP configured → return a stub that logs to console
        return null;
    }

    _transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT || 587),
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
        },
    });

    return _transporter;
};

/**
 * Core send function — never throws; logs errors instead.
 * @param {object} options  { to, subject, html, text }
 */
const sendMail = async ({ to, subject, html, text }) => {
    const transporter = getTransporter();

    if (!transporter) {
        console.log(`[EMAIL STUB] To: ${to} | Subject: ${subject}`);
        if (text) console.log(`[EMAIL STUB] Body: ${text.substring(0, 200)}`);
        return;
    }

    try {
        const info = await transporter.sendMail({
            from: process.env.EMAIL_FROM || 'Help Desk <noreply@helpdesk.gov>',
            to,
            subject,
            html,
            text,
        });
        console.log(`✉️  Email sent → ${to} | msgId: ${info.messageId}`);
    } catch (err) {
        console.error(`❌  Email failed → ${to} | ${err.message}`);
    }
};

// ── Shared HTML wrapper ───────────────────────────────────────────────────────
const EMAIL_LOGO = process.env.EMAIL_LOGO || null; // full URL to company logo
const COMPANY_NAME = process.env.COMPANY_NAME || 'Government Help Desk';

const logoHtml = EMAIL_LOGO
  ? `<div style="margin-bottom:12px"><img src="${EMAIL_LOGO}" alt="${COMPANY_NAME}" style="max-height:48px" /></div>`
  : '';

const wrap = (title, bodyHtml, ticket = null) => {
  const link = ticket?.referenceNumber
    ? `<div class="info-row"><a href="${process.env.APP_URL || 'http://localhost:5173'}/tickets/${ticket.id || ''}">View Ticket ${ticket.referenceNumber}</a></div>`
    : '';
  return `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><style>
  body { font-family: Arial, sans-serif; background: #f5f5f5; padding: 20px; }
  .card { background: #fff; border-radius: 8px; padding: 32px; max-width: 560px; margin: auto; }
  .header { background: #1e40af; color: #fff; padding: 20px 32px; border-radius: 8px 8px 0 0; margin: -32px -32px 24px; }
  .badge { display: inline-block; padding: 4px 10px; border-radius: 12px; font-size: 12px; font-weight: 600; }
  .info-row { margin: 8px 0; }
  .label { color: #6b7280; font-size: 13px; }
  .footer { color: #9ca3af; font-size: 12px; margin-top: 24px; border-top: 1px solid #e5e7eb; padding-top: 16px; }
</style></head>
<body><div class="card">
  <div class="header"><h2 style="margin:0">${title}</h2></div>
  ${logoHtml}
  ${bodyHtml}
  ${link}
  <div class="footer">This is an automated message from the ${COMPANY_NAME} System. Please do not reply.</div>
</div></body></html>`;
};

// ────────────────────────────────────────────────────────────────────────────
// Public API
// ────────────────────────────────────────────────────────────────────────────

/**
 * Notify a user that their account was created.
 * @param {object} p  { email, firstName, username, tempPassword? }
 */
export const sendWelcomeEmail = async ({ email, firstName, username, tempPassword }) => {
    const passwordLine = tempPassword
        ? `<div class="info-row"><span class="label">Temporary Password:</span> <strong>${tempPassword}</strong></div>`
        : '';

    await sendMail({
        to: email,
        subject: 'Welcome to the Government Help Desk System',
        text: `Hello ${firstName}, your account has been created. Username: ${username}`,
        html: wrap('Welcome to Help Desk', `
      <p>Hello <strong>${firstName}</strong>,</p>
      <p>Your account has been created successfully.</p>
      <div class="info-row"><span class="label">Username:</span> <strong>${username}</strong></div>
      ${passwordLine}
      <p>Please log in and change your password as soon as possible.</p>
    `),
    });
};

/**
 * Notify submitter that their ticket was received.
 * @param {object} p  { email, firstName, ticket: { referenceNumber, trackNumber, title, priority } }
 */
export const sendTicketCreatedEmail = async ({ email, firstName, ticket }) => {
    await sendMail({
        to: email,
        subject: `[Help Desk] Ticket Received – ${ticket.referenceNumber}`,
        text: `Your ticket "${ticket.title}" has been submitted. Track number: ${ticket.trackNumber}`,
        html: wrap('Ticket Submitted', `
      <p>Hello <strong>${firstName}</strong>,</p>
      <p>Your support ticket has been received and is being processed.</p>
      <div class="info-row"><span class="label">Reference:</span> <strong>${ticket.referenceNumber}</strong></div>
      <div class="info-row"><span class="label">Track Number:</span> <strong>${ticket.trackNumber}</strong></div>
      <div class="info-row"><span class="label">Title:</span> ${ticket.title}</div>
      <div class="info-row"><span class="label">Priority:</span> ${ticket.priority}</div>
      ${ticket.response_due_date ? `<div class="info-row"><span class="label">Response Due:</span> <strong>${new Date(ticket.response_due_date).toLocaleString()}</strong></div>` : ''}
      ${ticket.due_date ? `<div class="info-row"><span class="label">Resolution Due:</span> <strong>${new Date(ticket.due_date).toLocaleString()}</strong></div>` : ''}
      <p>You can track your ticket status using the track number above.</p>
    `),
    });
};

/**
 * Notify the relevant party when a ticket status changes.
 * @param {object} p  { email, firstName, ticket, fromStatus, toStatus, notes? }
 */
export const sendTicketStatusEmail = async ({ email, firstName, ticket, fromStatus, toStatus, notes }) => {
    const notesHtml = notes
        ? `<div class="info-row"><span class="label">Notes:</span> ${notes}</div>`
        : '';

    await sendMail({
        to: email,
        subject: `[Help Desk] Ticket Status Updated – ${ticket.referenceNumber || ticket.reference_number}`,
        text: `Ticket "${ticket.title}" status changed from ${fromStatus} to ${toStatus}`,
        html: wrap('Ticket Status Updated', `
      <p>Hello <strong>${firstName}</strong>,</p>
      <p>The status of your ticket has been updated.</p>
      <div class="info-row"><span class="label">Reference:</span> <strong>${ticket.referenceNumber || ticket.reference_number}</strong></div>
      <div class="info-row"><span class="label">Title:</span> ${ticket.title}</div>
      <div class="info-row"><span class="label">Previous Status:</span> ${fromStatus}</div>
      <div class="info-row"><span class="label">New Status:</span> <strong>${toStatus}</strong></div>
      ${notesHtml}
    `),
    });
};

/**
 * Notify a staff member they have been assigned to a ticket.
 * @param {object} p  { email, firstName, ticket }
 */
export const sendTicketAssignedEmail = async ({ email, firstName, ticket }) => {
    await sendMail({
        to: email,
        subject: `[Help Desk] Ticket Assigned to You – ${ticket.reference_number}`,
        text: `You have been assigned ticket "${ticket.title}" (${ticket.reference_number})`,
        html: wrap('Ticket Assigned to You', `
      <p>Hello <strong>${firstName}</strong>,</p>
      <p>A ticket has been assigned to you.</p>
      <div class="info-row"><span class="label">Reference:</span> <strong>${ticket.reference_number}</strong></div>
      <div class="info-row"><span class="label">Title:</span> ${ticket.title}</div>
      <div class="info-row"><span class="label">Priority:</span> ${ticket.priority}</div>
      <div class="info-row"><span class="label">Category:</span> ${ticket.category}</div>
      ${ticket.response_due_date ? `<div class="info-row"><span class="label">Response Due:</span> <strong>${new Date(ticket.response_due_date).toLocaleString()}</strong></div>` : ''}
      ${ticket.due_date ? `<div class="info-row"><span class="label">Resolution Due:</span> <strong>${new Date(ticket.due_date).toLocaleString()}</strong></div>` : ''}
      ${ticket.escalation_due_date ? `<div class="info-row"><span class="label">Escalation Due:</span> <strong>${new Date(ticket.escalation_due_date).toLocaleString()}</strong></div>` : ''}
      <p>Please log in to review and action this ticket.</p>
    `),
    });
};

/**
 * Notify relevant parties that a reply was added.
 * @param {object} p  { email, firstName, ticket, replyPreview }
 */
export const sendTicketReplyEmail = async ({ email, firstName, ticket, replyPreview }) => {
    await sendMail({
        to: email,
        subject: `[Help Desk] New Reply – ${ticket.reference_number}`,
        text: `A new reply has been added to ticket "${ticket.title}"`,
        html: wrap('New Reply on Ticket', `
      <p>Hello <strong>${firstName}</strong>,</p>
      <p>A new reply has been added to your ticket.</p>
      <div class="info-row"><span class="label">Reference:</span> <strong>${ticket.reference_number}</strong></div>
      <div class="info-row"><span class="label">Title:</span> ${ticket.title}</div>
      <div class="info-row"><span class="label">Latest Reply:</span> ${replyPreview}</div>
      <p>Please log in to view the full conversation.</p>
    `),
    });
};

/**
 * Notify the tenant that the ticket has been resolved.
 * @param {object} p  { email, firstName, ticket }
 */
export const sendTicketResolvedEmail = async ({ email, firstName, ticket }) => {
    await sendMail({
        to: email,
        subject: `[Help Desk] Ticket Resolved – ${ticket.reference_number}`,
        text: `Your ticket "${ticket.title}" has been resolved.`,
        html: wrap('Ticket Resolved', `
      <p>Hello <strong>${firstName}</strong>,</p>
      <p>Your ticket has been marked as resolved.</p>
      <div class="info-row"><span class="label">Reference:</span> <strong>${ticket.reference_number}</strong></div>
      <div class="info-row"><span class="label">Title:</span> ${ticket.title}</div>
      <p>If the issue is not fully resolved, please reply to this ticket or reopen it.</p>
    `),
    });
};

/**
 * Notify the tenant that the ticket has been closed.
 * @param {object} p  { email, firstName, ticket }
 */
export const sendTicketClosedEmail = async ({ email, firstName, ticket }) => {
    await sendMail({
        to: email,
        subject: `[Help Desk] Ticket Closed – ${ticket.reference_number}`,
        text: `Your ticket "${ticket.title}" has been closed.`,
        html: wrap('Ticket Closed', `
      <p>Hello <strong>${firstName}</strong>,</p>
      <p>Your ticket has been closed.</p>
      <div class="info-row"><span class="label">Reference:</span> <strong>${ticket.reference_number}</strong></div>
      <div class="info-row"><span class="label">Title:</span> ${ticket.title}</div>
      <p>If you need further assistance, please submit a new ticket.</p>
    `),
    });
};

/**
 * Notify the tenant their account was locked.
 * @param {object} p  { email, firstName, unlockAfterMinutes }
 */
export const sendAccountLockedEmail = async ({ email, firstName, unlockAfterMinutes }) => {
    await sendMail({
        to: email,
        subject: '[Help Desk] Account Temporarily Locked',
        text: `Your account has been temporarily locked due to too many failed login attempts.`,
        html: wrap('Account Locked', `
      <p>Hello <strong>${firstName}</strong>,</p>
      <p>Your account has been temporarily locked due to multiple failed login attempts.</p>
      <p>It will unlock automatically after <strong>${unlockAfterMinutes} minutes</strong>.</p>
      <p>If you did not attempt to log in, please contact your administrator immediately.</p>
    `),
    });
};

/**
 * Notify a recipient that a new notice has been published to their role/audience.
 * @param {object} p  { email, firstName, notice: { title, description, priority, expiresAt } }
 */
export const sendNoticePublishedEmail = async ({ email, firstName, notice }) => {
  const expiry = notice.expiresAt
    ? `<div class="info-row"><span class="label">Valid Until:</span> ${new Date(notice.expiresAt).toLocaleString()}</div>`
    : '';

  await sendMail({
    to: email,
    subject: `[Help Desk] New Notice – ${notice.title}`,
    text: `A new notice "${notice.title}" has been published for you.`,
    html: wrap('New Notice Published', `
      <p>Hello <strong>${firstName}</strong>,</p>
      <p>A new system notice has been published for your attention.</p>
      <div class="info-row"><span class="label">Title:</span> <strong>${notice.title}</strong></div>
      <div class="info-row"><span class="label">Priority:</span> ${notice.priority}</div>
      ${expiry}
      <div class="info-row" style="margin-top:12px"><span class="label">Message:</span></div>
      <p>${notice.description}</p>
      <p>Please log in to the Help Desk portal to review and acknowledge this notice.</p>
    `),
  });
};

/**
 * Send password reset confirmation after admin resets a user's password.
 * @param {object} p  { email, firstName, newPassword }
 */
export const sendPasswordResetEmail = async ({ email, firstName, newPassword }) => {
  await sendMail({
    to: email,
    subject: '[Help Desk] Your Password Has Been Reset',
    text: `Hello ${firstName}, your password has been reset by an administrator.`,
    html: wrap('Password Reset', `
      <p>Hello <strong>${firstName}</strong>,</p>
      <p>Your account password has been reset by an administrator.</p>
      <div class="info-row"><span class="label">New Password:</span> <strong>${newPassword}</strong></div>
      <p>Please log in and change your password immediately.</p>
    `),
  });
};

/**
 * Warn a recipient that a notice has expired without being acknowledged.
 * @param {object} p  { email, firstName, notice: { title, description, expiresAt } }
 */
export const sendNoticeExpiryWarningEmail = async ({ email, firstName, notice }) => {
  await sendMail({
    to: email,
    subject: `[Help Desk] Action Required – Notice Expired: ${notice.title}`,
    text: `The notice "${notice.title}" has expired and was not acknowledged.`,
    html: wrap('Notice Expired – Action Required', `
      <p>Hello <strong>${firstName}</strong>,</p>
      <p>The following notice addressed to you has now <strong>expired</strong> and was <strong>not acknowledged</strong>.</p>
      <div class="info-row"><span class="label">Title:</span> <strong>${notice.title}</strong></div>
      <div class="info-row"><span class="label">Expired On:</span> ${notice.expiresAt ? new Date(notice.expiresAt).toLocaleString() : '—'}</div>
      <div class="info-row" style="margin-top:12px"><span class="label">Message:</span></div>
      <p>${notice.description}</p>
      <p style="color:#b91c1c"><strong>Please log in and acknowledge any outstanding notices as soon as possible.</strong></p>
    `),
  });
};

/**
 * Notify relevant parties that a ticket has been escalated.
 */
export const sendTicketEscalatedEmail = async (ticket, notes) => {
  if (!ticket.created_by) return;
  const [rows] = await pool.query('SELECT email, first_name FROM users WHERE id = :id LIMIT 1', { id: ticket.created_by });
  if (!rows.length) return;
  await sendMail({
    to: rows[0].email,
    subject: `[Help Desk] Ticket Escalated – ${ticket.referenceNumber || ticket.reference_number}`,
    text: `Ticket "${ticket.title}" has been escalated.`,
    html: wrap('Ticket Escalated', `
      <p>Hello <strong>${rows[0].first_name}</strong>,</p>
      <p>Your ticket has been <strong>escalated</strong> for urgent attention.</p>
      <div class="info-row"><span class="label">Reference:</span> <strong>${ticket.referenceNumber || ticket.reference_number}</strong></div>
      <div class="info-row"><span class="label">Title:</span> ${ticket.title}</div>
      <div class="info-row"><span class="label">Priority:</span> ${ticket.priority}</div>
      ${notes ? `<div class="info-row"><span class="label">Notes:</span> ${notes}</div>` : ''}
    `, ticket),
  });
};

/**
 * Notify the admin that a ticket has been marked completed (awaiting approval).
 */
export const sendTicketCompletedEmail = async (ticket) => {
  if (!ticket.created_by) return;
  const [rows] = await pool.query('SELECT email, first_name FROM users WHERE id = :id LIMIT 1', { id: ticket.created_by });
  if (!rows.length) return;
  await sendMail({
    to: rows[0].email,
    subject: `[Help Desk] Ticket Completed – ${ticket.referenceNumber || ticket.reference_number}`,
    text: `Ticket "${ticket.title}" has been marked completed.`,
    html: wrap('Ticket Completed', `
      <p>Hello <strong>${rows[0].first_name}</strong>,</p>
      <p>Ticket <strong>${ticket.referenceNumber || ticket.reference_number}</strong> has been marked <strong>completed</strong> and is now awaiting admin approval.</p>
      <div class="info-row"><span class="label">Reference:</span> <strong>${ticket.referenceNumber || ticket.reference_number}</strong></div>
      <div class="info-row"><span class="label">Title:</span> ${ticket.title}</div>
      <div class="info-row"><span class="label">Priority:</span> ${ticket.priority}</div>
      <div class="info-row"><span class="label">Category:</span> ${ticket.category}</div>
      <div class="info-row"><span class="label">Status:</span> Completed (awaiting approval)</div>
      ${ticket.due_date ? `<div class="info-row"><span class="label">SLA Due:</span> ${new Date(ticket.due_date).toLocaleString()}</div>` : ''}
      ${ticket.response_due_date ? `<div class="info-row"><span class="label">Response Due:</span> ${new Date(ticket.response_due_date).toLocaleString()}</div>` : ''}
      ${ticket.escalation_due_date ? `<div class="info-row"><span class="label">Escalation Due:</span> ${new Date(ticket.escalation_due_date).toLocaleString()}</div>` : ''}
    `, ticket),
  });
};

export const sendTicketAcceptedEmail = async (ticket, acceptedBy) => {
  const [recipients] = await pool.query(
    `SELECT u.email, u.first_name FROM users u WHERE u.id IN (:createdBy, :assignedTo) AND u.status = 'active'`,
    { createdBy: ticket.created_by, assignedTo: ticket.assigned_to }
  );
  for (const rcpt of recipients) {
    await sendMail({
      to: rcpt.email,
      subject: `[Help Desk] Assignment Accepted – ${ticket.referenceNumber || ticket.reference_number}`,
      text: `Ticket "${ticket.title}" assignment has been accepted.`,
      html: wrap('Assignment Accepted', `
        <p>Hello <strong>${rcpt.first_name}</strong>,</p>
        <p>Ticket <strong>${ticket.referenceNumber || ticket.reference_number}</strong> assignment has been <strong>accepted</strong>.</p>
        <div class="info-row"><span class="label">Reference:</span> <strong>${ticket.referenceNumber || ticket.reference_number}</strong></div>
        <div class="info-row"><span class="label">Title:</span> ${ticket.title}</div>
        <div class="info-row"><span class="label">Priority:</span> ${ticket.priority}</div>
        <div class="info-row"><span class="label">Status:</span> ${ticket.status}</div>
      `, ticket),
    });
  }
};

export const sendTicketRejectedEmail = async (ticket, rejectedBy, reason) => {
  const [recipients] = await pool.query(
    `SELECT u.email, u.first_name FROM users u WHERE u.id = :createdBy AND u.status = 'active'`,
    { createdBy: ticket.created_by }
  );
  const reasonText = reason ? `<div class="info-row"><span class="label">Reason:</span> ${reason}</div>` : '';
  for (const rcpt of recipients) {
    await sendMail({
      to: rcpt.email,
      subject: `[Help Desk] Assignment Rejected – ${ticket.referenceNumber || ticket.reference_number}`,
      text: `Ticket "${ticket.title}" assignment was rejected.`,
      html: wrap('Assignment Rejected', `
        <p>Hello <strong>${rcpt.first_name}</strong>,</p>
        <p>Ticket <strong>${ticket.referenceNumber || ticket.reference_number}</strong> assignment was <strong>rejected</strong>.</p>
        <div class="info-row"><span class="label">Reference:</span> <strong>${ticket.referenceNumber || ticket.reference_number}</strong></div>
        <div class="info-row"><span class="label">Title:</span> ${ticket.title}</div>
        ${reasonText}
      `, ticket),
    });
  }
};

/**
 * Notify the tenant that the ticket has been approved.
 */
export const sendTicketApprovedEmail = async (ticket, notes) => {
  if (!ticket.created_by) return;
  const [rows] = await pool.query('SELECT email, first_name FROM users WHERE id = :id LIMIT 1', { id: ticket.created_by });
  if (!rows.length) return;
  await sendMail({
    to: rows[0].email,
    subject: `[Help Desk] Ticket Approved – ${ticket.referenceNumber || ticket.reference_number}`,
    text: `Ticket "${ticket.title}" has been approved.`,
    html: wrap('Ticket Approved', `
      <p>Hello <strong>${rows[0].first_name}</strong>,</p>
      <p>Your ticket has been <strong>approved</strong> and is ready to be closed.</p>
      <div class="info-row"><span class="label">Reference:</span> <strong>${ticket.referenceNumber || ticket.reference_number}</strong></div>
      <div class="info-row"><span class="label">Title:</span> ${ticket.title}</div>
      ${notes ? `<div class="info-row"><span class="label">Notes:</span> ${notes}</div>` : ''}
    `, ticket),
  });
};

/**
 * Notify the tenant that the ticket has been reopened.
 */
export const sendTicketReopenedEmail = async (ticket) => {
  if (!ticket.created_by) return;
  const [rows] = await pool.query('SELECT email, first_name FROM users WHERE id = :id LIMIT 1', { id: ticket.created_by });
  if (!rows.length) return;
  await sendMail({
    to: rows[0].email,
    subject: `[Help Desk] Ticket Reopened – ${ticket.referenceNumber || ticket.reference_number}`,
    text: `Ticket "${ticket.title}" has been reopened.`,
    html: wrap('Ticket Reopened', `
      <p>Hello <strong>${rows[0].first_name}</strong>,</p>
      <p>Your ticket has been <strong>reopened</strong> for further work.</p>
      <div class="info-row"><span class="label">Reference:</span> <strong>${ticket.referenceNumber || ticket.reference_number}</strong></div>
      <div class="info-row"><span class="label">Title:</span> ${ticket.title}</div>
    `, ticket),
  });
};

/**
 * Notify the tenant that duplicate tickets were merged.
 */
export const sendTicketMergedEmail = async (ticket, count) => {
  if (!ticket.created_by) return;
  const [rows] = await pool.query('SELECT email, first_name FROM users WHERE id = :id LIMIT 1', { id: ticket.created_by });
  if (!rows.length) return;
  await sendMail({
    to: rows[0].email,
    subject: `[Help Desk] Tickets Merged – ${ticket.referenceNumber || ticket.reference_number}`,
    text: `${count} duplicate tickets were merged into ${ticket.referenceNumber || ticket.reference_number}.`,
    html: wrap('Tickets Merged', `
      <p>Hello <strong>${rows[0].first_name}</strong>,</p>
      <p><strong>${count}</strong> duplicate ticket(s) were merged into <strong>${ticket.referenceNumber || ticket.reference_number}</strong>.</p>
      <div class="info-row"><span class="label">Title:</span> ${ticket.title}</div>
    `, ticket),
  });
};

const SLA_BREACH_SUBJECTS = {
  response: 'Response SLA Breached',
  escalation: 'Escalation SLA Breached',
  resolution: 'Resolution SLA Overdue',
};

const SLA_BREACH_TITLES = {
  response: 'Response SLA Breached',
  escalation: 'Escalation SLA Breached',
  resolution: 'Resolution SLA Overdue',
};

const SLA_BREACH_MESSAGES = {
  response: (ticket) => `Response SLA for ticket ${ticket.reference_number || ticket.referenceNumber} "${ticket.title}" has been breached. Immediate action required.`,
  escalation: (ticket) => `Escalation SLA was triggered for ticket ${ticket.reference_number || ticket.referenceNumber} "${ticket.title}". The ticket has been escalated for urgent attention.`,
  resolution: (ticket) => `Resolution SLA for ticket ${ticket.reference_number || ticket.referenceNumber} "${ticket.title}" is now overdue. Please action immediately.`,
};

export const sendSLABreachedEmail = async ({ email, firstName, ticket, breachType }) => {
  const subject = SLA_BREACH_SUBJECTS[breachType] || 'SLA Breached';
  const title = SLA_BREACH_TITLES[breachType] || 'SLA Breached';
  const message = SLA_BREACH_MESSAGES[breachType] ? SLA_BREACH_MESSAGES[breachType](ticket) : 'SLA deadline breached.';

  await sendMail({
    to: email,
    subject: `[Help Desk] ${subject} – ${ticket.reference_number || ticket.referenceNumber}`,
    text: message,
    html: wrap(title, `
      <p>Hello <strong>${firstName}</strong>,</p>
      <p>${message}</p>
      <div class="info-row"><span class="label">Reference:</span> <strong>${ticket.reference_number || ticket.referenceNumber}</strong></div>
      <div class="info-row"><span class="label">Title:</span> ${ticket.title}</div>
      <div class="info-row"><span class="label">Priority:</span> ${ticket.priority}</div>
      <div class="info-row"><span class="label">Status:</span> ${ticket.status}</div>
      ${ticket.response_due_date ? `<div class="info-row"><span class="label">Response Due:</span> ${new Date(ticket.response_due_date).toLocaleString()}</div>` : ''}
      ${ticket.escalation_due_date ? `<div class="info-row"><span class="label">Escalation Due:</span> ${new Date(ticket.escalation_due_date).toLocaleString()}</div>` : ''}
      ${ticket.due_date ? `<div class="info-row"><span class="label">Resolution Due:</span> ${new Date(ticket.due_date).toLocaleString()}</div>` : ''}
      <p style="color:#b91c1c"><strong>Please log in to the Help Desk portal to review and action this ticket immediately.</strong></p>
    `, ticket),
  });
};

const SLA_WARNING_MESSAGES = {
  response: (ticket, remainingHours) => `Response SLA for ticket ${ticket.reference_number || ticket.referenceNumber} "${ticket.title}" will breach in approximately ${remainingHours} hour(s). Please respond soon.`,
  escalation: (ticket, remainingHours) => `Escalation SLA for ticket ${ticket.reference_number || ticket.referenceNumber} "${ticket.title}" will breach in approximately ${remainingHours} hour(s). Please prepare for escalation.`,
  resolution: (ticket, remainingHours) => `Resolution SLA for ticket ${ticket.reference_number || ticket.referenceNumber} "${ticket.title}" will breach in approximately ${remainingHours} hour(s). Please expedite resolution.`,
};

export const sendSLANearDeadlineEmail = async ({ email, firstName, ticket, breachType, remainingHours }) => {
  const subject = `[Help Desk] SLA Warning – ${ticket.reference_number || ticket.referenceNumber}`;
  const title = 'SLA Deadline Approaching';
  const message = SLA_WARNING_MESSAGES[breachType] ? SLA_WARNING_MESSAGES[breachType](ticket, remainingHours) : 'SLA deadline approaching.';

  await sendMail({
    to: email,
    subject,
    text: message,
    html: wrap(title, `
      <p>Hello <strong>${firstName}</strong>,</p>
      <p>${message}</p>
      <div class="info-row"><span class="label">Reference:</span> <strong>${ticket.reference_number || ticket.referenceNumber}</strong></div>
      <div class="info-row"><span class="label">Title:</span> ${ticket.title}</div>
      <div class="info-row"><span class="label">Priority:</span> ${ticket.priority}</div>
      <div class="info-row"><span class="label">Status:</span> ${ticket.status}</div>
      <div class="info-row"><span class="label">Remaining Time:</span> <strong>${remainingHours} hour(s)</strong></div>
      <p>Please log in to the Help Desk portal to take action before the SLA is breached.</p>
    `, ticket),
  });
};

/**
 * Notify office property owner about a new tenant inquiry.
 * @param {object} p  { ownerEmail, ownerName, tenantName, tenantEmail, office, subject, message }
 */
export const sendOfficeInquiryEmail = async ({ 
  ownerEmail, 
  ownerName, 
  tenantName, 
  tenantEmail, 
  office, 
  subject, 
  message 
}) => {
  const officeDetails = `
    <div style="background: #f3f4f6; padding: 16px; border-radius: 8px; margin: 16px 0;">
      <div class="info-row"><span class="label">Building:</span> <strong>${office.building || 'N/A'}</strong></div>
      <div class="info-row"><span class="label">Floor:</span> ${office.floor || 'N/A'}</div>
      <div class="info-row"><span class="label">Office Number:</span> ${office.office_number || 'N/A'}</div>
      ${office.description ? `<div class="info-row"><span class="label">Description:</span> ${office.description}</div>` : ''}
    </div>
  `;

  const inquiryContent = message.replace(/\n/g, '<br>');

  await sendMail({
    to: ownerEmail,
    subject: `[Corporate Office] New Inquiry – ${office.building || 'Office Location'}`,
    text: `New inquiry from ${tenantName} (${tenantEmail}) about ${office.building} office. Subject: ${subject}`,
    html: wrap('New Office Location Inquiry', `
      <p>Hello <strong>${ownerName}</strong>,</p>
      <p>You have received a new inquiry from a tenant regarding one of your office locations.</p>
      
      <div style="margin: 24px 0;">
        <h3 style="color: #1e40af; margin-bottom: 8px;">📧 Inquiry Details</h3>
        <div class="info-row"><span class="label">Subject:</span> <strong>${subject}</strong></div>
        <div class="info-row"><span class="label">From:</span> ${tenantName}</div>
        <div class="info-row"><span class="label">Email:</span> <a href="mailto:${tenantEmail}">${tenantEmail}</a></div>
      </div>

      <div style="margin: 24px 0;">
        <h3 style="color: #1e40af; margin-bottom: 8px;">🏢 Office Location</h3>
        ${officeDetails}
      </div>

      <div style="margin: 24px 0;">
        <h3 style="color: #1e40af; margin-bottom: 8px;">💬 Message</h3>
        <div style="background: #ffffff; border-left: 4px solid #1e40af; padding: 16px; margin-top: 8px;">
          ${inquiryContent}
        </div>
      </div>

      <p style="margin-top: 24px;">
        <strong>Action Required:</strong> Please respond to this tenant's inquiry at your earliest convenience.
        You can reply directly to <a href="mailto:${tenantEmail}">${tenantEmail}</a> or log in to the Help Desk portal to manage this inquiry.
      </p>
    `),
  });
};

/**
 * Notify tenant that admin has responded to their office inquiry.
 * @param {object} p  { tenantEmail, tenantName, adminName, office, originalSubject, originalMessage, responseMessage }
 */
export const sendOfficeInquiryResponseEmail = async ({
  tenantEmail,
  tenantName,
  adminName,
  office,
  originalSubject,
  originalMessage,
  responseMessage,
}) => {
  const officeDetails = `
    <div style="background: #f3f4f6; padding: 16px; border-radius: 8px; margin: 16px 0;">
      <div class="info-row"><span class="label">Building:</span> <strong>${office.building || 'N/A'}</strong></div>
      <div class="info-row"><span class="label">Floor:</span> ${office.floor || 'N/A'}</div>
      <div class="info-row"><span class="label">Office Number:</span> ${office.office_number || 'N/A'}</div>
    </div>
  `;

  const originalContent = originalMessage.replace(/\n/g, '<br>');
  const responseContent = responseMessage.replace(/\n/g, '<br>');

  await sendMail({
    to: tenantEmail,
    subject: `[Corporate Office] Response to Your Inquiry – ${office.building || 'Office Location'}`,
    text: `Response from ${adminName} to your inquiry about ${office.building} office.`,
    html: wrap('Response to Your Office Inquiry', `
      <p>Hello <strong>${tenantName}</strong>,</p>
      <p>You have received a response to your office location inquiry from <strong>${adminName}</strong>.</p>
      
      <div style="margin: 24px 0;">
        <h3 style="color: #1e40af; margin-bottom: 8px;">🏢 Office Location</h3>
        ${officeDetails}
      </div>

      <div style="margin: 24px 0;">
        <h3 style="color: #1e40af; margin-bottom: 8px;">📧 Your Original Inquiry</h3>
        <div class="info-row"><span class="label">Subject:</span> <strong>${originalSubject}</strong></div>
        <div style="background: #f8fafc; border-left: 4px solid #cbd5e1; padding: 16px; margin-top: 8px;">
          ${originalContent}
        </div>
      </div>

      <div style="margin: 24px 0; background: #ecfdf5; border: 2px solid #10b981; border-radius: 8px; padding: 20px;">
        <h3 style="color: #065f46; margin: 0 0 12px 0;">✉️ Administrator Response</h3>
        <div class="info-row"><span class="label">From:</span> <strong>${adminName}</strong></div>
        <div style="background: white; padding: 16px; margin-top: 12px; border-radius: 6px;">
          ${responseContent}
        </div>
      </div>

      <p style="margin-top: 24px;">
        <strong>Need further assistance?</strong> You can reply to this email or log in to the Help Desk portal to view all your inquiries and responses at any time.
      </p>
    `),
  });
};

/**
 * Send Google Meet Video Call Invitation to a registered user.
 * @param {object} p { recipientEmail, recipientName, senderName, senderRole, meetingUrl, meetingTitle, roomName, notes }
 */
export const sendMeetingInvitationEmail = async ({
  recipientEmail,
  recipientName = 'Colleague',
  senderName = 'Help Desk Team Member',
  senderRole = 'User',
  meetingUrl,
  meetingTitle = 'Live Video Consultation & Support',
  roomName = 'Help Desk Chat',
  notes = '',
  webAppUrl = '',
  scheduledTime = null,
  formattedScheduledTime = '',
  createdTime = '',
  durationMinutes = 30,
  isScreenShare = false,
}) => {
  const formattedRole = senderRole.charAt(0).toUpperCase() + senderRole.slice(1);
  const notesSection = notes
    ? `
      <div style="margin: 20px 0; background: #f8fafc; border-left: 4px solid #00897b; padding: 14px 18px; border-radius: 4px;">
        <strong style="color: #334155; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px;">Host Note:</strong>
        <p style="margin: 6px 0 0 0; color: #475569; font-size: 14px; line-height: 1.5;">${notes}</p>
      </div>`
    : '';

  const effectiveScreenShare = Boolean(
    isScreenShare || meetingTitle.toLowerCase().includes('screen') || notes.toLowerCase().includes('screen')
  );

  const appUrl = webAppUrl || process.env.APP_URL || 'http://10.195.207.9:5173';
  const headerBadge = effectiveScreenShare ? '🖥️ SCREEN SHARING & VIDEO SESSION' : '🎥 LIVE VIDEO MEETING';
  const ctaText = formattedScheduledTime
    ? (effectiveScreenShare ? '🖥️ Join Scheduled Screen Share & Call' : '📹 Join Scheduled Video Call')
    : (effectiveScreenShare ? '🖥️ Join Screen Share & Video Now' : '🎥 Join Video Call Now');

  const subjectPrefix = effectiveScreenShare ? '🖥️ Screen Sharing & Video' : '📹 Video Meeting';
  const timeSubject = formattedScheduledTime ? ` [Scheduled: ${formattedScheduledTime}]` : '';

  await sendMail({
    to: recipientEmail,
    subject: `${subjectPrefix}: ${meetingTitle}${timeSubject} (from ${senderName})`,
    text: `Hello ${recipientName},\n\n${senderName} (${formattedRole}) has invited you to a ${effectiveScreenShare ? 'Screen Sharing & Video' : 'Video Conference'} session: "${meetingTitle}".\n\n${formattedScheduledTime ? `Scheduled Time: ${formattedScheduledTime}\nDuration: ${durationMinutes} mins\n` : ''}${createdTime ? `Created: ${createdTime}\n` : ''}${effectiveScreenShare ? 'Screen Share: Enabled\n' : ''}\nMeeting Link: ${meetingUrl}\nWeb App Chat: ${appUrl}\n\nJoin directly from the link or via your Help Desk portal.`,
    html: wrap('Video Conference & Screen Sharing Invitation', `
      <div style="text-align: center; margin-bottom: 20px;">
        <div style="display: inline-block; background: ${effectiveScreenShare ? '#eff6ff' : '#e6f4ea'}; color: ${effectiveScreenShare ? '#1d4ed8' : '#137333'}; font-weight: 700; font-size: 13px; padding: 6px 14px; border-radius: 20px; margin-bottom: 12px; border: 1px solid ${effectiveScreenShare ? '#bfdbfe' : '#b7e1cd'};">
          ${headerBadge}
        </div>
        <h2 style="color: #202124; margin: 4px 0 8px 0; font-size: 22px;">${meetingTitle}</h2>
        <p style="color: #5f6368; margin: 0; font-size: 14px;">Chat Channel: <strong>${roomName}</strong></p>
      </div>

      <div style="background: #ffffff; border: 1px solid #dadce0; border-radius: 12px; padding: 24px; margin: 20px 0; box-shadow: 0 1px 3px rgba(60,64,67,0.1);">
        <p style="color: #3c4043; font-size: 15px; margin-top: 0;">
          Hello <strong>${recipientName}</strong>,
        </p>
        <p style="color: #3c4043; font-size: 14px; line-height: 1.6;">
          <strong>${senderName}</strong> (<span style="color: #1a73e8; font-weight: 600;">${formattedRole}</span>) has invited you to join a video conference and screen sharing session.
        </p>

        ${formattedScheduledTime ? `
        <div style="margin: 18px 0; background: #f0fdf4; border: 1px solid #86efac; border-left: 5px solid #16a34a; border-radius: 8px; padding: 14px 18px;">
          <div style="font-size: 11px; font-weight: 700; color: #15803d; text-transform: uppercase; letter-spacing: 0.5px;">
            🗓️ Scheduled Event Date & Time
          </div>
          <div style="font-size: 17px; font-weight: 700; color: #14532d; margin-top: 4px;">
            ${formattedScheduledTime}
          </div>
          <div style="font-size: 13px; color: #166534; margin-top: 6px;">
            Estimated Duration: <strong>${durationMinutes} Minutes</strong>
            ${createdTime ? `<span style="color: #64748b; margin-left: 8px;">• Created: ${createdTime}</span>` : ''}
          </div>
          ${effectiveScreenShare ? `
          <div style="margin-top: 10px; display: inline-block; background: #e0f2fe; color: #0369a1; font-size: 12px; font-weight: 600; padding: 4px 10px; border-radius: 6px; border: 1px solid #bae6fd;">
            🖥️ Screen Sharing Enabled: Attendees can present their screen or view presentations
          </div>` : ''}
        </div>` : `
        <div style="margin: 18px 0; background: #f8fafc; border: 1px solid #e2e8f0; border-left: 5px solid #00897b; border-radius: 8px; padding: 14px 18px;">
          <div style="font-size: 11px; font-weight: 700; color: #00796b; text-transform: uppercase; letter-spacing: 0.5px;">
            ⚡ Immediate Session Notice
          </div>
          <div style="font-size: 15px; font-weight: 700; color: #1e293b; margin-top: 4px;">
            Starting Now • Attendees can join immediately
          </div>
          ${createdTime ? `<div style="font-size: 12px; color: #64748b; margin-top: 4px;">Created: ${createdTime}</div>` : ''}
          ${effectiveScreenShare ? `
          <div style="margin-top: 8px; display: inline-block; background: #e0f2fe; color: #0369a1; font-size: 12px; font-weight: 600; padding: 4px 10px; border-radius: 6px; border: 1px solid #bae6fd;">
            🖥️ Screen Sharing Enabled
          </div>` : ''}
        </div>`}

        ${notesSection}

        <div style="text-align: center; margin: 30px 0 20px 0;">
          <a href="${meetingUrl}" target="_blank" rel="noopener noreferrer"
             style="background: #1a73e8; color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 600; padding: 14px 32px; border-radius: 8px; display: inline-block; box-shadow: 0 2px 6px rgba(26,115,232,0.4);">
            ${ctaText}
          </a>
        </div>

        <div style="text-align: center; margin-top: 15px;">
          <span style="font-size: 12px; color: #5f6368;">Or join using URL:</span><br/>
          <a href="${meetingUrl}" target="_blank" rel="noopener noreferrer" style="color: #1a73e8; font-size: 13px; word-break: break-all;">
            ${meetingUrl}
          </a>
        </div>

        <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #e5e7eb; text-align: center;">
          <span style="font-size: 13px; color: #4b5563;">You can also view this chat and join the call inside the web application:</span><br/>
          <a href="${appUrl}" target="_blank" rel="noopener noreferrer" style="color: #00897b; font-weight: 600; font-size: 13px; display: inline-block; margin-top: 6px;">
            💬 Open Help Desk Web Chat
          </a>
        </div>
      </div>

      <div style="background: #f1f3f4; border-radius: 8px; padding: 16px; font-size: 13px; color: #5f6368;">
        💡 <strong>Quick Tip:</strong> Make sure your camera and microphone permissions are enabled in your browser before joining. You can also join or preview the video call directly inside the <strong>Help Desk Chat Page</strong>.
      </div>
    `),
  });
};

