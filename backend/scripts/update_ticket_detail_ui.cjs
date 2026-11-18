const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../../frontend/src/pages/Tickets/TicketDetail.tsx');
let code = fs.readFileSync(filePath, 'utf8');

// 1. Add API imports
if (!code.includes('requestOperationalEscalation')) {
  code = code.replace(
    "import {\n  changeTicketStatus,",
    "import {\n  requestOperationalEscalation, reviewOperationalEscalationManager, reviewOperationalEscalationAdmin,\n  addTicketCollaborators, removeTicketCollaborator, recordCollaboratorContribution,\n  changeTicketStatus,"
  );
  code = code.replace(
    "import {\r\n  changeTicketStatus,",
    "import {\r\n  requestOperationalEscalation, reviewOperationalEscalationManager, reviewOperationalEscalationAdmin,\r\n  addTicketCollaborators, removeTicketCollaborator, recordCollaboratorContribution,\r\n  changeTicketStatus,"
  );
}

// 2. Add state hooks
const stateHookTarget = "const [tenantRating, setTenantRating] = useState<number>(5);";
const stateHookReplacement = `const [tenantRating, setTenantRating] = useState<number>(5);
  // Operational Escalation & Collaboration states
  const [opEscalateModal, setOpEscalateModal] = useState(false);
  const [opReason, setOpReason] = useState('Specialized Technical Expertise Required');
  const [opCustomReason, setOpCustomReason] = useState('');
  const [opProblemDescription, setOpProblemDescription] = useState('');
  const [opActionsAttempted, setOpActionsAttempted] = useState('');
  const [opAssistanceRequired, setOpAssistanceRequired] = useState('');
  const [opDestination, setOpDestination] = useState<'manager' | 'admin'>('manager');
  const [opSubmitting, setOpSubmitting] = useState(false);

  const [managerReviewModal, setManagerReviewModal] = useState(false);
  const [managerDecision, setManagerDecision] = useState<'guidance' | 'reassign' | 'collaborate' | 'investigate' | 'escalate_to_admin'>('guidance');
  const [managerReviewNotes, setManagerReviewNotes] = useState('');
  const [managerNewAssigneeId, setManagerNewAssigneeId] = useState('');
  const [managerCollaboratorIds, setManagerCollaboratorIds] = useState<string[]>([]);
  const [managerReviewSubmitting, setManagerReviewSubmitting] = useState(false);

  const [adminReviewModal, setAdminReviewModal] = useState(false);
  const [adminDecision, setAdminDecision] = useState<'approved' | 'guidance' | 'reassign' | 'resource_allocated' | 'rejected'>('approved');
  const [adminReviewNotes, setAdminReviewNotes] = useState('');
  const [adminReviewSubmitting, setAdminReviewSubmitting] = useState(false);

  const [collaboratorModal, setCollaboratorModal] = useState(false);
  const [collaboratorUserIds, setCollaboratorUserIds] = useState<string[]>([]);
  const [collaboratorRole, setCollaboratorRole] = useState('Hardware Specialist');
  const [collaboratorNotes, setCollaboratorNotes] = useState('');
  const [collaboratorSubmitting, setCollaboratorSubmitting] = useState(false);

  const [contributionModal, setContributionModal] = useState(false);
  const [contributionNotes, setContributionNotes] = useState('');
  const [inPersonNotes, setInPersonNotes] = useState('');
  const [contributionSubmitting, setContributionSubmitting] = useState(false);`;

code = code.replace(stateHookTarget, stateHookReplacement);

