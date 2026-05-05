import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getStorageEnv } from "../../config/storageEnv";
import { createS3ClientForEndpoint } from "../../platform/storage/s3Presign";
import { getPrismaClient } from "../../repository";
import type { AuditContext } from "../../shared/context";
import {
  recipientDedupeKey,
  waPublishEventTypeForContent,
} from "./publishEventType";

// ─── Config (from environment / docker-compose) ──────────────────────────────

function getNotifyConfig() {
  return {
    url: process.env.NOTIFY_SERVER_URL ?? "",
    clientId: process.env.NOTIFY_CLIENT_ID ?? "",
    apiKey: process.env.NOTIFY_API_KEY ?? "",
  };
}

function deriveNotifyMediaUploadUrl(notifyUrl: string): string {
  const parsed = new URL(notifyUrl);
  if (parsed.pathname.endsWith("/notify")) {
    parsed.pathname = parsed.pathname.replace(/\/notify$/, "/media/upload");
  } else {
    parsed.pathname = `${parsed.pathname.replace(/\/+$/, "")}/media/upload`;
  }
  parsed.search = "";
  return parsed.toString();
}

// ─── Types ───────────────────────────────────────────────────────────────────

interface Recipient {
  user_id: string;
  wa_number: string;
}

export interface Attachment {
  url?: string;
  file_id?: string;
  name?: string;
  mime_type?: string;
  size_bytes?: number;
  delivery_mode?: "auto" | "link_only" | "provider_media";
}

interface NotifyPayload {
  client_id: string;
  event_type: string;
  channels_requested: string[];
  recipients: Recipient[];
  content: {
    body: string;
    attachments?: Attachment[];
  };
}

interface TipTapNode {
  type: string;
  content?: TipTapNode[];
  text?: string;
  marks?: Array<{ type: string; attrs?: Record<string, unknown> }>;
  attrs?: Record<string, unknown>;
}

export interface TipTapDoc {
  type: "doc";
  content: TipTapNode[];
}

interface RichTextField {
  id: string;
  type: "richText";
  props: {
    sectionTitle?: string;
    editorPlaceholder?: string;
    doc: TipTapDoc;
  };
}

interface FieldBlock {
  id: string;
  type: "field";
  props: {
    fieldKey: string;
    label?: string;
    helpText?: string;
    required?: boolean;
  };
}

interface MediaBlock {
  id: string;
  type: "media";
  props: {
    role?: string;
    alt?: string;
    caption?: string;
    variant?: string;
    url?: string;
    name?: string;
    mime_type?: string;
  };
}

export type ContentBlock = RichTextField | FieldBlock | MediaBlock;

export type PlaceholderKeyManifest = {
  fieldTokens: string[];
  mediaTokens: string[];
  /** Distinct keys expected on each CSV/JSON row (excluding user_id / wa_number). */
  requiredRowKeys: string[];
};

export function collectPlaceholderKeysFromBlocks(
  blocks: ContentBlock[],
): PlaceholderKeyManifest {
  const field = new Set<string>();
  const media = new Set<string>();

  function scanDoc(doc: TipTapDoc): void {
    function walk(nodes: TipTapNode[] | undefined): void {
      if (!nodes) return;
      for (const n of nodes) {
        if (n.type === "text" && typeof n.text === "string") {
          const t = n.text;
          let m: RegExpExecArray | null;
          const reF = /\{\{(\w+)\}\}/g;
          while ((m = reF.exec(t)) !== null) {
            field.add(m[1]);
          }
          const reM = /<([a-zA-Z][a-zA-Z0-9_-]*)>/g;
          while ((m = reM.exec(t)) !== null) {
            media.add(m[1]);
          }
        }
        if (
          (n.type === "field" || n.type === "regionField") &&
          typeof n.attrs?.fieldKey === "string"
        ) {
          const fk = n.attrs.fieldKey.trim();
          if (fk.length > 0) field.add(fk);
        }
        walk(n.content);
      }
    }
    walk(doc.content);
  }

  for (const b of blocks) {
    if (b.type === "richText") scanDoc(b.props.doc);
    if (b.type === "field") field.add(b.props.fieldKey);
  }

  const fieldTokens = [...field];
  const mediaTokens = [...media];
  const requiredRowKeys = [...new Set([...fieldTokens, ...mediaTokens])];
  return { fieldTokens, mediaTokens, requiredRowKeys };
}

