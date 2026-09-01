const {
  runSuggestionRecoveryMigration,
} = require("../db/migrateGameDocuments.js");

function main() {
  const result = runSuggestionRecoveryMigration();

  console.log(result.summary);
}

try {
  main();
} catch (err) {
  console.error(`Migration failed: ${err.message}`);
  process.exit(1);
}