// 3. Add handler functions
const handlerTarget = "  const closeDeptModal = () => {";
const handlerFunctions = `  const handleRequestOperationalEscalation = async () => {
    const finalReason = opReason === 'Other' ? opCustomReason.trim() : opReason;
    if (!finalReason) {
      flash('Please select or specify an escalation reason', true);
      return;
    }
    if (!opProblemDescription.trim()) {
      flash('Please describe the unresolved problem', true);
      return;
    }
    if (!opActionsAttempted.trim()) {
      flash('Please specify the actions already attempted', true);
      return;
    }
    if (!opAssistanceRequired.trim()) {
      flash('Please state the assistance or decision required', true);
      return;
    }

    setOpSubmitting(true);
    try {
      await requestOperationalEscalation(ticket.id, {
        escalationReason: finalReason,
        problemDescription: opProblemDescription.trim(),
        actionsAttempted: opActionsAttempted.trim(),
        assistanceRequired: opAssistanceRequired.trim(),
        destination: opDestination,
      });
      flash('✓ Operational escalation submitted to Department Management successfully!');
      setOpEscalateModal(false);
      setOpProblemDescription('');
      setOpActionsAttempted('');
      setOpAssistanceRequired('');
      loadTicket();
    } catch (e: any) {
      flash(e?.response?.data?.message || e.message || 'Failed to submit escalation', true);
    } finally {
      setOpSubmitting(false);
    }
  };

  const handleManagerReviewSubmit = async () => {
    if (!ticket.operationalEscalations?.length) return;
    const activeEsc = ticket.operationalEscalations.find(e => e.status === 'pending_manager') || ticket.operationalEscalations[0];
    if (!activeEsc) return;

    if (managerDecision === 'reassign' && !managerNewAssigneeId) {
      flash('Please select a new staff member to reassign', true);
      return;
    }

    setManagerReviewSubmitting(true);
    try {
      await reviewOperationalEscalationManager(ticket.id, activeEsc.id, {
        decision: managerDecision,
        notes: managerReviewNotes.trim(),
        newAssigneeId: managerNewAssigneeId || undefined,
        collaboratorIds: managerCollaboratorIds.length ? managerCollaboratorIds : undefined,
      });
      flash('✓ Department Manager review and action recorded successfully!');
      setManagerReviewModal(false);
      setManagerReviewNotes('');
      setManagerNewAssigneeId('');
      setManagerCollaboratorIds([]);
      loadTicket();
    } catch (e: any) {
      flash(e?.response?.data?.message || e.message || 'Failed to record manager review', true);
    } finally {
      setManagerReviewSubmitting(false);
    }
  };

  const handleAdminReviewSubmit = async () => {
    if (!ticket.operationalEscalations?.length) return;
    const activeEsc = ticket.operationalEscalations.find(e => e.status === 'pending_admin') || ticket.operationalEscalations[0];
    if (!activeEsc) return;

    setAdminReviewSubmitting(true);
    try {
      await reviewOperationalEscalationAdmin(ticket.id, activeEsc.id, {
        decision: adminDecision,
        notes: adminReviewNotes.trim(),
      });
      flash('✓ Admin decision recorded. Ticket returned to team for execution!');
      setAdminReviewModal(false);
      setAdminReviewNotes('');
      loadTicket();
    } catch (e: any) {
      flash(e?.response?.data?.message || e.message || 'Failed to record admin decision', true);
    } finally {
      setAdminReviewSubmitting(false);
    }
  };

  const handleAddCollaboratorsSubmit = async () => {
    if (!collaboratorUserIds.length) {
      flash('Please select at least one staff member to add as collaborator', true);
      return;
    }

    setCollaboratorSubmitting(true);
    try {
      await addTicketCollaborators(ticket.id, {
        userIds: collaboratorUserIds,
        role: collaboratorRole,
        notes: collaboratorNotes.trim() || undefined,
      });
      flash('✓ Collaborator(s) successfully assigned to collaborative work group!');
      setCollaboratorModal(false);
      setCollaboratorUserIds([]);
      setCollaboratorNotes('');
      loadTicket();
    } catch (e: any) {
      flash(e?.response?.data?.message || e.message || 'Failed to add collaborator', true);
    } finally {
      setCollaboratorSubmitting(false);
    }
  };

  const handleRecordContributionSubmit = async () => {
    if (!contributionNotes.trim() && !inPersonNotes.trim()) {
      flash('Please provide technical progress or in-person collaboration notes', true);
      return;
    }

    setContributionSubmitting(true);
    try {
      await recordCollaboratorContribution(ticket.id, {
        contributionNotes: contributionNotes.trim() || undefined,
        inPersonNotes: inPersonNotes.trim() || undefined,
      });
      flash('✓ Technical findings and collaboration progress recorded successfully!');
      setContributionModal(false);
      setContributionNotes('');
      setInPersonNotes('');
      loadTicket();
      loadReplies();
    } catch (e: any) {
      flash(e?.response?.data?.message || e.message || 'Failed to record contribution', true);
    } finally {
      setContributionSubmitting(false);
    }
  };

  const closeDeptModal = () => {`;

code = code.replace(handlerTarget, handlerFunctions);

