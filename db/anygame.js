const Discord = require('discord.js');
const { cloneDeep, forEach } = require('lodash');
const { nanoid } = require('nanoid');

class GameDatabase {
    
    // History tracking constants
    ACTION_CATEGORIES = {
        GAME: 'game',
        PLAYER: 'player',
        CARD: 'card', 
        TOKEN: 'token',
        MONEY: 'money',
        SECRET: 'secret',
        TEAM: 'team'
    }

    ACTION_TYPES = {
        CREATE: 'create',
        DELETE: 'delete',
        ADD: 'add',
        REMOVE: 'remove',
        MODIFY: 'modify',
        DRAW: 'draw',
        PLAY: 'play',
        DISCARD: 'discard',
        SHUFFLE: 'shuffle',
        DEAL: 'deal',
        FLIP: 'flip',
        BURN: 'burn',
        GIVE: 'give',
        TAKE: 'take',
        GAIN: 'gain',
        LOSE: 'lose',
        PAY: 'pay',
        SPEND: 'spend',
        REVEAL: 'reveal',
        PASS: 'pass',
        STEAL: 'steal',
        ADVANCE: 'advance',
        REVERSE: 'reverse',
        SCORE: 'score',
        NOTE: 'note',
        RETURN: 'return',
        RECALL: 'recall',
        STAGE: 'stage'
    }

    defaultGameData = {
        decks: [],
        players: [],
        teams: [], // Added for team feature
        name: "",
        isdeleted: true,
        winner: null,
        bggGameId: null,
        isCustomGame: false, // true when started with customname (not on BGG)
        reverseOrder: false,
        tokens: [],
        customDice: [], // Added for custom dice feature
        playToPlayArea: false, // Added for play area feature
        history: [], // Added for history tracking feature
        lastStatusMessageId: null,
        lastStatusMessageTimestamp: null,
        pinnedStatusMode: 'off', // 'off' | 'on' | 'full' — live pinned status (default off)
        pinnedStatusEnabled: false, // Legacy boolean; kept as a fallback. New writes persist pinnedStatusMode.
        pinnedStatusMessageId: null,
        pinnedStatusChannelId: null,
        pinnedStatusPinned: false,
        gameBoard: [], // Added for game board feature - shared play area for all players
        globalPiles: [], // Added for global piles feature - configurable card piles
    }

    defaultBGGGameData = {
        links: [],
        attachments: [],
    }
    
    defaultSecretData = {
        isrevealed: true,
        players: [],
        mode: 'normal' // 'normal' or 'super-secret'
    }

    defaultDeck = {
        name: "",
        id: "",
        allCards: [],
        shuffleStyle: "standard",
        hiddenInfo: "visible",
        piles: {
            draw: { cards: [], viewable: false },
            discard: { cards: [], viewable: true },
        }
    }

    defaultCard = {
        id: "",
        name: "",
        description: "",
        type: "",
        suit: "",
        value: "",
        url: null,
        origin: "",
        format: "A"
    }
    
    defaultPlayer = {
        guildId: "1",
        userId: "1",
        order: 1,
        score: "",
        money: 0,
        name: null,
        hands: {
            main: [],
            played: [],
            passed: [],
            received: [],
            simultaneous: []
        },
        playArea: [], // Added for play area feature
        color: null,
        tokens: {},
        teamId: null, // Added for team feature
    }
    
    defaultHand = {
        deck: "",
        cards: [],
    }

    defaultToken = {
        id: "",
        name: "",
        description: "",
        isSecret: false,
        created: "",
        createdBy: "",
    }

    defaultTeam = {
        id: "",
        name: "",
        color: null,
    }

    defaultGlobalPile = {
        id: "",
        name: "",
        cards: [],
        isSecret: false,
        viewable: true,
        showTopCard: false,
        created: "",
        createdBy: "",
    }

    isEmptyCardSet(cardset) {
        return cardset === "empty" || cardset === "customempty"
    }

    createCard(deck, name, description = "", type = "", suit = "", value = "", format = "A", image){
        return cloneDeep({
            id: nanoid(),
            name: name,
            description: description,
            type: type,
            suit: suit,
            value: value,
            url: image,
            origin: deck,
            format, format
        })
    }

    createCardFromObj(deck, format, cardObj){
        return cloneDeep( {
            id: nanoid(),
            name: cardObj.name,
            description: cardObj?.description ?? "",
            type: cardObj?.type ?? "",
            suit: cardObj?.suit ?? "",
            value: cardObj?.value ?? "",
            url: cardObj?.url,
            origin: deck,
            format: format
        })
    }

    createCardFromObjList(deck, format, list){
        let results = []
        forEach(list, item => {
            results.push(cloneDeep(this.createCardFromObj(deck, format, item)))
        })
        return results
    }

    createCardFromStrList(deck, list){
        let results = []
        forEach(list, item => {
            results.push(cloneDeep(this.createCard(deck, item)))
        })
        return results
    }

    cardShortString(cardObj){
        let cardStr = cardObj.name
        if (cardObj.type.length > 0) { cardStr += ` of ${cardObj.type}`}
        return cardStr
    }

    cardString(cardObj){
        let cardStr = this.cardShortString(cardObj)
        if (cardObj.description.length > 0) { cardStr += ` *(${cardObj.description})*`}
        if (cardObj.url) { cardStr += ` [image](${cardObj.url})` }
        return cardStr
    }
}

module.exports = new GameDatabase();