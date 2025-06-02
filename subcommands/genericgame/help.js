class Help {
    async execute(interaction, client) {
        await interaction.reply({
            content: `🎲 **Welcome to the Generic Game Zone!** 🎲

Hey there, future game master! 👋 Ready to dive into the world of endless fun? 
Here's a list of commands to get you started. Don't worry, they're super easy to use! 😉

**Game Commands:**

*   **/game newgame** 🎮 - Let's get this party started! Starts a brand new game. 🥳
*   **/game newgameplus** ✨ - Feeling fancy? Starts a new game with ✨advanced options✨. Ooh la la!
*   **/game status** 📊 - Curious about what's happening? Shows the current game status. 🤔
*   **/game addplayer** 🙋‍♀️ - The more the merrier! Adds a player to the game. Welcome aboard!
*   **/game removeplayer** 🚶‍♂️ - Need to make some room? Removes a player from the game. See ya later, alligator!
*   **/game next** ⏭️ - Onwards and upwards! Advances to the next turn. Whose turn is it anyway?
*   **/game reverse** 🔄 - UNO REVERSE CARD! Reverses the turn order. Now things are getting interesting! 😜
*   **/game firstplayer** 🥇 - Who's the lucky one? Sets the first player. May the odds be ever in your favor!
*   **/game winner** 🏆 - And the winner is... Declares a winner. Confetti and celebrations! 🎉
*   **/game delete** 🗑️ - All good things must come to an end. Deletes the game. Don't cry because it's over, smile because it happened! 😊
*   **/game addimage** 🖼️ - A picture is worth a thousand words! Adds an image to the game. Say cheese! 📸
*   **/game removeimage** 🚫🖼️ - Changed your mind? Removes an image from the game. Poof! It's gone.
*   **/game addlink** 🔗 - Sharing is caring! Adds a link to the game. Let's see those cool links!
*   **/game removelink** 🚫🔗 - Oops, wrong link? Removes a link from the game. No problemo!
*   **/game addscore** 💯 - Keep track of those points! Adds or updates a player's score. Aim for the high score!
*   **/game test** 🧪 - Just checking things out! For testing purposes. Nothing to see here, folks! 😉

Remember, the most important rule is to have FUN! If you have any questions, don't hesitate to ask (though I'm just a bot, I'll try my best 🤖). 

Now go forth and conquer the game! 💪
`,
            ephemeral: true
        });
    }
}

module.exports = new Help();
