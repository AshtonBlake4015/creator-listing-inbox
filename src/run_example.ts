import { aggregateCreatorListings, clientFromEnvironment } from "./creator_listing_service.ts";

const raw = process.argv[2];
if (!raw) throw new Error("pass a JSON AggregateRequest argument");
const request = JSON.parse(raw);
const result = await aggregateCreatorListings(request, clientFromEnvironment());
console.log(JSON.stringify(result, null, 2));
