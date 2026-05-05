import DOMPurify from 'dompurify';

/** Sanitize untrusted HTML before `dangerouslySetInnerHTML`. */
export function sanitizeHtml(dirty: string): string {
  return DOMPurify.sanitize(dirty, { USE_PROFILES: { html: true } });
}
