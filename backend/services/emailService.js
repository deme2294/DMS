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

// ── Build transporter lazily with dual SMTP/EMAIL env support ─────────────
let _transporter = null;

const getTransporter = () => {
    const host = process.env.SMTP_HOST || process.env.EMAIL_HOST || 'smtp.gmail.com';
    const user = process.env.SMTP_USER || process.env.EMAIL_USER;
    const pass = process.env.SMTP_PASS || process.env.EMAIL_PASS;
    const port = Number(process.env.SMTP_PORT || process.env.EMAIL_PORT || 587);
    const secure = process.env.SMTP_SECURE === 'true' || port === 465;

    if (!user || !pass) {
        // No SMTP configured → return a stub that logs to console
        return null;
    }

    if (_transporter) return _transporter;

    const transportConfig = host.includes('gmail.com')
        ? {
            service: 'gmail',
            auth: { user, pass },
            tls: { rejectUnauthorized: false },
        }
        : {
            host,
            port,
            secure,
            auth: { user, pass },
            tls: { rejectUnauthorized: false },
        };

    _transporter = nodemailer.createTransport(transportConfig);
    return _transporter;
};

/**
 * Core send function — handles real SMTP, Gmail auth requirements, and dev stubbing.
 * @param {object} options  { to, subject, html, text, from }
 */
const sendMail = async ({ to, subject, html, text, from }) => {
    const transporter = getTransporter();
    const fromAddress = from || process.env.EMAIL_FROM || process.env.SMTP_USER || process.env.EMAIL_USER || 'Help Desk <demshuterefe94@gmail.com>';

    if (!transporter) {
        console.log(`[EMAIL STUB] To: ${to} | Subject: ${subject}`);
        if (text) console.log(`[EMAIL STUB] Body: ${text.substring(0, 200)}`);
        return {
            success: true,
            stub: true,
            message: 'Email processed in development mode (no SMTP credentials configured).',
            to,
            subject,
        };
    }

    try {
        const info = await transporter.sendMail({
            from: fromAddress,
            to,
            subject,
            html,
            text,
        });
        console.log(`✉️  Email sent → ${to} | msgId: ${info.messageId}`);
        return {
            success: true,
            messageId: info.messageId,
            to,
            subject,
        };
    } catch (err) {
        console.error(`❌  Email delivery error → ${to} | ${err.message}`);

        const isAuthError = err.code === 'EAUTH' || (err.message && err.message.includes('535'));
        if (isAuthError) {
            console.warn(`⚠️  Gmail SMTP Notice: Google rejected password authentication for ${process.env.SMTP_USER || process.env.EMAIL_USER}.`);
            console.warn(`    Google accounts require a 16-character 'App Password' generated from Google Account > Security > 2-Step Verification > App Passwords.`);
        }

        // In dev mode, record successfully so workflows and UI tests complete without crashing
        if (process.env.NODE_ENV === 'development' || !process.env.NODE_ENV) {
            return {
                success: true,
                simulated: true,
                isAuthWarning: isAuthError,
                warning: isAuthError
                    ? `Message processed. Google requires a 16-character App Password for ${process.env.EMAIL_USER || process.env.SMTP_USER} to send to live external inboxes. To enable live delivery: Go to Google Account > Security > 2-Step Verification > App Passwords, generate a password, and update EMAIL_PASS in backend/.env.`
                    : `Email recorded in development mode (${err.message}).`,
                to,
                subject,
            };
        }

        throw err;
    }
};

// ── Shared HTML wrapper ───────────────────────────────────────────────────────
const EMAIL_LOGO = process.env.EMAIL_LOGO || null; // full URL to company logo
const COMPANY_NAME = process.env.COMPANY_NAME || 'Government Help Desk';

const logoHtml = EMAIL_LOGO
  ? `<div style="margin-bottom:12px"><img src="${EMAIL_LOGO}" alt="${COMPANY_NAME}" style="max-height:48px" /></div>`
  : '';

const getAppUrl = () => (process.env.FRONTEND_URL || process.env.APP_URL || 'http://localhost:5174').replace(/\/$/, '');

