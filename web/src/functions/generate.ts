"use server";

import { GoogleGenerativeAI } from "@google/generative-ai";
import { Character, ImageGenerationResult } from "@/types";

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) throw new Error("GEMINI_API_KEY env not found");
const genAI = new GoogleGenerativeAI(apiKey);

export async function generateCharacterImage(character: Character): Promise<ImageGenerationResult> {
  try {
    // Create a detailed prompt based on character appearance
    const prompt = `Generate a manga-style line-art full body of a character with the following appearance: ${character.appearance}. 
    The character's name is ${character.name}. Draw it in white background drawn in a Japanese black and white Manga art style`;

    // Get the model with image generation capabilities
    const model = genAI.getGenerativeModel({
      model: "gemini-2.0-flash-exp-image-generation",
      generationConfig: {
        responseModalities: ["Text", "Image"],
        temperature: 0.7,
        topP: 0.95,
      },
    });

    // Generate the content
    const response = await model.generateContent(prompt);

    // Extract the image data from the response
    let imageBase64 = null;

    for (const candidate of response.response.candidates) {
      for (const part of candidate.content.parts) {
        if (part.inlineData && part.inlineData.data) {
          imageBase64 = part.inlineData.data;
          break;
        }
      }
      if (imageBase64) break;
    }

    if (!imageBase64) {
      throw new Error("No image was generated in the response");
    }

    return {
      success: true,
      imageBase64: imageBase64,
    };
  } catch (error) {
    console.error("Image generation error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "An unknown error occurred",
    };
  }
}

export async function generatePanelImage(
  panelDescription: string,
  characters: Character[]
): Promise<ImageGenerationResult> {
  try {
    // Filter to only include characters with generated images
    const charactersWithImages = characters.filter((char) => char.imageBase64);

    // Create character descriptions for the prompt
    const characterDescriptions = characters
      .map((char) => `${char.name}: ${char.appearance}`)
      .join("\n");

    // Create a detailed prompt for the panel
    const prompt = `Generate a manga panel illustration for the following scene:
    
${panelDescription}

Characters involved:
${characterDescriptions}

Style: Black and white manga illustration with clean lines, proper manga-style composition. 
Include appropriate backgrounds, character positioning, and any action described in the scene.
Make sure to maintain character appearance consistency with the reference images I've shown you.`;

    // Get the model with image generation capabilities
    const model = genAI.getGenerativeModel({
      model: "gemini-2.0-flash-exp-image-generation",
      generationConfig: {
        responseModalities: ["Text", "Image"],
        temperature: 0.7,
        topP: 0.95,
      },
    });

    // Prepare the image parts for the characters
    const imageParts = [];

    // For each character with an image, we'll add it to the prompt
    for (const character of charactersWithImages) {
      if (character.imageBase64) {
        imageParts.push({
          inlineData: {
            data: character.imageBase64,
            mimeType: "image/png",
          },
        });

        // Add a text part explaining which character this image represents
        imageParts.push({
          text: `This is ${character.name}. Use this exact character design and style for this character in the panel.`,
        });
      }
    }

    // Combine text prompt with character images
    const allParts = [
      { text: prompt },
      ...imageParts,
      {
        text: "Now generate the manga panel based on the scene description and character references provided.",
      },
    ];

    // Generate the content with both text and image inputs
    const response = await model.generateContent(allParts);

    // Extract the image data from the response
    let imageBase64 = null;

    for (const candidate of response.response.candidates) {
      for (const part of candidate.content.parts) {
        if (part.inlineData && part.inlineData.data) {
          imageBase64 = part.inlineData.data;
          break;
        }
      }
      if (imageBase64) break;
    }

    if (!imageBase64) {
      throw new Error("No panel image was generated in the response");
    }

    return {
      success: true,
      imageBase64: imageBase64,
    };
  } catch (error) {
    console.error("Panel image generation error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "An unknown error occurred",
    };
  }
}
