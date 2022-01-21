const Command = require('../../base/Command.js')
const fetch = require('node-fetch')
var qs = require( 'querystring' )
const Roller = require('roll')
const Sample = require('lodash/sample')

class GMRoll extends Command {
    constructor(client){
        super(client, {
            name: "gmroll",
            description: "Roll Some Dice",
            category: "Games",
            usage: "use commnad roll followed by dice to roll including modifiers, e.g. '!roll 1d20+5' ",
            enabled: true,
            guildOnly: false,
            allMessages: false,
            showHelp: false,
            aliases: ["gmr", "gmdice"],
            permLevel: "User"
          })
    }

    async run (message, args, level) {
        try {
            const fullArgs = args.join(" ").toLowerCase()
            
            var roll = new Roller();
            if (roll.validate(fullArgs)){
                var rolling = roll.roll(fullArgs);
                var embedItem =  {
                        "title": rolling.input.toString(),
                        "description": `You rolled: **${rolling.result}**`,
                        "color": 4130114,
                        "footer": {
                            "icon_url": message.author.displayAvatarURL,
                            "text": `${message.author.tag} Rolled ${rolling.rolled}`
                        },
                    }
                var query = qs.stringify({key: this.client.config.pixabayKey, q: "number " + rolling.result})
                let res = await fetch ("https://pixabay.com/api/?" + query)
                let pictures = await res.json()
                if (pictures.totalHits > 0){
                    var thumb = Sample(pictures.hits)
                    embedItem.thumbnail = {
                        "url": thumb.previewURL
                    }
                }
                
                await message.author.send({embeds: [embedItem]})
                await message.react('🎲')
            } else {
                message.react('🚫')
                message.react('🎲')
                message.react(message.guild.emojis.get('548934402646999042')).catch(this.client.logger.log("no emoji", 'error'))
            }

        } catch (e) {
            this.client.logger.log(e,'error')
        }
    }
}

module.exports = GMRoll