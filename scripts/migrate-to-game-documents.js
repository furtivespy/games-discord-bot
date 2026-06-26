const {
  runGameDocumentsMigration,
} = require("../db/migrateGameDocuments.js");

const MODE = process.argv.includes("--merge") ? "merge" : "replace";
const SKIP_MONGO = process.argv.includes("--skip-mongo");
const CLI_MONGO_URI = process.argv
  .find((arg) => arg.startsWith("--mongo-uri="))
  ?.slice("--mongo-uri=".length);

function resolveMongoUri() {
  if (CLI_MONGO_URI) return CLI_MONGO_URI;
  try {
    return require("../config.js").mongoConnectionString || null;
  } catch {
    return null;
  }
}

async function main() {
  const result = await runGameDocumentsMigration({
    mode: MODE,
    mongoUri: SKIP_MONGO ? null : resolveMongoUri(),
    skipMongo: SKIP_MONGO,
  });

  console.log(result.summary);
}

main().catch((err) => {
  console.error(`Migration failed: ${err.message}`);
  process.exit(1);
});
