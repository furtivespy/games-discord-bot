const Discord = require('discord.js')
const { cloneDeep, forEach } = require('lodash')
const { nanoid } = require('nanoid')

class GameDatabase {
    
    CurrentCardList = [
        [ "Standard 52 Card Poker Deck", "standard" ],
        [ "Pear/Triangle (one 1, two 2s ... ten 10s)", "pear" ],
        [ "Dune Imperium Intrigue (Base)", "imperium"],
        [ "Dune Imperium Intrigue - Base + Rise of Ix", "dune-ix"],
        [ "Dune Imperium Intrigue - Base + Immortality", "dune-immortality"],
        [ "Dune Imperium Intrigue - Base + Rise of Ix + Immortality", "dune-ix-immortality"],
        [ "Dune Imperium Uprising Intrigue", "dune-uprising"],
        [ "Dune Imperium Uprising Intrigue With CHOAM", "dune-uprising-choam"],
        [ "Brian Boru Action Cards", "brian-boru"],
        [ "King is Dead - Cunning", "cunning"],
        [ "King is Dead - Player Hand", "king-player"],
        [ "Not Alone - Hunt Cards", "not-alone-hunt"],
        [ "Not Alone - Survival Cards", "not-alone-survival"],
        [ "Brass Birmingham - 2 Players", "brass-two"],
        [ "Brass Birmingham - 3 Players", "brass-three"],
        [ "Brass Birmingham - 4 Players", "brass-four"],
        [ "Brass Birmingham - Wild Location", "brass-wild-location"],
        [ "Brass Birmingham - Wild Industry", "brass-wild-industry"],
        [ "Blue Moon City", "blue-moon-city"],
        [ "Guild of Merchant Explorers - Explore Deck", "gome-explorer"],
        [ "Quantitative Easing (QE) - Industry", "qe-industry"],
        [ "Quantitative Easing (QE) - Company 3-4 Players", "qe-company-3"],
        [ "Quantitative Easing (QE) - Company 5 Players", "qe-company-5"],
        [ "Tigris & Euphrates", "tigris"],
        [ "Blood Rage - Age 1", "blood-rage-1"],
        [ "Blood Rage - Age 2", "blood-rage-2"],
        [ "Blood Rage - Age 3", "blood-rage-3"],
        [ "Money - $1", "money-1"],
        [ "Money - $5", "money-5"],
        [ "Money - $10", "money-10"],
        [ "Money - $20", "money-20"],
        [ "Heat - Starting Hand", "heat-starting"],
        [ "Heat - Upgrades", "heat-upgrades"],
        [ "Heat - All Cards", "heat-all"],
        [ "Empire's End - Disaster", "empire-disaster"],
        [ "El Grande - Power Cards", "el-grande"],
    ]

    defaultGameData = {
        decks: [],
        players: [],
        name: "",
        isdeleted: true,
        winner: null,
        bggGameId: null,
    }

    defaultBGGGameData = {
        links: [],
        attachments: [],
    }
    
    defaultSecretData = {
        isrevealed: true,
        players: []
    }

    defaultDeck = {
        name: "",
        id: "",
        allCards: [],
        shuffleStyle: "standard",
        hiddenInfo: "visible",
        piles: {
            draw: { cards: [], viewable: false },
            discard: { cards: [], viewable: true },
        }
    }

    defaultCard = {
        id: "",
        name: "",
        description: "",
        type: "",
        suit: "",
        value: "",
        url: null,
        origin: "",
        format: "A"
    }
    
    defaultPlayer = {
        guildId: "1",
        userId: "1",
        order: 1,
        score: "",
        money: 0,
        name: null,
        hands: {
            main: [],
            played: [],
            passed: [],
            received: []
        },
        color: null
    }
    
    defaultHand = {
        deck: "",
        cards: [],
    }

    createCard(deck, name, description = "", type = "", suit = "", value = "", format = "A", image){
        return cloneDeep({
            id: nanoid(),
            name: name,
            description: description,
            type: type,
            suit: suit,
            value: value,
            url: image,
            origin: deck,
            format, format
        })
    }

    createCardFromObj(deck, format, cardObj){
        return cloneDeep( {
            id: nanoid(),
            name: cardObj.name,
            description: cardObj?.description ?? "",
            type: cardObj?.type ?? "",
            suit: cardObj?.suit ?? "",
            value: cardObj?.value ?? "",
            url: cardObj?.url,
            origin: deck,
            format: format
        })
    }

    createCardFromObjList(deck, format, list){
        let results = []
        forEach(list, item => {
            results.push(cloneDeep(this.createCardFromObj(deck, format, item)))
        })
        return results
    }

    createCardFromStrList(deck, list){
        let results = []
        forEach(list, item => {
            results.push(cloneDeep(this.createCard(deck, item)))
        })
        return results
    }

    cardShortString(cardObj){
        let cardStr = cardObj.name
        if (cardObj.type.length > 0) { cardStr += ` of ${cardObj.type}`}
        return cardStr
    }

    cardString(cardObj){
        let cardStr = this.cardShortString(cardObj)
        if (cardObj.description.length > 0) { cardStr += ` *(${cardObj.description})*`}
        if (cardObj.url) { cardStr += ` [image](${cardObj.url})` }
        return cardStr
    }

    MakeSpecificDeck(deckName, whichDeck){
        switch(whichDeck){
            case "standard":
                return this.createCardFromObjList(deckName, "A", playingCards)
            case "pear":
                return this.createCardFromStrList(deckName, "A", pairCards)
            case "imperium":
                return this.createCardFromObjList(deckName, "B", duneImperium)
            case "dune-ix":
                return this.createCardFromObjList(deckName, "B", [...duneImperium, ...duneIx])
            case "dune-immortality":
                return this.createCardFromObjList(deckName, "B", [...duneImperium, ...duneImortal])
            case "dune-ix-immortality":
                return this.createCardFromObjList(deckName, "B", [...duneImperium, ...duneIx, ...duneImortal])
            case "dune-uprising":
                return this.createCardFromObjList(deckName, "B", duneUprising)
            case "dune-uprising-choam":
                return this.createCardFromObjList(deckName, "B", [...duneUprising, ...duneCHOAM])
            case "brian-boru":
                return this.createCardFromObjList(deckName, "A", brianBoru)
            case "cunning":
                return this.createCardFromObjList(deckName, "B", cunningKing)
            case "king-player":
                return this.createCardFromObjList(deckName, "B", kingPlayer)
            case "not-alone-hunt":
                return this.createCardFromObjList(deckName, "B", aloneHunt)
            case "not-alone-survival":
                return this.createCardFromObjList(deckName, "B", aloneSurvive)
            case "brass-two":
                return this.createCardFromObjList(deckName, "B", brassTwoPlayer)
            case "brass-three":
                return this.createCardFromObjList(deckName, "B", brassThreePlayer)
            case "brass-four":
                return this.createCardFromObjList(deckName, "B", brassFourPlayer)
            case "brass-wild-location":
                return this.createCardFromObjList(deckName, "B", [...brassWildLocation, ...brassWildLocation])
            case "brass-wild-industry":
                return this.createCardFromObjList(deckName, "B", [...brassWildIndustry, ...brassWildIndustry])
            case "blue-moon-city":
                return this.createCardFromObjList(deckName, "A", blueMoonCity)
            case "gome-explorer":
                return this.createCardFromObjList(deckName, "B", guildExplore)
            case "qe-industry":
                return this.createCardFromObjList(deckName, "B", qeIndustry)
            case "qe-company-3":
                return this.createCardFromObjList(deckName, "B", qeCompany3)
            case "qe-company-5":
                return this.createCardFromObjList(deckName, "B", qeCompany5)
            case "tigris":
                let deckArray = Array.from({length: 47}, () => ({...tigrisTiles[0]}))
                deckArray.push(...Array.from({length: 36}, () => ({...tigrisTiles[1]})))
                deckArray.push(...Array.from({length: 30}, () => ({...tigrisTiles[2]})))
                deckArray.push(...Array.from({length: 30}, () => ({...tigrisTiles[3]})))
                return this.createCardFromObjList(deckName, "B", deckArray)
            case "blood-rage-1":
                return this.createCardFromObjList(deckName, "B", bloodRageAge1)
            case "blood-rage-2":
                return this.createCardFromObjList(deckName, "B", bloodRageAge2)
            case "blood-rage-3":
                return this.createCardFromObjList(deckName, "B", bloodRageAge3)
            case "money-1":
                return this.createCardFromObjList(deckName, "B", Array.from({length: 200}, () => ({...money[0]})))
            case "money-5":
                return this.createCardFromObjList(deckName, "B", Array.from({length: 100}, () => ({...money[1]})))
            case "money-10":
                return this.createCardFromObjList(deckName, "B", Array.from({length: 100}, () => ({...money[2]})))
            case "money-20":
                return this.createCardFromObjList(deckName, "B", Array.from({length: 100}, () => ({...money[3]})))
            case "heat-starting":
                return this.createCardFromObjList(deckName, "B", heatBase)
            case "heat-upgrades":
                return this.createCardFromObjList(deckName, "B", heatUpgrades)
            case "heat-all":
                return this.createCardFromObjList(deckName, "B", [...heatGeneric, ...heatBase, ...heatUpgrades])
            case "empire-disaster":
                return this.createCardFromObjList(deckName, "B", empiresEnd)
            case "el-grande":
                return this.createCardFromObjList(deckName, "B", elgrande)
            default:
                return []
        }
    }
}

const playingCards = [
    {name: "A", type: "♣", suit: "clubs", value: 1},
    {name: "2", type: "♣", suit: "clubs", value: 2},
    {name: "3", type: "♣", suit: "clubs", value: 3},
    {name: "4", type: "♣", suit: "clubs", value: 4},
    {name: "5", type: "♣", suit: "clubs", value: 5},
    {name: "6", type: "♣", suit: "clubs", value: 6},
    {name: "7", type: "♣", suit: "clubs", value: 7},
    {name: "8", type: "♣", suit: "clubs", value: 8},
    {name: "9", type: "♣", suit: "clubs", value: 9},
    {name: "10", type: "♣", suit: "clubs", value: 10},
    {name: "J", type: "♣", suit: "clubs", value: 11},
    {name: "Q", type: "♣", suit: "clubs", value: 12},
    {name: "K", type: "♣", suit: "clubs", value: 13},

    {name: "A", type: "♦", suit: "diamonds", value: 1},
    {name: "2", type: "♦", suit: "diamonds", value: 2},
    {name: "3", type: "♦", suit: "diamonds", value: 3},
    {name: "4", type: "♦", suit: "diamonds", value: 4},
    {name: "5", type: "♦", suit: "diamonds", value: 5},
    {name: "6", type: "♦", suit: "diamonds", value: 6},
    {name: "7", type: "♦", suit: "diamonds", value: 7},
    {name: "8", type: "♦", suit: "diamonds", value: 8},
    {name: "9", type: "♦", suit: "diamonds", value: 9},
    {name: "10", type: "♦", suit: "diamonds", value: 10},
    {name: "J", type: "♦", suit: "diamonds", value: 11},
    {name: "Q", type: "♦", suit: "diamonds", value: 12},
    {name: "K", type: "♦", suit: "diamonds", value: 13},

    {name: "A", type: "♥", suit: "hearts", value: 1},
    {name: "2", type: "♥", suit: "hearts", value: 2},
    {name: "3", type: "♥", suit: "hearts", value: 3},
    {name: "4", type: "♥", suit: "hearts", value: 4},
    {name: "5", type: "♥", suit: "hearts", value: 5},
    {name: "6", type: "♥", suit: "hearts", value: 6},
    {name: "7", type: "♥", suit: "hearts", value: 7},
    {name: "8", type: "♥", suit: "hearts", value: 8},
    {name: "9", type: "♥", suit: "hearts", value: 9},
    {name: "10", type: "♥", suit: "hearts", value: 10},
    {name: "J", type: "♥", suit: "hearts", value: 11},
    {name: "Q", type: "♥", suit: "hearts", value: 12},
    {name: "K", type: "♥", suit: "hearts", value: 13},

    {name: "A", type: "♠", suit: "spades", value: 1},
    {name: "2", type: "♠", suit: "spades", value: 2},
    {name: "3", type: "♠", suit: "spades", value: 3},
    {name: "4", type: "♠", suit: "spades", value: 4},
    {name: "5", type: "♠", suit: "spades", value: 5},
    {name: "6", type: "♠", suit: "spades", value: 6},
    {name: "7", type: "♠", suit: "spades", value: 7},
    {name: "8", type: "♠", suit: "spades", value: 8},
    {name: "9", type: "♠", suit: "spades", value: 9},
    {name: "10", type: "♠", suit: "spades", value: 10},
    {name: "J", type: "♠", suit: "spades", value: 11},
    {name: "Q", type: "♠", suit: "spades", value: 12},
    {name: "K", type: "♠", suit: "spades", value: 13},
]

const pairCards = [
    ":one:",":two:",":two:",":three:",":three:",":three:",":four:",":four:",":four:",":four:",":five:",":five:",":five:",":five:",":five:",":six:",":six:",":six:",":six:",":six:",":six:",":seven:",":seven:",":seven:",":seven:",":seven:",":seven:",":seven:",":eight:",":eight:",":eight:",":eight:",":eight:",":eight:",":eight:",":eight:",":nine:",":nine:",":nine:",":nine:",":nine:",":nine:",":nine:",":nine:",":nine:",":keycap_ten:",":keycap_ten:",":keycap_ten:",":keycap_ten:",":keycap_ten:",":keycap_ten:",":keycap_ten:",":keycap_ten:",":keycap_ten:",":keycap_ten:"
]

const duneImperium = [
    {name: "Refocus", type: "Plot", suit: "plot", url: "https://furtivespy.com/images/dune/refocus.jpg", description: "Shuffle your discard pile into your deck, then: (draw a card)"},
    {name: "Windfall", type: "Plot", suit: "plot", url: "https://furtivespy.com/images/dune/windfall.jpg", description: "Gain 2 Solari"},
    {name: "Poison Snooper", type: "Plot", suit: "plot", url: "https://furtivespy.com/images/dune/poison.jpg", description: "Look at the top card of your deck. Draw or trash it"},
    {name: "Bindu Suspension", type: "Plot", suit: "plot", url: "https://furtivespy.com/images/dune/bindu.jpg", description: "At the start of your turn: (draw a card). You may pass your turn. (Instead of taking an Agent or Reveal turn.)"},
    {name: "Urgent Mission", type: "Plot", suit: "plot", url: "https://furtivespy.com/images/dune/urgent.jpg", description: "Recall one of your Agents"},
    {name: "Dispatch an Envoy", type: "Plot", suit: "plot", url: "https://furtivespy.com/images/dune/dispatch.jpg", description: "The card you play this turn has the following icons: (Emperor) (Spacing Guild) (Bene Gesserit) (Fremen)"},

    {name: "Reinforcements", type: "Plot", suit: "plot", url: "https://furtivespy.com/images/dune/reinforcements.jpg", description: "3 Solari for 3 troops. If it's your Reveal turn, you may deploy any of these troops to the Conflict."},
    {name: "Poison Snooper", type: "Plot", suit: "plot", url: "https://furtivespy.com/images/dune/poison.jpg", description: "Look at the top card of your deck. Draw or trash it"},
    {name: "Bribery", type: "Plot", suit: "plot", url: "https://furtivespy.com/images/dune/bribery.jpg", description: "2 Solari for 1 Influence in any faction"},
    {name: "Guild Authorization", type: "Plot", suit: "plot", url: "https://furtivespy.com/images/dune/guild.jpg", description: "Gain 1 Influence with Spacing Guild"},
    {name: "Secret Of The Sisterhood", type: "Plot", suit: "plot", url: "https://furtivespy.com/images/dune/secret.jpg", description: "Gain 1 Influence with Bene Gesserit"},
    {name: "The Sleeper Must Awaken", type: "Plot", suit: "plot", url: "https://furtivespy.com/images/dune/sleeper.jpg", description: "4 Spice for a Victory Point"},
    {name: "Charisma", type: "Plot", suit: "plot", url: "https://furtivespy.com/images/dune/charisma.jpg", description: "Gain 2 Persuasion during your Reveal turn this round"},

    {name: "Double Cross", type: "Plot", suit: "plot", url: "https://furtivespy.com/images/dune/double.jpg", description: "1 Solari for An opponent of your choice loses one troop in the Conflict and you deploy one troop from your supply to the Conflict"},
    {name: "Infiltrate", type: "Plot", suit: "plot", url: "https://furtivespy.com/images/dune/infiltrate.jpg", description: "Enemy Agents don't block your next Agent at board spaces this turn"},
    {name: "Know Their Ways", type: "Plot", suit: "plot", url: "https://furtivespy.com/images/dune/know.jpg", description: "Gain 1 Influence with Fremen"},
    {name: "Dispatch an Envoy", type: "Plot", suit: "plot", url: "https://furtivespy.com/images/dune/dispatch.jpg", description: "The card you play this turn has the following icons: (Emperor) (Spacing Guild) (Bene Gesserit) (Fremen)"},
    {name: "Calculated Hire", type: "Plot", suit: "plot", url: "https://furtivespy.com/images/dune/calculated.jpg", description: "1 Spice for Take the Mentat from its designated space in the Landsraad"},
    {name: "Rapid Mobilization", type: "Plot", suit: "plot", url: "https://furtivespy.com/images/dune/rapid.jpg", description: "Deploy any number of your garrisoned troops to the Conflict"},
    {name: "Recruitment Mission", type: "Plot", suit: "plot", url: "https://furtivespy.com/images/dune/recruitment.jpg", description: "Gain 1 Persuasion during your reveal turn this round. You may put cards you acquire on top of your deck."},

    {name: "Choam Shares", type: "Plot", suit: "plot", url: "https://furtivespy.com/images/dune/choam.jpg", description: "7 Solari for"},
    {name: "Water Peddlers Union", type: "Plot", suit: "plot", url: "https://furtivespy.com/images/dune/waterunion.jpg", description: "Gain 1 Water"},
    {name: "Favored Subject", type: "Plot", suit: "plot", url: "https://furtivespy.com/images/dune/favored.jpg", description: "Gain 1 Influence with Emperor"},
    {name: "Bypass Protocol", type: "Plot", suit: "plot", url: "https://furtivespy.com/images/dune/bypass.jpg", description: "Acquire a card that cost 3 or less OR 2 Spice for Acquire a card taht costs 5 or less to the top of your deck"},
    {name: "Councilor's Dispensation", type: "Plot", suit: "plot", url: "https://furtivespy.com/images/dune/councilors.jpg", description: "if you have a seat on the High Council: 2 Spice"},
    {name: "Water of Life", type: "Plot", suit: "plot", url: "https://furtivespy.com/images/dune/waterlife.jpg", description: "1 Water & 1 Spice for Draw 3 cards"},


    {name: "Corner the Market", type: "Endgame", suit: "endgame", url: "https://furtivespy.com/images/dune/corner.jpg", description: "If you have at least two The Spice Must Flow: 1 Victory Point ALSO If you have more The Spice Must Flow than each opponent: 1 Victory Point"},
    {name: "Plans Within Plans", type: "Endgame", suit: "endgame", url: "https://furtivespy.com/images/dune/plans.jpg", description: "3 Influence (or more) on three Faction tracks: 1 Victory Point OR 3 Influence (or more) on four Faction tracks: 2 Victory Points"},
    {name: "Tiebreaker", type: "Combat/Endgame", suit: "endgame-combat", url: "https://furtivespy.com/images/dune/tiebreaker.jpg", description: "Combat: 2 Swords OR Endgame: 10 Spice"},
    {name: "Ambush", type: "Combat", suit: "combat", url: "https://furtivespy.com/images/dune/ambush.jpg", description: "4 Swords"},
    {name: "Ambush", type: "Combat", suit: "combat", url: "https://furtivespy.com/images/dune/ambush.jpg", description: "4 Swords"},

    {name: "Private Army", type: "Combat", suit: "combat", url: "https://furtivespy.com/images/dune/private.jpg", description: "2 Spice for 5 Swords"},
    {name: "Master Tactician", type: "Combat", suit: "combat", url: "https://furtivespy.com/images/dune/master.jpg", description: "3 Swords OR Retreat up to three of your troops"},
    {name: "Demand Respect", type: "Combat", suit: "combat", url: "https://furtivespy.com/images/dune/demand.jpg", description: "When you win a Conflict: 1 Influence in any faction OR 2 Spice for 2 Influence in any one faction"},
    {name: "Master Tactician", type: "Combat", suit: "combat", url: "https://furtivespy.com/images/dune/master.jpg", description: "3 Swords OR Retreat up to three of your troops"},
    {name: "To The Victor...", type: "Combat", suit: "combat", url: "https://furtivespy.com/images/dune/victor.jpg", description: "When you win a Conflict: 3 Spice"},

    {name: "Private Army", type: "Combat", suit: "combat", url: "https://furtivespy.com/images/dune/private.jpg", description: "2 Spice for 5 Swords"},
    {name: "Allied Armada", type: "Combat", suit: "combat", url: "https://furtivespy.com/images/dune/allied.jpg", description: "If you have a Faction Alliance: 2 Spice for 7 Swords"},
    {name: "Staged Incident", type: "Combat", suit: "combat", url: "https://furtivespy.com/images/dune/staged.jpg", description: "Lose three of your troops in the Conflict for 1 Victory Point"},
    {name: "Master Tactician", type: "Combat", suit: "combat", url: "https://furtivespy.com/images/dune/master.jpg", description: "3 Swords OR Retreat up to three of your troops"},
//    {name: "", type: "Combat", suit: "combat", url: "https://furtivespy.com/images/dune/.jpg", description: ""},
]

