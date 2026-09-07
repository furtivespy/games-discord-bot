const onChange = require('on-change')
const jsonfile = require('jsonfile')
const { isInContainer } = require('./db/dataDir.js')
const configFileName = isInContainer() ? "/data/config.json" : "./config.json";

const configFile = jsonfile.readFileSync(configFileName);

const watchedObj = onChange(configFile, () => {
    jsonfile.writeFileSync(configFileName, watchedObj);
});

module.exports = watchedObj
