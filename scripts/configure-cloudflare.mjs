import { readFile, writeFile } from "node:fs/promises";
const id = process.env.REWORLD_D1_DATABASE_ID;
if (!id || !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id) || id === "00000000-0000-4000-8000-000000000000") {
  throw new Error("Set REWORLD_D1_DATABASE_ID to your Cloudflare D1 database ID before deployment.");
}
const config = JSON.parse(await readFile("wrangler.jsonc", "utf8"));
config.d1_databases[0].database_id = id;
await writeFile("wrangler.jsonc", JSON.stringify(config, null, 2) + "\n");
