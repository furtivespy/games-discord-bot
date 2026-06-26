const { MessageFlags } = require("discord.js");
class Help {
    async execute(interaction, client) {
        const introduction_content = `🤑 **Welcome to the Money Zone!** 🤑

Hey there, high roller! 👋 Ready to make it rain (or just manage your virtual finances)?
Here's a list of commands to help you navigate the world of moolah. Let's get this bread! 🍞`;

        await interaction.reply({ 
            content: introduction_content,
            flags: MessageFlags.Ephemeral 
        });

        const commands_and_conclusion_content = `\n**Money Commands:**

*   **/money take** 💰 - Need some cash? This command lets you take some money. Cha-ching! Hope you're feeling lucky! 🍀
*   **/money spend** 💸 - Got that paper burning a hole in your pocket? Use this to spend your hard-earned cash. Treat yo' self! 🛍️
*   **/money pay** 🤝 - Feeling generous (or maybe you lost a bet 😉)? Pay another player. Sharing is caring... sometimes!
*   **/money check** 👀 - Curious about your financial status? This command lets you check your current balance. Don't be shy, take a peek!
*   **/money reveal** 🕵️ - Feeling bold? Reveal your money to everyone! Or, you know, keep it a secret like a true financial ninja. 🤫 The choice is yours!

Remember, money isn't everything, but it sure makes the game more interesting! 😉
If you have any questions, ask a real human – I'm just a bot trying to count my digital pennies. 🤖

Go forth and prosper (or at least have fun trying)! 🚀`;

        await interaction.followUp({
            content: commands_and_conclusion_content,
            flags: MessageFlags.Ephemeral
        });
    }
}

module.exports = new Help();
