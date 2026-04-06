import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';

const DECISIONS_KEY = 'review_decisions';
const COMMENTS_KEY = 'review_comments';

type Decision = { verdict: 'APPROVED' | 'DENIED'; comment: string };
type Comment = { text: string; time: string };

interface ReviewContextType {
  addDecision: (assignmentId: string, verdict: 'APPROVED' | 'DENIED', comment: string) => void;
  getDecision: (assignmentId: string) => Decision | null;
  addComment: (assignmentId: string, text: string) => void;
  getComments: (assignmentId: string) => Comment[];
}

const ReviewContext = createContext<ReviewContextType | undefined>(undefined);

function loadFromSession<T>(key: string, fallback: T): T {
  try {
    const raw = sessionStorage.getItem(key);
    if (raw) return JSON.parse(raw) as T;
  } catch { /* ignore */ }
  return fallback;
}

export function ReviewProvider({ children }: { children: ReactNode }) {
  const [decisions, setDecisions] = useState<Record<string, Decision>>(
    () => loadFromSession(DECISIONS_KEY, {})
  );
  const [comments, setComments] = useState<Record<string, Comment[]>>(
    () => loadFromSession(COMMENTS_KEY, {})
  );

  // Sync to sessionStorage whenever state changes
  useEffect(() => {
    sessionStorage.setItem(DECISIONS_KEY, JSON.stringify(decisions));
  }, [decisions]);

  useEffect(() => {
    sessionStorage.setItem(COMMENTS_KEY, JSON.stringify(comments));
  }, [comments]);

  const addDecision = useCallback((assignmentId: string, verdict: 'APPROVED' | 'DENIED', comment: string) => {
    setDecisions((prev) => ({ ...prev, [assignmentId]: { verdict, comment } }));
  }, []);

  const getDecision = useCallback((assignmentId: string): Decision | null => {
    return decisions[assignmentId] ?? null;
  }, [decisions]);

  const addComment = useCallback((assignmentId: string, text: string) => {
    setComments((prev) => ({
      ...prev,
      [assignmentId]: [...(prev[assignmentId] || []), { text, time: new Date().toISOString() }],
    }));
  }, []);

  const getComments = useCallback((assignmentId: string): Comment[] => {
    return comments[assignmentId] || [];
  }, [comments]);

  return (
    <ReviewContext.Provider value={{ addDecision, getDecision, addComment, getComments }}>
      {children}
    </ReviewContext.Provider>
  );
}

export function useReview() {
  const context = useContext(ReviewContext);
  if (context === undefined) {
    throw new Error('useReview must be used within a ReviewProvider');
  }
  return context;
}
