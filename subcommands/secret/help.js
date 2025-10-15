class Help {
    async execute(interaction, client) {
        await interaction.reply({
            content: `🤫 **Welcome to the Chamber of Secrets!** 🤫

Hey there, secret agent! 👋 Ready to manage your classified information?
Here's your top-secret briefing on the available \`/secret\` commands. Use them wisely! 😉

**Secret Commands:**

*   **/secret add** 🤐 - Got something to hide? This command lets you add a new secret. Your lips are sealed, right? Shhh, don't tell anyone!
*   **/secret check** 🧐 - What mysteries does your current secret hold? Use this to take a peek. It's like your own little treasure chest of information!
*   **/secret status** 📊 - Check the status of all secrets. In normal mode, shows who has entered secrets. In super-secret mode, shows only the count!
*   **/secret reveal** 😮 - Feeling brave, or maybe a little mischievous? This command reveals everyone's secrets with their names. The truth is out there! Are you ready for the world to know?
*   **/secret anonreveal** 🎭 - Reveal all secrets anonymously! Perfect for when you want to share the secrets but keep the mystery alive. Who said what? Nobody knows!
*   **/secret mode** ⚙️ - Change the secret mode between Normal and Super Secret! Choose your level of secrecy!

**Secret Modes:**

🔓 **Normal Mode:**
  • Secret entries are visible to everyone
  • Shows who has entered secrets
  • Revealed secrets are shown normally

🔒 **Super Secret Mode:**
  • Secret entries are ephemeral (only you see your entry!)
  • Shows only count of secrets entered, not who entered them
  • Revealed secrets are wrapped in Discord spoiler tags ||like this||
  • Maximum secrecy and suspense!

**Team Support:**
When teams are active in your game, secrets will be grouped by team when revealed! Perfect for team-based games!

Remember, with great secrets comes great responsibility... or at least some fun game mechanics! 😂
If you get caught, don't blame the bot! I'm just the messenger. 🤖

Now go forth and be secretive (or not)! The choice is yours, agent. Good luck! 🕵️‍♀️
`,
            ephemeral: true
        });
    }
}

module.exports = new Help();
