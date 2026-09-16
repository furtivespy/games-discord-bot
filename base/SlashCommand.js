
class SlashCommand {
    constructor(client, {
      name = null,
      description = "No description provided.",
      usage = "No usage provided.",
      enabled = true,
      permLevel = "User"
    }) {
      this.client = client;
      this.conf = { enabled, permLevel };
      this.help = { name, description, usage };
    }

    // New user-facing slash commands are listed by `/help` from the live
    // slashcommands/ tree. Add a one-line COMMAND_BLURBS entry in
    // modules/helpCatalog.js when the slash description is too terse, and
    // label Bot Owner / Administrator via permLevel.
    
  }
  module.exports = SlashCommand;