// 4. In sidebar: add discrete SLA Status and Operational Escalation Status
const sidebarTarget = `            {ticket.escalationDueDate && (
              <div className={styles.detailItem}>
                <span className={styles.detailLabel}>
                  <ArrowTrendingUpIcon className={styles.detailLabelIcon} />
                  Escalation SLA Due
                </span>
                <span className={styles.detailValue}>
                  <div className={styles.slaContainer}>
                    <span className={styles.slaDateRow}>
                      <ClockIcon />
                      {new Date(ticket.escalationDueDate).toLocaleString()}
                    </span>
                    <span className={ticket.escalationSlaBreached ? styles.slaBadgeBreached : styles.slaBadgeOk}>
                      {ticket.escalationSlaBreached ? (
                        <>
                          <ExclamationTriangleIcon />
                          Breached
                        </>
                      ) : (
                        <>
                          <CheckCircleIcon />
                          Scheduled
                        </>
                      )}
                    </span>
                  </div>
                </span>
              </div>
            )}`;

const sidebarReplacement = `            {ticket.escalationDueDate && (
              <div className={styles.detailItem}>
                <span className={styles.detailLabel}>
                  <ArrowTrendingUpIcon className={styles.detailLabelIcon} />
                  Escalation SLA Due
                </span>
                <span className={styles.detailValue}>
                  <div className={styles.slaContainer}>
                    <span className={styles.slaDateRow}>
                      <ClockIcon />
                      {new Date(ticket.escalationDueDate).toLocaleString()}
                    </span>
                    <span className={ticket.escalationSlaBreached ? styles.slaBadgeBreached : styles.slaBadgeOk}>
                      {ticket.escalationSlaBreached ? (
                        <>
                          <ExclamationTriangleIcon />
                          Breached
                        </>
                      ) : (
                        <>
                          <CheckCircleIcon />
                          Scheduled
                        </>
                      )}
                    </span>
                  </div>
                </span>
              </div>
            )}

            {/* SLA Status (Independent Time-Based SLA Metric) */}
            <div className={styles.detailItem}>
              <span className={styles.detailLabel}>
                <BoltIcon className={styles.detailLabelIcon} />
                SLA Status
              </span>
              <span className={styles.detailValue}>
                {(() => {
                  const s = ticket.slaStatus || (ticket.isOverdue ? 'resolution_breached' : (ticket.escalationSlaBreached ? 'escalation_triggered' : (ticket.responseSlaBreached ? 'response_breached' : 'within_target')));
                  const labels: Record<string, string> = {
                    within_target: 'Within Target',
                    approaching_deadline: 'Approaching Deadline',
                    response_breached: 'First Response Breached',
                    escalation_triggered: 'SLA Escalation Triggered',
                    resolution_breached: 'Resolution Deadline Breached',
                    completed_successfully: 'SLA Met Successfully',
                  };
                  return (
                    <span className={styles['slaBadge_' + s] || styles.slaBadge_within_target}>
                      {s === 'within_target' || s === 'completed_successfully' ? '✓ ' : s.includes('breached') ? '⚠️ ' : '⏳ '}
                      {labels[s] || s}
                    </span>
                  );
                })()}
              </span>
            </div>

            {/* Operational Escalation Status (Independent Issue-Based Metric) */}
            <div className={styles.detailItem}>
              <span className={styles.detailLabel}>
                <ArrowTrendingUpIcon className={styles.detailLabelIcon} />
                Operational Escalation
              </span>
              <span className={styles.detailValue}>
                {(() => {
                  const op = ticket.operationalEscalationStatus || 'none';
                  const opLabels: Record<string, string> = {
                    none: 'Standard Workflow',
                    pending_manager: 'Pending Manager Review',
                    pending_admin: 'Pending Admin Review',
                    guidance_provided: 'Guidance Provided',
                    reassigned: 'Reassigned Following Escalation',
                    collaborative: 'Collaborative Group Active',
                    resolved: 'Operational Resolved',
                  };
                  return (
                    <span className={styles['opBadge_' + op] || styles.opBadge_none}>
                      {op === 'none' ? '📋 ' : op.startsWith('pending') ? '🚨 ' : '✨ '}
                      {opLabels[op] || op}
                    </span>
                  );
                })()}
              </span>
            </div>`;

