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
- Hand management (play, show, reveal, return cards)
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
- MongoDB for persistent game state storage
- Node.js backend
- Hosted on Fly.io

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
- Server-based collections for game persistence
- Separate game state tracking per channel
- Support for multiple concurrent games
- Custom card deck management system

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
- MongoDB instance
- Discord Bot Token
- (Optional) Bugsnag API key for error tracking

## Usage

The bot uses Discord's slash command system. Here are some common commands:

### Basic Commands
- `/game newgame` - Start a new game session
- `/game next` - Notify the next player
- `/game status` - Check current game status
- `/game winner` - Declare game winner(s)

### Card Management
- `/cards deck new` - Create a new deck
- `/cards deck draw` - Draw cards
- `/cards hand show` - View your hand
- `/cards hand play` - Play a card
- `/cards draft deal` - Start a card draft

### Information
- `/bgg` - Look up games on Board Game Geek

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- Built with discord.js
- Integrates with BoardGameGeek API
- Special thanks to all contributors and testers and AI assistants




