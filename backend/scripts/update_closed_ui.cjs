const fs = require('fs');
const path = require('path');

// 1. Update TicketDetail.tsx
const tdPath = path.join(__dirname, '../../frontend/src/pages/Tickets/TicketDetail.tsx');
let td = fs.readFileSync(tdPath, 'utf8');

// Replace Ticket Actions Locked block
const tdLockedOld = `          if (isClosed) {
            return (
              <div className={styles.card} style={{ borderLeft: '4px solid #64748b' }}>
                <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px', color: '#334155' }}>
                  <span>🔒</span> Ticket Actions Locked
                </h3>
                <p style={{ color: '#64748b', fontSize: '14px', margin: '8px 0 0' }}>
                  This ticket is <strong>Closed (Inactive)</strong>. Normal processing, assignments, reassignments, and status modifications are disabled.
                  {(ticket.reopenStatus === 'requested' || ticket.reopen_status === 'requested') ? ' A tenant reopening request is currently pending review below.' : ''}
                </p>
              </div>
            );
          }`;

const tdLockedNew = `          if (isClosed) {
            return (
              <div className={styles.closedCard}>
                <div className={styles.closedCardHeader}>
                  <h3 className={styles.closedCardTitle}>
                    <span className={styles.closedCardIconWrapper}>🔒</span> Ticket Actions Locked
                  </h3>
                  <span className={styles.closedCardBadge}>Read-Only</span>
                </div>
                <p className={styles.closedCardText}>
                  This ticket is <strong>Closed (Inactive)</strong>. Normal processing, assignments, reassignments, and status modifications are disabled.
                  {(ticket.reopenStatus === 'requested' || ticket.reopen_status === 'requested') ? ' A tenant reopening request is currently pending review below.' : ''}
                </p>
              </div>
            );
          }`;

td = td.replace(tdLockedOld.replace(/\n/g, '\r\n'), tdLockedNew.replace(/\n/g, '\r\n'));
if (!td.includes('styles.closedCardIconWrapper')) {
  td = td.replace(tdLockedOld, tdLockedNew);
}