code = code.replace(sidebarTarget.replace(/\n/g, '\r\n'), sidebarReplacement.replace(/\n/g, '\r\n'));
if (!code.includes('Operational Escalation Status (Independent Issue-Based Metric)')) {
  code = code.replace(sidebarTarget, sidebarReplacement);
}

// 5. Add Operational Escalation Banner and Team Collaboration section above comments
const bannersTarget = "{/* Under Review Banner (Staff submitted -> Pending Dept Manager Approval) */}";
const bannersReplacement = `{/* Operational Escalation Banner (Issue-based escalation) */}
        {ticket.operationalEscalationStatus && ticket.operationalEscalationStatus !== 'none' && (() => {
          const activeEsc = (ticket.operationalEscalations || [])[0];
          const isPendingMgr = ticket.operationalEscalationStatus === 'pending_manager';
          const isPendingAdm = ticket.operationalEscalationStatus === 'pending_admin';
          const canManagerReview = (role === 'manager' || role === 'admin') && isPendingMgr;
          const canAdminReview = (role === 'admin' || role === 'ceo') && isPendingAdm;

          return (
            <div className={styles.opEscalationBanner}>
              <div className={styles.opBannerHeader}>
                <div className={styles.opBannerTitle}>
                  <span>🚨</span> Operational Problem Escalation Active
                  <span className={styles['opBadge_' + ticket.operationalEscalationStatus]}>
                    {ticket.operationalEscalationStatus === 'pending_manager' ? 'Awaiting Department Manager' :
                     ticket.operationalEscalationStatus === 'pending_admin' ? 'Awaiting Administrative Intervention' :
                     ticket.operationalEscalationStatus === 'guidance_provided' ? 'Guidance Provided by Manager' :
                     ticket.operationalEscalationStatus === 'collaborative' ? 'Under Collaborative Resolution' : 'Resolved'}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {canManagerReview && (
                    <button
                      type="button"
                      className={styles.btnOperationalReview}
                      onClick={() => {
                        setManagerDecision('guidance');
                        setManagerReviewNotes('');
                        setManagerReviewModal(true);
                      }}
                    >
                      ⚡ Manager Review & Take Action
                    </button>
                  )}
                  {canAdminReview && (
                    <button
                      type="button"
                      className={styles.btnOperationalReview}
                      onClick={() => {
                        setAdminDecision('resource_allocated');
                        setAdminReviewNotes('');
                        setAdminReviewModal(true);
                      }}
                    >
                      🛡️ Admin Review & Decision
                    </button>
                  )}
                </div>
              </div>

              {activeEsc && (
                <div className={styles.opBannerMetaGrid}>
                  <div>
                    <div className={styles.opMetaItemLabel}>Escalation Reason</div>
                    <div className={styles.opMetaItemVal}><strong>{activeEsc.escalation_reason}</strong></div>
                  </div>
                  <div>
                    <div className={styles.opMetaItemLabel}>Requested By</div>
                    <div className={styles.opMetaItemVal}>{activeEsc.requesting_user_name || 'Staff Member'} ({activeEsc.department_name || 'Department'})</div>
                  </div>
                  <div>
                    <div className={styles.opMetaItemLabel}>Unresolved Issue</div>
                    <div className={styles.opMetaItemVal}>{activeEsc.problem_description}</div>
                  </div>
                  <div>
                    <div className={styles.opMetaItemLabel}>Actions Attempted</div>
                    <div className={styles.opMetaItemVal}>{activeEsc.actions_attempted}</div>
                  </div>
                  <div>
                    <div className={styles.opMetaItemLabel}>Assistance / Decision Needed</div>
                    <div className={styles.opMetaItemVal}>{activeEsc.assistance_required}</div>
                  </div>
                  {activeEsc.manager_notes && (
                    <div>
                      <div className={styles.opMetaItemLabel}>Manager Decision ({activeEsc.manager_decision})</div>
                      <div className={styles.opMetaItemVal}>{activeEsc.manager_notes}</div>
                    </div>
                  )}
                  {activeEsc.admin_notes && (
                    <div>
                      <div className={styles.opMetaItemLabel}>Admin Decision ({activeEsc.admin_decision})</div>
                      <div className={styles.opMetaItemVal}>{activeEsc.admin_notes}</div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })()}

        {/* Team Collaboration Work Group Card */}
        {((ticket.collaborators && ticket.collaborators.length > 0) || role === 'manager' || role === 'admin' || (role === 'staff' && ticket.assignedTo === user?.id)) && (
          <div className={styles.collaboratorsCard}>
            <div className={styles.collaboratorsCardHeader}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '1.2rem' }}>👥</span>
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800 }}>
                  Team Collaboration & Joint Resolution
                </h3>
                <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                  ({ticket.collaborators?.length || 0} active collaborator{ticket.collaborators?.length === 1 ? '' : 's'})
                </span>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                {(role === 'manager' || role === 'admin' || (role === 'staff' && ticket.assignedTo === user?.id)) && (
                  <button
                    type="button"
                    className={styles.btnSlate}
                    style={{ fontSize: '0.82rem', padding: '5px 11px' }}
                    onClick={() => {
                      setCollaboratorRole('Specialist');
                      setCollaboratorNotes('');
                      setCollaboratorUserIds([]);
                      setCollaboratorModal(true);
                    }}
                  >
                    + Add Staff Collaborator
                  </button>
                )}
                {(role === 'staff' || role === 'manager' || role === 'admin') && (
                  <button
                    type="button"
                    className={styles.btnInfoOutline}
                    style={{ fontSize: '0.82rem', padding: '5px 11px' }}
                    onClick={() => {
                      setContributionNotes('');
                      setInPersonNotes('');
                      setContributionModal(true);
                    }}
                  >
                    📝 Record Work & In-Person Notes
                  </button>
                )}
              </div>
            </div>

            {ticket.collaborators && ticket.collaborators.length > 0 ? (
              <div className={styles.collaboratorsList}>
                {ticket.collaborators.map((c) => (
                  <div key={c.id} className={styles.collaboratorItem}>
                    <div>
                      <div className={styles.collaboratorInfo}>
                        <div className={styles.collaboratorAvatar}>
                          {(c.first_name || 'U')[0].toUpperCase()}
                        </div>
                        <div>
                          <strong>{c.first_name} {c.last_name}</strong>
                          <span style={{ fontSize: '0.8rem', color: '#64748b', marginLeft: '6px' }}>({c.email})</span>
                          <span className={styles.collaboratorRoleChip}>{c.role || 'Collaborator'}</span>
                          {c.department_name && (
                            <span style={{ fontSize: '0.75rem', color: '#64748b', marginLeft: '6px' }}>• {c.department_name}</span>
                          )}
                        </div>
                      </div>
                      {c.notes && (
                        <div style={{ fontSize: '0.82rem', color: '#64748b', marginTop: '6px', marginLeft: '46px' }}>
                          Assignment Note: {c.notes}
                        </div>
                      )}
                      {(c.contribution_notes || c.in_person_notes) && (
                        <div className={styles.collaboratorNotesBox} style={{ marginLeft: '46px' }}>
                          {c.contribution_notes && (
                            <div style={{ marginBottom: c.in_person_notes ? '4px' : '0' }}>
                              <strong>Technical Contribution:</strong> {c.contribution_notes}
                            </div>
                          )}
                          {c.in_person_notes && (
                            <div style={{ color: '#0e7490' }}>
                              <strong>In-Person / Offline Work:</strong> {c.in_person_notes}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {(role === 'manager' || role === 'admin' || (role === 'staff' && ticket.assignedTo === user?.id)) && (
                      <button
                        type="button"
                        onClick={async () => {
                          if (window.confirm(\`Remove \${c.first_name} \${c.last_name} from ticket collaborators?\`)) {
                            await removeTicketCollaborator(ticket.id, c.user_id).catch(() => {});
                            loadTicket();
                          }
                        }}
                        style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '0.78rem' }}
                      >
                        Remove
                      </button>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ fontSize: '0.85rem', color: '#64748b', margin: 0 }}>
                No additional staff collaborators have been assigned yet. Managers and assigned staff can involve colleagues for multi-discipline resolution.
              </p>
            )}
          </div>
        )}

        {/* Under Review Banner (Staff submitted -> Pending Dept Manager Approval) */}`;

