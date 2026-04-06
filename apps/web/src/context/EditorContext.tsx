import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';

const STORAGE_KEY = 'editor_draft';

interface EditorContextType {
  draftTitle: string;
  setDraftTitle: (title: string) => void;
  draftContent: string;
  setDraftContent: (content: string) => void;
  clearDraft: () => void;
}

const EditorContext = createContext<EditorContextType | undefined>(undefined);

function loadDraft(): { title: string; content: string } {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return { title: parsed.title ?? '', content: parsed.content ?? '<p></p>' };
    }
  } catch { /* ignore */ }
  return { title: '', content: '<p></p>' };
}

export function EditorProvider({ children }: { children: ReactNode }) {
  const [draftTitle, setDraftTitle] = useState(() => loadDraft().title);
  const [draftContent, setDraftContent] = useState(() => loadDraft().content);

  // Sync to sessionStorage whenever draft changes
  useEffect(() => {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ title: draftTitle, content: draftContent }));
  }, [draftTitle, draftContent]);

  const clearDraft = useCallback(() => {
    setDraftTitle('');
    setDraftContent('<p></p>');
    sessionStorage.removeItem(STORAGE_KEY);
  }, []);

  return (
    <EditorContext.Provider value={{ draftTitle, setDraftTitle, draftContent, setDraftContent, clearDraft }}>
      {children}
    </EditorContext.Provider>
  );
}

export function useEditorDraft() {
  const context = useContext(EditorContext);
  if (context === undefined) {
    throw new Error('useEditorDraft must be used within an EditorProvider');
  }
  return context;
}
