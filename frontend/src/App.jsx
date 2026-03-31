import { useEffect, useMemo, useRef, useState } from 'react';

const API_BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

const toolbarActions = [
  { label: 'B', command: 'bold' },
  { label: 'I', command: 'italic' },
  { label: 'U', command: 'underline' },
  { label: 'H1', command: 'formatBlock', value: 'h1' },
  { label: 'H2', command: 'formatBlock', value: 'h2' },
  { label: '• List', command: 'insertUnorderedList' },
  { label: '1. List', command: 'insertOrderedList' },
  { label: 'Quote', command: 'formatBlock', value: 'blockquote' },
  { label: 'Clear', command: 'removeFormat' }
];

function formatDate(value) {
  return value ? new Date(value).toLocaleString() : '—';
}

export default function App() {
  const editorRef = useRef(null);
  const [users, setUsers] = useState([]);
  const [activeUserId, setActiveUserId] = useState('');
  const [documents, setDocuments] = useState({ owned: [], shared: [] });
  const [activeDocId, setActiveDocId] = useState('');
  const [currentDoc, setCurrentDoc] = useState(null);
  const [draftTitle, setDraftTitle] = useState('');
  const [draftHtml, setDraftHtml] = useState('<p>Start writing here...</p>');
  const [shareTarget, setShareTarget] = useState('');
  const [uploadFile, setUploadFile] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [backendStatus, setBackendStatus] = useState('checking');
  const [isDirty, setIsDirty] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState('');

  const activeUser = users.find((user) => user.id === activeUserId);
  const isOwner = currentDoc?.ownerId === activeUserId;

  const availableShareTargets = useMemo(() => {
    return users.filter(
      (user) => user.id !== activeUserId && !currentDoc?.sharedWith?.includes(user.id)
    );
  }, [users, currentDoc, activeUserId]);

  const filteredDocuments = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();

    const filterDocs = (items) => {
      if (!query) return items;

      return items.filter((doc) => {
        return [doc.title, doc.ownerName, doc.preview]
          .filter(Boolean)
          .some((value) => value.toLowerCase().includes(query));
      });
    };

    return {
      owned: filterDocs(documents.owned),
      shared: filterDocs(documents.shared)
    };
  }, [documents, searchTerm]);

  const summaryStats = useMemo(() => {
    return [
      { label: 'Owned docs', value: documents.owned.length, tone: 'blue' },
      { label: 'Shared docs', value: documents.shared.length, tone: 'purple' },
      { label: 'Team access', value: currentDoc?.sharedUsers?.length ?? 0, tone: 'green' }
    ];
  }, [documents, currentDoc]);

  useEffect(() => {
    checkBackendStatus();
    loadUsers();
  }, []);

  useEffect(() => {
    if (!message) return undefined;
    const timer = window.setTimeout(() => setMessage(''), 2600);
    return () => window.clearTimeout(timer);
  }, [message]);

  useEffect(() => {
    if (activeUserId) {
      loadDocuments(activeUserId);
    }
  }, [activeUserId]);

  useEffect(() => {
    if (activeDocId && activeUserId) {
      loadDocument(activeDocId);
    } else {
      setCurrentDoc(null);
      setDraftTitle('');
      setDraftHtml('<p>Start writing here...</p>');
      setIsDirty(false);
    }
  }, [activeDocId, activeUserId]);

  useEffect(() => {
    if (editorRef.current && currentDoc) {
      editorRef.current.innerHTML = currentDoc.content || '<p>Start writing here...</p>';
    }
  }, [currentDoc?.id]);

  useEffect(() => {
    if (currentDoc?.updatedAt) {
      setLastSavedAt(currentDoc.updatedAt);
      setIsDirty(false);
    }
  }, [currentDoc?.id, currentDoc?.updatedAt]);

  useEffect(() => {
    const onKeyDown = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        if (currentDoc) {
          handleSave();
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [currentDoc, draftTitle, draftHtml, activeUserId]);

  async function checkBackendStatus() {
    try {
      const response = await fetch(`${API_BASE}/api/health`);
      if (!response.ok) throw new Error('Health check failed');
      setBackendStatus('online');
    } catch {
      setBackendStatus('offline');
    }
  }

  async function loadUsers() {
    try {
      const response = await fetch(`${API_BASE}/api/users`);
      const data = await response.json();
      setUsers(data);
      setBackendStatus('online');
      if (!activeUserId && data.length) {
        setActiveUserId(data[0].id);
      }
    } catch {
      setBackendStatus('offline');
      setError('Could not load users. Please start the backend server on port 4000.');
    }
  }

  async function loadDocuments(userId) {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`${API_BASE}/api/documents?userId=${userId}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to load documents');
      setDocuments(data);

      const allDocs = [...data.owned, ...data.shared];
      if (!allDocs.length) {
        setActiveDocId('');
      } else if (!allDocs.some((doc) => doc.id === activeDocId)) {
        setActiveDocId(allDocs[0].id);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadDocument(docId) {
    try {
      const response = await fetch(`${API_BASE}/api/documents/${docId}?userId=${activeUserId}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to load document');
      setCurrentDoc(data);
      setDraftTitle(data.title);
      setDraftHtml(data.content || '<p>Start writing here...</p>');
      setMessage(`Opened “${data.title}”.`);
      setError('');
    } catch (err) {
      setError(err.message);
    }
  }

  function applyFormat(command, value) {
    editorRef.current?.focus();
    document.execCommand(command, false, value);
    setDraftHtml(editorRef.current?.innerHTML || '');
    setIsDirty(true);
  }

  async function handleCreate() {
    if (!activeUserId) return;

    try {
      const response = await fetch(`${API_BASE}/api/documents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ownerId: activeUserId, title: 'Untitled document' })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not create document');
      await loadDocuments(activeUserId);
      setActiveDocId(data.id);
      setMessage('New document created.');
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleSave() {
    if (!currentDoc) return;

    setSaving(true);
    try {
      const response = await fetch(`${API_BASE}/api/documents/${currentDoc.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: activeUserId,
          title: draftTitle,
          content: editorRef.current?.innerHTML || draftHtml
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Save failed');
      setCurrentDoc(data);
      setLastSavedAt(data.updatedAt);
      setIsDirty(false);
      await loadDocuments(activeUserId);
      setMessage('Document saved successfully.');
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleShare() {
    if (!currentDoc || !shareTarget) return;

    try {
      const response = await fetch(`${API_BASE}/api/documents/${currentDoc.id}/share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ownerId: activeUserId, targetUserId: shareTarget })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Share failed');
      setCurrentDoc(data.document);
      setShareTarget('');
      setMessage('Document shared successfully.');
      await loadDocuments(activeUserId);
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleUpload(event) {
    event.preventDefault();
    if (!uploadFile || !activeUserId) return;

    const formData = new FormData();
    formData.append('file', uploadFile);
    formData.append('ownerId', activeUserId);

    try {
      const response = await fetch(`${API_BASE}/api/documents/import`, {
        method: 'POST',
        body: formData
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Import failed');
      setUploadFile(null);
      event.target.reset();
      await loadDocuments(activeUserId);
      setActiveDocId(data.id);
      setMessage(`Imported ${data.title}.`);
    } catch (err) {
      setError(err.message);
    }
  }

  const documentCard = (doc, kind) => (
    <button
      key={doc.id}
      className={`doc-card ${doc.id === activeDocId ? 'active' : ''}`}
      onClick={() => setActiveDocId(doc.id)}
      type="button"
    >
      <div className="doc-card-row">
        <strong>{doc.title}</strong>
        <span className={`doc-badge ${kind}`}>{kind === 'owned' ? 'Owned' : 'Shared'}</span>
      </div>
      <p>{doc.preview || 'Open this document to begin editing.'}</p>
      <span>
        {kind === 'owned'
          ? `Shared with ${doc.sharedCount || 0} teammate(s)`
          : `Shared by ${doc.ownerName}`}
      </span>
      <small>Updated {formatDate(doc.updatedAt)}</small>
    </button>
  );

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-card">
          <p className="eyebrow">Ajaia assessment</p>
          <h1>Ajaia Docs Pro</h1>
          <p className="muted">
            Professional collaborative editing with sharing, import, and persistent local storage.
          </p>
        </div>

        <div className={`status-pill ${backendStatus === 'online' ? 'online' : 'offline'}`}>
          <span className="status-dot" />
          {backendStatus === 'online' ? 'Backend connected' : 'Backend offline'}
        </div>

        <label className="field-label">
          Acting user
          <select value={activeUserId} onChange={(event) => setActiveUserId(event.target.value)}>
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.name}
              </option>
            ))}
          </select>
        </label>

        <label className="field-label">
          Search documents
          <input
            type="text"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Find by title or preview"
          />
        </label>

        <div className="sidebar-actions">
          <button className="primary-btn full-width" onClick={handleCreate} type="button" disabled={!activeUserId}>
            + New document
          </button>
        </div>

        <form className="upload-box" onSubmit={handleUpload}>
          <h3>Import file</h3>
          <p>Bring in <code>.txt</code> or <code>.md</code> notes and continue editing instantly.</p>
          <input
            type="file"
            accept=".txt,.md,text/plain,text/markdown"
            onChange={(event) => setUploadFile(event.target.files?.[0] || null)}
          />
          <button type="submit" className="secondary-btn full-width" disabled={!uploadFile}>
            Upload into workspace
          </button>
        </form>

        <section>
          <div className="section-title">Owned documents</div>
          <div className="doc-list">
            {filteredDocuments.owned.map((doc) => documentCard(doc, 'owned'))}
            {!filteredDocuments.owned.length && <p className="empty-text">No owned documents match your search.</p>}
          </div>
        </section>

        <section>
          <div className="section-title">Shared with {activeUser?.name || 'you'}</div>
          <div className="doc-list">
            {filteredDocuments.shared.map((doc) => documentCard(doc, 'shared'))}
            {!filteredDocuments.shared.length && <p className="empty-text">No shared documents available.</p>}
          </div>
        </section>
      </aside>

      <main className="editor-panel">
        

        <header className="topbar">
          <div>
            <h2>{currentDoc ? draftTitle || 'Untitled document' : 'Select a document'}</h2>
            <p className="muted">
              {currentDoc
                ? `Editing as ${activeUser?.name || 'team member'} · ${isOwner ? 'owner access' : 'shared access'}`
                : 'Choose, create, or import a document to start editing.'}
            </p>
          </div>
          <div className="stats-row">
            {summaryStats.map((item) => (
              <div key={item.label} className={`stat-card ${item.tone}`}>
                <strong>{item.value}</strong>
                <span>{item.label}</span>
              </div>
            ))}
          </div>

          <div className="topbar-actions">
            <span className={`note-chip ${isDirty ? 'warning' : 'success-chip'}`}>
              {isDirty ? 'Unsaved changes' : 'All changes saved'}
            </span>
            <button className="primary-btn" onClick={handleSave} type="button" disabled={!currentDoc || saving}>
              {saving ? 'Saving...' : 'Save document'}
            </button>
          </div>
        </header>

        {message && <div className="banner success">{message}</div>}
        {error && <div className="banner error">{error}</div>}

        {loading ? (
          <div className="empty-state">Loading documents…</div>
        ) : currentDoc ? (
          <>
            <div className="editor-card">
              <div className="editor-meta">
                <span className="note-chip neutral">API: {API_BASE}</span>
                <span className="muted">Last saved: {formatDate(lastSavedAt)}</span>
              </div>

              <input
                className="title-input"
                value={draftTitle}
                onChange={(event) => {
                  setDraftTitle(event.target.value);
                  setIsDirty(true);
                }}
                placeholder="Document title"
              />

              <div className="toolbar">
                {toolbarActions.map((action) => (
                  <button
                    key={`${action.label}-${action.command}`}
                    type="button"
                    onClick={() => applyFormat(action.command, action.value)}
                    className="tool-btn"
                  >
                    {action.label}
                  </button>
                ))}
              </div>

              <div
                ref={editorRef}
                className="editor-surface"
                contentEditable
                suppressContentEditableWarning
                onInput={() => {
                  setDraftHtml(editorRef.current?.innerHTML || '');
                  setIsDirty(true);
                }}
              />
            </div>

            <div className="details-grid">
              <section className="info-card">
                <h3>Sharing</h3>
                <p className="muted">Switch users from the left panel to validate the owner/shared experience.</p>
                {isOwner ? (
                  <div className="share-row">
                    <select value={shareTarget} onChange={(event) => setShareTarget(event.target.value)}>
                      <option value="">Choose teammate</option>
                      {availableShareTargets.map((user) => (
                        <option key={user.id} value={user.id}>
                          {user.name}
                        </option>
                      ))}
                    </select>
                    <button className="secondary-btn" type="button" onClick={handleShare} disabled={!shareTarget}>
                      Share
                    </button>
                  </div>
                ) : (
                  <p className="note-chip">Only the owner can grant access.</p>
                )}

                <ul className="shared-list">
                  {currentDoc.sharedUsers?.length ? (
                    currentDoc.sharedUsers.map((user) => <li key={user.id}>{user.name}</li>)
                  ) : (
                    <li>No teammates added yet.</li>
                  )}
                </ul>
              </section>

              <section className="info-card">
                <h3>Document info</h3>
                <p><strong>Owner:</strong> {currentDoc.ownerName}</p>
                <p><strong>Last updated:</strong> {formatDate(currentDoc.updatedAt)}</p>
                <p><strong>Access:</strong> {isOwner ? 'Owner view' : 'Shared collaborator view'}</p>
                <p><strong>Tip:</strong> Press <code>Ctrl/Cmd + S</code> to save quickly.</p>
              </section>
            </div>
          </>
        ) : (
          <div className="empty-state">
            <h3>Ready to draft</h3>
            <p>Create a new document or import a text/markdown file from the left panel.</p>
          </div>
        )}
      </main>
    </div>
  );
}
