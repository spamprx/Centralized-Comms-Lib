export type CitationStyle = "APA" | "IEEE" | "MLA";

export interface CitationWork {
  /** Primary author or organization */
  authors?: string[];
  title: string;
  container?: string;
  publisher?: string;
  year?: string | number;
  month?: string;
  day?: string | number;
  volume?: string | number;
  issue?: string | number;
  pages?: string;
  url?: string;
  doi?: string;
  /** IEEE / technical */
  proceedings?: string;
  location?: string;
}
