import { useState, useEffect, useMemo, useRef, useCallback, type ChangeEvent } from 'react';
import {
  X,
  Send,
  Plus,
  Trash2,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  Upload,
  Link2,
  ChevronDown,
} from 'lucide-react';
import { contentService } from '../services/contentService';
import {
  whatsappSendService,
  type PriorSentRecipient,
} from '../services/whatsappSendService';
import { emailSendService } from '../services/emailSendService';
import { pushSendService } from '../services/pushSendService';
import { profileService } from '../services/profileService';
import { recipientDedupeKey, waPublishEventTypeForContent } from '../lib/waPublishEventType';
import {
  collectPlaceholderKeysFromBlocks,
  collectPlaceholderKeysFromRaw,
  mergePlaceholderManifests,
} from '../lib/waPlaceholderManifest';
import { parseRecipientsCsv, splitCsvLine } from '../lib/waRecipientsImport';
import { assetService } from '../services/assetService';
import { reviewService, type ReviewRequest } from '../services/reviewService';

export interface PublishWhatsAppModalProps {
  readonly contentId: string;
  readonly contentTitle: string;
  readonly onClose: () => void;
  readonly forcedChannel?: 'whatsapp' | 'email' | 'push';
  /** When user picks "review workflow", parent opens review UI and closes this modal. */
  readonly onChooseReviewWorkflow?: () => void;
}

type FlowStep = 'choose' | 'form';

type RecipientTableRow = {
  id: string;
  uid: string;
  contact: string;
  tokens: Record<string, string>;
};

type NotifyAttachment = {
  url: string;
  name?: string;
  mime_type?: string;
  delivery_mode?: 'auto' | 'link_only' | 'provider_media';
};

