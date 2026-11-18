const fs = require('fs');
const path = require('path');

const cssRules = `
/* ==========================================================================
   Ticket Closed & Locked Status Sections (Professional, High-Contrast UI)
   ========================================================================== */

.closedCard {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-left: 5px solid #64748b !important;
  border-radius: 12px;
  padding: 22px 26px;
  margin-bottom: 24px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.04);
  position: relative;
  overflow: hidden;
}

:global([data-theme="dark"]) .closedCard,
:global(.dark) .closedCard {
  background: linear-gradient(145deg, #131b2e 0%, #0f172a 100%) !important;
  border: 1px solid #1e293b !important;
  border-left: 5px solid #94a3b8 !important;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
}

.closedCardHeader {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
  gap: 12px;
  flex-wrap: wrap;
}

.closedCardTitle {
  margin: 0;
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 1.25rem;
  font-weight: 800;
  color: #0f172a;
  letter-spacing: -0.3px;
}

:global([data-theme="dark"]) .closedCardTitle,
:global(.dark) .closedCardTitle {
  color: #f8fafc !important;
}

.closedCardIconWrapper {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: #f1f5f9;
  font-size: 1.1rem;
}

:global([data-theme="dark"]) .closedCardIconWrapper,
:global(.dark) .closedCardIconWrapper {
  background: rgba(148, 163, 184, 0.15) !important;
  border: 1px solid rgba(148, 163, 184, 0.25);
}

.closedCardBadge {
  font-size: 0.72rem;
  font-weight: 800;
  padding: 4px 12px;
  border-radius: 9999px;
  background: #e2e8f0;
  color: #334155;
  letter-spacing: 0.8px;
  text-transform: uppercase;
  border: 1px solid #cbd5e1;
}

:global([data-theme="dark"]) .closedCardBadge,
:global(.dark) .closedCardBadge {
  background: rgba(148, 163, 184, 0.22) !important;
  color: #f1f5f9 !important;
  border-color: rgba(148, 163, 184, 0.45) !important;
}

.closedCardText {
  color: #334155;
  font-size: 0.95rem;
  line-height: 1.6;
  margin: 0 0 16px 0;
}

:global([data-theme="dark"]) .closedCardText,
:global(.dark) .closedCardText {
  color: #e2e8f0 !important;
}

/* Reopening Request Alert Container */
.reopenAlertContainer {
  background: #fffbeb;
  border: 1px solid #fde68a;
  border-left: 4px solid #f59e0b;
  border-radius: 10px;
  padding: 18px 20px;
  margin-top: 16px;
}

:global([data-theme="dark"]) .reopenAlertContainer,
:global(.dark) .reopenAlertContainer {
  background: rgba(245, 158, 11, 0.12) !important;
  border: 1px solid rgba(245, 158, 11, 0.35) !important;
  border-left: 4px solid #f59e0b !important;
}

.reopenAlertHeader {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
  gap: 10px;
  flex-wrap: wrap;
}

.reopenAlertTitle {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 800;
  color: #92400e;
  font-size: 1rem;
}

:global([data-theme="dark"]) .reopenAlertTitle,
:global(.dark) .reopenAlertTitle {
  color: #fde68a !important;
}

.reopenAlertBadge {
  font-size: 0.72rem;
  font-weight: 700;
  padding: 3px 9px;
  border-radius: 9999px;
  background: #fef3c7;
  color: #b45309;
  border: 1px solid #fde68a;
}

:global([data-theme="dark"]) .reopenAlertBadge,
:global(.dark) .reopenAlertBadge {
  background: rgba(245, 158, 11, 0.22) !important;
  color: #fde68a !important;
  border-color: rgba(245, 158, 11, 0.45) !important;
}

.reopenReasonBox {
  background: #ffffff;
  border: 1px solid #fed7aa;
  border-radius: 8px;
  padding: 14px 16px;
  margin-bottom: 14px;
}

:global([data-theme="dark"]) .reopenReasonBox,
:global(.dark) .reopenReasonBox {
  background: #0b1329 !important;
  border: 1px solid rgba(245, 158, 11, 0.3) !important;
}

.reopenReasonLabel {
  font-size: 0.74rem;
  font-weight: 700;
  color: #9a3412;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 6px;
}

:global([data-theme="dark"]) .reopenReasonLabel,
:global(.dark) .reopenReasonLabel {
  color: #fb923c !important;
}

.reopenReasonText {
  font-size: 0.93rem;
  color: #1e293b;
  line-height: 1.55;
  font-weight: 500;
}

:global([data-theme="dark"]) .reopenReasonText,
:global(.dark) .reopenReasonText {
  color: #f1f5f9 !important;
}

.reopenMetaRow {
  display: flex;
  flex-wrap: wrap;
  gap: 18px;
  font-size: 0.82rem;
  color: #78350f;
  margin-bottom: 14px;
}

:global([data-theme="dark"]) .reopenMetaRow,
:global(.dark) .reopenMetaRow {
  color: #fde68a !important;
}

.reopenRestrictedNotice {
  font-size: 0.85rem;
  color: #b45309;
  font-style: italic;
  background: #fef3c7;
  padding: 10px 14px;
  border-radius: 8px;
  border: 1px solid #fde68a;
}

:global([data-theme="dark"]) .reopenRestrictedNotice,
:global(.dark) .reopenRestrictedNotice {
  background: rgba(245, 158, 11, 0.18) !important;
  color: #fef08a !important;
  border-color: rgba(245, 158, 11, 0.35) !important;
}

.reopenTenantPendingNotice {
  font-size: 0.88rem;
  color: #92400e;
  font-style: italic;
  line-height: 1.5;
}

:global([data-theme="dark"]) .reopenTenantPendingNotice,
:global(.dark) .reopenTenantPendingNotice {
  color: #fef08a !important;
}

.reopenDeclinedNotice {
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 8px;
  padding: 12px 16px;
  margin-top: 12px;
  font-size: 0.88rem;
  color: #991b1b;
  line-height: 1.5;
}

:global([data-theme="dark"]) .reopenDeclinedNotice,
:global(.dark) .reopenDeclinedNotice {
  background: rgba(239, 68, 68, 0.15) !important;
  border-color: rgba(239, 68, 68, 0.35) !important;
  color: #fca5a5 !important;
}

.reopenTenantHelpText {
  font-size: 0.82rem;
  color: #64748b;
  margin-top: 8px;
  line-height: 1.45;
}

:global([data-theme="dark"]) .reopenTenantHelpText,
:global(.dark) .reopenTenantHelpText {
  color: #94a3b8 !important;
}
`;

const files = [
  path.join(__dirname, '../../frontend/src/pages/Tickets/Tickets.module.css'),
  path.join(__dirname, '../../frontend/src/pages/Tickets/CeoTickets.module.css'),
];

for (const f of files) {
  if (fs.existsSync(f)) {
    let content = fs.readFileSync(f, 'utf8');
    if (!content.includes('.closedCard {')) {
      content += '\n' + cssRules;
      fs.writeFileSync(f, content, 'utf8');
      console.log('Appended closedCard styles to:', f);
    }
  }
}