const duneIx = [
    {name: "Cannon Turrets", type: "Combat", suit: "combat", url: "https://furtivespy.com/images/dune/cannon.jpg", description: "2 Swords. Each opponent retreats one dreadnought."},
    {name: "Strategic Push", type: "Combat", suit: "combat", url: "https://furtivespy.com/images/dune/strategic.jpg", description: "2 Swords. If you win this Conflict: 2 Solari"},
    {name: "War Chest", type: "Combat/Endgame", suit: "endgame-combat", url: "https://furtivespy.com/images/dune/war.jpg", description: "Combat: 2 Solari for 4 Swords OR Endgame: If you have 10 or more Solari: 1 Victory Point"},
    {name: "Blackmail", type: "Combat", suit: "combat", url: "https://furtivespy.com/images/dune/blackmail.jpg", description: "Lose 1 Influence in any Faction for 5 Swords"},
    {name: "Second Wave", type: "Combat", suit: "combat", url: "https://furtivespy.com/images/dune/second.jpg", description: "2 Swords. Deploy up to two units from your garrison to the Conflict."},

    {name: "Secret Forces", type: "Plot", suit: "plot", url: "https://furtivespy.com/images/dune/secretforces.jpg", description: "If you have a seat on the High Concil: 2 Troops"},
    {name: "Expedite", type: "Plot", suit: "plot", url: "https://furtivespy.com/images/dune/expedite.jpg", description: "1 Spice for a Freighter action"},
    {name: "Grand Conspiracy", type: "Endgame", suit: "endgame", url: "https://furtivespy.com/images/dune/grand.jpg", description: "2 dreadnoughts; 1+ The Spice Must Flow; 4+ Influence on 2+ Influence tracks; A seat on the High Concil -- If you have any three: 1 Victory Point OR If you have all four: 2 Victory Points"},
    {name: "Ixian Probe", type: "Plot", suit: "plot", url: "https://furtivespy.com/images/dune/ixian.jpg", description: "Discard 2 cards for Draw 2 cards"},
    {name: "Quid Pro Quo", type: "Plot", suit: "plot", url: "https://furtivespy.com/images/dune/quid.jpg", description: "2 Spice for Gain one Influence with each Faction that has at least one of your Agents on its board spaces"},
    {name: "Diversion", type: "Plot", suit: "plot", url: "https://furtivespy.com/images/dune/diversion.jpg", description: "When you deploy four or more units to the Conflict in a single turn: A Freighter action"},

    {name: "Machine Culture", type: "Plot/Endgame", suit: "endgame-plot", url: "https://furtivespy.com/images/dune/machine.jpg", description: "Plot: Acquire Tech OR Endgame: If you have three or more Tech tiles: 1 Victory Point"},
    {name: "Glimpse the Path", type: "Plot", suit: "plot", url: "https://furtivespy.com/images/dune/glimpse.jpg", description: "1 Spice for Water and Draw a card"},
    {name: "Finesse", type: "Plot/Combat", suit: "combat-plot", url: "https://furtivespy.com/images/dune/finesse.jpg", description: "Plot: Lose 1 Influence in any Faction for Gain 1 Influence in any Faction OR Combat: 2 Swords"},
    {name: "Cull", type: "Plot", suit: "plot", url: "https://furtivespy.com/images/dune/cull.jpg", description: "1 Solari for Trash a card"},
    {name: "Advanced Weaponry", type: "Plot/Combat", suit: "combat-plot", url: "https://furtivespy.com/images/dune/advanced.jpg", description: "Plot: 3 Solari for Dreadnaught OR Combat: If you ahve three or more Tech tiles: 4 Swords"},
    {name: "Strongarm", type: "Plot", suit: "plot", url: "https://furtivespy.com/images/dune/strongarm.jpg", description: "Lose a troop for Gain one Influence with a Faction whose board space you sent an Agent to this turn"},
]

const duneImortal = [
    {name: "Breakthrough", type: "Plot", suit:"plot", url: "https://furtivespy.com/images/dune/breakthrough.png", description: "Research"},
    {name: "Counterattack", type: "Plot/Combat", suit: "combat-plot", url: "https://furtivespy.com/images/dune/counterattack.png", description: "Deploy up to two troops from your garrison to the conflict OR If an opponent played a Combat Intrigue card in this Conflict: 4 Swords"},
    {name: "Disguised Bureaucrat", type: "Plot", suit:"plot", url: "https://furtivespy.com/images/dune/disguised.png", description: "1 Genetic Marker: Gain Spice, 2 Genetic Markers: Gain 1 Influence in any faction"},
    {name: "Economic Positioning", type: "Combat/Endgame", suit: "endgame-combat", url: "https://furtivespy.com/images/dune/economic.png", description: "Retreat two of your troops => gain 3 Solari OR If you have 10 or more Solari: Gain 1 Victory Point"},
    {name: "Gruesome Sacrifice", type: "Combat", suit: "combat", url: "https://furtivespy.com/images/dune/gruesome.png", description: "Lose two if your troops in the conflict => Advance 1 on Tleilaxu track and add 2 Specimen"},
    {name: "Harvest Cells", type: "Combat", suit: "combat", url: "https://furtivespy.com/images/dune/harvest.png", description: "When you lose at least three troops at the end of a Conflict: 2 Specimen. You may also acquire a Tleilaxu card (paying its normal cost)"},
    {name: "Illicit Dealings", type: "Plot", suit:"plot", url: "https://furtivespy.com/images/dune/illicit.png", description: "Advance 1 on Tleilaxu track"},
    {name: "Shadowy Bargain", type: "Plot/Endgame", suit: "endgame-plot", url: "https://furtivespy.com/images/dune/shadowy.png", description: "1 Specimen OR Advance 1 on Tleilaxu track"},
    {name: "Study Melange", type: "Plot/Endgame", suit: "endgame-plot", url: "https://furtivespy.com/images/dune/study.png", description: "Gain 1 Spice OR If you have 3 or more Spice: 2 Genetic Markers: 1 Victory Point"},
    {name: "Tleilaxu Puppet", type: "Plot/Endgame", suit: "endgame-plot", url: "https://furtivespy.com/images/dune/tleilaxu.png", description: "Gain 1 Persuasion during your Reveal turn this round"},
    {name: "Vicious Talents", type: "Combat", suit: "combat", url: "https://furtivespy.com/images/dune/vicious.png", description: "2 Swords, 1 Genetic Marker: + 2 Swords, 2 Genetic Markers: + 2 Swords"},
]

const duneUprising = [
    {name: "Sietch Ritual", type: "Plot", suit: "plot", url: "https://furtivespy.com/images/dune-uprising/duneup_0_0.png", description: "Discard for Bene Gesserit or Fremen Influence"},
    {name: "Mercenaries", type: "Plot", suit: "plot", url: "https://furtivespy.com/images/dune-uprising/duneup_0_1.png", description: "3 Solari for Intrigue Card and 2 Troops"},
    {name: "Councilor's Ambition", type: "Plot", suit: "plot", url: "https://furtivespy.com/images/dune-uprising/duneup_0_2.png", description: "If you have a seat on the High Council: 2 Water"},
    {name: "Strategic Stockpiling", type: "Plot", suit: "plot", url: "https://furtivespy.com/images/dune-uprising/duneup_0_3.png", description: "5 Spice for Victory Point; 3 Fremen Influence: 3 Water for Victory Point"},
    {name: "Detonation", type: "Plot", suit: "plot", url: "https://furtivespy.com/images/dune-uprising/duneup_0_4.png", description: "Remove Shield Wall or Deploy up to four troops from your garrison to the Conflict"},
    {name: "Detonation", type: "Plot", suit: "plot", url: "https://furtivespy.com/images/dune-uprising/duneup_0_5.png", description: "Remove Shield Wall or Deploy up to four troops from your garrison to the Conflict"},
    {name: "Depart for Arrakis", type: "Plot", suit: "plot", url: "https://furtivespy.com/images/dune-uprising/duneup_0_6.png", description: "2 Spice for 3 Troops; 3 Spacing Guild Influence: Draw a card"},
    {name: "Cunning", type: "Plot", suit: "plot", url: "https://furtivespy.com/images/dune-uprising/duneup_0_7.png", description: "Draw a card OR 1 Spice for Draw a card and trash a card"},
    {name: "Opportunism", type: "Plot", suit: "plot", url: "https://furtivespy.com/images/dune-uprising/duneup_0_8.png", description: "2 Solari and Lose 2 Influence for Victory Point"},
    {name: "Change Allegiances", type: "Plot", suit: "plot", url: "https://furtivespy.com/images/dune-uprising/duneup_0_9.png", description: "Lose 1 Influence for gain 1 Influence; 3 Spice for gain 1 Influence"},
    
    {name: "Special Mission", type: "Plot", suit: "plot", url: "https://furtivespy.com/images/dune-uprising/duneup_1_0.png", description: "Spy on 'populated area' OR Recall Spy for Remove Shield Wall and 2 Spice"},
    {name: "Special Mission", type: "Plot", suit: "plot", url: "https://furtivespy.com/images/dune-uprising/duneup_1_1.png", description: "Spy on 'populated area' OR Recall Spy for Remove Shield Wall and 2 Spice"},
    {name: "Unexpected Allies", type: "Plot", suit: "plot", url: "https://furtivespy.com/images/dune-uprising/duneup_1_2.png", description: "2 Water for Remove Shield Wall and Summon Sandworm"},
    {name: "Call To Arms", type: "Plot", suit: "plot", url: "https://furtivespy.com/images/dune-uprising/duneup_1_3.png", description: "During your Reveal turn this round, whenever you acquire a card: Gain a Troop"},
    {name: "Buy Access", type: "Plot", suit: "plot", url: "https://furtivespy.com/images/dune-uprising/duneup_1_4.png", description: "5 Solari for gain 1 Influence in any two of Emperor, Spacing Guild, Bene Gesserit or Fremen"},
    {name: "Imperium Politics", type: "Plot", suit: "plot", url: "https://furtivespy.com/images/dune-uprising/duneup_1_5.png", description: "1 Solari for 1 Influence in Emperor or Spacing Guild"},
    {name: "Shaddam's Favor", type: "Plot", suit: "plot", url: "https://furtivespy.com/images/dune-uprising/duneup_1_6.png", description: "Gain a Troop; 3 Emperor Influence: Gain 3 Solari"},
    {name: "Intelligence Report", type: "Plot", suit: "plot", url: "https://furtivespy.com/images/dune-uprising/duneup_1_7.png", description: "Draw a card; If you have 2 or more Spies on the board: Draw a card"},
    {name: "Manipulate", type: "Plot", suit: "plot", url: "https://furtivespy.com/images/dune-uprising/duneup_1_8.png", description: "Remove and replace a card in the Imperium Row. During your reval turn this round, you may acquire the removed card for 1 Persuasion less"},
    {name: "Distraction", type: "Plot", suit: "plot", url: "https://furtivespy.com/images/dune-uprising/duneup_1_9.png", description: "When you deploy three or more units to the Conflict in a single turn: Place a spy (You may place this Spy on the same observation post an another player's Spy)"},

    {name: "Distraction", type: "Plot", suit: "plot", url: "https://furtivespy.com/images/dune-uprising/duneup_2_0.png", description: "When you deploy three or more units to the Conflict in a single turn: Place a spy (You may place this Spy on the same observation post an another player's Spy)"},
    {name: "Market Opportunity", type: "Plot", suit: "plot", url: "https://furtivespy.com/images/dune-uprising/duneup_2_1.png", description: "2 Spice for 5 Solari OR 5 Solari for 5 Spice"},
    {name: "Go To Ground", type: "Combat", suit: "combat", url: "https://furtivespy.com/images/dune-uprising/duneup_2_2.png", description: "Retreat on or two of your troops for Place a Spy"},
    {name: "Contingency Plan", type: "Plot/Combat", suit: "combat-plot", url: "https://furtivespy.com/images/dune-uprising/duneup_2_3.png", description: "2 Solari OR + 3 Swords"},
    {name: "Contingency Plan", type: "Plot/Combat", suit: "combat-plot", url: "https://furtivespy.com/images/dune-uprising/duneup_2_4.png", description: "2 Solari OR + 3 Swords"},
    {name: "Contingency Plan", type: "Plot/Combat", suit: "combat-plot", url: "https://furtivespy.com/images/dune-uprising/duneup_2_5.png", description: "2 Solari OR + 3 Swords"},
    {name: "Inspire Awe", type: "Plot", suit: "plot", url: "https://furtivespy.com/images/dune-uprising/duneup_2_6.png", description: "Acquire a card that costs 3 Persuasion or less. If you have one or more sandworms in the Conflict, put that card in your hand"},
    {name: "Find Weakness", type: "Combat", suit: "combat", url: "https://furtivespy.com/images/dune-uprising/duneup_2_7.png", description: "+ 2 Swords; Recall a Spy for + 3 Swords"},
    {name: "Spice is Power", type: "Combat", suit: "combat", url: "https://furtivespy.com/images/dune-uprising/duneup_2_8.png", description: "Retreat three of your troops for 3 Spice OR 3 Spice for +6 Swords"},
    {name: "Devour", type: "Combat", suit: "combat", url: "https://furtivespy.com/images/dune-uprising/duneup_2_9.png", description: "+2 Swords; If you have one or more sandworms in the Conflict: + 2 Swords and Trash a Card"},

    {name: "Impress", type: "Combat", suit: "combat", url: "https://furtivespy.com/images/dune-uprising/duneup_3_0.png", description: "+ 2 Swords; Acquire a card that costs 3 Persuasion or less"},
    {name: "Spring The Trap", type: "Combat", suit: "combat", url: "https://furtivespy.com/images/dune-uprising/duneup_3_1.png", description: "Recall 2 Spies for +7 Swords"},
    {name: "Weirding Combat", type: "Combat", suit: "combat", url: "https://furtivespy.com/images/dune-uprising/duneup_3_2.png", description: "+3 Swords; 3 Bene Gesserit Influence: + 2 Swords"},
    {name: "Tactical Option", type: "Combat", suit: "combat", url: "https://furtivespy.com/images/dune-uprising/duneup_3_3.png", description: "+2 Swords OR Retreat any number of your troops"},
    {name: "Questionable Methods", type: "Combat", suit: "combat", url: "https://furtivespy.com/images/dune-uprising/duneup_3_4.png", description: "+1 Sword; Lose 1 Influence for + 4 Swords"},
    {name: "Desert Mouse", type: "Plot/Endgame", suit: "endgame-plot", url: "https://furtivespy.com/images/dune-uprising/duneup_3_5.png", description: "1 Spice OR Flip one of your Desert Mouse or Wild Conflict Cards for a Victory Point"},
    {name: "Ornithopter", type: "Plot/Endgame", suit: "endgame-plot", url: "https://furtivespy.com/images/dune-uprising/duneup_3_6.png", description: "1 Spice OR Flip one of your Ornithopter or Wild Conflict Cards for a Victory Point"},
    {name: "Crysknife", type: "Plot/Endgame", suit: "endgame-plot", url: "https://furtivespy.com/images/dune-uprising/duneup_3_7.png", description: "1 Spice OR Flip one of your Crysknife or Wild Conflict Cards for a Victory Point"},
    {name: "Shadow Alliance", type: "Endgame", suit: "endgame", url: "https://furtivespy.com/images/dune-uprising/duneup_3_8.png", description: "If you have 4 Influence (or more) on a Faction track where an opponent has the Alliance: 1 Victory Point"},
    {name: "Secure Spice Trade", type: "Endgame", suit: "endgame", url: "https://furtivespy.com/images/dune-uprising/duneup_3_9.png", description: "If you have at least two The Spice Must Flow: 1 Victory Point and 2 Spice"},
]

const duneCHOAM = [
    {name: "Leverage", type: "Plot", suit: "plot", url: "https://furtivespy.com/images/dune-uprising/duneupchoam_0_0.png", description: "If you gained spice this turn: Take Contract and 1 Solari"},
    {name: "Backed by CHOAM", type: "Plot/Combat", suit: "combat-plot", url: "https://furtivespy.com/images/dune-uprising/duneupchoam_0_1.png", description: "Lose 1 Influence for 4 Solari OR If you have completed two or more contracts: + 4 Swords"},
    {name: "Reach Agreement", type: "Combat", suit: "combat", url: "https://furtivespy.com/images/dune-uprising/duneupchoam_1_0.png", description: "Retreat one or two of your troops for Take Contract"},
    {name: "CHOAM Profits", type: "Endgame", suit: "endgame", url: "https://furtivespy.com/images/dune-uprising/duneupchoam_1_1.png", description: "If you have completed four or more contracts: 1 Victory Point"},
]