export interface WhatsAppBatchRow {
  user_id: string;
  wa_number: string;
  field_values?: Record<string, string>;
}

export interface WhatsAppBatchSendInput {
  event_type: string;
  client_id?: string;
  blocks: ContentBlock[];
  attachments?: Attachment[];
  rows: WhatsAppBatchRow[];
}

export interface WhatsAppSendInput {
  event_type: string;
  client_id?: string;
  recipients: Recipient[];
  blocks: ContentBlock[];
  field_values?: Record<string, string>;
  attachments?: Attachment[];
}

// ─── TipTap → WhatsApp text conversion ──────────────────────────────────────

function renderMarks(text: string, marks?: Array<{ type: string; attrs?: Record<string, unknown> }>): string {
  if (!marks || marks.length === 0) return text;

  let result = text;
  for (const mark of marks) {
    switch (mark.type) {
      case "bold":
      case "strong":
        result = `*${result}*`;
        break;
      case "italic":
      case "em":
        result = `_${result}_`;
        break;
      case "strike":
        result = `~${result}~`;
        break;
      case "code":
        result = `\`${result}\``;
        break;
      case "underline":
        // WhatsApp has no native underline; fallback to italic for emphasis.
        result = `_${result}_`;
        break;
      case "link": {
        const href = mark.attrs?.href;
        if (!(typeof href === "string" && isLikelyFileLink(href))) {
          result = typeof href === "string" ? `${result} (${href})` : result;
        }
        break;
      }
    }
  }
  return result;
}

function renderInlineChildren(node: TipTapNode): string {
  return (node.content ?? []).map((child) => renderNode(child)).join("");
}

function renderNode(node: TipTapNode): string {
  switch (node.type) {
    case "text":
      return renderMarks(node.text ?? "", node.marks);

    case "paragraph":
      return renderInlineChildren(node);

    case "heading": {
      const level = (node.attrs?.level as number) ?? 1;
      const text = renderInlineChildren(node);
      if (level <= 2) return `*${text}*`;
      return text;
    }
    case "heading1":
      return `*${renderInlineChildren(node)}*`;
    case "heading2":
      return `*${renderInlineChildren(node)}*`;

    case "bulletList":
    case "bullet_list":
      return (node.content ?? [])
        .map((item) => renderNode(item))
        .map((line) => `• ${line}`)
        .join("\n");

    case "orderedList":
    case "ordered_list":
      return (node.content ?? [])
        .map((item, idx) => `${idx + 1}. ${renderNode(item)}`)
        .join("\n");

    case "listItem":
    case "list_item":
      return (node.content ?? []).map((child) => renderNode(child)).join("");

    case "blockquote": {
      const text = (node.content ?? []).map((child) => renderNode(child)).join("\n");
      return text
        .split("\n")
        .map((line) => `> ${line}`)
        .join("\n");
    }

    case "codeBlock": {
      const text = (node.content ?? []).map((child) => renderNode(child)).join("");
      return `\`\`\`\n${text}\n\`\`\``;
    }

    case "hardBreak":
    case "hard_break":
      return "\n";

    case "horizontalRule":
      return "---";

    default:
      // Unknown block wrappers (layout rows/cells, regions, etc.): separate siblings with
      // newlines so multi-column layouts don't collapse into one run-on line.
      if (node.content && node.content.length > 0) {
        return node.content.map((child) => renderNode(child)).join("\n");
      }
      return node.text ?? "";
  }
}

function tiptapDocToText(doc: TipTapDoc): string {
  const roots = doc.content ?? [];
  return roots
    .map((node) => renderNode(node).trimEnd())
    .filter((line) => line.length > 0)
    // Single newline between blocks reads tighter in WhatsApp than double newlines.
    .join("\n");
}

