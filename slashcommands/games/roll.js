const SlashCommand = require('../../base/SlashCommand.js')
const { SlashCommandBuilder } = require('@discordjs/builders');
const fetch = require('node-fetch')
const Roller = require('roll')
const Sample = require('lodash/sample')

class Roll extends SlashCommand {
    constructor(client){
        super(client, {
            name: "roll",
            description: "Roll some dice",
            usage: "role",
            enabled: true,
            permLevel: "User"
          })
		  this.data = new SlashCommandBuilder()
            .setName(this.help.name)
            .setDescription(this.help.description)
            .addStringOption(option => option.setName('dice').setDescription('What dice to roll? e.g. "d20+5" or "4d6"').setRequired(true))
    }

    async execute(interaction) {
        try {

            let roll = new Roller();
            let dice = interaction.options.getString('dice')

            if (roll.validate(dice)){
                let rolling = roll.roll(dice);
                let embedItem =  {
                        "title": rolling.input.toString(),
                        "description": `Total rolled: **${rolling.result}**`,
                        "color": 4130114,
                        "footer": {
                            "text": `Individual rolled dice: ${rolling.rolled}`
                        },
                    }
                let qs = new URLSearchParams()
                qs.set('key', this.client.config.pixabayKey)
                qs.set('q',`number ${rolling.result}`)

                let res = await fetch(`https://pixabay.com/api/?${qs.toString()}`)
                let pictures = await res.json()
                if (pictures.totalHits > 0){
                    var thumb = Sample(pictures.hits)
                    embedItem.thumbnail = {
                        "url": thumb.previewURL
                    }
                }
                await interaction.reply({ embeds: [embedItem] })
            } else {
                await interaction.reply({content: `I don't know how to roll ${interaction.options.getString('dice')}`, ephemeral: true})
            }
        } catch (e) {
            this.client.logger.log(e,'error')
        }
    }
}

module.exports = Roll