const brianBoru = [
    {name: "1", type: "🟡", suit: "none", value: 1, url: "https://furtivespy.com/images/brian/bb01.png"},
    {name: "2", type: "🔴", suit: "none", value: 2, url: "https://furtivespy.com/images/brian/bb02.png"},
    {name: "3", type: "🔵", suit: "none", value: 3, url: "https://furtivespy.com/images/brian/bb03.png"},
    {name: "4", type: "🟡", suit: "none", value: 4, url: "https://furtivespy.com/images/brian/bb04.png"},
    {name: "5", type: "🔴", suit: "none", value: 5, url: "https://furtivespy.com/images/brian/bb05.png"},
    {name: "6", type: "🔵", suit: "none", value: 6, url: "https://furtivespy.com/images/brian/bb06.png"},
    {name: "7", type: "🟡", suit: "none", value: 7, url: "https://furtivespy.com/images/brian/bb07.png"},
    {name: "8", type: "🔴", suit: "none", value: 8, url: "https://furtivespy.com/images/brian/bb08.png"},
    {name: "9", type: "🔵", suit: "none", value: 9, url: "https://furtivespy.com/images/brian/bb09.png"},
    {name: "10", type: "🟡", suit: "none", value: 10, url: "https://furtivespy.com/images/brian/bb10.png"},
    {name: "11", type: "🔴", suit: "none", value: 11, url: "https://furtivespy.com/images/brian/bb11.png"},
    {name: "12", type: "🔵", suit: "none", value: 12, url: "https://furtivespy.com/images/brian/bb12.png"},
    {name: "13", type: "⚪", suit: "none", value: 13, url: "https://furtivespy.com/images/brian/bb13.png"},
    {name: "14", type: "🟡", suit: "none", value: 14, url: "https://furtivespy.com/images/brian/bb14.png"},
    {name: "15", type: "🔴", suit: "none", value: 15, url: "https://furtivespy.com/images/brian/bb15.png"},
    {name: "16", type: "🔵", suit: "none", value: 16, url: "https://furtivespy.com/images/brian/bb16.png"},
    {name: "17", type: "🟡", suit: "none", value: 17, url: "https://furtivespy.com/images/brian/bb17.png"},
    {name: "18", type: "🔴", suit: "none", value: 18, url: "https://furtivespy.com/images/brian/bb18.png"},
    {name: "19", type: "🔵", suit: "none", value: 19, url: "https://furtivespy.com/images/brian/bb19.png"},
    {name: "20", type: "⚪", suit: "none", value: 20, url: "https://furtivespy.com/images/brian/bb20.png"},
    {name: "21", type: "⚪", suit: "none", value: 21, url: "https://furtivespy.com/images/brian/bb21.png"},
    {name: "22", type: "⚪", suit: "none", value: 22, url: "https://furtivespy.com/images/brian/bb22.png"},
    {name: "23", type: "🟡", suit: "none", value: 23, url: "https://furtivespy.com/images/brian/bb23.png"},
    {name: "24", type: "🔴", suit: "none", value: 24, url: "https://furtivespy.com/images/brian/bb24.png"},
    {name: "25", type: "🔵", suit: "none", value: 25, url: "https://furtivespy.com/images/brian/bb25.png"},
]

const cunningKing = [
    {name: "Spy", type: "Cunning Action", suit: "none", description: "Resolve the effect of an action card that is face up on top of another player’s discard pile", url: "https://furtivespy.com/images/king/spy.png"},
    {name: "Aid", type: "Cunning Action", suit: "none", description: "Find the faction with the most followers in the supply. Place two followers of that faction into any region.", url: "https://furtivespy.com/images/king/aid.png"},
    {name: "Ambush", type: "Cunning Action", suit: "none", description: "Place two Scottish followers from the supply into a region, then return a follower from that region to the supply.", url: "https://furtivespy.com/images/king/ambush.png"},
    {name: "Influence", type: "Cunning Action", suit: "none", description: "Swap one English follower in any region with two non-English followers in another region. ", url: "https://furtivespy.com/images/king/influence.png"},
    {name: "March", type: "Cunning Action", suit: "none", description: "Move two followers from a single region to a single bordering region.", url: "https://furtivespy.com/images/king/march.png"},
    {name: "Dispute", type: "Cunning Action", suit: "none", description: "Swap a Welsh follower in any region with a non-Welsh follower in another region.", url: "https://furtivespy.com/images/king/dispute.png"},
    {name: "Plot", type: "Cunning Action", suit: "none", description: "You cannot take this action during the game. When deciding the winner of the game, reveal this card. It counts as a follower of a faction of your choice.", url: "https://furtivespy.com/images/king/plot.png"},
    {name: "Edict", type: "Cunning Action", suit: "none", description: "Swap two Scottish followers in any region with two non-Scottish followers in a bordering region.", url: "https://furtivespy.com/images/king/edict.png"},
    {name: "Resist", type: "Cunning Action", suit: "none", description: "Place two non-Scottish followers from the supply into any region that borders a region controlled by the Scots. If there is no control or instability disc in Moray, you may instead place the followers into a region bordering Moray", url: "https://furtivespy.com/images/king/resist.png"},
    {name: "Muster", type: "Cunning Action", suit: "none", description: "Return a Scottish follower to the supply from any region that borders a region controlled by the Scots. Then place two followers from the supply into that region. If there is no control or instability disc in Moray, you may instead carry out this action in a region bordering Moray.", url: "https://furtivespy.com/images/king/muster.png"}, 
    {name: "Quell", type: "Cunning Action", suit: "none", description: "Return a Welsh follower to the supply from any region that borders a region controlled by the Welsh. Then place two followers from the supply into that region. If there is no control or instability disc in Gwynedd, you may instead carry out this action in a region bordering Gwynedd.", url: "https://furtivespy.com/images/king/quell.png"},
    {name: "Suppress", type: "Cunning Action", suit: "none", description: "Return an English follower to the supply from any region that borders a region controlled by the English. Then return another follower to the supply from that region. Then place a follower from the supply into that region. If there is no control or instability disc in Essex, you may instea", url: "https://furtivespy.com/images/king/suppress.png"},
]

const kingPlayer = [
    {name: "Scottish Support", type: "Action", suit: "player", description: "Place two Scottish followers from the supply into a region that borders a region controlled by the Scots. If there is no control or instability disc in Moray, you may instead place the followers into a region bordering Moray", url: "https://furtivespy.com/images/king/scottishsupport.png"},
    {name: "Welsh Support", type: "Action", suit: "player", description: "Place two Welsh followers from the supply into a region that borders a region controlled by the Welsh. If there is no control or instability disc in Gwynedd, you may instead place the followers into a region bordering Gwynedd.", url: "https://furtivespy.com/images/king/welshsupport.png"},
    {name: "English Support", type: "Action", suit: "player", description: "Place two English followers from the supply into a region that borders a region controlled by the English. If there is no control or instability disc in Essex, you may instead place the followers into a region bordering Essex.", url: "https://furtivespy.com/images/king/englishsupport.png"},
    {name: "Assemble", type: "Action", suit: "player", description: "Place a Scottish follower, a Welsh follower, and an English follower from the supply into any region or regions.", url: "https://furtivespy.com/images/king/assemble.png"},
    {name: "Assemble", type: "Action", suit: "player", description: "Place a Scottish follower, a Welsh follower, and an English follower from the supply into any region or regions.", url: "https://furtivespy.com/images/king/assemble.png"},
    {name: "Negotiate", type: "Action", suit: "player", description: "Swap the positions of any two faceup region cards. Place a negotiation disc on one of the cards you swapped.", url: "https://furtivespy.com/images/king/negotiate.png"},
    {name: "Manoeuvre", type: "Action", suit: "player", description: "Swap a follower in any region with a follower in any other region. ", url: "https://furtivespy.com/images/king/manoeuvre.png"},
    {name: "Outmanoeuvre", type: "Action", suit: "player", description: "Swap a follower in any region with two followers in a bordering region.", url: "https://furtivespy.com/images/king/outmanoeuvre.png"},
]

const aloneHunt = [
    {name: "Clone [Target]", type: "Phase 2", suit: "phase2", description: "Consider the Target token as a second Creature token.", url: "https://furtivespy.com/images/notalone/clone.png"},
    {name: "Phobia [Artemia]", type: "Phase 2", suit: "phase2", description: "Force one Hunted to show you all but 2 Places cards from his hand.", url: "https://furtivespy.com/images/notalone/phobia.png"},
    {name: "Ascendancy", type: "Phase 2", suit: "phase2", description: "Force one Hunted to discard all but 2 Place cards from his hand.", url: "https://furtivespy.com/images/notalone/ascendancy.png"},
    {name: "Mutation [Artemia]", type: "Phase 2", suit: "phase2", description: "In addition to its effect, the Artemia token inflicts the loss of 1 Will.", url: "https://furtivespy.com/images/notalone/mutation.png"},
    {name: "Toxin [Target]", type: "Phase 2", suit: "phase2", description: "Each Hunted on the targeted place discards 1 Survival card. The power of the place is ineffective.", url: "https://furtivespy.com/images/notalone/toxin.png"},
    {name: "Force Field [Target]", type: "Phase 1", suit: "phase1", description: "Before the Hunted play, target 2 adjacent places. These places may not be played this turn.", url: "https://furtivespy.com/images/notalone/forcefield.png"},
    {name: "Forbidden Zone", type: "Phase 2", suit: "phase2", description: "All Hunted discard 1 Place card simultaneously.", url: "https://furtivespy.com/images/notalone/forbiddenzone.png"},
    {name: "Cataclysm", type: "Phase 3", suit: "phase3", description: "The place's power of your choice is ineffective.", url: "https://furtivespy.com/images/notalone/cataclysm.png"},
    {name: "Flashback", type: "Phase of the Copied Card", suit: "phase0", description: "Copy the last Hunt card you discarded.", url: "https://furtivespy.com/images/notalone/flashback.png"},
    {name: "Stasis", type: "Phase 4", suit: "phase4", description: "Prevent the Rescue counter from moving forward during this phase.", url: "https://furtivespy.com/images/notalone/stasis.png"},
    {name: "Persecution", type: "Phase 2", suit: "phase2", description: "Each Hunted may only take back 1 Place card when using the power of a Place card.", url: "https://furtivespy.com/images/notalone/persecution.png"},
    {name: "Interference", type: "Phase 2", suit: "phase2", description: "The powers of the Beach and the Wreck are ineffective.", url: "https://furtivespy.com/images/notalone/interference.png"},
    {name: "Despair [Artemia]", type: "Phase 1", suit: "phase1", description: "No Survival card may be played or drawn for the remaining of the turn.", url: "https://furtivespy.com/images/notalone/despair.png"},
    {name: "Virus [Artemia]", type: "Phase 2", suit: "phase2", description: "Target 2 adjacent places. Apply the effects of the Artemia token on both places.", url: "https://furtivespy.com/images/notalone/virus.png"},
    {name: "Scream [Target]", type: "Phase 2", suit: "phase2", description: "Each Hunted on the targeted place must discard 2 Place cards or lose 1 Will.", url: "https://furtivespy.com/images/notalone/scream.png"},
    {name: "Mirage [Target]", type: "Phase 2", suit: "phase2", description: "Target 2 adjacent places. Both are ineffective.", url: "https://furtivespy.com/images/notalone/mirage.png"},
    {name: "Fierceness", type: "Phase 2", suit: "phase2", description: "Hunted caught by the Creature token lose 1 extra Will.", url: "https://furtivespy.com/images/notalone/fierceness.png"},
    {name: "Detour", type: "Phase 3", suit: "phase3", description: "After the Hunted reveal their Place cards, move one Hunted to an adjacent place.", url: "https://furtivespy.com/images/notalone/detour.png"},
    {name: "Anticipation", type: "Phase 2", suit: "phase2", description: "Choose one Hunted. If you catch him with the Creature token, move the Assimilation counter forward 1 extra space.", url: "https://furtivespy.com/images/notalone/anticipation.png"},
    {name: "Tracking", type: "Phase 4", suit: "phase4", description: "Next turn, you may play up to 2 Hunt cards.", url: "https://furtivespy.com/images/notalone/tracking.png"},
]

const aloneSurvive = [
    {name: "Wrong Track", type: "Phase 3", suit: "phase3", description: "Move the Creature token to an adjacent place.", url: "https://furtivespy.com/images/notalone/wrongtrack.png"},
    {name: "Dodge", type: "Phase 3", suit: "phase3", description: "Avoid the effect of the Creature token.", url: "https://furtivespy.com/images/notalone/dodge.png"},
    {name: "Strike Back", type: "Phase 1", suit: "phase1", description: "Take 2 random Hunt cards from the Creature's hand and put them at the bottom of the Hunt deck.", url: "https://furtivespy.com/images/notalone/strikeback.png"},
    {name: "Sixth Sense", type: "Phase 1", suit: "phase1", description: "Take back to your hand 2 Place cards from your discard pile.", url: "https://furtivespy.com/images/notalone/sixthsense.png"},
    {name: "Adrenaline", type: "Phase 1", suit: "phase1", description: "Regain 1 Will.", url: "https://furtivespy.com/images/notalone/adrenaline.png"},
    {name: "Sacrifice", type: "Phase 1", suit: "phase1", description: "Discard 1 Place card. No Hunt card may be played this turn.", url: "https://furtivespy.com/images/notalone/sacrifice.png"},
    {name: "Detector", type: "Phase 3", suit: "phase3", description: "Avoid the effects of the Artemia token.", url: "https://furtivespy.com/images/notalone/detector.png"},
    {name: "Gate", type: "Phase 3", suit: "phase3", description: "Instead of using the power of your Place card, copy the power of an adjacent place.", url: "https://furtivespy.com/images/notalone/gate.png"},
    {name: "Hologram", type: "Phase 3", suit: "phase3", description: "Move the Artemia token to an adjacent place.", url: "https://furtivespy.com/images/notalone/hologram.png"},
    {name: "Amplifier", type: "Phase 4", suit: "phase4", description: "Remove the marker counter from the Beach to immediately move the Rescue counter forward 1 space.", url: "https://furtivespy.com/images/notalone/amplifier.png"},
    {name: "Ingenuity", type: "Phase 1", suit: "phase1", description: "Place the Marker counter on the Beach.", url: "https://furtivespy.com/images/notalone/ingenuity.png"},
    {name: "Smokescreen", type: "Phase 1", suit: "phase1", description: "All the Hunter hide their discarded Place cards until the end of their turn.", url: "https://furtivespy.com/images/notalone/smokescreen.png"},
    {name: "Vortex", type: "Phase 2", suit: "phase2", description: "Swap your played Place card for on Place card from your discard pile.", url: "https://furtivespy.com/images/notalone/vortex.png"},
    {name: "Double Back", type: "Phase 4", suit: "phase4", description: "Take back the Place card you just played.", url: "https://furtivespy.com/images/notalone/doubleback.png"},
    {name: "Drone", type: "Phase 3", suit: "phase3", description: "Instead of using the power of your Place card, copy the power of the Rover.", url: "https://furtivespy.com/images/notalone/drone.png"},
]

const brassBase = [
    {name: "Belper", type: "Location", suit: "a", url: "https://furtivespy.com/images/brass/belper.png"},
    {name: "Derby", type: "Location", suit: "a", url: "https://furtivespy.com/images/brass/derby.png"},
    {name: "Leek", type: "Location", suit: "b", url: "https://furtivespy.com/images/brass/leek.png"},
    {name: "Stoke-on-Trent", type: "Location", suit: "b", url: "https://furtivespy.com/images/brass/stoke.png"},
    {name: "Stone", type: "Location", suit: "b", url: "https://furtivespy.com/images/brass/stone.png"},
    {name: "Uttoxeter", type: "Location", suit: "b", url: "https://furtivespy.com/images/brass/uttoxeter.png"},
    {name: "Stafford", type: "Location", suit: "c", url: "https://furtivespy.com/images/brass/stafford.png"},
    {name: "Burton-on-Trent", type: "Location", suit: "c", url: "https://furtivespy.com/images/brass/burton.png"},
    {name: "Cannock", type: "Location", suit: "c", url: "https://furtivespy.com/images/brass/cannock.png"},
    {name: "Tamworth", type: "Location", suit: "c", url: "https://furtivespy.com/images/brass/tamworth.png"},
    {name: "Walsall", type: "Location", suit: "c", url: "https://furtivespy.com/images/brass/walsall.png"},
    {name: "Coalbrookdale", type: "Location", suit: "d", url: "https://furtivespy.com/images/brass/coalbrookdale.png"},
    {name: "Dudley", type: "Location", suit: "d", url: "https://furtivespy.com/images/brass/dudley.png"},
    {name: "Kidderminster", type: "Location", suit: "d", url: "https://furtivespy.com/images/brass/kidderminster.png"},
    {name: "Wolverhampton", type: "Location", suit: "d", url: "https://furtivespy.com/images/brass/wolverhampton.png"},
    {name: "Worcester", type: "Location", suit: "d", url: "https://furtivespy.com/images/brass/worcester.png"},
    {name: "Birmingham", type: "Location", suit: "e", url: "https://furtivespy.com/images/brass/birmingham.png"},
    {name: "Coventry", type: "Location", suit: "e", url: "https://furtivespy.com/images/brass/coventry.png"},
    {name: "Nuneaton", type: "Location", suit: "e", url: "https://furtivespy.com/images/brass/nuneaton.png"},
    {name: "Reddich", type: "Location", suit: "e", url: "https://furtivespy.com/images/brass/reddich.png"},
    {name: "Iron Works", type: "Industry", suit: "f", url: "https://furtivespy.com/images/brass/iron.png"},
    {name: "Coal Mine", type: "Industry", suit: "f", url: "https://furtivespy.com/images/brass/coal.png"},
    {name: "Manufactured Goods / Cotton Mill", type: "Industry", suit: "f", url: "https://furtivespy.com/images/brass/goods-mill-1.png"},
    {name: "Pottery", type: "Industry", suit: "f", url: "https://furtivespy.com/images/brass/pottery.png"},
    {name: "Brewery", type: "Industry", suit: "f", url: "https://furtivespy.com/images/brass/brewery.png"},

    {name: "Wild Location", type: "Location", suit: "g", url: "https://furtivespy.com/images/brass/wild-location.png"},
    {name: "Wild Industry", type: "Industry", suit: "h", url: "https://furtivespy.com/images/brass/wild-industry.png"},    
]

