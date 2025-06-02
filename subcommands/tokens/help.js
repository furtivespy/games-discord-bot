class Help {
    async execute(interaction, client) {
        const introduction_content = `🪙 **Welcome to the Token Treasury!** 🪙

Hey token master! 👋 Ready to juggle some awesome tokens?
Here's your handy guide to all the \`/tokens\` commands. Let the token games begin! 🚀`;

        await interaction.reply({ 
            content: introduction_content,
            ephemeral: true 
        });

        const commands_chunk_1_header = `\n**Token Commands (Part 1):**`;
        const commands_chunk_1 = `*   **/tokens create** 🧸 - Got a brilliant idea for a new token? This command lets you create a new type of token. Let your imagination run wild! What will you dream up?
*   **/tokens gain** ✨ - Time to stock up! Use this to gain some tokens. You're getting richer (in tokens, at least)! Ka-ching!
*   **/tokens lose** 💨 - Oh no! Did they slip through your fingers? This command makes you lose some tokens. Oops, where did they go? Maybe they'll turn up later!
*   **/tokens give** 🎁 - Feeling generous? Give some of your tokens to another player. Sharing is caring, and good karma too!
*   **/tokens take** 😈 - Feeling a bit cheeky? This command lets you take tokens from another player. Yoink! All's fair in love and token games, right? (Use with caution! 😉)`;

        await interaction.followUp({
            content: `${commands_chunk_1_header}\n${commands_chunk_1}`,
            ephemeral: true
        });

        const commands_chunk_2_header = `\n**Token Commands (Part 2):**`;
        const commands_chunk_2 = `*   **/tokens check** 🤔 - Curious about the current token situation? Check the token counts. How many do you have? Are you swimming in tokens or running low?
*   **/tokens reveal** 🤩 - Want to show off your impressive collection? Reveal tokens to everyone! Let them gaze upon your token wealth!
*   **/tokens modify** 🎨 - Time for a token makeover! Modify existing tokens, like changing their name or appearance. Pimp your tokens and make them unique!
*   **/tokens remove** 👋 - Is it time to say goodbye? This command removes a type of token from the game. Bye-bye tokens! It was fun while it lasted.`;

        await interaction.followUp({
            content: `${commands_chunk_2_header}\n${commands_chunk_2}`,
            ephemeral: true
        });
        
        const conclusion_content = `\nRemember, tokens are what you make of them! Use them to power up, keep score, or just for fun!
If you need more help, try asking the game master (the human one, not me 🤖).

May your token pouch always be full! 🎉`;

        await interaction.followUp({
            content: conclusion_content,
            ephemeral: true
        });
    }
}

module.exports = new Help();