function normalizeWhatsappBody(text: string): string {
  return text
    // If list markers got glued to the previous token, force a new line.
    .replace(/([^\n])(\d+\.\s)/g, "$1\n$2")
    .replace(/([^\n])(•\s)/g, "$1\n$2")
    // Ensure markdown spans are separated from following plain text or other spans.
    .replace(/(\*[^*\n]+\*|_[^_\n]+_|~[^~\n]+~|`[^`\n]+`)(?=[A-Za-z0-9*_~`])/g, "$1 ")
    // Keep spacing tidy while preserving readable section breaks.
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// ─── Block processing ────────────────────────────────────────────────────────

function resolveFieldTokens(text: string, fieldValues: Record<string, string>): string {
  return text.replace(/\{\{(\w+)\}\}/g, (_, key) => fieldValues[key] ?? `{{${key}}}`);
}

/** Inline `<token>` placeholders (CSV column names match `token`). */
function expandAngleMediaTokens(text: string, fieldValues: Record<string, string>): string {
  return text.replace(
    /<([a-zA-Z][a-zA-Z0-9_-]*)>/g,
    (_full, key: string) => fieldValues[key] ?? `<${key}>`,
  );
}

function finalizeBodyWithFieldValues(
  raw: string,
  fieldValues: Record<string, string>,
): string {
  return normalizeWhatsappBody(
    expandAngleMediaTokens(resolveFieldTokens(raw, fieldValues), fieldValues),
  ).trim();
}

function processRichTextBlock(block: RichTextField): string | null {
  const rawText = tiptapDocToText(block.props.doc);
  return rawText.trim() ? rawText : null;
}

function guessMimeFromPath(url: string): string {
  const path = url.split("?")[0].toLowerCase();
  if (path.endsWith(".png")) return "image/png";
  if (path.endsWith(".jpg") || path.endsWith(".jpeg")) return "image/jpeg";
  if (path.endsWith(".webp")) return "image/webp";
  if (path.endsWith(".gif")) return "image/gif";
  if (path.endsWith(".mp4")) return "video/mp4";
  if (path.endsWith(".webm")) return "video/webm";
  if (path.endsWith(".pdf")) return "application/pdf";
  return "application/octet-stream";
}

function isLikelyFileLink(url: string): boolean {
  const path = (url.split("?")[0] || "").toLowerCase();
  return (
    path.endsWith(".pdf") ||
    path.endsWith(".doc") ||
    path.endsWith(".docx") ||
    path.endsWith(".xls") ||
    path.endsWith(".xlsx") ||
    path.endsWith(".ppt") ||
    path.endsWith(".pptx") ||
    path.endsWith(".txt") ||
    path.endsWith(".csv") ||
    path.endsWith(".zip") ||
    path.endsWith(".rar") ||
    path.endsWith(".7z") ||
    path.endsWith(".png") ||
    path.endsWith(".jpg") ||
    path.endsWith(".jpeg") ||
    path.endsWith(".webp") ||
    path.endsWith(".gif") ||
    path.endsWith(".mp4") ||
    path.endsWith(".mov") ||
    path.endsWith(".webm") ||
    path.endsWith(".mp3") ||
    path.endsWith(".wav")
  );
}

function collectImageAttachmentsFromDoc(doc: TipTapDoc): Attachment[] {
  const out: Attachment[] = [];

  function walk(nodes: TipTapNode[] | undefined): void {
    if (!nodes) return;
    for (const n of nodes) {
      if (n.type === "image") {
        const src = typeof n.attrs?.src === "string" ? n.attrs.src.trim() : "";
        if (src.length > 0) {
          const alt = typeof n.attrs?.alt === "string" && n.attrs.alt.trim() ? n.attrs.alt.trim() : "image";
          out.push({ url: src, name: alt, mime_type: guessMimeFromPath(src) });
        }
      }
      walk(n.content);
    }
  }

  walk(doc.content);
  return out;
}

function maybeFileAttachmentFromHref(href: string): Attachment | null {
  const raw = (href || "").trim();
  if (!raw.startsWith("http://") && !raw.startsWith("https://")) return null;
  try {
    const u = new URL(raw);
    const last = decodeURIComponent((u.pathname.split("/").pop() || "").trim());
    if (!last) return null;
    const looksLikeFile = isLikelyFileLink(raw);
    if (!looksLikeFile) return null;
    return {
      url: raw,
      name: last,
      mime_type: guessMimeFromPath(raw),
      delivery_mode: "auto",
    };
  } catch {
    return null;
  }
}

