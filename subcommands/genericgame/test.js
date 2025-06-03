const GameDB = require('../../db/anygame.js'); // Included for context, but defaultGameData might not be used.
const { cloneDeep } = require('lodash'); // Included for context, cloneDeep might not be used if data is static.
const Formatter = require('../../modules/GameFormatter');

class Test {
    async execute(interaction, client) { // interaction and client might be undefined or partially mocked in a direct test execution.

        // Define mock gameData directly
        let gameData = {
            name: "Styled Table Test Game",
            players: [
                { userId: "user1", name: "Alice", order: 0, score: 100, hands: { main: [{name:"Card X"}, {name:"Card Y"}] }, tokens: { points: 5, gems: 2 } },
                { userId: "bot1", name: "TestBot", order: 1, score: 150, hands: { main: [{name:"Card Z"}] }, tokens: { points: 3, gems: 1, secretStuff: 1 } },
                { userId: "user2", name: "Bob", order: 2, score: 120, hands: { main: [] }, tokens: { points: 4, gems: 3, secretStuff: 2 } }
            ],
            tokens: [
                { id: "points", name: "Points", isSecret: false },
                { id: "gems", name: "Gems", isSecret: false, cap: 20 },
                { id: "secretStuff", name: "Secret Stuff", isSecret: true, cap: 5 }
            ],
            decks: [ { name: "Adventure Deck", piles: { deck: { cards:[{},{}] }, discard: { cards:[] } }, hiddenInfo: "none" } ],
            isdeleted: false,
            reverseOrder: false
        };

        const mockGuild = {
            members: {
                cache: {
                    get: (userId) => {
                        const player = gameData.players.find(p => p.userId === userId);
                        return player ? { displayName: player.name } : { displayName: userId };
                    }
                }
            }
        };
        
        const clientUserId = 'bot1'; // The bot is 'TestBot' in this scenario

        try {
            console.log('Attempting to call Formatter.GameStatusV2 with mock data...');
            // Ensure clientUserId is passed as the third argument
            const data = await Formatter.GameStatusV2(gameData, mockGuild, clientUserId);

            // The attachment buffer is nested in data.attachment.attachment
            if (data && data.attachment && data.attachment.attachment) {
                console.log('GameStatusV2 returned an attachment object.');
                if (data.attachment.attachment.length > 0) {
                    console.log(`Attachment buffer has length: ${data.attachment.attachment.length}. Test assumed successful.`);
                } else {
                    console.error('Attachment buffer is present but empty.');
                }
            } else {
                console.error('GameStatusV2 did not return a valid attachment structure. Expected data.attachment.attachment.');
            }
        } catch (error) {
            console.error('Error during GameStatusV2 call or processing:', error);
        }

        // Original interaction.reply can be commented out or handled if interaction is properly mocked.
        // if (interaction && typeof interaction.reply === 'function') {
        //     await interaction.reply({
        //         content: `Test command executed. Check console for GameStatusV2 output details.`,
        //         ephemeral: true
        //     });
        // } else {
        //     console.log('Interaction or interaction.reply is not available. Skipping reply.');
        // }
    }
}

module.exports = new Test();