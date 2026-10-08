import PageHeader from '../../components/PageHeader/PageHeader';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DataTable from '../../components/Tables/DataTable';
import Modal from '../../components/Modal/Modal';
import {
  fetchAllCategories,
  createCategory,
  updateCategory,
  deleteCategory,
} from '../../api/knowledgeApi';
import { fetchActiveDepartments } from '../../api/departmentApi';
import type { KnowledgeCategory } from '../../types/article';
import { usePermission } from '../../hooks/usePermission';
import { resolveCategoryIcon, isEmoji, POPULAR_ICON_PRESETS } from '../../utils/categoryIconUtils';
import styles from './KnowledgeCategories.module.css';

interface DeptItem {
  id: string;
  name: string;
  code: string;
}

export default function KnowledgeCategories() {
  const navigate = useNavigate();
  const { can } = usePermission();
  const [categories, setCategories] = useState<KnowledgeCategory[]>([]);
  const [departments, setDepartments] = useState<DeptItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [editTarget, setEditTarget] = useState<KnowledgeCategory | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<KnowledgeCategory | null>(null);
  const initialForm = { name: '', description: '', icon: '', isActive: true, parentId: '', departmentId: '' };
  const [form, setForm] = useState(initialForm);
  const [catPage, setCatPage] = useState(1);
  const [catPageSize, setCatPageSize] = useState(10);
  const CAT_PAGE_OPTIONS = [10, 20, 50];

  const totalCatPages = useMemo(() => Math.max(1, Math.ceil(categories.length / catPageSize)), [categories.length, catPageSize]);
  const pagedCategories = useMemo(() => categories.slice((catPage - 1) * catPageSize, catPage * catPageSize), [categories, catPage, catPageSize]);

  const loadCategories = async () => {
    setLoading(true);
    try {
      const [res, deptRes] = await Promise.all([
        fetchAllCategories(),
        fetchActiveDepartments().catch(() => ({ data: { data: [] } })),
      ]);
      setCategories(res.data.data || []);
      setDepartments((deptRes.data?.data as DeptItem[]) || []);
    } catch {
      setError('Failed to load categories');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadCategories(); }, []);

  const runAction = async (fn: () => Promise<unknown>, successMsg: string) => {
    setError('');
    try {
      await fn();
      setMessage(successMsg);
      await loadCategories();
    } catch (err: unknown) {
      setError((err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Action failed');
    }
  };

  const handleCreate = async () => {
    if (!form.name.trim()) { setError('Name is required'); return; }
    await runAction(() => createCategory({ ...form, parentId: form.parentId || null, departmentId: form.departmentId || null }), 'Category created');
    setForm(initialForm);
    setShowCreate(false);
  };

  const handleUpdate = async () => {
    if (!editTarget) return;
    if (editTarget.isVirtual) {
      setError('This is a legacy category derived from article data. Create a proper category with the same name to manage it.');
      return;
    }
    if (!form.name.trim()) { setError('Name is required'); return; }
    await runAction(() => updateCategory(editTarget.id, { ...form, parentId: form.parentId || null, departmentId: form.departmentId || null }), 'Category updated');
    setEditTarget(null);
    setForm(initialForm);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    if (deleteTarget.isVirtual) {
      setError('Virtual categories cannot be deleted. They are automatically removed when no articles use that category name.');
      setDeleteTarget(null);
      return;
    }
    await runAction(() => deleteCategory(deleteTarget.id), 'Category deleted');
    setDeleteTarget(null);
  };

  const startEdit = (cat: KnowledgeCategory) => {
    setEditTarget(cat);
    setForm({
      name: cat.name ?? '',
      description: cat.description ?? '',
      icon: cat.icon ?? '',
      isActive: cat.isActive !== undefined ? Boolean(cat.isActive) : true,
      parentId: cat.parentId ?? '',
      departmentId: cat.departmentId ?? '',
    });
  };

  return (
    <div className={styles.page}>
      <PageHeader
        title="Knowledge Base Categories"
        description="Manage article categories and department scoping"
        backTo="/admin/knowledge"
        actionLabel="+ New Category"
        onAction={() => {
          setForm(initialForm);
          setShowCreate(true);
        }}
      />

      {message && <div className={styles.toast}>{message}</div>}
      {error && <div className={`${styles.toast} ${styles.error}`}>{error}</div>}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontSize: '0.85rem', color: 'var(--text-muted, #64748b)' }}>
          {categories.length === 0 ? 'No categories' : `Showing ${Math.min((catPage - 1) * catPageSize + 1, categories.length)}–${Math.min(catPage * catPageSize, categories.length)} of ${categories.length}`}
        </span>
        <select
          value={catPageSize}
          onChange={(e) => { setCatPageSize(Number(e.target.value)); setCatPage(1); }}
          style={{ fontSize: '0.82rem', padding: '4px 8px', borderRadius: 6, border: '1px solid var(--border-color, #e2e8f0)', background: 'var(--input-bg, #fff)', color: 'var(--text-main, #0f172a)' }}
        >
          {CAT_PAGE_OPTIONS.map(n => <option key={n} value={n}>Show {n}</option>)}
        </select>
      </div>

      <DataTable<KnowledgeCategory>
        loading={loading}
        data={pagedCategories}
        columns={[
          { key: 'name', label: 'Name', render: (row) => (
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {row.name}
              {row.isVirtual && (
                <span style={{ fontSize: '0.7rem', fontWeight: 600, padding: '2px 7px', borderRadius: 999, background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a', flexShrink: 0 }}>
                  Legacy
                </span>
              )}
            </span>
          )},
          { key: 'slug', label: 'Slug' },
          {
            key: 'department',
            label: 'Department Scope',
            render: (row) => row.departmentName ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontWeight: 600, color: '#1d4ed8', background: '#eff6ff', padding: '3px 8px', borderRadius: 6, fontSize: '0.78rem' }}>
                🏢 {row.departmentName}
              </span>
            ) : (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontWeight: 500, color: '#475569', background: '#f1f5f9', padding: '3px 8px', borderRadius: 6, fontSize: '0.78rem' }}>
                🌐 Global (All Departments)
              </span>
            )
          },
          { key: 'description', label: 'Description' },
          {
            key: 'icon',
            label: 'Icon',
            render: (row) => {
              const resolved = resolveCategoryIcon(row.icon || row.name);
              const isEnglishWord = Boolean(row.icon && !isEmoji(row.icon));
              return (
                <div className={styles.iconCell}>
                  <span className={styles.iconDisplay} title={row.icon ? `Icon: ${row.icon}` : 'Category icon'}>
                    {resolved}
                  </span>
                  {isEnglishWord && (
                    <span className={styles.iconNameBadge}>{row.icon}</span>
                  )}
                </div>
              );
            },
          },
          {
            key: 'isActive',
            label: 'Status',
            render: (row) => {
              const active = Boolean(row.isActive ?? (row as any).is_active);
              return (
                <span className={`${styles.badge} ${active ? styles.active : styles.inactive}`}>
                  {active ? 'Active' : 'Inactive'}
                </span>
              );
            },
          },
          {
            key: 'actions',
            label: 'Actions',
            render: (row) => {
              if (row.isVirtual) {
                return (
                  <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontStyle: 'italic', padding: '4px 8px', background: '#f1f5f9', borderRadius: 6, display: 'inline-block' }}>
                    Auto-generated
                  </span>
                );
              }
              return (
                <div className={styles.actions}>
                  <button className={styles.edit} onClick={() => startEdit(row)}>Edit</button>
                  <button className={styles.danger} onClick={() => setDeleteTarget(row)}>Delete</button>
                </div>
              );
            },
          },
        ]}
      />

      {totalCatPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 16, marginTop: 16 }}>
          <button
            onClick={() => setCatPage(p => Math.max(1, p - 1))}
            disabled={catPage <= 1}
            style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid var(--border-color, #e2e8f0)', background: 'var(--bg-card, #fff)', color: 'var(--text-main, #0f172a)', cursor: catPage <= 1 ? 'not-allowed' : 'pointer', opacity: catPage <= 1 ? 0.5 : 1 }}
          >← Previous</button>
          <span style={{ fontSize: '0.88rem', color: 'var(--text-secondary, #334155)' }}>Page {catPage} of {totalCatPages}</span>
          <button
            onClick={() => setCatPage(p => Math.min(totalCatPages, p + 1))}
            disabled={catPage >= totalCatPages}
            style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid var(--border-color, #e2e8f0)', background: 'var(--bg-card, #fff)', color: 'var(--text-main, #0f172a)', cursor: catPage >= totalCatPages ? 'not-allowed' : 'pointer', opacity: catPage >= totalCatPages ? 0.5 : 1 }}
          >Next →</button>
        </div>
      )}

      <Modal open={showCreate} title="Create Category" onClose={() => setShowCreate(false)}>
        <div className={styles.formGroup}>
          <label>Name</label>
          <input value={form.name ?? ''} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Category name" />
        </div>
        <div className={styles.formGroup}>
          <label>Description</label>
          <textarea value={form.description ?? ''} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} />
        </div>
        <div className={styles.formGroup}>
          <label>Icon (English Name or Emoji)</label>
          <div className={styles.iconInputContainer}>
            <div className={styles.iconInputRow}>
              <div
                className={`${styles.iconPreviewBox} ${form.icon ? styles.iconPreviewBoxActive : ''}`}
                title="Live icon preview"
              >
                {resolveCategoryIcon(form.icon || form.name)}
              </div>
              <input
                value={form.icon ?? ''}
                onChange={(e) => setForm({ ...form, icon: e.target.value })}
                placeholder="e.g. gmail, laptop, printer, security, wifi, or 💻"
                style={{ flex: 1 }}
              />
            </div>
            <div className={styles.iconHelperText}>
              {form.icon ? (
                <span>
                  Visual Preview: <strong>{resolveCategoryIcon(form.icon)}</strong>
                  {!isEmoji(form.icon) && ` (matched English word "${form.icon.trim()}")`}
                </span>
              ) : (
                <span>Type any English word (e.g. <em>gmail</em>, <em>laptop</em>, <em>printer</em>, <em>wifi</em>, <em>security</em>) or pick from below:</span>
              )}
            </div>

            {/* Quick Icon Selector Pills */}
            <div className={styles.quickPillsWrapper}>
              <div className={styles.quickPillsLabel}>
                <span>Popular English Icons</span>
                <span style={{ fontSize: '0.72rem', textTransform: 'none', color: '#64748b' }}>Click to select</span>
              </div>
              <div className={styles.quickPillsList}>
                {POPULAR_ICON_PRESETS.map((preset) => {
                  const isSelected = (form.icon || '').toLowerCase().trim() === preset.label.toLowerCase().split('/')[0].trim() || (form.icon || '') === preset.icon;
                  return (
                    <button
                      type="button"
                      key={preset.label}
                      className={`${styles.pillBtn} ${isSelected ? styles.pillBtnActive : ''}`}
                      onClick={() => setForm({ ...form, icon: preset.label.split('/')[0].trim().toLowerCase() })}
                      title={`Select ${preset.label} (${preset.icon})`}
                    >
                      <span>{preset.icon}</span>
                      <span>{preset.label.split('/')[0].trim()}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
        <div className={styles.formGroup}>
          <label>Department Scope</label>
          <select
            value={form.departmentId ?? ''}
            onChange={(e) => setForm({ ...form, departmentId: e.target.value })}
            style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: '0.88rem' }}
          >
            <option value="">🌐 All Departments (Global / Organization-Wide)</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                🏢 {d.name} ({d.code})
              </option>
            ))}
          </select>
          <span style={{ fontSize: '0.78rem', color: '#64748b', marginTop: 4, display: 'block' }}>
            Choose a specific department or leave as Global so all departments can use this category.
          </span>
        </div>
        <div className={styles.formGroup}>
          <label>Status</label>
          <label className={styles.checkboxLabel}>
            <input
              type="checkbox"
              checked={Boolean(form.isActive)}
              onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
              className={styles.checkboxInput}
            />
            <span style={{ fontWeight: 600, color: form.isActive ? '#15803d' : '#b91c1c' }}>
              {form.isActive ? '✓ Active (Available in Knowledge Base)' : '✕ Inactive (Hidden from Knowledge Base)'}
            </span>
          </label>
        </div>
        <div className={styles.formActions}>
          <button className={styles.submitBtn} onClick={handleCreate}>Create</button>
          <button className={styles.cancelBtn} onClick={() => setShowCreate(false)}>Cancel</button>
        </div>
      </Modal>

      <Modal open={!!editTarget} title="Edit Category" onClose={() => { setEditTarget(null); setForm(initialForm); }}>
        <div className={styles.formGroup}>
          <label>Name</label>
          <input value={form.name ?? ''} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </div>
        <div className={styles.formGroup}>
          <label>Description</label>
          <textarea value={form.description ?? ''} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} />
        </div>
        <div className={styles.formGroup}>
          <label>Icon (English Name or Emoji)</label>
          <div className={styles.iconInputContainer}>
            <div className={styles.iconInputRow}>
              <div
                className={`${styles.iconPreviewBox} ${form.icon ? styles.iconPreviewBoxActive : ''}`}
                title="Live icon preview"
              >
                {resolveCategoryIcon(form.icon || form.name)}
              </div>
              <input
                value={form.icon ?? ''}
                onChange={(e) => setForm({ ...form, icon: e.target.value })}
                placeholder="e.g. gmail, laptop, printer, security, wifi, or 💻"
                style={{ flex: 1 }}
              />
            </div>
            <div className={styles.iconHelperText}>
              {form.icon ? (
                <span>
                  Visual Preview: <strong>{resolveCategoryIcon(form.icon)}</strong>
                  {!isEmoji(form.icon) && ` (matched English word "${form.icon.trim()}")`}
                </span>
              ) : (
                <span>Type any English word (e.g. <em>gmail</em>, <em>laptop</em>, <em>printer</em>, <em>wifi</em>, <em>security</em>) or pick from below:</span>
              )}
            </div>

            {/* Quick Icon Selector Pills */}
            <div className={styles.quickPillsWrapper}>
              <div className={styles.quickPillsLabel}>
                <span>Popular English Icons</span>
                <span style={{ fontSize: '0.72rem', textTransform: 'none', color: '#64748b' }}>Click to select</span>
              </div>
              <div className={styles.quickPillsList}>
                {POPULAR_ICON_PRESETS.map((preset) => {
                  const isSelected = (form.icon || '').toLowerCase().trim() === preset.label.toLowerCase().split('/')[0].trim() || (form.icon || '') === preset.icon;
                  return (
                    <button
                      type="button"
                      key={preset.label}
                      className={`${styles.pillBtn} ${isSelected ? styles.pillBtnActive : ''}`}
                      onClick={() => setForm({ ...form, icon: preset.label.split('/')[0].trim().toLowerCase() })}
                      title={`Select ${preset.label} (${preset.icon})`}
                    >
                      <span>{preset.icon}</span>
                      <span>{preset.label.split('/')[0].trim()}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
        <div className={styles.formGroup}>
          <label>Department Scope</label>
          <select
            value={form.departmentId ?? ''}
            onChange={(e) => setForm({ ...form, departmentId: e.target.value })}
            style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: '0.88rem' }}
          >
            <option value="">🌐 All Departments (Global / Organization-Wide)</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                🏢 {d.name} ({d.code})
              </option>
            ))}
          </select>
          <span style={{ fontSize: '0.78rem', color: '#64748b', marginTop: 4, display: 'block' }}>
            Choose a specific department or leave as Global so all departments can use this category.
          </span>
        </div>
        <div className={styles.formGroup}>
          <label>Status</label>
          <label className={styles.checkboxLabel}>
            <input
              type="checkbox"
              checked={Boolean(form.isActive)}
              onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
              className={styles.checkboxInput}
            />
            <span style={{ fontWeight: 600, color: form.isActive ? '#15803d' : '#b91c1c' }}>
              {form.isActive ? '✓ Active (Available in Knowledge Base)' : '✕ Inactive (Hidden from Knowledge Base)'}
            </span>
          </label>
        </div>
        <div className={styles.formActions}>
          <button className={styles.submitBtn} onClick={handleUpdate}>Update</button>
          <button className={styles.cancelBtn} onClick={() => { setEditTarget(null); setForm(initialForm); }}>Cancel</button>
        </div>
      </Modal>

      <Modal open={!!deleteTarget} title="Delete Category" onClose={() => setDeleteTarget(null)}>
        <p>Are you sure you want to delete "{deleteTarget?.name}"? This cannot be undone.</p>
        <div className={styles.formActions}>
          <button className={styles.danger} onClick={handleDelete}>Delete</button>
          <button className={styles.cancelBtn} onClick={() => setDeleteTarget(null)}>Cancel</button>
        </div>
      </Modal>
    </div>
  );
}
