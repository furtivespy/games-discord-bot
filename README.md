# Discord Game Assistant Bot

A versatile Discord bot designed to enhance tabletop and card game experiences in a remote setting. This bot provides robust functionality for managing various aspects of game sessions, from basic dice rolling to complex card management.

## Features

### Game Session Management
- Create and manage game sessions with multiple players
- Track turn order and notify next player
- Support for up to 8 players per game
- Add/remove players during gameplay
- Track scores and declare winners
- Reverse turn order functionality
- Store game-specific resources (rules, images, links)

### Card Game Features
- Comprehensive card management system
- Create and manage multiple card decks
- Support for custom card sets
- Deal cards to players
- Draw cards (single or multiple)
- Discard and recall cards
- Shuffle decks
- Review deck contents
- Card drafting system with pass directions
- Deck building functionality
- Simultaneous card play and reveal
- Hand management (play, view, show, showall, return cards)
- Card stealing mechanics

### Board Game Geek Integration
- Search and display board game information
- Access game descriptions, details, and history
- View game awards and attachments
- Configurable detail levels for game information

### Utility Commands
- Dice rolling system
- Random player selection
- Token management
- Money/resource tracking
- Secret information handling
- Win share tracking

## Technical Implementation

### Core Technologies
- Built with discord.js for Discord integration
- SQLite for persistent game state (`game_documents.sqlite`) and the card-set catalog (`deck_catalog.sqlite`)
- Node.js backend

### Architecture
- Modular design with separate components for:
  - Game formatting and display
  - Card management
  - Board game data integration
  - Error tracking and logging

### External Integrations
- BoardGameGeek API for game information
- Bugsnag for error tracking and monitoring
- Google Search integration for additional game resources

### Database Structure
- Server-based sqlite files for game persistence
- Separate game state tracking per channel
- Support for multiple concurrent games
- Card sets defined in `deck_catalog.sqlite` (not hardcoded JS). New sets are added by publishing from `/catalog`. Fresh installs need a copy of a seeded catalog file (or a production backup); running `/migrate` on an empty catalog will not recreate the built-in sets.

### Development Features
- Comprehensive logging system
- Error tracking and reporting
- Modular command structure
- Extensible game formatter system

## Getting Started

To add this bot to your Discord server, you'll need to:
1. Set up the necessary Discord bot permissions
2. Configure the bot token
3. Install the required dependencies
4. Run the bot on your server

### Prerequisites
- Node.js
- Writable data directory for sqlite files (`game_documents.sqlite`, `deck_catalog.sqlite`)
- Discord Bot Token
- (Optional) Bugsnag API key for error tracking

### QA / local overrides

`QA_UNLOCK_ADMIN_COMMANDS` is a **QA/dev-only** override (not for production). When set to a truthy value such as `1` at startup, admin-only slash commands (including `/config` and its winner-portraits toggle) register without Discord's Administrator `defaultMemberPermissions` gate, and runtime administrator checks are skipped so a non-admin test account can see and run them. Leave it unset in production so those commands stay hidden from non-admins.

`EMBEDDED_APP_MOCK=1` is a **QA/dev-only** override (not for production) that serves the visual-mode embedded app with a Discord SDK shim and fixture game snapshots so QA and agents can screenshot the UI outside Discord. The production Docker image sets `NODE_ENV=production`, which ignores this flag. See [embedded-client/README.md](embedded-client/README.md).

## Usage

The bot uses Discord's slash command system. **Start with `/help`** — it groups commands by area and includes how-tos (create a table, create a deck and add a card, addlist, draw/shuffle, Gather Interest). Deep-link a confused user with `/help topic:decks`.

### Basic Commands
- `/help` - Discover commands and how-tos
- `/game newgame` - Start a new game session
- `/game next` - Notify the next player
- `/game status` - Check current game status
- `/game winner` - Declare game winner(s)

### Card Management
- `/cards deck new` - Create a new deck
- `/cards deck addcard` - Add a card to the in-game recipe (goes to discard)
- `/cards deck addlist` - Bulk-add comma-separated card names
- `/cards deck draw` - Draw cards
- `/cards hand view` - View your hand
- `/cards hand show` - Show a card from your hand
- `/cards hand showall` - Show all cards from your hand
- `/cards hand play` - Play a card
- `/cards draft deal` - Start a card draft

### Information
- `/bgg` - Look up games on Board Game Geek
- `/lfg` - Gather Interest: look up a game on BGG and post a persistent “Who’s interested?” panel (very / somewhat / flexibly interested). Hosts can **Start game**, pick seated players from the interest list and/or anyone on the server, and open a play thread in the configured games channel.
- `/config games-channel` - Administrators set the parent channel where `/lfg` Start game creates those threads. Owner-only: `/catalog`.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- Built with discord.js
- Integrates with BoardGameGeek API
- Special thanks to all contributors and testers and AI assistants




