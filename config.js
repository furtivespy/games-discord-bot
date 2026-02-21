const onChange = require('on-change')
const jsonfile = require('jsonfile')
const configFileName = "./config.json";

const configFile = jsonfile.readFileSync(configFileName);

const watchedObj = onChange(configFile, () => {
    jsonfile.writeFileSync(configFileName, watchedObj);
});

module.exports = watchedObj