// Replace Closed Card block in TicketDetail.tsx
const tdClosedOld = `        {/* Closed & Inactive Status Card with Reopening Workflow */}
        {(ticket.status === 'closed' || ticket.status === 'completed') && (
          <div className={styles.card} style={{ borderLeft: '4px solid #64748b' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px', color: '#1e293b' }}>
                <span>🔒</span> Ticket Closed (Inactive)
              </h3>
              <span style={{ fontSize: '12px', fontWeight: 700, padding: '4px 10px', borderRadius: '12px', background: '#f1f5f9', color: '#475569', textTransform: 'uppercase' }}>
                Read-Only
              </span>
            </div>
            <p style={{ color: '#475569', fontSize: '14px', margin: '6px 0 14px' }}>
              All work has been completed and the issue was confirmed resolved by the tenant. This ticket is officially closed and inactive. Normal processing, assignments, and status modifications are disabled.
            </p>

            {/* Pending Reopening Request Box */}
            {(ticket.reopenStatus === 'requested' || ticket.reopen_status === 'requested') && (
              <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '8px', padding: '16px', marginTop: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, color: '#92400e', fontSize: '15px' }}>
                    <span>⏳</span> Reopening Request from Tenant (Pending Approval)
                  </div>
                  <span style={{ fontSize: '12px', fontWeight: 600, padding: '2px 8px', borderRadius: '10px', background: '#fef3c7', color: '#b45309' }}>
                    Awaiting Review
                  </span>
                </div>
                <div style={{ background: '#ffffff', border: '1px solid #fed7aa', borderRadius: '6px', padding: '12px', marginBottom: '10px' }}>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: '#9a3412', textTransform: 'uppercase', marginBottom: '4px' }}>
                    Reason for Reopening:
                  </div>
                  <div style={{ fontSize: '14px', color: '#1c1917', lineHeight: 1.5 }}>
                    {(ticket.reopenRequestReason || ticket.reopen_request_reason || 'No details provided')}
                  </div>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', fontSize: '12px', color: '#78350f', marginBottom: '12px' }}>
                  {(ticket.reopenRequestedAt || ticket.reopen_requested_at) && (
                    <div>
                      <strong>Requested:</strong> {new Date(ticket.reopenRequestedAt || ticket.reopen_requested_at || '').toLocaleString()}
                    </div>
                  )}
                  {(ticket.reopenRequestedByName || ticket.reopen_requested_by_name) && (
                    <div>
                      <strong>Requester:</strong> {ticket.reopenRequestedByName || ticket.reopen_requested_by_name}
                    </div>
                  )}
                </div>

                {/* Manager / Admin Review Actions */}
                {(role === 'admin' || role === 'ceo' || role === 'manager') && (() => {
                  const isAuthorizedManager = role === 'admin' || role === 'ceo' || (
                    role === 'manager' && (
                      !ticket.departmentId ||
                      ticket.departmentId === (user as any)?.department_id ||
                      (user as any)?.departments?.some((d: any) => d.id === ticket.departmentId || d === ticket.departmentId)
                    )
                  );

                  if (!isAuthorizedManager) {
                    return (
                      <div style={{ fontSize: '13px', color: '#b45309', fontStyle: 'italic', background: '#fef3c7', padding: '8px 12px', borderRadius: '6px' }}>
                        ℹ️ Reopening approval for this ticket is restricted to the assigned Department Manager or System Administrator.
                      </div>
                    );
                  }

                  return (
                    <div style={{ display: 'flex', gap: '12px', marginTop: '10px' }}>
                      <button
                        type="button"
                        className={styles.btnApprove}
                        onClick={() => call(() => approveReopenTicket(ticket.id), 'Ticket Reopening Approved! Active processing resumed.')}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 16px', fontWeight: 600 }}
                      >
                        <CheckCircleIcon style={{ width: 18, height: 18 }} />
                        Approve Reopening
                      </button>
                      <button
                        type="button"
                        className={styles.btnReject}
                        onClick={() => {
                          setDeclineReason('');
                          setDeclineModal(true);
                        }}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 16px', fontWeight: 600 }}
                      >
                        <XMarkIcon style={{ width: 18, height: 18 }} />
                        Decline Request
                      </button>
                    </div>
                  );
                })()}

                {/* Tenant pending notice */}
                {role === 'tenant' && (
                  <div style={{ fontSize: '13px', color: '#92400e', fontStyle: 'italic' }}>
                    Your reopening request has been delivered to management and is awaiting review. You will receive a notification once a decision is made.
                  </div>
                )}
              </div>
            )}

            {/* Declined notice if previously rejected */}
            {(ticket.reopenStatus === 'rejected' || ticket.reopen_status === 'rejected') && (
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '12px', marginTop: '10px', fontSize: '13px', color: '#991b1b' }}>
                ℹ️ Previous reopening request was reviewed and declined. The ticket remains closed.
              </div>
            )}

            {/* Tenant Request Reopen Button (if not already requested) */}
            {role === 'tenant' && ticket.reopenStatus !== 'requested' && ticket.reopen_status !== 'requested' && (
              <div style={{ marginTop: '14px' }}>
                <button
                  type="button"
                  className={styles.btnAmber}
                  onClick={() => { setReopenReason(''); setReopenModal(true); }}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 16px', fontWeight: 600 }}
                >
                  <ArrowPathIcon style={{ width: 16, height: 16 }} />
                  Request Ticket Reopening
                </button>
                <div style={{ fontSize: '12px', color: '#64748b', marginTop: '6px' }}>
                  If the issue remains unfinished, unresolved, or requires further attention, you can request reopening for review by management.
                </div>
              </div>
            )}
          </div>
        )}`;

