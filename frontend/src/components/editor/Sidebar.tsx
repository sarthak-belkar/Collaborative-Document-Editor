import React from 'react';
import {
  FileText,
  Plus,
  Clock,
  ChevronLeft,
  Search,
} from 'lucide-react';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  onBack: () => void;
}

interface HistoryItem {
  id: string;
  title: string;
  visitedAt: string;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose, onBack }) => {
  // Load history from localStorage
  const getHistory = (): HistoryItem[] => {
    try {
      const stored = localStorage.getItem('collab_doc_history');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  };

  const history = getHistory();

  return (
    <>
      {/* Backdrop overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/20 z-40 transition-opacity"
          onClick={onClose}
        />
      )}

      {/* Sidebar panel */}
      <div
        className={`fixed top-0 left-0 h-full w-72 bg-white z-50 shadow-xl flex flex-col transition-transform duration-250 ease-[cubic-bezier(0.4,0,0.2,1)] ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gdocs-border-light">
          <div className="flex items-center gap-3">
            <svg viewBox="0 0 48 48" className="w-8 h-8" fill="none">
              <rect x="8" y="4" width="32" height="40" rx="3" fill="#4285F4" />
              <rect x="14" y="16" width="20" height="2.5" rx="1" fill="white" opacity="0.9" />
              <rect x="14" y="22" width="16" height="2.5" rx="1" fill="white" opacity="0.7" />
              <rect x="14" y="28" width="18" height="2.5" rx="1" fill="white" opacity="0.7" />
            </svg>
            <span className="text-lg font-medium text-gdocs-text">Docs</span>
          </div>
          <button
            onClick={onClose}
            className="toolbar-btn"
            title="Close sidebar"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
        </div>

        {/* Search */}
        <div className="px-3 py-2">
          <div className="flex items-center gap-2 px-3 py-2 bg-gdocs-bg-alt rounded-full">
            <Search className="w-4 h-4 text-gdocs-text-secondary" />
            <input
              type="text"
              placeholder="Search docs…"
              className="bg-transparent text-sm text-gdocs-text outline-none flex-1 placeholder:text-gdocs-text-muted"
            />
          </div>
        </div>

        {/* New document */}
        <button
          onClick={onBack}
          className="flex items-center gap-3 px-5 py-2.5 text-sm text-gdocs-blue font-medium hover:bg-blue-50 transition-colors"
        >
          <Plus className="w-4 h-4" />
          New document
        </button>

        {/* Divider */}
        <div className="h-px bg-gdocs-border-light mx-4" />

        {/* Recent documents */}
        <div className="px-4 pt-3 pb-1">
          <span className="text-xs font-medium text-gdocs-text-secondary uppercase tracking-wider flex items-center gap-1.5">
            <Clock className="w-3 h-3" />
            Recent
          </span>
        </div>

        <div className="flex-1 overflow-y-auto px-2">
          {history.length === 0 ? (
            <div className="text-center text-sm text-gdocs-text-muted py-8">
              No recent documents
            </div>
          ) : (
            history.map((item) => (
              <button
                key={item.id}
                className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-left hover:bg-gdocs-bg-alt transition-colors group"
                onClick={() => {
                  window.location.hash = `#/doc/${item.id}`;
                  onClose();
                }}
              >
                <FileText className="w-4 h-4 text-gdocs-blue flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="text-sm text-gdocs-text truncate font-medium">
                    {item.title}
                  </div>
                  <div className="text-[10px] text-gdocs-text-muted truncate">
                    {item.visitedAt}
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </>
  );
};
