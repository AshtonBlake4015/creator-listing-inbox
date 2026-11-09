import { strict as assert } from "node:assert";
import { uniqueSources } from "./creator_listing_service.ts";

const input = [
  { url: "https://creator.test/shop", title: "Pack" },
  { url: "HTTPS://CREATOR.TEST/shop", title: "Duplicate" },
  { url: "https://creator.test/course", title: "Course" }
];

assert.deepEqual(uniqueSources(input), [input[0], input[2]]);
console.log("duplicate source decision: passed");
