const GameDB = require('../db/anygame.js')
const Formatter = require('./GameFormatter')
const { cloneDeep } = require('lodash')

const MAX_COPIES = 50
const DISCORD_CONTENT_MAX = 2000
const INVALID_IMAGE_URL_MESSAGE = 'Card image URL must be a valid http or https URL.'

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

function isEmbedImageUrl(url) {
    if (!url || typeof url !== 'string') {
        return false
    }
    const trimmed = url.trim()
    if (!trimmed || trimmed.length > 2048) {
        return false
    }
    try {
        const parsed = new URL(trimmed)
        return parsed.protocol === 'http:' || parsed.protocol === 'https:'
    } catch {
        return false
    }
}

function addCardsFromNameList(deck, customlist) {
    const names = parseNameList(customlist)
    const cards = GameDB.createCardFromStrList(deck.name, names)
    return addCardsToRecipe(deck, cards)
}

function clipContent(content) {
    const text = String(content || '')
    if (text.length <= DISCORD_CONTENT_MAX) {
        return text
    }
    return text.slice(0, DISCORD_CONTENT_MAX)
}

function formatAddCardContent(actorDisplayName, deckName, added) {
    const count = added?.length || 0
    const name = added?.[0]?.name
    if (name) {
        const withName = `${actorDisplayName} added ${count} card(s) "${name}" to ${deckName}`
        if (withName.length <= DISCORD_CONTENT_MAX) {
            return withName
        }
    }
    return clipContent(`${actorDisplayName} added ${count} card(s) to ${deckName}`)
}

function formatAddListContent(actorDisplayName, deckName, names) {
    const count = names?.length || 0
    const prefix = `${actorDisplayName} added ${count} card(s) to ${deckName}`
    if (!names || names.length < 1) {
        return clipContent(prefix)
    }
    const withNames = `${prefix}: ${names.join(', ')}`
    if (withNames.length <= DISCORD_CONTENT_MAX) {
        return withNames
    }
    return clipContent(`${prefix}. (Card list too long to display.)`)
}

function buildAddCardEmbeds(gameData, card) {
    const embeds = []
    if (card) {
        try {
            embeds.push(Formatter.oneCard(card))
        } catch (error) {
            console.warn('Failed to build addcard image embed:', error)
        }
    }
    try {
        embeds.push(...Formatter.deckStatus2(gameData))
    } catch (error) {
        console.warn('Failed to build deck status embeds:', error)
    }
    return embeds
}

async function editReplyAfterSave(interaction, payload) {
    try {
        await interaction.editReply(payload)
        return
    } catch (error) {
        console.warn('Failed to send recipe add reply after save:', error)
    }
    try {
        await interaction.editReply({
            content: clipContent(payload?.content || 'Cards added to the deck recipe.'),
        })
    } catch (error) {
        console.warn('Failed to send recipe add fallback reply after save:', error)
    }
}

module.exports = {
    MAX_COPIES,
    DISCORD_CONTENT_MAX,
    INVALID_IMAGE_URL_MESSAGE,
    addCardsToRecipe,
    addRichCards,
    addCardsFromNameList,
    parseNameList,
    isEmbedImageUrl,
    formatAddCardContent,
    formatAddListContent,
    buildAddCardEmbeds,
    editReplyAfterSave,
}
