const fs = require("fs");
const path = require("path");

function isInContainer() {
  return process.env.IS_IN_CONTAINER === "true";
}

function resolveDataDir() {
  if (isInContainer()) {
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
  isInContainer,
  resolveDataDir,
  ensureDataDir,
};
