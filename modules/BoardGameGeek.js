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

  static async CreateAndLoad(gameId, discordClient, interaction) {
    let bgg = new BoardGameGeek(gameId, discordClient, interaction);
    await bgg.LoadBggData();
    return bgg;
  }

  static async Search(query, bggToken) {
    const resp = await fetch(
      `https://api.geekdo.com/xmlapi2/search.cgi?type=boardgame&query=${encodeURIComponent(query)}`,
      { headers: { 'Authorization': `Bearer ${bggToken}` } }
    );
    const text = await resp.text();
    const parser = new XMLParser({
      attributeNamePrefix: "",
      ignoreAttributes: false,
      ignoreNameSpace: true,
      allowBooleanAttributes: true,
    });
    const parsed = parser.parse(text);
    let items = parsed.items?.item || [];
    if (!Array.isArray(items)) items = [items];

    items.sort((a, b) => (b.yearpublished?.value || 0) - (a.yearpublished?.value || 0));
    const top25 = items.slice(0, 25);
    top25.sort((a, b) => {
      const nameA = Array.isArray(a.name) ? (a.name.find(n => n.type === 'primary') || a.name[0])?.value : a.name?.value;
      const nameB = Array.isArray(b.name) ? (b.name.find(n => n.type === 'primary') || b.name[0])?.value : b.name?.value;
      return String(nameA || '').localeCompare(String(nameB || ''));
    });

    return top25.map((item) => {
      const names = Array.isArray(item.name) ? item.name : [item.name];
      const primary = names.find(n => n.type === 'primary') || names[0];
      return {
        name: `${he.decode(String(primary?.value || 'Unknown'))} (${item.yearpublished?.value || '?'})`.slice(0, 100),
        value: String(item.id),
      };
    });
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
    if (suggestedPlayerPoll && suggestedPlayerPoll.results) {
      suggestedPlayerPoll.results.forEach(r => {
        r.result.sort((a, b) => b.numvotes - a.numvotes)
        suggestedPlayers += `\n**${r.numplayers}**: ${r.result[0].value}`
      })
    }
    
    // Helper function to ensure field values are valid (non-empty, max 1024 chars)
    const sanitizeFieldValue = (value, fallback = "N/A") => {
      if (!value || value.trim().length === 0) return fallback;
      return value.length > 1024 ? value.substring(0, 1021) + "..." : value;
    };
    
    const detailEmbed = new EmbedBuilder().setTitle(`Details`).addFields(
      {
        name: "Game Data",
        value: sanitizeFieldValue(`**Published:** ${this.gameInfo.yearpublished || 'N/A'}\n**Players:** ${this.gameInfo.minplayers || '?'} - ${this.gameInfo.maxplayers || '?'}\n**Playing Time:** ${this.gameInfo.minplaytime || '?'} - ${this.gameInfo.maxplaytime || '?'}\n**Age:** ${this.gameInfo.age || '?'}+`),
        inline: true,
      },
      {
        name: `Ranks & Ratings`,
        value: sanitizeFieldValue(`**Average Rating:** ${this.gameInfo.statistics?.ratings?.average || 'N/A'}\n**Weight:** ${this.gameInfo.statistics?.ratings?.averageweight || 'N/A'}${ranks}`),
        inline: true,
      },
      {
        name: `Suggested Player Count`,
        value: sanitizeFieldValue(suggestedPlayers),
        inline: true,
      },
      {
        name: `Designer(s)`,
        value: sanitizeFieldValue(
          this.gameInfo.boardgamedesigner 
            ? Array.isArray(this.gameInfo.boardgamedesigner) 
              ? this.gameInfo.boardgamedesigner.map(d => d.text).join("\n") 
              : this.gameInfo.boardgamedesigner.text 
            : null
        ),
        inline: true
      },
      {
        name: `Publisher(s)`,
        value: sanitizeFieldValue(
          this.gameInfo.boardgamepublisher 
            ? Array.isArray(this.gameInfo.boardgamepublisher) 
              ? this.gameInfo.boardgamepublisher.map(d => d.text).join("\n") 
              : this.gameInfo.boardgamepublisher.text 
            : null
        ),
        inline: true
      }
    );
    if (this.gameInfo.boardgamemechanic) {
      const mechanicsValue = sanitizeFieldValue(
        Array.isArray(this.gameInfo.boardgamemechanic) 
          ? this.gameInfo.boardgamemechanic.map(d => d.text).join("\n") 
          : this.gameInfo.boardgamemechanic.text
      );
      detailEmbed.addFields(
        {
          name: `Mechanics`,
          value: mechanicsValue,
          inline: true
        }
      );
    }
    if (this.gameInfo.boardgameexpansion) {
      const expansionsValue = sanitizeFieldValue(
        Array.isArray(this.gameInfo.boardgameexpansion) 
          ? take(this.gameInfo.boardgameexpansion, 10).map(d => `[${d.text}](https://boardgamegeek.com/boardgame/${d.objectid})`).join("\n") 
          : `[${this.gameInfo.boardgameexpansion.text}](https://boardgamegeek.com/boardgame/${this.gameInfo.boardgameexpansion.objectid})`
      );
      detailEmbed.addFields(
        {
          name: `Expansions`,
          value: expansionsValue,
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