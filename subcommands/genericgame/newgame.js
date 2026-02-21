const { MessageFlags } = require("discord.js");
const GameDB = require('../../db/anygame.js')
const GameHelper = require('../../modules/GlobalGameHelper')
const { cloneDeep, shuffle } = require('lodash')
const GameStatusHelper = require('../../modules/GameStatusHelper')

class NewGame {
    async execute(interaction, client) {

        let gameData = await client.getGameDataV2(interaction.guildId, 'game', interaction.channelId);

        if (gameData && !gameData.isdeleted) {
            await interaction.reply({ content: `There is an existing game in this channel. Delete it if you want to start a new one.`, flags: MessageFlags.Ephemeral })
        } else {
            gameData = Object.assign(
                {},
                cloneDeep(GameDB.defaultGameData)
            )    
            let players = []

            if (interaction.options.getUser('player1')) players.push(interaction.options.getUser('player1'))
            if (interaction.options.getUser('player2')) players.push(interaction.options.getUser('player2'))
            if (interaction.options.getUser('player3')) players.push(interaction.options.getUser('player3'))
            if (interaction.options.getUser('player4')) players.push(interaction.options.getUser('player4'))
            if (interaction.options.getUser('player5')) players.push(interaction.options.getUser('player5'))
            if (interaction.options.getUser('player6')) players.push(interaction.options.getUser('player6'))
            if (interaction.options.getUser('player7')) players.push(interaction.options.getUser('player7'))
            if (interaction.options.getUser('player8')) players.push(interaction.options.getUser('player8'))

            let content = `New Game Created.\nPlayer Order Randomized!\n`
            gameData.isdeleted = false
            gameData.name = interaction.channel.name
            players = shuffle(players)
            for (let i = 0; i < players.length; i++) {
                gameData.players.push(
                    Object.assign(
                        {},
                        cloneDeep(GameDB.defaultPlayer), 
                        {
                            guildId: interaction.guild.id,
                            userId: players[i].id,
                            order: i,
                            name: players[i].username
                        }    
                    )
                )
                content += `${players[i]} `
            }

            // Record history for new game creation
            try {
                const actorDisplayName = interaction.member?.displayName || interaction.user.username
                const playerNames = players.map(p => interaction.guild.members.cache.get(p.id)?.displayName || p.username)
                
                GameHelper.recordMove(
                    gameData,
                    interaction.user,
                    GameDB.ACTION_CATEGORIES.GAME,
                    GameDB.ACTION_TYPES.CREATE,
                    `${actorDisplayName} created new game with ${players.length} players`,
                    {
                        gameName: gameData.name,
                        playerCount: players.length,
                        playerList: players.map((p, i) => ({
                            userId: p.id,
                            username: playerNames[i],
                            order: i
                        })),
                        channelId: interaction.channelId,
                        guildId: interaction.guildId,
                        createdBy: actorDisplayName
                    }
                )
            } catch (error) {
                console.warn('Failed to record new game creation in history:', error)
            }

            // The initial message for a new game should not be editable.
            // Therefore, we save the game data first, then send the status.
            // The helper will see no last message and post a new one.
            // Crucially, we don't save the game data *again* after the helper runs.
            await client.setGameDataV2(interaction.guildId, "game", interaction.channelId, gameData)
            
            await GameStatusHelper.sendGameStatus(interaction, client, gameData, {
                content: content
            })
        }
    }
}

module.exports = new NewGame()