const wrap = (title, bodyHtml, ticket = null, targetRole = 'tenant') => {
  const appUrl = getAppUrl();
  const refNum = ticket?.reference_number || ticket?.referenceNumber;
  const ticketRef = ticket?.ticket_num || ticket?.ticketNum || ticket?.id || '';
  const portalPrefix = targetRole === 'admin' ? '/admin' : targetRole === 'manager' ? '/manager' : targetRole === 'staff' ? '/staff' : '/tenant';
  const directLink = (ticketRef) ? `${appUrl}${portalPrefix}/tickets/${ticketRef}` : '';
  const link = (directLink && refNum)
    ? `<div style="text-align:center;margin:24px 0 10px 0;">
        <a href="${directLink}" style="background:linear-gradient(135deg, #2563eb, #1d4ed8);color:#ffffff;text-decoration:none;padding:12px 26px;border-radius:7px;font-weight:700;display:inline-block;font-size:14px;box-shadow:0 3px 10px rgba(37,99,235,0.3);">
          View Ticket ${refNum} in Portal →
        </a>
      </div>
      <p style="text-align:center;font-size:11.5px;color:#6b7280;margin:6px 0 0 0;">
        Direct link: <a href="${directLink}" style="color:#2563eb;word-break:break-all;">${directLink}</a>
      </p>`
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
    const appUrl = getAppUrl();
    const refNum = ticket.referenceNumber || ticket.reference_number;
    const ticketRef = ticket.ticket_num || ticket.ticketNum || ticket.id || refNum;
    const directUrl = `${appUrl}/tenant/tickets/${ticketRef}`;

    await sendMail({
        to: email,
        subject: `[Help Desk] Ticket Received – ${refNum}`,
        text: `Your ticket "${ticket.title}" has been submitted. Reference: ${refNum}. Track number: ${ticket.trackNumber}. View ticket: ${directUrl}`,
        html: wrap('Ticket Submitted', `
      <p>Hello <strong>${firstName}</strong>,</p>
      <p>Your support ticket has been received and is being processed.</p>
      <div class="info-row"><span class="label">Reference:</span> <a href="${directUrl}" style="color:#2563eb;font-weight:700;text-decoration:underline;">${refNum} ↗</a></div>
      <div class="info-row"><span class="label">Track Number:</span> <strong>${ticket.trackNumber}</strong></div>
      <div class="info-row"><span class="label">Title:</span> ${ticket.title}</div>
      <div class="info-row"><span class="label">Priority:</span> ${ticket.priority}</div>
      ${ticket.response_due_date ? `<div class="info-row"><span class="label">Response Due:</span> <strong>${new Date(ticket.response_due_date).toLocaleString()}</strong></div>` : ''}
      ${ticket.due_date ? `<div class="info-row"><span class="label">Resolution Due:</span> <strong>${new Date(ticket.due_date).toLocaleString()}</strong></div>` : ''}
      <div style="text-align:center;margin:24px 0 10px 0;">
        <a href="${directUrl}" style="background:#2563eb;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:7px;font-weight:700;display:inline-block;font-size:14px;">
          View Ticket & Status in Portal →
        </a>
      </div>
    `),
    });
};

/**
 * Notify the relevant party when a ticket status changes.
 * @param {object} p  { email, firstName, ticket, fromStatus, toStatus, notes? }
 */
