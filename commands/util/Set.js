const Command = require('../../base/Command.js')
const { codeBlock } = require("@discordjs/builders");

class SetCMD extends Command {
    constructor(client){
        super(client, {
            name: "set",
            description: "View or change settings for your server.",
            category: "Utility",
            usage: "Here are some examples of what you can do (using default prefix):\n"+
              "- to get a list of all settings and their values: `!set`\n" +
              "- to change a value of a setting: `!set edit adminRole CoolGuys`\n" +
              "- to reset back to default: `!set reset prefix` ",
            enabled: true,
            guildOnly: true,
            allMessages: false,
            showHelp: true,
            aliases: ["setting", "settings"],
            permLevel: "Administrator"
          })
    }

    async run (message, [action, key, ...value], level) { // eslint-disable-line no-unused-vars

        // First we need to retrieve current guild settings
        const settings = message.settings;
        const defaults = this.client.settings.get("default");
        const overrides = this.client.settings.get(message.guild.id);
        if (!this.client.settings.has(message.guild.id)) this.client.settings.set(message.guild.id, {});
      
        // Secondly, if a user does `-set edit <key> <new value>`, let's change it
        if (action === "edit") {
          // User must specify a key.
          if (!key) return message.reply("Please specify a key to edit");
          // User must specify a key that actually exists!
          if (!settings[key]) return message.reply("This key does not exist in the settings");
          // User must specify a value to change.
          const joinedValue = value.join(" ");
          if (joinedValue.length < 1) return message.reply("Please specify a new value");
          // User must specify a different value than the current one.
          if (joinedValue === settings[key]) return message.reply("This setting already has that value!");
    
          // If the guild does not have any overrides, initialize it.
          if (!this.client.settings.has(message.guild.id)) this.client.settings.set(message.guild.id, {});
    
          // Modify the guild overrides directly.
          this.client.settings.set(message.guild.id, joinedValue, key);
          message.reply(`${key} successfully edited to ${joinedValue}`);
        } else
      
        // If a user does `-set del <key>`, let's ask the user if they're sure...
        if (action === "del" || action === "reset") {
          if (!key) return message.reply("Please specify a key to delete (reset).");
          if (!settings[key]) return message.reply("This key does not exist in the settings");
          if (!overrides[key]) return message.reply("This key does not have an override and is already using defaults.");
    
          // Throw the 'are you sure?' text at them.
          const response = await this.client.awaitReply(message, `Are you sure you want to reset \`${key}\` to the default \`${defaults[key]}\`?`);
    
          // If they respond with y or yes, continue.
          if (["y", "yes"].includes(response)) {
    
            // We reset the `key` here.
            this.client.settings.delete(message.guild.id, key);
            message.reply(`${key} was successfully reset to default.`);
          } else
    
          // If they respond with n or no, we inform them that the action has been cancelled.
          if (["n","no","cancel"].includes(response)) {
            message.reply(`Your setting for \`${key}\` remains at \`${settings[key]}\``);
          }
        } else
      
        // Using `-set get <key>` we simply return the current value for the guild.
        if (action === "get") {
          if (!key) return message.reply("Please specify a key to view");
          if (!settings[key]) return message.reply("This key does not exist in the settings");
          message.reply(`The value of ${key} is currently ${settings[key]}`);
          
        } else {
          // Otherwise, the default action is to return the whole configuration;
          const array = [];
          Object.entries(settings).forEach(([key, value]) => {
            array.push(`${key}${" ".repeat(20 - key.length)}::  ${value}`); 
          });
          await message.channel.send(codeBlock("asciidoc", `= Current Guild Settings =\n${array.join("\n")}`));
        }
      }
    }

module.exports = SetCMD