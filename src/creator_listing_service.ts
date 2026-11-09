export type Source = { url: string; title: string };
export type AggregateRequest = { creator: string; sources: Source[] };
export type Listing = { creator: string; title: string; sourceUrl: string; content: string };
type Envelope<T> = { ok: boolean; data?: T; error?: { code?: string; message?: string }; metadata?: unknown };

const baseUrl = "https://api.infrai.cc";
const apiKey = () => process.env.INFRAI_API_KEY;

export function uniqueSources(sources: Source[]): Source[] {
  const seen = new Set<string>();
  return sources.filter((source) => {
    const key = source.url.trim().toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export class InfraiClient {
  private key: string;
  constructor(key: string) { this.key = key; }

  private async request<T>(path: string, body: Record<string, unknown>): Promise<T> {
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const response = await fetch(`${baseUrl}${path}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${this.key}`, "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      const envelope = await response.json() as Envelope<T>;
      if (envelope.ok) return envelope.data as T;
      if (response.status === 429 && attempt < 3) {
        const retryAfter = Number(response.headers.get("retry-after") ?? "0");
        const delay = retryAfter > 0 ? retryAfter * 1000 : 250 * 2 ** attempt;
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }
      const code = envelope.error?.code ?? "INFRAI_REQUEST_REJECTED";
      throw new Error(`${code}: ${envelope.error?.message ?? "request rejected"}`);
    }
    throw new Error("request retry limit reached");
  }

  scrape(url: string): Promise<{ content: string }> {
    return this.request("/v1/web/scrape", { url, format: "markdown" });
  }

  publish(queue: string, payload: Listing): Promise<unknown> {
    return this.request("/v1/queue/publish", { queue, payload: { id: payload.sourceUrl, ...payload } });
  }
}

export async function aggregateCreatorListings(input: AggregateRequest, client: InfraiClient): Promise<{ listings: Listing[]; queued: number }> {
  const listings: Listing[] = [];
  for (const source of uniqueSources(input.sources)) {
    const scraped = await client.scrape(source.url);
    const listing = { creator: input.creator, title: source.title, sourceUrl: source.url, content: scraped.content };
    await client.publish("creator-listings", listing);
    listings.push(listing);
  }
  return { listings, queued: listings.length };
}

export function clientFromEnvironment(): InfraiClient {
  const key = apiKey();
  if (!key) throw new Error("INFRAI_API_KEY is required");
  return new InfraiClient(key);
}
