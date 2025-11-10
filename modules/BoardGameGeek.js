const { EmbedBuilder, AttachmentBuilder } = require("discord.js");
const fetch = require("node-fetch");
const { parse } = require("fast-xml-parser");
const { find, cloneDeep, take } = require("lodash");
const { createCanvas, Image, loadImage } = require("canvas");
const he = require("he");
const TurndownService = require("turndown");
const Formatter = require('./GameFormatter')
const GameDB = require('../db/anygame.js')
const { XMLParser } = require("fast-xml-parser");

class BoardGameGeek {
  constructor(gameId, discordClient, interaction) {
    this.gameId = gameId;
    this.discordClient = discordClient;
    this.interaction = interaction;
    this.embeds = [];
    this.attachments = [];
    this.otherAttachments = [];
  }

  /**
   * Calculate total character count of an embed
   * Discord's limit is 6000 characters total per embed
   */
  static calculateEmbedSize(embed) {
    let total = 0;
    const data = embed.data;
    
    if (data.title) total += data.title.length;
    if (data.description) total += data.description.length;
    if (data.footer?.text) total += data.footer.text.length;
    if (data.author?.name) total += data.author.name.length;
    
    if (data.fields) {
      data.fields.forEach(field => {
        if (field.name) total += field.name.length;
        if (field.value) total += field.value.length;
      });
    }
    
    return total;
  }

  /**
   * Trim embed content to stay under Discord's 6000 character limit
   */
  static trimEmbedToLimit(embed, maxSize = 6000) {
    let currentSize = this.calculateEmbedSize(embed);
    
    if (currentSize <= maxSize) {
      return embed;
    }

    const data = embed.data;
    const trimMarker = '\n\n...(trimmed for length)';
    
    // Strategy: trim description first, then field values
    if (data.description && data.description.length > 500) {
      const overhead = currentSize - maxSize;
      const targetDescLength = Math.max(500, data.description.length - overhead - trimMarker.length);
      data.description = data.description.substring(0, targetDescLength) + trimMarker;
      currentSize = this.calculateEmbedSize(embed);
    }
    
    // If still too large, trim field values
    if (currentSize > maxSize && data.fields) {
      for (let field of data.fields) {
        if (currentSize <= maxSize) break;
        
        if (field.value && field.value.length > 200) {
          const overhead = currentSize - maxSize;
          const targetLength = Math.max(200, field.value.length - overhead - trimMarker.length);
          const originalLength = field.value.length;
          field.value = field.value.substring(0, targetLength) + trimMarker;
          currentSize -= (originalLength - field.value.length);
        }
      }
    }
    
    return embed;
  }

  /**
   * Trim all embeds to ensure total size stays under Discord's 6000 character limit
   * This checks the combined total of all embeds in the message
   */
  trimAllEmbedsToLimit(maxTotalSize = 6000) {
    let totalSize = 0;
    this.embeds.forEach(embed => {
      totalSize += BoardGameGeek.calculateEmbedSize(embed);
    });

    if (totalSize <= maxTotalSize) {
      return; // Already under limit
    }

    const trimMarker = '\n\n...(trimmed for length)';
    const overhead = totalSize - maxTotalSize;
    
    // Priority order for trimming (trim less important content first):
    // 1. Awards/Honors - can be very long
    // 2. Description - can be very long
    // 3. History - local data
    // 4. Details - important stats
    // 5. Useful Links - keep intact if possible
    // 6. Image embed - keep intact (usually just title + URL)
    
    const trimOrder = [
      { title: 'Awards and Honors', minLength: 300 },
      { title: 'Description', minLength: 800 },
      { title: `${this.gameName} in ${this.interaction?.guild?.name}`, minLength: 200 },
      { title: 'Details', minLength: 400 },
      { title: 'Useful Links', minLength: 200 }
    ];

    let remainingOverhead = overhead;

    for (const trimTarget of trimOrder) {
      if (remainingOverhead <= 0) break;

      const embed = this.embeds.find(e => e.data.title === trimTarget.title);
      if (!embed) continue;

      const embedData = embed.data;
      
      // Trim description if present
      if (embedData.description && embedData.description.length > trimTarget.minLength) {
        const currentLength = embedData.description.length;
        const maxTrim = currentLength - trimTarget.minLength;
        const trimAmount = Math.min(maxTrim, remainingOverhead);
        
        if (trimAmount > trimMarker.length) {
          const newLength = currentLength - trimAmount;
          embedData.description = embedData.description.substring(0, newLength - trimMarker.length) + trimMarker;
          remainingOverhead -= trimAmount;
        }
      }
      
      // Trim field values if still over limit
      if (remainingOverhead > 0 && embedData.fields) {
        for (let field of embedData.fields) {
          if (remainingOverhead <= 0) break;
          
          if (field.value && field.value.length > 200) {
            const currentLength = field.value.length;
            const maxTrim = currentLength - 200;
            const trimAmount = Math.min(maxTrim, remainingOverhead);
            
            if (trimAmount > trimMarker.length) {
              const newLength = currentLength - trimAmount;
              field.value = field.value.substring(0, newLength - trimMarker.length) + trimMarker;
              remainingOverhead -= trimAmount;
            }
          }
        }
      }
    }
  }

