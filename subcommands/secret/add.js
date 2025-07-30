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
            secretData = Object.assign(
                {},
                cloneDeep(GameDB.defaultSecretData),
                {isrevealed: false}
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
                    name: interaction.username,
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


        await interaction.reply({ 
            content: `Your secret is safe with me!`,
            embeds: [await Formatter.SecretStatus(secretData, interaction.guild)]
        })
        
    }
}


module.exports = new Add()