function newRowId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `r-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

function emptyRow(tokenKeys: readonly string[]): RecipientTableRow {
  const tokens: Record<string, string> = {};
  for (const k of tokenKeys) tokens[k] = '';
  return { id: newRowId(), uid: '', contact: '', tokens };
}

function buildBlocksFromBody(contentBody: unknown) {
  return [
    {
      id: 'body-block',
      type: 'richText' as const,
      props: {
        doc: contentBody as { type: 'doc'; content: unknown[] },
      },
    },
  ];
}

function parseEmailRecipientsCsv(
  csvText: string,
  tokenKeys: readonly string[],
): Array<{ user_id: string; email: string; field_values: Record<string, string> }> {
  const lines = csvText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (lines.length < 2) {
    throw new Error('CSV needs a header row and at least one data row');
  }
  const header = splitCsvLine(lines[0]).map((h) => h.replace(/^"|"$/g, '').trim());
  const lower = header.map((h) => h.toLowerCase());
  const userIdIdx = lower.indexOf('user_id');
  const emailIdx = lower.indexOf('email');
  if (userIdIdx < 0 || emailIdx < 0) {
    throw new Error('CSV header must include user_id and email');
  }
  const tokenIndexes = tokenKeys.map((k) => {
    const idx = lower.indexOf(k.toLowerCase());
    if (idx < 0) throw new Error(`Missing required column: ${k}`);
    return { key: k, idx };
  });

  const out: Array<{ user_id: string; email: string; field_values: Record<string, string> }> = [];
  for (let li = 1; li < lines.length; li++) {
    const cols = splitCsvLine(lines[li]).map((c) => c.replace(/^"|"$/g, '').trim());
    const field_values: Record<string, string> = {};
    for (const t of tokenIndexes) field_values[t.key] = cols[t.idx] ?? '';
    out.push({
      user_id: cols[userIdIdx] ?? '',
      email: cols[emailIdx] ?? '',
      field_values,
    });
  }
  return out;
}

function prettyAssetLabel(raw: string): string {
  const t = raw.trim();
  if (!t) return '';
  if (!/^https?:\/\//i.test(t)) return t;
  try {
    const u = new URL(t);
    const last = decodeURIComponent(u.pathname.split('/').pop() || '');
    if (!last) return 'Uploaded file';
    const parts = last.split('-');
    return parts.length > 1 ? parts.slice(1).join('-') : last;
  } catch {
    return t;
  }
}

function guessMimeFromUrl(rawUrl: string): string {
  const value = rawUrl.trim().toLowerCase();
  if (value.endsWith('.png')) return 'image/png';
  if (value.endsWith('.jpg') || value.endsWith('.jpeg')) return 'image/jpeg';
  if (value.endsWith('.webp')) return 'image/webp';
  if (value.endsWith('.gif')) return 'image/gif';
  if (value.endsWith('.mp4')) return 'video/mp4';
  if (value.endsWith('.mov')) return 'video/quicktime';
  if (value.endsWith('.webm')) return 'video/webm';
  if (value.endsWith('.mp3')) return 'audio/mpeg';
  if (value.endsWith('.wav')) return 'audio/wav';
  if (value.endsWith('.pdf')) return 'application/pdf';
  if (value.endsWith('.docx')) return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  if (value.endsWith('.xlsx')) return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  return 'application/octet-stream';
}

function resolveTokensInString(input: string, values: Record<string, string>): string {
  let output = input;
  for (const [k, v] of Object.entries(values)) {
    const escaped = k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    output = output.replace(new RegExp(`\\{\\{\\s*${escaped}\\s*\\}\\}`, 'g'), v);
    output = output.replace(new RegExp(`<\\s*${escaped}\\s*>`, 'g'), v);
  }
  return output;
}

function resolveTokensInNode(node: unknown, values: Record<string, string>): unknown {
  if (typeof node === 'string') return resolveTokensInString(node, values);
  if (Array.isArray(node)) return node.map((n) => resolveTokensInNode(n, values));
  if (!node || typeof node !== 'object') return node;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
    out[key] = resolveTokensInNode(value, values);
  }
  return out;
}

const UNRESOLVED_TOKEN_RE = /(\{\{\s*[\w.-]+\s*\}\})|(<\s*[\w.-]+\s*>)/;

function hasUnresolvedTokensInNode(node: unknown): boolean {
  if (typeof node === 'string') {
    return UNRESOLVED_TOKEN_RE.test(node);
  }
  if (Array.isArray(node)) {
    return node.some((item) => hasUnresolvedTokensInNode(item));
  }
  if (!node || typeof node !== 'object') return false;
  return Object.values(node as Record<string, unknown>).some((value) =>
    hasUnresolvedTokensInNode(value),
  );
}

const TOKEN_KEYS_DEPS = (keys: readonly string[]) =>
  [...keys].sort((a, b) => a.localeCompare(b)).join('\u0001');

export default function PublishWhatsAppModal({
  contentId,
  contentTitle,
  onClose,
  forcedChannel,
  onChooseReviewWorkflow,
}: PublishWhatsAppModalProps) {
  const [loading, setLoading] = useState(true);
  const [channelKey, setChannelKey] = useState<string | null>(null);
  const [contentBody, setContentBody] = useState<unknown>(null);
  const [hasLayoutBlocks, setHasLayoutBlocks] = useState(false);
  const [flowStep, setFlowStep] = useState<FlowStep>('choose');
  const [csvPasteText, setCsvPasteText] = useState('');
  const [priorRecipients, setPriorRecipients] = useState<PriorSentRecipient[]>([]);
  const [contentLifecycle, setContentLifecycle] = useState<string | null>(null);
  const [hasOpenReviewRequest, setHasOpenReviewRequest] = useState(false);
  const [markPublishedAfterSend, setMarkPublishedAfterSend] = useState(true);
  const [tableRows, setTableRows] = useState<RecipientTableRow[]>(() => [emptyRow([])]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [uploadingCell, setUploadingCell] = useState<string | null>(null);
  const [commonAttachments, setCommonAttachments] = useState<NotifyAttachment[]>([]);
  const [pushUsersLoading, setPushUsersLoading] = useState(false);
  const [pushUsersError, setPushUsersError] = useState<string | null>(null);
  const [pushUserSearch, setPushUserSearch] = useState('');
  const [pushUserOptions, setPushUserOptions] = useState<
    Array<{ id: string; name: string; email: string; isActive: boolean }>
  >([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const commonAttachmentInputRef = useRef<HTMLInputElement>(null);
  const csvImportInputRef = useRef<HTMLInputElement>(null);
  const uploadTargetRef = useRef<{ rowId: string; tokenKey: string } | null>(null);

  const manifest = useMemo(() => {
    if (!contentBody) {
      return { fieldTokens: [] as string[], mediaTokens: [] as string[], requiredRowKeys: [] as string[] };
    }
    const fromRaw = collectPlaceholderKeysFromRaw(contentBody);
    try {
      const fromBlocks = collectPlaceholderKeysFromBlocks(buildBlocksFromBody(contentBody) as never);
      return mergePlaceholderManifests(fromBlocks, fromRaw);
    } catch {
      return fromRaw;
    }
  }, [contentBody]);

  const mediaTokenSet = useMemo(() => new Set(manifest.mediaTokens), [manifest.mediaTokens]);
  const tokenKeysDep = TOKEN_KEYS_DEPS(manifest.requiredRowKeys);
  const isWhatsappChannel = channelKey === 'whatsapp';
  const isEmailChannel = channelKey === 'email';
  const isPushChannel = channelKey === 'push';
  const isSupportedChannel = isWhatsappChannel || isEmailChannel || isPushChannel;
  const channelLabel = isWhatsappChannel ? 'WhatsApp' : isEmailChannel ? 'Email' : 'Push';
  const forcedChannelMismatch = Boolean(
    forcedChannel && channelKey && forcedChannel !== channelKey,
  );

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const details = await contentService.getById(contentId);
        setContentLifecycle(details.content.lifecycleState);
        const chKey = details.channel?.key ?? null;
        setChannelKey(chKey);
        const requests: ReviewRequest[] = await reviewService.listForContent(contentId).catch(() => []);
        const hasOpen = requests.some((r) => String(r.status).toUpperCase() === 'OPEN');
        const hasCompleted = requests.some((r) => String(r.status).toUpperCase() === 'CLOSED');
        setHasOpenReviewRequest(hasOpen);
        setFlowStep(hasCompleted ? 'form' : 'choose');

        const bodyVersions = (details.versions ?? []).filter(
          (v) =>
            (v.changeType === 'MANUAL_SAVE' || v.changeType === 'AI_GENERATED') && v.body != null,
        );

        if (bodyVersions.length > 0) {
          const latest = bodyVersions.reduce((prev, curr) =>
            curr.versionNumber > prev.versionNumber ? curr : prev,
          bodyVersions[0]);
          setContentBody(latest.body);

          const body = latest.body as { content?: Array<{ type?: string }> } | null;
          if (body && Array.isArray(body.content)) {
            const hasIncompat = body.content.some(
              (node: { type?: string }) => node.type === 'media' || node.type === 'field',
            );
            setHasLayoutBlocks(hasIncompat);
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load content');
      } finally {
        setLoading(false);
      }
    })();
  }, [contentId]);

  const loadPriorRecipients = useCallback(async () => {
    try {
      const r = await whatsappSendService.listPriorRecipients(contentId);
      setPriorRecipients(r.items);
    } catch {
      setPriorRecipients([]);
    }
  }, [contentId]);

  useEffect(() => {
    if (loading || !isWhatsappChannel) return;
    void loadPriorRecipients();
  }, [loading, isWhatsappChannel, loadPriorRecipients]);

  useEffect(() => {
    if (!isPushChannel || flowStep !== 'form') return;
    if (pushUserOptions.length > 0 || pushUsersLoading) return;
    void (async () => {
      try {
        setPushUsersLoading(true);
        setPushUsersError(null);
        const out = await profileService.listPushRecipientCandidates();
        const mapped = out.map((u) => ({
          id: u.id,
          name: u.displayName || u.email,
          email: u.email,
          isActive: u.isActive,
        }));
        setPushUserOptions(mapped);
      } catch (err) {
        setPushUsersError(
          err instanceof Error
            ? err.message
            : 'Unable to load users for picker.',
        );
      } finally {
        setPushUsersLoading(false);
      }
    })();
  }, [isPushChannel, flowStep, pushUserOptions.length, pushUsersLoading]);

  const priorKeySet = useMemo(
    () => new Set(priorRecipients.map((p) => recipientDedupeKey(p.userId, p.waNumber))),
    [priorRecipients],
  );

  useEffect(() => {
    setTableRows((prev) => {
      const keys = manifest.requiredRowKeys;
      if (prev.length === 0) return [emptyRow(keys)];
      return prev.map((row) => {
        const tokens = { ...row.tokens };
        for (const k of keys) {
          if (!(k in tokens)) tokens[k] = '';
        }
        for (const o of Object.keys(tokens)) {
          if (!keys.includes(o)) delete tokens[o];
        }
        return { ...row, tokens };
      });
    });
  }, [tokenKeysDep]);

  const addRow = () => {
    setTableRows((prev) => [...prev, emptyRow(manifest.requiredRowKeys)]);
  };

  const addPushRecipientRow = (user: { id: string; email: string }) => {
    setTableRows((prev) => {
      const exists = prev.some((r) => r.uid.trim() === user.id);
      if (exists) return prev;
      const next = emptyRow(manifest.requiredRowKeys);
      return [...prev, { ...next, uid: user.id, contact: user.email }];
    });
  };

  const removeRow = (rowId: string) => {
    setTableRows((prev) => (prev.length <= 1 ? prev : prev.filter((r) => r.id !== rowId)));
  };

  const updateCell = (rowId: string, patch: Partial<Pick<RecipientTableRow, 'uid' | 'contact'>>) => {
    setTableRows((prev) => prev.map((r) => (r.id === rowId ? { ...r, ...patch } : r)));
  };

  const updateToken = (rowId: string, tokenKey: string, value: string) => {
    setTableRows((prev) =>
      prev.map((r) =>
        r.id === rowId ? { ...r, tokens: { ...r.tokens, [tokenKey]: value } } : r,
      ),
    );
  };

  const validateWa = (n: string) => /^\+\d{10,15}$/.test(n.trim());
  const validateEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());

  const applyAssetIdToToken = async (rowId: string, tokenKey: string) => {
    const raw = globalThis.prompt('Paste asset ID (from My assets or Library)');
    if (!raw?.trim()) return;
    setError(null);
    try {
      const { url } = await assetService.getViewLink(raw.trim(), 604800);
      updateToken(rowId, tokenKey, url);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not resolve asset view URL');
    }
  };

  const triggerUploadForCell = (rowId: string, tokenKey: string) => {
    uploadTargetRef.current = { rowId, tokenKey };
    fileInputRef.current?.click();
  };

  const addCommonAttachmentByUrl = () => {
    const raw = globalThis.prompt('Paste file URL to add as attachment');
    const url = raw?.trim() ?? '';
    if (!url) return;
    if (!/^https?:\/\//i.test(url)) {
      setError('Attachment URL must start with http:// or https://');
      return;
    }
    setCommonAttachments((prev) => [
      ...prev,
      {
        url,
        name: prettyAssetLabel(url),
        mime_type: guessMimeFromUrl(url),
        delivery_mode: 'auto',
      },
    ]);
  };

  const addCommonAttachmentByAssetId = async () => {
    const raw = globalThis.prompt('Paste asset ID (from My assets or Library)');
    if (!raw?.trim()) return;
    setError(null);
    try {
      const { url } = await assetService.getViewLink(raw.trim(), 604800);
      setCommonAttachments((prev) => [
        ...prev,
        {
          url,
          name: prettyAssetLabel(url),
          mime_type: guessMimeFromUrl(url),
          delivery_mode: 'auto',
        },
      ]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not resolve asset view URL');
    }
  };

  const removeCommonAttachment = (idx: number) => {
    setCommonAttachments((prev) => prev.filter((_, i) => i !== idx));
  };

  const onCommonAttachmentFileSelected = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError(null);
    try {
      const { viewUrl } = await assetService.uploadFile(file, { placement: 'MY_ASSETS' });
      setCommonAttachments((prev) => [
        ...prev,
        {
          url: viewUrl,
          name: file.name,
          mime_type: file.type || guessMimeFromUrl(file.name),
          delivery_mode: 'auto',
        },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Attachment upload failed');
    }
  };

  const onAssetFileSelected = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    const target = uploadTargetRef.current;
    uploadTargetRef.current = null;
    if (!file || !target) return;
    const cellKey = `${target.rowId}:${target.tokenKey}`;
    setError(null);
    setUploadingCell(cellKey);
    try {
      const { viewUrl } = await assetService.uploadFile(file, { placement: 'MY_ASSETS' });
      updateToken(target.rowId, target.tokenKey, viewUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploadingCell(null);
    }
  };

  const fillTableFromCsvText = (csvText: string) => {
    const parsed = isWhatsappChannel
      ? parseRecipientsCsv(csvText, manifest.requiredRowKeys).map((r) => ({
          user_id: r.user_id,
          contact: r.wa_number,
          field_values: r.field_values,
        }))
      : parseEmailRecipientsCsv(csvText, manifest.requiredRowKeys).map((r) => ({
          user_id: r.user_id,
          contact: r.email,
          field_values: r.field_values,
        }));
    const mapped: RecipientTableRow[] = parsed.map((r) => ({
      id: newRowId(),
      uid: r.user_id,
      contact: r.contact,
      tokens: Object.fromEntries(manifest.requiredRowKeys.map((k) => [k, r.field_values[k] ?? ''])),
    }));
    setTableRows(mapped.length > 0 ? mapped : [emptyRow(manifest.requiredRowKeys)]);
    setCsvPasteText('');
  };

  const applyCsvPaste = () => {
    setError(null);
    try {
      fillTableFromCsvText(csvPasteText);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'CSV import failed');
    }
  };

  const onRecipientsCsvFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError(null);
    try {
      const text = await file.text();
      fillTableFromCsvText(text);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not read CSV file');
    }
  };

  const handleSend = async () => {
    setError(null);
    setSuccess(null);

    const blocks = buildBlocksFromBody(contentBody);
    const event_type = waPublishEventTypeForContent(contentId);

    const validRows = tableRows.filter((r) =>
      isPushChannel ? r.uid.trim() : r.uid.trim() && r.contact.trim(),
    );
    if (validRows.length === 0) {
      setError(
        isWhatsappChannel
          ? 'Add at least one row with uid and number (WhatsApp uses international +E.164).'
          : isEmailChannel
            ? 'Add at least one row with uid and email.'
            : 'Add at least one row with uid.',
      );
      return;
    }

    for (const r of validRows) {
      if (isWhatsappChannel && !validateWa(r.contact)) {
        setError(
          `Row "${r.uid.trim()}": number must be WhatsApp international format (e.g. +919390223741).`,
        );
        return;
      }
      if (isEmailChannel && !validateEmail(r.contact)) {
        setError(`Row "${r.uid.trim()}": invalid email format.`);
        return;
      }
      for (const k of manifest.requiredRowKeys) {
        if (!(r.tokens[k] ?? '').trim()) {
          setError(`Row "${r.uid.trim()}": missing value for token "${k}".`);
          return;
        }
      }
    }

    const resendRows = isWhatsappChannel
      ? validRows.filter((r) => priorKeySet.has(recipientDedupeKey(r.uid.trim(), r.contact.trim())))
      : [];
    if (isWhatsappChannel && resendRows.length > 0) {
      const sample = resendRows
        .slice(0, 5)
        .map((r) => `${r.uid.trim()} / ${r.contact.trim()}`)
        .join('; ');
      const more = resendRows.length > 5 ? ` (+${resendRows.length - 5} more)` : '';
      const ok = globalThis.confirm(
        `Already sent for this content to: ${sample}${more}. Sending again will deliver another WhatsApp to those recipients. Continue?`,
      );
      if (!ok) return;
    }

    setSending(true);
    try {
      let sentCount = 0;
      if (isPushChannel) {
        const rowsForBatch = validRows.map((r) => ({
          user_id: r.uid.trim(),
          field_values: Object.fromEntries(
            manifest.requiredRowKeys.map((k) => [k, (r.tokens[k] ?? '').trim()]),
          ),
        }));
        const settled = await Promise.allSettled(
          rowsForBatch.map(async (row) => {
            const resolvedBlocks = resolveTokensInNode(blocks, row.field_values) as unknown[];
            if (hasUnresolvedTokensInNode(resolvedBlocks)) {
              throw new Error(
                `Row "${row.user_id}": unresolved placeholders remain after token substitution.`,
              );
            }
            return pushSendService.send({
              event_type,
              blocks: resolvedBlocks,
              recipients: [{ user_id: row.user_id }],
              title: contentTitle,
            });
          }),
        );
        const failed = settled.filter((r) => r.status === 'rejected');
        sentCount = settled.length - failed.length;
        if (failed.length > 0) {
          const firstFail = failed[0];
          const failReason = firstFail.status === 'rejected' ? String(firstFail.reason ?? '') : '';
          setError(
            `Push send failed for ${failed.length} recipient(s). Sent: ${sentCount}.${failReason ? ` First error: ${failReason}` : ''}`,
          );
          return;
        }
      } else {
        const rowsForBatch = validRows.map((r) => ({
          user_id: r.uid.trim(),
          contact: r.contact.trim(),
          field_values: Object.fromEntries(
            manifest.requiredRowKeys.map((k) => [k, (r.tokens[k] ?? '').trim()]),
          ),
        }));
        const settled = await Promise.allSettled(
          rowsForBatch.map(async (row) => {
            const resolvedBlocks = resolveTokensInNode(blocks, row.field_values) as unknown[];
            if (hasUnresolvedTokensInNode(resolvedBlocks)) {
              throw new Error(
                `Row "${row.user_id}": unresolved placeholders remain after token substitution.`,
              );
            }
            const rowAttachments: NotifyAttachment[] = [
              ...commonAttachments.map((a) => ({ ...a })),
              ...manifest.mediaTokens
                .map((token) => (row.field_values[token] ?? '').trim())
                .filter((v) => /^https?:\/\//i.test(v))
                .map((url) => ({
                  url,
                  name: prettyAssetLabel(url),
                  mime_type: guessMimeFromUrl(url),
                  delivery_mode: 'auto' as const,
                })),
            ];
            const dedupedAttachments = rowAttachments.filter(
              (att, idx, arr) => arr.findIndex((x) => x.url === att.url) === idx,
            );
            if (isWhatsappChannel) {
              return whatsappSendService.send({
                event_type,
                blocks: resolvedBlocks,
                recipients: [{ user_id: row.user_id, wa_number: row.contact }],
                attachments: dedupedAttachments,
              });
            }
            return emailSendService.send({
              event_type,
              blocks: resolvedBlocks,
              recipients: [{ user_id: row.user_id, email: row.contact }],
              subject: contentTitle,
              attachments: dedupedAttachments,
            });
          }),
        );
        const failed = settled.filter((r) => r.status === 'rejected');
        sentCount = settled.length - failed.length;
        if (failed.length > 0) {
          const firstFail = failed[0];
          const failReason = firstFail.status === 'rejected' ? String(firstFail.reason ?? '') : '';
          const channelName = isWhatsappChannel ? 'WhatsApp' : 'email';
          setError(
            `${channelName} send failed for ${failed.length} recipient(s). Sent: ${sentCount}.${failReason ? ` First error: ${failReason}` : ''}`,
          );
          return;
        }
      }

      if (isWhatsappChannel) void loadPriorRecipients();

      if (markPublishedAfterSend) {
        try {
          await contentService.transitionState(contentId, 'PUBLISHED', {
            bypassReviewQuorumForChannelPublish: true,
          });
        } catch (pubErr) {
          setSuccess(
            `Sent via ${isWhatsappChannel ? 'WhatsApp' : 'email'}. Could not mark published: ${pubErr instanceof Error ? pubErr.message : String(pubErr)}`,
          );
          return;
        }
      }

      setSuccess(
        `Published via ${channelLabel} successfully (${sentCount} recipient${sentCount === 1 ? '' : 's'}).`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to publish');
    } finally {
      setSending(false);
    }
  };

  const renderUnsupported = (message: string) => (
    <div className="flex flex-col items-center gap-3 py-8 text-center">
      <AlertTriangle size={36} className="text-amber-400" />
      <p className="text-sm text-app-muted">{message}</p>
      <button
        type="button"
        onClick={onClose}
        className="mt-2 rounded-app-md border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-app-text transition-colors hover:bg-white/10"
      >
        Close
      </button>
    </div>
  );

  const renderChoose = () => (
    <div className="space-y-4 py-2">
      <p className="text-xs text-app-muted">
        Choose how you want to ship this channel-bound content. Direct publish sends now
        (and can mark the item published). Review workflow opens the usual review request first.
      </p>
      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={() => setFlowStep('form')}
          disabled={hasOpenReviewRequest}
          className="rounded-app-md border border-emerald-400/40 bg-emerald-500/15 px-4 py-3 text-left text-xs font-semibold text-emerald-200 transition-colors hover:bg-emerald-500/25"
        >
          {hasOpenReviewRequest
            ? 'Send now (disabled: open review present)'
            : `Send now (direct ${channelLabel} publish)`}
        </button>
        <button
          type="button"
          onClick={() => {
            onChooseReviewWorkflow?.();
            onClose();
          }}
          className="rounded-app-md border border-white/10 bg-white/5 px-4 py-3 text-left text-xs font-semibold text-app-text transition-colors hover:bg-white/10"
        >
          Use review workflow first
        </button>
      </div>
      {hasOpenReviewRequest ? (
        <p className="rounded-app-sm border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-200">
          Open review request present. Publishing is disabled until that request is closed.
        </p>
      ) : null}
    </div>
  );

  const filteredPushUsers = useMemo(() => {
    const q = pushUserSearch.trim().toLowerCase();
    if (!q) return pushUserOptions.slice(0, 20);
    return pushUserOptions
      .filter((u) => {
        const hay = `${u.name} ${u.email} ${u.id}`.toLowerCase();
        return hay.includes(q);
      })
      .slice(0, 20);
  }, [pushUserOptions, pushUserSearch]);

  return (
    <div className="fixed inset-0 z-[9000] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        aria-label="Upload file for media token URL"
        title="Upload file for media token URL"
        accept="*/*"
        onChange={(e) => void onAssetFileSelected(e)}
      />
      <input
        ref={commonAttachmentInputRef}
        type="file"
        className="hidden"
        aria-label="Upload common attachment"
        title="Upload common attachment"
        accept="*/*"
        onChange={(e) => void onCommonAttachmentFileSelected(e)}
      />
      <input
        ref={csvImportInputRef}
        type="file"
        className="hidden"
        aria-label="Import recipients from CSV file"
        title="Import recipients from CSV file"
        accept=".csv,text/csv,text/plain"
        onChange={(e) => void onRecipientsCsvFile(e)}
      />
      <div className="relative max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-app-xl border border-white/10 bg-app-bg shadow-app-lift">
        <div className="flex items-center justify-between border-b border-white/8 px-5 py-4">
          <h2 className="text-sm font-semibold text-app-text">Publish — {contentTitle}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-app-md p-1.5 text-app-muted transition-colors hover:bg-white/8 hover:text-app-text"
            title="Close"
          >
            <X size={16} aria-hidden />
          </button>
        </div>

        <div className="px-5 py-5">
          {loading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 size={24} className="animate-spin text-app-muted" />
            </div>
          )}
          {!loading && channelKey && forcedChannelMismatch &&
            renderUnsupported(
              `This content is bound to "${channelKey}". Open the ${channelKey} publish modal instead.`,
            )}
          {!loading && channelKey && !isSupportedChannel && !forcedChannelMismatch &&
            renderUnsupported(
              `Channel "${channelKey}" is not yet implemented. Only WhatsApp, email, and push publish are supported.`,
            )}
          {!loading && !channelKey &&
            renderUnsupported('This content does not have a channel binding.')}
          {!loading && isSupportedChannel && hasLayoutBlocks &&
            renderUnsupported(
              'This content uses layout media or field blocks. Export a version with inline tokens only, or remove those blocks.',
            )}
          {!loading &&
            isSupportedChannel &&
            !forcedChannelMismatch &&
            !hasLayoutBlocks &&
            flowStep === 'choose' && (
            <>
              {renderChoose()}
              <div className="mt-4 flex justify-end">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-app-md border border-white/10 bg-white/5 px-4 py-2 text-xs text-app-muted hover:bg-white/10"
                >
                  Cancel
                </button>
              </div>
            </>
          )}
          {!loading &&
            isSupportedChannel &&
            !forcedChannelMismatch &&
            !hasLayoutBlocks &&
            flowStep === 'form' && (
            <div className="flex flex-col gap-4">
              <button
                type="button"
                onClick={() => setFlowStep('choose')}
                className="self-start text-xs text-app-accent hover:underline"
              >
                ← Back
              </button>

              {/* Status & history */}
              {isWhatsappChannel ? (
                <details
                  className="group rounded-app-md border border-white/10 bg-white/[0.02] open:border-white/[0.14]"
                  open={contentLifecycle === 'PUBLISHED' || priorRecipients.length > 0}
                >
                <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2.5 text-xs font-medium text-app-text hover:bg-white/[0.04] [&::-webkit-details-marker]:hidden">
                  <ChevronDown
                    size={14}
                    className="shrink-0 text-app-muted transition-transform group-open:rotate-180"
                    aria-hidden
                  />
                  Status & prior sends
                  {priorRecipients.length > 0 ? (
                    <span className="ml-auto rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-normal tabular-nums text-app-muted">
                      {priorRecipients.length} sent
                    </span>
                  ) : null}
                </summary>
                <div className="space-y-2 border-t border-white/8 px-3 py-3 text-[11px] leading-relaxed">
                  {contentLifecycle === 'PUBLISHED' ? (
                    <p className="rounded-app-sm border border-sky-400/20 bg-sky-500/10 px-2.5 py-1.5 text-sky-100/95">
                      Already <strong className="text-app-text">Published</strong> — you can send again. Duplicates
                      show below and in the table; publish will ask to confirm resends.
                    </p>
                  ) : null}
                  {priorRecipients.length === 0 ? (
                    <p className="text-app-muted">
                      {isWhatsappChannel
                        ? 'No successful WhatsApp sends on file for this content yet.'
                        : 'No prior send history shown for email channel.'}
                    </p>
                  ) : (
                    <ul className="max-h-28 space-y-1 overflow-y-auto rounded-app-sm border border-white/8 bg-black/15 px-2 py-2 font-mono text-[10px] text-app-text">
                      {priorRecipients.map((p) => (
                        <li key={recipientDedupeKey(p.userId, p.waNumber)} className="text-app-muted">
                          <span className="text-app-text">{p.userId}</span>
                          <span className="text-white/25"> · </span>
                          <span className="text-app-text">{p.waNumber}</span>
                          {p.lastSentAt ? (
                            <span className="ml-1 font-sans text-[10px] text-app-muted">
                              {new Date(p.lastSentAt).toLocaleString()}
                            </span>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  )}
                  {priorKeySet.size > 0 ? (
                    <p className="text-amber-200/85">
                      Amber rows in the table match a prior send — you will confirm before resending.
                    </p>
                  ) : null}
                </div>
                </details>
              ) : contentLifecycle === 'PUBLISHED' ? (
                <div className="rounded-app-md border border-sky-400/20 bg-sky-500/10 px-3 py-2.5 text-[11px] text-sky-100/95">
                  Already <strong className="text-app-text">Published</strong> — sending again will republish via {channelLabel}.
                </div>
              ) : null}

              {/* CSV import */}
              {!isPushChannel ? (
                <details className="group rounded-app-md border border-white/10 bg-white/[0.02]">
                <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2.5 text-xs font-medium text-app-text hover:bg-white/[0.04] [&::-webkit-details-marker]:hidden">
                  <ChevronDown
                    size={14}
                    className="shrink-0 text-app-muted transition-transform group-open:rotate-180"
                    aria-hidden
                  />
                  Import from CSV
                </summary>
                <div className="space-y-3 border-t border-white/8 px-3 py-3 text-[11px]">
                  <p className="text-app-muted">
                    Header must include{' '}
                    <code className="rounded bg-white/10 px-1 py-px font-mono text-app-text">user_id</code>,{' '}
                    <code className="rounded bg-white/10 px-1 py-px font-mono text-app-text">
                      {isWhatsappChannel ? 'wa_number' : 'email'}
                    </code>
                    {manifest.requiredRowKeys.length > 0 ? (
                      <>
                        {', '}
                        {manifest.requiredRowKeys.map((k) => (
                          <code
                            key={k}
                            className="mr-1 inline rounded bg-white/10 px-1 py-px font-mono text-app-text"
                          >
                            {k}
                          </code>
                        ))}
                      </>
                    ) : null}
                    . Replaces the table below. Quoted CSV fields are supported.
                  </p>
                  <button
                    type="button"
                    onClick={() => csvImportInputRef.current?.click()}
                    className="rounded-app-md border border-white/12 bg-white/5 px-3 py-2 text-xs font-medium text-app-text hover:bg-white/10"
                  >
                    Choose CSV file…
                  </button>
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-medium uppercase tracking-wide text-app-muted">
                      Or paste CSV
                    </span>
                    <textarea
                      value={csvPasteText}
                      onChange={(e) => setCsvPasteText(e.target.value)}
                      placeholder={
                        isWhatsappChannel
                          ? 'user_id,wa_number,firstName\nc1,+91888...,Ada'
                          : 'user_id,email,firstName\nu1,ada@example.com,Ada'
                      }
                      rows={3}
                      className="w-full rounded-app-md border border-white/10 bg-black/25 px-2 py-2 font-mono text-[11px] text-app-text outline-none focus:border-app-accent/35"
                    />
                    <button
                      type="button"
                      onClick={() => applyCsvPaste()}
                      className="rounded-app-md border border-white/12 bg-white/5 px-3 py-1.5 text-[11px] font-medium text-app-text hover:bg-white/10"
                    >
                      Apply pasted CSV to table
                    </button>
                  </div>
                </div>
                </details>
              ) : null}

              {/* Recipients table */}
              {isPushChannel ? (
                <section className="overflow-hidden rounded-app-md border border-white/10 bg-white/[0.02]">
                  <div className="border-b border-white/8 bg-white/[0.03] px-3 py-2">
                    <h3 className="text-xs font-semibold text-app-text">Push recipient picker</h3>
                    <p className="mt-1 text-[11px] text-app-muted">
                      Add recipients by user account. Push sends to all registered device tokens for each selected user.
                    </p>
                  </div>
                  <div className="space-y-2 px-3 py-3">
                    <input
                      value={pushUserSearch}
                      onChange={(e) => setPushUserSearch(e.target.value)}
                      placeholder="Search by name, email, or user id"
                      className="h-9 w-full rounded-app-md border border-white/10 bg-black/25 px-2 text-xs text-app-text outline-none placeholder:text-app-muted/40"
                    />
                    {pushUsersLoading ? (
                      <p className="text-[11px] text-app-muted">Loading users...</p>
                    ) : null}
                    {pushUsersError ? (
                      <p className="text-[11px] text-amber-200/90">
                        {pushUsersError}
                      </p>
                    ) : null}
                    {!pushUsersLoading && !pushUsersError ? (
                      <div className="max-h-40 overflow-y-auto rounded-app-sm border border-white/8 bg-black/15">
                        {filteredPushUsers.length === 0 ? (
                          <p className="px-2 py-2 text-[11px] text-app-muted">No matching users.</p>
                        ) : (
                          filteredPushUsers.map((u) => (
                            <button
                              key={u.id}
                              type="button"
                              onClick={() => addPushRecipientRow(u)}
                              className="flex w-full items-center justify-between border-b border-white/6 px-2 py-1.5 text-left text-[11px] hover:bg-white/10 last:border-b-0"
                              title={u.id}
                            >
                              <span className="min-w-0">
                                <span className="block truncate text-app-text">{u.name}</span>
                                <span className="block truncate text-app-muted">{u.email}</span>
                              </span>
                              <span className={`ml-2 shrink-0 rounded px-1.5 py-0.5 text-[10px] ${
                                u.isActive ? 'bg-emerald-500/20 text-emerald-200' : 'bg-red-500/20 text-red-200'
                              }`}>
                                {u.isActive ? 'active' : 'inactive'}
                              </span>
                            </button>
                          ))
                        )}
                      </div>
                    ) : null}
                  </div>
                </section>
              ) : null}

              {isPushChannel ? (
                <section className="overflow-hidden rounded-app-md border border-white/10 bg-white/[0.02]">
                  <div className="border-b border-white/8 bg-white/[0.03] px-3 py-2">
                    <h3 className="text-xs font-semibold text-app-text">Selected recipients</h3>
                    <p className="mt-1 text-[11px] text-app-muted">
                      Fill placeholder token values here for each push recipient.
                    </p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[420px] border-collapse text-left text-[11px]">
                      <thead>
                        <tr className="border-b border-white/10 bg-white/[0.04]">
                          <th className="border-r border-white/8 px-2 py-2 font-semibold text-app-text">
                            uid
                          </th>
                          <th className="border-r border-white/8 px-2 py-2 font-semibold text-app-text">
                            contact
                          </th>
                          {manifest.requiredRowKeys.map((key) => (
                            <th
                              key={key}
                              className="border-r border-white/8 px-2 py-2 font-semibold text-app-text last:border-r-0"
                            >
                              <span className="font-mono">{key}</span>
                            </th>
                          ))}
                          <th className="w-10 px-1 py-2 text-center text-app-muted"> </th>
                        </tr>
                      </thead>
                      <tbody>
                        {tableRows.filter((r) => r.uid.trim()).length === 0 ? (
                          <tr>
                            <td
                              colSpan={Math.max(3, manifest.requiredRowKeys.length + 3)}
                              className="px-2 py-3 text-app-muted"
                            >
                              No recipients selected yet.
                            </td>
                          </tr>
                        ) : (
                          tableRows
                            .filter((r) => r.uid.trim())
                            .map((row) => (
                              <tr key={row.id} className="border-b border-white/8 last:border-b-0">
                                <td className="border-r border-white/8 px-2 py-2 text-app-text">
                                  {row.uid}
                                </td>
                                <td className="border-r border-white/8 px-2 py-2 text-app-muted">
                                  {row.contact || '-'}
                                </td>
                                {manifest.requiredRowKeys.map((key) => (
                                  <td
                                    key={key}
                                    className="border-r border-white/8 p-0 align-top last:border-r-0"
                                  >
                                    <input
                                      type="text"
                                      value={row.tokens[key] ?? ''}
                                      onChange={(e) => updateToken(row.id, key, e.target.value)}
                                      placeholder="value"
                                      className="box-border h-9 w-full min-w-[96px] bg-transparent px-2 text-xs text-app-text outline-none placeholder:text-app-muted/40"
                                    />
                                  </td>
                                ))}
                                <td className="p-0 align-middle text-center">
                                  <button
                                    type="button"
                                    onClick={() => removeRow(row.id)}
                                    className="rounded-app-md p-1.5 text-red-400/70 transition-colors hover:bg-red-500/10 hover:text-red-400"
                                    title="Remove recipient"
                                  >
                                    <Trash2 size={14} aria-hidden />
                                  </button>
                                </td>
                              </tr>
                            ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </section>
              ) : (
                <section className="overflow-hidden rounded-app-md border border-white/10 bg-white/[0.02]">
                <div className="border-b border-white/8 bg-white/[0.03] px-3 py-2">
                  <h3 className="text-xs font-semibold text-app-text">Recipients</h3>
                  <p className="mt-1 text-[11px] leading-snug text-app-muted">
                    One row per person. <span className="text-app-text">uid</span> →{' '}
                    <code className="font-mono text-[10px] text-app-text/90">user_id</code>;{' '}
                    {isWhatsappChannel
                      ? <>number column = WhatsApp <span className="text-app-text">+E.164</span>.</>
                      : isEmailChannel
                        ? <>email column = recipient email address.</>
                        : <>contact column is optional for push; delivery uses stored device tokens per user.</>
                    }{' '}
                    Tokens = body placeholders;{' '}
                    <span className="text-amber-200/90">media</span>: link = asset ID URL, upload = file to My assets.
                  </p>
                </div>
                <div className="overflow-x-auto">
                <table className="w-full min-w-[520px] border-collapse text-left text-[11px]">
                  <thead>
                    <tr className="border-b border-white/10 bg-white/[0.04]">
                      <th className="border-r border-white/8 px-2 py-2 font-semibold text-app-text">
                        uid
                        <div className="font-normal text-app-muted">→ user_id</div>
                      </th>
                      <th className="border-r border-white/8 px-2 py-2 font-semibold text-app-text">
                        {isWhatsappChannel ? 'number' : isEmailChannel ? 'email' : 'contact'}
                        <div className="font-normal text-app-muted">
                          {isWhatsappChannel
                            ? 'WhatsApp +E.164'
                            : isEmailChannel
                              ? 'Recipient email'
                              : 'Optional'}
                        </div>
                      </th>
                      {manifest.requiredRowKeys.map((key) => (
                        <th
                          key={key}
                          className="border-r border-white/8 px-2 py-2 font-semibold text-app-text last:border-r-0"
                        >
                          <span className="font-mono">{key}</span>
                          {mediaTokenSet.has(key) && (
                            <span className="ml-1 rounded bg-amber-500/25 px-1 py-0.5 text-[10px] font-normal text-amber-200">
                              media
                            </span>
                          )}
                        </th>
                      ))}
                      <th className="w-10 px-1 py-2 text-center text-app-muted"> </th>
                    </tr>
                  </thead>
                  <tbody>
                    {tableRows.map((row) => {
                      const dedupe =
                        row.uid.trim() && row.contact.trim()
                          ? recipientDedupeKey(row.uid, row.contact)
                          : '';
                      const isResend = isWhatsappChannel && dedupe !== '' && priorKeySet.has(dedupe);
                      return (
                      <tr
                        key={row.id}
                        className={`border-b border-white/8 last:border-b-0 ${isResend ? 'bg-amber-500/[0.07]' : ''}`}
                      >
                        <td className="border-r border-white/8 p-0 align-top">
                          <input
                            type="text"
                            value={row.uid}
                            onChange={(e) => updateCell(row.id, { uid: e.target.value })}
                            placeholder="c1"
                            className="box-border h-9 w-full min-w-[72px] bg-transparent px-2 text-xs text-app-text outline-none placeholder:text-app-muted/40"
                          />
                        </td>
                        <td className="border-r border-white/8 p-0 align-top">
                          <input
                            type="text"
                            value={row.contact}
                            onChange={(e) => updateCell(row.id, { contact: e.target.value })}
                            placeholder={
                              isWhatsappChannel
                                ? '+91…'
                                : isEmailChannel
                                  ? 'user@example.com'
                                  : 'optional'
                            }
                            className="box-border h-9 w-full min-w-[120px] bg-transparent px-2 text-xs text-app-text outline-none placeholder:text-app-muted/40"
                          />
                        </td>
                        {manifest.requiredRowKeys.map((key) => {
                          const isMedia = mediaTokenSet.has(key);
                          const cellBusy = uploadingCell === `${row.id}:${key}`;
                          return (
                            <td key={key} className="border-r border-white/8 p-0 align-top last:border-r-0">
                              <div className="flex items-stretch gap-0.5">
                                <input
                                  type="text"
                                  value={
                                    isMedia
                                      ? prettyAssetLabel(row.tokens[key] ?? '')
                                      : (row.tokens[key] ?? '')
                                  }
                                  onChange={(e) => {
                                    if (isMedia) return;
                                    updateToken(row.id, key, e.target.value);
                                  }}
                                  placeholder={isMedia ? 'Use link/upload buttons →' : 'value'}
                                  readOnly={isMedia}
                                  title={isMedia ? (row.tokens[key] ?? '') : undefined}
                                  className="box-border min-h-9 min-w-[96px] flex-1 bg-transparent px-2 py-1.5 text-xs text-app-text outline-none placeholder:text-app-muted/40"
                                />
                                {isMedia && (
                                  <div className="flex shrink-0 flex-col justify-center gap-0.5 border-l border-white/8 py-0.5 pl-0.5 pr-0.5">
                                    <button
                                      type="button"
                                      title="Insert URL from asset ID"
                                      disabled={cellBusy}
                                      onClick={() => void applyAssetIdToToken(row.id, key)}
                                      className="rounded p-1 text-app-accent hover:bg-white/10 disabled:opacity-40"
                                    >
                                      <Link2 size={12} aria-hidden />
                                    </button>
                                    <button
                                      type="button"
                                      title="Upload to My assets and insert URL"
                                      disabled={cellBusy}
                                      onClick={() => triggerUploadForCell(row.id, key)}
                                      className="rounded p-1 text-app-accent hover:bg-white/10 disabled:opacity-40"
                                    >
                                      {cellBusy ? (
                                        <Loader2 size={12} className="animate-spin" aria-hidden />
                                      ) : (
                                        <Upload size={12} aria-hidden />
                                      )}
                                    </button>
                                  </div>
                                )}
                              </div>
                            </td>
                          );
                        })}
                        <td className="p-0 align-middle text-center">
                          {tableRows.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeRow(row.id)}
                              className="rounded-app-md p-1.5 text-red-400/70 transition-colors hover:bg-red-500/10 hover:text-red-400"
                              title="Remove row"
                            >
                              <Trash2 size={14} aria-hidden />
                            </button>
                          )}
                        </td>
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
                </div>
                <div className="flex items-center justify-between border-t border-white/8 px-2 py-2">
                  <button
                    type="button"
                    onClick={addRow}
                    className="flex items-center gap-1.5 rounded-app-md px-2 py-1.5 text-xs font-medium text-app-accent hover:bg-white/[0.06]"
                  >
                    <Plus size={14} aria-hidden />
                    Add row
                  </button>
                </div>
              </section>
              )}

              {/* Common attachments (per-recipient; merged with body-derived media for notify) */}
              {!isPushChannel && (
                <section className="overflow-hidden rounded-app-md border border-white/10 bg-white/[0.02]">
                  <div className="border-b border-white/8 bg-white/[0.03] px-3 py-2">
                    <h3 className="text-xs font-semibold text-app-text">Common attachments</h3>
                    <p className="mt-1 text-[11px] leading-snug text-app-muted">
                      These files are attached for every recipient in this send.
                    </p>
                  </div>
                  <div className="space-y-2 px-3 py-3">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => commonAttachmentInputRef.current?.click()}
                        className="rounded-app-md border border-white/12 bg-white/5 px-3 py-1.5 text-[11px] font-medium text-app-text hover:bg-white/10"
                      >
                        Upload file
                      </button>
                      <button
                        type="button"
                        onClick={() => void addCommonAttachmentByAssetId()}
                        className="rounded-app-md border border-white/12 bg-white/5 px-3 py-1.5 text-[11px] font-medium text-app-text hover:bg-white/10"
                      >
                        Add by Asset ID
                      </button>
                      <button
                        type="button"
                        onClick={addCommonAttachmentByUrl}
                        className="rounded-app-md border border-white/12 bg-white/5 px-3 py-1.5 text-[11px] font-medium text-app-text hover:bg-white/10"
                      >
                        Add by URL
                      </button>
                    </div>
                    {commonAttachments.length === 0 ? (
                      <p className="text-[11px] text-app-muted">No common attachments added.</p>
                    ) : (
                      <ul className="space-y-1.5">
                        {commonAttachments.map((att, idx) => (
                          <li
                            key={`${att.url}-${idx}`}
                            className="flex items-center justify-between gap-2 rounded-app-sm border border-white/8 bg-black/15 px-2 py-1.5 text-[11px]"
                          >
                            <span className="truncate text-app-text" title={att.url}>
                              {att.name || prettyAssetLabel(att.url)}
                            </span>
                            <button
                              type="button"
                              onClick={() => removeCommonAttachment(idx)}
                              className="rounded p-1 text-red-400/80 hover:bg-red-500/10"
                              title="Remove attachment"
                            >
                              <Trash2 size={12} aria-hidden />
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </section>
              )}

              {/* After send */}
              <div className="rounded-app-md border border-white/8 bg-white/[0.02] px-3 py-2.5">
                <label className="flex cursor-pointer items-start gap-2.5 text-xs text-app-muted">
                  <input
                    type="checkbox"
                    checked={markPublishedAfterSend}
                    onChange={(e) => setMarkPublishedAfterSend(e.target.checked)}
                    className="mt-0.5 shrink-0"
                  />
                  <span>
                    <span className="font-medium text-app-text">Mark as Published</span> after a successful send.
                    <span className="mt-0.5 block text-[11px] text-app-muted">
                      Only for channel- or template-bound content; skips review quorum when applicable.
                    </span>
                  </span>
                </label>
              </div>

              {(error || success) && (
                <div className="space-y-2">
                  {error ? (
                    <div className="rounded-app-md border border-red-400/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
                      {error}
                    </div>
                  ) : null}
                  {success ? (
                    <div className="flex items-center gap-2 rounded-app-md border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300">
                      <CheckCircle2 size={14} aria-hidden />
                      {success}
                    </div>
                  ) : null}
                </div>
              )}

              <div className="flex justify-end gap-2 border-t border-white/8 pt-4">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-app-md border border-white/10 bg-white/5 px-4 py-2 text-xs font-medium text-app-muted transition-colors hover:bg-white/10 hover:text-app-text"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void handleSend()}
                  disabled={sending || !!success || hasOpenReviewRequest}
                  className="flex items-center gap-2 rounded-app-md border border-emerald-400/40 bg-emerald-500/15 px-4 py-2 text-xs font-semibold text-emerald-300 transition-all hover:bg-emerald-500/25 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {sending ? (
                    <Loader2 size={14} className="animate-spin" aria-hidden />
                  ) : (
                    <Send size={14} aria-hidden />
                  )}
                  {sending
                    ? 'Publishing…'
                    : hasOpenReviewRequest
                      ? 'Publish blocked: open review present'
                      : `Publish via ${isWhatsappChannel ? 'WhatsApp' : isEmailChannel ? 'email' : 'push'}`}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