code = code.replace(bannersTarget, bannersReplacement);

// 6. Add "Request Operational Escalation" button into Action Cluster
const clusterTarget = "<button\n                        className={styles.btnSlate}\n                        onClick={() => setNoteModal(true)}";
const clusterTargetCRLF = "<button\r\n                        className={styles.btnSlate}\r\n                        onClick={() => setNoteModal(true)}";
const clusterReplacement = `{(role === 'staff' || role === 'manager' || role === 'admin') && (
                        <button
                          className={styles.btnOperationalEscalate}
                          onClick={() => {
                            setOpProblemDescription('');
                            setOpActionsAttempted('');
                            setOpAssistanceRequired('');
                            setOpCustomReason('');
                            setOpDestination(role === 'manager' ? 'admin' : 'manager');
                            setOpEscalateModal(true);
                          }}
                          title="Initiate issue-based operational escalation to Management"
                        >
                          ⚡ Request Operational Escalation
                        </button>
                      )}
                      <button
                        className={styles.btnSlate}
                        onClick={() => setNoteModal(true)}`;

code = code.replace(clusterTargetCRLF, clusterReplacement.replace(/\n/g, '\r\n'));
if (!code.includes('⚡ Request Operational Escalation')) {
  code = code.replace(clusterTarget, clusterReplacement);
}