const brassTwoPlayer = [
    {name: "Stafford", type: "Location", suit: "c", url: "https://furtivespy.com/images/brass/stafford.png"},
    {name: "Stafford", type: "Location", suit: "c", url: "https://furtivespy.com/images/brass/stafford.png"},
    {name: "Burton-on-Trent", type: "Location", suit: "c", url: "https://furtivespy.com/images/brass/burton.png"},
    {name: "Burton-on-Trent", type: "Location", suit: "c", url: "https://furtivespy.com/images/brass/burton.png"},
    {name: "Cannock", type: "Location", suit: "c", url: "https://furtivespy.com/images/brass/cannock.png"},
    {name: "Cannock", type: "Location", suit: "c", url: "https://furtivespy.com/images/brass/cannock.png"},
    {name: "Tamworth", type: "Location", suit: "c", url: "https://furtivespy.com/images/brass/tamworth.png"},
    {name: "Walsall", type: "Location", suit: "c", url: "https://furtivespy.com/images/brass/walsall.png"},
    {name: "Coalbrookdale", type: "Location", suit: "d", url: "https://furtivespy.com/images/brass/coalbrookdale.png"},
    {name: "Coalbrookdale", type: "Location", suit: "d", url: "https://furtivespy.com/images/brass/coalbrookdale.png"},
    {name: "Coalbrookdale", type: "Location", suit: "d", url: "https://furtivespy.com/images/brass/coalbrookdale.png"},
    {name: "Dudley", type: "Location", suit: "d", url: "https://furtivespy.com/images/brass/dudley.png"},
    {name: "Dudley", type: "Location", suit: "d", url: "https://furtivespy.com/images/brass/dudley.png"},
    {name: "Kidderminster", type: "Location", suit: "d", url: "https://furtivespy.com/images/brass/kidderminster.png"},
    {name: "Kidderminster", type: "Location", suit: "d", url: "https://furtivespy.com/images/brass/kidderminster.png"},
    {name: "Wolverhampton", type: "Location", suit: "d", url: "https://furtivespy.com/images/brass/wolverhampton.png"},
    {name: "Wolverhampton", type: "Location", suit: "d", url: "https://furtivespy.com/images/brass/wolverhampton.png"},
    {name: "Worcester", type: "Location", suit: "d", url: "https://furtivespy.com/images/brass/worcester.png"},
    {name: "Worcester", type: "Location", suit: "d", url: "https://furtivespy.com/images/brass/worcester.png"},
    {name: "Birmingham", type: "Location", suit: "e", url: "https://furtivespy.com/images/brass/birmingham.png"},
    {name: "Birmingham", type: "Location", suit: "e", url: "https://furtivespy.com/images/brass/birmingham.png"},
    {name: "Birmingham", type: "Location", suit: "e", url: "https://furtivespy.com/images/brass/birmingham.png"},
    {name: "Coventry", type: "Location", suit: "e", url: "https://furtivespy.com/images/brass/coventry.png"},
    {name: "Coventry", type: "Location", suit: "e", url: "https://furtivespy.com/images/brass/coventry.png"},
    {name: "Coventry", type: "Location", suit: "e", url: "https://furtivespy.com/images/brass/coventry.png"},
    {name: "Nuneaton", type: "Location", suit: "e", url: "https://furtivespy.com/images/brass/nuneaton.png"},
    {name: "Reddich", type: "Location", suit: "e", url: "https://furtivespy.com/images/brass/reddich.png"},
    {name: "Iron Works", type: "Industry", suit: "f", url: "https://furtivespy.com/images/brass/iron.png"},
    {name: "Iron Works", type: "Industry", suit: "f", url: "https://furtivespy.com/images/brass/iron.png"},
    {name: "Iron Works", type: "Industry", suit: "f", url: "https://furtivespy.com/images/brass/iron.png"},
    {name: "Iron Works", type: "Industry", suit: "f", url: "https://furtivespy.com/images/brass/iron.png"},
    {name: "Coal Mine", type: "Industry", suit: "f", url: "https://furtivespy.com/images/brass/coal.png"},
    {name: "Coal Mine", type: "Industry", suit: "f", url: "https://furtivespy.com/images/brass/coal.png"},
    {name: "Pottery", type: "Industry", suit: "f", url: "https://furtivespy.com/images/brass/pottery.png"},
    {name: "Pottery", type: "Industry", suit: "f", url: "https://furtivespy.com/images/brass/pottery.png"},
    {name: "Brewery", type: "Industry", suit: "f", url: "https://furtivespy.com/images/brass/brewery.png"},
    {name: "Brewery", type: "Industry", suit: "f", url: "https://furtivespy.com/images/brass/brewery.png"},
    {name: "Brewery", type: "Industry", suit: "f", url: "https://furtivespy.com/images/brass/brewery.png"},
    {name: "Brewery", type: "Industry", suit: "f", url: "https://furtivespy.com/images/brass/brewery.png"},
    {name: "Brewery", type: "Industry", suit: "f", url: "https://furtivespy.com/images/brass/brewery.png"},
]

const brassThreePlayer = [
    {name: "Leek", type: "Location", suit: "b", url: "https://furtivespy.com/images/brass/leek.png"},
    {name: "Leek", type: "Location", suit: "b", url: "https://furtivespy.com/images/brass/leek.png"},
    {name: "Stoke-on-Trent", type: "Location", suit: "b", url: "https://furtivespy.com/images/brass/stoke.png"},
    {name: "Stoke-on-Trent", type: "Location", suit: "b", url: "https://furtivespy.com/images/brass/stoke.png"},
    {name: "Stoke-on-Trent", type: "Location", suit: "b", url: "https://furtivespy.com/images/brass/stoke.png"},
    {name: "Stone", type: "Location", suit: "b", url: "https://furtivespy.com/images/brass/stone.png"},
    {name: "Stone", type: "Location", suit: "b", url: "https://furtivespy.com/images/brass/stone.png"},
    {name: "Uttoxeter", type: "Location", suit: "b", url: "https://furtivespy.com/images/brass/uttoxeter.png"},
    {name: "Stafford", type: "Location", suit: "c", url: "https://furtivespy.com/images/brass/stafford.png"},
    {name: "Stafford", type: "Location", suit: "c", url: "https://furtivespy.com/images/brass/stafford.png"},
    {name: "Burton-on-Trent", type: "Location", suit: "c", url: "https://furtivespy.com/images/brass/burton.png"},
    {name: "Burton-on-Trent", type: "Location", suit: "c", url: "https://furtivespy.com/images/brass/burton.png"},
    {name: "Cannock", type: "Location", suit: "c", url: "https://furtivespy.com/images/brass/cannock.png"},
    {name: "Cannock", type: "Location", suit: "c", url: "https://furtivespy.com/images/brass/cannock.png"},
    {name: "Tamworth", type: "Location", suit: "c", url: "https://furtivespy.com/images/brass/tamworth.png"},
    {name: "Walsall", type: "Location", suit: "c", url: "https://furtivespy.com/images/brass/walsall.png"},
    {name: "Coalbrookdale", type: "Location", suit: "d", url: "https://furtivespy.com/images/brass/coalbrookdale.png"},
    {name: "Coalbrookdale", type: "Location", suit: "d", url: "https://furtivespy.com/images/brass/coalbrookdale.png"},
    {name: "Coalbrookdale", type: "Location", suit: "d", url: "https://furtivespy.com/images/brass/coalbrookdale.png"},
    {name: "Dudley", type: "Location", suit: "d", url: "https://furtivespy.com/images/brass/dudley.png"},
    {name: "Dudley", type: "Location", suit: "d", url: "https://furtivespy.com/images/brass/dudley.png"},
    {name: "Kidderminster", type: "Location", suit: "d", url: "https://furtivespy.com/images/brass/kidderminster.png"},
    {name: "Kidderminster", type: "Location", suit: "d", url: "https://furtivespy.com/images/brass/kidderminster.png"},
    {name: "Wolverhampton", type: "Location", suit: "d", url: "https://furtivespy.com/images/brass/wolverhampton.png"},
    {name: "Wolverhampton", type: "Location", suit: "d", url: "https://furtivespy.com/images/brass/wolverhampton.png"},
    {name: "Worcester", type: "Location", suit: "d", url: "https://furtivespy.com/images/brass/worcester.png"},
    {name: "Worcester", type: "Location", suit: "d", url: "https://furtivespy.com/images/brass/worcester.png"},
    {name: "Birmingham", type: "Location", suit: "e", url: "https://furtivespy.com/images/brass/birmingham.png"},
    {name: "Birmingham", type: "Location", suit: "e", url: "https://furtivespy.com/images/brass/birmingham.png"},
    {name: "Birmingham", type: "Location", suit: "e", url: "https://furtivespy.com/images/brass/birmingham.png"},
    {name: "Coventry", type: "Location", suit: "e", url: "https://furtivespy.com/images/brass/coventry.png"},
    {name: "Coventry", type: "Location", suit: "e", url: "https://furtivespy.com/images/brass/coventry.png"},
    {name: "Coventry", type: "Location", suit: "e", url: "https://furtivespy.com/images/brass/coventry.png"},
    {name: "Nuneaton", type: "Location", suit: "e", url: "https://furtivespy.com/images/brass/nuneaton.png"},
    {name: "Reddich", type: "Location", suit: "e", url: "https://furtivespy.com/images/brass/reddich.png"},
    {name: "Iron Works", type: "Industry", suit: "f", url: "https://furtivespy.com/images/brass/iron.png"},
    {name: "Iron Works", type: "Industry", suit: "f", url: "https://furtivespy.com/images/brass/iron.png"},
    {name: "Iron Works", type: "Industry", suit: "f", url: "https://furtivespy.com/images/brass/iron.png"},
    {name: "Iron Works", type: "Industry", suit: "f", url: "https://furtivespy.com/images/brass/iron.png"},
    {name: "Coal Mine", type: "Industry", suit: "f", url: "https://furtivespy.com/images/brass/coal.png"},
    {name: "Coal Mine", type: "Industry", suit: "f", url: "https://furtivespy.com/images/brass/coal.png"},
    {name: "Manufactured Goods / Cotton Mill", type: "Industry", suit: "f", url: "https://furtivespy.com/images/brass/goods-mill-1.png"},
    {name: "Manufactured Goods / Cotton Mill", type: "Industry", suit: "f", url: "https://furtivespy.com/images/brass/goods-mill-2.png"},
    {name: "Manufactured Goods / Cotton Mill", type: "Industry", suit: "f", url: "https://furtivespy.com/images/brass/goods-mill-3.png"},
    {name: "Manufactured Goods / Cotton Mill", type: "Industry", suit: "f", url: "https://furtivespy.com/images/brass/goods-mill-1.png"},
    {name: "Manufactured Goods / Cotton Mill", type: "Industry", suit: "f", url: "https://furtivespy.com/images/brass/goods-mill-2.png"},
    {name: "Manufactured Goods / Cotton Mill", type: "Industry", suit: "f", url: "https://furtivespy.com/images/brass/goods-mill-3.png"},
    {name: "Pottery", type: "Industry", suit: "f", url: "https://furtivespy.com/images/brass/pottery.png"},
    {name: "Pottery", type: "Industry", suit: "f", url: "https://furtivespy.com/images/brass/pottery.png"},
    {name: "Brewery", type: "Industry", suit: "f", url: "https://furtivespy.com/images/brass/brewery.png"},
    {name: "Brewery", type: "Industry", suit: "f", url: "https://furtivespy.com/images/brass/brewery.png"},
    {name: "Brewery", type: "Industry", suit: "f", url: "https://furtivespy.com/images/brass/brewery.png"},
    {name: "Brewery", type: "Industry", suit: "f", url: "https://furtivespy.com/images/brass/brewery.png"},
    {name: "Brewery", type: "Industry", suit: "f", url: "https://furtivespy.com/images/brass/brewery.png"},
]

const brassFourPlayer = [
    {name: "Belper", type: "Location", suit: "a", url: "https://furtivespy.com/images/brass/belper.png"},
    {name: "Belper", type: "Location", suit: "a", url: "https://furtivespy.com/images/brass/belper.png"},
    {name: "Derby", type: "Location", suit: "a", url: "https://furtivespy.com/images/brass/derby.png"},
    {name: "Derby", type: "Location", suit: "a", url: "https://furtivespy.com/images/brass/derby.png"},
    {name: "Derby", type: "Location", suit: "a", url: "https://furtivespy.com/images/brass/derby.png"},
    {name: "Leek", type: "Location", suit: "b", url: "https://furtivespy.com/images/brass/leek.png"},
    {name: "Leek", type: "Location", suit: "b", url: "https://furtivespy.com/images/brass/leek.png"},
    {name: "Stoke-on-Trent", type: "Location", suit: "b", url: "https://furtivespy.com/images/brass/stoke.png"},
    {name: "Stoke-on-Trent", type: "Location", suit: "b", url: "https://furtivespy.com/images/brass/stoke.png"},
    {name: "Stoke-on-Trent", type: "Location", suit: "b", url: "https://furtivespy.com/images/brass/stoke.png"},
    {name: "Stone", type: "Location", suit: "b", url: "https://furtivespy.com/images/brass/stone.png"},
    {name: "Stone", type: "Location", suit: "b", url: "https://furtivespy.com/images/brass/stone.png"},
    {name: "Uttoxeter", type: "Location", suit: "b", url: "https://furtivespy.com/images/brass/uttoxeter.png"},
    {name: "Uttoxeter", type: "Location", suit: "b", url: "https://furtivespy.com/images/brass/uttoxeter.png"},
    {name: "Stafford", type: "Location", suit: "c", url: "https://furtivespy.com/images/brass/stafford.png"},
    {name: "Stafford", type: "Location", suit: "c", url: "https://furtivespy.com/images/brass/stafford.png"},
    {name: "Burton-on-Trent", type: "Location", suit: "c", url: "https://furtivespy.com/images/brass/burton.png"},
    {name: "Burton-on-Trent", type: "Location", suit: "c", url: "https://furtivespy.com/images/brass/burton.png"},
    {name: "Cannock", type: "Location", suit: "c", url: "https://furtivespy.com/images/brass/cannock.png"},
    {name: "Cannock", type: "Location", suit: "c", url: "https://furtivespy.com/images/brass/cannock.png"},
    {name: "Tamworth", type: "Location", suit: "c", url: "https://furtivespy.com/images/brass/tamworth.png"},
    {name: "Walsall", type: "Location", suit: "c", url: "https://furtivespy.com/images/brass/walsall.png"},
    {name: "Coalbrookdale", type: "Location", suit: "d", url: "https://furtivespy.com/images/brass/coalbrookdale.png"},
    {name: "Coalbrookdale", type: "Location", suit: "d", url: "https://furtivespy.com/images/brass/coalbrookdale.png"},
    {name: "Coalbrookdale", type: "Location", suit: "d", url: "https://furtivespy.com/images/brass/coalbrookdale.png"},
    {name: "Dudley", type: "Location", suit: "d", url: "https://furtivespy.com/images/brass/dudley.png"},
    {name: "Dudley", type: "Location", suit: "d", url: "https://furtivespy.com/images/brass/dudley.png"},
    {name: "Kidderminster", type: "Location", suit: "d", url: "https://furtivespy.com/images/brass/kidderminster.png"},
    {name: "Kidderminster", type: "Location", suit: "d", url: "https://furtivespy.com/images/brass/kidderminster.png"},
    {name: "Wolverhampton", type: "Location", suit: "d", url: "https://furtivespy.com/images/brass/wolverhampton.png"},
    {name: "Wolverhampton", type: "Location", suit: "d", url: "https://furtivespy.com/images/brass/wolverhampton.png"},
    {name: "Worcester", type: "Location", suit: "d", url: "https://furtivespy.com/images/brass/worcester.png"},
    {name: "Worcester", type: "Location", suit: "d", url: "https://furtivespy.com/images/brass/worcester.png"},
    {name: "Birmingham", type: "Location", suit: "e", url: "https://furtivespy.com/images/brass/birmingham.png"},
    {name: "Birmingham", type: "Location", suit: "e", url: "https://furtivespy.com/images/brass/birmingham.png"},
    {name: "Birmingham", type: "Location", suit: "e", url: "https://furtivespy.com/images/brass/birmingham.png"},
    {name: "Coventry", type: "Location", suit: "e", url: "https://furtivespy.com/images/brass/coventry.png"},
    {name: "Coventry", type: "Location", suit: "e", url: "https://furtivespy.com/images/brass/coventry.png"},
    {name: "Coventry", type: "Location", suit: "e", url: "https://furtivespy.com/images/brass/coventry.png"},
    {name: "Nuneaton", type: "Location", suit: "e", url: "https://furtivespy.com/images/brass/nuneaton.png"},
    {name: "Reddich", type: "Location", suit: "e", url: "https://furtivespy.com/images/brass/reddich.png"},
    {name: "Iron Works", type: "Industry", suit: "f", url: "https://furtivespy.com/images/brass/iron.png"},
    {name: "Iron Works", type: "Industry", suit: "f", url: "https://furtivespy.com/images/brass/iron.png"},
    {name: "Iron Works", type: "Industry", suit: "f", url: "https://furtivespy.com/images/brass/iron.png"},
    {name: "Iron Works", type: "Industry", suit: "f", url: "https://furtivespy.com/images/brass/iron.png"},
    {name: "Coal Mine", type: "Industry", suit: "f", url: "https://furtivespy.com/images/brass/coal.png"},
    {name: "Coal Mine", type: "Industry", suit: "f", url: "https://furtivespy.com/images/brass/coal.png"},
    {name: "Coal Mine", type: "Industry", suit: "f", url: "https://furtivespy.com/images/brass/coal.png"},
    {name: "Manufactured Goods / Cotton Mill", type: "Industry", suit: "f", url: "https://furtivespy.com/images/brass/goods-mill-1.png"},
    {name: "Manufactured Goods / Cotton Mill", type: "Industry", suit: "f", url: "https://furtivespy.com/images/brass/goods-mill-1.png"},
    {name: "Manufactured Goods / Cotton Mill", type: "Industry", suit: "f", url: "https://furtivespy.com/images/brass/goods-mill-2.png"},
    {name: "Manufactured Goods / Cotton Mill", type: "Industry", suit: "f", url: "https://furtivespy.com/images/brass/goods-mill-2.png"},
    {name: "Manufactured Goods / Cotton Mill", type: "Industry", suit: "f", url: "https://furtivespy.com/images/brass/goods-mill-3.png"},
    {name: "Manufactured Goods / Cotton Mill", type: "Industry", suit: "f", url: "https://furtivespy.com/images/brass/goods-mill-1.png"},
    {name: "Manufactured Goods / Cotton Mill", type: "Industry", suit: "f", url: "https://furtivespy.com/images/brass/goods-mill-2.png"},
    {name: "Manufactured Goods / Cotton Mill", type: "Industry", suit: "f", url: "https://furtivespy.com/images/brass/goods-mill-3.png"},
    {name: "Pottery", type: "Industry", suit: "f", url: "https://furtivespy.com/images/brass/pottery.png"},
    {name: "Pottery", type: "Industry", suit: "f", url: "https://furtivespy.com/images/brass/pottery.png"},
    {name: "Pottery", type: "Industry", suit: "f", url: "https://furtivespy.com/images/brass/pottery.png"},
    {name: "Brewery", type: "Industry", suit: "f", url: "https://furtivespy.com/images/brass/brewery.png"},
    {name: "Brewery", type: "Industry", suit: "f", url: "https://furtivespy.com/images/brass/brewery.png"},
    {name: "Brewery", type: "Industry", suit: "f", url: "https://furtivespy.com/images/brass/brewery.png"},
    {name: "Brewery", type: "Industry", suit: "f", url: "https://furtivespy.com/images/brass/brewery.png"},
    {name: "Brewery", type: "Industry", suit: "f", url: "https://furtivespy.com/images/brass/brewery.png"},
]

