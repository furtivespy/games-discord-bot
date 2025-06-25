# Repository Context for Feature Development

This document provides context about the repository structure, particularly focusing on command implementation, to aid in future feature development.

## Command Structure

The bot utilizes two main command styles:

1.  **Legacy Prefix Commands:**
    *   Located in the `commands/` directory.
    *   These are traditional prefix-based commands (e.g., `!help`).
    *   They extend `base/Command.js`.
    *   **Note:** These are being phased out in favor of slash commands. New features should generally not be added here unless specifically requested for compatibility.

2.  **Slash Commands (Preferred):**
    *   The primary system for user interaction.
    *   Base class: `base/SlashCommand.js`.
    *   Entry points for slash command groups are defined in the `slashcommands/` directory.
        *   Example: `slashcommands/genericgame/cards.js` likely defines the `/cards` command group.
        *   Example: `slashcommands/genericgame/game.js` likely defines the `/game` command group.
    *   The actual logic for subcommands is implemented in correspondingly named files within the `subcommands/` directory.
        *   Example: Logic for `/cards hand play` would be found in `subcommands/cards/play.js` (or a related file if `play.js` handles multiple "play" actions).
        *   Example: Logic for `/cards hand show` would be in `subcommands/cards/show.js`.
        *   Example: Logic for `/game new` would be in `subcommands/genericgame/newgame.js`.

## Key Files and Directories for Card/Game Features

*   **Slash Command Definitions:**
    *   `/cards` group: `slashcommands/genericgame/cards.js`
    *   `/game` group: `slashcommands/genericgame/game.js`
*   **Slash Subcommand Logic:**
    *   For `/cards ...` subcommands: `subcommands/cards/` (e.g., `play.js`, `show.js`, `discard.js`)
    *   For `/game ...` subcommands: `subcommands/genericgame/` (e.g., `newgame.js`, `status.js`)
*   **Data Structures & Helpers:**
    *   Default game/player data: `db/anygame.js` (contains `defaultGameData`, `defaultPlayer`, etc.)
    *   Card definitions (examples): `db/cards.js` (Inis specific), `db/carddecks.js` (generic decks).
    *   Generic game logic: `modules/GlobalGameHelper.js` (e.g., `getGameData`, `setGameDataV2`).
    *   Card interaction UI (e.g., choosing cards via reactions): `modules/CardsAssistant.js`.
    *   Game display and formatting: `modules/GameFormatter.js` (e.g., `GameStatusV2`, `playerSecretHandAndImages`).
*   **Base Classes:**
    *   `base/SlashCommand.js`
    *   `base/Command.js` (for legacy commands)

## Development Notes for New Features

*   New user-facing commands should primarily be implemented as **slash commands**.
*   When adding a subcommand to an existing group (e.g., a new action under `/cards`), a new file should typically be created in the relevant `subcommands/` subdirectory (e.g., `subcommands/cards/newaction.js`). This file will export a module that handles the subcommand's execution.
*   The main slash command group file (e.g., `slashcommands/genericgame/cards.js`) will need to be updated to register and route to this new subcommand module.
*   Utilize existing helpers in `modules/` for common tasks like data retrieval, card selection, and formatting to maintain consistency.
*   Ensure any modifications to game state are saved using the established mechanism (likely involving `client.setGameDataV2` as seen used by `GlobalGameHelper.js`).
*   Refer to `db/anygame.js` for the standard structure of game data and player data when adding new properties.

This context should help ensure that new features like the "Play Area" are integrated in the intended way, using the modern slash command infrastructure.
