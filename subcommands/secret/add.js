const GameDB = require('../../db/anygame.js')
const GameHelper = require('../../modules/GlobalGameHelper')
const { cloneDeep, find } = require('lodash')
const Formatter = require('../../modules/GameFormatter')

class Add {
    async execute(interaction, client) {

        let secretData = Object.assign(
            {},
            cloneDeep(GameDB.defaultSecretData), 
            await client.getGameDataV2(interaction.guildId, 'secret', interaction.channelId)
        )

        if (secretData.isrevealed) { //All New Secrets
            const preservedMode = secretData.mode || 'normal'
            secretData = Object.assign(
                {},
                cloneDeep(GameDB.defaultSecretData),
                {isrevealed: false, mode: preservedMode}
            )

            let gameData = Object.assign(
                {},
                cloneDeep(GameDB.defaultGameData), 
                await client.getGameDataV2(interaction.guildId, 'game', interaction.channelId)
            )

            if (gameData.players.length > 0 && !gameData.isdeleted) {
                for (let i = 0; i < gameData.players.length; i++) {
                    secretData.players.push(Object.assign(
                        {},
                        cloneDeep(gameData.players[i]),
                        {hassecret: false, secret: "--", hands: []}
                    ))
                }
            }
        }

        let mySecret = find(secretData.players, {'userId': interaction.user.id})

        if (!mySecret) {
            secretData.players.push(Object.assign(
                {},
                cloneDeep(GameDB.defaultPlayer),
                {
                    guildId: interaction.guild.id,
                    userId: interaction.user.id,
                    name: interaction.user.username,
                    hassecret: false,
                    secret: "--"
                } 
            ))

            mySecret = find(secretData.players, {'userId': interaction.user.id})
        }

        const isNewSecret = !mySecret.hassecret
        mySecret.hassecret = true
        mySecret.secret = interaction.options.getString('secret')
        
        // Record history in main game (privacy protected - no secret content)
        try {
            const mainGameData = await GameHelper.getGameData(client, interaction)
            if (!mainGameData.isdeleted) {
                const actorDisplayName = interaction.member?.displayName || interaction.user.username
                const actionType = isNewSecret ? GameDB.ACTION_TYPES.ADD : GameDB.ACTION_TYPES.MODIFY
                const actionText = isNewSecret ? 'added' : 'updated'
                
                GameHelper.recordMove(
                    mainGameData,
                    interaction.user,
                    GameDB.ACTION_CATEGORIES.SECRET,
                    actionType,
                    `${actorDisplayName} ${actionText} their secret`,
                    {
                        playerUserId: interaction.user.id,
                        playerUsername: actorDisplayName,
                        wasNewSecret: isNewSecret,
                        action: `secret ${actionText}`
                    }
                )
                
                await client.setGameDataV2(interaction.guildId, "game", interaction.channelId, mainGameData)
            }
        } catch (error) {
            console.warn('Failed to record secret addition in main game history:', error)
        }
        
        //client.setGameData(`secret-${interaction.channel.id}`, secretData)
        await client.setGameDataV2(interaction.guildId, "secret", interaction.channelId, secretData)

        const isSuperSecret = secretData.mode === 'super-secret'

        // Get game data for team grouping and player count
        let gameData = null
        try {
            gameData = await GameHelper.getGameData(client, interaction)
        } catch (error) {
            // Game data might not exist, that's okay
        }

        if (isSuperSecret) {
            // In super-secret mode, show only count and make it ephemeral
            const secretCount = secretData.players.filter(p => p.hassecret).length
            // Get total players from game data if secret players list is empty
            const totalPlayers = secretData.players.length > 0 
                ? secretData.players.length 
                : (gameData && gameData.players ? gameData.players.length : 0)
            
            await interaction.reply({ 
                content: `🤐 Your secret is safe with me!\n${secretCount} of ${totalPlayers} players have entered secrets`,
                ephemeral: true
            })
        } else {
            // In normal mode, show full status
            await interaction.reply({ 
                content: `Your secret is safe with me!`,
                embeds: [await Formatter.SecretStatus(secretData, interaction.guild, gameData)]
            })
        }
        
    }
}


module.exports = new Add()