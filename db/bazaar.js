const bazaarColors = {
    BLUE: 1,
    GREEN: 2,
    YELLOW: 3,
    WHITE: 4,
    RED: 5
};

const bazaarObjectives = [
    {
        goal: [bazaarColors.BLUE,bazaarColors.BLUE,bazaarColors.BLUE,bazaarColors.BLUE,bazaarColors.BLUE],
        stars: 1
    },
    {
        goal: [bazaarColors.WHITE,bazaarColors.WHITE,bazaarColors.WHITE,bazaarColors.WHITE,bazaarColors.WHITE],
        stars: 1
    },
    {
        goal: [bazaarColors.RED,bazaarColors.RED,bazaarColors.RED,bazaarColors.RED,bazaarColors.RED],
        stars: 1
    },
    {
        goal: [bazaarColors.YELLOW,bazaarColors.YELLOW,bazaarColors.YELLOW,bazaarColors.YELLOW,bazaarColors.YELLOW],
        stars: 1
    },
    {
        goal: [bazaarColors.GREEN,bazaarColors.GREEN,bazaarColors.GREEN,bazaarColors.GREEN,bazaarColors.GREEN],
        stars: 1
    },
    {
        goal: [bazaarColors.YELLOW,bazaarColors.WHITE,bazaarColors.WHITE,bazaarColors.WHITE,bazaarColors.WHITE],
        stars: 1
    },
    {
        goal: [bazaarColors.BLUE,bazaarColors.GREEN,bazaarColors.GREEN,bazaarColors.GREEN,bazaarColors.GREEN],
        stars: 1
    },
    {
        goal: [bazaarColors.YELLOW,bazaarColors.GREEN,bazaarColors.GREEN,bazaarColors.GREEN,bazaarColors.GREEN],
        stars: 1
    },
    {
        goal: [bazaarColors.RED,bazaarColors.RED,bazaarColors.RED,bazaarColors.RED,bazaarColors.GREEN],
        stars: 1
    },
    {
        goal: [bazaarColors.RED,bazaarColors.RED,bazaarColors.RED,bazaarColors.RED,bazaarColors.WHITE],
        stars: 1
    },
    {
        goal: [bazaarColors.WHITE,bazaarColors.WHITE,bazaarColors.WHITE,bazaarColors.WHITE,bazaarColors.GREEN],
        stars: 1
    },
    {
        goal: [bazaarColors.BLUE,bazaarColors.BLUE,bazaarColors.BLUE,bazaarColors.BLUE,bazaarColors.WHITE],
        stars: 1
    },
    {
        goal: [bazaarColors.BLUE,bazaarColors.BLUE,bazaarColors.BLUE,bazaarColors.BLUE,bazaarColors.RED],
        stars: 1
    },
    {
        goal: [bazaarColors.BLUE,bazaarColors.YELLOW,bazaarColors.YELLOW,bazaarColors.YELLOW,bazaarColors.YELLOW],
        stars: 1
    },
    {
        goal: [bazaarColors.WHITE,bazaarColors.WHITE,bazaarColors.WHITE,bazaarColors.RED,bazaarColors.RED],
        stars: 0
    },
    {
        goal: [bazaarColors.RED,bazaarColors.RED,bazaarColors.RED,bazaarColors.BLUE,bazaarColors.BLUE],
        stars: 0
    },
    {
        goal: [bazaarColors.GREEN,bazaarColors.GREEN,bazaarColors.GREEN,bazaarColors.WHITE,bazaarColors.WHITE],
        stars: 0
    },
    {
        goal: [bazaarColors.YELLOW,bazaarColors.YELLOW,bazaarColors.YELLOW,bazaarColors.WHITE,bazaarColors.WHITE],
        stars: 0
    },
    {
        goal: [bazaarColors.YELLOW,bazaarColors.YELLOW,bazaarColors.YELLOW,bazaarColors.GREEN,bazaarColors.GREEN],
        stars: 0
    },
    {
        goal: [bazaarColors.RED,bazaarColors.RED,bazaarColors.RED,bazaarColors.YELLOW,bazaarColors.YELLOW],
        stars: 0
    },
    {
        goal: [bazaarColors.WHITE,bazaarColors.WHITE,bazaarColors.WHITE,bazaarColors.BLUE,bazaarColors.BLUE],
        stars: 0
    },
    {
        goal: [bazaarColors.BLUE,bazaarColors.BLUE,bazaarColors.BLUE,bazaarColors.GREEN,bazaarColors.GREEN],
        stars: 0
    },
    {
        goal: [bazaarColors.BLUE,bazaarColors.BLUE,bazaarColors.BLUE,bazaarColors.YELLOW,bazaarColors.YELLOW],
        stars: 0
    },
    {
        goal: [bazaarColors.GREEN,bazaarColors.GREEN,bazaarColors.GREEN,bazaarColors.RED,bazaarColors.RED],
        stars: 0
    },
    {
        goal: [bazaarColors.YELLOW,bazaarColors.RED,bazaarColors.GREEN,bazaarColors.BLUE,bazaarColors.WHITE],
        stars: 0
    },
    {
        goal: [bazaarColors.YELLOW,bazaarColors.RED,bazaarColors.GREEN,bazaarColors.BLUE,bazaarColors.WHITE],
        stars: 0
    },
    {
        goal: [bazaarColors.YELLOW,bazaarColors.RED,bazaarColors.GREEN,bazaarColors.BLUE,bazaarColors.WHITE],
        stars: 0
    },
    {
        goal: [bazaarColors.GREEN,bazaarColors.RED,bazaarColors.YELLOW,bazaarColors.WHITE,bazaarColors.BLUE],
        stars: 0
    },
    {
        goal: [bazaarColors.GREEN,bazaarColors.RED,bazaarColors.YELLOW,bazaarColors.WHITE,bazaarColors.BLUE],
        stars: 0
    },
    {
        goal: [bazaarColors.RED,bazaarColors.GREEN,bazaarColors.GREEN,bazaarColors.BLUE,bazaarColors.BLUE],
        stars: 0
    },
    {
        goal: [bazaarColors.GREEN,bazaarColors.RED,bazaarColors.RED,bazaarColors.BLUE,bazaarColors.BLUE],
        stars: 0
    },
    {
        goal: [bazaarColors.WHITE,bazaarColors.YELLOW,bazaarColors.YELLOW,bazaarColors.GREEN,bazaarColors.GREEN],
        stars: 0
    },
    {
        goal: [bazaarColors.YELLOW,bazaarColors.WHITE,bazaarColors.WHITE,bazaarColors.GREEN,bazaarColors.GREEN],
        stars: 0
    },
    {
        goal: [bazaarColors.RED,bazaarColors.BLUE,bazaarColors.BLUE,bazaarColors.WHITE,bazaarColors.WHITE],
        stars: 0
    },
    {
        goal: [bazaarColors.BLUE,bazaarColors.GREEN,bazaarColors.GREEN,bazaarColors.YELLOW,bazaarColors.YELLOW],
        stars: 0
    },
    {
        goal: [bazaarColors.BLUE,bazaarColors.RED,bazaarColors.RED,bazaarColors.GREEN,bazaarColors.GREEN],
        stars: 0
    },
    {
        goal: [bazaarColors.YELLOW,bazaarColors.WHITE,bazaarColors.WHITE,bazaarColors.RED,bazaarColors.RED],
        stars: 0
    },
    {
        goal: [bazaarColors.YELLOW,bazaarColors.WHITE,bazaarColors.WHITE,bazaarColors.BLUE,bazaarColors.BLUE],
        stars: 0
    },
    {
        goal: [bazaarColors.BLUE,bazaarColors.RED,bazaarColors.RED,bazaarColors.WHITE,bazaarColors.WHITE],
        stars: 0
    },
    {
        goal: [bazaarColors.GREEN,bazaarColors.YELLOW,bazaarColors.YELLOW,bazaarColors.RED,bazaarColors.RED],
        stars: 0
    },
    {
        goal: [bazaarColors.WHITE,bazaarColors.BLUE,bazaarColors.BLUE,bazaarColors.GREEN,bazaarColors.GREEN],
        stars: 0
    },
    {
        goal: [bazaarColors.RED,bazaarColors.YELLOW,bazaarColors.YELLOW,bazaarColors.WHITE,bazaarColors.WHITE],
        stars: 0
    },
    {
        goal: [bazaarColors.WHITE,bazaarColors.BLUE,bazaarColors.BLUE,bazaarColors.YELLOW,bazaarColors.YELLOW],
        stars: 0
    },
    {
        goal: [bazaarColors.WHITE,bazaarColors.RED,bazaarColors.RED,bazaarColors.YELLOW,bazaarColors.YELLOW],
        stars: 0
    },
    {
        goal: [bazaarColors.GREEN,bazaarColors.BLUE,bazaarColors.BLUE,bazaarColors.YELLOW,bazaarColors.YELLOW],
        stars: 0
    },
];

