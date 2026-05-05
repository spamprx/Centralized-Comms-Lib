/** Matches the event_type used by the publish modal when sending WhatsApp for a content item. */
export function waPublishEventTypeForContent(contentId: string): string {
  return `CONTENT_PUBLISH_${contentId.slice(0, 8).toUpperCase()}`;
}

export function recipientDedupeKey(userId: string, waNumber: string): string {
  return `${userId.trim().toLowerCase()}\u0001${waNumber.replace(/\s/g, "").trim()}`;
}