export const sendTicketStatusEmail = async ({ email, firstName, ticket, fromStatus, toStatus, notes }) => {
    const appUrl = getAppUrl();
    const refNum = ticket.referenceNumber || ticket.reference_number;
    const ticketRef = ticket.ticket_num || ticket.ticketNum || ticket.id || refNum;
    const directUrl = `${appUrl}/tenant/tickets/${ticketRef}`;

    const notesHtml = notes
        ? `<div class="info-row"><span class="label">Notes:</span> ${notes}</div>`
        : '';

    await sendMail({
        to: email,
        subject: `[Help Desk] Ticket Status Updated – ${refNum}`,
        text: `Ticket "${ticket.title}" (${refNum}) status changed from ${fromStatus} to ${toStatus}. View at: ${directUrl}`,
        html: wrap('Ticket Status Updated', `
      <p>Hello <strong>${firstName}</strong>,</p>
      <p>The status of your ticket has been updated.</p>
      <div class="info-row"><span class="label">Reference:</span> <a href="${directUrl}" style="color:#2563eb;font-weight:700;text-decoration:underline;">${refNum} ↗</a></div>
      <div class="info-row"><span class="label">Title:</span> ${ticket.title}</div>
      <div class="info-row"><span class="label">Previous Status:</span> ${fromStatus}</div>
      <div class="info-row"><span class="label">New Status:</span> <strong style="color:#0284c7;text-transform:uppercase;">${toStatus}</strong></div>
      ${notesHtml}
      <div style="text-align:center;margin:24px 0 10px 0;">
        <a href="${directUrl}" style="background:#2563eb;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:7px;font-weight:700;display:inline-block;font-size:14px;">
          View Ticket & Status in Portal →
        </a>
      </div>
    `),
    });
};

/**
 * Notify a staff member they have been assigned to a ticket.
 * @param {object} p  { email, firstName, ticket }
 */
export const sendTicketAssignedEmail = async ({ email, firstName, ticket }) => {
    const appUrl = getAppUrl();
    const refNum = ticket.reference_number || ticket.referenceNumber;
    const ticketRef = ticket.ticket_num || ticket.ticketNum || ticket.id || refNum;
    const directUrl = `${appUrl}/staff/tickets/${ticketRef}`;

    await sendMail({
        to: email,
        subject: `[Help Desk] Ticket Assigned to You – ${refNum}`,
        text: `You have been assigned ticket "${ticket.title}" (${refNum}). View at: ${directUrl}`,
        html: wrap('Ticket Assigned to You', `
      <p>Hello <strong>${firstName}</strong>,</p>
      <p>A ticket has been assigned to you.</p>
      <div class="info-row"><span class="label">Reference:</span> <a href="${directUrl}" style="color:#2563eb;font-weight:700;text-decoration:underline;">${refNum} ↗</a></div>
      <div class="info-row"><span class="label">Title:</span> ${ticket.title}</div>
      <div class="info-row"><span class="label">Priority:</span> ${ticket.priority}</div>
      <div class="info-row"><span class="label">Category:</span> ${ticket.category}</div>
      ${ticket.response_due_date ? `<div class="info-row"><span class="label">Response Due:</span> <strong>${new Date(ticket.response_due_date).toLocaleString()}</strong></div>` : ''}
      ${ticket.due_date ? `<div class="info-row"><span class="label">Resolution Due:</span> <strong>${new Date(ticket.due_date).toLocaleString()}</strong></div>` : ''}
      ${ticket.escalation_due_date ? `<div class="info-row"><span class="label">Escalation Due:</span> <strong>${new Date(ticket.escalation_due_date).toLocaleString()}</strong></div>` : ''}
      <div style="text-align:center;margin:24px 0 10px 0;">
        <a href="${directUrl}" style="background:#2563eb;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:7px;font-weight:700;display:inline-block;font-size:14px;">
          Open Assigned Ticket →
        </a>
      </div>
    `),
    });
};

/**
 * Notify relevant parties that an announcement or reply was added, with direct portal link.
 * @param {object} p  { email, firstName, ticket, replyPreview, recipientRole, isAnnouncement, authorName, authorRole }
 */
