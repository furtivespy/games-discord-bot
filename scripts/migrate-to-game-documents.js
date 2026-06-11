const {
  runGameDocumentsMigration,
} = require("../db/migrateGameDocuments.js");

const MODE = process.argv.includes("--merge") ? "merge" : "replace";
const MONGO_URI = process.argv
  .find((arg) => arg.startsWith("--mongo-uri="))
  ?.slice("--mongo-uri=".length);

async function main() {
  const result = await runGameDocumentsMigration({
    mode: MODE,
    mongoUri: MONGO_URI || null,
  });

  console.log(result.summary);
}

main().catch((err) => {
  console.error(`Migration failed: ${err.message}`);
  process.exit(1);
});
