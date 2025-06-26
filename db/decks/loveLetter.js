// Love Letter cards for 1-4 players
const loveLetterBase = [
    // Princess (1)
    {
        name: "Princess",
        value: "8",
        description: "Lose if discarded.",
        url: "https://furtivespy.com/images/loveletter/loveletter_princess.png"
    },
    
    // Countess (1)
    {
        name: "Countess", 
        value: "7",
        description: "Must be played if you have the King or Prince in hand.",
        url: "https://furtivespy.com/images/loveletter/loveletter_countess.png"
    },
    
    // King (1)
    {
        name: "King",
        value: "6", 
        description: "Trade hands with another player.",
        url: "https://furtivespy.com/images/loveletter/loveletter_king.png"
    },
    
    // Prince (2)
    {
        name: "Prince",
        value: "5",
        description: "Choose a player. They discard their hand and draw a new card.",
        url: "https://furtivespy.com/images/loveletter/loveletter_prince.png"
    },
    {
        name: "Prince",
        value: "5", 
        description: "Choose a player. They discard their hand and draw a new card.",
        url: "https://furtivespy.com/images/loveletter/loveletter_prince.png"
    },
    
    // Handmaid (2)
    {
        name: "Handmaid",
        value: "4",
        description: "You cannot be chosen until your next turn.",
        url: "https://furtivespy.com/images/loveletter/loveletter_handmaid.png"
    },
    {
        name: "Handmaid",
        value: "4",
        description: "You cannot be chosen until your next turn.", 
        url: "https://furtivespy.com/images/loveletter/loveletter_handmaid.png"
    },
    
    // Baron (2)
    {
        name: "Baron",
        value: "3",
        description: "Compare hands with another player; lower number is out.",
        url: "https://furtivespy.com/images/loveletter/loveletter_baron.png"
    },
    {
        name: "Baron",
        value: "3",
        description: "Compare hands with another player; lower number is out.",
        url: "https://furtivespy.com/images/loveletter/loveletter_baron.png" 
    },
    
    // Priest (2)
    {
        name: "Priest",
        value: "2",
        description: "Look at a player's hand.",
        url: "https://furtivespy.com/images/loveletter/loveletter_priest.png"
    },
    {
        name: "Priest", 
        value: "2",
        description: "Look at a player's hand.",
        url: "https://furtivespy.com/images/loveletter/loveletter_priest.png"
    },
    
    // Guard (5)
    {
        name: "Guard",
        value: "1",
        description: "Guess a player's hand; if correct, that player is out.",
        url: "https://furtivespy.com/images/loveletter/loveletter_guard.png"
    },
    {
        name: "Guard",
        value: "1", 
        description: "Guess a player's hand; if correct, that player is out.",
        url: "https://furtivespy.com/images/loveletter/loveletter_guard.png"
    },
    {
        name: "Guard",
        value: "1",
        description: "Guess a player's hand; if correct, that player is out.",
        url: "https://furtivespy.com/images/loveletter/loveletter_guard.png"
    },
    {
        name: "Guard",
        value: "1",
        description: "Guess a player's hand; if correct, that player is out.",
        url: "https://furtivespy.com/images/loveletter/loveletter_guard.png"
    },
    {
        name: "Guard", 
        value: "1",
        description: "Guess a player's hand; if correct, that player is out.",
        url: "https://furtivespy.com/images/loveletter/loveletter_guard.png"
    }
];

// Additional cards for 5-8 players
const loveLetterExpansion = [
    // Bishop (1)
    {
        name: "Bishop",
        value: "9",
        description: "Guess a player's hand; if correct, gain an Affection Token.",
        url: "https://furtivespy.com/images/loveletter/loveletter_bishop.png"
    },
    
    // Dowager Queen (1)
    {
        name: "Dowager Queen",
        value: "7", 
        description: "Compare hands with another player; higher number is out.",
        url: "https://furtivespy.com/images/loveletter/loveletter_queen.png"
    },
    
    // Constable (1)
    {
        name: "Constable",
        value: "6",
        description: "If eliminated with this card in your discard pile, you gain an Affection Token.",
        url: "https://furtivespy.com/images/loveletter/loveletter_constable.png"
    },
    
    // Count (2)
    {
        name: "Count",
        value: "5",
        description: "If in discard at the end of a round, add 1 to the number on the card in your hand.",
        url: "https://furtivespy.com/images/loveletter/loveletter_count.png"
    },
    {
        name: "Count",
        value: "5",
        description: "If in discard at the end of a round, add 1 to the number on the card in your hand.",
        url: "https://furtivespy.com/images/loveletter/loveletter_count.png"
    },
    
    // Sycophant (2)
    {
        name: "Sycophant",
        value: "4",
        description: "Choose a player. The next card must target them.",
        url: "https://furtivespy.com/images/loveletter/loveletter_sycophant.png"
    },
    {
        name: "Sycophant",
        value: "4",
        description: "Choose a player. The next card must target them.",
        url: "https://furtivespy.com/images/loveletter/loveletter_sycophant.png"
    },
    
    // Baroness (2)
    {
        name: "Baroness",
        value: "3",
        description: "Choose 1 or 2 players. Look at their hands.",
        url: "https://furtivespy.com/images/loveletter/loveletter_baroness.png"
    },
    {
        name: "Baroness",
        value: "3", 
        description: "Choose 1 or 2 players. Look at their hands.",
        url: "https://furtivespy.com/images/loveletter/loveletter_baroness.png"
    },
    
    // Cardinal (2)
    {
        name: "Cardinal",
        value: "2",
        description: "Choose 2 players to switch hands; you look at one.",
        url: "https://furtivespy.com/images/loveletter/loveletter_cardinal.png"
    },
    {
        name: "Cardinal",
        value: "2",
        description: "Choose 2 players to switch hands; you look at one.",
        url: "https://furtivespy.com/images/loveletter/loveletter_cardinal.png"
    },
    
    // Jester (1)
    {
        name: "Jester",
        value: "0",
        description: "If the chosen player wins the round, gain an Affection Token.",
        url: "https://furtivespy.com/images/loveletter/loveletter_jester.png"
    },
    
    // Assassin (1)
    {
        name: "Assassin",
        value: "0",
        description: "A player using a Guard on you is out and you are not. Discard and draw.",
        url: "https://furtivespy.com/images/loveletter/loveletter_assassin.png"
    },
    
    // Additional Guards for 5-8 player version (3 more to make 8 total)
    {
        name: "Guard",
        value: "1",
        description: "Guess a player's hand; if correct, that player is out.",
        url: "https://furtivespy.com/images/loveletter/loveletter_guard.png"
    },
    {
        name: "Guard",
        value: "1",
        description: "Guess a player's hand; if correct, that player is out.",
        url: "https://furtivespy.com/images/loveletter/loveletter_guard.png"
    },
    {
        name: "Guard",
        value: "1", 
        description: "Guess a player's hand; if correct, that player is out.",
        url: "https://furtivespy.com/images/loveletter/loveletter_guard.png"
    }
];

module.exports = {
    loveLetterBase,
    loveLetterExpansion
}; 