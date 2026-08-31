import { useState } from 'react';
import type { MatrixDepartment, MatrixUser } from '../../types/matrix';
import styles from './MatrixBulkForm.module.css';

type Mode = 'user' | 'department';

type Props = {
  mode: Mode;
  users: MatrixUser[];
  departments: MatrixDepartment[];
  onSubmit: (payload: { id: string; selectedId: string | null }) => Promise<void>;
};

export default function MatrixBulkForm({ mode, users, departments, onSubmit }: Props) {
  const [primaryId, setPrimaryId] = useState('');
  const [selectedId, setSelectedId] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const primaryOptions = mode === 'user' ? users : departments;
  const secondaryOptions = mode === 'user' ? departments : users;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!primaryId) return;
    setLoading(true);
    try {
      await onSubmit({ id: primaryId, selectedId: selectedId || null });
      setSelectedId('');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <div>
        <label>{mode === 'user' ? 'Select User' : 'Select Department'}</label>
        <select value={primaryId} onChange={(e) => setPrimaryId(e.target.value)}>
          <option value="">Choose...</option>
          {primaryOptions.map((item) => (
            <option key={item.id} value={item.id}>
              {mode === 'user'
                ? `${(item as MatrixUser).firstName} ${(item as MatrixUser).lastName}`
                : `${(item as MatrixDepartment).name} (${(item as MatrixDepartment).code})`}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label>{mode === 'user' ? 'Assign Department' : 'Assign User'}</label>
        <select value={selectedId} onChange={(e) => setSelectedId(e.target.value)}>
          <option value="">None / Unassign</option>
          {secondaryOptions.map((item) => (
            <option key={item.id} value={item.id}>
              {mode === 'user'
                ? `${(item as MatrixDepartment).name} (${(item as MatrixDepartment).code})`
                : `${(item as MatrixUser).firstName} ${(item as MatrixUser).lastName}`}
            </option>
          ))}
        </select>
      </div>

      <button type="submit" disabled={loading || !primaryId}>
        {loading ? 'Saving...' : 'Save Assignment'}
      </button>
    </form>
  );
}
