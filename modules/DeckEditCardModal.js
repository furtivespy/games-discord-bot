const {
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    MessageFlags,
} = require('discord.js')
const { nanoid } = require('nanoid')
const GameHelper = require('./GlobalGameHelper')
const GameDB = require('../db/anygame.js')
const Formatter = require('./GameFormatter')
const DeckRecipeHelper = require('./DeckRecipeHelper')

const STEP1_MODAL_ID = 'editcard-step1'
const STEP2_MODAL_ID = 'editcard-step2'
const NEXT_BUTTON_ID = 'editcard-next'
const NEXT_BUTTON_PREFIX = `${NEXT_BUTTON_ID}:`
const SESSION_TTL_MS = 10 * 60 * 1000
const SESSION_EXPIRED_MESSAGE = 'This card edit expired. Run /cards deck editcard again.'
const FIELD_MAX = {
    name: 100,
    url: 2048,
    type: 100,
    suit: 100,
    value: 100,
    description: 1000,
}

const STEP1_FIELDS = ['name', 'url', 'type', 'suit']
const STEP2_FIELDS = ['value', 'description', 'format']

const pendingEdits = new Map()

function sessionKey(interaction) {
    return `${interaction.guildId}:${interaction.channelId}:${interaction.user.id}`
}

function pruneExpired(now = Date.now()) {
    for (const [key, session] of pendingEdits) {
        if (!session?.createdAt || now - session.createdAt > SESSION_TTL_MS) {
            pendingEdits.delete(key)
        }
    }
}

function getSession(interaction) {
    pruneExpired()
    return pendingEdits.get(sessionKey(interaction)) || null
}

function setSession(interaction, data) {
    pendingEdits.set(sessionKey(interaction), data)
}

function clearSession(interaction) {
    pendingEdits.delete(sessionKey(interaction))
}

function resetPendingEdits() {
    pendingEdits.clear()
}

function clip(value, max) {
    const text = String(value ?? '')
    if (!text) return ''
    return text.length <= max ? text : text.slice(0, max)
}

function formatLetter(format) {
    const letter = String(format ?? 'A').trim().toUpperCase()
    return ['A', 'B', 'C'].includes(letter) ? letter : 'A'
}

function displayedEditableFields(card) {
    const snap = DeckRecipeHelper.snapshotEditableFields(card)
    return {
        name: clip(snap.name, FIELD_MAX.name),
        url: clip(snap.url, FIELD_MAX.url),
        type: clip(snap.type, FIELD_MAX.type),
        suit: clip(snap.suit, FIELD_MAX.suit),
        value: clip(snap.value, FIELD_MAX.value),
        description: clip(snap.description, FIELD_MAX.description),
        format: formatLetter(snap.format),
    }
}

async function replyExpired(interaction) {
    await interaction.reply({
        content: SESSION_EXPIRED_MESSAGE,
        flags: MessageFlags.Ephemeral,
    })
}

function parseNextSessionId(customId) {
    if (typeof customId !== 'string' || !customId.startsWith(NEXT_BUTTON_PREFIX)) {
        return null
    }
    return customId.slice(NEXT_BUTTON_PREFIX.length) || null
}

function addPrefill(input, value) {
    const text = String(value ?? '')
    if (!text) return input
    const max = input.data.max_length || 4000
    input.setValue(clip(text, max))
    return input
}

function buildTextInput({ id, label, style, required, maxLength, value, placeholder }) {
    const input = new TextInputBuilder()
        .setCustomId(id)
        .setLabel(label)
        .setStyle(style)
        .setRequired(Boolean(required))
        .setMaxLength(maxLength)
    if (placeholder) {
        input.setPlaceholder(placeholder)
    }
    addPrefill(input, value)
    return new ActionRowBuilder().addComponents(input)
}

function modalTitle(card, step) {
    const name = String(card?.name || 'card').replace(/\s+/g, ' ').trim() || 'card'
    return `Edit ${name} (${step}/2)`.slice(0, 45)
}

function withSubmitLabel(modal, label) {
    // discord.js 14.23 has no setter; Discord accepts submit_label on the payload.
    modal.data.submit_label = String(label).slice(0, 32)
    return modal
}

