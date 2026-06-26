const SlashCommand = require("../../base/SlashCommand.js");
const { SlashCommandBuilder, MessageFlags } = require("discord.js");
const { resolveDataDir } = require("../../db/dataDir.js");

class Diagnostic extends SlashCommand {
  constructor(client) {
    super(client, {
      name: "diagnostic",
      description: "Run data persistence diagnostics (Bot Owner only)",
      permLevel: "Bot Owner",
    });
    this.data = new SlashCommandBuilder()
      .setName(this.help.name)
      .setDescription(this.help.description)
      .setDMPermission(false);
  }

  async execute(interaction) {
    if (interaction.user.id !== this.client.config.botOwnerId) {
      return interaction.reply({
        content: "You do not have permission to use this command. (Bot Owner Only)",
        flags: MessageFlags.Ephemeral,
      });
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const lines = [];

    // Data directory
    const dataDir = resolveDataDir();
    lines.push(`Data directory : ${dataDir}`);
    lines.push("");

    // GameStore (game_documents.sqlite) diagnostics
    lines.push("── game_documents.sqlite ──────────────────────");
    try {
      const gsDiag = this.client.db.runDiagnostic();
      const syncLabels = { 0: "OFF", 1: "NORMAL", 2: "FULL", 3: "EXTRA" };
      const syncLabel = syncLabels[gsDiag.synchronous] ?? String(gsDiag.synchronous);
      lines.push(`  journal_mode  : ${gsDiag.journalMode}`);
      lines.push(`  synchronous   : ${syncLabel} (${gsDiag.synchronous})`);
      lines.push(
        `  write→read cycle : ${gsDiag.cycleOk ? "PASS ✓" : `FAIL ✗${gsDiag.cycleError ? " — " + gsDiag.cycleError : ""}`}`
      );
    } catch (e) {
      lines.push(`  ERROR: ${e.message}`);
    }
    lines.push("");

    // BunEnmap (settings.sqlite) diagnostics
    lines.push("── settings.sqlite (BunEnmap) ─────────────────");
    try {
      const emDiag = this.client.settings.runDiagnostic();
      lines.push(
        `  write→read cycle : ${emDiag.cycleOk ? "PASS ✓" : `FAIL ✗${emDiag.cycleError ? " — " + emDiag.cycleError : ""}`}`
      );
    } catch (e) {
      lines.push(`  ERROR: ${e.message}`);
    }
    lines.push("");

    // Active game in current channel
    lines.push("── Active game in this channel ────────────────");
    const guildId = interaction.guildId;
    const channelId = interaction.channelId;

    if (!guildId) {
      lines.push("  (no guild — DM context)");
    } else {
      try {
        const gameData = await this.client.getGameDataV2(guildId, "game", channelId);
        if (!gameData || Object.keys(gameData).length === 0) {
          lines.push("  No active game found in this channel.");
        } else {
          const raw = this.client.db.getGameRawRow(guildId, "game", channelId);
          const playerCount =
            gameData.players != null
              ? Object.keys(gameData.players).length
              : "n/a";
          lines.push(`  isdeleted    : ${gameData.isdeleted ?? false}`);
          lines.push(`  player count : ${playerCount}`);
          lines.push(`  updated_at   : ${raw?.updated_at ?? "n/a (legacy cache)"}`);
        }
      } catch (e) {
        lines.push(`  ERROR: ${e.message}`);
      }
    }

    const content = lines.join("\n");
    const truncated = content.length > 1900 ? content.slice(0, 1897) + "..." : content;
    await interaction.editReply({ content: `\`\`\`\n${truncated}\n\`\`\`` });
  }
}

module.exports = Diagnostic;
