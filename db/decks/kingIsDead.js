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

module.exports = {
  cunningKing,
  kingPlayer,
}
