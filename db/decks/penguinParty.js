
const PengRed =  Array(7).fill({name: "Red Penguin", type: "🟥", suit: "Red", value: 1, url: "http://www.furtivespy.com/images/penguinparty/ppred.png"})
const PengBlue =  Array(7).fill({name: "Blue Penguin", type: "🟦", suit: "Blue", value: 1, url: "http://www.furtivespy.com/images/penguinparty/ppblue.png"})
const PengPurple =  Array(7).fill({name: "Purple Penguin", type: "🟪", suit: "Purple", value: 1, url: "http://www.furtivespy.com/images/penguinparty/pppurple.png"})
const PengYellow =  Array(7).fill({name: "Yellow Penguin", type: "🟨", suit: "Yellow", value: 1, url: "http://www.furtivespy.com/images/penguinparty/ppyellow.png"})
const PengGreen =  Array(8).fill({name: "Green Penguin", type: "🟩", suit: "Green", value: 1, url: "http://www.furtivespy.com/images/penguinparty/ppgreen.png"})

const PengParty = [...PengRed, ...PengBlue, ...PengPurple, ...PengYellow, ...PengGreen]

module.exports = PengParty
