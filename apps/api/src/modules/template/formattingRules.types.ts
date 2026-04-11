/**
 * Persisted JSON shape for `TemplateFormattingRule.rules`.
 */
export interface TemplateFormattingRules {
  fonts?: {
    /** If set, only these font families (CSS names, lowercased) are allowed on textStyle marks */
    allowedFamilies?: string[];
  };
  colors?: {
    /** Allowed #RRGGBB (normalized); if set, other colors violate */
    allowedHex?: string[];
    /** When true and allowedHex is set, require every colored text to use the palette */
    restrictToPalette?: boolean;
  };
  headings?: {
    /** Maximum heading level (1 = only H1-style, 6 = all) */
    maxLevel?: number;
    /** If set, levels not in this list violate */
    allowedLevels?: number[];
  };
  media?: {
    maxImageCount?: number;
    maxVideoEmbedCount?: number;
  };
}

export interface FormattingViolation {
  code: string;
  message: string;
  path: string;
  detail?: Record<string, unknown>;
}