  static async CreateAndLoad(gameId, discordClient, interaction) {
    let bgg = new BoardGameGeek(gameId, discordClient, interaction);
    await bgg.LoadBggData();
    return bgg;
  }

  static DetailsEnum = {
    ALL: 'all',
    BASIC: 'basic',
    HISTORY: 'history',
    AWARDS: 'awards',
    ALLPLUS: 'allplus',
    LINKS: 'links',
    ALLEPHEMERAL: 'allephemeral',
    LINKSEPHMERAL: 'linksephemeral',
  }

  static isEphemeral(detailsType) {
    if (detailsType == BoardGameGeek.DetailsEnum.ALLEPHEMERAL ||
        detailsType == BoardGameGeek.DetailsEnum.LINKSEPHMERAL) 
    {
      return true
    }
    return false
  }

  async LoadBggData() {
    let gameInfoResp = await fetch(
      `https://api.geekdo.com/xmlapi/boardgame/${this.gameId}?stats=1`,
      {
        headers: {
          'Authorization': `Bearer ${this.discordClient.config.BGGToken}`
        }
      }
    );
    const text = await gameInfoResp.text();
    const parser = new XMLParser({
      attributeNamePrefix: "",
      textNodeName: "text",
      ignoreAttributes: false,
      ignoreNameSpace: true,
      allowBooleanAttributes: true,
    });
    this.gameInfo = parser.parse(text).boardgames.boardgame;

    const gameName = Array.isArray(this.gameInfo.name)
      ? find(this.gameInfo.name, { primary: "true" }).text
      : this.gameInfo.name.text;

    this.gameName = he.decode(gameName);
  }

  async LoadEmbeds(detailsType) {
    switch (detailsType) {
      case BoardGameGeek.DetailsEnum.BASIC:
        await this.GetGameImageEmbed()
        this.GetGameDescriptionEmbed()
        break;
      case BoardGameGeek.DetailsEnum.HISTORY:
        await this.GetGameImageEmbed()
        await this.GetHistoryEmbed()
        break;
      case BoardGameGeek.DetailsEnum.AWARDS:
        await this.GetGameImageEmbed()
        this.GetGameAwardsEmbed()
        break;
      case BoardGameGeek.DetailsEnum.LINKS:
      case BoardGameGeek.DetailsEnum.LINKSEPHMERAL:
        await this.GetGameImageEmbed()
        await this.GetUsefulLinksEmbed()
        break;
      case BoardGameGeek.DetailsEnum.ALLPLUS:
      case BoardGameGeek.DetailsEnum.ALLEPHEMERAL:
        await this.GetGameImageEmbed()
        this.GetGameDetailsEmbed()
        this.GetGameDescriptionEmbed()
        this.GetGameAwardsEmbed()
        await this.GetHistoryEmbed()
        await this.GetUsefulLinksEmbed()
        break;
      case BoardGameGeek.DetailsEnum.ALL:
      default:
        await this.GetGameImageEmbed()
        this.GetGameDetailsEmbed()
        this.GetGameDescriptionEmbed()
        this.GetGameAwardsEmbed()
        await this.GetHistoryEmbed()
        break;
    }
    
    // Ensure total size of all embeds doesn't exceed Discord's 6000 character limit
    this.trimAllEmbedsToLimit();
  }