const brassWildLocation = [
    {name: "Wild Location", type: "Location", suit: "g", url: "https://furtivespy.com/images/brass/wild-location.png"},
    {name: "Wild Location", type: "Location", suit: "g", url: "https://furtivespy.com/images/brass/wild-location.png"},
    {name: "Wild Location", type: "Location", suit: "g", url: "https://furtivespy.com/images/brass/wild-location.png"},
    {name: "Wild Location", type: "Location", suit: "g", url: "https://furtivespy.com/images/brass/wild-location.png"},
    {name: "Wild Location", type: "Location", suit: "g", url: "https://furtivespy.com/images/brass/wild-location.png"},
    {name: "Wild Location", type: "Location", suit: "g", url: "https://furtivespy.com/images/brass/wild-location.png"},
    {name: "Wild Location", type: "Location", suit: "g", url: "https://furtivespy.com/images/brass/wild-location.png"},
    {name: "Wild Location", type: "Location", suit: "g", url: "https://furtivespy.com/images/brass/wild-location.png"},
    {name: "Wild Location", type: "Location", suit: "g", url: "https://furtivespy.com/images/brass/wild-location.png"},
    {name: "Wild Location", type: "Location", suit: "g", url: "https://furtivespy.com/images/brass/wild-location.png"},
]

const brassWildIndustry = [
    {name: "Wild Industry", type: "Industry", suit: "h", url: "https://furtivespy.com/images/brass/wild-industry.png"},    
    {name: "Wild Industry", type: "Industry", suit: "h", url: "https://furtivespy.com/images/brass/wild-industry.png"},    
    {name: "Wild Industry", type: "Industry", suit: "h", url: "https://furtivespy.com/images/brass/wild-industry.png"},    
    {name: "Wild Industry", type: "Industry", suit: "h", url: "https://furtivespy.com/images/brass/wild-industry.png"},    
    {name: "Wild Industry", type: "Industry", suit: "h", url: "https://furtivespy.com/images/brass/wild-industry.png"},    
    {name: "Wild Industry", type: "Industry", suit: "h", url: "https://furtivespy.com/images/brass/wild-industry.png"},    
    {name: "Wild Industry", type: "Industry", suit: "h", url: "https://furtivespy.com/images/brass/wild-industry.png"},    
    {name: "Wild Industry", type: "Industry", suit: "h", url: "https://furtivespy.com/images/brass/wild-industry.png"},    
    {name: "Wild Industry", type: "Industry", suit: "h", url: "https://furtivespy.com/images/brass/wild-industry.png"},    
    {name: "Wild Industry", type: "Industry", suit: "h", url: "https://furtivespy.com/images/brass/wild-industry.png"},    
]

const blueMoonCity = [
    {name: "2", type: "Aqua 🔵", suit: "aqua", value: 2, url: "https://furtivespy.com/images/bluemoon/aqua_0_0.png"},
    {name: "1", type: "Aqua 🔵", suit: "aqua", value: 1, url: "https://furtivespy.com/images/bluemoon/aqua_0_1.png"},
    {name: "1", type: "Aqua 🔵", suit: "aqua", value: 1, url: "https://furtivespy.com/images/bluemoon/aqua_0_2.png"},
    {name: "1", type: "Aqua 🔵", suit: "aqua", value: 1, url: "https://furtivespy.com/images/bluemoon/aqua_0_3.png"},
    {name: "1", type: "Aqua 🔵", suit: "aqua", value: 1, url: "https://furtivespy.com/images/bluemoon/aqua_0_4.png"},
    {name: "3", type: "Aqua 🔵", suit: "aqua", value: 3, url: "https://furtivespy.com/images/bluemoon/aqua_1_0.png"},
    {name: "3", type: "Aqua 🔵", suit: "aqua", value: 3, url: "https://furtivespy.com/images/bluemoon/aqua_1_1.png"},
    {name: "2", type: "Aqua 🔵", suit: "aqua", value: 2, url: "https://furtivespy.com/images/bluemoon/aqua_1_2.png"},
    {name: "2", type: "Aqua 🔵", suit: "aqua", value: 2, url: "https://furtivespy.com/images/bluemoon/aqua_1_3.png"},
    {name: "2", type: "Aqua 🔵", suit: "aqua", value: 2, url: "https://furtivespy.com/images/bluemoon/aqua_1_4.png"},

    {name: "2", type: "Flit 🥈", suit: "flit", value: 2, url: "https://furtivespy.com/images/bluemoon/flit_0_0.png"},
    {name: "1", type: "Flit 🥈", suit: "flit", value: 1, url: "https://furtivespy.com/images/bluemoon/flit_0_1.png"},
    {name: "1", type: "Flit 🥈", suit: "flit", value: 1, url: "https://furtivespy.com/images/bluemoon/flit_0_2.png"},
    {name: "1", type: "Flit 🥈", suit: "flit", value: 1, url: "https://furtivespy.com/images/bluemoon/flit_0_3.png"},
    {name: "1", type: "Flit 🥈", suit: "flit", value: 1, url: "https://furtivespy.com/images/bluemoon/flit_0_4.png"},
    {name: "3", type: "Flit 🥈", suit: "flit", value: 3, url: "https://furtivespy.com/images/bluemoon/flit_1_0.png"},
    {name: "3", type: "Flit 🥈", suit: "flit", value: 3, url: "https://furtivespy.com/images/bluemoon/flit_1_1.png"},
    {name: "2", type: "Flit 🥈", suit: "flit", value: 2, url: "https://furtivespy.com/images/bluemoon/flit_1_2.png"},
    {name: "2", type: "Flit 🥈", suit: "flit", value: 2, url: "https://furtivespy.com/images/bluemoon/flit_1_3.png"},
    {name: "2", type: "Flit 🥈", suit: "flit", value: 2, url: "https://furtivespy.com/images/bluemoon/flit_1_4.png"},

    {name: "2", type: "Hoax ⚪", suit: "hoax", value: 2, url: "https://furtivespy.com/images/bluemoon/hoax_0_0.png"},
    {name: "1", type: "Hoax ⚪", suit: "hoax", value: 1, url: "https://furtivespy.com/images/bluemoon/hoax_0_1.png"},
    {name: "1", type: "Hoax ⚪", suit: "hoax", value: 1, url: "https://furtivespy.com/images/bluemoon/hoax_0_2.png"},
    {name: "1", type: "Hoax ⚪", suit: "hoax", value: 1, url: "https://furtivespy.com/images/bluemoon/hoax_0_3.png"},
    {name: "1", type: "Hoax ⚪", suit: "hoax", value: 1, url: "https://furtivespy.com/images/bluemoon/hoax_0_4.png"},
    {name: "3", type: "Hoax ⚪", suit: "hoax", value: 3, url: "https://furtivespy.com/images/bluemoon/hoax_1_0.png"},
    {name: "3", type: "Hoax ⚪", suit: "hoax", value: 3, url: "https://furtivespy.com/images/bluemoon/hoax_1_1.png"},
    {name: "2", type: "Hoax ⚪", suit: "hoax", value: 2, url: "https://furtivespy.com/images/bluemoon/hoax_1_2.png"},
    {name: "2", type: "Hoax ⚪", suit: "hoax", value: 2, url: "https://furtivespy.com/images/bluemoon/hoax_1_3.png"},
    {name: "2", type: "Hoax ⚪", suit: "hoax", value: 2, url: "https://furtivespy.com/images/bluemoon/hoax_1_4.png"},

    {name: "2", type: "Mimix 🟤", suit: "mimix", value: 2, url: "https://furtivespy.com/images/bluemoon/mimix_0_0.png"},
    {name: "1", type: "Mimix 🟤", suit: "mimix", value: 1, url: "https://furtivespy.com/images/bluemoon/mimix_0_1.png"},
    {name: "1", type: "Mimix 🟤", suit: "mimix", value: 1, url: "https://furtivespy.com/images/bluemoon/mimix_0_2.png"},
    {name: "1", type: "Mimix 🟤", suit: "mimix", value: 1, url: "https://furtivespy.com/images/bluemoon/mimix_0_3.png"},
    {name: "1", type: "Mimix 🟤", suit: "mimix", value: 1, url: "https://furtivespy.com/images/bluemoon/mimix_0_4.png"},
    {name: "3", type: "Mimix 🟤", suit: "mimix", value: 3, url: "https://furtivespy.com/images/bluemoon/mimix_1_0.png"},
    {name: "3", type: "Mimix 🟤", suit: "mimix", value: 3, url: "https://furtivespy.com/images/bluemoon/mimix_1_1.png"},
    {name: "2", type: "Mimix 🟤", suit: "mimix", value: 2, url: "https://furtivespy.com/images/bluemoon/mimix_1_2.png"},
    {name: "2", type: "Mimix 🟤", suit: "mimix", value: 2, url: "https://furtivespy.com/images/bluemoon/mimix_1_3.png"},
    {name: "2", type: "Mimix 🟤", suit: "mimix", value: 2, url: "https://furtivespy.com/images/bluemoon/mimix_1_4.png"},

    {name: "2", type: "Pillar 🟡", suit: "pillar", value: 2, url: "https://furtivespy.com/images/bluemoon/pillar_0_0.png"},
    {name: "1", type: "Pillar 🟡", suit: "pillar", value: 1, url: "https://furtivespy.com/images/bluemoon/pillar_0_1.png"},
    {name: "1", type: "Pillar 🟡", suit: "pillar", value: 1, url: "https://furtivespy.com/images/bluemoon/pillar_0_2.png"},
    {name: "1", type: "Pillar 🟡", suit: "pillar", value: 1, url: "https://furtivespy.com/images/bluemoon/pillar_0_3.png"},
    {name: "1", type: "Pillar 🟡", suit: "pillar", value: 1, url: "https://furtivespy.com/images/bluemoon/pillar_0_4.png"},
    {name: "3", type: "Pillar 🟡", suit: "pillar", value: 3, url: "https://furtivespy.com/images/bluemoon/pillar_1_0.png"},
    {name: "3", type: "Pillar 🟡", suit: "pillar", value: 3, url: "https://furtivespy.com/images/bluemoon/pillar_1_1.png"},
    {name: "2", type: "Pillar 🟡", suit: "pillar", value: 2, url: "https://furtivespy.com/images/bluemoon/pillar_1_2.png"},
    {name: "2", type: "Pillar 🟡", suit: "pillar", value: 2, url: "https://furtivespy.com/images/bluemoon/pillar_1_3.png"},
    {name: "2", type: "Pillar 🟡", suit: "pillar", value: 2, url: "https://furtivespy.com/images/bluemoon/pillar_1_4.png"},

    {name: "2", type: "Terrah 🔴", suit: "terrah", value: 2, url: "https://furtivespy.com/images/bluemoon/terrah_0_0.png"},
    {name: "1", type: "Terrah 🔴", suit: "terrah", value: 1, url: "https://furtivespy.com/images/bluemoon/terrah_0_1.png"},
    {name: "1", type: "Terrah 🔴", suit: "terrah", value: 1, url: "https://furtivespy.com/images/bluemoon/terrah_0_2.png"},
    {name: "1", type: "Terrah 🔴", suit: "terrah", value: 1, url: "https://furtivespy.com/images/bluemoon/terrah_0_3.png"},
    {name: "1", type: "Terrah 🔴", suit: "terrah", value: 1, url: "https://furtivespy.com/images/bluemoon/terrah_0_4.png"},
    {name: "3", type: "Terrah 🔴", suit: "terrah", value: 3, url: "https://furtivespy.com/images/bluemoon/terrah_1_0.png"},
    {name: "3", type: "Terrah 🔴", suit: "terrah", value: 3, url: "https://furtivespy.com/images/bluemoon/terrah_1_1.png"},
    {name: "2", type: "Terrah 🔴", suit: "terrah", value: 2, url: "https://furtivespy.com/images/bluemoon/terrah_1_2.png"},
    {name: "2", type: "Terrah 🔴", suit: "terrah", value: 2, url: "https://furtivespy.com/images/bluemoon/terrah_1_3.png"},
    {name: "2", type: "Terrah 🔴", suit: "terrah", value: 2, url: "https://furtivespy.com/images/bluemoon/terrah_1_4.png"},

    {name: "2", type: "Vulca ⚫", suit: "vulca", value: 2, url: "https://furtivespy.com/images/bluemoon/vulca_0_0.png"},
    {name: "1", type: "Vulca ⚫", suit: "vulca", value: 1, url: "https://furtivespy.com/images/bluemoon/vulca_0_1.png"},
    {name: "1", type: "Vulca ⚫", suit: "vulca", value: 1, url: "https://furtivespy.com/images/bluemoon/vulca_0_2.png"},
    {name: "1", type: "Vulca ⚫", suit: "vulca", value: 1, url: "https://furtivespy.com/images/bluemoon/vulca_0_3.png"},
    {name: "1", type: "Vulca ⚫", suit: "vulca", value: 1, url: "https://furtivespy.com/images/bluemoon/vulca_0_4.png"},
    {name: "3", type: "Vulca ⚫", suit: "vulca", value: 3, url: "https://furtivespy.com/images/bluemoon/vulca_1_0.png"},
    {name: "3", type: "Vulca ⚫", suit: "vulca", value: 3, url: "https://furtivespy.com/images/bluemoon/vulca_1_1.png"},
    {name: "2", type: "Vulca ⚫", suit: "vulca", value: 2, url: "https://furtivespy.com/images/bluemoon/vulca_1_2.png"},
    {name: "2", type: "Vulca ⚫", suit: "vulca", value: 2, url: "https://furtivespy.com/images/bluemoon/vulca_1_3.png"},
    {name: "2", type: "Vulca ⚫", suit: "vulca", value: 2, url: "https://furtivespy.com/images/bluemoon/vulca_1_4.png"},

    {name: "1", type: "Khind 🟢", suit: "khind", value: 1, url: "https://furtivespy.com/images/bluemoon/khind_0_0.png"},
    {name: "1", type: "Khind 🟢", suit: "khind", value: 1, url: "https://furtivespy.com/images/bluemoon/khind_0_1.png"},
    {name: "1", type: "Khind 🟢", suit: "khind", value: 1, url: "https://furtivespy.com/images/bluemoon/khind_0_2.png"},
    {name: "1", type: "Khind 🟢", suit: "khind", value: 1, url: "https://furtivespy.com/images/bluemoon/khind_0_3.png"},
    {name: "1", type: "Khind 🟢", suit: "khind", value: 1, url: "https://furtivespy.com/images/bluemoon/khind_0_4.png"},
    {name: "1", type: "Khind 🟢", suit: "khind", value: 1, url: "https://furtivespy.com/images/bluemoon/khind_1_0.png"},
    {name: "1", type: "Khind 🟢", suit: "khind", value: 1, url: "https://furtivespy.com/images/bluemoon/khind_1_1.png"},
    {name: "1", type: "Khind 🟢", suit: "khind", value: 1, url: "https://furtivespy.com/images/bluemoon/khind_1_2.png"},
    {name: "1", type: "Khind 🟢", suit: "khind", value: 1, url: "https://furtivespy.com/images/bluemoon/khind_1_3.png"},
    {name: "1", type: "Khind 🟢", suit: "khind", value: 1, url: "https://furtivespy.com/images/bluemoon/khind_1_4.png"},
]

const guildExplore = [
    {name: "Era I, Era II, or Era III", type: "Explore", suit: "none", url: "https://furtivespy.com/images/guild/explore_0_1.png"},
    {name: "1 Mountain Space", type: "Explore", suit: "none", url: "https://furtivespy.com/images/guild/explore_0_2.png"},
    {name: "2 Desert Spaces", type: "Explore", suit: "none", url: "https://furtivespy.com/images/guild/explore_0_3.png"},
    {name: "2 Grassland Spaces", type: "Explore", suit: "none", url: "https://furtivespy.com/images/guild/explore_0_4.png"},
    {name: "Any 2 Adjacent Spaces", type: "Explore", suit: "none", url: "https://furtivespy.com/images/guild/explore_0_5.png"},
    {name: "3 Sea Spaces (In a Straight Line)", type: "Explore", suit: "none", url: "https://furtivespy.com/images/guild/explore_1_0.png"},
    {name: "Era I", type: "Explore", suit: "none", url: "https://furtivespy.com/images/guild/explore_1_1.png"},
    {name: "Era II", type: "Explore", suit: "none", url: "https://furtivespy.com/images/guild/explore_1_2.png"},
    {name: "Era III", type: "Explore", suit: "none", url: "https://furtivespy.com/images/guild/explore_1_3.png"},
]

const qeIndustry = [
    {name: "Agriculture", type: "Industry", suit: "none", url: "https://furtivespy.com/images/qe/agriculture.jpg"},
    {name: "Housing", type: "Industry", suit: "none", url: "https://furtivespy.com/images/qe/housing.jpg"},
    {name: "Government", type: "Industry", suit: "none", url: "https://furtivespy.com/images/qe/government.jpg"},
    {name: "Finance", type: "Industry", suit: "none", url: "https://furtivespy.com/images/qe/finance.jpg"},
    {name: "Manufacturing", type: "Industry", suit: "none", url: "https://furtivespy.com/images/qe/manufacturing.jpg"},
]

