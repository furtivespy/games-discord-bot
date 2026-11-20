"use strict";

const GameDB = require("../../db/anygame.js");
const GameHelper = require("../GlobalGameHelper");
const Formatter = require("../GameFormatter");
const Shuffle = require("../../subcommands/cards/shuffle");

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

function cardIdOf(card) {
  return typeof card?.id === "string" ? card.id : String(card?.id ?? "");
}

function findCardIndex(cards, cardId) {
  const id = String(cardId || "");
  if (!id || !Array.isArray(cards)) return -1;
  return cards.findIndex((card) => cardIdOf(card) === id);
}

function findDeckByName(gameData, name) {
  const decks = Array.isArray(gameData?.decks) ? gameData.decks : [];
  return decks.find((deck) => deck?.name === name) || null;
}

function findPlayerByUserId(gameData, userId) {
  const uid = String(userId || "");
  if (!uid || !Array.isArray(gameData?.players)) return null;
  return gameData.players.find((player) => String(player?.userId) === uid) || null;
}

function playerDisplayName(player, fallback = "Player") {
  const name = typeof player?.name === "string" ? player.name.trim() : "";
  return name || fallback;
}

function cardShortName(card) {
  try {
    return Formatter.cardShortName(card);
  } catch {
    const name = typeof card?.name === "string" ? card.name.trim() : "";
    return name || "card";
  }
}

function takeCardFromHand(player, cardId) {
  const hand = mainHand(player);
  const index = findCardIndex(hand, cardId);
  if (index === -1) return null;
  const [card] = hand.splice(index, 1);
  if (!card) return null;
  return { card, index };
}

function returnCardToHand(player, card, index) {
  if (!card) return;
  const hand = mainHand(player);
  const at = Number.isInteger(index)
    ? Math.min(Math.max(0, index), hand.length)
    : hand.length;
  hand.splice(at, 0, card);
}

function defaultPlayDestination(gameData) {
  return gameData?.playToPlayArea ? "playarea" : "discard";
}

