import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

type Decision = { verdict: 'APPROVED' | 'DENIED'; comment: string };
type Comment = { text: string; time: string };

interface ReviewState {
  decisions: Record<string, Decision>;
  comments: Record<string, Comment[]>;
  addDecision: (assignmentId: string, verdict: 'APPROVED' | 'DENIED', comment: string) => void;
  getDecision: (assignmentId: string) => Decision | null;
  addComment: (assignmentId: string, text: string) => void;
  getComments: (assignmentId: string) => Comment[];
  draftDecisions: Record<string, 'APPROVED' | 'DENIED' | null>;
  draftDecisionComments: Record<string, string>;
  draftComments: Record<string, string>;
  setDraftDecision: (assignmentId: string, decision: 'APPROVED' | 'DENIED' | null) => void;
  setDraftDecisionComment: (assignmentId: string, comment: string) => void;
  setDraftComment: (assignmentId: string, comment: string) => void;
  clearDrafts: (assignmentId: string) => void;
}

export const useReviewStore = create<ReviewState>()(
  persist(
    (set, get) => ({
      decisions: {},
      comments: {},
      draftDecisions: {},
      draftDecisionComments: {},
      draftComments: {},
      addDecision: (assignmentId, verdict, comment) =>
        set((state) => ({
          decisions: {
            ...state.decisions,
            [assignmentId]: { verdict, comment },
          },
        })),
      getDecision: (assignmentId) => {
        return get().decisions[assignmentId] || null;
      },
      addComment: (assignmentId, text) =>
        set((state) => ({
          comments: {
            ...state.comments,
            [assignmentId]: [
              ...(state.comments[assignmentId] || []),
              { text, time: new Date().toISOString() },
            ],
          },
        })),
      getComments: (assignmentId) => {
        return get().comments[assignmentId] || [];
      },
      setDraftDecision: (assignmentId, decision) =>
        set((state) => ({
          draftDecisions: { ...state.draftDecisions, [assignmentId]: decision },
        })),
      setDraftDecisionComment: (assignmentId, comment) =>
        set((state) => ({
          draftDecisionComments: { ...state.draftDecisionComments, [assignmentId]: comment },
        })),
      setDraftComment: (assignmentId, comment) =>
        set((state) => ({
          draftComments: { ...state.draftComments, [assignmentId]: comment },
        })),
      clearDrafts: (assignmentId) =>
        set((state) => {
          const { [assignmentId]: _1, ...newDraftDecisions } = state.draftDecisions;
          const { [assignmentId]: _2, ...newDraftDecisionComments } = state.draftDecisionComments;
          const { [assignmentId]: _3, ...newDraftComments } = state.draftComments;
          return {
            draftDecisions: newDraftDecisions as Record<string, 'APPROVED' | 'DENIED' | null>,
            draftDecisionComments: newDraftDecisionComments,
            draftComments: newDraftComments,
          };
        }),
    }),
    {
      name: 'review-storage',
      storage: createJSONStorage(() => sessionStorage),
    }
  )
);
