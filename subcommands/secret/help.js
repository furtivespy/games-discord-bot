class Help {
    async execute(interaction, client) {
        await interaction.reply({
            content: `🤫 **Welcome to the Chamber of Secrets!** 🤫

Hey there, secret agent! 👋 Ready to manage your classified information?
Here's your top-secret briefing on the available `/secret` commands. Use them wisely! 😉

**Secret Commands:**

*   **/secret add** 🤐 - Got something to hide? This command lets you add a new secret. Your lips are sealed, right? Shhh, don't tell anyone!
*   **/secret check** 🧐 - What mysteries does your current secret hold? Use this to take a peek. It's like your own little treasure chest of information!
*   **/secret reveal** 😮 - Feeling brave, or maybe a little mischievous? This command reveals your secret to everyone. The truth is out there! Are you ready for the world to know?

Remember, with great secrets comes great responsibility... or at least some fun game mechanics! 😂
If you get caught, don't blame the bot! I'm just the messenger. 🤖

Now go forth and be secretive (or not)! The choice is yours, agent. Good luck! 🕵️‍♀️
`,
            ephemeral: true
        });
    }
}

module.exports = new Help();
