import {
  appendAttachmentsFromTipTapDoc,
  type Attachment,
  type ContentBlock,
  type TipTapDoc,
} from "../whatsapp-send/whatsappSend.service";

export type { Attachment };

function getNotifyConfig() {
  return {
    url: process.env.NOTIFY_SERVER_URL ?? "",
    clientId: process.env.NOTIFY_CLIENT_ID ?? "",
    apiKey: process.env.NOTIFY_API_KEY ?? "",
  };
}

export interface Recipient {
  user_id: string;
  email: string;
}

interface NotifyPayload {
  client_id: string;
  event_type: string;
  channels_requested: string[];
  recipients: Recipient[];
  content: {
    subject: string;
    body: string;
    html_body?: string;
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

interface RichTextField {
  id: string;
  type: "richText";
  props: {
    doc: TipTapDoc;
  };
}

interface FieldBlock {
  id: string;
  type: "field";
  props: {
    fieldKey: string;
  };
}

interface MediaBlock {
  id: string;
  type: "media";
  props: {
    caption?: string;
    url?: string;
    name?: string;
    alt?: string;
    mime_type?: string;
    size_bytes?: number;
  };
}

type EmailContentBlock = RichTextField | FieldBlock | MediaBlock;

export interface EmailSendInput {
  event_type: string;
  client_id?: string;
  recipients: Recipient[];
  blocks: ContentBlock[];
  subject?: string;
  field_values?: Record<string, string>;
  attachments?: Attachment[];
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderTextMarksToHtml(
  text: string,
  marks?: Array<{ type: string; attrs?: Record<string, unknown> }>,
): string {
  if (!marks || marks.length === 0) return escapeHtml(text);

  let html = escapeHtml(text);
  for (const mark of marks) {
    switch (mark.type) {
      case "bold":
      case "strong":
        html = `<strong>${html}</strong>`;
        break;
      case "italic":
      case "em":
        html = `<em>${html}</em>`;
        break;
      case "underline":
        html = `<u>${html}</u>`;
        break;
      case "strike":
        html = `<s>${html}</s>`;
        break;
      case "code":
        html = `<code>${html}</code>`;
        break;
      case "link": {
        const href = typeof mark.attrs?.href === "string" ? mark.attrs.href : "";
        if (href) html = `<a href="${escapeHtml(href)}">${html}</a>`;
        break;
      }
      case "citationMarker": {
        html = `<span class="citation-marker">${html}</span>`;
        break;
      }
    }
  }
  return html;
}

function renderInlineText(node: TipTapNode): { text: string; html: string } {
  if (node.type === "text") {
    const text = node.text ?? "";
    return { text, html: renderTextMarksToHtml(text, node.marks) };
  }
  if (node.type === "hardBreak" || node.type === "hard_break") {
    return { text: "\n", html: "<br/>" };
  }
  const children = (node.content ?? []).map((c) => renderInlineText(c));
  return {
    text: children.map((c) => c.text).join(""),
    html: children.map((c) => c.html).join(""),
  };
}

/** Flatten inline-ish content inside one block node (paragraph, heading, …). */
function renderInlineBlock(node: TipTapNode): { text: string; html: string } {
  const parts = (node.content ?? []).map((c) => renderInlineText(c));
  return {
    text: parts.map((p) => p.text).join(""),
    html: parts.map((p) => p.html).join(""),
  };
}

/** Render a list of block siblings (doc roots, layout cells, unknown wrappers). */
function renderBlockChildren(nodes: TipTapNode[] | undefined): { text: string; html: string } {
  if (!nodes?.length) return { text: "", html: "" };
  const parts = nodes.map((n) => renderNode(n));
  return {
    text: parts.map((p) => p.text).join("\n"),
    html: parts.map((p) => p.html).join(""),
  };
}

/** Template layout: multi-column row as email-safe HTML table (flex is unreliable in email clients). */
function renderLayoutRow(node: TipTapNode): { text: string; html: string } {
  const cells = node.content ?? [];
  if (cells.length === 0) return { text: "", html: "" };

  const flexValues = cells.map((c) =>
    c.type === "layoutCell" ? Math.max(1, Number(c.attrs?.flexGrow) || 1) : 1,
  );
  const flexSum = flexValues.reduce((a, b) => a + b, 0);

  const textParts: string[] = [];
  const tdHtml: string[] = [];

  for (let i = 0; i < cells.length; i++) {
    const cell = cells[i]!;
    const inner =
      cell.type === "layoutCell"
        ? renderBlockChildren(cell.content)
        : renderNode(cell);
    textParts.push(inner.text);
    const pct = (flexValues[i]! / flexSum) * 100;
    tdHtml.push(
      `<td valign="top" style="width:${pct.toFixed(2)}%;padding:12px;border:1px solid #cbd5e1;background:#f8fafc;vertical-align:top;">${inner.html}</td>`,
    );
  }

  return {
    text: textParts.filter(Boolean).join("\n"),
    html:
      `<table role="presentation" class="cc-layout-table" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%;max-width:640px;border-collapse:collapse;margin:16px 0;mso-table-lspace:0pt;mso-table-rspace:0pt;"><tr>` +
      tdHtml.join("") +
      `</tr></table>`,
  };
}

/** Single column shell when a layoutCell appears outside a row (edge cases). */
function renderLayoutCellStandalone(node: TipTapNode): { text: string; html: string } {
  const inner = renderBlockChildren(node.content);
  return {
    text: inner.text,
    html: `<div style="padding:12px;margin:10px 0;border:1px solid #e2e8f0;border-radius:8px;background:#fafafa;">${inner.html}</div>`,
  };
}

/** Rich-text region with optional section title — mirrors editor chrome for notify/email HTML. */
function renderRegionRichText(node: TipTapNode): { text: string; html: string } {
  const inner = renderBlockChildren(node.content);
  const title =
    typeof node.attrs?.sectionTitle === "string"
      ? node.attrs.sectionTitle.trim()
      : "";
  const titleHtml = title
    ? `<div style="font-size:14px;font-weight:600;color:#0f172a;margin:0 0 10px 0;padding-bottom:8px;border-bottom:1px solid #e2e8f0;">${escapeHtml(title)}</div>`
    : "";
  return {
    text: inner.text,
    html: `<div style="border:1px solid #e2e8f0;border-radius:10px;padding:14px 16px;margin:0 0 14px 0;background:#ffffff;">${titleHtml}<div style="color:#334155;font-size:15px;line-height:1.65;">${inner.html}</div></div>`,
  };
}

/** Wrap merged HTML with charset + styles email clients may honor alongside inline CSS. */
function wrapEmailHtmlDocument(innerHtml: string): string {
  if (!innerHtml.trim()) return innerHtml;
  const headStyle = `<meta charset="utf-8">
<style type="text/css">
.cc-email-root{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;color:#1e293b;line-height:1.6;font-size:15px;}
.cc-email-root table{border-collapse:collapse;}
.cc-email-root img{max-width:100%!important;height:auto!important;border:0;vertical-align:middle;}
.cc-email-root a{color:#2563eb;}
.cc-email-root .cc-layout-table{width:100%;max-width:640px;}
@media only screen and (max-width:600px){
  .cc-email-root table.cc-layout-table tr td{display:block!important;width:100%!important;box-sizing:border-box;}
}
</style>`;
  return (
    headStyle +
    `<div class="cc-email-root" style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;color:#1e293b;line-height:1.6;font-size:15px;">` +
    innerHtml +
    `</div>`
  );
}

/** List items may contain `<p>…</p>`; strip `<p>` tags so `<li>` content is valid HTML. */
function stripParagraphWrapper(fragment: string): string {
  return fragment.replace(/<\/?p\b[^>]*>/gi, "");
}

function renderNode(node: TipTapNode): { text: string; html: string } {
  switch (node.type) {
    case "paragraph": {
      const v = renderInlineBlock(node);
      return { text: v.text, html: `<p>${v.html}</p>` };
    }
    case "heading":
    case "heading1":
    case "heading2": {
      const v = renderInlineBlock(node);
      const level =
        node.type === "heading1"
          ? 1
          : node.type === "heading2"
            ? 2
            : Number(node.attrs?.level ?? 1);
      const clamped = level >= 1 && level <= 6 ? level : 1;
      return { text: v.text, html: `<h${clamped}>${v.html}</h${clamped}>` };
    }
    case "bulletList":
    case "bullet_list": {
      const items = (node.content ?? []).map((item) => renderNode(item));
      return {
        text: items.map((i) => `- ${i.text}`).join("\n"),
        html: `<ul>${items.map((i) => `<li>${stripParagraphWrapper(i.html)}</li>`).join("")}</ul>`,
      };
    }
    case "orderedList":
    case "ordered_list": {
      const items = (node.content ?? []).map((item) => renderNode(item));
      return {
        text: items.map((i, idx) => `${idx + 1}. ${i.text}`).join("\n"),
        html: `<ol>${items.map((i) => `<li>${stripParagraphWrapper(i.html)}</li>`).join("")}</ol>`,
      };
    }
    case "listItem":
    case "list_item": {
      const parts = (node.content ?? []).map((c) => renderNode(c));
      return {
        text: parts.map((p) => p.text).join(" ").trim(),
        html: parts.map((p) => p.html).join(""),
      };
    }
    case "blockquote": {
      const inner = renderBlockChildren(node.content);
      const text = inner.text
        .split("\n")
        .map((line) => `> ${line}`)
        .join("\n");
      return { text, html: `<blockquote>${inner.html}</blockquote>` };
    }
    case "codeBlock": {
      const raw = (node.content ?? [])
        .map((c) => (c.type === "text" ? (c.text ?? "") : ""))
        .join("");
      return {
        text: raw,
        html: `<pre><code>${escapeHtml(raw)}</code></pre>`,
      };
    }
    case "hardBreak":
    case "hard_break":
      return { text: "\n", html: "<br/>" };
    case "horizontalRule":
      return { text: "---", html: "<hr/>" };
    case "image": {
      const src = typeof node.attrs?.src === "string" ? node.attrs.src : "";
      const alt = typeof node.attrs?.alt === "string" ? node.attrs.alt : "";
      if (!src) return { text: "", html: "" };
      return {
        text: alt || src,
        html: `<p><img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}" /></p>`,
      };
    }
    // Template layout nodes (see apps/web/src/tiptap/templateLayoutDoc.ts)
    case "layoutRow":
      return renderLayoutRow(node);
    case "layoutCell":
      return renderLayoutCellStandalone(node);
    case "regionRichText":
      return renderRegionRichText(node);
    case "regionMedia": {
      const caption = typeof node.attrs?.caption === "string" ? node.attrs.caption.trim() : "";
      const alt = typeof node.attrs?.alt === "string" ? node.attrs.alt.trim() : "";
      const line = caption || alt;
      return {
        text: line,
        html: line
          ? `<figure style="margin:12px 0;padding:12px;border:1px solid #e2e8f0;border-radius:8px;background:#f8fafc;"><figcaption style="font-size:14px;color:#475569;margin:0;">${escapeHtml(line)}</figcaption></figure>`
          : "",
      };
    }
    case "regionField": {
      const key = typeof node.attrs?.fieldKey === "string" ? node.attrs.fieldKey.trim() : "";
      const token = key ? `{{${key}}}` : "";
      return {
        text: token,
        html: key ? `<p>${escapeHtml(token)}</p>` : "",
      };
    }
    case "componentReference": {
      const name =
        typeof node.attrs?.componentName === "string"
          ? node.attrs.componentName
          : typeof node.attrs?.componentKey === "string"
            ? node.attrs.componentKey
            : "Component";
      const label = String(name).trim() || "Component";
      return {
        text: `[${label}]`,
        html: `<p><em>${escapeHtml(label)}</em></p>`,
      };
    }
    default: {
      // Recurse into unknown block containers instead of flattening with renderInlineText
      // (fixes layoutRow / regionRichText collapsing into "H1H2Bold…").
      if (node.content?.length) {
        return renderBlockChildren(node.content);
      }
      return { text: "", html: "" };
    }
  }
}

function tiptapDocToEmail(doc: TipTapDoc): { body: string; html_body: string } {
  const roots = doc.content ?? [];
  const blocks = roots.map((node) => renderNode(node));
  return {
    body: blocks.map((b) => b.text).filter(Boolean).join("\n").trim(),
    html_body: blocks.map((b) => b.html).filter(Boolean).join("\n"),
  };
}

function resolveFieldTokens(text: string, fieldValues: Record<string, string>): string {
  return text.replace(/\{\{(\w+)\}\}/g, (_, key) => fieldValues[key] ?? `{{${key}}}`);
}

function looksLikeImageAttachment(url: string, mime?: string): boolean {
  const m = (mime ?? "").toLowerCase();
  if (m.startsWith("image/")) return true;
  const path = url.split("?")[0].toLowerCase();
  return /\.(png|jpe?g|gif|webp|svg|bmp|ico)$/i.test(path);
}

function processBlocks(input: EmailSendInput): {
  body: string;
  html_body: string;
  attachments: Attachment[];
} {
  const blocks = input.blocks as EmailContentBlock[];
  const fieldValues = input.field_values ?? {};
  const textParts: string[] = [];
  const htmlParts: string[] = [];
  const attachments: Attachment[] = [...(input.attachments ?? [])];

  for (const block of blocks) {
    if (block.type === "richText") {
      const rendered = tiptapDocToEmail(block.props.doc);
      if (rendered.body) textParts.push(rendered.body);
      if (rendered.html_body) htmlParts.push(rendered.html_body);
      appendAttachmentsFromTipTapDoc(block.props.doc, attachments);
      continue;
    }
    if (block.type === "field") {
      const value = fieldValues[block.props.fieldKey] ?? `{{${block.props.fieldKey}}}`;
      textParts.push(value);
      htmlParts.push(`<p>${escapeHtml(value)}</p>`);
      continue;
    }
    if (block.type === "media") {
      const url = block.props.url?.trim();
      if (url) {
        attachments.push({
          url,
          name: block.props.name ?? block.props.alt ?? "attachment",
          mime_type: block.props.mime_type ?? "application/octet-stream",
          size_bytes: block.props.size_bytes,
          delivery_mode: "auto",
        });
        const label = block.props.name || block.props.alt || block.props.caption || "Attachment";
        if (looksLikeImageAttachment(url, block.props.mime_type)) {
          htmlParts.push(
            `<p><img src="${escapeHtml(url)}" alt="${escapeHtml(block.props.alt ?? label)}" style="max-width:100%;height:auto;" /></p>`,
          );
        } else {
          htmlParts.push(
            `<p><a href="${escapeHtml(url)}">${escapeHtml(String(label))}</a></p>`,
          );
        }
        const plainLine = [block.props.caption, url].filter(Boolean).join("\n");
        if (plainLine) textParts.push(plainLine);
      } else if (block.props.caption) {
        textParts.push(block.props.caption);
        htmlParts.push(`<p>${escapeHtml(block.props.caption)}</p>`);
      }
    }
  }

  const seenUrl = new Set<string>();
  const uniqueAttachments = attachments.filter((a) => {
    const u = a.url?.trim();
    if (!u) return true;
    if (seenUrl.has(u)) return false;
    seenUrl.add(u);
    return true;
  });

  const resolvedPlain = resolveFieldTokens(textParts.join("\n\n").trim(), fieldValues);
  const resolvedHtml = resolveFieldTokens(htmlParts.join(""), fieldValues);

  return {
    body: resolvedPlain,
    html_body: wrapEmailHtmlDocument(resolvedHtml),
    attachments: uniqueAttachments,
  };
}

function buildNotifyPayload(input: EmailSendInput): NotifyPayload {
  const config = getNotifyConfig();
  const clientId = input.client_id || config.clientId;
  if (!clientId) {
    throw new Error("client_id is required: pass it in request or set NOTIFY_CLIENT_ID");
  }
  const { body, html_body, attachments } = processBlocks(input);
  const subject = input.subject?.trim() || input.event_type;
  const payload: NotifyPayload = {
    client_id: clientId,
    event_type: input.event_type,
    channels_requested: ["email"],
    recipients: input.recipients,
    content: {
      subject,
      body,
    },
  };
  if (html_body.trim().length > 0) {
    payload.content.html_body = html_body;
  }
  if (attachments.length > 0) {
    payload.content.attachments = attachments;
  }
  return payload;
}

async function sendToNotify(
  notifyPayload: NotifyPayload,
): Promise<{ ok: boolean; status: number; body: unknown }> {
  const config = getNotifyConfig();
  if (!config.url) throw new Error("NOTIFY_SERVER_URL is not configured");
  if (!config.apiKey) throw new Error("NOTIFY_API_KEY is not configured");
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

export const emailSendService = {
  buildNotifyPayload,
  sendToNotify,
};
