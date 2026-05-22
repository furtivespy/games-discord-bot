const SUITS = [
  { name: "Construction", index: 0, actions: "Build or Repair" },
  { name: "Administration", index: 1, actions: "Tax, Repair, or Influence" },
  { name: "Aggression", index: 2, actions: "Battle, Move, or Secure" },
  { name: "Mobilization", index: 3, actions: "Move or Influence" },
];
const AMBITIONS = { 2: "Tycoon", 3: "Tyrant", 4: "Warlord", 5: "Keeper", 6: "Empath" };

function buildCard(suit, number) {
  const ambitionText =
    number === 1
      ? "No ambition."
      : number === 7
        ? "Declares any ambition."
        : `Declares ${AMBITIONS[number]} ambition.`;
  return {
    name: `${suit.name} ${number}`,
    value: String(number),
    suit: suit.name,
    type: "",
    description: `${suit.actions}. ${ambitionText}`,
    url: `https://furtivespy.com/images/arcs/arcs_${suit.index}_${number - 1}.png`,
  };
}

const arcsActionBase = [];
const arcsActionFull = [];
for (const suit of SUITS) {
  for (let n = 1; n <= 7; n++) {
    const card = buildCard(suit, n);
    arcsActionFull.push(card);
    if (n >= 2 && n <= 6) arcsActionBase.push(card);
  }
}

module.exports = { arcsActionBase, arcsActionFull };
