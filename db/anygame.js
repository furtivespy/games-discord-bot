const Discord = require('discord.js')
const { cloneDeep } = require('lodash')
const { nanoid } = require('nanoid')

class GameDatabase {
    
    CurrentCardList = [
        [ "Standard 52 Card Poker Deck", "standard" ],
        [ "Pear/Triangle (one 1, two 2s ... ten 10s)", "pear" ],
        [ "Dune Imperium (Base)", "imperium"],
        [ "Dune Imperium - Rise of Ix", "dune-ix"],
        [ "Brian Boru Action Cards", "brian-boru"],
        [ "King is Dead - Cunning", "cunning"],
    ]

    defaultGameData = {
        decks: [],
        players: [],
        name: "",
        isdeleted: true,
        winner: null
    }
    
    defaultSecretData = {
        isrevealed: true,
        players: []
    }

    defaultDeck = {
        name: "",
        allCards: [],
        shuffleStyle: "standard",
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
        list.forEach(item => {
            results.push(cloneDeep(this.createCardFromObj(deck, format, item)))
        })
        return results
    }

    createCardFromStrList(deck, list){
        let results = []
        list.forEach(item => {
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
            case "brian-boru":
                return this.createCardFromObjList(deckName, "A", brianBoru)
            case "cunning":
                return this.createCardFromObjList(deckName, "B", cunningKing)
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
    {name: "Spy", type: "Cunning", suit: "none", description: "Resolve the effect of an action card that is face up on top of another player’s discard pile", url: "https://furtivespy.com/images/king/spy.png"},
    {name: "Aid", type: "Cunning", suit: "none", description: "Find the faction with the most followers in the supply. Place two followers of that faction into any region.", url: "https://furtivespy.com/images/king/aid.png"},
    {name: "Ambush", type: "Cunning", suit: "none", description: "Place two Scottish followers from the supply into a region, then return a follower from that region to the supply.", url: "https://furtivespy.com/images/king/ambush.png"},
    {name: "Influence", type: "Cunning", suit: "none", description: "Swap one English follower in any region with two non-English followers in another region. ", url: "https://furtivespy.com/images/king/influence.png"},
    {name: "March", type: "Cunning", suit: "none", description: "Move two followers from a single region to a single bordering region.", url: "https://furtivespy.com/images/king/march.png"},
    {name: "Dispute", type: "Cunning", suit: "none", description: "Swap a Welsh follower in any region with a non-Welsh follower in another region.", url: "https://furtivespy.com/images/king/dispute.png"},
    {name: "Plot", type: "Cunning", suit: "none", description: "You cannot take this action during the game. When deciding the winner of the game, reveal this card. It counts as a follower of a faction of your choice.", url: "https://furtivespy.com/images/king/plot.png"},
    {name: "Edict", type: "Cunning", suit: "none", description: "Swap two Scottish followers in any region with two non-Scottish followers in a bordering region.", url: "https://furtivespy.com/images/king/edict.png"},
    {name: "Resist", type: "Cunning", suit: "none", description: "Place two non-Scottish followers from the supply into any region that borders a region controlled by the Scots. If there is no control or instability disc in Moray, you may instead place the followers into a region bordering Moray", url: "https://furtivespy.com/images/king/resist.png"},
    {name: "Muster", type: "Cunning", suit: "none", description: "Return a Scottish follower to the supply from any region that borders a region controlled by the Scots. Then place two followers from the supply into that region. If there is no control or instability disc in Moray, you may instead carry out this action in a region bordering Moray.", url: "https://furtivespy.com/images/king/muster.png"}, 
    {name: "Quell", type: "Cunning", suit: "none", description: "Return a Welsh follower to the supply from any region that borders a region controlled by the Welsh. Then place two followers from the supply into that region. If there is no control or instability disc in Gwynedd, you may instead carry out this action in a region bordering Gwynedd.", url: "https://furtivespy.com/images/king/quell.png"},
    {name: "Suppress", type: "Cunning", suit: "none", description: "Return an English follower to the supply from any region that borders a region controlled by the English. Then return another follower to the supply from that region. Then place a follower from the supply into that region. If there is no control or instability disc in Essex, you may instea", url: "https://furtivespy.com/images/king/suppress.png"},
]
module.exports = new GameDatabase();