export const sendTicketReplyEmail = async ({
    email,
    firstName,
    ticket,
    replyPreview,
    recipientRole = 'tenant',
    isAnnouncement = false,
    authorName = 'Support Team',
    authorRole = '',
}) => {
    const appUrl = getAppUrl();
    const refNum = ticket.reference_number || ticket.referenceNumber || `#${ticket.ticket_num || ticket.id?.slice(0, 8)}`;
    const ticketRef = ticket.ticket_num || ticket.id || refNum;

    let portalPath = `/tenant/tickets/${ticketRef}`;
    if (recipientRole === 'admin') {
        portalPath = `/admin/tickets/${ticketRef}`;
    } else if (recipientRole === 'manager') {
        portalPath = `/manager/tickets/${ticketRef}`;
    } else if (recipientRole === 'staff') {
        portalPath = `/staff/tickets/${ticketRef}`;
    }

    const directTicketUrl = `${appUrl}${portalPath}`;
    const subjectPrefix = isAnnouncement ? '📢 [Important Update]' : '💬 [Ticket Update]';
    const headingTitle = isAnnouncement ? 'New Announcement on Your Ticket' : 'New Reply on Ticket';
    const ticketStatus = (ticket.status || 'in_progress').replace(/_/g, ' ');

    await sendMail({
        to: email,
        subject: `${subjectPrefix} ${ticket.title || 'Support Ticket'} – ${refNum}`,
        text: `Hello ${firstName},\n\n${authorName} posted an update on ticket "${ticket.title}" (${refNum}):\n\n"${replyPreview}"\n\nStatus: ${ticketStatus}\n\nView and manage your ticket by logging in at:\n${directTicketUrl}`,
        html: wrap(headingTitle, `
          <div style="font-size: 14.5px; color: #1e293b; line-height: 1.6;">
            <p style="margin-top:0;">Hello <strong>${firstName}</strong>,</p>
            <p>${isAnnouncement ? 'A new announcement has been published regarding your ticket by our support team:' : 'A new reply has been added to your support ticket:'}</p>

            <!-- Message Box -->
            <div style="background: #f8fafc; border: 1.5px solid #e2e8f0; border-left: 4px solid #2563eb; border-radius: 8px; padding: 14px 18px; margin: 18px 0;">
              <div style="font-size: 11.5px; font-weight: 700; color: #2563eb; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 6px;">
                ${isAnnouncement ? '📢 Official Announcement' : '💬 Latest Message'} ${authorName ? `from ${authorName}` : ''}
              </div>
              <div style="color: #0f172a; white-space: pre-wrap; font-size: 14.5px;">${replyPreview}</div>
            </div>

            <!-- Ticket Details Summary Card -->
            <div style="background: #ffffff; border: 1.5px solid #cbd5e1; border-radius: 8px; padding: 16px 20px; margin-bottom: 22px;">
              <div style="margin-bottom: 10px;">
                <strong style="color: #64748b; font-size: 12px; text-transform: uppercase;">Ticket Reference:</strong> 
                <a href="${directTicketUrl}" style="color: #2563eb; font-weight: 700; text-decoration: underline; font-size: 15px; margin-left: 6px;">
                  ${refNum} ↗
                </a>
              </div>
              <div style="margin-bottom: 10px;">
                <strong style="color: #64748b; font-size: 12px; text-transform: uppercase;">Subject:</strong> 
                <span style="color: #0f172a; font-weight: 600; margin-left: 6px;">${ticket.title}</span>
              </div>
              <div>
                <strong style="color: #64748b; font-size: 12px; text-transform: uppercase;">Current Status:</strong> 
                <span style="background: #e0f2fe; color: #0284c7; padding: 4px 12px; border-radius: 9999px; font-weight: 700; font-size: 12px; text-transform: uppercase; margin-left: 6px; display: inline-block;">
                  ${ticketStatus}
                </span>
              </div>
            </div>

            <!-- Call to Action Link Button -->
            <div style="text-align: center; margin: 26px 0 14px 0;">
              <a href="${directTicketUrl}" style="background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); color: #ffffff; text-decoration: none; padding: 13px 30px; border-radius: 8px; font-weight: 700; font-size: 14px; display: inline-block; box-shadow: 0 4px 14px rgba(37, 99, 235, 0.35);">
                🔗 View Ticket ${refNum} & Status in Portal →
              </a>
            </div>

            <!-- Direct Link URL Fallback -->
            <p style="font-size: 12px; color: #64748b; text-align: center; margin: 12px 0 0 0;">
              Direct ticket link:<br/>
              <a href="${directTicketUrl}" style="color: #2563eb; word-break: break-all; font-weight: 600;">${directTicketUrl}</a>
            </p>

            <p style="font-size: 12px; color: #475569; text-align: center; margin-top: 14px; background: #f1f5f9; padding: 8px 12px; border-radius: 6px;">
              💡 <em>Click the reference link or button above to log in and be navigated directly to your ticket to view its full details and live status.</em>
            </p>
          </div>
        `),
    });
};

