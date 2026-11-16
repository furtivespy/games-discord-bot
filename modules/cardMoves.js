"use strict";

const GameDB = require("../db/anygame.js");
const GameHelper = require("./GlobalGameHelper");
const Shuffle = require("../subcommands/cards/shuffle");

function actorDisplayName(actor) {
  const display =
    typeof actor?.displayName === "string" && actor.displayName.trim()
      ? actor.displayName.trim()
      : "";
  if (display) return display;
  const username =
    typeof actor?.username === "string" && actor.username.trim()
      ? actor.username.trim()
      : "";
  return username || "Player";
}

function recordActor(actor) {
  return {
    id: actor?.id,
    username:
      typeof actor?.username === "string" && actor.username.trim()
        ? actor.username
        : actorDisplayName(actor),
  };
}

function mainHand(player) {
  if (!player.hands || typeof player.hands !== "object") {
    player.hands = { main: [] };
  }
  if (!Array.isArray(player.hands.main)) {
    player.hands.main = [];
  }
  return player.hands.main;
}

function drawPileLength(deck) {
  return Array.isArray(deck?.piles?.draw?.cards) ? deck.piles.draw.cards.length : 0;
}

function discardPileLength(deck) {
  return Array.isArray(deck?.piles?.discard?.cards)
    ? deck.piles.discard.cards.length
    : 0;
}

function takeTopDrawCard(deck) {
  return deck.piles.draw.cards.shift();
}

/**
 * `/cards deck deal`: deal `count` cards to each player from `deck`.
 * Same shuffle-and-stop rules as the slash command.
 */
function dealMultiple(gameData, { deck, count, actor } = {}) {
  const cardCount = Number(count);
  if (!deck || drawPileLength(deck) + discardPileLength(deck) < 1) {
    return {
      ok: false,
      error: "no_cards_to_deal",
      dealCount: 0,
      content: "No cards to deal.",
    };
  }

  let dealCount = 0;
  const players = Array.isArray(gameData?.players) ? gameData.players : [];

  dealLoop: for (let i = 0; i < cardCount; i++) {
    for (const player of players) {
      if (drawPileLength(deck) < 1) {
        Shuffle.DoShuffle(deck);
      }
      if (drawPileLength(deck) < 1) {
        break dealLoop;
      }
      mainHand(player).push(takeTopDrawCard(deck));
      dealCount++;
    }
  }

  const displayName = actorDisplayName(actor);
  try {
    GameHelper.recordMove(
      gameData,
      recordActor(actor),
      GameDB.ACTION_CATEGORIES.CARD,
      GameDB.ACTION_TYPES.DEAL,
      `${displayName} dealt ${dealCount} cards from ${deck.name} to all players`,
      {
        deckName: deck.name,
        cardCount: dealCount,
        requestedCount: cardCount,
        playerCount: players.length,
      }
    );
  } catch (error) {
    console.warn("Failed to record card deal in history:", error);
  }

  return {
    ok: true,
    error: null,
    dealCount,
    content: `Dealt out a total of ${dealCount} cards from ${deck.name}.`,
  };
}

/**
 * `/cards deck drawmultiple`: draw `count` cards into `player`'s hand.
 * Same shuffle-and-stop rules as the slash command.
 */
function drawMultiple(gameData, { deck, count, actor, player } = {}) {
  const cardCount = Number(count);
  if (!deck || drawPileLength(deck) < 1) {
    return {
      ok: false,
      error: "no_cards_in_draw",
      dealCount: 0,
      wasShuffled: false,
      content: "No cards in draw pile",
    };
  }
  if (!player) {
    return {
      ok: false,
      error: "not_a_player",
      dealCount: 0,
      wasShuffled: false,
      content: "You're not a player in this game.",
    };
  }

  let dealCount = 0;
  let wasShuffled = "";

  dealLoop: for (let i = 0; i < cardCount; i++) {
    if (drawPileLength(deck) < 1) {
      wasShuffled = "\n**The deck was shuffled**";
      Shuffle.DoShuffle(deck);
    }
    if (drawPileLength(deck) < 1) {
      break dealLoop;
    }
    mainHand(player).push(takeTopDrawCard(deck));
    dealCount++;
  }

  const displayName = actorDisplayName(actor);
  const shuffleNote = wasShuffled ? " (deck was shuffled)" : "";
  if (dealCount > 0) {
    try {
      GameHelper.recordMove(
        gameData,
        recordActor(actor),
        GameDB.ACTION_CATEGORIES.CARD,
        GameDB.ACTION_TYPES.DRAW,
        `${displayName} drew ${dealCount} cards from ${deck.name}${shuffleNote}`,
        {
          cardCount: dealCount,
          deckName: deck.name,
          source: "draw pile",
          wasShuffled: wasShuffled.length > 0,
        },
        displayName
      );
    } catch (error) {
      console.warn("Failed to record multi-card draw in history:", error);
    }
  }

  return {
    ok: true,
    error: null,
    dealCount,
    wasShuffled: wasShuffled.length > 0,
    content: `${displayName} drew ${dealCount} cards from ${deck.name}${wasShuffled}`,
  };
}

module.exports = {
  dealMultiple,
  drawMultiple,
  actorDisplayName,
};
