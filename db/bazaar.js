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
        trades: [
            {left: [bazaarColors.RED],
            right: [bazaarColors.WHITE,bazaarColors.WHITE]},
            {left: [bazaarColors.BLUE],
            right: [bazaarColors.YELLOW,bazaarColors.WHITE,bazaarColors.GREEN]},
            {left: [bazaarColors.YELLOW,bazaarColors.BLUE],
            right: [bazaarColors.GREEN, bazaarColors.RED]},
            {left: [bazaarColors.RED],
            right: [bazaarColors.BLUE,bazaarColors.GREEN,bazaarColors.YELLOW,bazaarColors.WHITE]},
            {left: [bazaarColors.WHITE, bazaarColors.GREEN],
            right: [bazaarColors.YELLOW,bazaarColors.YELLOW,bazaarColors.RED,bazaarColors.BLUE]}
        ]
    },
    {
        marketId: 2,
        trades: [
            {left: [bazaarColors.WHITE],
            right: [bazaarColors.RED,bazaarColors.RED]},
            {left: [bazaarColors.BLUE],
            right: [bazaarColors.YELLOW,bazaarColors.YELLOW,bazaarColors.GREEN]},
            {left: [bazaarColors.GREEN,bazaarColors.GREEN],
            right: [bazaarColors.WHITE,bazaarColors.WHITE]},
            {left: [bazaarColors.RED],
            right: [bazaarColors.BLUE,bazaarColors.BLUE,bazaarColors.YELLOW,bazaarColors.YELLOW]},
            {left: [bazaarColors.BLUE,bazaarColors.BLUE],
            right: [bazaarColors.RED,bazaarColors.RED,bazaarColors.WHITE,bazaarColors.GREEN]},
        ]
    },
    {
        marketId: 3,
        trades: [
            {left: [bazaarColors.GREEN],
            right: [bazaarColors.BLUE,bazaarColors.RED]},
            {left: [bazaarColors.YELLOW],
            right: [bazaarColors.WHITE,bazaarColors.BLUE,bazaarColors.RED]},
            {left: [bazaarColors.YELLOW,bazaarColors.WHITE],
            right: [bazaarColors.RED,bazaarColors.GREEN]},
            {left: [bazaarColors.GREEN,bazaarColors.RED],
            right: [bazaarColors.YELLOW,bazaarColors.WHITE,bazaarColors.BLUE]},
            {left: [bazaarColors.YELLOW,bazaarColors.RED,bazaarColors.WHITE],
            right: [bazaarColors.GREEN,bazaarColors.GREEN,bazaarColors.BLUE]},
        ]
    },
    {
        marketId: 4,
        trades: [
            {left: [bazaarColors.YELLOW],
            right: [bazaarColors.WHITE,bazaarColors.GREEN]},
            {left: [bazaarColors.RED,bazaarColors.RED],
            right: [bazaarColors.BLUE,bazaarColors.YELLOW]},
            {left: [bazaarColors.GREEN,bazaarColors.YELLOW],
            right: [bazaarColors.RED,bazaarColors.BLUE]},
            {left: [bazaarColors.BLUE],
            right: [bazaarColors.WHITE,bazaarColors.WHITE,bazaarColors.GREEN,bazaarColors.YELLOW]},
            {left: [bazaarColors.GREEN,bazaarColors.GREEN],
            right: [bazaarColors.WHITE,bazaarColors.YELLOW,bazaarColors.RED,bazaarColors.BLUE]},
        ]
    },
    {
        marketId: 5,
        trades: [
            {left: [bazaarColors.BLUE],
            right: [bazaarColors.WHITE,bazaarColors.YELLOW]},
            {left: [bazaarColors.WHITE,bazaarColors.WHITE],
            right: [bazaarColors.GREEN,bazaarColors.RED]},
            {left: [bazaarColors.RED,bazaarColors.YELLOW],
            right: [bazaarColors.BLUE,bazaarColors.BLUE]},
            {left: [bazaarColors.GREEN,bazaarColors.WHITE],
            right: [bazaarColors.RED,bazaarColors.RED,bazaarColors.BLUE]},
            {left: [bazaarColors.YELLOW,bazaarColors.YELLOW,bazaarColors.BLUE],
            right: [bazaarColors.GREEN,bazaarColors.GREEN,bazaarColors.WHITE]},
        ]
    },
    {
        marketId: 6,
        trades: [
            {left: [bazaarColors.YELLOW],
            right: [bazaarColors.BLUE,bazaarColors.RED]},
            {left: [bazaarColors.BLUE],
            right: [bazaarColors.WHITE,bazaarColors.WHITE,bazaarColors.GREEN]},
            {left: [bazaarColors.YELLOW,bazaarColors.WHITE],
            right: [bazaarColors.BLUE,bazaarColors.GREEN]},
            {left: [bazaarColors.YELLOW,bazaarColors.YELLOW],
            right: [bazaarColors.BLUE,bazaarColors.RED,bazaarColors.GREEN]},
            {left: [bazaarColors.RED,bazaarColors.RED,bazaarColors.WHITE],
            right: [bazaarColors.GREEN,bazaarColors.YELLOW,bazaarColors.BLUE]},
        ]
    },
    {
        marketId: 7,
        trades: [
            {left: [bazaarColors.WHITE],
            right: [bazaarColors.RED,bazaarColors.YELLOW]},
            {left: [bazaarColors.RED],
            right: [bazaarColors.BLUE,bazaarColors.GREEN,bazaarColors.WHITE]},
            {left: [bazaarColors.BLUE,bazaarColors.BLUE],
            right: [bazaarColors.GREEN,bazaarColors.WHITE]},
            {left: [bazaarColors.YELLOW],
            right: [bazaarColors.WHITE,bazaarColors.RED,bazaarColors.GREEN,bazaarColors.GREEN]},
            {left: [bazaarColors.WHITE,bazaarColors.BLUE],
            right: [bazaarColors.RED,bazaarColors.RED,bazaarColors.YELLOW,bazaarColors.YELLOW]},
        ]
    },
    {
        marketId: 8,
        trades: [
            {left: [bazaarColors.BLUE],
            right: [bazaarColors.GREEN,bazaarColors.GREEN]},
            {left: [bazaarColors.WHITE],
            right: [bazaarColors.GREEN,bazaarColors.RED,bazaarColors.YELLOW]},
            {left: [bazaarColors.RED],
            right: [bazaarColors.YELLOW,bazaarColors.BLUE,bazaarColors.WHITE]},
            {left: [bazaarColors.RED,bazaarColors.GREEN],
            right: [bazaarColors.BLUE,bazaarColors.BLUE,bazaarColors.YELLOW]},
            {left: [bazaarColors.WHITE,bazaarColors.WHITE,bazaarColors.GREEN],
            right: [bazaarColors.BLUE,bazaarColors.YELLOW,bazaarColors.RED]},
        ]
    },
    {
        marketId: 9,
        trades: [
            {left: [bazaarColors.RED],
            right: [bazaarColors.GREEN,bazaarColors.BLUE]},
            {left: [bazaarColors.BLUE],
            right: [bazaarColors.RED,bazaarColors.GREEN,bazaarColors.YELLOW]},
            {left: [bazaarColors.YELLOW],
            right: [bazaarColors.WHITE,bazaarColors.WHITE,bazaarColors.RED]},
            {left: [bazaarColors.GREEN],
            right: [bazaarColors.WHITE,bazaarColors.RED,bazaarColors.YELLOW,bazaarColors.BLUE]},
            {left: [bazaarColors.WHITE,bazaarColors.RED],
            right: [bazaarColors.YELLOW,bazaarColors.YELLOW,bazaarColors.BLUE,bazaarColors.GREEN]},
        ]
    },
    {
        marketId: 10,
        trades: [
            {left: [bazaarColors.GREEN],
            right: [bazaarColors.YELLOW,bazaarColors.WHITE]},
            {left: [bazaarColors.GREEN],
            right: [bazaarColors.BLUE,bazaarColors.RED,bazaarColors.RED]},
            {left: [bazaarColors.WHITE],
            right: [bazaarColors.BLUE,bazaarColors.YELLOW,bazaarColors.RED]},
            {left: [bazaarColors.GREEN,bazaarColors.BLUE],
            right: [bazaarColors.WHITE,bazaarColors.RED,bazaarColors.YELLOW]},
            {left: [bazaarColors.WHITE,bazaarColors.WHITE],
            right: [bazaarColors.BLUE,bazaarColors.YELLOW,bazaarColors.GREEN,bazaarColors.GREEN]},
        ]
    },
]

const data = {
    colors: bazaarColors,
    objectives: bazaarObjectives,
    bazaars: bazaarBazaars
}

module.exports = data;