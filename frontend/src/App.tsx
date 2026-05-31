import { useState, useEffect } from 'react';
import { Dashboard } from './components/dashboard/Dashboard';
import { EditorPage } from './components/editor/EditorPage';

function App() {
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);

  // Hash-based routing for shareable document links
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash;
      if (hash && hash.startsWith('#/doc/')) {
        const docId = hash.replace('#/doc/', '');
        if (docId) {
          setSelectedDocId(docId);
          return;
        }
      }
      setSelectedDocId(null);
    };

    // Initial check
    handleHashChange();

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const handleSelectDocument = (id: string) => {
    window.location.hash = `#/doc/${id}`;
    setSelectedDocId(id);
  };

  const handleBack = () => {
    window.location.hash = '';
    setSelectedDocId(null);
  };

  return (
    <>
      {selectedDocId ? (
        <EditorPage documentId={selectedDocId} onBack={handleBack} />
      ) : (
        <Dashboard onSelectDocument={handleSelectDocument} />
      )}
    </>
  );
}

export default App;
