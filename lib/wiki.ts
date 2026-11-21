/**
 * Custom Wikipedia API layer
 * Docs: https://www.mediawiki.org/wiki/API:Main_page
 * All requests are made client-side from the browser so the app works
 * anywhere (Wikipedia API supports CORS via `origin=*`).
 */

const API_BASE = "https://en.wikipedia.org/w/api.php";
const REST_BASE = "https://en.wikipedia.org/api/rest_v1";

export interface SearchResult {
  title: string;
  snippet: string;
  wordcount: number;
  timestamp: string;
}

export interface ArticleSummary {
  title: string;
  description?: string;
  extract: string;
  thumbnail?: string;
  originalimage?: string;
  url: string;
  pageid?: number;
}

export interface ParsedArticle {
  title: string;
  pageid: number;
  html: string;
  sections: { index: number; number: string; line: string; level: number }[];
  images: { title: string; ns: number }[];
  externallinks: string[];
  displaytitle: string;
}

export interface OnThisDayItem {
  title: string;
  extract: string;
  thumbnail?: { source: string; width: number; height: number };
  originalimage?: { source: string };
  year?: number;
  text?: string;
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`Wikipedia API error: ${res.status}`);
  return res.json() as Promise<T>;
}

function apiUrl(params: Record<string, string | number>): string {
  const qs = new URLSearchParams({
    format: "json",
    formatversion: "2",
    origin: "*",
    ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])),
  });
  return `${API_BASE}?${qs.toString()}`;
}

export function stripHtml(html: string): string {
  if (typeof document === "undefined") return html.replace(/<[^>]*>/g, "");
  const div = document.createElement("div");
  div.innerHTML = html;
  return div.textContent || "";
}

export function articleUrl(title: string): string {
  return `/article/${encodeURIComponent(title.replace(/ /g, "_"))}`;
}

export function wikiUrl(title: string): string {
  return `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, "_"))}`;
}

/** Full-text search */
export async function searchArticles(
  query: string,
  limit = 20,
  offset = 0
): Promise<{ results: SearchResult[]; total: number }> {
  const data = await fetchJson<any>(
    apiUrl({
      action: "query",
      list: "search",
      srsearch: query,
      srlimit: limit,
      sroffset: offset,
      srprop: "snippet|wordcount|timestamp",
    })
  );
  return {
    results: (data.query?.search || []).map((r: any) => ({
      title: r.title,
      snippet: r.snippet,
      wordcount: r.wordcount,
      timestamp: r.timestamp,
    })),
    total: data.continue?.sroffset ?? data.query?.searchinfo?.totalhits ?? 0,
  };
}

/** Autocomplete suggestions */
export async function getSuggestions(query: string, limit = 8): Promise<string[]> {
  if (!query.trim()) return [];
  const data = await fetchJson<any>(
    apiUrl({
      action: "opensearch",
      search: query,
      limit,
      namespace: 0,
    })
  );
  return data[1] || [];
}

/** Summary + thumbnail for a single title */
export async function getSummary(title: string): Promise<ArticleSummary> {
  const data = await fetchJson<any>(
    apiUrl({
      action: "query",
      prop: "extracts|pageimages|description|info",
      titles: title,
      exintro: "1",
      explaintext: "1",
      exsectionformat: "plain",
      pithumbsize: 600,
      pilicense: "any",
      inprop: "url",
    })
  );
  const pages = data.query?.pages || [];
  const page = pages[0] || {};
  if (page.missing) throw new Error("Article not found");
  return {
    title: page.title || title,
    description: page.description,
    extract: page.extract || "",
    thumbnail: page.thumbnail?.source,
    originalimage: page.originalimage?.source,
    url: page.fullurl || wikiUrl(title),
    pageid: page.pageid,
  };
}

/** Summaries for many titles at once (for cards / featured) */
export async function getSummaries(titles: string[]): Promise<ArticleSummary[]> {
  const data = await fetchJson<any>(
    apiUrl({
      action: "query",
      prop: "extracts|pageimages|description|info",
      titles: titles.join("|"),
      exintro: "1",
      explaintext: "1",
      exsectionformat: "plain",
      exchars: 400,
      pithumbsize: 600,
      pilicense: "any",
      inprop: "url",
    })
  );
  const pages = data.query?.pages || [];
  return pages
    .filter((p: any) => !p.missing)
    .map((p: any) => ({
      title: p.title,
      description: p.description,
      extract: p.extract || "",
      thumbnail: p.thumbnail?.source,
      originalimage: p.originalimage?.source,
      url: p.fullurl || wikiUrl(p.title),
      pageid: p.pageid,
    }));
}