  async GetGameImageEmbed() {
    if (!this.gameInfo.image) {
        // If no image is available, create a basic embed without an image
        const imageEmbed = new EmbedBuilder()
            .setTitle(this.gameName)
            .setURL(`https://boardgamegeek.com/boardgame/${this.gameId}`);
        this.embeds.push(imageEmbed);
        return;
    }

    const gameImage = await loadImage(this.gameInfo.image);
    const scaledWidth = 600;
    const canvas = createCanvas(scaledWidth, (scaledWidth / gameImage.width) * gameImage.height);
    const ctx = canvas.getContext("2d");
    ctx.drawImage(gameImage, 0, 0, scaledWidth, (scaledWidth / gameImage.width) * gameImage.height);
    
    const imageAttach = new AttachmentBuilder(
        canvas.toBuffer(),
        {name: `gameImage.png`}
    );
    this.attachments.push(imageAttach);

    const imageEmbed = new EmbedBuilder()
        .setTitle(this.gameName)
        .setURL(`https://boardgamegeek.com/boardgame/${this.gameId}`)
        .setImage(`attachment://gameImage.png`);
    this.embeds.push(imageEmbed);

    // Explicitly free resources
    canvas.width = 1;
    canvas.height = 1;
    ctx.clearRect(0, 0, 1, 1);
  }

  GetGameDetailsEmbed() {
    //Embed 2 - Stats and Details
    let ranks = ""
    if (Array.isArray(this.gameInfo.statistics.ratings.ranks.rank)) {
      this.gameInfo.statistics.ratings.ranks.rank.forEach(r => {ranks += `\n**${he.decode(r.friendlyname)}:** ${r.value}`})
    } else {
      ranks += `\n**${he.decode(this.gameInfo.statistics.ratings.ranks.rank.friendlyname)}:** ${this.gameInfo.statistics.ratings.ranks.rank.value}`
    }
    let suggestedPlayers = ""
    const suggestedPlayerPoll = find(this.gameInfo.poll, {name: "suggested_numplayers"})
    suggestedPlayerPoll.results.forEach(r => {
      r.result.sort((a, b) => b.numvotes - a.numvotes)
      suggestedPlayers += `\n**${r.numplayers}**: ${r.result[0].value}`
    })
    
    const detailEmbed = new EmbedBuilder().setTitle(`Details`).addFields(
      {
        name: "Game Data",
        value: `**Published:** ${this.gameInfo.yearpublished}\n**Players:** ${this.gameInfo.minplayers} - ${this.gameInfo.maxplayers}\n**Playing Time:** ${this.gameInfo.minplaytime} - ${this.gameInfo.maxplaytime}\n**Age:** ${this.gameInfo.age}+`,
        inline: true,
      },
      {
        name: `Ranks & Ratings`,
        value: `**Average Rating:** ${this.gameInfo.statistics.ratings.average}\n**Weight:** ${this.gameInfo.statistics.ratings.averageweight}${ranks}`,
        inline: true,
      },
      {
        name: `Suggested Player Count`,
        value: `${suggestedPlayers}`,
        inline: true,
      },
      {
        name: `Designer(s)`,
        value: this.gameInfo.boardgamedesigner ? Array.isArray(this.gameInfo.boardgamedesigner) ? this.gameInfo.boardgamedesigner.map(d => d.text).join("\n") : this.gameInfo.boardgamedesigner.text : "N/A",
        inline: true
      },
      {
        name: `Publisher(s)`,
        value: Array.isArray(this.gameInfo.boardgamepublisher) ? this.gameInfo.boardgamepublisher.map(d => d.text).join("\n") : this.gameInfo.boardgamepublisher.text,
        inline: true
      }
    );
    if (this.gameInfo.boardgamemechanic) {
      detailEmbed.addFields(
        {
          name: `Mechanics`,
          value: Array.isArray(this.gameInfo.boardgamemechanic) ? this.gameInfo.boardgamemechanic.map(d => d.text).join("\n") : this.gameInfo.boardgamemechanic.text,
          inline: true
        }
      );
    }
    if (this.gameInfo.boardgameexpansion) {
      detailEmbed.addFields(
        {
          name: `Expansions`,
          value: Array.isArray(this.gameInfo.boardgameexpansion) ? take(this.gameInfo.boardgameexpansion,10).map(d => `[${d.text}](https://boardgamegeek.com/boardgame/${d.objectid})`).join("\n") : `[${this.gameInfo.boardgameexpansion.text}](https://boardgamegeek.com/boardgame/${this.gameInfo.boardgameexpansion.objectid})`,
          inline: true
        }
      )
    }
    this.embeds.push(detailEmbed);
  }

