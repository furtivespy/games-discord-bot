/*
Logger class for easy and aesthetically pleasing console logging
*/
const chalk = require("chalk");
const moment = require("moment");

class Logger {
  static log (content, type = "log", location = "Unknown") {
    const timestamp = `[${moment().format("YYYY-MM-DD HH:mm:ss")}]`;
    switch (type) {
      case "log": {
        return console.log(`${timestamp}: ${chalk.bgBlue(type.toUpperCase())} ${content} `);
      }
      case "warn": {
        return console.log(`${timestamp}${location}: ${chalk.black.bgYellow(type.toUpperCase())} ${content} `);
      }
      case "error": {
        return console.log(`${timestamp}${location}: ${chalk.bgRed(type.toUpperCase())} ${content} `);
      }
      case "debug": {
        return console.log(`${timestamp}${location}: ${chalk.green(type.toUpperCase())} ${content} `);
      }
      case "cmd": {
        return console.log(`${timestamp}: ${chalk.black.bgWhite(type.toUpperCase())} ${content}`);
      }
      case "ready": {
        return console.log(`${timestamp}: ${chalk.black.bgGreen(type.toUpperCase())} ${content}`);
      } 
      default: throw new TypeError("Logger type must be either warn, debug, log, ready, cmd or error.");
    } 
  }
  
  static error (content, location = "Unknown") {
    return this.log(content, "error", location);
  }
  
  static warn (content, location = "Unknown") {
    return this.log(content, "warn", location);
  }
  
  static debug (content, location = "Unknown") {
    return this.log(content, "debug", location);
  } 
  
  static cmd (content, location = "Unknown") {
    return this.log(content, "cmd", location);
  } 
}

module.exports = Logger;