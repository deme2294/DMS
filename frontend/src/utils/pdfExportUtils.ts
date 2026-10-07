import type { Article, KnowledgeAttachment } from '../types/article';
import { parseRevisionThread } from './revisionUtils';

/**
 * Lightweight helper to format markdown or plain text into clean, printable HTML.
 */
function formatContentToHtml(content: string): string {
  if (!content) return '<p><em>No content provided.</em></p>';

  // Check if content already contains HTML tags
  const hasHtml = /<\/?[a-z][\s\S]*>/i.test(content);
  if (hasHtml) {
    return content;
  }

  const lines = content.split('\n');
  const result: string[] = [];
  let inList = false;
  let inNumberedList = false;

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i].trim();

    if (!line) {
      if (inList) {
        result.push('</ul>');
        inList = false;
      }
      if (inNumberedList) {
        result.push('</ol>');
        inNumberedList = false;
      }
      continue;
    }

    // Escape basic entities
    line = line
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // Bold & italic
    line = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    line = line.replace(/\*(.*?)\*/g, '<em>$1</em>');
    line = line.replace(/`([^`]+)`/g, '<code>$1</code>');

    // Headers
    if (line.startsWith('### ')) {
      result.push(`<h3>${line.slice(4)}</h3>`);
      continue;
    }
    if (line.startsWith('## ')) {
      result.push(`<h2>${line.slice(3)}</h2>`);
      continue;
    }
    if (line.startsWith('# ')) {
      result.push(`<h1>${line.slice(2)}</h1>`);
      continue;
    }

    // Bullet lists
    if (line.startsWith('- ') || line.startsWith('* ')) {
      if (!inList) {
        result.push('<ul>');
        inList = true;
      }
      result.push(`<li>${line.slice(2)}</li>`);
      continue;
    }

    // Numbered lists
    const numMatch = line.match(/^(\d+)\.\s+(.*)/);
    if (numMatch) {
      if (!inNumberedList) {
        result.push('<ol>');
        inNumberedList = true;
      }
      result.push(`<li>${numMatch[2]}</li>`);
      continue;
    }

    if (inList) {
      result.push('</ul>');
      inList = false;
    }
    if (inNumberedList) {
      result.push('</ol>');
      inNumberedList = false;
    }

    result.push(`<p>${line}</p>`);
  }

  if (inList) result.push('</ul>');
  if (inNumberedList) result.push('</ol>');

  return result.join('\n');
}

/**
 * Format bytes to readable size string.
 */
function formatFileSize(bytes?: number | null): string {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Formats status for badge display.
 */
function getStatusBadgeDetails(status: string) {
  switch (status) {
    case 'published':
      return { label: '✓ Published Live', bg: '#ecfdf5', color: '#065f46', border: '#a7f3d0' };
    case 'approved':
      return { label: '✓ Approved by Manager', bg: '#eff6ff', color: '#1e40af', border: '#bfdbfe' };
    case 'pending_approval':
      return { label: '⏳ Pending Review', bg: '#fffbeb', color: '#92400e', border: '#fde68a' };
    case 'needs_revision':
      return { label: '⚠️ Needs Revision', bg: '#fff7ed', color: '#c2410c', border: '#fed7aa' };
    case 'draft':
      return { label: '📝 Contributor Draft', bg: '#f3f4f6', color: '#374151', border: '#e5e7eb' };
    case 'archived':
      return { label: '📦 Archived / Retired', bg: '#f1f5f9', color: '#475569', border: '#cbd5e1' };
    default:
      return { label: status.replace(/_/g, ' ').toUpperCase(), bg: '#f3f4f6', color: '#374151', border: '#e5e7eb' };
  }
}

/**
 * Generates and triggers a print / PDF download for a Knowledge Base Article.
 */
export function printArticleAsPdf(article: Article, attachments?: KnowledgeAttachment[]): void {
  if (!article) return;

  const authorName =
    [article.authorFirstName, article.authorLastName].filter(Boolean).join(' ') ||
    (article as any)?.author_name ||
    article.authorEmail ||
    'DMS Staff Member';

  const approvedBy =
    [article.approvedFirstName, article.approvedLastName].filter(Boolean).join(' ') ||
    (article.approvedAt ? 'Department Manager' : null);

  const statusBadge = getStatusBadgeDetails(article.status);
  const formattedContent = formatContentToHtml(article.content || '');
  const revisionItems = parseRevisionThread(article.revisionNotes);

  const tagsList = article.tags
    ? article.tags.split(',').map((t) => t.trim()).filter(Boolean)
    : [];

  const filename = `${article.articleReference || 'KB'}-${(article.title || 'Article').replace(/[^a-zA-Z0-9_-]/g, '_')}`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${article.articleReference || 'KB'} - ${article.title || 'Knowledge Article'}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 18mm 15mm 20mm 15mm;
      @bottom-right {
        content: "Page " counter(page) " of " counter(pages);
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        font-size: 8pt;
        color: #64748b;
      }
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      color: #1e293b;
      background: #ffffff;
      font-size: 10.5pt;
      line-height: 1.6;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    .doc-container {
      width: 100%;
      margin: 0 auto;
    }

    /* Header Bar */
    .header-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-bottom: 14px;
      border-bottom: 2px solid #0284c7;
      margin-bottom: 20px;
    }

    .org-title {
      font-size: 13pt;
      font-weight: 800;
      letter-spacing: -0.02em;
      color: #0f172a;
    }

    .org-subtitle {
      font-size: 8pt;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #0284c7;
      font-weight: 700;
      margin-top: 2px;
    }

    .header-meta-right {
      text-align: right;
      font-size: 8.5pt;
      color: #64748b;
    }

    .header-ref {
      font-family: "Courier New", Courier, monospace;
      font-weight: 800;
      font-size: 11pt;
      color: #0284c7;
      background: #f0f9ff;
      border: 1px solid #bae6fd;
      padding: 3px 8px;
      border-radius: 4px;
      display: inline-block;
      margin-bottom: 3px;
    }

    /* Article Hero */
    .article-title {
      font-size: 20pt;
      font-weight: 800;
      line-height: 1.25;
      color: #0f172a;
      margin-bottom: 14px;
      letter-spacing: -0.02em;
    }

    /* Status & Meta Badges */
    .badge-strip {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
      margin-bottom: 18px;
    }

    .badge {
      display: inline-flex;
      align-items: center;
      padding: 4px 10px;
      border-radius: 9999px;
      font-size: 8.5pt;
      font-weight: 700;
    }

    .badge-status {
      background: ${statusBadge.bg};
      color: ${statusBadge.color};
      border: 1px solid ${statusBadge.border};
    }

    .badge-cat {
      background: #f8fafc;
      color: #334155;
      border: 1px solid #e2e8f0;
    }

    .badge-dept {
      background: #f8fafc;
      color: #475569;
      border: 1px solid #e2e8f0;
    }

    .badge-ver {
      background: #ede9fe;
      color: #5b21b6;
      border: 1px solid #ddd6fe;
    }

    /* Metadata Specification Table */
    .meta-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 22px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      overflow: hidden;
    }

    .meta-table td {
      padding: 8px 12px;
      font-size: 9pt;
      border-bottom: 1px solid #e2e8f0;
      vertical-align: top;
    }

    .meta-table tr:last-child td {
      border-bottom: none;
    }

    .meta-label {
      width: 18%;
      font-weight: 700;
      color: #64748b;
      text-transform: uppercase;
      font-size: 7.5pt;
      letter-spacing: 0.05em;
    }

    .meta-val {
      width: 32%;
      color: #0f172a;
      font-weight: 600;
    }

    /* Abstract / Summary Callout */
    .summary-box {
      background: #eff6ff;
      border-left: 4px solid #3b82f6;
      padding: 12px 16px;
      margin-bottom: 22px;
      border-radius: 0 6px 6px 0;
    }

    .summary-title {
      font-size: 8pt;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: #1d4ed8;
      margin-bottom: 4px;
    }

    .summary-text {
      font-size: 10pt;
      color: #1e3a8a;
      font-style: italic;
      line-height: 1.5;
    }

    /* Revision Directives Card (if any) */
    .revision-box {
      background: #fffbeb;
      border: 1px solid #fde68a;
      border-left: 4px solid #f59e0b;
      padding: 12px 16px;
      margin-bottom: 22px;
      border-radius: 0 6px 6px 0;
    }

    .revision-box-title {
      font-size: 8.5pt;
      font-weight: 800;
      color: #b45309;
      margin-bottom: 8px;
    }

    .revision-item {
      font-size: 9pt;
      margin-bottom: 6px;
      color: #78350f;
    }

    /* Main Content */
    .content-heading {
      font-size: 11pt;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: #334155;
      padding-bottom: 6px;
      border-bottom: 1px solid #cbd5e1;
      margin-bottom: 14px;
    }

    .content-body {
      font-size: 10.5pt;
      color: #1e293b;
      line-height: 1.7;
      margin-bottom: 26px;
    }

    .content-body p {
      margin-bottom: 12px;
    }

    .content-body h1, .content-body h2, .content-body h3 {
      color: #0f172a;
      font-weight: 800;
      margin-top: 16px;
      margin-bottom: 8px;
      line-height: 1.3;
    }

    .content-body h1 { font-size: 14pt; }
    .content-body h2 { font-size: 12.5pt; }
    .content-body h3 { font-size: 11pt; }

    .content-body ul, .content-body ol {
      margin-left: 22px;
      margin-bottom: 12px;
    }

    .content-body li {
      margin-bottom: 4px;
    }

    .content-body code {
      font-family: "Courier New", Courier, monospace;
      background: #f1f5f9;
      padding: 1px 4px;
      border-radius: 3px;
      font-size: 9.5pt;
      color: #0f172a;
    }

    /* Attachments Section */
    .attachments-section {
      margin-top: 24px;
      margin-bottom: 26px;
      page-break-inside: avoid;
    }

    .att-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 8.5pt;
      border: 1px solid #e2e8f0;
    }

    .att-table th {
      background: #f8fafc;
      padding: 6px 10px;
      text-align: left;
      font-weight: 700;
      color: #475569;
      border-bottom: 1px solid #cbd5e1;
    }

    .att-table td {
      padding: 6px 10px;
      border-bottom: 1px solid #e2e8f0;
      color: #1e293b;
    }

    /* Verification Stamp / Footer */
    .doc-footer {
      margin-top: 32px;
      padding-top: 12px;
      border-top: 1px solid #e2e8f0;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      font-size: 8pt;
      color: #94a3b8;
      page-break-inside: avoid;
    }

    .footer-stamp {
      font-weight: 700;
      color: #0284c7;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    @media print {
      body {
        margin: 0;
      }
    }
  </style>
</head>
<body>
  <div class="doc-container">
    <!-- Header -->
    <div class="header-bar">
      <div>
        <div class="org-title">DMS HELP DESK · KNOWLEDGE REPOSITORY</div>
        <div class="org-subtitle">Official Standard Operating Procedure & Knowledge Article</div>
      </div>
      <div class="header-meta-right">
        <div class="header-ref">${article.articleReference || 'KB-DOCUMENT'}</div>
        <div>Generated: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
      </div>
    </div>

    <!-- Title -->
    <h1 class="article-title">${article.title || 'Untitled Article'}</h1>

    <!-- Badges -->
    <div class="badge-strip">
      <span class="badge badge-status">${statusBadge.label}</span>
      <span class="badge badge-cat">📂 ${article.category || 'General'}</span>
      ${article.departmentName ? `<span class="badge badge-dept">🏢 ${article.departmentName}</span>` : ''}
      <span class="badge badge-ver">Version v${article.version || '1.0'}</span>
      <span class="badge badge-dept">Scope: ${article.visibility ? article.visibility.toUpperCase() : 'INTERNAL'}</span>
    </div>

    <!-- Metadata Grid -->
    <table class="meta-table">
      <tr>
        <td class="meta-label">Author:</td>
        <td class="meta-val">${authorName}</td>
        <td class="meta-label">Created Date:</td>
        <td class="meta-val">${article.createdAt ? new Date(article.createdAt).toLocaleDateString() : '—'}</td>
      </tr>
      <tr>
        <td class="meta-label">Department:</td>
        <td class="meta-val">${article.departmentName || 'General / Central'}</td>
        <td class="meta-label">Last Updated:</td>
        <td class="meta-val">${article.updatedAt ? new Date(article.updatedAt).toLocaleDateString() : '—'}</td>
      </tr>
      <tr>
        <td class="meta-label">Approval Gate:</td>
        <td class="meta-val">${approvedBy ? `Approved by ${approvedBy}` : 'Pending Central Verification'}</td>
        <td class="meta-label">Approved Date:</td>
        <td class="meta-val">${article.approvedAt ? new Date(article.approvedAt).toLocaleDateString() : '—'}</td>
      </tr>
      <tr>
        <td class="meta-label">Reader Feedback:</td>
        <td class="meta-val">👍 ${article.helpfulCount ?? 0} helpful · 👎 ${article.notHelpfulCount ?? 0} unhelpful</td>
        <td class="meta-label">Portal Views:</td>
        <td class="meta-val">${article.viewCount ?? 0} recorded views</td>
      </tr>
      ${tagsList.length > 0 ? `
      <tr>
        <td class="meta-label">Index Tags:</td>
        <td class="meta-val" colspan="3">${tagsList.join(', ')}</td>
      </tr>
      ` : ''}
    </table>

    <!-- Abstract / Summary -->
    ${article.summary ? `
    <div class="summary-box">
      <div class="summary-title">Executive Summary / Abstract</div>
      <div class="summary-text">${article.summary}</div>
    </div>
    ` : ''}

    <!-- Revision Thread (if applicable) -->
    ${revisionItems.length > 0 ? `
    <div class="revision-box">
      <div class="revision-box-title">⚠️ Lifecycle Revision Directives & Audit Trail:</div>
      ${revisionItems.map((item) => `
        <div class="revision-item">
          <strong>[${item.roleLabel || 'Reviewer'}]:</strong> ${item.comment}
          <span style="font-size: 7.5pt; color: #a16207;">(${new Date(item.createdAt).toLocaleDateString()})</span>
        </div>
      `).join('')}
    </div>
    ` : ''}

    <!-- Content -->
    <div class="content-heading">Full Article Content & Instructions</div>
    <div class="content-body">
      ${formattedContent}
    </div>

    <!-- Attachments -->
    ${attachments && attachments.length > 0 ? `
    <div class="attachments-section">
      <div class="content-heading">Attached Documentation & Files (${attachments.length})</div>
      <table class="att-table">
        <thead>
          <tr>
            <th>#</th>
            <th>File Name</th>
            <th>Type</th>
            <th>File Size</th>
            <th>Uploaded By</th>
          </tr>
        </thead>
        <tbody>
          ${attachments.map((att, idx) => `
            <tr>
              <td>${idx + 1}</td>
              <td><strong>${att.fileName || att.file_name || 'Document'}</strong></td>
              <td>${(att.fileExtension || att.file_extension || 'FILE').toUpperCase()}</td>
              <td>${formatFileSize(att.fileSize || att.file_size)}</td>
              <td>${att.uploaderFirstName || 'Staff'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
    ` : ''}

    <!-- Footer -->
    <div class="doc-footer">
      <div>
        <div class="footer-stamp">✓ Verified DMS Knowledge Repository Document</div>
        <div>Confidential & Proprietary · Internal and Authorized Portal Use Only</div>
      </div>
      <div style="text-align: right;">
        <div>Reference: <strong>${article.articleReference || 'KB-DOC'}</strong></div>
        <div>Doc ID: ${article.id}</div>
      </div>
    </div>
  </div>

  <script>
    // Auto-trigger print when loaded
    window.addEventListener('load', function() {
      setTimeout(function() {
        window.focus();
        window.print();
      }, 250);
    });
  </script>
</body>
</html>`;

  // Create an isolated hidden iframe
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  iframe.setAttribute('title', filename);

  document.body.appendChild(iframe);

  try {
    const doc = iframe.contentWindow?.document || iframe.contentDocument;
    if (doc) {
      doc.open();
      doc.write(html);
      doc.close();
    }
  } catch (err) {
    console.error('Failed to write print document into iframe', err);
  }

  // Cleanup iframe after printing
  setTimeout(() => {
    try {
      if (iframe.parentNode) {
        iframe.parentNode.removeChild(iframe);
      }
    } catch {
      // ignore cleanup errors
    }
  }, 60000); // 60s gives the user ample time in the print modal
}