const tdClosedNew = `        {/* Closed & Inactive Status Card with Reopening Workflow */}
        {(ticket.status === 'closed' || ticket.status === 'completed') && (
          <div className={styles.closedCard}>
            <div className={styles.closedCardHeader}>
              <h3 className={styles.closedCardTitle}>
                <span className={styles.closedCardIconWrapper}>🔒</span> Ticket Closed (Inactive)
              </h3>
              <span className={styles.closedCardBadge}>
                Read-Only
              </span>
            </div>
            <p className={styles.closedCardText}>
              All work has been completed and the issue was confirmed resolved by the tenant. This ticket is officially closed and inactive. Normal processing, assignments, and status modifications are disabled.
            </p>

            {/* Pending Reopening Request Box */}
            {(ticket.reopenStatus === 'requested' || ticket.reopen_status === 'requested') && (
              <div className={styles.reopenAlertContainer}>
                <div className={styles.reopenAlertHeader}>
                  <div className={styles.reopenAlertTitle}>
                    <span>⏳</span> Reopening Request from Tenant (Pending Approval)
                  </div>
                  <span className={styles.reopenAlertBadge}>
                    Awaiting Review
                  </span>
                </div>
                <div className={styles.reopenReasonBox}>
                  <div className={styles.reopenReasonLabel}>
                    Reason for Reopening:
                  </div>
                  <div className={styles.reopenReasonText}>
                    {(ticket.reopenRequestReason || ticket.reopen_request_reason || 'No details provided')}
                  </div>
                </div>
                <div className={styles.reopenMetaRow}>
                  {(ticket.reopenRequestedAt || ticket.reopen_requested_at) && (
                    <div className={styles.reopenMetaItem}>
                      <strong>Requested:</strong> {new Date(ticket.reopenRequestedAt || ticket.reopen_requested_at || '').toLocaleString()}
                    </div>
                  )}
                  {(ticket.reopenRequestedByName || ticket.reopen_requested_by_name) && (
                    <div className={styles.reopenMetaItem}>
                      <strong>Requester:</strong> {ticket.reopenRequestedByName || ticket.reopen_requested_by_name}
                    </div>
                  )}
                </div>

                {/* Manager / Admin Review Actions */}
                {(role === 'admin' || role === 'ceo' || role === 'manager') && (() => {
                  const isAuthorizedManager = role === 'admin' || role === 'ceo' || (
                    role === 'manager' && (
                      !ticket.departmentId ||
                      ticket.departmentId === (user as any)?.department_id ||
                      (user as any)?.departments?.some((d: any) => d.id === ticket.departmentId || d === ticket.departmentId)
                    )
                  );

                  if (!isAuthorizedManager) {
                    return (
                      <div className={styles.reopenRestrictedNotice}>
                        ℹ️ Reopening approval for this ticket is restricted to the assigned Department Manager or System Administrator.
                      </div>
                    );
                  }

                  return (
                    <div style={{ display: 'flex', gap: '12px', marginTop: '10px' }}>
                      <button
                        type="button"
                        className={styles.btnApprove}
                        onClick={() => call(() => approveReopenTicket(ticket.id), 'Ticket Reopening Approved! Active processing resumed.')}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 16px', fontWeight: 600 }}
                      >
                        <CheckCircleIcon style={{ width: 18, height: 18 }} />
                        Approve Reopening
                      </button>
                      <button
                        type="button"
                        className={styles.btnReject}
                        onClick={() => {
                          setDeclineReason('');
                          setDeclineModal(true);
                        }}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 16px', fontWeight: 600 }}
                      >
                        <XMarkIcon style={{ width: 18, height: 18 }} />
                        Decline Request
                      </button>
                    </div>
                  );
                })()}

                {/* Tenant pending notice */}
                {role === 'tenant' && (
                  <div className={styles.reopenTenantPendingNotice}>
                    Your reopening request has been delivered to management and is awaiting review. You will receive a notification once a decision is made.
                  </div>
                )}
              </div>
            )}

            {/* Declined notice if previously rejected */}
            {(ticket.reopenStatus === 'rejected' || ticket.reopen_status === 'rejected') && (
              <div className={styles.reopenDeclinedNotice}>
                ℹ️ Previous reopening request was reviewed and declined. The ticket remains closed.
              </div>
            )}

            {/* Tenant Request Reopen Button (if not already requested) */}
            {role === 'tenant' && ticket.reopenStatus !== 'requested' && ticket.reopen_status !== 'requested' && (
              <div style={{ marginTop: '14px' }}>
                <button
                  type="button"
                  className={styles.btnAmber}
                  onClick={() => { setReopenReason(''); setReopenModal(true); }}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 16px', fontWeight: 600 }}
                >
                  <ArrowPathIcon style={{ width: 16, height: 16 }} />
                  Request Ticket Reopening
                </button>
                <div className={styles.reopenTenantHelpText}>
                  If the issue remains unfinished, unresolved, or requires further attention, you can request reopening for review by management.
                </div>
              </div>
            )}
          </div>
        )}`;

