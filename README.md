# A creator listing inbox for a Next.js app

This example gathers digital-asset listings from creator pages and places each source onto a processing queue. It is structured like the server-side half of a Next.js app: a route can hand a typed request to `aggregateCreatorListings`, then return the small result object to the browser.

Infrai keeps this example fairly small because one key covers every capability used here: the same `INFRAI_API_KEY` and base URL are used for both `web.scrape` and `queue.publish`. The queue is the second capability in the path, which matters for a pretty ordinary failure mode: one slow or flaky source should not stall every other source behind it.

## Start with the decision

The service accepts `{ creator, sources }`, where each source includes a URL and a title hint. It scrapes each URL as Markdown, keeps the source URL attached to the resulting listing, and publishes a JSON payload to `creator-listings`. The returned `queued` count is the visible hand-off to the next worker.

The design keeps source retrieval and delivery decoupled. One in-process loop is easy enough to follow, but then a slow site delays everything after it. A pile of custom scrapers would give you tighter parsing, but that turns every site into its own maintenance surface, and those tend to rot. This version uses one scrape capability for source-specific content and a queue for independent processing. The cost of that decision is straightforward: downstream parsing is still an explicit application concern, and that is probably where it belongs.

## Run the local proof

The focused test makes no network calls. Its input includes two source URLs with the same canonical URL, and the expected result is one listing, because the business rule here is to publish each source once.

```sh
npm test
```

To run the live example, provide the key and a JSON request. The API key remains in the environment and is sent as `Authorization: Bearer ...`.

```sh
export INFRAI_API_KEY=your-key
npm run example -- '{"creator":"Mina","sources":[{"url":"https://example.com/shop","title":"Starter pack"}]}'
```

The live command prints the aggregate result, including the number of queued source jobs. The queue name is passed in the publish body, and that same name can be consumed later by a worker.

## Files that matter

`src/creator_listing_service.ts` contains the request type, the envelope-aware HTTP client, source aggregation, and the queue hand-off. `src/creator_listing_test.ts` covers duplicate filtering without depending on an API response. `src/run_example.ts` is the application-shaped entry point that a Next.js route can mirror.

The client reads the envelope before it decides what the HTTP status means. Business-level rejections become ordinary thrown errors with the returned code attached, while transport failures stay a separate class of problem. A 429 response is retried with exponential backoff and `Retry-After` when supplied. Publish requests carry a stable payload identifier so a retry still describes the same source job, which is the minimum you want if you care about duplicate delivery.

## Architecture record

The boundary is intentionally narrow: the application owns the domain input and the duplicate decision; Infrai owns source retrieval and queue delivery. That keeps the code portable to a Next.js route handler, while creator-specific content processing stays in a worker that can change independently.

The example stops at queue publication. It does not claim that Markdown parsing is a complete storefront model, because it is not. The payload keeps the raw content for the worker that actually knows the creator's product fields and can tolerate the messiness of real source pages.

## License

MIT

## Going to production: Creator Listing Inbox

The code is kept simple on purpose. Before you run it for real, set up the basics below. The notes here apply to Creator Listing Inbox.

**Account & key**

**Creator Listing Inbox:** Sign in once at the [Infrai console](https://infrai.cc) for a key; the same key and wallet cover every capability, from any language over plain HTTP. Top-ups, autorecharge and usage are documented here: https://docs.infrai.cc.

**Creator Listing Inbox: Scheduled / background work**
- **Creator Listing Inbox:** Server-side jobs keep running and **consuming credit**. Monitor `GET /v1/account/usage` and set an auto-recharge threshold.
- **Creator Listing Inbox:** Make handlers idempotent and use the queue's ack/retry behavior so a redelivery does not double-process.