// 7. Add Modals at bottom of file right after declineModal
const modalsTarget = "      {/* Decline Reopening Modal */}";
const modalsReplacement = `      {/* Request Operational Escalation Modal */}
      <Modal open={opEscalateModal} title="Request Operational Escalation" onClose={() => setOpEscalateModal(false)}>
        <p style={{ fontSize: '0.86rem', color: '#64748b', marginBottom: '14px', lineHeight: 1.45 }}>
          Initiate an issue-based operational escalation when this ticket requires additional technical expertise, cross-department intervention, or management guidance. This is independent of the automatic SLA timer.
        </p>

        <div className={styles.modalField}>
          <label>Escalation Reason *</label>
          <select
            value={opReason}
            onChange={(e) => setOpReason(e.target.value)}
            className={styles.replyFormSelect}
          >
            <option value="Specialized Technical Expertise Required">Specialized Technical Expertise Required</option>
            <option value="Cross-Department Dependency">Cross-Department Dependency</option>
            <option value="Hardware / Vendor Replacement Required">Hardware / Vendor Replacement Required</option>
            <option value="Policy / Management Decision Needed">Policy / Management Decision Needed</option>
            <option value="Security / Infrastructure Risk">Security / Infrastructure Risk</option>
            <option value="Other">Other (Specify below)</option>
          </select>
        </div>

        {opReason === 'Other' && (
          <div className={styles.modalField}>
            <label>Custom Escalation Reason *</label>
            <input
              type="text"
              value={opCustomReason}
              onChange={(e) => setOpCustomReason(e.target.value)}
              placeholder="e.g. Fiber optical switch port burned out"
            />
          </div>
        )}

        <div className={styles.modalField}>
          <label>Description of Unresolved Problem *</label>
          <textarea
            rows={3}
            value={opProblemDescription}
            onChange={(e) => setOpProblemDescription(e.target.value)}
            placeholder="Clearly describe the exact technical or operational obstacle preventing resolution..."
          />
        </div>

        <div className={styles.modalField}>
          <label>Actions Already Attempted *</label>
          <textarea
            rows={3}
            value={opActionsAttempted}
            onChange={(e) => setOpActionsAttempted(e.target.value)}
            placeholder="Detail all diagnostic steps, troubleshooting, and attempted fixes..."
          />
        </div>

        <div className={styles.modalField}>
          <label>Assistance or Decision Required *</label>
          <textarea
            rows={3}
            value={opAssistanceRequired}
            onChange={(e) => setOpAssistanceRequired(e.target.value)}
            placeholder="What specific guidance, resource authorization, or intervention do you need?"
          />
        </div>

        <div className={styles.modalField}>
          <label>Escalation Target</label>
          <select
            value={opDestination}
            onChange={(e) => setOpDestination(e.target.value as 'manager' | 'admin')}
            className={styles.replyFormSelect}
          >
            <option value="manager">🏢 Department Manager (Default)</option>
            {(role === 'manager' || role === 'admin') && (
              <option value="admin">🛡️ Executive Administration</option>
            )}
          </select>
        </div>

        <div className={styles.btnRow} style={{ marginTop: '16px' }}>
          <button
            type="button"
            className={styles.btnOperationalEscalate}
            disabled={opSubmitting}
            onClick={handleRequestOperationalEscalation}
          >
            {opSubmitting ? 'Submitting Escalation...' : '⚡ Submit Operational Escalation'}
          </button>
          <button
            type="button"
            className={styles.btnSlate}
            onClick={() => setOpEscalateModal(false)}
          >
            Cancel
          </button>
        </div>
      </Modal>

      {/* Department Manager Review Modal */}
      <Modal open={managerReviewModal} title="Department Manager Review & Intervention" onClose={() => setManagerReviewModal(false)}>
        <p style={{ fontSize: '0.86rem', color: '#64748b', marginBottom: '14px' }}>
          Review the operational escalation request from your assigned staff and choose an intervention path.
        </p>

        <div className={styles.modalField}>
          <label>Review Decision *</label>
          <select
            value={managerDecision}
            onChange={(e) => setManagerDecision(e.target.value as any)}
            className={styles.replyFormSelect}
          >
            <option value="guidance">💡 Provide Guidance / Instructions to Staff</option>
            <option value="reassign">🔄 Reassign to Another Qualified Staff Member</option>
            <option value="collaborate">👥 Organize Team Collaboration / Involve Staff</option>
            <option value="investigate">🔍 Request Additional Investigation</option>
            <option value="escalate_to_admin">🛡️ Escalate to Executive Admin for Intervention</option>
          </select>
        </div>

        {managerDecision === 'reassign' && (
          <div className={styles.modalField}>
            <label>Select New Staff Assignee *</label>
            <select
              value={managerNewAssigneeId}
              onChange={(e) => setManagerNewAssigneeId(e.target.value)}
              className={styles.replyFormSelect}
            >
              <option value="">Select staff user…</option>
              {staffUsers.map((s) => (
                <option key={s.id} value={s.id}>{s.firstName} {s.lastName}</option>
              ))}
            </select>
          </div>
        )}

        {managerDecision === 'collaborate' && (
          <div className={styles.modalField}>
            <label>Select Staff Collaborator</label>
            <select
              value={managerCollaboratorIds[0] || ''}
              onChange={(e) => setManagerCollaboratorIds(e.target.value ? [e.target.value] : [])}
              className={styles.replyFormSelect}
            >
              <option value="">Select staff to collaborate…</option>
              {staffUsers.map((s) => (
                <option key={s.id} value={s.id}>{s.firstName} {s.lastName}</option>
              ))}
            </select>
          </div>
        )}

        <div className={styles.modalField}>
          <label>Manager Decision Notes / Guidance *</label>
          <textarea
            rows={4}
            value={managerReviewNotes}
            onChange={(e) => setManagerReviewNotes(e.target.value)}
            placeholder="Enter instructions, decision reasoning, or required actions..."
          />
        </div>

        <div className={styles.btnRow} style={{ marginTop: '16px' }}>
          <button
            type="button"
            className={styles.btnEmerald}
            disabled={managerReviewSubmitting}
            onClick={handleManagerReviewSubmit}
          >
            {managerReviewSubmitting ? 'Recording Action...' : '✓ Record Decision'}
          </button>
          <button
            type="button"
            className={styles.btnSlate}
            onClick={() => setManagerReviewModal(false)}
          >
            Cancel
          </button>
        </div>
      </Modal>

      {/* Admin Review Modal */}
      <Modal open={adminReviewModal} title="Executive Administration Escalation Decision" onClose={() => setAdminReviewModal(false)}>
        <p style={{ fontSize: '0.86rem', color: '#64748b', marginBottom: '14px' }}>
          Provide an administrative intervention or decision for this operational escalation. The ticket will return to the working team for completion.
        </p>

        <div className={styles.modalField}>
          <label>Administrative Decision *</label>
          <select
            value={adminDecision}
            onChange={(e) => setAdminDecision(e.target.value as any)}
            className={styles.replyFormSelect}
          >
            <option value="resource_allocated">📦 Resource Allocated / Budget Approved</option>
            <option value="guidance">💡 Executive Guidance & Directives</option>
            <option value="approved">✅ Operational Escalation Approved</option>
            <option value="reassign">🔄 Cross-Department Reassignment</option>
            <option value="rejected">❌ Escalation Rejected / Return to Standard Workflow</option>
          </select>
        </div>

        <div className={styles.modalField}>
          <label>Admin Decision Notes & Directives *</label>
          <textarea
            rows={4}
            value={adminReviewNotes}
            onChange={(e) => setAdminReviewNotes(e.target.value)}
            placeholder="Specify authorized resources, procurement numbers, cross-department directives..."
          />
        </div>

        <div className={styles.btnRow} style={{ marginTop: '16px' }}>
          <button
            type="button"
            className={styles.btnEmerald}
            disabled={adminReviewSubmitting}
            onClick={handleAdminReviewSubmit}
          >
            {adminReviewSubmitting ? 'Applying Decision...' : '✓ Submit Admin Decision'}
          </button>
          <button
            type="button"
            className={styles.btnSlate}
            onClick={() => setAdminReviewModal(false)}
          >
            Cancel
          </button>
        </div>
      </Modal>

      {/* Add Collaborator Modal */}
      <Modal open={collaboratorModal} title="Involve Team Collaborator" onClose={() => setCollaboratorModal(false)}>
        <p style={{ fontSize: '0.86rem', color: '#64748b', marginBottom: '14px' }}>
          Assign an additional qualified staff member to work cooperatively on resolving this ticket.
        </p>

        <div className={styles.modalField}>
          <label>Select Staff Member *</label>
          <select
            value={collaboratorUserIds[0] || ''}
            onChange={(e) => setCollaboratorUserIds(e.target.value ? [e.target.value] : [])}
            className={styles.replyFormSelect}
          >
            <option value="">Choose staff member…</option>
            {staffUsers.map((s) => (
              <option key={s.id} value={s.id}>{s.firstName} {s.lastName}</option>
            ))}
          </select>
        </div>

        <div className={styles.modalField}>
          <label>Collaboration Role / Discipline</label>
          <input
            type="text"
            value={collaboratorRole}
            onChange={(e) => setCollaboratorRole(e.target.value)}
            placeholder="e.g. Hardware Specialist, Network Advisor, Diagnostic Assistant"
          />
        </div>

        <div className={styles.modalField}>
          <label>Assignment Instructions / Notes</label>
          <textarea
            rows={3}
            value={collaboratorNotes}
            onChange={(e) => setCollaboratorNotes(e.target.value)}
            placeholder="Specific tasks or areas for this team member to focus on..."
          />
        </div>

        <div className={styles.btnRow} style={{ marginTop: '16px' }}>
          <button
            type="button"
            className={styles.btnEmerald}
            disabled={collaboratorSubmitting || !collaboratorUserIds.length}
            onClick={handleAddCollaboratorsSubmit}
          >
            {collaboratorSubmitting ? 'Assigning...' : '👥 Add Collaborator'}
          </button>
          <button
            type="button"
            className={styles.btnSlate}
            onClick={() => setCollaboratorModal(false)}
          >
            Cancel
          </button>
        </div>
      </Modal>

      {/* Record Contribution Modal */}
      <Modal open={contributionModal} title="Record Technical Findings & In-Person Collaboration" onClose={() => setContributionModal(false)}>
        <p style={{ fontSize: '0.86rem', color: '#64748b', marginBottom: '14px' }}>
          Record technical progress, diagnostic findings, or in-person / offline teamwork. An internal progress record will be updated on the ticket.
        </p>

        <div className={styles.modalField}>
          <label>Technical Progress / Diagnostic Findings</label>
          <textarea
            rows={4}
            value={contributionNotes}
            onChange={(e) => setContributionNotes(e.target.value)}
            placeholder="Detail technical work completed, tests executed, component status..."
          />
        </div>

        <div className={styles.modalField}>
          <label>In-Person / Offline Coordination Notes</label>
          <textarea
            rows={3}
            value={inPersonNotes}
            onChange={(e) => setInPersonNotes(e.target.value)}
            placeholder="e.g. Coordinated in server room with Yesuf at 11:00 AM; swapped power distribution unit..."
          />
        </div>

        <div className={styles.btnRow} style={{ marginTop: '16px' }}>
          <button
            type="button"
            className={styles.btnEmerald}
            disabled={contributionSubmitting || (!contributionNotes.trim() && !inPersonNotes.trim())}
            onClick={handleRecordContributionSubmit}
          >
            {contributionSubmitting ? 'Recording...' : '📝 Save Progress'}
          </button>
          <button
            type="button"
            className={styles.btnSlate}
            onClick={() => setContributionModal(false)}
          >
            Cancel
          </button>
        </div>
      </Modal>

      {/* Decline Reopening Modal */}`;

code = code.replace(modalsTarget, modalsReplacement);

fs.writeFileSync(filePath, code, 'utf8');
console.log('Successfully updated TicketDetail.tsx UI');
