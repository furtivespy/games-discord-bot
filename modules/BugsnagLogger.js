const Bugsnag = require('@bugsnag/js')

class BugsnagLogger {
  constructor (options) {
    this.logger = require("./Logger.js");
    this.bugsnagClient = Bugsnag.start(options);
  }


  log (content, type = "log") {
    if (type === "error") {
      this.bugsnagClient.notify(content)
      return this.logger.log(content, type)
    } else {
      return this.logger.log(content, type)
    }
  }
  
  error (content) {
    return this.log(content, "error");
  }
  
  warn (content) {
    return this.log(content, "warn");
  }
  
  debug (content) {
    return this.log(content, "debug");
  } 
  
  cmd (content) {
    return this.log(content, "cmd");
  } 
}

module.exports = (options) => { return new BugsnagLogger(options) };