function placeCardAtDestination(
  gameData,
  player,
  card,
  actualDestination,
  { allowPlayArea, discardLabel, missingPileContent } = {}
) {
  if (actualDestination === "gameboard") {
    if (!Array.isArray(gameData.gameBoard)) gameData.gameBoard = [];
    gameData.gameBoard.push(card);
    return { ok: true, destinationName: "Game Board", destinationType: actualDestination };
  }
  if (allowPlayArea && actualDestination === "playarea") {
    if (!Array.isArray(player.playArea)) player.playArea = [];
    player.playArea.push(card);
    return { ok: true, destinationName: "play area", destinationType: actualDestination };
  }
  if (actualDestination === "discard") {
    const deck = findDeckByName(gameData, card.origin);
    if (deck?.piles?.discard && Array.isArray(deck.piles.discard.cards)) {
      deck.piles.discard.cards.push(card);
      return {
        ok: true,
        destinationName: discardLabel(deck),
        destinationType: actualDestination,
      };
    }
    return {
      ok: false,
      error: "discard_pile_missing",
      content: "Error: Could not find the discard pile. Card returned to hand.",
    };
  }
  const pile = GameHelper.getGlobalPile(gameData, actualDestination);
  if (pile && Array.isArray(pile.cards)) {
    pile.cards.push(card);
    return { ok: true, destinationName: pile.name, destinationType: "pile" };
  }
  return {
    ok: false,
    error: "destination_not_found",
    content: missingPileContent,
  };
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
      drawnCount: 0,
      wasShuffled: false,
      content: "No cards in draw pile",
    };
  }
  if (!player) {
    return {
      ok: false,
      error: "not_a_player",
      drawnCount: 0,
      wasShuffled: false,
      content: "You're not a player in this game.",
    };
  }

  let drawnCount = 0;
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
    drawnCount++;
  }

  const displayName = actorDisplayName(actor);
  const shuffleNote = wasShuffled ? " (deck was shuffled)" : "";
  if (drawnCount > 0) {
    try {
      GameHelper.recordMove(
        gameData,
        recordActor(actor),
        GameDB.ACTION_CATEGORIES.CARD,
        GameDB.ACTION_TYPES.DRAW,
        `${displayName} drew ${drawnCount} cards from ${deck.name}${shuffleNote}`,
        {
          cardCount: drawnCount,
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
    drawnCount,
    wasShuffled: wasShuffled.length > 0,
    content: `${displayName} drew ${drawnCount} cards from ${deck.name}${wasShuffled}`,
  };
}

function missingCardResult(content) {
  return {
    ok: false,
    error: "card_not_in_hand",
    content,
  };
}

/**
 * `/cards hand play`: move one card from the player's hand to the chosen
 * destination (default: play area when `playToPlayArea` is on, else discard).
 */
function playFromHand(gameData, { player, cardId, destination, actor } = {}) {
  if (!player) {
    return missingCardResult("Something is broken!?");
  }
  const taken = takeCardFromHand(player, cardId);
  if (!taken) {
    return missingCardResult("Something is broken!?");
  }
  const { card, index } = taken;

  const actualDestination =
    typeof destination === "string" && destination.trim()
      ? destination.trim()
      : defaultPlayDestination(gameData);

  const placed = placeCardAtDestination(gameData, player, card, actualDestination, {
    allowPlayArea: true,
    discardLabel: () => "discard pile",
    missingPileContent: "Destination not found (Pile or other)!",
  });
  if (!placed.ok) {
    returnCardToHand(player, card, index);
    return {
      ok: false,
      error: placed.error,
      content: placed.content,
    };
  }

  const displayName = actorDisplayName(actor);
  const cardName = cardShortName(card);
  try {
    GameHelper.recordMove(
      gameData,
      recordActor(actor),
      GameDB.ACTION_CATEGORIES.CARD,
      GameDB.ACTION_TYPES.PLAY,
      `${displayName} played ${cardName} to ${placed.destinationName}`,
      {
        cardId: card.id,
        cardName,
        destination: placed.destinationName,
        destinationType: placed.destinationType,
        origin: card.origin,
      },
      displayName
    );
  } catch (error) {
    console.warn("Failed to record card play in history:", error);
  }

  return {
    ok: true,
    error: null,
    card,
    destinationName: placed.destinationName,
    actualDestination,
    destinationType: placed.destinationType,
    content: `${displayName} has Played to ${placed.destinationName}:`,
  };
}

/**
 * `/cards hand discard`: move one card from the player's hand to discard
 * (or an optional destination). The public message does not name the card.
 */
function discardFromHand(gameData, { player, cardId, destination, actor } = {}) {
  if (!player) {
    return {
      ok: false,
      error: "card_not_in_hand",
      content: "Something is broken! You don't have that card.",
    };
  }
  const taken = takeCardFromHand(player, cardId);
  if (!taken) {
    return {
      ok: false,
      error: "card_not_in_hand",
      content: "Something is broken! You don't have that card.",
    };
  }
  const { card } = taken;

  const actualDestination =
    typeof destination === "string" && destination.trim()
      ? destination.trim()
      : "discard";

  const placed = placeCardAtDestination(gameData, player, card, actualDestination, {
    allowPlayArea: false,
    discardLabel: (deck) => `${deck.name} discard pile`,
    missingPileContent: "Pile not found!",
  });
  if (!placed.ok) {
    returnCardToHand(player, card);
    return {
      ok: false,
      error: placed.error,
      content: placed.content,
    };
  }
  const destinationName = placed.destinationName;

  const displayName = actorDisplayName(actor);
  try {
    GameHelper.recordMove(
      gameData,
      recordActor(actor),
      GameDB.ACTION_CATEGORIES.CARD,
      GameDB.ACTION_TYPES.DISCARD,
      `${displayName} discarded a card to ${destinationName}`,
      {
        destination: destinationName,
        destinationType: actualDestination,
        origin: card.origin,
      }
    );
  } catch (error) {
    console.warn("Failed to record card discard in history:", error);
  }

  const publicSuffix =
    actualDestination !== "discard" ? ` to ${destinationName}` : "";
  return {
    ok: true,
    error: null,
    card,
    destinationName,
    actualDestination,
    content: `${displayName} has Discarded a card${publicSuffix}`,
    privateContent: `You discarded ${cardShortName(card)}${publicSuffix}.`,
  };
}

/**
 * `/cards hand show`: reveal one card from the player's hand. The card stays
 * in the hand.
 */
function showFromHand(gameData, { player, cardId, actor } = {}) {
  if (!player) {
    return missingCardResult("Something is broken!?");
  }
  const hand = mainHand(player);
  const index = findCardIndex(hand, cardId);
  if (index === -1) {
    return missingCardResult("Something is broken!?");
  }
  const card = hand[index];
  const displayName = actorDisplayName(actor);
  const cardName = cardShortName(card);
  try {
    GameHelper.recordMove(
      gameData,
      recordActor(actor),
      GameDB.ACTION_CATEGORIES.CARD,
      GameDB.ACTION_TYPES.REVEAL,
      `${displayName} revealed ${cardName} from hand`,
      {
        cardId: card.id,
        cardName,
        source: "hand",
        action: "public reveal",
      }
    );
  } catch (error) {
    console.warn("Failed to record card show in history:", error);
  }

  return {
    ok: true,
    error: null,
    card,
    content: "Showing a card:",
  };
}

/**
 * `/cards hand pass`: move one card from the player's hand to another seat.
 */
function passFromHand(gameData, { player, cardId, targetUserId, actor } = {}) {
  if (!player) {
    return missingCardResult("Something is broken!?");
  }
  const targetId = String(targetUserId || "").trim();
  if (!targetId) {
    return {
      ok: false,
      error: "missing_target",
      content: "Pick a player to pass to.",
    };
  }
  if (String(player.userId) === targetId) {
    return {
      ok: false,
      error: "invalid_target",
      content: "The selected player is not in this game or is yourself.",
    };
  }
  const targetPlayer = findPlayerByUserId(gameData, targetId);
  if (!targetPlayer) {
    return {
      ok: false,
      error: "invalid_target",
      content: "The selected player is not in this game or is yourself.",
    };
  }
  const taken = takeCardFromHand(player, cardId);
  if (!taken) {
    return missingCardResult("Something is broken!?");
  }
  mainHand(targetPlayer).push(taken.card);

  const displayName = actorDisplayName(actor);
  const targetName = playerDisplayName(targetPlayer);
  try {
    GameHelper.recordMove(
      gameData,
      recordActor(actor),
      GameDB.ACTION_CATEGORIES.CARD,
      GameDB.ACTION_TYPES.PASS,
      `${displayName} passed 1 cards to ${targetName}`,
      { cardCount: 1, targetUserId: targetId }
    );
  } catch (error) {
    console.warn("Failed to record card pass in history:", error);
  }

  return {
    ok: true,
    error: null,
    card: taken.card,
    content: `${displayName} passed 1 card(s) to ${targetName}.`,
  };
}

/**
 * `/cards hand return`: move one card from the player's hand onto the origin
 * deck's draw pile (or an optional pile).
 */
function returnFromHand(gameData, { player, cardId, destination, actor } = {}) {
  if (!player) {
    return {
      ok: false,
      error: "card_not_in_hand",
      content: "Something is broken! You don't have that card.",
    };
  }
  const taken = takeCardFromHand(player, cardId);
  if (!taken) {
    return {
      ok: false,
      error: "card_not_in_hand",
      content: "Something is broken! You don't have that card.",
    };
  }
  const { card, index } = taken;
  const actualDestination =
    typeof destination === "string" && destination.trim()
      ? destination.trim()
      : "deck";

  let destinationName = "";
  if (actualDestination === "deck") {
    const deck = findDeckByName(gameData, card.origin);
    if (!deck?.piles?.draw || !Array.isArray(deck.piles.draw.cards)) {
      returnCardToHand(player, card, index);
      return {
        ok: false,
        error: "unknown_deck",
        content: "Unknown deck.",
      };
    }
    deck.piles.draw.cards.unshift(card);
    destinationName = `top of ${deck.name}`;
  } else {
    const pile = GameHelper.getGlobalPile(gameData, actualDestination);
    if (!pile || !Array.isArray(pile.cards)) {
      returnCardToHand(player, card, index);
      return {
        ok: false,
        error: "destination_not_found",
        content: "Pile not found!",
      };
    }
    pile.cards.push(card);
    destinationName = `top of ${pile.name}`;
  }

  const displayName = actorDisplayName(actor);
  try {
    GameHelper.recordMove(
      gameData,
      recordActor(actor),
      GameDB.ACTION_CATEGORIES.CARD,
      GameDB.ACTION_TYPES.RETURN,
      `${displayName} returned a card to ${destinationName}`,
      {
        cardId: card.id,
        destination: destinationName,
        destinationType: actualDestination,
      }
    );
  } catch (error) {
    console.warn("Failed to record card return in history:", error);
  }

  return {
    ok: true,
    error: null,
    card,
    destinationName,
    actualDestination,
    content: `${displayName} returned a card${
      actualDestination !== "deck" ? ` to ${destinationName}` : ""
    }`,
  };
}

module.exports = {
  dealMultiple,
  discardFromHand,
  drawMultiple,
  passFromHand,
  playFromHand,
  returnFromHand,
  showFromHand,
};