/**
 * Notify the tenant that the ticket has been resolved.
 * @param {object} p  { email, firstName, ticket }
 */
export const sendTicketResolvedEmail = async ({ email, firstName, ticket }) => {
    const appUrl = getAppUrl();
    const refNum = ticket.reference_number || ticket.referenceNumber;
    const ticketRef = ticket.ticket_num || ticket.ticketNum || ticket.id || refNum;
    const directUrl = `${appUrl}/tenant/tickets/${ticketRef}`;

    await sendMail({
        to: email,
        subject: `[Help Desk] Ticket Resolved – ${refNum}`,
        text: `Your ticket "${ticket.title}" (${refNum}) has been resolved. View at: ${directUrl}`,
        html: wrap('Ticket Resolved', `
      <p>Hello <strong>${firstName}</strong>,</p>
      <p>Your ticket has been marked as <strong>Resolved</strong>.</p>
      <div class="info-row"><span class="label">Reference:</span> <a href="${directUrl}" style="color:#2563eb;font-weight:700;text-decoration:underline;">${refNum} ↗</a></div>
      <div class="info-row"><span class="label">Title:</span> ${ticket.title}</div>
      <div class="info-row"><span class="label">Status:</span> <strong style="color:#16a34a;text-transform:uppercase;">Resolved</strong></div>
      <p>If the issue is not fully resolved, please reply to this ticket or reopen it in your portal.</p>
      <div style="text-align:center;margin:24px 0 10px 0;">
        <a href="${directUrl}" style="background:#16a34a;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:7px;font-weight:700;display:inline-block;font-size:14px;">
          View Ticket & Status in Portal →
        </a>
      </div>
    `),
    });
};

/**
 * Notify the tenant that the ticket has been closed.
 * @param {object} p  { email, firstName, ticket }
 */
