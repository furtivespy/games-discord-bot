class Help {
    async execute(interaction, client) {
        const introduction_content = `👤 **Welcome to the Player Management Zone!** 👤

Hey there! 👋 Ready to manage players like a pro?
Here's a list of commands to get you started. They're super easy to use! 😉

**Player Commands:**`;

        await interaction.reply({
            content: introduction_content,
            ephemeral: true
        });

        const commands_chunk_1 = `*   **/players add** 🙋‍♀️ - The more the merrier! Adds a player to the game. Welcome aboard!
*   **/players remove** 🚶‍♂️ - Need to make some room? Removes a player from the game. See ya later, alligator!
*   **/players first** 🥇 - Who's the lucky one? Sets the first player. May the odds be ever in your favor!
*   **/players score <score> [player]** 💯 - Set a player's score. If no player is mentioned, it sets your score.
*   **/players color <player> <color>** 🎨 - Feeling colorful? Sets a display color for a player (e.g., #FF0000 or "red").
*   **/players colorall** 🎨 - Set all player colors at once.`;

        await interaction.followUp({
            content: commands_chunk_1,
            ephemeral: true
        });

        const conclusion_content = `
Remember, managing players is key to a smooth game! If you have any questions, don't hesitate to ask (though I'm just a bot, I'll try my best 🤖).`;

        await interaction.followUp({
            content: conclusion_content,
            ephemeral: true
        });
    }
}

module.exports = new Help();