const qeCompany3 = [
    {name: "Agriculture - 2", type: "CN", suit: "CN", url: "https://furtivespy.com/images/qe/CN-a.jpg"},
    {name: "Finance - 4", type: "CN", suit: "CN", url: "https://furtivespy.com/images/qe/CN-f.jpg"},
    {name: "Housing - 3", type: "CN", suit: "CN", url: "https://furtivespy.com/images/qe/CN-h.jpg"},
    {name: "Manufacturing - 1", type: "CN", suit: "CN", url: "https://furtivespy.com/images/qe/CN-m.jpg"},
    {name: "Agriculture - 1", type: "EU", suit: "EU", url: "https://furtivespy.com/images/qe/EU-a.jpg"},
    {name: "Finance - 3", type: "EU", suit: "EU", url: "https://furtivespy.com/images/qe/EU-f.jpg"},
    {name: "Housing - 2", type: "EU", suit: "EU", url: "https://furtivespy.com/images/qe/EU-h.jpg"},
    {name: "Manufacturing - 4", type: "EU", suit: "EU", url: "https://furtivespy.com/images/qe/EU-m.jpg"},
    {name: "Agriculture - 3", type: "JP", suit: "JP", url: "https://furtivespy.com/images/qe/JP-a.jpg"},
    {name: "Finance - 1", type: "JP", suit: "JP", url: "https://furtivespy.com/images/qe/JP-f.jpg"},
    {name: "Housing - 4", type: "JP", suit: "JP", url: "https://furtivespy.com/images/qe/JP-h.jpg"},
    {name: "Manufacturing - 2", type: "JP", suit: "JP", url: "https://furtivespy.com/images/qe/JP-m.jpg"},
    {name: "Agriculture - 4", type: "US", suit: "US", url: "https://furtivespy.com/images/qe/US-a.jpg"},
    {name: "Finance - 2", type: "US", suit: "US", url: "https://furtivespy.com/images/qe/US-f.jpg"},
    {name: "Housing - 1", type: "US", suit: "US", url: "https://furtivespy.com/images/qe/US-h.jpg"},
    {name: "Manufacturing - 3", type: "US", suit: "US", url: "https://furtivespy.com/images/qe/US-m.jpg"},
]

const qeCompany5 = [
    {name: "Agriculture - 2", type: "CN", suit: "CN", url: "https://furtivespy.com/images/qe/CN-a.jpg"},
    {name: "Housing - 3", type: "CN", suit: "CN", url: "https://furtivespy.com/images/qe/CN-h.jpg"},
    {name: "Government - 4", type: "CN", suit: "CN", url: "https://furtivespy.com/images/qe/CN-g.jpg"},
    {name: "Finance - 3", type: "EU", suit: "EU", url: "https://furtivespy.com/images/qe/EU-f.jpg"},
    {name: "Housing - 2", type: "EU", suit: "EU", url: "https://furtivespy.com/images/qe/EU-h.jpg"},
    {name: "Manufacturing - 4", type: "EU", suit: "EU", url: "https://furtivespy.com/images/qe/EU-m.jpg"},
    {name: "Housing - 4", type: "JP", suit: "JP", url: "https://furtivespy.com/images/qe/JP-h.jpg"},
    {name: "Manufacturing - 2", type: "JP", suit: "JP", url: "https://furtivespy.com/images/qe/JP-m.jpg"},
    {name: "Government - 3", type: "JP", suit: "JP", url: "https://furtivespy.com/images/qe/JP-g.jpg"},
    {name: "Agriculture - 3", type: "UK", suit: "UK", url: "https://furtivespy.com/images/qe/UK-a.jpg"},
    {name: "Finance - 4", type: "UK", suit: "UK", url: "https://furtivespy.com/images/qe/UK-f.jpg"},
    {name: "Government - 2", type: "UK", suit: "UK", url: "https://furtivespy.com/images/qe/UK-g.jpg"},
    {name: "Agriculture - 4", type: "US", suit: "US", url: "https://furtivespy.com/images/qe/US-a.jpg"},
    {name: "Finance - 2", type: "US", suit: "US", url: "https://furtivespy.com/images/qe/US-f.jpg"},
    {name: "Manufacturing - 3", type: "US", suit: "US", url: "https://furtivespy.com/images/qe/US-m.jpg"},
]

const tigrisTiles = [
    {name: "Temple", type: "🟥", suit: "temple", url: "https://furtivespy.com/images/tigris/red.jpg"},
    {name: "Farm", type: "🟦", suit: "farm", url: "https://furtivespy.com/images/tigris/blue.jpg"},
    {name: "Settlement", type: "🔳", suit: "settlement", url: "https://furtivespy.com/images/tigris/black.jpg"},
    {name: "Market", type: "🟩" , suit: "market", url: "https://furtivespy.com/images/tigris/green.jpg"},
]

const bloodRageAge1 = [
    //{name: `Frigga's Chosen`, type: `Mystic`, suit: `Mystic`, description: `Add 1 mystic to your reserve. Your mystics may retreat to an adjacent province instead of being destroyed.`, url: `https://furtivespy.com/images/bloodrage/age1_0_0.png`},
    {name: `Thor's Glory`, type: `Clan`, suit: `Clan`, description: `Gain 2 glory whenever at least 2 enemy figures are destroyed in a battle you participate in.`, url: `https://furtivespy.com/images/bloodrage/age1_0_1.png`},
    {name: `Brothers In Arms`, type: `Warrior`, suit: `Warrior`, description: `*Each pair of your warriors in a province is 3 total STR.`, url: `https://furtivespy.com/images/bloodrage/age1_0_2.png`},
    {name: `Heimdall's Sight`, type: `Battle`, suit: `Battle`, description: `This card has the same value as the highest revealed enemy card.`, url: `https://furtivespy.com/images/bloodrage/age1_0_3.png`},
    //{name: `Frigga's Chosen`, type: `Mystic`, suit: `Mystic`, description: `Add 1 mystic to your reserve. Your mystics may retreat to an adjacent province instead of being destroyed.`, url: `https://furtivespy.com/images/bloodrage/age1_0_4.png`},
    {name: `Dwarf Chieftain`, type: `Monster`, suit: `Monster`, description: `*Costs no rage to upgrade or invade`, url: `https://furtivespy.com/images/bloodrage/age1_0_5.png`},
    {name: `Thor's Hammer`, type: `Battle`, suit: `Battle`, description: `Gain 3 glory if you win this battle.`, url: `https://furtivespy.com/images/bloodrage/age1_0_9.png`},
    
    {name: `Troll`, type: `Monster`, suit: `Monster`, description: `When this monster invades a province, destroy all enemy warriors in it.`, url: `https://furtivespy.com/images/bloodrage/age1_1_0.png`},
    {name: `Frigga's Charm`, type: `Clan`, suit: `Clan`, description: `Upgrade cards cost you 1 less rage to play`, url: `https://furtivespy.com/images/bloodrage/age1_1_1.png`},
    {name: `Tyr's Smite`, type: `Battle`, suit: `Battle`, description: `-`, url: `https://furtivespy.com/images/bloodrage/age1_1_2.png`},
    {name: `Loki's Blessing`, type: `Clan`, suit: `Clan`, description: `If you lose a battle, you may invade that province with a warrior for free.`, url: `https://furtivespy.com/images/bloodrage/age1_1_3.png`},
    {name: `Frigga's Succor`, type: `Clan`, suit: `Clan`, description: `When you invade with any figure, you may invade with an additional warrior in that province for free.`, url: `https://furtivespy.com/images/bloodrage/age1_1_4.png`},
    {name: `Loki's Trickery`, type: `Battle`, suit: `Battle`, description: `If you lose, steal 1 rage from the winnign player.`, url: `https://furtivespy.com/images/bloodrage/age1_1_6.png`},
    {name: `Manheim`, type: `Quest`, suit: `Quest`, description: `Have the most STR in at least one Manheim (yellow) province. If completed, raise one of your clan stats by 1.`, url: `https://furtivespy.com/images/bloodrage/age1_1_7.png`},
    {name: `Alfheim`, type: `Quest`, suit: `Quest`, description: `Have the most STR in at least one Alfheim (gray) province. If completed, raise one of your clan stats by 1.`, url: `https://furtivespy.com/images/bloodrage/age1_1_8.png`},

    {name: `Yggdrasil`, type: `Quest`, suit: `Quest`, description: `Have the most STR in Yggdrasil. If completed, raise one of your clan stats by 1.`, url: `https://furtivespy.com/images/bloodrage/age1_2_1.png`},
    {name: `Sea Serpent`, type: `Monster`, suit: `Monster`, description: `This monster counts as a ship.`, url: `https://furtivespy.com/images/bloodrage/age1_2_2.png`},
    {name: `Frigga's Grace`, type: `Battle`, suit: `Battle`, description: `If you pillage successfully, raise another of your clan stats by 1.`, url: `https://furtivespy.com/images/bloodrage/age1_2_3.png`},
    {name: `Tyr's Smash`, type: `Battle`, suit: `Battle`, description: `-`, url: `https://furtivespy.com/images/bloodrage/age1_2_4.png`},
    {name: `Tyr's Crush`, type: `Battle`, suit: `Battle`, description: `-`, url: `https://furtivespy.com/images/bloodrage/age1_2_5.png`},
    {name: `Jotunheim`, type: `Quest`, suit: `Quest`, description: `Have the most STR in at least one Jotunheim (blue) province. If completed, raise one of your clan stats by 1.`, url: `https://furtivespy.com/images/bloodrage/age1_2_7.png`},
    {name: `Glorious Death`, type: `Quest`, suit: `Quest`, description: `Have at least 4 figures in Valhalla (before Ragnarok). If completed, raise one of your clan stats by 1.`, url: `https://furtivespy.com/images/bloodrage/age1_2_8.png`},
    {name: `Frigga's Grace`, type: `Battle`, suit: `Battle`, description: `If you pillage successfully, raise another of your clan stats by 1.`, url: `https://furtivespy.com/images/bloodrage/age1_2_9.png`},

    {name: `Tyr's Smash`, type: `Battle`, suit: `Battle`, description: `-`, url: `https://furtivespy.com/images/bloodrage/age1_3_1.png`},
    {name: `Lord of Hammers`, type: `Leader`, suit: `Leader`, description: `If you successfully pillage with your leader, you may move him to an adjacent province.`, url: `https://furtivespy.com/images/bloodrage/age1_3_2.png`},
    {name: `Jotunheim`, type: `Quest`, suit: `Quest`, description: `Have the most STR in at least one Jotunheim (blue) province. If completed, raise one of your clan stats by 1.`, url: `https://furtivespy.com/images/bloodrage/age1_3_3.png`},
    {name: `Tyr's Bash`, type: `Battle`, suit: `Battle`, description: `-`, url: `https://furtivespy.com/images/bloodrage/age1_3_4.png`},
    {name: `Alfheim`, type: `Quest`, suit: `Quest`, description: `Have the most STR in at least one Alfheim (gray) province. If completed, raise one of your clan stats by 1.`, url: `https://furtivespy.com/images/bloodrage/age1_3_5.png`},
    {name: `Glorious Death`, type: `Quest`, suit: `Quest`, description: `Have at least 4 figures in Valhalla (before Ragnarok). If completed, raise one of your clan stats by 1.`, url: `https://furtivespy.com/images/bloodrage/age1_3_6.png`},
    {name: `Odin's Smite`, type: `Battle`, suit: `Battle`, description: `Destroy one warrior from each opponent in this province before comparing STR.`, url: `https://furtivespy.com/images/bloodrage/age1_3_7.png`},
    {name: `Manheim`, type: `Quest`, suit: `Quest`, description: `Have the most STR in at least one Manheim (yellow) province. If completed, raise one of your clan stats by 1.`, url: `https://furtivespy.com/images/bloodrage/age1_3_8.png`},
    {name: `Tyr's Domain`, type: `Clan`, suit: `Clan`, description: `After you reveal a quest card in combat, you may treat it as a +3 battle card.`, url: `https://furtivespy.com/images/bloodrage/age1_3_9.png`},

    {name: `Odin's Smite`, type: `Battle`, suit: `Battle`, description: `Destroy one warrior from each opponent in this province before comparing STR.`, url: `https://furtivespy.com/images/bloodrage/age1_4_0.png`},
    {name: `Loki's Domain`, type: `Clan`, suit: `Clan`, description: `Gain 1 glory for each figure you release from Valhalla.`, url: `https://furtivespy.com/images/bloodrage/age1_4_1.png`},
    {name: `Loki's Dragons`, type: `Ship`, suit: `Ship`, description: `Gain 4 glory when a ship of yours is destroyed.`, url: `https://furtivespy.com/images/bloodrage/age1_4_2.png`},
    {name: `Loki's Trickery`, type: `Battle`, suit: `Battle`, description: `If you lose, steal 1 rage from the winnign player.`, url: `https://furtivespy.com/images/bloodrage/age1_4_3.png`},
]    

const bloodRageAge1_fivePlayer = [
    {name: `Loki's Dragons`, type: `Ship`, suit: `Ship`, description: `Gain 4 glory when a ship of yours is destroyed.`, url: `https://furtivespy.com/images/bloodrage/age1_0_6.png`},
    {name: `Lord of Hammers`, type: `Leader`, suit: `Leader`, description: `If you successfully pillage with your leader, you may move him to an adjacent province.`, url: `https://furtivespy.com/images/bloodrage/age1_0_7.png`},
    {name: `Tyr's Smash`, type: `Battle`, suit: `Battle`, description: `-`, url: `https://furtivespy.com/images/bloodrage/age1_0_8.png`},
    {name: `Tyr's Smite`, type: `Battle`, suit: `Battle`, description: `-`, url: `https://furtivespy.com/images/bloodrage/age1_1_5.png`},
    {name: `Widespread`, type: `Quest`, suit: `Quest`, description: `Have the most STR in at least 2 different provinces. If completed, raise one of your clan stats by 1.`, url: `https://furtivespy.com/images/bloodrage/age1_1_9.png`},
    {name: `Brothers In Arms`, type: `Warrior`, suit: `Warrior`, description: `*Each pair of your warriors in a province is 3 total STR.`, url: `https://furtivespy.com/images/bloodrage/age1_2_0.png`},
    {name: `Thor's Hammer`, type: `Battle`, suit: `Battle`, description: `Gain 3 glory if you win this battle.`, url: `https://furtivespy.com/images/bloodrage/age1_2_6.png`},
    {name: `Glorious Death`, type: `Quest`, suit: `Quest`, description: `Have at least 4 figures in Valhalla (before Ragnarok). If completed, raise one of your clan stats by 1.`, url: `https://furtivespy.com/images/bloodrage/age1_3_0.png`},
]

const bloodRageAge2 = [
    {name: `Tyr's Smash`, type: `Battle`, suit: `Battle`, description: `-`, url: `https://furtivespy.com/images/bloodrage/age2_0_0.png`},
    {name: `Tyr's Smite`, type: `Battle`, suit: `Battle`, description: `-`, url: `https://furtivespy.com/images/bloodrage/age2_0_1.png`},
    {name: `Tyr's Rage`, type: `Battle`, suit: `Battle`, description: `-`, url: `https://furtivespy.com/images/bloodrage/age2_0_2.png`},
    {name: `Thor's Domain`, type: `Clan`, suit: `Clan`, description: `After you invade a province, you may pay 2 rage to immediately try to pillage it.`, url: `https://furtivespy.com/images/bloodrage/age2_0_3.png`},
    {name: `Loki's Backstab`, type: `Battle`, suit: `Battle`, description: `If you lose, steal 2 glory from the winning player.`, url: `https://furtivespy.com/images/bloodrage/age2_0_4.png`},
    {name: `Tyr's Crush`, type: `Battle`, suit: `Battle`, description: `-`, url: `https://furtivespy.com/images/bloodrage/age2_0_5.png`},
    {name: `Dark Elf`, type: `Monster`, suit: `Monster`, description: `This monster may invade Yggdrasil. *Has 3 STR in Yggdrasil`, url: `https://furtivespy.com/images/bloodrage/age2_0_6.png`},
    {name: `Valkyrie`, type: `Monster`, suit: `Monster`, description: `Gain 2 glory per enemy figure destroyed in battle with this monster.`, url: `https://furtivespy.com/images/bloodrage/age2_0_7.png`},
    {name: `Heimdall's Eye`, type: `Battle`, suit: `Battle`, description: `You may play this card (and add its STR) after all players' battle cards are revealed.`, url: `https://furtivespy.com/images/bloodrage/age2_0_8.png`},
    {name: `Yggdrasil`, type: `Quest`, suit: `Quest`, description: `Have the most STR in Yggdrasil. If completed, raise one of your clan stats by 1.`, url: `https://furtivespy.com/images/bloodrage/age2_0_9.png`},

    //{name: `Odin's Chosen`, type: `Mystic`, suit: `Mystic`, description: `Add 1 mystic to your reserve. Your mystics may invade a village occupied by a warrior or mystic, destroying that figure.`, url: `https://furtivespy.com/images/bloodrage/age2_1_0.png`},
    {name: `Fire Giant`, type: `Monster`, suit: `Monster`, description: `When this monster invades a province, destroy all enemy non-Monster figures in it.`, url: `https://furtivespy.com/images/bloodrage/age2_1_1.png`},
    {name: `Loki's Eminence`, type: `Clan`, suit: `Clan`, description: `Gain 2 glory for each figure you release from Valhalla.`, url: `https://furtivespy.com/images/bloodrage/age2_1_4.png`},
    {name: `Frigga's Protection`, type: `Clan`, suit: `Clan`, description: `You may pay 1 rage to prevent a figure of yours from being destroyed.`, url: `https://furtivespy.com/images/bloodrage/age2_1_5.png`},
    {name: `Glorious Death`, type: `Quest`, suit: `Quest`, description: `Have at least 4 figures in Valhalla (before Ragnarok). If completed, raise one of your clan stats by 1.`, url: `https://furtivespy.com/images/bloodrage/age2_1_6.png`},
    {name: `Loki's Backstab`, type: `Battle`, suit: `Battle`, description: `If you lose, steal 2 glory from the winning player.`, url: `https://furtivespy.com/images/bloodrage/age2_1_7.png`},
    {name: `Jotunheim`, type: `Quest`, suit: `Quest`, description: `Have the most STR in at least one Jotunheim (blue) province. If completed, raise one of your clan stats by 1.`, url: `https://furtivespy.com/images/bloodrage/age2_1_8.png`},
    {name: `Heimdall's Eye`, type: `Battle`, suit: `Battle`, description: `You may play this card (and add its STR) after all players' battle cards are revealed.`, url: `https://furtivespy.com/images/bloodrage/age2_1_9.png`},

    {name: `Odin's Tide`, type: `Battle`, suit: `Battle`, description: `Before comparing STR, each player chooses and destroys all but one of his figures in this battle.`, url: `https://furtivespy.com/images/bloodrage/age2_2_0.png`},
    {name: `Jotunheim`, type: `Quest`, suit: `Quest`, description: `Have the most STR in at least one Jotunheim (blue) province. If completed, raise one of your clan stats by 1.`, url: `https://furtivespy.com/images/bloodrage/age2_2_1.png`},
    {name: `Heimdall's Watch`, type: `Battle`, suit: `Battle`, description: `Discard all revealed cards. Gain glory equal to the total +STR revealed. Then play new cards.`, url: `https://furtivespy.com/images/bloodrage/age2_2_2.png`},
    {name: `Experts in Arms`, type: `Warrior`, suit: `Warrior`, description: `Your warriors are now 2 STR.`, url: `https://furtivespy.com/images/bloodrage/age2_2_3.png`},
    {name: `Glorious Death`, type: `Quest`, suit: `Quest`, description: `Have at least 4 figures in Valhalla (before Ragnarok). If completed, raise one of your clan stats by 1.`, url: `https://furtivespy.com/images/bloodrage/age2_2_6.png`},
    //{name: `Odin's Chosen`, type: `Mystic`, suit: `Mystic`, description: `Add 1 mystic to your reserve. Your mystics may invade a village occupied by a warrior or mystic, destroying that figure.`, url: `https://furtivespy.com/images/bloodrage/age2_2_7.png`},
    {name: `Odin's Tide`, type: `Battle`, suit: `Battle`, description: `Before comparing STR, each player chooses and destroys all but one of his figures in this battle.`, url: `https://furtivespy.com/images/bloodrage/age2_2_8.png`},
    {name: `Manheim`, type: `Quest`, suit: `Quest`, description: `Have the most STR in at least one Manheim (yellow) province. If completed, raise one of your clan stats by 1.`, url: `https://furtivespy.com/images/bloodrage/age2_2_9.png`},

    {name: `Manheim`, type: `Quest`, suit: `Quest`, description: `Have the most STR in at least one Manheim (yellow) province. If completed, raise one of your clan stats by 1.`, url: `https://furtivespy.com/images/bloodrage/age2_3_0.png`},
    {name: `Lord of Axes`, type: `Leader`, suit: `Leader`, description: `If you successfully pillage with your leader, raise one of your clan stats by 1.`, url: `https://furtivespy.com/images/bloodrage/age2_3_3.png`},
    {name: `Odin's Inspiration`, type: `Clan`, suit: `Clan`, description: `Double your glory award from dying during Ragnarok.`, url: `https://furtivespy.com/images/bloodrage/age2_3_4.png`},
    {name: `Tyr's Prowess`, type: `Clan`, suit: `Clan`, description: `If you win a battle, you may keep any of your revealed cards, payign 1 rage each.`, url: `https://furtivespy.com/images/bloodrage/age2_3_7.png`},
    {name: `Thor's Oath`, type: `Battle`, suit: `Battle`, description: `If you win, raise one of your clan stats by 1.`, url: `https://furtivespy.com/images/bloodrage/age2_3_8.png`},
    {name: `Alfheim`, type: `Quest`, suit: `Quest`, description: `Have the most STR in at least one Alfheim (gray) province. If completed, raise one of your clan stats by 1.`, url: `https://furtivespy.com/images/bloodrage/age2_3_9.png`},

    {name: `Tyr's Challenge`, type: `Clan`, suit: `Clan`, description: `As your action, you may pay 2 rage to "repillage" an already pillaged province.`, url: `https://furtivespy.com/images/bloodrage/age2_4_0.png`},
    {name: `Heimdall's Eye`, type: `Battle`, suit: `Battle`, description: `You may play this card (and add its STR) after all players' battle cards are revealed.`, url: `https://furtivespy.com/images/bloodrage/age2_4_1.png`},
    {name: `Alfheim`, type: `Quest`, suit: `Quest`, description: `Have the most STR in at least one Alfheim (gray) province. If completed, raise one of your clan stats by 1.`, url: `https://furtivespy.com/images/bloodrage/age2_4_2.png`},
    {name: `Fire Dragons`, type: `Ship`, suit: `Ship`, description: `Gain 8 glory when a ship of yours is destroyed.`, url: `https://furtivespy.com/images/bloodrage/age2_4_3.png`},
]