  GetGameDescriptionEmbed() {
    //Embed 3 - Description
    const turndownService = new TurndownService();
    const descriptionEmbed = new EmbedBuilder()
      .setTitle("Description")
      .setDescription(
        turndownService.turndown(he.decode(this.gameInfo.description))
      );
    this.embeds.push(descriptionEmbed);
  }

  GetGameAwardsEmbed() {
    //Embed 4 - awards and honors
    if (this.gameInfo.boardgamehonor && Array.isArray(this.gameInfo.boardgamehonor)) {
      let honors = "";
      this.gameInfo.boardgamehonor.forEach((honor) => {
        honors += `${he.decode(honor.text)}\n`;
      });
      const awardEmbed = new EmbedBuilder()
        .setTitle(`Awards and Honors`)
        .setDescription(honors);
      this.embeds.push(awardEmbed);
    }
  }

  async GetHistoryEmbed() {
    //Embed 5 - Local Data
    const local = await this.discordClient.queryGameData(this.interaction.guildId, 'game', {bggGameId: this.gameId})
    if (local && local.length > 0) {
      let history = ""
      local.forEach(game => {
        if (game.isdeleted) return
        if (game.winner != null && game.winner != ""){
          history += `**<#${game.id}>** - 👑 ${Formatter.winnerName(game, this.interaction.guild)}\n`
        } else {
          history += `**<#${game.id}>** - In Progress\n`  
        }
      });

      if (history.length > 0) {
        const localEmbed = new EmbedBuilder()
          .setTitle(`${this.gameName} in ${this.interaction.guild.name}`)
          .setDescription(history)
        
        this.embeds.push(localEmbed)
      }
    }
  }

  async LoadUsefulLinks() {
    const linkData = Object.assign(
      {},
      cloneDeep(GameDB.defaultBGGGameData),
      await this.discordClient.getGameDataV2(this.interaction.guildId, 'bgg', this.gameId)
    );

    return linkData
  }

  async GetUsefulLinksEmbed() {
    const linkData = await this.LoadUsefulLinks()

    if (linkData.links.length > 0) {
      let links = "";
      linkData.links.forEach((link) => {
        links += `🔗 [${link.name}](${link.url})\n`;
      });
      const linkEmbed = new EmbedBuilder()
        .setTitle(`Useful Links`)
        .setDescription(links);
      this.embeds.push(linkEmbed);
    }

    if (linkData.attachments.length > 0) {
      linkData.attachments.forEach((attach) => {
        this.otherAttachments.push(attach.url)
      });
    }
  }
}

module.exports = BoardGameGeek;