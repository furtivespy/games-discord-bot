const GameDB = require('../db/anygame.js')
const Formatter = require('./GameFormatter')
const GameHelper = require('./GlobalGameHelper')
const { cloneDeep } = require('lodash')

const MAX_COPIES = 50
const DISCORD_CONTENT_MAX = 2000
const INVALID_IMAGE_URL_MESSAGE = 'Card image URL must be a valid http or https URL.'
const EDITABLE_FIELDS = ['name', 'url', 'type', 'suit', 'value', 'description', 'format']
const MISSING_CARD_MESSAGE = 'No card found with that id in this deck.'
const NO_FIELDS_MESSAGE = 'No fields changed.'
const EMPTY_NAME_MESSAGE = 'Card name cannot be empty.'
const INVALID_FORMAT_MESSAGE = 'Format must be A, B, or C.'

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
        console.warn('Failed to send recipe editor reply after save:', error)
    }
    try {
        await interaction.editReply({
            content: clipContent(payload?.content || 'Deck recipe updated.'),
        })
    } catch (error) {
        console.warn('Failed to send recipe editor fallback reply after save:', error)
    }
}

function snapshotEditableFields(card) {
    return {
        name: String(card?.name ?? ''),
        url: card?.url ? String(card.url) : '',
        type: String(card?.type ?? ''),
        suit: String(card?.suit ?? ''),
        value: String(card?.value ?? ''),
        description: String(card?.description ?? ''),
        format: String(card?.format ?? 'A').toUpperCase(),
    }
}

function diffEditableFields(original, submitted) {
    if (!submitted || typeof submitted !== 'object') {
        return {}
    }
    const before = snapshotEditableFields(original)
    const after = snapshotEditableFields(submitted)
    const raw = {}
    for (const field of EDITABLE_FIELDS) {
        if (!Object.prototype.hasOwnProperty.call(submitted, field)) continue
        if (before[field] !== after[field]) {
            raw[field] = after[field]
        }
    }
    return raw
}

function findRecipeCard(deck, cardId) {
    const id = String(cardId || '')
    if (!id) return null
    return (deck?.allCards || []).find((card) => card?.id === id) || null
}

function normalizeEditPatch(rawPatch) {
    if (!rawPatch || Object.keys(rawPatch).length === 0) {
        return { error: NO_FIELDS_MESSAGE }
    }

    const patch = {}
    if (Object.prototype.hasOwnProperty.call(rawPatch, 'name')) {
        const name = String(rawPatch.name ?? '').trim()
        if (!name) {
            return { error: EMPTY_NAME_MESSAGE }
        }
        patch.name = name
    }
    if (Object.prototype.hasOwnProperty.call(rawPatch, 'url')) {
        const url = String(rawPatch.url ?? '').trim()
        if (!url) {
            patch.url = null
        } else if (!isEmbedImageUrl(url)) {
            return { error: INVALID_IMAGE_URL_MESSAGE }
        } else {
            patch.url = url
        }
    }
    for (const field of ['type', 'suit', 'value', 'description']) {
        if (Object.prototype.hasOwnProperty.call(rawPatch, field)) {
            patch[field] = String(rawPatch[field] ?? '').trim()
        }
    }
    if (Object.prototype.hasOwnProperty.call(rawPatch, 'format')) {
        const format = String(rawPatch.format ?? '').trim().toUpperCase()
        if (!['A', 'B', 'C'].includes(format)) {
            return { error: INVALID_FORMAT_MESSAGE }
        }
        patch.format = format
    }
    if (Object.keys(patch).length === 0) {
        return { error: NO_FIELDS_MESSAGE }
    }
    return { patch }
}

function applyCardPatch(card, patch) {
    if (!card || !patch) return
    for (const field of EDITABLE_FIELDS) {
        if (Object.prototype.hasOwnProperty.call(patch, field)) {
            card[field] = patch[field]
        }
    }
}

function isSelectedDeck(deck, selected) {
    if (!selected) return true
    if (deck === selected) return true
    return Boolean(selected.name) && deck?.name === selected.name
}

