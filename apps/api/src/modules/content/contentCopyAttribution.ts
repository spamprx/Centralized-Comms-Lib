import { getSettingsSnapshot } from "../admin/adminSettings.defaults";

type CopyAttributionPolicy = {
  enabled: boolean;
  template: string;
  footer: string | null;
};

function interpolateTemplate(
  template: string,
  vars: Record<string, string>,
): string {
  return template.replace(/\{([a-zA-Z0-9_]+)\}/g, (_m, key: string) => {
    const v = vars[key];
    return typeof v === "string" ? v : "";
  });
}

function defaultBaseUrl(): string {
  const raw = process.env.WEB_PUBLIC_BASE_URL || process.env.APP_BASE_URL || "";
  const fallback = "http://localhost:3000";
  return (raw.trim() || fallback).replace(/\/+$/, "");
}

export function getCopyAttributionPolicy(input: {
  contentId: string;
  title: string;
  slug: string;
  authorName: string;
}): CopyAttributionPolicy {
  const settings = getSettingsSnapshot();
  const configuredTemplate =
    settings.attribution.template?.trim() ||
    "Shared from {appName}: \"{title}\" by {authorName}. Read the full article: {url}";
  const disabledIds = new Set(settings.attribution.disabledContentIds ?? []);
  const enabled = !!settings.attribution.enabled && !disabledIds.has(input.contentId);
  if (!enabled) {
    return { enabled: false, template: configuredTemplate, footer: null };
  }

  const appName =
    settings.general.appName?.trim() ||
    process.env.APP_NAME?.trim() ||
    "Centralized Comms";
  const url = `${defaultBaseUrl()}/library/${input.contentId}`;
  const footer = interpolateTemplate(configuredTemplate, {
    appName,
    title: input.title,
    authorName: input.authorName || "Unknown author",
    url,
    slug: input.slug,
    contentId: input.contentId,
  }).trim();
  return {
    enabled: true,
    template: configuredTemplate,
    footer: footer.length > 0 ? footer : null,
  };
}

