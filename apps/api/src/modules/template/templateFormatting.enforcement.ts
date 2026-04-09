import type { TipTapDocument } from "../../repository/types";
import type { FormattingViolation, TemplateFormattingRules } from "./formattingRules.types";

function normFont(name: string): string {
  return name.trim().toLowerCase().replace(/['"]/g, "");
}

function normHex(input: string): string | null {
  const s = input.trim();
  const m = s.match(/^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/);
  if (!m) return null;
  let h = m[1]!.toLowerCase();
  if (h.length === 3) {
    h = h
      .split("")
      .map((c) => c + c)
      .join("");
  }
  return `#${h}`;
}

interface WalkCtx {
  rules: TemplateFormattingRules;
  violations: FormattingViolation[];
  imageCount: number;
  videoCount: number;
  path: string[];
}

function pushPath(ctx: WalkCtx, segment: string): string[] {
  return [...ctx.path, segment];
}

function walkNode(ctx: WalkCtx, node: unknown, path: string[]): void {
  if (!node || typeof node !== "object" || Array.isArray(node)) return;
  const n = node as {
    type?: string;
    attrs?: Record<string, unknown>;
    marks?: unknown;
    content?: unknown;
  };
  const type = n.type ?? "unknown";
  const pathStr = path.join(".");

  if (type === "heading") {
    const level = typeof n.attrs?.level === "number" ? n.attrs.level : Number(n.attrs?.level);
    const max = ctx.rules.headings?.maxLevel;
    if (typeof max === "number" && Number.isFinite(level) && level > max) {
      ctx.violations.push({
        code: "HEADING_LEVEL_TOO_DEEP",
        message: `Heading level ${level} exceeds allowed maximum (${max})`,
        path: pathStr,
        detail: { level, maxLevel: max },
      });
    }
    const allowed = ctx.rules.headings?.allowedLevels;
    if (allowed?.length && Number.isFinite(level) && !allowed.includes(level)) {
      ctx.violations.push({
        code: "HEADING_LEVEL_NOT_ALLOWED",
        message: `Heading level ${level} is not in the allowed set`,
        path: pathStr,
        detail: { level, allowedLevels: allowed },
      });
    }
  }

  if (type === "image") {
    ctx.imageCount += 1;
  }
  if (type === "video" || type === "iframe" || type === "youtube") {
    ctx.videoCount += 1;
  }

  if (type === "text" && Array.isArray(n.marks)) {
    for (let mi = 0; mi < n.marks.length; mi++) {
      const mark = n.marks[mi] as { type?: string; attrs?: Record<string, unknown> };
      if (mark?.type !== "textStyle" && mark?.type !== "TextStyle") continue;
      const attrs = mark.attrs ?? {};
      const ff = typeof attrs.fontFamily === "string" ? attrs.fontFamily : undefined;
      const allowedFonts = ctx.rules.fonts?.allowedFamilies;
      if (allowedFonts?.length && typeof ff === "string") {
        const want = normFont(ff);
        const ok = allowedFonts.some((f) => normFont(f) === want || want.includes(normFont(f)));
        if (!ok) {
          ctx.violations.push({
            code: "FONT_NOT_ALLOWED",
            message: `Font "${ff}" is not allowed for this template`,
            path: `${pathStr}.marks[${mi}]`,
            detail: { fontFamily: ff, allowedFamilies: allowedFonts },
          });
        }
      }

      const color = typeof attrs.color === "string" ? attrs.color : undefined;
      const palette = ctx.rules.colors?.allowedHex;
      const restrict = ctx.rules.colors?.restrictToPalette;
      if (typeof color === "string" && palette?.length && restrict) {
        const hx = normHex(color);
        const normalizedPalette = palette.map((p) => normHex(p)).filter(Boolean) as string[];
        if (hx && !normalizedPalette.includes(hx)) {
          ctx.violations.push({
            code: "COLOR_NOT_IN_PALETTE",
            message: `Color "${color}" is not in the template palette`,
            path: `${pathStr}.marks[${mi}]`,
            detail: { color, allowedHex: palette },
          });
        }
      }
    }
  }

  if (Array.isArray(n.content)) {
    n.content.forEach((child, i) => {
      walkNode(ctx, child, pushPath(ctx, `${type}[${i}]`));
    });
  }
}

/**
 * Validates a TipTap document against template formatting rules.
 */
export function enforceFormattingRules(
  body: TipTapDocument | null | undefined,
  rules: TemplateFormattingRules | null | undefined,
): FormattingViolation[] {
  if (!rules || Object.keys(rules).length === 0) return [];
  if (!body || typeof body !== "object") return [];

  const ctx: WalkCtx = {
    rules,
    violations: [],
    imageCount: 0,
    videoCount: 0,
    path: [],
  };
  walkNode(ctx, body, ["doc"]);

  const maxImg = ctx.rules.media?.maxImageCount;
  if (typeof maxImg === "number" && ctx.imageCount > maxImg) {
    ctx.violations.push({
      code: "TOO_MANY_IMAGES",
      message: `Found ${ctx.imageCount} images; maximum allowed is ${maxImg}`,
      path: "document",
      detail: { count: ctx.imageCount, maxImageCount: maxImg },
    });
  }
  const maxVid = ctx.rules.media?.maxVideoEmbedCount;
  if (typeof maxVid === "number" && ctx.videoCount > maxVid) {
    ctx.violations.push({
      code: "TOO_MANY_VIDEOS",
      message: `Found ${ctx.videoCount} video embeds; maximum allowed is ${maxVid}`,
      path: "document",
      detail: { count: ctx.videoCount, maxVideoEmbedCount: maxVid },
    });
  }

  return ctx.violations;
}