function visitCardLists(gameData, visit, options = {}) {
    const visitList = (list) => {
        if (Array.isArray(list)) {
            visit(list)
        } else if (list && Array.isArray(list.cards)) {
            visit(list.cards)
        }
    }

    for (const deck of gameData?.decks || []) {
        if (!isSelectedDeck(deck, options.deck)) continue
        visitList(deck.allCards)
        if (deck.piles) {
            for (const pile of Object.values(deck.piles)) {
                visitList(pile?.cards)
            }
        }
    }

    for (const player of gameData?.players || []) {
        if (player.hands) {
            for (const loc of Object.values(player.hands)) {
                visitList(loc)
            }
        }
        visitList(player.playArea)
    }

    visitList(gameData?.gameBoard)

    for (const pile of gameData?.globalPiles || []) {
        visitList(pile?.cards)
    }
}

function editCardById(gameData, deck, cardId, patch) {
    const id = String(cardId || '')
    const recipe = findRecipeCard(deck, id)
    if (!recipe) {
        return { ok: false, error: MISSING_CARD_MESSAGE }
    }

    let updatedCount = 0
    visitCardLists(gameData, (cards) => {
        for (const card of cards) {
            if (card?.id === id) {
                applyCardPatch(card, patch)
                updatedCount++
            }
        }
    }, { deck })

    return {
        ok: true,
        card: recipe,
        updatedCount,
    }
}

function recipeCardChoiceLabel(card) {
    const id = String(card?.id || '')
    const suffix = id ? ` · ${id}` : ''
    const maxName = Math.max(0, GameHelper.AUTOCOMPLETE_NAME_MAX - suffix.length)
    const name = String(card?.name || '').slice(0, maxName)
    return `${name}${suffix}`
}

function getRecipeCardAutocomplete(searchTerm, cardList) {
    const term = String(searchTerm ?? '').toLowerCase()
    const cards = Array.isArray(cardList) ? cardList : []
    const matches = cards.filter((crd) => {
        if (!term) return true
        const name = String(crd?.name || '').toLowerCase()
        const id = String(crd?.id || '').toLowerCase()
        let shortName = ''
        try {
            shortName = Formatter.cardShortName(crd).toLowerCase()
        } catch {
            shortName = ''
        }
        return name.includes(term) || id.includes(term) || shortName.includes(term)
    })
    matches.sort((a, b) => {
        const nameCmp = String(a?.name || '').localeCompare(String(b?.name || ''))
        if (nameCmp !== 0) return nameCmp
        return String(a?.id || '').localeCompare(String(b?.id || ''))
    })
    return matches.slice(0, 25).map((crd) => ({
        name: GameHelper.autocompleteChoiceName(searchTerm, recipeCardChoiceLabel(crd)),
        value: String(crd.id || '').slice(0, 100),
    }))
}

function formatEditCardContent(actorDisplayName, deckName, card, patch = {}) {
    const cardName = card?.name
    const fields = Object.keys(patch || {})
    const fieldNote = fields.length ? ` (${fields.join(', ')})` : ''
    if (cardName) {
        const withName = `${actorDisplayName} edited "${cardName}" in ${deckName}${fieldNote}`
        if (withName.length <= DISCORD_CONTENT_MAX) {
            return withName
        }
    }
    return clipContent(`${actorDisplayName} edited a card in ${deckName}${fieldNote}`)
}

module.exports = {
    MAX_COPIES,
    DISCORD_CONTENT_MAX,
    INVALID_IMAGE_URL_MESSAGE,
    EDITABLE_FIELDS,
    MISSING_CARD_MESSAGE,
    NO_FIELDS_MESSAGE,
    EMPTY_NAME_MESSAGE,
    INVALID_FORMAT_MESSAGE,
    addCardsToRecipe,
    addRichCards,
    addCardsFromNameList,
    parseNameList,
    isEmbedImageUrl,
    formatAddCardContent,
    formatAddListContent,
    formatEditCardContent,
    buildAddCardEmbeds,
    editReplyAfterSave,
    snapshotEditableFields,
    diffEditableFields,
    findRecipeCard,
    normalizeEditPatch,
    editCardById,
    recipeCardChoiceLabel,
    getRecipeCardAutocomplete,
}
