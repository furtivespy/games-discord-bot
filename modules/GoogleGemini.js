const { GoogleGenAI, HarmCategory, HarmBlockThreshold } = require("@google/genai");
const { AttachmentBuilder } = require("discord.js");

const formattingInstructions = `The response needs to be broken into chunks of 2000 characters or less.\
use markdown when appropriate, and use the text "||SEPARATE||" to indicate where one chunk ends and another begins.`;
const Identity = `You are Games Bot, a helpful assistant that answers questions about the games we play.`;
const Rules = `Always look up the rules before answering a question. \
Always look at the forums of boardgamegeek.com for any clarification on the rules. \
Try to fully answer the question, not just telling the user where to look. \
If the question is not related to the rules, let the user know that rules are you specialty and answer \ 
helpfully, but keep non-rules answers short and concise.`;

const createGeminiAI = (client) => {
    return new GeminiAI(client)
}

class GeminiAI {
  constructor(client) {
      this.client = client
      this.AI2 = new GoogleGenAI({apiKey: this.client.config.geminiKey})
  }

  async answerRulesQuestion(question, gameData = null) {
    const response = await this.AI2.models.generateContent({
        model: "gemini-2.5-flash",
        contents: await this.addGameToPrompt(question, gameData),
        config: {
          tools: [
            {
              urlContext: {}
            },
            {
              googleSearch: {}
            }            
          ],
          safetySettings: [
            {
              category: HarmCategory.HARM_CATEGORY_HARASSMENT,
              threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
            },
            {
              category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
              threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
            },
            {
              category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
              threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
            },
            {
              category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
              threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
            },
          ],
          systemInstruction: this.getSystemInstructions(gameData)
         }
    })
    console.log(this.getSystemInstructions(gameData))
    const responseText = await this.processResponse(response)
    return responseText
  }

  getSystemInstructions(gameData) {
    const gameInstructions = gameData ? `The user is currently playing ${gameData.gameName}, \
    so the question probably pertains to the rules of the game.` : ''
    const instructions = [Identity, Rules, gameInstructions, formattingInstructions]
    return instructions.join(' ')
  }

  async addGameToPrompt(prompt, gameData) {
    if (!gameData) {
      return prompt
    }
    const linkData = await gameData.LoadUsefulLinks()

    const gameInstructions = `In the game ${gameData.gameName} https://boardgamegeek.com/boardgame/${gameData.gameId}, `
    const links = linkData.links.map(link => link.url).join(' ')
    return `${gameInstructions} ${prompt} ${links}`
  }

  async processResponse(result) {
    let responseText = "Error: Could not extract AI response text.";
    let candidate = null;

    // --- Start: Flexible path to candidate object ---
    if (result && result.response && result.response.candidates && result.response.candidates.length > 0) {
      candidate = result.response.candidates[0];
    } else if (result && result.candidates && result.candidates.length > 0) {
      candidate = result.candidates[0];
    }
    // --- End: Flexible path to candidate object ---

    // --- Start: Modified text extraction to concatenate ALL text parts ---
    if (candidate) {
      if (candidate.content && candidate.content.parts && candidate.content.parts.length > 0) {
        const textParts = candidate.content.parts.filter(part =>
          part && typeof part.text === 'string' && part.text.trim() !== ""
        );

        if (textParts.length > 0) {
          // Concatenate the text from all found text parts, separated by a space
          responseText = textParts.map(part => part.text.trim()).join(' ').trim();
        } else {
          this.client.logger.warn("GeminiAI: No suitable text parts found in API response candidate's parts.", { parts: JSON.stringify(candidate.content.parts), candidateKeys: Object.keys(candidate) });
        }
      } else {
        this.client.logger.warn("GeminiAI: API response candidate missing content or parts.", { candidateKeys: Object.keys(candidate), contentKeys: candidate.content ? Object.keys(candidate.content) : 'null' });
      }
    } else {
      this.client.logger.error("GeminiAI: Invalid or incomplete API response structure (no valid candidate found).", { resultKeys: result ? Object.keys(result).join(', ') : 'null' });
    }

    if (responseText.endsWith('||SEPARATE||')) {
      responseText = responseText.slice(0, -12);
    }
  
    if (candidate && candidate.groundingMetadata?.groundingChunks) {
      if (!responseText.includes("||SEPARATE||Sources:") && !responseText.startsWith("Error:")) {
          responseText += "||SEPARATE||Sources: ";
      } else if (!responseText.startsWith("Error:") && !responseText.endsWith(" ")) {
          responseText += " ";
      }
      if (!responseText.startsWith("Error:")) {
          candidate.groundingMetadata.groundingChunks.forEach(chunk => {
            responseText += `[${chunk.web.title}](<${chunk.web.uri}>) `;
          });
      }
    }

    const responseChunks = responseText.split('||SEPARATE||').map(chunk => chunk.trim())

    // Combine chunks that would fit within Discord's 2000 char limit
    const combinedChunks = [];
    let currentChunk = '';

    for (const chunk of responseChunks) {
      // Test combining with 2 newlines
      const potentialCombined = currentChunk ? `${currentChunk}\n\n${chunk}` : chunk;
      
      if (potentialCombined.length <= 2000) {
        // Can combine
        currentChunk = potentialCombined;
      } else {
        // Would exceed limit, save current and start new
        if (currentChunk) {
          combinedChunks.push(currentChunk);
        }
        currentChunk = chunk;
      }
    }

    // Add final chunk
    if (currentChunk) {
      combinedChunks.push(currentChunk);
    }

    return combinedChunks
  }

}

module.exports = { createGeminiAI }