function collectLinkAttachmentsFromDoc(doc: TipTapDoc): Attachment[] {
  const out: Attachment[] = [];
  function walk(nodes: TipTapNode[] | undefined): void {
    if (!nodes) return;
    for (const n of nodes) {
      if (n.marks && Array.isArray(n.marks)) {
        for (const mark of n.marks) {
          if (mark.type !== "link") continue;
          const href = typeof mark.attrs?.href === "string" ? mark.attrs.href : "";
          const maybe = maybeFileAttachmentFromHref(href);
          if (maybe) out.push(maybe);
        }
      }
      walk(n.content);
    }
  }
  walk(doc.content);
  return out;
}

function mergeRichTextAttachments(block: RichTextField, resultAttachments: Attachment[]): void {
  const combined = [
    ...collectImageAttachmentsFromDoc(block.props.doc),
    ...collectLinkAttachmentsFromDoc(block.props.doc),
  ];
  for (const item of combined) {
    if (!resultAttachments.some((a) => a.url === item.url)) {
      resultAttachments.push(item);
    }
  }
}

/**
 * Collect inline image + file-link URLs from a TipTap document into an attachment list
 * (used by email-send; mirrors WhatsApp richText merge).
 */
export function appendAttachmentsFromTipTapDoc(
  doc: TipTapDoc,
  into: Attachment[],
): void {
  mergeRichTextAttachments(
    { id: "_tiptap", type: "richText", props: { doc } },
    into,
  );
}

function processMediaBlock(
  block: MediaBlock,
  bodyParts: string[],
  resultAttachments: Attachment[],
): void {
  if (block.props.url) {
    resultAttachments.push({
      url: block.props.url,
      name: block.props.name ?? block.props.alt ?? "attachment",
      mime_type: block.props.mime_type ?? "application/octet-stream",
    });
  }
  if (block.props.caption) {
    bodyParts.push(block.props.caption);
  }
}

function processBlocks(
  blocks: ContentBlock[],
  fieldValues: Record<string, string>,
  attachments: Attachment[],
): { body: string; attachments: Attachment[] } {
  const bodyParts: string[] = [];
  const resultAttachments: Attachment[] = [...attachments];

  for (const block of blocks) {
    switch (block.type) {
      case "richText": {
        const text = processRichTextBlock(block);
        if (text) bodyParts.push(text);
        mergeRichTextAttachments(block, resultAttachments);
        break;
      }
      case "field": {
        const value = fieldValues[block.props.fieldKey];
        if (value) bodyParts.push(value);
        break;
      }
      case "media": {
        processMediaBlock(block, bodyParts, resultAttachments);
        break;
      }
    }
  }

  const joined = bodyParts.join("\n\n");
  const body = finalizeBodyWithFieldValues(joined, fieldValues);

  return {
    body,
    attachments: resultAttachments.length > 0 ? resultAttachments : [],
  };
}

// ─── Service ─────────────────────────────────────────────────────────────────

function buildNotifyPayload(input: WhatsAppSendInput): NotifyPayload {
  const config = getNotifyConfig();
  const { body, attachments } = processBlocks(
    input.blocks,
    input.field_values ?? {},
    input.attachments ?? [],
  );

  const clientId = input.client_id || config.clientId;
  if (!clientId) {
    throw new Error("client_id is required: pass it in the request or set NOTIFY_CLIENT_ID env var");
  }

  const payload: NotifyPayload = {
    client_id: clientId,
    event_type: input.event_type,
    channels_requested: ["whatsapp"],
    recipients: input.recipients,
    content: { body },
  };

  if (attachments.length > 0) {
    payload.content.attachments = attachments;
  }

  return payload;
}

function inferAttachmentName(att: Attachment, sourceUrl: string): string {
  if (att.name?.trim()) return att.name.trim();
  try {
    const u = new URL(sourceUrl);
    const last = decodeURIComponent((u.pathname.split("/").pop() || "").trim());
    if (last) return last;
  } catch {
    // fall through
  }
  return "attachment.bin";
}

