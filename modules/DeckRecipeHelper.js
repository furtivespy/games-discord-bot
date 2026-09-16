const GameDB = require('../db/anygame.js')
const Formatter = require('./GameFormatter')
const { cloneDeep } = require('lodash')

const MAX_COPIES = 50
const DISCORD_CONTENT_MAX = 2000
const DISCORD_STRING_OPTION_MAX = 4000
const INVALID_IMAGE_URL_MESSAGE = 'Card image URL must be a valid http or https URL.'
const ALLOWED_CSV_COLUMNS = ['name', 'url', 'type', 'suit', 'value', 'description', 'copies', 'format']
const ALLOWED_FORMATS = new Set(['A', 'B', 'C'])
const EMPTY_LIST_MESSAGE = 'No card names found. Use comma-separated names (Ace, King, Queen) or a headered CSV with a name column. Discord limits this option to 4000 characters — split large dumps across several /cards deck addlist calls (each call appends).'
const ADDLIST_OPTION_DESCRIPTION = 'Comma names or headered CSV (name,url,...). Max 4000 chars; split large dumps'
const ADDLIST_COMMAND_DESCRIPTION = 'Bulk-add names or headered CSV to a deck recipe (discard, not draw)'

function fail(error) {
    return { ok: false, error }
}

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

function buildRichCards(deckName, cardFields, copies = 1) {
    const count = Math.max(1, Math.min(MAX_COPIES, Number(copies) || 1))
    const format = cardFields.format || 'A'
    const cards = []
    for (let i = 0; i < count; i++) {
        cards.push(GameDB.createCardFromObj(deckName, format, {
            name: cardFields.name,
            description: cardFields.description || '',
            type: cardFields.type || '',
            suit: cardFields.suit || '',
            value: cardFields.value || '',
            url: cardFields.url || null,
        }))
    }
    return cards
}