const bloodRageAge2_fivePlayer = [
    {name: `Lord of Axes`, type: `Leader`, suit: `Leader`, description: `If you successfully pillage with your leader, raise one of your clan stats by 1.`, url: `https://furtivespy.com/images/bloodrage/age2_1_3.png`},
    {name: `Tyr's Smash`, type: `Battle`, suit: `Battle`, description: `-`, url: `https://furtivespy.com/images/bloodrage/age2_2_4.png`},
    {name: `Glorious Death`, type: `Quest`, suit: `Quest`, description: `Have at least 4 figures in Valhalla (before Ragnarok). If completed, raise one of your clan stats by 1.`, url: `https://furtivespy.com/images/bloodrage/age2_2_5.png`},
    {name: `Experts in Arms`, type: `Warrior`, suit: `Warrior`, description: `Your warriors are now 2 STR.`, url: `https://furtivespy.com/images/bloodrage/age2_3_1.png`},
    {name: `Thor's Oath`, type: `Battle`, suit: `Battle`, description: `If you win, raise one of your clan stats by 1.`, url: `https://furtivespy.com/images/bloodrage/age2_3_2.png`},
    {name: `Heimdall's Eye`, type: `Battle`, suit: `Battle`, description: `You may play this card (and add its STR) after all players' battle cards are revealed.`, url: `https://furtivespy.com/images/bloodrage/age2_3_5.png`},
    {name: `Fire Dragons`, type: `Ship`, suit: `Ship`, description: `Gain 8 glory when a ship of yours is destroyed.`, url: `https://furtivespy.com/images/bloodrage/age2_3_6.png`},
    {name: `Widespread`, type: `Quest`, suit: `Quest`, description: `Have the most STR in at least 2 different provinces. If completed, raise one of your clan stats by 1.`, url: `https://furtivespy.com/images/bloodrage/age2_1_2.png`},
]

const bloodRageAge3 = [
    {name: `Thor's Conquest`, type: `Clan`, suit: `Clan`, description: `Gain 3 glory for each figure you have on the board at the end of the game.`, url: `https://furtivespy.com/images/bloodrage/age3_0_1.png`},
    //{name: `Thor's Chosen`, type: `Monster`, suit: `Monster`, description: `Add 1 mystic to your reserve. Each time you win a battle, gain 3 glory for eahc of your participating mystics.`, url: `https://furtivespy.com/images/bloodrage/age3_0_2.png`},
    {name: `Heimdall's Watch`, type: `Battle`, suit: `Battle`, description: `Discard all revealed cards. Gain glory equal to the total +STR revealed. Then play new cards.`, url: `https://furtivespy.com/images/bloodrage/age3_0_3.png`},
    {name: `Alfheim`, type: `Quest`, suit: `Quest`, description: `Have the most STR in at least one Alfheim (gray) province. If completed, raise one of your clan stats by 1.`, url: `https://furtivespy.com/images/bloodrage/age3_0_4.png`},
    {name: `Soldier of Hel`, type: `Monster`, suit: `Monster`, description: `*Costs no rage to upgrade or invade`, url: `https://furtivespy.com/images/bloodrage/age3_0_5.png`},
    {name: `Lord of Spears`, type: `Leader`, suit: `Leader`, description: `If you successfully pillage with your leader, raise all your clan stats by 1.`, url: `https://furtivespy.com/images/bloodrage/age3_0_6.png`},
    {name: `Heimdall's Gaze`, type: `Battle`, suit: `Battle`, description: `You may play this card (and add its STR) after all players' battle cards are revealed.`, url: `https://furtivespy.com/images/bloodrage/age3_0_7.png`},
    {name: `Thor's Primacy`, type: `Battle`, suit: `Battle`, description: `Cancel the text of each opponent's revealed card before it takes effect.`, url: `https://furtivespy.com/images/bloodrage/age3_0_8.png`},
    {name: `Manheim`, type: `Quest`, suit: `Quest`, description: `Have the most STR in at least one Manheim (yellow) province. If completed, raise one of your clan stats by 1.`, url: `https://furtivespy.com/images/bloodrage/age3_0_9.png`},

    {name: `Tyr's Wrath`, type: `Clan`, suit: `Clan`, description: `After you reveal a quest card in combat, you may treat it as a +5 battle card.`, url: `https://furtivespy.com/images/bloodrage/age3_1_0.png`},
    {name: `Heimdall's Gaze`, type: `Battle`, suit: `Battle`, description: `You may play this card (and add its STR) after all players' battle cards are revealed.`, url: `https://furtivespy.com/images/bloodrage/age3_1_1.png`},
    {name: `Tyr's Crush`, type: `Battle`, suit: `Battle`, description: `-`, url: `https://furtivespy.com/images/bloodrage/age3_1_2.png`},
    {name: `Volur Witch`, type: `Monster`, suit: `Monster`, description: `May retreat from an outer province to Yggdrasil instead of being destroyed.`, url: `https://furtivespy.com/images/bloodrage/age3_1_3.png`},
    {name: `Loki's Poison`, type: `Battle`, suit: `Battle`, description: `If you lose, take the winning player's revealed cards into your hand.`, url: `https://furtivespy.com/images/bloodrage/age3_1_4.png`},
    {name: `Loki's Wrath`, type: `Clan`, suit: `Clan`, description: `Gain 3 glory for each figure you release from Valhalla.`, url: `https://furtivespy.com/images/bloodrage/age3_1_5.png`},
    {name: `Jotunheim`, type: `Quest`, suit: `Quest`, description: `Have the most STR in at least one Jotunheim (blue) province. If completed, raise one of your clan stats by 1.`, url: `https://furtivespy.com/images/bloodrage/age3_1_6.png`},
    {name: `Manheim`, type: `Quest`, suit: `Quest`, description: `Have the most STR in at least one Manheim (yellow) province. If completed, raise one of your clan stats by 1.`, url: `https://furtivespy.com/images/bloodrage/age3_1_9.png`},

    {name: `Odin's Judgement`, type: `Battle`, suit: `Battle`, description: `Gain 2 glory for each figure destroyed in this battle (including yours).`, url: `https://furtivespy.com/images/bloodrage/age3_2_1.png`},
    //{name: `Thor's Chosen`, type: `Monster`, suit: `Monster`, description: `Add 1 mystic to your reserve. Each time you win a battle, gain 3 glory for eahc of your participating mystics.`, url: `https://furtivespy.com/images/bloodrage/age3_2_4.png`},
    {name: `Thor's Ascension`, type: `Battle`, suit: `Battle`, description: `If you win, gain 3 rage and 3 glory.`, url: `https://furtivespy.com/images/bloodrage/age3_2_5.png`},
    {name: `Tyr's Smite`, type: `Battle`, suit: `Battle`, description: `-`, url: `https://furtivespy.com/images/bloodrage/age3_2_6.png`},
    {name: `Masters in Arms`, type: `Warrior`, suit: `Warrior`, description: `*Each pair of your warriors in a province is 6 total STR.`, url: `https://furtivespy.com/images/bloodrage/age3_2_7.png`},
    {name: `Glorious Death`, type: `Quest`, suit: `Quest`, description: `Have at least 4 figures in Valhalla (before Ragnarok). If completed, raise one of your clan stats by 1.`, url: `https://furtivespy.com/images/bloodrage/age3_2_9.png`},

    {name: `Frost Giant`, type: `Monster`, suit: `Monster`, description: `If you successfully pillage with this monster, gain the pillage reward again.`, url: `https://furtivespy.com/images/bloodrage/age3_3_0.png`},
    {name: `Thor's Primacy`, type: `Battle`, suit: `Battle`, description: `Cancel the text of each opponent's revealed card before it takes effect.`, url: `https://furtivespy.com/images/bloodrage/age3_3_1.png`},
    {name: `Alfheim`, type: `Quest`, suit: `Quest`, description: `Have the most STR in at least one Alfheim (gray) province. If completed, raise one of your clan stats by 1.`, url: `https://furtivespy.com/images/bloodrage/age3_3_2.png`},
    {name: `Glorious Death`, type: `Quest`, suit: `Quest`, description: `Have at least 4 figures in Valhalla (before Ragnarok). If completed, raise one of your clan stats by 1.`, url: `https://furtivespy.com/images/bloodrage/age3_3_3.png`},
    {name: `Thor's Ascension`, type: `Battle`, suit: `Battle`, description: `If you win, gain 3 rage and 3 glory.`, url: `https://furtivespy.com/images/bloodrage/age3_3_4.png`},
    {name: `Odin's Judgement`, type: `Battle`, suit: `Battle`, description: `Gain 2 glory for each figure destroyed in this battle (including yours).`, url: `https://furtivespy.com/images/bloodrage/age3_3_5.png`},
    {name: `Yggdrasil`, type: `Quest`, suit: `Quest`, description: `Have the most STR in Yggdrasil. If completed, raise one of your clan stats by 1.`, url: `https://furtivespy.com/images/bloodrage/age3_3_6.png`},
    {name: `Jotunheim`, type: `Quest`, suit: `Quest`, description: `Have the most STR in at least one Jotunheim (blue) province. If completed, raise one of your clan stats by 1.`, url: `https://furtivespy.com/images/bloodrage/age3_3_7.png`},
    {name: `Odin's Throne`, type: `Clan`, suit: `Clan`, description: `Double the glory award for quests you complete.`, url: `https://furtivespy.com/images/bloodrage/age3_3_8.png`},
    {name: `Eternal Dragons`, type: `Ship`, suit: `Ship`, description: `Gain 12 glory when a ship of yours is destroyed.`, url: `https://furtivespy.com/images/bloodrage/age3_3_9.png`},

    {name: `Tyr's Rage`, type: `Battle`, suit: `Battle`, description: `-`, url: `https://furtivespy.com/images/bloodrage/age3_4_0.png`},
    {name: `Frigga's Sacrifice`, type: `Clan`, suit: `Clan`, description: `As your action, you may destroy 2 of your figures to raise one of your clan stats by 1.`, url: `https://furtivespy.com/images/bloodrage/age3_4_1.png`},
    {name: `Frigga's Domain`, type: `Clan`, suit: `Clan`, description: `You may pay 1 rage to invade with any one of your figures in Valhalla.`, url: `https://furtivespy.com/images/bloodrage/age3_4_2.png`},

]

const bloodRageAge3_fivePlayer = [
    {name: `Lord of Spears`, type: `Leader`, suit: `Leader`, description: `If you successfully pillage with your leader, raise all your clan stats by 1.`, url: `https://furtivespy.com/images/bloodrage/age3_0_0.png`},
    {name: `Masters in Arms`, type: `Warrior`, suit: `Warrior`, description: `*Each pair of your warriors in a province is 6 total STR.`, url: `https://furtivespy.com/images/bloodrage/age3_1_7.png`},
    {name: `Loki's Poison`, type: `Battle`, suit: `Battle`, description: `If you lose, take the winning player's revealed cards into your hand.`, url: `https://furtivespy.com/images/bloodrage/age3_1_8.png`},
    {name: `Glorious Death`, type: `Quest`, suit: `Quest`, description: `Have at least 4 figures in Valhalla (before Ragnarok). If completed, raise one of your clan stats by 1.`, url: `https://furtivespy.com/images/bloodrage/age3_2_0.png`},
    {name: `Widespread`, type: `Quest`, suit: `Quest`, description: `Have the most STR in at least 2 different provinces. If completed, raise one of your clan stats by 1.`, url: `https://furtivespy.com/images/bloodrage/age3_2_2.png`},
    {name: `Tyr's Crush`, type: `Battle`, suit: `Battle`, description: `-`, url: `https://furtivespy.com/images/bloodrage/age3_2_3.png`},
    {name: `Eternal Dragons`, type: `Ship`, suit: `Ship`, description: `Gain 12 glory when a ship of yours is destroyed.`, url: `https://furtivespy.com/images/bloodrage/age3_2_8.png`},
    {name: `Tyr's Judgement`, type: `Battle`, suit: `Battle`, description: `-`, url: `https://furtivespy.com/images/bloodrage/age3_4_3.png`},
    
]

const money = [
    {name: `1`, value: -1, type: `$`, suit: `Money`, url: `https://furtivespy.com/images/money/one-dollar.jpg`},
    {name: `5`, value: -5, type: `$`, suit: `Money`, url: `https://furtivespy.com/images/money/five-dollar.jpg`},
    {name: `10`, value: -10, type: `$`, suit: `Money`, url: `https://furtivespy.com/images/money/ten-dollar.jpg`},
    {name: `20`, value: -20, type: `$`, suit: `Money`, url: `https://furtivespy.com/images/money/twenty-dollar.jpg`},
]

const heatBase = [
    {name: `1`, value: 1, type: `Speed`, suit: `h`, url: `https://furtivespy.com/images/heat/heat_1.png`},
    {name: `1`, value: 1, type: `Speed`, suit: `h`, url: `https://furtivespy.com/images/heat/heat_1.png`},
    {name: `1`, value: 1, type: `Speed`, suit: `h`, url: `https://furtivespy.com/images/heat/heat_1.png`},
    {name: `2`, value: 2, type: `Speed`, suit: `h`, url: `https://furtivespy.com/images/heat/heat_2.png`},
    {name: `2`, value: 2, type: `Speed`, suit: `h`, url: `https://furtivespy.com/images/heat/heat_2.png`},
    {name: `2`, value: 2, type: `Speed`, suit: `h`, url: `https://furtivespy.com/images/heat/heat_2.png`},
    {name: `3`, value: 3, type: `Speed`, suit: `h`, url: `https://furtivespy.com/images/heat/heat_3.png`},
    {name: `3`, value: 3, type: `Speed`, suit: `h`, url: `https://furtivespy.com/images/heat/heat_3.png`},
    {name: `3`, value: 3, type: `Speed`, suit: `h`, url: `https://furtivespy.com/images/heat/heat_3.png`},
    {name: `4`, value: 4, type: `Speed`, suit: `h`, url: `https://furtivespy.com/images/heat/heat_4.png`},
    {name: `4`, value: 4, type: `Speed`, suit: `h`, url: `https://furtivespy.com/images/heat/heat_4.png`},
    {name: `4`, value: 4, type: `Speed`, suit: `h`, url: `https://furtivespy.com/images/heat/heat_4.png`},
    
    {name: `Stress`, value: 1, type: `Engine`, suit: `b`, url: `https://furtivespy.com/images/heat/stress.png`},
    {name: `Stress`, value: 1, type: `Engine`, suit: `b`, url: `https://furtivespy.com/images/heat/stress.png`},
    {name: `Stress`, value: 1, type: `Engine`, suit: `b`, url: `https://furtivespy.com/images/heat/stress.png`},
]

const heatGeneric = [
    {name: `Heat`, value: 0, type: `Engine`, suit: `a`, url: `https://furtivespy.com/images/heat/heat.png`},
    {name: `Stress`, value: 1, type: `Engine`, suit: `b`, url: `https://furtivespy.com/images/heat/stress.png`},
    {name: `5`, value: 5, type: `Speed`, suit: `h`, url: `https://furtivespy.com/images/heat/heat_5.png`},
    {name: `0`, value: 0, type: `Speed`, suit: `h`, url: `https://furtivespy.com/images/heat/heat_0.png`},
    {name: `Heat (Base)`, value: 0, type: `Engine`, suit: `a`, url: `https://furtivespy.com/images/heat/heat_heat.png`},
]