function parseStorageObjectFromUrl(rawUrl: string): { bucket: string; key: string } | null {
  const cfg = getStorageEnv();
  if (!cfg) return null;
  try {
    const u = new URL(rawUrl);
    const parts = u.pathname.split("/").filter(Boolean);
    if (parts.length < 2) return null;
    const bucket = parts[0];
    const knownBuckets = new Set([
      cfg.buckets.images,
      cfg.buckets.documents,
      cfg.buckets.videos,
    ]);
    if (!knownBuckets.has(bucket)) return null;
    const key = parts
      .slice(1)
      .map((p) => decodeURIComponent(p.replace(/\+/g, " ")))
      .join("/");
    if (!key) return null;
    return { bucket, key };
  } catch {
    return null;
  }
}

async function streamToUint8Array(stream: NodeJS.ReadableStream): Promise<Uint8Array> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return new Uint8Array(Buffer.concat(chunks));
}

async function downloadAttachmentBytesForNotify(
  sourceUrl: string,
): Promise<{ bytes: Uint8Array; mimeType: string | null }> {
  const cfg = getStorageEnv();
  const mapped = parseStorageObjectFromUrl(sourceUrl);
  if (cfg && mapped) {
    const s3 = createS3ClientForEndpoint({
      region: cfg.region,
      accessKeyId: cfg.accessKeyId,
      secretAccessKey: cfg.secretAccessKey,
      endpoint: cfg.endpointInternal,
    });
    const out = await s3.send(
      new GetObjectCommand({ Bucket: mapped.bucket, Key: mapped.key }),
    );
    const body = out.Body as unknown as
      | { transformToByteArray?: () => Promise<Uint8Array> }
      | NodeJS.ReadableStream
      | null;
    if (!body) {
      throw new Error(`Storage returned empty body for ${mapped.bucket}/${mapped.key}`);
    }
    const bytes =
      typeof (body as { transformToByteArray?: () => Promise<Uint8Array> }).transformToByteArray ===
      "function"
        ? await (
            body as { transformToByteArray: () => Promise<Uint8Array> }
          ).transformToByteArray()
        : await streamToUint8Array(body as NodeJS.ReadableStream);
    return {
      bytes,
      mimeType: (out.ContentType || "").split(";")[0].trim() || null,
    };
  }

  const dl = await fetch(sourceUrl, {
    headers: { "ngrok-skip-browser-warning": "true", "User-Agent": "CCL-NotifyBridge/1.0" },
  });
  if (!dl.ok) {
    throw new Error(`Attachment download failed (${dl.status}) from ${sourceUrl}`);
  }
  return {
    bytes: new Uint8Array(await dl.arrayBuffer()),
    mimeType: (dl.headers.get("content-type") || "").split(";")[0].trim() || null,
  };
}

async function finalizeNotifyPayload(_actorId: string, payload: NotifyPayload): Promise<void> {
  const list = payload.content.attachments;
  if (!list || list.length === 0) return;

  await registerAttachmentsWithNotifyMediaService(payload);
}

type NotifyMediaUploadResponse = {
  file_id: string;
  url?: string;
  name?: string;
  mime_type?: string;
  size_bytes?: number;
  delivery_mode?: "auto" | "link_only" | "provider_media";
};

async function uploadAttachmentToNotifyMedia(
  mediaUploadUrl: string,
  apiKey: string,
  attachment: Attachment,
): Promise<NotifyMediaUploadResponse> {
  const sourceUrl = attachment.url?.trim();
  if (!sourceUrl) {
    throw new Error("Attachment url is required for media registration");
  }

  const { bytes, mimeType: downloadedMimeType } = await downloadAttachmentBytesForNotify(
    sourceUrl,
  );
  const mimeType =
    attachment.mime_type ||
    downloadedMimeType ||
    "application/octet-stream";
  const fileName = inferAttachmentName(attachment, sourceUrl);

  const form = new FormData();
  form.set("file", new Blob([bytes], { type: mimeType }), fileName);
  if (attachment.name) form.set("name", attachment.name);
  form.set("mime_type", mimeType);
  if (typeof attachment.size_bytes === "number") {
    form.set("size_bytes", String(Math.max(0, Math.trunc(attachment.size_bytes))));
  } else if (typeof bytes.byteLength === "number") {
    form.set("size_bytes", String(bytes.byteLength));
  }
  form.set("delivery_mode", attachment.delivery_mode ?? "auto");

  const response = await fetch(mediaUploadUrl, {
    method: "POST",
    headers: {
      "X-API-Key": apiKey,
    },
    body: form,
  });
  const body = (await response.json().catch(() => null)) as
    | Record<string, unknown>
    | null;
  if (!response.ok || !body || typeof body["file_id"] !== "string") {
    throw new Error(
      `Notification media upload failed (${response.status}): ${JSON.stringify(body)}`,
    );
  }
  return body as NotifyMediaUploadResponse;
}

