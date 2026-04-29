import { createServer } from "../apps/api/src/server";

const app = createServer();
const response = await app.handle(new Request("http://localhost/docs/json"));

if (!response.ok) {
  console.error("❌ Failed to fetch OpenAPI spec");
  process.exit(1);
}

const schema = await response.json();
await Bun.write("openapi.json", JSON.stringify(schema, null, 2));
console.log("✅ OpenAPI contract exported to openapi.json");
process.exit(0);
