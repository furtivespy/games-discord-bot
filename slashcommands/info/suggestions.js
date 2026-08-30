const SlashCommand = require("../../base/SlashCommand.js");
const {SlashCommandBuilder, MessageFlags, InteractionContextType, ApplicationIntegrationType} = require("discord.js");
const { cloneDeep } = require("lodash");
const { nanoid } = require("nanoid");
const SuggestionStore = require("../../modules/SuggestionStore");

// Status constants with emojis
const SUGGESTION_STATUS = {
  SUGGESTED: 'SUGGESTED',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
  REJECTED: 'REJECTED'
};

const STATUS_EMOJIS = {
  [SUGGESTION_STATUS.SUGGESTED]: '💡',
  [SUGGESTION_STATUS.IN_PROGRESS]: '🔨',
  [SUGGESTION_STATUS.COMPLETED]: '✅',
  [SUGGESTION_STATUS.REJECTED]: '❌'
};

// Status colors for embeds (decimal values)
const STATUS_COLORS = {
  [SUGGESTION_STATUS.SUGGESTED]: 16753920,  // Orange (FFA500)
  [SUGGESTION_STATUS.IN_PROGRESS]: 3447003, // Blue (3498DB)
  [SUGGESTION_STATUS.COMPLETED]: 3066993,   // Green (2ECC71)
  [SUGGESTION_STATUS.REJECTED]: 15158332,   // Red (E74C3C)
  DEFAULT: 4130114                         // Original color
};

// Filter constants
const FILTER_OPTIONS = {
  ALL: 'ALL',
  ACTIVE: 'ACTIVE'
};

// Active statuses (for ACTIVE filter)
const ACTIVE_STATUSES = [SUGGESTION_STATUS.SUGGESTED, SUGGESTION_STATUS.IN_PROGRESS];

// Pagination
const SUGGESTIONS_PER_PAGE = 10;

// Admin user ID for notifications
const ADMIN_USER_ID = '84025085047869440'; // TODO: Replace with actual admin ID

const defaultSuggestionObject = {
  ...SuggestionStore.defaultSuggestion,
  status: SUGGESTION_STATUS.SUGGESTED,
};

const defaultSuggestionsObject = {
  suggestions: [],
};

function displayNameFor(interaction) {
  return interaction.member?.displayName || interaction.user.globalName || interaction.user.username;
}

class Suggest extends SlashCommand {
  constructor(client) {
    super(client, {
      name: "suggest",
      description: "Manage global feature suggestions",
      usage: "suggest <add|list|vote|status>",
      enabled: true,
      permLevel: "User",
    });
    this.data = new SlashCommandBuilder()
      .setName(this.help.name)
      .setDescription(this.help.description)
      .setDMPermission(true)
      .setContexts(InteractionContextType.Guild, InteractionContextType.BotDM, InteractionContextType.PrivateChannel)
      .setIntegrationTypes(ApplicationIntegrationType.GuildInstall, ApplicationIntegrationType.UserInstall)
      .addSubcommand(subcommand =>
        subcommand
          .setName('add')
          .setDescription('Add a new suggestion')
          .addStringOption(option =>
            option
              .setName('suggestion')
              .setDescription('Your suggestion')
              .setRequired(true)
          )
      )
      .addSubcommand(subcommand =>
        subcommand
          .setName('list')
          .setDescription('List all current suggestions')
          .addStringOption(option =>
            option
              .setName('filter')
              .setDescription('Filter suggestions by status')
              .addChoices(
                { name: '💡🔨 Active (Suggested & In Progress)', value: FILTER_OPTIONS.ACTIVE },
                { name: 'All', value: FILTER_OPTIONS.ALL },
                { name: '💡 Suggested', value: SUGGESTION_STATUS.SUGGESTED },
                { name: '🔨 In Progress', value: SUGGESTION_STATUS.IN_PROGRESS },
                { name: '✅ Completed', value: SUGGESTION_STATUS.COMPLETED },
                { name: '❌ Rejected', value: SUGGESTION_STATUS.REJECTED }
              )
          )
          .addStringOption(option =>
            option
              .setName('sort')
              .setDescription('Sort suggestions by')
              .addChoices(
                { name: 'Most Votes', value: 'VOTES' },
                { name: 'Newest First', value: 'NEWEST' },
                { name: 'Oldest First', value: 'OLDEST' }
              )
          )
          .addIntegerOption(option =>
            option
              .setName('page')
              .setDescription('Page number to view')
              .setMinValue(1)
          )
      )
      .addSubcommand(subcommand =>
        subcommand
          .setName('vote')
          .setDescription('Vote for a suggestion')
          .addStringOption(option =>
            option
              .setName('suggestion')
              .setDescription('Choose which suggestion to vote for')
              .setAutocomplete(true)
              .setRequired(true)
          )
      )
      .addSubcommand(subcommand =>
        subcommand
          .setName('status')
          .setDescription('Update the status of a suggestion (Admin only)')
          .addStringOption(option =>
            option
              .setName('suggestion')
              .setDescription('Choose which suggestion to update')
              .setAutocomplete(true)
              .setRequired(true)
          )
          .addStringOption(option =>
            option
              .setName('status')
              .setDescription('The new status')
              .addChoices(
                { name: '💡 Suggested', value: SUGGESTION_STATUS.SUGGESTED },
                { name: '🔨 In Progress', value: SUGGESTION_STATUS.IN_PROGRESS },
                { name: '✅ Completed', value: SUGGESTION_STATUS.COMPLETED },
                { name: '❌ Rejected', value: SUGGESTION_STATUS.REJECTED }
              )
              .setRequired(true)
          )
      );
  }