function addRichCards(deck, cardFields, copies = 1) {
    return addCardsToRecipe(deck, buildRichCards(deck.name, cardFields, copies))
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

function hasNewline(text) {
    return typeof text === 'string' && /[\r\n]/.test(text)
}

function parseCsvRows(text) {
    const source = String(text || '').replace(/^\uFEFF/, '')
    const rows = []
    let row = []
    let field = ''
    let inQuotes = false
    let i = 0

    const pushField = () => {
        row.push(field)
        field = ''
    }
    const pushRow = () => {
        pushField()
        rows.push(row)
        row = []
    }

    while (i < source.length) {
        const char = source[i]
        if (inQuotes) {
            if (char === '"') {
                if (source[i + 1] === '"') {
                    field += '"'
                    i += 2
                    continue
                }
                inQuotes = false
                i += 1
                continue
            }
            field += char
            i += 1
            continue
        }

        if (char === '"') {
            inQuotes = true
            i += 1
            continue
        }
        if (char === ',') {
            pushField()
            i += 1
            continue
        }
        if (char === '\r' || char === '\n') {
            if (char === '\r' && source[i + 1] === '\n') {
                i += 1
            }
            pushRow()
            i += 1
            continue
        }
        field += char
        i += 1
    }

    if (inQuotes) {
        return fail('CSV has an unclosed quote. No cards were added.')
    }

    if (field.length > 0 || row.length > 0 || source.length === 0) {
        pushRow()
    }

    return { ok: true, rows }
}

function trimCsvRow(row) {
    return row.map(cell => String(cell ?? '').trim())
}

function isBlankCsvRow(row) {
    return trimCsvRow(row).every(cell => cell.length === 0)
}

function firstNonEmptyRowIndex(rows) {
    return rows.findIndex(row => !isBlankCsvRow(row))
}

function headerTokensFromLine(line) {
    return String(line || '')
        .split(',')
        .map(cell => cell.trim().replace(/^"|"$/g, '').toLowerCase())
}

function headersLookLikeCsv(headers) {
    const normalized = headers.map(cell => String(cell || '').trim().toLowerCase()).filter(cell => cell.length > 0)
    if (normalized.length < 1) {
        return false
    }
    if (normalized.includes('name')) {
        return true
    }
    return normalized.every(header => ALLOWED_CSV_COLUMNS.includes(header))
}

function looksLikeHeaderedCsv(customlist) {
    if (!hasNewline(customlist)) {
        return false
    }
    const parsed = parseCsvRows(customlist)
    if (parsed.ok) {
        const headerIndex = firstNonEmptyRowIndex(parsed.rows)
        if (headerIndex < 0) {
            return false
        }
        return headersLookLikeCsv(trimCsvRow(parsed.rows[headerIndex]))
    }
    const firstLine = String(customlist).split(/\r\n|\n|\r/)[0]
    return headersLookLikeCsv(headerTokensFromLine(firstLine))
}

function parseCopiesValue(raw, rowNumber) {
    if (raw == null || String(raw).trim() === '') {
        return { ok: true, copies: 1 }
    }
    const trimmed = String(raw).trim()
    if (!/^\d+$/.test(trimmed)) {
        return fail(`CSV row ${rowNumber} has an invalid copies value "${trimmed}". Use a whole number from 1 to ${MAX_COPIES}. No cards were added.`)
    }
    const copies = Number(trimmed)
    if (copies < 1 || copies > MAX_COPIES) {
        return fail(`CSV row ${rowNumber} has copies=${copies}; use a whole number from 1 to ${MAX_COPIES}. No cards were added.`)
    }
    return { ok: true, copies }
}

function parseFormatValue(raw, rowNumber) {
    if (raw == null || String(raw).trim() === '') {
        return { ok: true, format: 'A' }
    }
    const format = String(raw).trim().toUpperCase()
    if (!ALLOWED_FORMATS.has(format)) {
        return fail(`CSV row ${rowNumber} has an invalid format "${String(raw).trim()}". Use A, B, or C. No cards were added.`)
    }
    return { ok: true, format }
}

function parseHeaderedCardCsv(customlist) {
    const parsed = parseCsvRows(customlist)
    if (!parsed.ok) {
        return parsed
    }

    const headerIndex = firstNonEmptyRowIndex(parsed.rows)
    if (headerIndex < 0) {
        return fail(EMPTY_LIST_MESSAGE)
    }

    const rawHeaders = trimCsvRow(parsed.rows[headerIndex])
    const headers = rawHeaders.map(cell => cell.toLowerCase())
    if (headers.some(header => header.length === 0)) {
        return fail('CSV has an empty column header. No cards were added.')
    }

    const seen = new Set()
    for (const header of headers) {
        if (seen.has(header)) {
            return fail(`CSV has a duplicate column "${header}". No cards were added.`)
        }
        seen.add(header)
    }

    const unknown = headers.filter(header => !ALLOWED_CSV_COLUMNS.includes(header))
    if (unknown.length > 0) {
        return fail(`CSV has unknown column(s): ${unknown.join(', ')}. Allowed columns: ${ALLOWED_CSV_COLUMNS.join(', ')}. No cards were added.`)
    }

    if (!headers.includes('name')) {
        return fail("CSV is missing a required 'name' column. No cards were added.")
    }

    const rows = []
    for (let i = headerIndex + 1; i < parsed.rows.length; i++) {
        const rawRow = parsed.rows[i]
        const rowNumber = i + 1
        if (isBlankCsvRow(rawRow)) {
            continue
        }
        if (rawRow.length > headers.length) {
            return fail(`CSV row ${rowNumber} has extra values beyond the header columns. No cards were added.`)
        }

        const cells = trimCsvRow(rawRow)
        const record = {}
        for (let column = 0; column < headers.length; column++) {
            record[headers[column]] = cells[column] || ''
        }

        const name = record.name
        if (!name) {
            return fail(`CSV row ${rowNumber} is missing a card name. No cards were added.`)
        }

        const copiesResult = parseCopiesValue(record.copies, rowNumber)
        if (!copiesResult.ok) {
            return copiesResult
        }
        const formatResult = parseFormatValue(record.format, rowNumber)
        if (!formatResult.ok) {
            return formatResult
        }

        const url = record.url || ''
        if (url && !isEmbedImageUrl(url)) {
            return fail(`CSV row ${rowNumber}: ${INVALID_IMAGE_URL_MESSAGE} No cards were added.`)
        }

        rows.push({
            copies: copiesResult.copies,
            fields: {
                name,
                url: url || null,
                type: record.type || '',
                suit: record.suit || '',
                value: record.value || '',
                description: record.description || '',
                format: formatResult.format,
            },
        })
    }

    if (rows.length < 1) {
        return fail(EMPTY_LIST_MESSAGE)
    }

    return { ok: true, mode: 'csv', rows }
}

function parseCustomList(customlist) {
    if (looksLikeHeaderedCsv(customlist)) {
        return parseHeaderedCardCsv(customlist)
    }
    const names = parseNameList(customlist)
    if (names.length < 1) {
        return fail(EMPTY_LIST_MESSAGE)
    }
    return { ok: true, mode: 'names', names }
}

function addCardsFromNameList(deck, customlist) {
    const names = parseNameList(customlist)
    const cards = GameDB.createCardFromStrList(deck.name, names)
    return addCardsToRecipe(deck, cards)
}

function addCardsFromCustomList(deck, customlist) {
    const parsed = parseCustomList(customlist)
    if (!parsed.ok) {
        return parsed
    }

    const cards = []
    if (parsed.mode === 'csv') {
        for (const row of parsed.rows) {
            cards.push(...buildRichCards(deck.name, row.fields, row.copies))
        }
    } else {
        cards.push(...GameDB.createCardFromStrList(deck.name, parsed.names))
    }

    const added = addCardsToRecipe(deck, cards)
    return {
        ok: true,
        mode: parsed.mode,
        added,
        names: added.map(card => card.name),
    }
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
    DISCORD_STRING_OPTION_MAX,
    INVALID_IMAGE_URL_MESSAGE,
    ALLOWED_CSV_COLUMNS,
    EMPTY_LIST_MESSAGE,
    ADDLIST_OPTION_DESCRIPTION,
    ADDLIST_COMMAND_DESCRIPTION,
    addCardsToRecipe,
    addRichCards,
    addCardsFromNameList,
    addCardsFromCustomList,
    parseNameList,
    parseCustomList,
    looksLikeHeaderedCsv,
    isEmbedImageUrl,
    formatAddCardContent,
    formatAddListContent,
    buildAddCardEmbeds,
    editReplyAfterSave,
}
