const GameFormatter = require('./modules/GameFormatter.js');
const assert = require('assert');

async function testSecretStatusAnon() {
    console.log('Running test: testSecretStatusAnon');

    // Mock data
    const secretData = {
        players: [
            { userId: '1', hassecret: true, secret: 'secret1' },
            { userId: '2', hassecret: true, secret: 'secret2' },
            { userId: '3', hassecret: false, secret: '' },
            { userId: '4', hassecret: true, secret: 'secret3' },
        ]
    };
    const guild = null; // Not used by the function

    // Execute the function
    const embed = await GameFormatter.SecretStatusAnon(secretData, guild);

    // Assertions
    assert.strictEqual(embed.data.title, 'Anonymous Secrets', 'Test Failed: Title is incorrect');
    console.log('Assertion Passed: Title is correct');

    const secrets = ['secret1', 'secret2', 'secret3'];
    const descriptionSecrets = embed.data.description.split('\n');

    assert.strictEqual(descriptionSecrets.length, 3, 'Test Failed: Incorrect number of secrets');
    console.log('Assertion Passed: Correct number of secrets');

    secrets.forEach(secret => {
        assert.ok(descriptionSecrets.includes(secret), `Test Failed: Secret "${secret}" not found in description`);
    });
    console.log('Assertion Passed: All secrets are present');

    // It's hard to test for randomness, but we can check that the order is not the same as the original.
    // This is not a perfect test, but it's a good indicator.
    assert.notDeepStrictEqual(descriptionSecrets, secrets, 'Test Failed: Secrets were not shuffled');
    console.log('Assertion Passed: Secrets are shuffled');


    console.log('testSecretStatusAnon passed successfully!');
}

async function testSecretStatusAnonNoSecrets() {
    console.log('Running test: testSecretStatusAnonNoSecrets');

    // Mock data
    const secretData = {
        players: [
            { userId: '1', hassecret: false, secret: '' },
            { userId: '2', hassecret: false, secret: '' },
        ]
    };
    const guild = null; // Not used by the function

    // Execute the function
    const embed = await GameFormatter.SecretStatusAnon(secretData, guild);

    // Assertions
    assert.strictEqual(embed.data.title, 'Anonymous Secrets', 'Test Failed: Title is incorrect');
    console.log('Assertion Passed: Title is correct');

    assert.strictEqual(embed.data.description, 'No secrets to reveal.', 'Test Failed: Incorrect description for no secrets');
    console.log('Assertion Passed: Correct description for no secrets');

    console.log('testSecretStatusAnonNoSecrets passed successfully!');
}


async function runTests() {
    await testSecretStatusAnon();
    await testSecretStatusAnonNoSecrets();
}

runTests().catch(error => {
    console.error('Tests failed:', error);
    process.exit(1);
});