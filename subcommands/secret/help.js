const { replyHelp } = require("../../modules/helpCatalog.js");

module.exports = {
  async execute(interaction, client) {
    await replyHelp(interaction, client, { topicId: "extras" });
  },
};
