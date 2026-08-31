import { useEffect, useState } from 'react';
import PageHeader from '../../components/PageHeader/PageHeader';
import {
  fetchCeoDepartmentPerformance,
  fetchCeoStaffPerformance,
  fetchCeoSystemStats,
  fetchTicketStats,
  type CeoDepartmentPerformance,
  type CeoStaffPerformance,
  type CeoSystemStats,
  type TicketStatistics,
} from '../../api/dashboardApi';
import styles from './CeoDashboard.module.css';

const PRIORITY_COLORS: Record<string, string> = {
  low: '#3b82f6', medium: '#eab308', high: '#f97316', urgent: '#ef4444',
};

export default function CeoAnalytics() {
  const [dept, setDept] = useState<CeoDepartmentPerformance[]>([]);
  const [staff, setStaff] = useState<CeoStaffPerformance[]>([]);
  const [sys, setSys] = useState<CeoSystemStats | null>(null);
  const [tstats, setTstats] = useState<TicketStatistics | null>(null);

  useEffect(() => {
    Promise.all([
      fetchCeoDepartmentPerformance(),
      fetchCeoStaffPerformance(),
      fetchCeoSystemStats(),
      fetchTicketStats(),
    ])
      .then(([d, s, sy, t]) => {
        setDept(d.data.data);
        setStaff(s.data.data);
        setSys(sy.data.data);
        setTstats(t.data.data);
      })
      .catch(() => {});
  }, []);

  const bestDepts = [...dept].sort((a, b) => b.performance - a.performance).slice(0, 3);
  const lowDepts = [...dept].sort((a, b) => a.performance - b.performance).slice(0, 3);
  const topStaff = [...staff].sort((a, b) => Number(b.completed_tickets) - Number(a.completed_tickets)).slice(0, 5);

  return (
    <div className={styles.page}>
      <PageHeader title="Executive Analytics" description="Organization-wide performance and trends" />

      <div className={styles.summaryGrid}>
        {tstats && (
          <>
            <div className={`${styles.summaryCard} ${styles.gold}`}><div className={styles.summaryValue}>{tstats.total}</div><div className={styles.summaryLabel}>Total Tickets</div></div>
            <div className={`${styles.summaryCard} ${styles.blue}`}><div className={styles.summaryValue}>{tstats.overdue}</div><div className={styles.summaryLabel}>Overdue</div></div>
            <div className={`${styles.summaryCard} ${styles.green}`}><div className={styles.summaryValue}>{tstats.resolved}</div><div className={styles.summaryLabel}>Resolved</div></div>
            <div className={`${styles.summaryCard} ${styles.amber}`}><div className={styles.summaryValue}>{tstats.avgResolutionHours}h</div><div className={styles.summaryLabel}>Avg Resolution</div></div>
          </>
        )}
        {sys && (
          <>
            <div className={`${styles.summaryCard} ${styles.blue}`}><div className={styles.summaryValue}>{sys.daily}</div><div className={styles.summaryLabel}>Daily Activities</div></div>
            <div className={`${styles.summaryCard} ${styles.blue}`}><div className={styles.summaryValue}>{sys.monthly}</div><div className={styles.summaryLabel}>Monthly Activities</div></div>
            <div className={`${styles.summaryCard} ${styles.green}`}><div className={styles.summaryValue}>{sys.newUsers}</div><div className={styles.summaryLabel}>New Users (30d)</div></div>
            <div className={`${styles.summaryCard} ${styles.gold}`}><div className={styles.summaryValue}>{sys.resolvedThisMonth}</div><div className={styles.summaryLabel}>Resolved (30d)</div></div>
          </>
        )}
      </div>

      <div className={styles.twoCol}>
        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>Best Performing Departments</h3>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead><tr><th>Department</th><th>Performance</th></tr></thead>
              <tbody>
                {bestDepts.map((d) => (
                  <tr key={d.id}><td className={styles.strong}>{d.department_name}</td>
                    <td><div className={styles.perfBar}><div className={styles.perfFill} style={{ width: `${d.performance}%` }} /><span>{d.performance}%</span></div></td></tr>
                ))}
                {!bestDepts.length && <tr><td colSpan={2} className={styles.empty}>No data</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>Lowest Performing Departments</h3>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead><tr><th>Department</th><th>Performance</th></tr></thead>
              <tbody>
                {lowDepts.map((d) => (
                  <tr key={d.id}><td className={styles.strong}>{d.department_name}</td>
                    <td><div className={styles.perfBar}><div className={styles.perfFill} style={{ width: `${d.performance}%` }} /><span>{d.performance}%</span></div></td></tr>
                ))}
                {!lowDepts.length && <tr><td colSpan={2} className={styles.empty}>No data</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>Top Performing Staff</h3>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead><tr><th>Staff</th><th>Department</th><th>Completed</th><th>Pending</th><th>Avg Res. (h)</th></tr></thead>
            <tbody>
              {topStaff.map((s) => (
                <tr key={s.id}>
                  <td className={styles.strong}>{s.first_name} {s.last_name}</td>
                  <td>{s.department_name || '—'}</td>
                  <td>{s.completed_tickets}</td>
                  <td>{s.pending_tickets}</td>
                  <td>{s.avg_resolution_hours ? Number(s.avg_resolution_hours).toFixed(1) : '—'}</td>
                </tr>
              ))}
              {!topStaff.length && <tr><td colSpan={5} className={styles.empty}>No data</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