const heatUpgrades = [
    {name: `4 Wheel Drive (+++)`, value: 0, type: `Upgrade`, suit: `d`, url: `https://furtivespy.com/images/heat/4wheeldrive+.png`},
    {name: `4 Wheel Drive (+)`, value: 1, type: `Upgrade`, suit: `d`, url: `https://furtivespy.com/images/heat/4wheeldrive.png`},
    {name: `4 Wheel Drive (4+)`, value: 4, type: `Upgrade`, suit: `d`, url: `https://furtivespy.com/images/heat/4wheeldrive4.png`},
    {name: `4 Wheel Drive (+Cooling)`, value: 0, type: `Upgrade`, suit: `d`, url: `https://furtivespy.com/images/heat/4wheeldrivecool.png`},
    {name: `Body (1)`, value: 1, type: `Upgrade`, suit: `d`, url: `https://furtivespy.com/images/heat/body1.png`},
    {name: `Body (2 & Slipstream)`, value: 2, type: `Upgrade`, suit: `d`, url: `https://furtivespy.com/images/heat/body2.png`},
    {name: `Body (2 & Cooling)`, value: 2, type: `Upgrade`, suit: `d`, url: `https://furtivespy.com/images/heat/body2b.png`},
    {name: `Body (3)`, value: 3, type: `Upgrade`, suit: `d`, url: `https://furtivespy.com/images/heat/body3.png`},
    {name: `Body (5)`, value: 5, type: `Upgrade`, suit: `d`, url: `https://furtivespy.com/images/heat/body5.png`},
    {name: `Body (6)`, value: 6, type: `Upgrade`, suit: `d`, url: `https://furtivespy.com/images/heat/body6.png`},
    {name: `Brakes (1|2|3|4)`, value: 4, type: `Upgrade`, suit: `d`, url: `https://furtivespy.com/images/heat/brakes1234.png`},
    {name: `Brakes (1|3)`, value: 3, type: `Upgrade`, suit: `d`, url: `https://furtivespy.com/images/heat/brakes13.png`},
    {name: `Brakes (1|5)`, value: 5, type: `Upgrade`, suit: `d`, url: `https://furtivespy.com/images/heat/brakes15.png`},
    {name: `Brakes (2|4)`, value: 4, type: `Upgrade`, suit: `d`, url: `https://furtivespy.com/images/heat/brakes24.png`},
    {name: `Cooling System (1)`, value: 1, type: `Upgrade`, suit: `d`, url: `https://furtivespy.com/images/heat/cooling1.png`},
    {name: `Cooling System (3)`, value: 3, type: `Upgrade`, suit: `d`, url: `https://furtivespy.com/images/heat/cooling3.png`},
    {name: `Cooling System (4)`, value: 4, type: `Upgrade`, suit: `d`, url: `https://furtivespy.com/images/heat/cooling4.png`},
    {name: `Cooling System (6)`, value: 6, type: `Upgrade`, suit: `d`, url: `https://furtivespy.com/images/heat/cooling6.png`},
    {name: `Fuel (+)`, value: 0, type: `Upgrade`, suit: `d`, url: `https://furtivespy.com/images/heat/fuel.png`},
    {name: `Fuel (2)`, value: 2, type: `Upgrade`, suit: `d`, url: `https://furtivespy.com/images/heat/fuel2.png`},
    {name: `Gas Pedal (1+)`, value: 1, type: `Upgrade`, suit: `d`, url: `https://furtivespy.com/images/heat/gaspedal1+.png`},
    {name: `Gas Pedal (1)`, value: 1, type: `Upgrade`, suit: `d`, url: `https://furtivespy.com/images/heat/gaspedal1.png`},
    {name: `Gas Pedal (2)`, value: 2, type: `Upgrade`, suit: `d`, url: `https://furtivespy.com/images/heat/gaspedal2.png`},
    {name: `Gas Pedal (3)`, value: 3, type: `Upgrade`, suit: `d`, url: `https://furtivespy.com/images/heat/gaspedal3.png`},
    {name: `Gas Pedal (4)`, value: 4, type: `Upgrade`, suit: `d`, url: `https://furtivespy.com/images/heat/gaspedal4.png`},
    {name: `R.P.M. (+, +3)`, value: 0, type: `Upgrade`, suit: `d`, url: `https://furtivespy.com/images/heat/rpm+.png`},
    {name: `R.P.M. (1, +3)`, value: 1, type: `Upgrade`, suit: `d`, url: `https://furtivespy.com/images/heat/rpm1.png`},
    {name: `R.P.M. (1|2, +1)`, value: 2, type: `Upgrade`, suit: `d`, url: `https://furtivespy.com/images/heat/rpm12.png`},
    {name: `R.P.M. (1, +2)`, value: 1, type: `Upgrade`, suit: `d`, url: `https://furtivespy.com/images/heat/rpm1b.png`},
    {name: `R.P.M. (2, +2)`, value: 2, type: `Upgrade`, suit: `d`, url: `https://furtivespy.com/images/heat/rpm2.png`},
    {name: `R.P.M. (3, +2)`, value: 3, type: `Upgrade`, suit: `d`, url: `https://furtivespy.com/images/heat/rpm3.png`},
    {name: `Suspension (1)`, value: 1, type: `Upgrade`, suit: `d`, url: `https://furtivespy.com/images/heat/suspension1.png`},
    {name: `Suspension (2 & Cooling)`, value: 2, type: `Upgrade`, suit: `d`, url: `https://furtivespy.com/images/heat/suspension2.png`},
    {name: `Suspension (2)`, value: 2, type: `Upgrade`, suit: `d`, url: `https://furtivespy.com/images/heat/suspension2b.png`},
    {name: `Suspension (4)`, value: 4, type: `Upgrade`, suit: `d`, url: `https://furtivespy.com/images/heat/suspension4.png`},
    {name: `Tires (++)`, value: 0, type: `Upgrade`, suit: `d`, url: `https://furtivespy.com/images/heat/tires+.png`},
    {name: `Tires (+)`, value: 1, type: `Upgrade`, suit: `d`, url: `https://furtivespy.com/images/heat/tires.png`},
    {name: `Tires (1)`, value: 1, type: `Upgrade`, suit: `d`, url: `https://furtivespy.com/images/heat/tires1.png`},
    {name: `Tires (2)`, value: 2, type: `Upgrade`, suit: `d`, url: `https://furtivespy.com/images/heat/tires2.png`},
    {name: `Tires (2 & Cooling)`, value: 2, type: `Upgrade`, suit: `d`, url: `https://furtivespy.com/images/heat/tires2b.png`},
    {name: `Tires (3)`, value: 3, type: `Upgrade`, suit: `d`, url: `https://furtivespy.com/images/heat/tires3.png`},
    {name: `Turbo Charger (8)`, value: 8, type: `Upgrade`, suit: `d`, url: `https://furtivespy.com/images/heat/turbo8.png`},
    {name: `Turbo Charger (7)`, value: 7, type: `Upgrade`, suit: `d`, url: `https://furtivespy.com/images/heat/turby7.png`},
    {name: `Wings (3)`, value: 3, type: `Upgrade`, suit: `d`, url: `https://furtivespy.com/images/heat/wings3.png`},
    {name: `Wings (4)`, value: 4, type: `Upgrade`, suit: `d`, url: `https://furtivespy.com/images/heat/wings4.png`},
    {name: `Wings (6)`, value: 6, type: `Upgrade`, suit: `d`, url: `https://furtivespy.com/images/heat/wings6.png`},
]

const empiresEnd = [
    {name: `1`, value: 1, type: `Fire`, suit: `Fire`, url: `https://furtivespy.com/images/empiresend/empires-end_0_0.png`},
    {name: `2`, value: 2, type: `Fire`, suit: `Fire`, url: `https://furtivespy.com/images/empiresend/empires-end_0_1.png`},
    {name: `3`, value: 3, type: `Fire`, suit: `Fire`, url: `https://furtivespy.com/images/empiresend/empires-end_0_2.png`},
    {name: `4`, value: 4, type: `Fire`, suit: `Fire`, url: `https://furtivespy.com/images/empiresend/empires-end_0_3.png`},
    {name: `5`, value: 5, type: `Fire`, suit: `Fire`, url: `https://furtivespy.com/images/empiresend/empires-end_0_4.png`},
    {name: `6`, value: 6, type: `Fire`, suit: `Fire`, url: `https://furtivespy.com/images/empiresend/empires-end_0_5.png`},
    {name: `7`, value: 7, type: `Fire`, suit: `Fire`, url: `https://furtivespy.com/images/empiresend/empires-end_0_6.png`},
    {name: `8`, value: 8, type: `Fire`, suit: `Fire`, url: `https://furtivespy.com/images/empiresend/empires-end_0_7.png`},
    {name: `9`, value: 9, type: `Fire`, suit: `Fire`, url: `https://furtivespy.com/images/empiresend/empires-end_0_8.png`},
    {name: `10`, value: 10, type: `Fire`, suit: `Fire`, url: `https://furtivespy.com/images/empiresend/empires-end_0_9.png`},
    {name: `11`, value: 11, type: `Fire`, suit: `Fire`, url: `https://furtivespy.com/images/empiresend/empires-end_1_0.png`},
    {name: `1`, value: 1, type: `Revolt`, suit: `Revolt`, url: `https://furtivespy.com/images/empiresend/empires-end_1_1.png`},
    {name: `2`, value: 2, type: `Revolt`, suit: `Revolt`, url: `https://furtivespy.com/images/empiresend/empires-end_1_2.png`},
    {name: `3`, value: 3, type: `Revolt`, suit: `Revolt`, url: `https://furtivespy.com/images/empiresend/empires-end_1_3.png`},
    {name: `4`, value: 4, type: `Revolt`, suit: `Revolt`, url: `https://furtivespy.com/images/empiresend/empires-end_1_4.png`},
    {name: `5`, value: 5, type: `Revolt`, suit: `Revolt`, url: `https://furtivespy.com/images/empiresend/empires-end_1_5.png`},
    {name: `6`, value: 6, type: `Revolt`, suit: `Revolt`, url: `https://furtivespy.com/images/empiresend/empires-end_1_6.png`},
    {name: `7`, value: 7, type: `Revolt`, suit: `Revolt`, url: `https://furtivespy.com/images/empiresend/empires-end_1_7.png`},
    {name: `8`, value: 8, type: `Revolt`, suit: `Revolt`, url: `https://furtivespy.com/images/empiresend/empires-end_1_8.png`},
    {name: `9`, value: 9, type: `Revolt`, suit: `Revolt`, url: `https://furtivespy.com/images/empiresend/empires-end_1_9.png`},
    {name: `10`, value: 10, type: `Revolt`, suit: `Revolt`, url: `https://furtivespy.com/images/empiresend/empires-end_2_0.png`},
    {name: `11`, value: 11, type: `Revolt`, suit: `Revolt`, url: `https://furtivespy.com/images/empiresend/empires-end_2_1.png`},
    {name: `1`, value: 1, type: `Barbarians`, suit: `Barbarians`, url: `https://furtivespy.com/images/empiresend/empires-end_2_2.png`},
    {name: `2`, value: 2, type: `Barbarians`, suit: `Barbarians`, url: `https://furtivespy.com/images/empiresend/empires-end_2_3.png`},
    {name: `3`, value: 3, type: `Barbarians`, suit: `Barbarians`, url: `https://furtivespy.com/images/empiresend/empires-end_2_4.png`},
    {name: `4`, value: 4, type: `Barbarians`, suit: `Barbarians`, url: `https://furtivespy.com/images/empiresend/empires-end_2_5.png`},
    {name: `5`, value: 5, type: `Barbarians`, suit: `Barbarians`, url: `https://furtivespy.com/images/empiresend/empires-end_2_6.png`},
    {name: `6`, value: 6, type: `Barbarians`, suit: `Barbarians`, url: `https://furtivespy.com/images/empiresend/empires-end_2_7.png`},
    {name: `7`, value: 7, type: `Barbarians`, suit: `Barbarians`, url: `https://furtivespy.com/images/empiresend/empires-end_2_8.png`},
    {name: `8`, value: 8, type: `Barbarians`, suit: `Barbarians`, url: `https://furtivespy.com/images/empiresend/empires-end_2_9.png`},
    {name: `9`, value: 9, type: `Barbarians`, suit: `Barbarians`, url: `https://furtivespy.com/images/empiresend/empires-end_3_0.png`},
    {name: `10`, value: 10, type: `Barbarians`, suit: `Barbarians`, url: `https://furtivespy.com/images/empiresend/empires-end_3_1.png`},
    {name: `11`, value: 11, type: `Barbarians`, suit: `Barbarians`, url: `https://furtivespy.com/images/empiresend/empires-end_3_2.png`},
    {name: `1`, value: 1, type: `Famine`, suit: `Famine`, url: `https://furtivespy.com/images/empiresend/empires-end_3_3.png`},
    {name: `2`, value: 2, type: `Famine`, suit: `Famine`, url: `https://furtivespy.com/images/empiresend/empires-end_3_4.png`},
    {name: `3`, value: 3, type: `Famine`, suit: `Famine`, url: `https://furtivespy.com/images/empiresend/empires-end_3_5.png`},
    {name: `4`, value: 4, type: `Famine`, suit: `Famine`, url: `https://furtivespy.com/images/empiresend/empires-end_3_6.png`},
    {name: `5`, value: 5, type: `Famine`, suit: `Famine`, url: `https://furtivespy.com/images/empiresend/empires-end_3_7.png`},
    {name: `6`, value: 6, type: `Famine`, suit: `Famine`, url: `https://furtivespy.com/images/empiresend/empires-end_3_8.png`},
    {name: `7`, value: 7, type: `Famine`, suit: `Famine`, url: `https://furtivespy.com/images/empiresend/empires-end_3_9.png`},
    {name: `8`, value: 8, type: `Famine`, suit: `Famine`, url: `https://furtivespy.com/images/empiresend/empires-end_4_0.png`},
    {name: `9`, value: 9, type: `Famine`, suit: `Famine`, url: `https://furtivespy.com/images/empiresend/empires-end_4_1.png`},
    {name: `10`, value: 10, type: `Famine`, suit: `Famine`, url: `https://furtivespy.com/images/empiresend/empires-end_4_2.png`},
    {name: `11`, value: 11, type: `Famine`, suit: `Famine`, url: `https://furtivespy.com/images/empiresend/empires-end_4_3.png`},
    {name: `1`, value: 1, type: `Flood`, suit: `Flood`, url: `https://furtivespy.com/images/empiresend/empires-end_4_4.png`},
    {name: `2`, value: 2, type: `Flood`, suit: `Flood`, url: `https://furtivespy.com/images/empiresend/empires-end_4_5.png`},
    {name: `3`, value: 3, type: `Flood`, suit: `Flood`, url: `https://furtivespy.com/images/empiresend/empires-end_4_6.png`},
    {name: `4`, value: 4, type: `Flood`, suit: `Flood`, url: `https://furtivespy.com/images/empiresend/empires-end_4_7.png`},
    {name: `5`, value: 5, type: `Flood`, suit: `Flood`, url: `https://furtivespy.com/images/empiresend/empires-end_4_8.png`},
    {name: `6`, value: 6, type: `Flood`, suit: `Flood`, url: `https://furtivespy.com/images/empiresend/empires-end_4_9.png`},
    {name: `7`, value: 7, type: `Flood`, suit: `Flood`, url: `https://furtivespy.com/images/empiresend/empires-end_5_0.png`},
    {name: `8`, value: 8, type: `Flood`, suit: `Flood`, url: `https://furtivespy.com/images/empiresend/empires-end_5_1.png`},
    {name: `9`, value: 9, type: `Flood`, suit: `Flood`, url: `https://furtivespy.com/images/empiresend/empires-end_5_2.png`},
    {name: `10`, value: 10, type: `Flood`, suit: `Flood`, url: `https://furtivespy.com/images/empiresend/empires-end_5_3.png`},
    {name: `11`, value: 11, type: `Flood`, suit: `Flood`, url: `https://furtivespy.com/images/empiresend/empires-end_5_4.png`},
    {name: `1`, value: 1, type: `Blight`, suit: `Blight`, url: `https://furtivespy.com/images/empiresend/empires-end_5_5.png`},
    {name: `2`, value: 2, type: `Blight`, suit: `Blight`, url: `https://furtivespy.com/images/empiresend/empires-end_5_6.png`},
    {name: `3`, value: 3, type: `Blight`, suit: `Blight`, url: `https://furtivespy.com/images/empiresend/empires-end_5_7.png`},
    {name: `4`, value: 4, type: `Blight`, suit: `Blight`, url: `https://furtivespy.com/images/empiresend/empires-end_5_8.png`},
    {name: `5`, value: 5, type: `Blight`, suit: `Blight`, url: `https://furtivespy.com/images/empiresend/empires-end_5_9.png`},
    {name: `6`, value: 6, type: `Blight`, suit: `Blight`, url: `https://furtivespy.com/images/empiresend/empires-end_6_0.png`},
    {name: `7`, value: 7, type: `Blight`, suit: `Blight`, url: `https://furtivespy.com/images/empiresend/empires-end_6_1.png`},
    {name: `8`, value: 8, type: `Blight`, suit: `Blight`, url: `https://furtivespy.com/images/empiresend/empires-end_6_2.png`},
    {name: `9`, value: 9, type: `Blight`, suit: `Blight`, url: `https://furtivespy.com/images/empiresend/empires-end_6_3.png`},
    {name: `10`, value: 10, type: `Blight`, suit: `Blight`, url: `https://furtivespy.com/images/empiresend/empires-end_6_4.png`},
    {name: `11`, value: 11, type: `Blight`, suit: `Blight`, url: `https://furtivespy.com/images/empiresend/empires-end_6_5.png`},
]

const elgrande = [
    {name: `1`, value: 1, type: `Power`, suit: `Power`, url: `https://furtivespy.com/images/elgrande/1.png`},
    {name: `2`, value: 2, type: `Power`, suit: `Power`, url: `https://furtivespy.com/images/elgrande/2.png`},
    {name: `3`, value: 3, type: `Power`, suit: `Power`, url: `https://furtivespy.com/images/elgrande/3.png`},
    {name: `4`, value: 4, type: `Power`, suit: `Power`, url: `https://furtivespy.com/images/elgrande/4.png`},
    {name: `5`, value: 5, type: `Power`, suit: `Power`, url: `https://furtivespy.com/images/elgrande/5.png`},
    {name: `6`, value: 6, type: `Power`, suit: `Power`, url: `https://furtivespy.com/images/elgrande/6.png`},
    {name: `7`, value: 7, type: `Power`, suit: `Power`, url: `https://furtivespy.com/images/elgrande/7.png`},
    {name: `8`, value: 8, type: `Power`, suit: `Power`, url: `https://furtivespy.com/images/elgrande/8.png`},
    {name: `9`, value: 9, type: `Power`, suit: `Power`, url: `https://furtivespy.com/images/elgrande/9.png`},
    {name: `10`, value: 10, type: `Power`, suit: `Power`, url: `https://furtivespy.com/images/elgrande/10.png`},
    {name: `11`, value: 11, type: `Power`, suit: `Power`, url: `https://furtivespy.com/images/elgrande/11.png`},
    {name: `12`, value: 12, type: `Power`, suit: `Power`, url: `https://furtivespy.com/images/elgrande/12.png`},
    {name: `13`, value: 13, type: `Power`, suit: `Power`, url: `https://furtivespy.com/images/elgrande/13.png`},
]
module.exports = new GameDatabase();