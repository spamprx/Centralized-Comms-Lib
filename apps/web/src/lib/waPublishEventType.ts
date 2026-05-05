/** Same as API `waPublishEventTypeForContent` — used when calling send-batch. */
export function waPublishEventTypeForContent(contentId: string): string {
  return `CONTENT_PUBLISH_${contentId.slice(0, 8).toUpperCase()}`;
}

/** Same as API `recipientDedupeKey` for overlap checks. */
export function recipientDedupeKey(userId: string, waNumber: string): string {
  return `${userId.trim().toLowerCase()}\u0001${waNumber.replace(/\s/g, '').trim()}`;
}