td = td.replace(tdClosedOld.replace(/\n/g, '\r\n'), tdClosedNew.replace(/\n/g, '\r\n'));
if (!td.includes('styles.closedCardTitle')) {
  td = td.replace(tdClosedOld, tdClosedNew);
}

fs.writeFileSync(tdPath, td, 'utf8');
console.log('Successfully updated TicketDetail.tsx with high-contrast closedCard');

// 2. Update CeoTicketDetail.tsx
const ceoPath = path.join(__dirname, '../../frontend/src/pages/Tickets/CeoTicketDetail.tsx');
let ceo = fs.readFileSync(ceoPath, 'utf8');

const ceoLockedOld = `      if (isClosed) {
        return (
          <div className={styles.card} style={{ borderLeft: '4px solid #64748b' }}>
            <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px', color: '#334155' }}>
              <span>🔒</span> Ticket Actions Locked
            </h3>
            <p style={{ color: '#64748b', fontSize: '14px', margin: '8px 0 0' }}>
              This ticket is <strong>Closed (Inactive)</strong>. Normal processing, assignments, reassignments, and status modifications are disabled.
            </p>
          </div>
        );
      }`;

const ceoLockedNew = `      if (isClosed) {
        return (
          <div className={styles.closedCard}>
            <div className={styles.closedCardHeader}>
              <h3 className={styles.closedCardTitle}>
                <span className={styles.closedCardIconWrapper}>🔒</span> Ticket Actions Locked
              </h3>
              <span className={styles.closedCardBadge}>Read-Only</span>
            </div>
            <p className={styles.closedCardText}>
              This ticket is <strong>Closed (Inactive)</strong>. Normal processing, assignments, reassignments, and status modifications are disabled.
            </p>
          </div>
        );
      }`;

ceo = ceo.replace(ceoLockedOld.replace(/\n/g, '\r\n'), ceoLockedNew.replace(/\n/g, '\r\n'));
if (!ceo.includes('styles.closedCardIconWrapper')) {
  ceo = ceo.replace(ceoLockedOld, ceoLockedNew);
}

const ceoClosedOld = `      {/* Closed & Inactive Status Card */}
      {(ticket.status === 'closed' || ticket.status === 'completed') && (
        <div className={styles.card} style={{ borderLeft: '4px solid #64748b' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px', color: '#1e293b' }}>
              <span>🔒</span> Ticket Closed (Inactive)
            </h3>
            <span style={{ fontSize: '12px', fontWeight: 700, padding: '4px 10px', borderRadius: '12px', background: '#f1f5f9', color: '#475569', textTransform: 'uppercase' }}>
              Read-Only
            </span>
          </div>
          <p style={{ color: '#475569', fontSize: '14px', margin: '6px 0 14px' }}>
            All work has been completed and verified. This ticket is closed and inactive. Normal processing, assignments, and status modifications are disabled.
          </p>`;

const ceoClosedNew = `      {/* Closed & Inactive Status Card */}
      {(ticket.status === 'closed' || ticket.status === 'completed') && (
        <div className={styles.closedCard}>
          <div className={styles.closedCardHeader}>
            <h3 className={styles.closedCardTitle}>
              <span className={styles.closedCardIconWrapper}>🔒</span> Ticket Closed (Inactive)
            </h3>
            <span className={styles.closedCardBadge}>
              Read-Only
            </span>
          </div>
          <p className={styles.closedCardText}>
            All work has been completed and verified. This ticket is closed and inactive. Normal processing, assignments, and status modifications are disabled.
          </p>`;

ceo = ceo.replace(ceoClosedOld.replace(/\n/g, '\r\n'), ceoClosedNew.replace(/\n/g, '\r\n'));
if (!ceo.includes('styles.closedCardHeader')) {
  ceo = ceo.replace(ceoClosedOld, ceoClosedNew);
}

fs.writeFileSync(ceoPath, ceo, 'utf8');
console.log('Successfully updated CeoTicketDetail.tsx with high-contrast closedCard');
