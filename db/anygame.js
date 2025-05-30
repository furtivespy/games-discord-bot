const Discord = require('discord.js');
const { cloneDeep, forEach } = require('lodash');
const { nanoid } = require('nanoid');

const playingCards = require('./decks/playingCards');
const pairCards = require('./decks/pairCards');
const {
    duneImperium,
    duneIx,
    duneImortal,
    duneUprising,
    duneCHOAM
  } = require('./decks/duneImperium');
const brianBoru = require('./decks/brianBoru');
const { cunningKing, kingPlayer } = require('./decks/kingIsDead');
const { aloneHunt, aloneSurvive } = require('./decks/notAlone');
const { 
    brassTwoPlayer, 
    brassThreePlayer, 
    brassFourPlayer, 
    brassWildLocation, 
    brassWildIndustry 
  } = require('./decks/brassBirmingham');
const blueMoonCity = require('./decks/blueMoonCity');
const guildExplore = require('./decks/guildOfMerchantExplorers');
const { qeIndustry, qeCompany3, qeCompany5 } = require('./decks/quantitativeEasing');
const tigrisTiles = require('./decks/tigrisEuphrates');
const { bloodRageAge1, bloodRageAge2, bloodRageAge3, } = require('./decks/bloodRage');
const money = require('./decks/money');
const {heatBase, heatGeneric, heatUpgrades} = require('./decks/heat');
const empiresEnd = require('./decks/empiresEnd');
const elgrande = require('./decks/elGrande');
const {
    riverboatStar,
    riverboatDiamond,
    riverboatHeart,
    riverboatClub,
    riverboatSpade,
    riverboatWild,
  } = require('./decks/riverboat');
const tajMahal = require('./decks/tajMahal');
const unoCards = require('./decks/uno');
const penguinParty = require('./decks/penguinParty');
const { archipelagoShortObjectives } = require('./decks/archipelagoShortObjectives');
const { archipelagoMediumObjectives } = require('./decks/archipelagoMediumObjectives');
const { archipelagoLongObjectives } = require('./decks/archipelagoLongObjectives');

class GameDatabase {
    
    CurrentCardList = [
        [ "Custom - From CSV", "custom-csv" ],
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
        [ "Riverboat - Cultivation", "riverboat-cultivation"],
        [ "Taj Mahal", "taj-mahal"],
        [ "Uno Classic", "uno-classic"],
        [ "Penguin Party", "penguin-party"],
        [ "Archipelago Short Objectives", "archipelago-short" ],
        [ "Archipelago Medium Objectives", "archipelago-medium" ],
        [ "Archipelago Long Objectives", "archipelago-long" ],
    ]

    defaultGameData = {
        decks: [],
        players: [],
        name: "",
        isdeleted: true,
        winner: null,
        bggGameId: null,
        reverseOrder: false,
        tokens: [],
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
            received: [],
            simultaneous: []
        },
        color: null,
        tokens: {},
    }
    
    defaultHand = {
        deck: "",
        cards: [],
    }

    defaultToken = {
        id: "",
        name: "",
        description: "",
        isSecret: false,
        created: "",
        createdBy: "",
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
            case "riverboat-cultivation":
                let cultivation = [
                    ...Array(7).fill(riverboatStar),
                    ...Array(7).fill(riverboatDiamond),
                    ...Array(7).fill(riverboatHeart),
                    ...Array(7).fill(riverboatClub),
                    ...Array(7).fill(riverboatSpade),
                    ...Array(5).fill(riverboatWild)
                ];
                return this.createCardFromObjList(deckName, "B", cultivation);
            case "taj-mahal":
                return this.createCardFromObjList(deckName, "B", tajMahal);
            case "uno-classic":
                return this.createCardFromObjList(deckName, "B", unoCards);
            case "penguin-party":
                return this.createCardFromObjList(deckName, "B", penguinParty);
            case "archipelago-short":
                return this.createCardFromObjList(deckName, "B", archipelagoShortObjectives);
            case "archipelago-medium":
                return this.createCardFromObjList(deckName, "B", archipelagoMediumObjectives);
            case "archipelago-long":
                return this.createCardFromObjList(deckName, "B", archipelagoLongObjectives);
            default:
                return []
        }
    }
}

module.exports = new GameDatabase();