async function registerAttachmentsWithNotifyMediaService(
  payload: NotifyPayload,
): Promise<void> {
  const list = payload.content.attachments;
  if (!list || list.length === 0) return;

  const notifyCfg = getNotifyConfig();
  if (!notifyCfg.url || !notifyCfg.apiKey) {
    return;
  }

  const mediaUploadUrl = deriveNotifyMediaUploadUrl(notifyCfg.url);
  const uploadCache = new Map<string, NotifyMediaUploadResponse>();

  for (const attachment of list) {
    if (!attachment || attachment.file_id || !attachment.url) continue;

    const sourceUrl = attachment.url.trim();
    if (!sourceUrl) continue;
    attachment.url = sourceUrl;

    const cacheKey = [
      sourceUrl,
      attachment.name ?? "",
      attachment.mime_type ?? "",
      String(attachment.size_bytes ?? ""),
      attachment.delivery_mode ?? "auto",
    ].join("|");
    let uploaded = uploadCache.get(cacheKey);
    if (!uploaded) {
      uploaded = await uploadAttachmentToNotifyMedia(
        mediaUploadUrl,
        notifyCfg.apiKey,
        attachment,
      );
      uploadCache.set(cacheKey, uploaded);
    }

    attachment.file_id = uploaded.file_id;
    attachment.url = uploaded.url ?? attachment.url;
    attachment.name = uploaded.name ?? attachment.name;
    attachment.mime_type = uploaded.mime_type ?? attachment.mime_type;
    attachment.size_bytes = uploaded.size_bytes ?? attachment.size_bytes;
    attachment.delivery_mode =
      uploaded.delivery_mode ?? attachment.delivery_mode ?? "auto";
  }
}

async function convertAndStore(
  ctx: AuditContext,
  input: WhatsAppSendInput,
): Promise<{ id: string; notifyPayload: NotifyPayload }> {
  const prisma = getPrismaClient();
  const notifyPayload = buildNotifyPayload(input);
  await finalizeNotifyPayload(ctx.actorId, notifyPayload);

  const record = await prisma.whatsAppSendRequest.create({
    data: {
      requestedById: ctx.actorId,
      eventType: input.event_type,
      recipients: input.recipients as unknown as object,
      tiptapPayload: input.blocks as unknown as object,
      notifyPayload: notifyPayload as unknown as object,
      status: "PENDING",
    },
  });

  return { id: record.id, notifyPayload };
}

async function sendToNotify(
  notifyPayload: NotifyPayload,
): Promise<{ ok: boolean; status: number; body: unknown }> {
  const config = getNotifyConfig();

  if (!config.url) {
    throw new Error("NOTIFY_SERVER_URL is not configured");
  }
  if (!config.apiKey) {
    throw new Error("NOTIFY_API_KEY is not configured");
  }

  const response = await fetch(config.url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": config.apiKey,
    },
    body: JSON.stringify(notifyPayload),
  });

  const body = await response.json().catch(() => null);
  return { ok: response.ok, status: response.status, body };
}

async function convertStoreAndSend(
  ctx: AuditContext,
  input: WhatsAppSendInput,
): Promise<{ id: string; notifyPayload: NotifyPayload; notifyResponse: { ok: boolean; status: number; body: unknown } }> {
  const { id, notifyPayload } = await convertAndStore(ctx, input);

  try {
    const notifyResponse = await sendToNotify(notifyPayload);
    const newStatus = notifyResponse.ok ? "SENT" : "FAILED";
    const failureMessage = notifyResponse.ok ? undefined : JSON.stringify(notifyResponse.body);
    await markStatus(id, newStatus, failureMessage);
    return { id, notifyPayload, notifyResponse };
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    await markStatus(id, "FAILED", errMsg);
    return { id, notifyPayload, notifyResponse: { ok: false, status: 0, body: { error: errMsg } } };
  }
}