function formatValue(card) {
    return formatLetter(card?.format)
}

function buildStep1Modal(card) {
    const modal = new ModalBuilder()
        .setCustomId(STEP1_MODAL_ID)
        .setTitle(modalTitle(card, 1))
    withSubmitLabel(modal, 'Next')
    modal.addComponents(
        buildTextInput({
            id: 'name',
            label: 'Name',
            style: TextInputStyle.Short,
            required: true,
            maxLength: FIELD_MAX.name,
            value: card?.name,
        }),
        buildTextInput({
            id: 'url',
            label: 'Image URL',
            style: TextInputStyle.Paragraph,
            required: false,
            maxLength: FIELD_MAX.url,
            value: card?.url,
        }),
        buildTextInput({
            id: 'type',
            label: 'Type (formats A and B)',
            style: TextInputStyle.Short,
            required: false,
            maxLength: FIELD_MAX.type,
            value: card?.type,
        }),
        buildTextInput({
            id: 'suit',
            label: 'Suit (sort only, not shown)',
            style: TextInputStyle.Short,
            required: false,
            maxLength: FIELD_MAX.suit,
            value: card?.suit,
        }),
    )
    return modal
}

function buildStep2Modal(card) {
    const modal = new ModalBuilder()
        .setCustomId(STEP2_MODAL_ID)
        .setTitle(modalTitle(card, 2))
    withSubmitLabel(modal, 'Save')
    modal.addComponents(
        buildTextInput({
            id: 'value',
            label: 'Value (sort; shown in format C)',
            style: TextInputStyle.Short,
            required: false,
            maxLength: FIELD_MAX.value,
            value: card?.value,
        }),
        buildTextInput({
            id: 'description',
            label: 'Description',
            style: TextInputStyle.Paragraph,
            required: false,
            maxLength: FIELD_MAX.description,
            value: card?.description,
        }),
        buildTextInput({
            id: 'format',
            label: 'Format (A, B, or C)',
            style: TextInputStyle.Short,
            required: true,
            maxLength: 1,
            value: formatValue(card),
            placeholder: 'A, B, or C',
        }),
    )
    return modal
}

function collectModalFields(interaction, fieldNames) {
    const raw = {}
    for (const field of fieldNames) {
        raw[field] = interaction.fields.getTextInputValue(field)
    }
    return raw
}

function changedFieldsNote(original, submitted) {
    const diff = DeckRecipeHelper.diffEditableFields(original, submitted)
    const fields = Object.keys(diff)
    if (!fields.length) {
        return 'No changes yet on this page.'
    }
    return `Changed so far: ${fields.join(', ')}.`
}

async function openEditor(interaction, { deck, card }) {
    setSession(interaction, {
        id: nanoid(),
        deckName: deck.name,
        cardId: String(card.id),
        original: displayedEditableFields(card),
        step1: null,
        createdAt: Date.now(),
    })
    await interaction.showModal(buildStep1Modal(displayedEditableFields(card)))
}

async function persistCardEdit(interaction, client, gameData, deck, result, patch) {
    try {
        const actorDisplayName = interaction.member?.displayName || interaction.user.username
        const cardName = Formatter.cardShortName(result.card)
        GameHelper.recordMove(
            gameData,
            interaction.user,
            GameDB.ACTION_CATEGORIES.CARD,
            GameDB.ACTION_TYPES.MODIFY,
            `${actorDisplayName} edited ${cardName} in ${deck.name}`,
            {
                deckName: deck.name,
                cardId: result.card.id,
                cardName,
                changes: patch,
                action: 'edit card in in-game deck recipe',
            }
        )
    } catch (error) {
        console.warn('Failed to record deck editcard in history:', error)
    }

    await client.setGameDataV2(interaction.guildId, 'game', interaction.channelId, gameData)

    const actorDisplayName = interaction.member?.displayName || interaction.user.username
    await DeckRecipeHelper.editReplyAfterSave(interaction, {
        content: DeckRecipeHelper.formatEditCardContent(
            actorDisplayName,
            deck.name,
            result.card,
            patch
        ),
        embeds: DeckRecipeHelper.buildAddCardEmbeds(gameData, result.card),
    })
}

