import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface EditorState {
  draftTitle: string;
  draftContent: string;
  setDraftTitle: (title: string) => void;
  setDraftContent: (content: string) => void;
  clearDraft: () => void;
}

export const useEditorStore = create<EditorState>()(
  persist(
    (set) => ({
      draftTitle: '',
      draftContent: '<p></p>',
      setDraftTitle: (title) => set({ draftTitle: title }),
      setDraftContent: (content) => set({ draftContent: content }),
      clearDraft: () => set({ draftTitle: '', draftContent: '<p></p>' }),
    }),
    {
      name: 'editor-storage',
      storage: createJSONStorage(() => sessionStorage),
    },
  ),
);
