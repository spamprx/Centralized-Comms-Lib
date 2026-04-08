import type { CitationStyle, CitationWork } from "./citation.types";

function authorsApa(authors: string[] | undefined): string {
  if (!authors?.length) return "";
  if (authors.length === 1) return authors[0]!;
  if (authors.length === 2) return `${authors[0]}, & ${authors[1]}`;
  return `${authors.slice(0, -1).join(", ")}, & ${authors[authors.length - 1]}`;
}

function authorsIeee(authors: string[] | undefined): string {
  if (!authors?.length) return "";
  return authors.map((a) => (a.includes(",") ? a : `${a.split(" ").pop()}, ${a.split(" ").slice(0, -1).join(" ")}`)).join(", ");
}

function authorsMla(authors: string[] | undefined): string {
  if (!authors?.length) return "";
  if (authors.length === 1) return authors[0]!;
  return `${authors[0]}, et al.`;
}

export function renderCitation(style: CitationStyle, work: CitationWork): string {
  const year = work.year != null ? String(work.year) : "n.d.";
  const title = work.title || "Untitled";
  const doi = work.doi ? (work.doi.startsWith("http") ? work.doi : `https://doi.org/${work.doi}`) : "";

  switch (style) {
    case "APA": {
      const a = authorsApa(work.authors);
      const parts = [
        a,
        `(${year})`,
        title.endsWith(".") ? title : `${title}.`,
        work.container ? `${work.container}.` : "",
        work.volume != null ? `${work.volume}${work.issue != null ? `(${work.issue})` : ""}` : "",
        work.pages ? `pp. ${work.pages}.` : "",
        doi || work.url || "",
      ];
      return parts.filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
    }
    case "IEEE": {
      const a = authorsIeee(work.authors);
      const parts = [
        a,
        `, "${work.title},"`,
        work.proceedings || work.container || "",
        work.volume != null ? `vol. ${work.volume},` : "",
        work.issue != null ? `no. ${work.issue},` : "",
        work.pages ? `pp. ${work.pages},` : "",
        work.location ? `${work.location}` : "",
        year + ".",
        work.doi ? ` doi: ${work.doi.replace(/^https?:\/\/doi\.org\//, "")}.` : "",
      ];
      return parts.filter((p) => p && p !== ",").join(" ").replace(/\s+/g, " ").trim();
    }
    case "MLA": {
      const a = authorsMla(work.authors);
      const parts = [
        a ? `${a}.` : "",
        `"${title}."`,
        work.container ? `${work.container},` : "",
        work.publisher ? `${work.publisher},` : "",
        `${year}.`,
        work.pages ? `pp. ${work.pages}.` : "",
        work.url ? `${work.url}.` : "",
      ];
      return parts.filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
    }
    default:
      return renderCitation("APA", work);
  }
}