const bazaarBazaars = [
    {
        marketId: 1,
        left1: [bazaarColors.RED],
        right1: [bazaarColors.WHITE,bazaarColors.WHITE],
        left2: [bazaarColors.BLUE],
        right2: [bazaarColors.YELLOW,bazaarColors.WHITE,bazaarColors.GREEN],
        left3: [bazaarColors.YELLOW,bazaarColors.BLUE],
        right3:[bazaarColors.GREEN, bazaarColors.RED],
        left4: [bazaarColors.RED],
        right4:[bazaarColors.BLUE,bazaarColors.GREEN,bazaarColors.YELLOW,bazaarColors.WHITE],
        left5: [bazaarColors.WHITE, bazaarColors.GREEN],
        right5: [bazaarColors.YELLOW,bazaarColors.YELLOW,bazaarColors.RED,bazaarColors.BLUE]
    },
    {
        marketId: 2,
        left1: [],
        right1: [],
        left2: [],
        right2: [],
        left3: [],
        right3:[],
        left4: [],
        right4:[],
        left5: [],
        right5: []
    },
    {
        marketId: 3,
        left1: [],
        right1: [],
        left2: [],
        right2: [],
        left3: [],
        right3:[],
        left4: [],
        right4:[],
        left5: [],
        right5: []
    },
    {
        marketId: 4,
        left1: [],
        right1: [],
        left2: [],
        right2: [],
        left3: [],
        right3:[],
        left4: [],
        right4:[],
        left5: [],
        right5: []
    },
    {
        marketId: 5,
        left1: [],
        right1: [],
        left2: [],
        right2: [],
        left3: [],
        right3:[],
        left4: [],
        right4:[],
        left5: [],
        right5: []
    },
    {
        marketId: 6,
        left1: [],
        right1: [],
        left2: [],
        right2: [],
        left3: [],
        right3:[],
        left4: [],
        right4:[],
        left5: [],
        right5: []
    },
    {
        marketId: 7,
        left1: [],
        right1: [],
        left2: [],
        right2: [],
        left3: [],
        right3:[],
        left4: [],
        right4:[],
        left5: [],
        right5: []
    },
    {
        marketId: 8,
        left1: [],
        right1: [],
        left2: [],
        right2: [],
        left3: [],
        right3:[],
        left4: [],
        right4:[],
        left5: [],
        right5: []
    },
    {
        marketId: 9,
        left1: [],
        right1: [],
        left2: [],
        right2: [],
        left3: [],
        right3:[],
        left4: [],
        right4:[],
        left5: [],
        right5: []
    },
    {
        marketId: 10,
        left1: [],
        right1: [],
        left2: [],
        right2: [],
        left3: [],
        right3:[],
        left4: [],
        right4:[],
        left5: [],
        right5: []
    },
]

const data = {
    colors: bazaarColors,
    objectives: bazaarObjectives,
    bazaars: bazaarBazaars
}

module.exports = data;