export type BatchSendRowResult = {
  rowIndex: number;
  user_id: string;
  wa_number: string;
  id?: string;
  notifyResponse?: { ok: boolean; status: number; body: unknown };
  error?: string;
};

async function convertStoreAndSendBatch(
  ctx: AuditContext,
  input: WhatsAppBatchSendInput,
): Promise<{ results: BatchSendRowResult[] }> {
  const results: BatchSendRowResult[] = [];
  let rowIndex = 0;
  for (const row of input.rows) {
    try {
      const out = await convertStoreAndSend(ctx, {
        event_type: input.event_type,
        client_id: input.client_id,
        blocks: input.blocks,
        recipients: [{ user_id: row.user_id, wa_number: row.wa_number }],
        field_values: row.field_values ?? {},
        attachments: input.attachments,
      });
      results.push({
        rowIndex,
        user_id: row.user_id,
        wa_number: row.wa_number,
        id: out.id,
        notifyResponse: out.notifyResponse,
      });
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      results.push({
        rowIndex,
        user_id: row.user_id,
        wa_number: row.wa_number,
        error: errMsg,
      });
    }
    rowIndex += 1;
  }
  return { results };
}

async function listByUser(
  userId: string,
  opts?: { limit?: number; offset?: number },
): Promise<unknown[]> {
  const prisma = getPrismaClient();
  return prisma.whatsAppSendRequest.findMany({
    where: { requestedById: userId },
    orderBy: { createdAt: "desc" },
    take: opts?.limit ?? 20,
    skip: opts?.offset ?? 0,
  });
}

export type PriorSentRecipient = {
  userId: string;
  waNumber: string;
  lastSentAt: string;
};

/**
 * Unique recipients that already received a successful WhatsApp for this content’s publish event.
 */
async function listPriorSentRecipientsForContent(
  contentId: string,
): Promise<PriorSentRecipient[]> {
  const prisma = getPrismaClient();
  const eventType = waPublishEventTypeForContent(contentId);
  const rows = await prisma.whatsAppSendRequest.findMany({
    where: { eventType, status: "SENT" },
    orderBy: { createdAt: "desc" },
    select: { recipients: true, createdAt: true, updatedAt: true },
  });

  const map = new Map<string, PriorSentRecipient>();
  for (const row of rows) {
    const arr = row.recipients as unknown;
    if (!Array.isArray(arr) || arr.length === 0) continue;
    const first = arr[0] as { user_id?: unknown; wa_number?: unknown };
    const userId = String(first?.user_id ?? "").trim();
    const waNumber = String(first?.wa_number ?? "").trim();
    if (!userId || !waNumber) continue;
    const key = recipientDedupeKey(userId, waNumber);
    if (map.has(key)) continue;
    const at = row.updatedAt ?? row.createdAt;
    map.set(key, {
      userId,
      waNumber,
      lastSentAt: at.toISOString(),
    });
  }

  return [...map.values()].sort((a, b) => (a.lastSentAt < b.lastSentAt ? 1 : -1));
}

async function getById(id: string) {
  const prisma = getPrismaClient();
  return prisma.whatsAppSendRequest.findUnique({ where: { id } });
}

async function markStatus(
  id: string,
  status: "SENT" | "FAILED",
  failureMessage?: string,
) {
  const prisma = getPrismaClient();
  return prisma.whatsAppSendRequest.update({
    where: { id },
    data: { status, failureMessage },
  });
}

export const whatsappSendService = {
  buildNotifyPayload,
  finalizeNotifyPayload,
  collectPlaceholderKeysFromBlocks,
  convertAndStore,
  sendToNotify,
  convertStoreAndSend,
  convertStoreAndSendBatch,
  listByUser,
  listPriorSentRecipientsForContent,
  getById,
  markStatus,
};
