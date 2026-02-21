const { MessageFlags } = require("discord.js");
class Help {
    async execute(interaction, client) {
        const introduction_content = `🎲 **Welcome to the Generic Game Zone!** 🎲

Hey there, future game master! 👋 Ready to dive into the world of endless fun? 
Here's a list of commands to get you started. Don't worry, they're super easy to use! 😉

**Game Commands (Part 1):**`;

        await interaction.reply({ 
            content: introduction_content,
            flags: MessageFlags.Ephemeral 
        });

        const commands_chunk_1 = `*   **/game newgame** 🎮 - Let's get this party started! Starts a brand new game. 🥳
*   **/game newgameplus** ✨ - Feeling fancy? Starts a new game with ✨advanced options✨. Ooh la la!
*   **/game status** 📊 - Curious about what's happening? Shows the current game status, including play area details and images. 🤔
*   **/game next** ⏭️ - Onwards and upwards! Advances to the next turn. Whose turn is it anyway?
*   **/game reverse** 🔄 - UNO REVERSE CARD! Reverses the turn order. Now things are getting interesting! 😜`;

        await interaction.followUp({
            content: commands_chunk_1,
            flags: MessageFlags.Ephemeral
        });

        const commands_chunk_2_intro = `\n**Game Commands (Part 2):**`;
        const commands_chunk_2 = `*   **/game winner** 🏆 - And the winner is... Declares a winner. Confetti and celebrations! 🎉
*   **/game delete** 🗑️ - All good things must come to an end. Deletes the game. Don't cry because it's over, smile because it happened! 😊
*   **/game addimage** 🖼️ - A picture is worth a thousand words! Adds an image to the game. Say cheese! 📸
*   **/game removeimage** 🚫🖼️ - Changed your mind? Removes an image from the game. Poof! It's gone.
*   **/game addlink** 🔗 - Sharing is caring! Adds a link to the game. Let's see those cool links!
*   **/game removelink** 🚫🔗 - Oops, wrong link? Removes a link from the game. No problemo!
*   **/game playarea [mode:on/off]** 🏞️ - Toggles or sets if cards are played to a personal Play Area or the common discard. Default is toggle; specify 'on' or 'off' to set.
*   **/game test** 🧪 - Just checking things out! For testing purposes. Nothing to see here, folks! 😉
*   **/game history** 📜 - Want to see what happened? View the complete game history with filtering and pagination! 🕰️
*   **/game historyadd** ✏️ - Add your own custom notes to the game history. Document those epic moments! 📝`;

        await interaction.followUp({
            content: `${commands_chunk_2_intro}\n${commands_chunk_2}`,
            flags: MessageFlags.Ephemeral
        });

        const conclusion_content = `\nRemember, the most important rule is to have FUN! If you have any questions, don't hesitate to ask (though I'm just a bot, I'll try my best 🤖). 

Now go forth and conquer the game! 💪`;

        await interaction.followUp({
            content: conclusion_content,
            flags: MessageFlags.Ephemeral
        });
    }
}

module.exports = new Help();
