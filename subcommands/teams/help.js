const { EmbedBuilder } = require('discord.js')

class Help {
    async execute(interaction, client) {
        const helpEmbed = new EmbedBuilder()
            .setColor(0x0099ff)
            .setTitle('Team Commands Help')
            .setDescription('Commands for managing teams in your game')
            .addFields(
                {
                    name: '/team roster',
                    value: 'Opens a modal to set up team names (up to 5 teams). Leave a field blank to keep the existing team name unchanged.',
                    inline: false
                },
                {
                    name: '/team jointeam [team] [player]',
                    value: 'Assigns a player to a team. If no player is specified, assigns you to the team. A player can only be on one team at a time.',
                    inline: false
                },
                {
                    name: '/team color [team] [color]',
                    value: 'Sets the color for a team. Color can be a hex code (e.g., #FF0000) or a color name (e.g., red).',
                    inline: false
                },
                {
                    name: '/team randomize',
                    value: 'Randomly distributes all players across existing teams, creating balanced team sizes.',
                    inline: false
                },
                {
                    name: '/team help',
                    value: 'Shows this help message.',
                    inline: false
                }
            )
            .setFooter({ text: 'Teams appear in the game status table when configured' })

        await interaction.reply({
            embeds: [helpEmbed],
            ephemeral: true
        })
    }
}

module.exports = new Help()

