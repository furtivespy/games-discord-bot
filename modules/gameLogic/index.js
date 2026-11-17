"use strict";

/**
 * Shared game-document mutations for slash commands and visual mode.
 * Adapters (subcommand handlers, `modules/embeddedActions.js`) load, persist,
 * and talk to Discord. Logic that both surfaces need lives here.
 */
const CardMoves = require("./cardMoves");
const PlayerScores = require("./playerScores");

module.exports = {
  CardMoves,
  PlayerScores,
  applyPlayerScores: PlayerScores.applyPlayerScores,
  dealMultiple: CardMoves.dealMultiple,
  drawMultiple: CardMoves.drawMultiple,
  setPlayerScore: PlayerScores.setPlayerScore,
};