/** Full article HTML via action=parse */
export async function getArticle(title: string): Promise<ParsedArticle> {
  const data = await fetchJson<any>(
    apiUrl({
      action: "parse",
      page: title,
      prop: "text|sections|images|externallinks|displaytitle",
      disablelimitreport: "1",
      disableeditsection: "1",
      disabletoc: "1",
    })
  );
  if (data.error) throw new Error(data.error.info || "Article not found");
  return {
    title: data.parse.title,
    pageid: data.parse.pageid,
    html: data.parse.text?.["*"] || "",
    sections: data.parse.sections || [],
    images: data.parse.images || [],
    externallinks: data.parse.externallinks || [],
    displaytitle: data.parse.displaytitle || data.parse.title,
  };
}

/** Random articles */
export async function getRandomArticles(count = 6): Promise<ArticleSummary[]> {
  const data = await fetchJson<any>(
    apiUrl({
      action: "query",
      list: "random",
      rnlimit: count,
      rnnamespace: 0,
    })
  );
  const titles: string[] = (data.query?.random || []).map((r: any) => r.title);
  if (!titles.length) return [];
  return getSummaries(titles);
}

/** One random title (for "Random article" button) */
export async function getRandomTitle(): Promise<string> {
  const data = await fetchJson<any>(
    apiUrl({
      action: "query",
      list: "random",
      rnlimit: 1,
      rnnamespace: 0,
    })
  );
  return data.query?.random?.[0]?.title || "Albert Einstein";
}

/** On this day (REST API) */
export async function getOnThisDay(): Promise<{
  births: OnThisDayItem[];
  deaths: OnThisDayItem[];
  events: OnThisDayItem[];
  holidays: OnThisDayItem[];
  date: string;
}> {
  const now = new Date();
  const month = now.getMonth() + 1;
  const day = now.getDate();
  const data = await fetchJson<any>(
    `${REST_BASE}/feed/onthisday/selected/${month}/${day}`
  );
  const map = (arr: any[] = []) =>
    arr.map((x) => ({
      title: x.title,
      extract: x.extract || "",
      thumbnail: x.thumbnail,
      originalimage: x.originalimage,
      year: x.year,
      text: x.text,
    }));
  return {
    births: map(data.births),
    deaths: map(data.deaths),
    events: map(data.events),
    holidays: map(data.holidays),
    date: data.date || `${month}/${day}`,
  };
}

/** Categories for an article */
export async function getCategories(title: string): Promise<string[]> {
  const data = await fetchJson<any>(
    apiUrl({
      action: "query",
      prop: "categories",
      titles: title,
      cllimit: 30,
    })
  );
  const pages = data.query?.pages || [];
  const cats = pages[0]?.categories || [];
  return cats
    .map((c: any) => c.title.replace(/^Category:/, ""))
    .filter((c: string) => !c.startsWith("CS1") && !c.includes("Articles with"));
}

/** Clean Wikipedia HTML for safe rendering inside our app */
export function cleanArticleHtml(html: string): string {
  let out = html;

  // Rewrite internal wiki links to our article routes
  out = out.replace(/href="\/wiki\/([^"#]+)(#[^"]*)?"/g, (_m, title, hash) => {
    const decoded = decodeURIComponent(title.replace(/_/g, " "));
    return `href="/article/${encodeURIComponent(decoded.replace(/ /g, "_"))}${hash || ""}"`;
  });

  // Fix protocol-relative image URLs
  out = out.replace(/src="\/\//g, 'src="https://');
  out = out.replace(/srcset="\/\//g, 'srcset="https://');

  // Remove edit links / metadata spans
  out = out.replace(/<span class="mw-editsection[^>]*>.*?<\/span>/g, "");
  out = out.replace(/<span class="noprint[^>]*>.*?<\/span>/g, "");

  return out;
}

export const FEATURED_TITLES = [
  "Albert Einstein",
  "Marie Curie",
  "Leonardo da Vinci",
  "Isaac Newton",
  "Cleopatra",
  "Charles Darwin",
  "Ada Lovelace",
  "The Moon",
];

export const TOPICS = [
  { name: "History", icon: "🏛️", query: "history", desc: "Empires, wars, and turning points" },
  { name: "Science", icon: "🔬", query: "science", desc: "Physics, biology, and discovery" },
  { name: "Geography", icon: "🌍", query: "geography", desc: "Countries, rivers, and landmarks" },
  { name: "Biography", icon: "👤", query: "biography", desc: "Lives that shaped the world" },
  { name: "Arts & Culture", icon: "🎨", query: "art culture", desc: "Painting, music, and literature" },
  { name: "Technology", icon: "💻", query: "technology", desc: "Inventions and innovation" },
  { name: "Nature", icon: "🌿", query: "nature animals", desc: "Species and ecosystems" },
  { name: "Space", icon: "🚀", query: "space astronomy", desc: "Planets, stars, and exploration" },
  { name: "Philosophy", icon: "🧠", query: "philosophy", desc: "Ideas and thinkers" },
  { name: "Mathematics", icon: "📐", query: "mathematics", desc: "Numbers, logic, and proof" },
  { name: "Politics", icon: "⚖️", query: "politics government", desc: "States, law, and society" },
  { name: "Mythology", icon: "⚡", query: "mythology gods", desc: "Legends and ancient beliefs" },
];
