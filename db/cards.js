const season = [
    {
      name: `Citadel`,
      type: 'season',
      fileName: 'http://furtivespy.com/images/inis/season/720/citadel.jpg',
      text: `Place 1 Citadel in a teritory with you present; if its Advantage card is not yet played, take it.`,
      players: `all`
    },
    {
      name: `Craftsmen & Peasants`,
      type: 'season',
      fileName: 'http://furtivespy.com/images/inis/season/720/craftsmen%20&%20peasants.jpg',
      text: `In each territory with you present, you may place 1 new clan for each Citadel in that territory.`,
      players: `all`
    },  
    {
      name: `New Alliance`,
      type: 'season',
      fileName: 'http://furtivespy.com/images/inis/season/720/new%20alliance.jpg',
      text: `In territory with your presence, place 1 new clan OR choose an opponent with 2 or more clans and replace 1 with 1 of yours`,
      players: `all`
    },
    {
      name: `Festival`,
      type: 'season',
      fileName: 'http://furtivespy.com/images/inis/season/720/festival.jpg',
      text: `In teritory with 1 or more Sanctuaries with you present, place 1 clan and the Festival token; any player initiating a clash removes 1 of his clans; at Season end remove Festival token`,
      players: `all`
    },
    {
      name: `Raid`,
      type: 'season',
      fileName: 'http://furtivespy.com/images/inis/season/720/raid.jpg',
      text: `During clash after your attack maneuver, take 1 random Action card from attacked player's hand. If not possible, remove 1 of his exposed clans.`,
      players: `4`
    },
    {
      name: `Bard`,
      type: 'season',
      fileName: 'http://furtivespy.com/images/inis/season/720/bard.jpg',
      text: `Draw 1 Epic Tale card or After your maneuver removes opposing clan(s), gain 1 Deed.`,
      players: `all`
    },
    {
      name: `Master Craftsman`,
      type: 'season',
      fileName: 'http://furtivespy.com/images/inis/season/720/master%20craftsman.jpg',
      text: `Discard 1 card (if possible); draw 1 Epic Tale card. OR After you play an Epic Tale card, instead of discarding it, give it to another player; gain 1 Deed.`,
      players: `4`
    },
    {
      name: `Emissaries`,
      type: 'season',
      fileName: 'http://furtivespy.com/images/inis/season/720/emissaries.jpg',
      text: `Move 1 of your clans to any adjacant territory without initiating a clash.`,
      players: `4`
    },
  
    {
      name: `Conquest`,
      type: 'season',
      fileName: 'http://furtivespy.com/images/inis/season/720/conquest.jpg',
      text: `Choose 1 territory; move any number of your clans from adjacent territories into it (clash).`,
      players: `all`
    },
  
    {
      name: `New Clans`,
      type: 'season',
      fileName: 'http://furtivespy.com/images/inis/season/720/new%20clans.jpg',
      text: `Place 2 clans in territories with you present; together OR in 2 different territories.`,
      players: `all`
    },
    {
      name: `Geis`,
      type: 'season',
      fileName: 'http://furtivespy.com/images/inis/season/720/geis.jpg',
      text: `When opponent plays an Action card, ignore the effect of Action card and dicard it.`,
      players: `all`
    },
    {
      name: `Exploration`,
      type: 'season',
      fileName: 'http://furtivespy.com/images/inis/season/720/exploration.jpg',
      text: `Brenn chooses empty location adjacent to 2 territories; place 1 new territory there, place 1 new clan there.`,
      players: `all`
    },
    {
      name: `Migration`,
      type: 'season',
      fileName: 'http://furtivespy.com/images/inis/season/720/migration.jpg',
      text: `Choose 1 territory; move 1 or more of your clans from the chosen territory to adjacent territories.`,
      players: `all`
    },
  
    {
      name: `Warlord`,
      type: 'season',
      fileName: 'http://furtivespy.com/images/inis/season/720/warlord.jpg',
      text: `Initiate a clash in a territory with you present (you are the instigator). OR During clash with you, after any maneuver, place 1 new exposed clan in clashing territory; choose who performs the next maneuver.`,
      players: `all`
    },
    {
      name: `Sanctuary`,
      type: 'season',
      fileName: 'http://furtivespy.com/images/inis/season/720/sanctuary.jpg',
      text: `Place 1 Sanctuary in a territory with you present; draw 1 Epic Tale card.`,
      players: `all`
    },
  
    {
      name: `Druid`,
      type: 'season',
      fileName: 'http://furtivespy.com/images/inis/season/720/druid.jpg',
      text: `If Druid is your last Action card, you cannot play it. Look at the discarded Action cards and take 1.`,
      players: `all`
    },
    {
      name: `Scouts & Spies`,
      type: 'season',
      fileName: 'http://furtivespy.com/images/inis/season/720/scouts%20&%20spies.jpg',
      text: `Look at an opponent's Action cards; move 1 or more of your clans from 1 territory to 1 adjacent territory (clash).`,
      players: `4`
    }
  ];
  
  const epic = [
    {
      name: `The Dagda's Club`,
      type: 'epic',
      fileName: 'http://furtivespy.com/images/inis/epic/720/the%20dagda%27s%20club.jpg',
      text: `When 1 of your clans is removed, do not remove that clan. OR When you perform Attack maneuver, choose whether attacked player removes 1 clan or discards 1 Action card.`
    },
    {
      name: `Tuan's Memory`,
      type: 'epic',
      fileName: 'http://furtivespy.com/images/inis/epic/720/tuan%27s%20memory.jpg',
      text: `Draw 3 Epic Tale cards, take 1, discard the others.`
    },
    {
      name: `The Champion's Share`,
      type: 'epic',
      fileName: 'http://furtivespy.com/images/inis/epic/720/the%20champion%27s%20share.jpg',
      text: `Take the Action card set aside during Assembly phase.`
    },
    {
      name: `Cathbad's Word`,
      type: 'epic',
      fileName: 'http://furtivespy.com/images/inis/epic/720/cathbad%27s%20word.jpg',
      text: `At start of Assembly phase, choose Action card to set aside; at end of Assembly phase, take it, then set aside 1 Action card.`
    },
    {
      name: `Children of Dana`,
      type: 'epic',
      fileName: 'http://furtivespy.com/images/inis/epic/720/children%20of%20dana.jpg',
      text: `Add 1 new clan to any territory.`
    },
    {
      name: `Dagda's Cauldron`,
      type: 'epic',
      fileName: 'http://furtivespy.com/images/inis/epic/720/dagda%27s%20cauldron.jpg',
      text: `During clash, when 1 of your clans is removed, place this card face up in front of you; place up to 3 of your clans removed in the clash on this card (including the 1 just removed); at the end of the clash return all saved clans to territory, discard this card.`
    },
    {
      name: `Dagda's Harp`,
      type: 'epic',
      fileName: 'http://furtivespy.com/images/inis/epic/720/dagda%27s%20harp.jpg',
      text: `For each other Epic Tale card in your hand up to 3, place 1 clan in a territory with you present.`
    },
    {
      name: `Diarmuid and Grainne`,
      type: 'epic',
      fileName: 'http://furtivespy.com/images/inis/epic/720/diarmuid%20and%20grainne.jpg',
      text: ` When 1 of your clans is removed, place removed clan in a different territory with you present without initiating a clash.`
    },
    {
      name: `The Dagda`,
      type: 'epic',
      fileName: 'http://furtivespy.com/images/inis/epic/720/the%20dagda.jpg',
      text: `When Epic Tale card OR Advantage card is played, ignore the effect of that card, and discard it; shuffle that card's deck and discard pile to create a new deck.`
    },
    {
      name: `Lug Samildanach`,
      type: 'epic',
      fileName: 'http://furtivespy.com/images/inis/epic/720/lug%20samildanach.jpg',
      text: `After Action card has been resolved, add that Action card to your hand.`
    },
    {
      name: `Tailtu's Land`,
      type: 'epic',
      fileName: 'http://furtivespy.com/images/inis/epic/720/tailtu%27s%20land.jpg',
      text: `Draw 3 territories, place 1 in empty location adjacent to 2 territories; place others at the bottom of the pile; you may move 1 of your clans from adjacent territories to the new territory.`
    },
    {
      name: `The Morrigan`,
      type: 'epic',
      fileName: 'http://furtivespy.com/images/inis/epic/720/the%20morrigan.jpg',
      text: `You may flip the Flock of Crows token. You man initiate clash in any territory, and you choose 1 player who is present to be the instigator.`
    },
    {
      name: `Battle Frenzy`,
      type: 'epic',
      fileName: 'http://furtivespy.com/images/inis/epic/720/battle%20frenzy.jpg',
      text: `During clash, at the end of Citadels step, take all clans out of citadels, they are now exposed.`
    },
    {
      name: `Nuada Silverhand`,
      type: 'epic',
      fileName: 'http://furtivespy.com/images/inis/epic/720/nuada%20silverhand.jpg',
      text: `In each territory where you are chieftain, you may place 1 new clan for each opponent present.`
    },
    {
      name: `Lug's Spear`,
      type: 'epic',
      fileName: 'http://furtivespy.com/images/inis/epic/720/lug%27s%20spear.jpg',
      text: `At start of clash, Triskel cards CANNOT be played during this clash.`
    },
    {
      name: `The Stone of Fal`,
      type: 'epic',
      fileName: 'http://furtivespy.com/images/inis/epic/720/the%20stone%20of%20fal.jpg',
      text: `Place 2 new clans in Capital's territory.`
    },
    {
      name: `Deirdre's Beauty`,
      type: 'epic',
      fileName: 'http://furtivespy.com/images/inis/epic/720/deirdre%27s%20beauty.jpg',
      text: `Each opponent must reveal 1 random Epic Tale card; take 1 of these, discard the others; remove 1 of your clans from any territory.`
    },
    {
      name: `Manannan's Horses`,
      type: 'epic',
      fileName: 'http://furtivespy.com/images/inis/epic/720/manannan%27s%20horses.jpg',
      text: `Move up to 3 of your clans from 1 territory to 1 other territory anywhere in play.`
    },
    {
      name: `Maeve's Wealth`,
      type: 'epic',
      fileName: 'http://furtivespy.com/images/inis/epic/720/maeve%27s%20wealth.jpg',
      text: `Each player who can gives you 1 Action card; give 1 Action card to each player who gave you 1.`
    },
    {
      name: `Oengus's Ploy`,
      type: 'epic',
      fileName: 'http://furtivespy.com/images/inis/epic/720/oengus%27s%20ploy.jpg',
      text: `At end of any player's turn, take the next turn; if Season phase would have ended, it continues instead.`
    },
    {
      name: `Streng's Resolve`,
      type: 'epic',
      fileName: 'http://furtivespy.com/images/inis/epic/720/streng%27s%20resolve.jpg',
      text: `After your attack maneuver, gain 1 Deed`
    },
    {
      name: `Eriu`,
      type: 'epic',
      fileName: 'http://furtivespy.com/images/inis/epic/720/eriu.jpg',
      text: `In each territory with 1 or more Sanctuaries and you present, you may place 1 new clan (up to 3).`
    },
    {
      name: `Tale of Cuchulain`,
      type: 'epic',
      fileName: 'http://furtivespy.com/images/inis/epic/720/tale%20of%20cuchulain.jpg',
      text: `During clash, as maneuver if you have only 1 exposed clan: remove up to 2 exposed clans from clashing territory.`
    },
    {
      name: `Balor's Eye`,
      type: 'epic',
      fileName: 'http://furtivespy.com/images/inis/epic/720/balor%27s%20eye.jpg',
      text: `Remove 1 clan from any territory.`
    },
    {
      name: `Breas' Tyranny`,
      type: 'epic',
      fileName: 'http://furtivespy.com/images/inis/epic/720/breas%27%20tyranny.jpg',
      text: `Move 1 opposing clan from 1 territory with you present to adjacent territory without initiating a clash.`
    },
    {
      name: `Ogma's Eloquence`,
      type: 'epic',
      fileName: 'http://furtivespy.com/images/inis/epic/720/ogma%27s%20eloquence.jpg',
      text: `During clash, as a maneuver, clash ends immediately.`
    },
    {
      name: `The Fianna`,
      type: 'epic',
      fileName: 'http://furtivespy.com/images/inis/epic/720/the%20fianna.jpg',
      text: `During clash, as a maneuver, move 1 or more of your clans from clashing territory to 1 adjacent territory without initiating a clash.`
    },
    {
      name: `The Other World`,
      type: 'epic',
      fileName: 'http://furtivespy.com/images/inis/epic/720/the%20other%20world.jpg',
      text: `In territory with you present, for each Sanctuary there (up to 3) place 1 new clan or remove 1 opposing clan.`
    },
    {
      name: `The Battle of Moytura`,
      type: 'epic',
      fileName: 'http://furtivespy.com/images/inis/epic/720/the%20battle%20of%20moytura.jpg',
      text: `During clash, as a maneuver, move 1 or more of your clans from 1 or more adjacent territories to clashing territory, place 1 new exposed clan there.`
    },
    {
      name: `Kernuno's Sanctuary`,
      type: 'epic',
      fileName: 'http://furtivespy.com/images/inis/epic/720/kernuno%27s%20sanctuary.jpg',
      text: `In a territory without a Sanctuary and with you present, place 1 new cland and 1 Sanctuary.`
    }
  ]
  
  const land = [
    {
      name: `Lost Vale`,
      type: 'land',
      fileName: 'http://furtivespy.com/images/inis/land/720/lost%20vale.jpg',
      text: `After you play a Season card, move any 1 clan from a territory adjacent to Lost Vale into Lost Vale without initiating a clash.`
    },
    {
      name: `Cove`,
      type: 'land',
      fileName: 'http://furtivespy.com/images/inis/land/720/cove.jpg',
      text: `After you play a Season card, take the Action card set aside during Assembly phase; then set aside 1 Action card.`
    },
    {
      name: `Forest`,
      type: 'land',
      fileName: 'http://furtivespy.com/images/inis/land/720/forest.jpg',
      text: `After you play an Epic Tale card, draw 1 Epic Tale card.`
    },
    {
      name: `Gates of Tir Na Nog`,
      type: 'land',
      fileName: 'http://furtivespy.com/images/inis/land/720/gates%20of%20tir%20na%20nog.jpg',
      text: `When resolving the territory effect of Gate of Tír Na Nóg, draw 1 more Epic Tale card, choose 1, discard the rest.`
    },
    {
      name: `Plains`,
      type: 'land',
      fileName: 'http://furtivespy.com/images/inis/land/720/plains.jpg',
      text: `move 1 or more of your clans to 1 or more adjacent territories.`
    },
    {
      name: `Stone Circle`,
      type: 'land',
      fileName: 'http://furtivespy.com/images/inis/land/720/stone%20circle.jpg',
      text: `After you play an Epic Tale card, remove 1 of your clans from Stone Circle to take back the played Epic Tale card.`
    },
    {
      name: `Valley`,
      type: 'land',
      fileName: 'http://furtivespy.com/images/inis/land/720/valley.jpg',
      text: `After you play a Season card, place 1 new clan in a territory with you present.`
    },
    {
      name: `Iron Mine`,
      type: 'land',
      fileName: 'http://furtivespy.com/images/inis/land/720/iron%20mine.jpg',
      text: `When you perform Attack maneuver, attacked player must BOTH remove 1 exposed clan AND discard 1 Action card.`
    },
    {
      name: `Swamp`,
      type: 'land',
      fileName: 'http://furtivespy.com/images/inis/land/720/swamp.jpg',
      text: `No effect (can be used instead of passing).`
    },
    {
      name: `Hills`,
      type: 'land',
      fileName: 'http://furtivespy.com/images/inis/land/720/hills.jpg',
      text: `When an Attack maneuver is used agains you in Hills, ignore the attack; do not remove 1 of your clans, do not discard 1 Action card.`
    },
    {
      name: `Misty Lands`,
      type: 'land',
      fileName: 'http://furtivespy.com/images/inis/land/720/misty%20lands.jpg',
      text: `Discard 1 or more Action cards, draw that many Epic Tale cards, choose 1, discard the rest.`
    },
    {
      name: `Highlands`,
      type: 'land',
      fileName: 'http://furtivespy.com/images/inis/land/720/highlands.jpg',
      text: `At start of clash in highlands, choose 1 player with 1 or more exposed clands; this player becomes the clash instigator.`
    },
    {
      name: `Meadows`,
      type: 'land',
      fileName: 'http://furtivespy.com/images/inis/land/720/meadows.jpg',
      text: `When you draw an Epic Tale card, draw 1 more Epic Tale card, choose 1, discard the rest.`
    },
    {
      name: `Moor`,
      type: 'land',
      fileName: 'http://furtivespy.com/images/inis/land/720/moor.jpg',
      text: `At any time, Look at the Epic Tale cards in 1 opponent's hand.`
    },
    {
      name: `Mountains`,
      type: 'land',
      fileName: 'http://furtivespy.com/images/inis/land/720/mountains.jpg',
      text: `When you move 1 or more clan to Mountains, ignore the Mountains territory effect.`
    },
    {
      name: `Salt Mine`,
      type: 'land',
      fileName: 'http://furtivespy.com/images/inis/land/720/salt%20mine.jpg',
      text: `After you play a Season card, randomly take 1 Action card from 1 opponent; give that player 1 of your Action cards.`
    },
  ];
  
  const cards = {
      seasons: season,
      epics: epic,
      lands: land
  }

  module.exports = cards;