  migrateSuggestion(oldSuggestion) {
    return SuggestionStore.ensureSuggestionShape(oldSuggestion);
  }

  sortSuggestions(suggestions, sortBy = 'VOTES') {
    return [...suggestions].sort((a, b) => {
      switch (sortBy) {
        case 'VOTES':
          return b.votes.count - a.votes.count;
        case 'NEWEST':
          return new Date(b.createdAt) - new Date(a.createdAt);
        case 'OLDEST':
          return new Date(a.createdAt) - new Date(b.createdAt);
        default:
          return b.votes.count - a.votes.count;
      }
    });
  }

  getStatusCounts(suggestions) {
    const counts = {
      [SUGGESTION_STATUS.SUGGESTED]: 0,
      [SUGGESTION_STATUS.IN_PROGRESS]: 0,
      [SUGGESTION_STATUS.COMPLETED]: 0,
      [SUGGESTION_STATUS.REJECTED]: 0,
      total: suggestions.length
    };

    suggestions.forEach(suggestion => {
      counts[suggestion.status] = (counts[suggestion.status] || 0) + 1;
    });

    return counts;
  }

  getStatusStats(counts) {
    return [
      `${STATUS_EMOJIS[SUGGESTION_STATUS.SUGGESTED]} Suggested: ${counts[SUGGESTION_STATUS.SUGGESTED]}`,
      `${STATUS_EMOJIS[SUGGESTION_STATUS.IN_PROGRESS]} In Progress: ${counts[SUGGESTION_STATUS.IN_PROGRESS]}`,
      `${STATUS_EMOJIS[SUGGESTION_STATUS.COMPLETED]} Completed: ${counts[SUGGESTION_STATUS.COMPLETED]}`,
      `${STATUS_EMOJIS[SUGGESTION_STATUS.REJECTED]} Rejected: ${counts[SUGGESTION_STATUS.REJECTED]}`
    ].join(' • ');
  }