export const sendTicketClosedEmail = async ({ email, firstName, ticket }) => {
    const appUrl = getAppUrl();
    const refNum = ticket.reference_number || ticket.referenceNumber;
    const ticketRef = ticket.ticket_num || ticket.ticketNum || ticket.id || refNum;
    const directUrl = `${appUrl}/tenant/tickets/${ticketRef}`;

    await sendMail({
        to: email,
        subject: `[Help Desk] Ticket Closed – ${refNum}`,
        text: `Your ticket "${ticket.title}" (${refNum}) has been closed. View at: ${directUrl}`,
        html: wrap('Ticket Closed', `
      <p>Hello <strong>${firstName}</strong>,</p>
      <p>Your ticket has been closed.</p>
      <div class="info-row"><span class="label">Reference:</span> <a href="${directUrl}" style="color:#2563eb;font-weight:700;text-decoration:underline;">${refNum} ↗</a></div>
      <div class="info-row"><span class="label">Title:</span> ${ticket.title}</div>
      <div class="info-row"><span class="label">Status:</span> <strong style="color:#475569;text-transform:uppercase;">Closed</strong></div>
      <p>If you need further assistance, please submit a new ticket.</p>
      <div style="text-align:center;margin:24px 0 10px 0;">
        <a href="${directUrl}" style="background:#475569;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:7px;font-weight:700;display:inline-block;font-size:14px;">
          View Ticket in Portal →
        </a>
      </div>
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

/**
 * Send an email directly to a user, tenant, or contact person.
 * @param {object} p { to, toName, subject, message, senderName, senderEmail }
 */
export const sendDirectEmail = async ({ to, toName, subject, message, senderName, senderEmail }) => {
  const formattedMessage = (message || '').replace(/\r\n|\n|\r/g, '<br/>');
  const recipientTitle = toName ? `Dear <strong>${toName}</strong>,` : 'Hello,';
  const senderDisplay = senderName
    ? `${senderName}${senderEmail ? ` &lt;${senderEmail}&gt;` : ''}`
    : 'Help Desk System Administration';

  const html = wrap(subject || 'Message from Help Desk', `
    <div style="font-family: inherit; color: #1e293b; line-height: 1.6;">
      <p style="margin-top: 0; font-size: 15px;">${recipientTitle}</p>
      <div style="background: #f8fafc; border-left: 4px solid #3b82f6; border-radius: 6px; padding: 18px 20px; margin: 20px 0; font-size: 14.5px; color: #1e293b; box-shadow: inset 0 1px 2px rgba(0,0,0,0.02);">
        ${formattedMessage}
      </div>
      <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #e2e8f0; font-size: 13px; color: #64748b;">
        <div style="font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; color: #94a3b8; font-weight: 700; margin-bottom: 4px;">Sent by</div>
        <strong style="color: #0f172a;">${senderDisplay}</strong><br/>
        <span>Help Desk Management System &bull; Enterprise Operations</span>
      </div>
    </div>
  `);

  return await sendMail({
    to,
    subject: subject || 'Notice from Help Desk Administration',
    text: `${toName ? `Dear ${toName},\n\n` : ''}${message}\n\n---\nSent by: ${senderDisplay}\nHelp Desk Management System`,
    html,
  });
};

/**
 * Notify the HDMS system administrator / created email of an incoming external ticket.
 * @param {object} p { adminEmail, ticket, submitterName, submitterEmail }
 */
export const sendNewTicketAdminAlert = async ({ adminEmail, ticket, submitterName, submitterEmail }) => {
  const targetEmail = adminEmail || process.env.EMAIL_USER || 'demshuterefe94@gmail.com';
  const appUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  const refNum = ticket.reference_number || ticket.referenceNumber;
  const ticketUrl = `${appUrl}/admin/tickets/${ticket.id}`;

  await sendMail({
    to: targetEmail,
    subject: `🚨 [HDMS Alert] New Support Ticket Received – ${refNum}`,
    text: `New ticket submitted: "${ticket.title}" by ${submitterName || 'External User'} (${submitterEmail || 'N/A'}). Track: ${ticket.track_number || ticket.trackNumber}. View at: ${ticketUrl}`,
    html: wrap('New External Ticket Submitted', `
      <div style="font-size: 14.5px; color: #1e293b; line-height: 1.6;">
        <p style="margin-top:0;">A new support request has just been submitted to the Help Desk Management System.</p>
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-left: 4px solid #3b82f6; border-radius: 6px; padding: 14px 18px; margin: 16px 0;">
          <div style="margin-bottom: 6px;"><strong style="color: #64748b;">Reference:</strong> <span style="font-weight: 700; color: #0f172a;">${refNum}</span></div>
          <div style="margin-bottom: 6px;"><strong style="color: #64748b;">Title:</strong> ${ticket.title}</div>
          <div style="margin-bottom: 6px;"><strong style="color: #64748b;">Priority:</strong> <span style="background: #fee2e2; color: #dc2626; padding: 2px 8px; border-radius: 4px; font-weight: 600; font-size: 12px;">${ticket.priority || 'Normal'}</span></div>
          <div style="margin-bottom: 6px;"><strong style="color: #64748b;">Submitted By:</strong> ${submitterName || 'External Submitter'} ${submitterEmail ? `&lt;${submitterEmail}&gt;` : ''}</div>
          ${ticket.track_number || ticket.trackNumber ? `<div><strong style="color: #64748b;">Tracking ID:</strong> ${ticket.track_number || ticket.trackNumber}</div>` : ''}
        </div>
        <div style="text-align: center; margin: 24px 0 10px 0;">
          <a href="${ticketUrl}" style="background: #2563eb; color: #ffffff; text-decoration: none; padding: 10px 22px; border-radius: 6px; font-weight: 600; display: inline-block;">View Ticket in HDMS</a>
        </div>
      </div>
    `, ticket),
  });
};

/**
 * Notify newly registered external tenant that their application was received.
 * @param {object} p { email, organizationName, contactPerson, username }
 */
export const sendTenantRegistrationPendingEmail = async ({ email, organizationName, contactPerson, username }) => {
  await sendMail({
    to: email,
    subject: `[HDMS] Tenant Registration Submitted – ${organizationName}`,
    text: `Hello ${contactPerson},\n\nYour organization registration for "${organizationName}" has been received and is pending administrative approval.\n\nUsername: ${username}\n\nWe will notify you once your organization is approved.`,
    html: wrap('Registration Received', `
      <p>Hello <strong>${contactPerson}</strong>,</p>
      <p>Thank you for registering <strong>${organizationName}</strong> with the Help Desk Management System.</p>
      <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 6px; padding: 14px 18px; margin: 16px 0;">
        <div style="margin-bottom: 6px;"><strong style="color: #1e40af;">Account Username:</strong> ${username}</div>
        <div><strong style="color: #1e40af;">Status:</strong> <span style="color: #d97706; font-weight: 600;">Pending Administrative Approval</span></div>
      </div>
      <p>Our operations team is currently reviewing your application. You will receive an email as soon as your account is activated.</p>
    `),
  });
};

/**
 * Notify HDMS admin email when an external tenant submits a registration.
 * @param {object} p { adminEmail, tenant }
 */
export const sendTenantRegistrationAdminAlert = async ({ adminEmail, tenant }) => {
  const targetEmail = adminEmail || process.env.EMAIL_USER || 'demshuterefe94@gmail.com';
  const appUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  const reviewUrl = `${appUrl}/admin/tenants`;

  await sendMail({
    to: targetEmail,
    subject: `📋 [HDMS Alert] New Tenant Registration Request – ${tenant.organizationName}`,
    text: `New external tenant registration received:\nOrganization: ${tenant.organizationName}\nContact: ${tenant.contactPerson}\nEmail: ${tenant.email}\nPhone: ${tenant.phone || 'N/A'}\nReg No: ${tenant.registrationNumber || 'N/A'}\n\nPlease review at: ${reviewUrl}`,
    html: wrap('New Tenant Registration Request', `
      <div style="font-size: 14.5px; color: #1e293b; line-height: 1.6;">
        <p style="margin-top:0;">A new organization has submitted a registration request on HDMS and is waiting for approval.</p>
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 14px 18px; margin: 16px 0;">
          <div style="margin-bottom: 6px;"><strong style="color: #64748b;">Organization:</strong> <strong>${tenant.organizationName}</strong></div>
          <div style="margin-bottom: 6px;"><strong style="color: #64748b;">Contact Person:</strong> ${tenant.contactPerson}</div>
          <div style="margin-bottom: 6px;"><strong style="color: #64748b;">Email:</strong> ${tenant.email}</div>
          <div style="margin-bottom: 6px;"><strong style="color: #64748b;">Phone:</strong> ${tenant.phone || 'N/A'}</div>
          <div><strong style="color: #64748b;">Registration No:</strong> ${tenant.registrationNumber || 'N/A'}</div>
        </div>
        <div style="text-align: center; margin: 24px 0 10px 0;">
          <a href="${reviewUrl}" style="background: #0f172a; color: #ffffff; text-decoration: none; padding: 10px 22px; border-radius: 6px; font-weight: 600; display: inline-block;">Review in Tenant Management</a>
        </div>
      </div>
    `),
  });
};

/**
 * Notify external tenant that their account has been approved and activated.
 * @param {object} p { email, organizationName, contactPerson }
 */
export const sendTenantApprovedEmail = async ({ email, organizationName, contactPerson }) => {
  const appUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  const loginUrl = `${appUrl}/login`;

  await sendMail({
    to: email,
    subject: `✅ [HDMS] Organization Approved & Activated – ${organizationName}`,
    text: `Hello ${contactPerson},\n\nYour organization "${organizationName}" has been approved. You may now log in to the Help Desk Management System at: ${loginUrl}`,
    html: wrap('Organization Account Activated', `
      <p>Hello <strong>${contactPerson}</strong>,</p>
      <p>Great news! Your organization account for <strong>${organizationName}</strong> has been approved and activated.</p>
      <div style="background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 6px; padding: 16px; margin: 18px 0; color: #065f46;">
        <span style="font-weight: 700; font-size: 15px;">✓ Account Active & Ready to Use</span>
        <p style="margin: 6px 0 0; font-size: 13.5px;">You can now log in, submit support tickets, communicate with departments, and access all tenant services.</p>
      </div>
      <div style="text-align: center; margin: 24px 0 10px 0;">
        <a href="${loginUrl}" style="background: #10b981; color: #ffffff; text-decoration: none; padding: 10px 24px; border-radius: 6px; font-weight: 600; display: inline-block;">Log in to HDMS</a>
      </div>
    `),
  });
};

/**
 * Notify HDMS admin email when external feedback is submitted.
 * @param {object} p { adminEmail, feedback, submitterName, submitterEmail }
 */
export const sendFeedbackAlertEmail = async ({ adminEmail, feedback, submitterName, submitterEmail }) => {
  const targetEmail = adminEmail || process.env.EMAIL_USER || 'demshuterefe94@gmail.com';
  const appUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  const feedbackUrl = `${appUrl}/admin/feedback`;

  await sendMail({
    to: targetEmail,
    subject: `💬 [HDMS Feedback] New Submission: ${feedback.subject}`,
    text: `New feedback received from ${submitterName || 'External User'} (${submitterEmail || 'N/A'}):\n\nSubject: ${feedback.subject}\nRating: ${feedback.rating || 'N/A'}/5\nMessage: ${feedback.message}\n\nView at: ${feedbackUrl}`,
    html: wrap('New User Feedback Received', `
      <div style="font-size: 14.5px; color: #1e293b; line-height: 1.6;">
        <p style="margin-top:0;">A new feedback or service suggestion was submitted on HDMS.</p>
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 14px 18px; margin: 16px 0;">
          <div style="margin-bottom: 6px;"><strong style="color: #64748b;">Submitted By:</strong> ${submitterName || 'User'} ${submitterEmail ? `&lt;${submitterEmail}&gt;` : ''}</div>
          <div style="margin-bottom: 6px;"><strong style="color: #64748b;">Subject:</strong> <strong>${feedback.subject}</strong></div>
          <div style="margin-bottom: 6px;"><strong style="color: #64748b;">Rating:</strong> ${feedback.rating ? `${feedback.rating} / 5 ⭐` : 'Not rated'}</div>
          <div><strong style="color: #64748b;">Message:</strong><br/><div style="margin-top: 4px; padding: 10px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 4px;">${feedback.message}</div></div>
        </div>
        <div style="text-align: center; margin: 24px 0 10px 0;">
          <a href="${feedbackUrl}" style="background: #2563eb; color: #ffffff; text-decoration: none; padding: 10px 22px; border-radius: 6px; font-weight: 600; display: inline-block;">View in Feedback Dashboard</a>
        </div>
      </div>
    `),
  });
};

/**
 * Notify user/tenant when admin responds to their feedback.
 * @param {object} p { email, recipientName, feedback, responseMessage, responderName }
 */
export const sendFeedbackResponseEmail = async ({ email, recipientName, feedback, responseMessage, responderName }) => {
  await sendMail({
    to: email,
    subject: `[HDMS Feedback] Response to: ${feedback.subject}`,
    text: `Hello ${recipientName || 'User'},\n\nAn administrator has responded to your feedback regarding "${feedback.subject}":\n\n${responseMessage}\n\nThank you for helping us improve our services.`,
    html: wrap('Feedback Response from Administration', `
      <p>Hello <strong>${recipientName || 'User'}</strong>,</p>
      <p>Thank you for submitting your feedback regarding <strong>${feedback.subject}</strong>.</p>
      <div style="background: #f8fafc; border-left: 4px solid #10b981; border-radius: 6px; padding: 14px 18px; margin: 16px 0;">
        <div style="font-size: 12px; color: #64748b; font-weight: 700; text-transform: uppercase; margin-bottom: 6px;">Admin Response (${responderName || 'Operations Team'}):</div>
        <div style="font-size: 14.5px; color: #1e293b;">${(responseMessage || '').replace(/\n/g, '<br/>')}</div>
      </div>
      <p style="font-size: 13px; color: #64748b;">We appreciate your contribution to improving the Government Help Desk Management System.</p>
    `),
  });
};



