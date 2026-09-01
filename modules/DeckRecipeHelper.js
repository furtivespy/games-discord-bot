const GameDB = require('../db/anygame.js')
const { cloneDeep } = require('lodash')

const MAX_COPIES = 50

function ensureRecipePiles(deck) {
    if (!Array.isArray(deck.allCards)) {
        deck.allCards = []
    }
    if (!deck.piles) {
        deck.piles = {
            draw: { cards: [], viewable: false },
            discard: { cards: [], viewable: true },
        }
    }
    if (!deck.piles.draw) {
        deck.piles.draw = { cards: [], viewable: false }
    }
    if (!Array.isArray(deck.piles.draw.cards)) {
        deck.piles.draw.cards = []
    }
    if (!deck.piles.discard) {
        deck.piles.discard = { cards: [], viewable: true }
    }
    if (!Array.isArray(deck.piles.discard.cards)) {
        deck.piles.discard.cards = []
    }
}

function addCardsToRecipe(deck, cards) {
    ensureRecipePiles(deck)
    const added = []
    for (const card of cards) {
        deck.allCards.push(card)
        deck.piles.discard.cards.push(cloneDeep(card))
        added.push(card)
    }
    return added
}

function addRichCards(deck, cardFields, copies = 1) {
    const count = Math.max(1, Math.min(MAX_COPIES, Number(copies) || 1))
    const format = cardFields.format || 'A'
    const cards = []
    for (let i = 0; i < count; i++) {
        cards.push(GameDB.createCardFromObj(deck.name, format, {
            name: cardFields.name,
            description: cardFields.description || '',
            type: cardFields.type || '',
            suit: cardFields.suit || '',
            value: cardFields.value || '',
            url: cardFields.url || null,
        }))
    }
    return addCardsToRecipe(deck, cards)
}

function parseNameList(customlist) {
    if (!customlist || typeof customlist !== 'string') {
        return []
    }
    return customlist.split(',').map(name => name.trim()).filter(name => name.length > 0)
}

function addCardsFromNameList(deck, customlist) {
    const names = parseNameList(customlist)
    const cards = GameDB.createCardFromStrList(deck.name, names)
    return addCardsToRecipe(deck, cards)
}

module.exports = {
    MAX_COPIES,
    addCardsToRecipe,
    addRichCards,
    addCardsFromNameList,
    parseNameList,
}