  async execute(interaction) {
    try {
      // Handle autocomplete for vote and status commands
      if (interaction.isAutocomplete()) {
        const search = interaction.options.getString('suggestion')?.toLowerCase() || '';
        const suggestionData = Object.assign(
          {},
          cloneDeep(defaultSuggestionsObject),
          await SuggestionStore.loadGlobalSuggestions(this.client)
        );

        // Filter suggestions based on search term and status
        const filteredSuggestions = suggestionData.suggestions
          .filter(s => {
            // For voting, only show active suggestions
            if (interaction.options.getSubcommand() === 'vote') {
              return ACTIVE_STATUSES.includes(s.status) && 
                (search === '' || s.suggestion.toLowerCase().includes(search));
            }
            // For status updates (admin), show all suggestions
            return search === '' || 
              s.suggestion.toLowerCase().includes(search) || 
              s.id.toLowerCase().includes(search);
          })
          .slice(0, 25); // Limit to 25 results

        await interaction.respond(
          filteredSuggestions.map(s => ({
            name: `${STATUS_EMOJIS[s.status]} ${s.suggestion.slice(0, 80)}${s.suggestion.length > 80 ? '...' : ''} (${s.votes.count} votes)`,
            value: s.id
          }))
        );
        return;
      }

      const subcommand = interaction.options.getSubcommand();

      const [, rawSuggestionData] = await Promise.all([
        interaction.deferReply({ flags: MessageFlags.Ephemeral }),
        SuggestionStore.loadGlobalSuggestions(this.client)
      ]);
      let suggestionData = Object.assign(
        {},
        cloneDeep(defaultSuggestionsObject),
        rawSuggestionData
      );

      // Migrate any existing suggestions that don't have all fields
      if (suggestionData.suggestions.length > 0) {
        const migratedSuggestions = suggestionData.suggestions.map(s => this.migrateSuggestion(s));
        if (JSON.stringify(migratedSuggestions) !== JSON.stringify(suggestionData.suggestions)) {
          suggestionData.suggestions = migratedSuggestions;
          await SuggestionStore.saveGlobalSuggestions(this.client, suggestionData);
          this.client.logger.log('Migrated suggestions data to new format', 'debug');
        }
      }

      let confirmMessage = '';

      if (subcommand === 'add') {
        const suggestion = interaction.options.getString('suggestion')?.trim();
        if (!suggestion) {
          await interaction.editReply({ content: 'Suggestion text cannot be empty.'});
          return;
        }

        const existing = SuggestionStore.findMatchingSuggestion(suggestionData.suggestions, suggestion);
        if (existing) {
          const userId = interaction.user.id;
          if (interaction.guildId) {
            existing.sourceGuildIds = existing.sourceGuildIds || [];
            if (!existing.sourceGuildIds.includes(interaction.guildId)) {
              existing.sourceGuildIds.push(interaction.guildId);
            }
          }
          if (!existing.votes.voters.includes(userId)) {
            existing.votes.voters.push(userId);
            existing.votes.count = existing.votes.voters.length;
            existing.updatedAt = new Date();
            confirmMessage = `That request already exists on the global list. Your vote was added. (${STATUS_EMOJIS[existing.status]} ${existing.status})`;
          } else {
            confirmMessage = `That request already exists on the global list and you have already voted for it. (${STATUS_EMOJIS[existing.status]} ${existing.status})`;
          }
          await SuggestionStore.saveGlobalSuggestions(this.client, suggestionData);
        } else {
          const now = new Date();
          const newSuggestion = Object.assign({}, cloneDeep(defaultSuggestionObject), {
            id: nanoid(),
            user: displayNameFor(interaction),
            userId: interaction.user.id,
            suggestion: suggestion,
            createdAt: now,
            updatedAt: now,
            sourceGuildIds: interaction.guildId ? [interaction.guildId] : []
          });

          suggestionData.suggestions.push(newSuggestion);
          await SuggestionStore.saveGlobalSuggestions(this.client, suggestionData);
          confirmMessage = 'Added your request to the global feature list.';

          // Notify admin of new suggestion
          if (ADMIN_USER_ID !== 'your-discord-id') {
            try {
              const admin = await interaction.client.users.fetch(ADMIN_USER_ID);
              await admin.send(`New suggestion from ${displayNameFor(interaction)}: ${suggestion}`);
            } catch (e) {
              this.client.logger.log('Failed to send admin notification: ' + e, 'error');
            }
          }
        }
      } else if (subcommand === 'vote') {
        const suggestionId = interaction.options.getString('suggestion');
        const userId = interaction.user.id;
        
        // Find the suggestion
        const suggestionIndex = suggestionData.suggestions.findIndex(s => s.id === suggestionId);
        if (suggestionIndex === -1) {
          await interaction.editReply({ content: 'Could not find that suggestion.'});
          return;
        }

        const suggestion = suggestionData.suggestions[suggestionIndex];
        
        // Check if user has already voted
        if (suggestion.votes.voters.includes(userId)) {
          // Remove vote
          suggestion.votes.voters = suggestion.votes.voters.filter(id => id !== userId);
          suggestion.votes.count = Math.max(0, suggestion.votes.count - 1);
          suggestion.updatedAt = new Date();
          await interaction.editReply({ content: 'Your vote has been removed.'});
        } else {
          // Add vote
          suggestion.votes.voters.push(userId);
          suggestion.votes.count = suggestion.votes.count + 1;
          suggestion.updatedAt = new Date();
          await interaction.editReply({ content: 'Your vote has been added!'});
        }

        // Update the suggestion in the data
        suggestionData.suggestions[suggestionIndex] = suggestion;
        await SuggestionStore.saveGlobalSuggestions(this.client, suggestionData);
      } else if (subcommand === 'status') {
        // Bot admin only — do not require guild member permissions so this works in DMs
        if (interaction.user.id !== ADMIN_USER_ID) {
          await interaction.editReply({ content: 'You do not have permission to change suggestion status.'});
          return;
        }

        const suggestionId = interaction.options.getString('suggestion');
        const newStatus = interaction.options.getString('status');
        
        // Find the suggestion
        const suggestionIndex = suggestionData.suggestions.findIndex(s => s.id === suggestionId);
        if (suggestionIndex === -1) {
          await interaction.editReply({ content: 'Could not find that suggestion.'});
          return;
        }

        const suggestion = suggestionData.suggestions[suggestionIndex];
        const oldStatus = suggestion.status;
        
        // Update status
        suggestion.status = newStatus;
        suggestion.updatedAt = new Date();
        suggestionData.suggestions[suggestionIndex] = suggestion;
        await SuggestionStore.saveGlobalSuggestions(this.client, suggestionData);

        // Try to notify the original suggester
        try {
          const suggester = await interaction.client.users.fetch(suggestion.userId);
          await suggester.send(`Your suggestion "${suggestion.suggestion}" has been updated from ${STATUS_EMOJIS[oldStatus]} ${oldStatus} to ${STATUS_EMOJIS[newStatus]} ${newStatus}`);
        } catch (e) {
          this.client.logger.log('Failed to send status update notification: ' + e, 'error');
        }

        await interaction.editReply({ content: `Status updated from ${STATUS_EMOJIS[oldStatus]} ${oldStatus} to ${STATUS_EMOJIS[newStatus]} ${newStatus}`});
      }

      // Show suggestions list for all commands
      const statusFilter = interaction.options.getString('filter') || FILTER_OPTIONS.ACTIVE;
      const sortBy = interaction.options.getString('sort') || 'VOTES';
      const page = Math.max(1, interaction.options.getInteger('page') || 1);

      // Filter and sort suggestions
      let filteredSuggestions = suggestionData.suggestions;
      if (statusFilter === FILTER_OPTIONS.ACTIVE) {
        filteredSuggestions = filteredSuggestions.filter(s => ACTIVE_STATUSES.includes(s.status));
      } else if (statusFilter !== FILTER_OPTIONS.ALL) {
        filteredSuggestions = filteredSuggestions.filter(s => s.status === statusFilter);
      }
      
      filteredSuggestions = this.sortSuggestions(filteredSuggestions, sortBy);

      // Get status counts for all suggestions
      const counts = this.getStatusCounts(suggestionData.suggestions);

      // Calculate pagination
      const totalPages = Math.ceil(filteredSuggestions.length / SUGGESTIONS_PER_PAGE);
      const startIndex = (page - 1) * SUGGESTIONS_PER_PAGE;
      const paginatedSuggestions = filteredSuggestions.slice(startIndex, startIndex + SUGGESTIONS_PER_PAGE);

      // Build suggestions list
      let suggestions = `${confirmMessage ? `${confirmMessage}\n\n` : ''}Global Feature Requests (Page ${page}/${totalPages || 1}):\n`;
      suggestions += paginatedSuggestions.map(suggestion => {
        const voteCount = suggestion.votes?.count || 0;
        const status = suggestion.status || SUGGESTION_STATUS.SUGGESTED;
        return ` - ${STATUS_EMOJIS[status]} ${suggestion.user}: ${suggestion.suggestion} (👍 ${voteCount})`;
      }).join("\n");

      if (paginatedSuggestions.length === 0) {
        suggestions += "\nNo suggestions found.";
      }

      let embedItem = {
        title: `Game Bot Feature Requests`,
        description: suggestions,
        color: statusFilter === FILTER_OPTIONS.ALL ? 
          STATUS_COLORS.DEFAULT : 
          statusFilter === FILTER_OPTIONS.ACTIVE ? 
            STATUS_COLORS[SUGGESTION_STATUS.IN_PROGRESS] : 
            STATUS_COLORS[statusFilter],
        fields: [
          {
            name: `Statistics (${counts.total} Total)`,
            value: this.getStatusStats(counts),
            inline: false
          }
        ],
        footer: {
          text: `Global across all servers • ${statusFilter === FILTER_OPTIONS.ALL ? 'all suggestions' : 
            statusFilter === FILTER_OPTIONS.ACTIVE ? '💡🔨 active suggestions' :
            `${STATUS_EMOJIS[statusFilter]} ${statusFilter} suggestions`} • Sorted by ${sortBy.toLowerCase()} • Page ${page}/${totalPages || 1}`
        }
      };
      
      // For vote command, we've already sent a response, so we need to follow up instead
      if (subcommand === 'vote' || subcommand === 'status') {
        await interaction.followUp({ embeds: [embedItem], flags: MessageFlags.Ephemeral });
      } else {
        await interaction.editReply({ embeds: [embedItem]});
      }
    } catch (e) { 
      this.client.logger.log(e,'error');
    }
  }
}

module.exports = Suggest
  