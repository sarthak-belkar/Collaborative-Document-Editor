import React, { useState, useEffect } from 'react';
import {
  Plus,
  FileText,
  Search,
  MoreVertical,
  Clock,
  ArrowRight,
  FolderOpen,
} from 'lucide-react';

interface DocumentHistoryItem {
  id: string;
  title: string;
  visitedAt: string;
}

interface DashboardProps {
  onSelectDocument: (id: string) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ onSelectDocument }) => {
  const [title, setTitle] = useState('');
  const [joinId, setJoinId] = useState('');
  const [history, setHistory] = useState<DocumentHistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Load history from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem('collab_doc_history');
      if (stored) {
        setHistory(JSON.parse(stored));
      }
    } catch (e) {
      console.error('Failed to load history', e);
    }
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title }),
      });

      if (!res.ok) throw new Error('Failed to create document');

      const doc = await res.json();

      const newItem: DocumentHistoryItem = {
        id: doc.id,
        title: doc.title,
        visitedAt: new Date().toLocaleString(),
      };

      const updatedHistory = [
        newItem,
        ...history.filter((item) => item.id !== doc.id),
      ].slice(0, 10);
      setHistory(updatedHistory);
      localStorage.setItem('collab_doc_history', JSON.stringify(updatedHistory));

      onSelectDocument(doc.id);
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinId.trim()) return;
    onSelectDocument(joinId.trim());
  };

  const handleHistoryClick = (id: string, docTitle: string) => {
    const updatedHistory = [
      { id, title: docTitle, visitedAt: new Date().toLocaleString() },
      ...history.filter((item) => item.id !== id),
    ].slice(0, 10);
    setHistory(updatedHistory);
    localStorage.setItem('collab_doc_history', JSON.stringify(updatedHistory));
    onSelectDocument(id);
  };

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Top Header Bar */}
      <header className="flex items-center px-4 py-2 border-b border-gdocs-border-light bg-white sticky top-0 z-30">
        <div className="flex items-center gap-2 mr-6">
          <svg viewBox="0 0 48 48" className="w-10 h-10" fill="none">
            <rect x="8" y="4" width="32" height="40" rx="3" fill="#4285F4" />
            <rect x="14" y="16" width="20" height="2.5" rx="1" fill="white" opacity="0.9" />
            <rect x="14" y="22" width="16" height="2.5" rx="1" fill="white" opacity="0.7" />
            <rect x="14" y="28" width="18" height="2.5" rx="1" fill="white" opacity="0.7" />
            <rect x="14" y="34" width="12" height="2.5" rx="1" fill="white" opacity="0.5" />
          </svg>
          <span className="text-[22px] text-gdocs-text-secondary font-normal">Docs</span>
        </div>

        {/* Search bar */}
        <div className="flex-1 max-w-2xl">
          <div className="flex items-center gap-3 bg-gdocs-bg-alt rounded-full px-5 py-2.5 hover:bg-gray-200/80 hover:shadow-sm transition-all focus-within:bg-white focus-within:shadow-md focus-within:border focus-within:border-transparent">
            <Search className="w-5 h-5 text-gdocs-text-secondary" />
            <input
              type="text"
              placeholder="Search"
              className="bg-transparent text-base text-gdocs-text outline-none flex-1 placeholder:text-gdocs-text-muted"
            />
          </div>
        </div>

        <div className="ml-auto" />
      </header>

      {/* Start a New Document Section */}
      <section className="bg-gdocs-bg border-b border-gdocs-border-light">
        <div className="max-w-5xl mx-auto px-6 py-6">
          <h2 className="text-sm font-medium text-gdocs-text-secondary mb-4">
            Start a new document
          </h2>

          <div className="flex gap-5 flex-wrap">
            {/* Blank document card */}
            <form onSubmit={handleCreate} className="flex flex-col gap-3">
              <button
                type="button"
                onClick={() => {
                  if (!title.trim()) {
                    setTitle('Untitled document');
                    setTimeout(() => {
                      const form = document.getElementById('create-form') as HTMLFormElement;
                      form?.requestSubmit();
                    }, 50);
                  }
                }}
                className="w-[164px] h-[212px] border-2 border-gdocs-border rounded-sm bg-white hover:border-gdocs-blue transition-colors flex items-center justify-center group doc-card"
              >
                <Plus className="w-12 h-12 text-gdocs-text-muted group-hover:text-gdocs-blue transition-colors" />
              </button>
              <span className="text-sm font-medium text-gdocs-text">Blank</span>
            </form>

            {/* Template placeholder cards */}
            {['Project Proposal', 'Meeting Notes', 'Letter'].map((tmpl) => (
              <div key={tmpl} className="flex flex-col gap-3">
                <button
                  onClick={() => {
                    setTitle(tmpl);
                    setTimeout(async () => {
                      try {
                        setLoading(true);
                        const res = await fetch('/api/documents', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ title: tmpl }),
                        });
                        if (!res.ok) throw new Error('Failed');
                        const doc = await res.json();
                        const newItem = {
                          id: doc.id,
                          title: doc.title,
                          visitedAt: new Date().toLocaleString(),
                        };
                        const updated = [
                          newItem,
                          ...history.filter((i) => i.id !== doc.id),
                        ].slice(0, 10);
                        setHistory(updated);
                        localStorage.setItem('collab_doc_history', JSON.stringify(updated));
                        onSelectDocument(doc.id);
                      } catch {
                        setError('Failed to create');
                      } finally {
                        setLoading(false);
                      }
                    }, 0);
                  }}
                  className="w-[164px] h-[212px] border border-gdocs-border rounded-sm bg-white hover:border-gdocs-blue transition-colors flex flex-col items-start p-4 doc-card"
                >
                  <FileText className="w-8 h-8 text-gdocs-blue mb-3" />
                  <div className="h-2 w-3/4 bg-gdocs-bg-alt rounded mb-2" />
                  <div className="h-2 w-1/2 bg-gdocs-bg-alt rounded mb-2" />
                  <div className="h-2 w-2/3 bg-gdocs-bg-alt rounded" />
                </button>
                <span className="text-sm font-medium text-gdocs-text">{tmpl}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Join by ID section */}
      <section className="max-w-5xl mx-auto px-6 py-4 w-full">
        <form onSubmit={handleJoin} id="create-form" className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-gdocs-bg-alt border border-gdocs-border rounded-lg px-3 py-2 flex-1 max-w-md focus-within:border-gdocs-blue focus-within:ring-1 focus-within:ring-gdocs-blue">
            <FolderOpen className="w-4 h-4 text-gdocs-text-muted" />
            <input
              type="text"
              placeholder="Enter document title or paste an ID to join…"
              value={title || joinId}
              onChange={(e) => {
                setTitle(e.target.value);
                setJoinId(e.target.value);
              }}
              className="bg-transparent text-sm text-gdocs-text outline-none flex-1 placeholder:text-gdocs-text-muted"
            />
          </div>
          <button
            type="submit"
            disabled={loading || (!title.trim() && !joinId.trim())}
            className="px-5 py-2 bg-gdocs-blue text-white text-sm font-medium rounded-lg hover:bg-gdocs-blue-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
            onClick={(e) => {
              // If it looks like a hex ID (24 chars), join it; otherwise create
              const val = (title || joinId).trim();
              if (val && /^[a-f0-9]{24}$/i.test(val)) {
                e.preventDefault();
                onSelectDocument(val);
              }
            }}
          >
            {loading ? 'Creating…' : 'Open'}
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>
        {error && <p className="text-sm text-red-500 mt-2">{error}</p>}
      </section>

      {/* Recent Documents */}
      <section className="flex-1 max-w-5xl mx-auto px-6 py-2 w-full">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-medium text-gdocs-text-secondary flex items-center gap-2">
            <Clock className="w-4 h-4" />
            Recent documents
          </h2>
        </div>

        {history.length === 0 ? (
          <div className="text-center py-16 text-gdocs-text-muted">
            <FileText className="w-16 h-16 mx-auto mb-4 opacity-30" />
            <p className="text-base">No documents yet</p>
            <p className="text-sm mt-1">
              Documents you create or open will appear here
            </p>
          </div>
        ) : (
          <div className="border border-gdocs-border-light rounded-lg overflow-hidden">
            {/* Table header */}
            <div className="flex items-center px-4 py-2.5 bg-gdocs-bg-alt text-xs font-medium text-gdocs-text-secondary border-b border-gdocs-border-light">
              <div className="flex-1">Title</div>
              <div className="w-48 text-right">Last opened</div>
              <div className="w-12" />
            </div>

            {/* Table rows */}
            {history.map((item) => (
              <div
                key={item.id}
                onClick={() => handleHistoryClick(item.id, item.title)}
                className="flex items-center px-4 py-3 hover:bg-blue-50/50 cursor-pointer border-b border-gdocs-border-light last:border-b-0 transition-colors group"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <FileText className="w-5 h-5 text-gdocs-blue flex-shrink-0" />
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-gdocs-text truncate group-hover:text-gdocs-blue transition-colors">
                      {item.title}
                    </div>
                    <div className="text-[10px] text-gdocs-text-muted font-mono truncate">
                      {item.id}
                    </div>
                  </div>
                </div>
                <div className="w-48 text-right text-xs text-gdocs-text-secondary">
                  {item.visitedAt}
                </div>
                <div className="w-12 flex justify-end">
                  <button
                    className="toolbar-btn opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <MoreVertical className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};
