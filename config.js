const onChange = require('on-change')
const jsonfile = require('jsonfile')
const { resolveConfigPath } = require('./db/dataDir.js')
const configFileName = resolveConfigPath();

const configFile = jsonfile.readFileSync(configFileName);

const watchedObj = onChange(configFile, () => {
    jsonfile.writeFileSync(configFileName, watchedObj);
});

module.exports = watchedObj
