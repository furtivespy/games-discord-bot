const fs = require("fs");
const path = require("path");

function resolveDataDir() {
  if (process.env.IS_ON_FLY === "true") {
    return "/data";
  }
  if (process.env.GAMEBOT_DATA_DIR) {
    return path.resolve(process.env.GAMEBOT_DATA_DIR);
  }
  return path.resolve("./data");
}

function ensureDataDir() {
  const dataDir = resolveDataDir();
  fs.mkdirSync(dataDir, { recursive: true });
  return dataDir;
}

module.exports = {
  resolveDataDir,
  ensureDataDir,
};
