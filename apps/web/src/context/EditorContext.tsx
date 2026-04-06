import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

interface EditorContextType {
  draftTitle: string;
  setDraftTitle: (title: string) => void;
  draftContent: string;
  setDraftContent: (content: string) => void;
  clearDraft: () => void;
}

const EditorContext = createContext<EditorContextType | undefined>(undefined);

export function EditorProvider({ children }: { children: ReactNode }) {
  const [draftTitle, setDraftTitle] = useState('');
  const [draftContent, setDraftContent] = useState('<p></p>');

  const clearDraft = useCallback(() => {
    setDraftTitle('');
    setDraftContent('<p></p>');
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