async function handleStep1Submit(interaction) {
    const session = getSession(interaction)
    if (!session) {
        await replyExpired(interaction)
        return
    }

    session.step1 = collectModalFields(interaction, STEP1_FIELDS)
    session.createdAt = Date.now()
    setSession(interaction, session)

    const next = new ButtonBuilder()
        .setCustomId(`${NEXT_BUTTON_PREFIX}${session.id}`)
        .setLabel('Next')
        .setStyle(ButtonStyle.Primary)

    await interaction.reply({
        content: [
            `Continue editing **${session.original.name || 'card'}** in **${session.deckName}**.`,
            changedFieldsNote(session.original, session.step1),
            'Next opens value, description, and format. Save on that pop-up writes the card.',
        ].join('\n'),
        components: [new ActionRowBuilder().addComponents(next)],
        flags: MessageFlags.Ephemeral,
    })
}

async function handleStep2Submit(interaction, client) {
    const session = getSession(interaction)
    if (!session || !session.step1) {
        await replyExpired(interaction)
        return
    }

    const submitted = {
        ...(session.step1 || {}),
        ...collectModalFields(interaction, STEP2_FIELDS),
    }
    const rawPatch = DeckRecipeHelper.diffEditableFields(session.original, submitted)

    const [, gameData] = await Promise.all([
        interaction.deferReply(),
        GameHelper.getGameData(client, interaction),
    ])

    if (gameData.isdeleted) {
        clearSession(interaction)
        await interaction.editReply({ content: `There is no game in this channel.` })
        return
    }

    const deck = GameHelper.getSpecificDeck(gameData, session.deckName, interaction.user.id)
    if (!deck) {
        clearSession(interaction)
        await interaction.editReply({ content: `No Deck Found` })
        return
    }

    const normalized = DeckRecipeHelper.normalizeEditPatch(rawPatch)
    if (normalized.error) {
        clearSession(interaction)
        await interaction.editReply({ content: normalized.error })
        return
    }

    const result = DeckRecipeHelper.editCardById(gameData, deck, session.cardId, normalized.patch)
    clearSession(interaction)
    if (!result.ok) {
        await interaction.editReply({ content: result.error })
        return
    }

    await persistCardEdit(interaction, client, gameData, deck, result, normalized.patch)
}

async function handleModalSubmit(interaction, client) {
    if (interaction.customId === STEP1_MODAL_ID) {
        await handleStep1Submit(interaction)
        return true
    }
    if (interaction.customId === STEP2_MODAL_ID) {
        await handleStep2Submit(interaction, client)
        return true
    }
    return false
}

async function handleButton(interaction, client) {
    const sessionId = parseNextSessionId(interaction.customId)
    if (sessionId == null) {
        return false
    }

    const session = getSession(interaction)
    if (!session || session.id !== sessionId || !session.step1) {
        await replyExpired(interaction)
        return true
    }

    const gameData = await GameHelper.getGameData(client, interaction)
    if (gameData.isdeleted) {
        clearSession(interaction)
        await interaction.reply({
            content: `There is no game in this channel.`,
            flags: MessageFlags.Ephemeral,
        })
        return true
    }

    const deck = GameHelper.getSpecificDeck(gameData, session.deckName, interaction.user.id)
    const card = DeckRecipeHelper.findRecipeCard(deck, session.cardId)
    if (!card) {
        clearSession(interaction)
        await interaction.reply({
            content: DeckRecipeHelper.MISSING_CARD_MESSAGE,
            flags: MessageFlags.Ephemeral,
        })
        return true
    }

    session.createdAt = Date.now()
    setSession(interaction, session)
    await interaction.showModal(buildStep2Modal({
        name: card.name,
        ...session.original,
    }))
    return true
}

module.exports = {
    STEP1_MODAL_ID,
    STEP2_MODAL_ID,
    NEXT_BUTTON_ID,
    SESSION_EXPIRED_MESSAGE,
    STEP1_FIELDS,
    STEP2_FIELDS,
    openEditor,
    handleModalSubmit,
    handleButton,
    buildStep1Modal,
    buildStep2Modal,
    resetPendingEdits,
    getSession,
}
