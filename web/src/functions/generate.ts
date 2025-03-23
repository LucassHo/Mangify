"use server";

import { GoogleGenerativeAI } from "@google/generative-ai";
import { Character, ImageGenerationResult } from "@/types";
import OpenAI from "openai";

// Initialize Gemini
const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) throw new Error("GEMINI_API_KEY env not found");
const genAI = new GoogleGenerativeAI(apiKey);

// Initialize OpenAI
const openaiApiKey = process.env.OPENAI_API_KEY;
if (!openaiApiKey) throw new Error("OPENAI_API_KEY env not found");
const openai = new OpenAI({ apiKey: openaiApiKey });

// export async function generateCharacterImage(character: Character): Promise<ImageGenerationResult> {
//   try {
//     // Create a detailed prompt based on character appearance
//     const prompt = `Generate a manga-style line-art full body of a character with the following appearance: ${character.appearance}.
//     The character's name is ${character.name}. Draw it in white background drawn in a Japanese black and white Manga art style`;

//     // Get the model with image generation capabilities
//     const model = genAI.getGenerativeModel({
//       model: "gemini-2.0-flash-exp-image-generation",
//       generationConfig: {
//         // responseModalities: ["Text", "Image"],
//         temperature: 0.7,
//         topP: 0.95,
//       },
//     });

//     // Generate the content
//     const response = await model.generateContent(prompt);

//     // Extract the image data from the response
//     let imageBase64 = null;

//     for (const candidate of response.response?.candidates || []) {
//       for (const part of candidate.content.parts) {
//         if (part.inlineData && part.inlineData.data) {
//           imageBase64 = part.inlineData.data;
//           break;
//         }
//       }
//       if (imageBase64) break;
//     }

//     if (!imageBase64) {
//       throw new Error("No image was generated in the response");
//     }

//     return {
//       success: true,
//       imageBase64: imageBase64,
//     };
//   } catch (error) {
//     console.error("Image generation error:", error);
//     return {
//       success: false,
//       error: error instanceof Error ? error.message : "An unknown error occurred",
//     };
//   }
// }

export async function generatePanelImage(
  panelDescription: string,
  characters: Character[]
): Promise<ImageGenerationResult> {
  try {
    // Filter to only include characters with generated images
    const charactersWithImages = characters.filter((char) => char.imageBase64);

    if (charactersWithImages.length === 0) {
      console.warn("No character images available for reference. Using text descriptions only.");
    }

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
Make sure to maintain character appearance consistency with the reference images I'm providing.`;

    // Get the model with image generation capabilities - IMPORTANT: Set responseModalities to include Image
    const model = genAI.getGenerativeModel({
      model: "gemini-2.0-flash-exp-image-generation",
      generationConfig: {
         // @ts-ignore
        responseModalities: ["Text", "Image"], // Explicitly request image responses
        temperature: 0.7,
        topP: 0.95,
      },
    });

    // Prepare the content parts including text and images
    const contentParts = [];

    // Add the main prompt text
    contentParts.push({ text: prompt });

    // Add character reference images and descriptions
    for (const character of charactersWithImages) {
      if (character.imageBase64) {
        // Add the character image
        contentParts.push({
          inlineData: {
            data: character.imageBase64,
            mimeType: "image/png",
          },
        });

        // Add a text description identifying this character
        contentParts.push({
          text: `This is ${character.name}. Please use this exact design and style for this character in the panel.`,
        });
      }
    }

    // Add the final instruction
    contentParts.push({
      text: "Now generate the manga panel incorporating all these character designs exactly as shown in the reference images.",
    });

    console.log(`Generating panel with ${charactersWithImages.length} character reference images`);

    // Generate the content
    const response = await model.generateContent(contentParts);

    console.log("Response received, extracting image...");

    // Extract the image data from the response using the approach from the official documentation
    let imageBase64 = null;

    // Simplified approach directly following the documentation pattern
    if (response.response.candidates && response.response.candidates.length > 0) {
      for (const part of response.response.candidates[0].content.parts) {
        if (part.text) {
          console.log("Text response from Gemini:", part.text);
        } else if (part.inlineData && part.inlineData.data) {
          imageBase64 = part.inlineData.data;
          console.log("Found image data in response");
          break;
        }
      }
    }

    // Debug response structure if no image found
    if (!imageBase64) {
      console.error(
        "Response structure:",
        JSON.stringify({
          hasResponse: !!response.response,
          candidatesCount: response.response?.candidates?.length || 0,
          hasContent: !!response.response?.candidates?.[0]?.content,
          partsCount: response.response?.candidates?.[0]?.content?.parts?.length || 0,
        })
      );

      // Try one more direct access attempt if structure is as expected
      if (response.response?.candidates?.[0]?.content?.parts && response.response.candidates[0].content.parts.length > 0) {
        console.log("Attempting alternative extraction method");
        const parts = response.response.candidates[0].content.parts;
        for (let i = 0; i < parts.length; i++) {
          console.log(`Part ${i} type:`, parts[i].text !== undefined ? "text" : parts[i].inlineData !== undefined ? "inlineData" : "unknown");
          if (parts[i].inlineData?.data) {
            imageBase64 = parts[i].inlineData?.data;
            console.log("Found image in part", i);
            break;
          }
        }
      }
    }

    if (!imageBase64) {
      console.error(
        "Failed to extract image from response. Response snippet:",
        JSON.stringify(response.response).substring(0, 500) + "..."
      );
      throw new Error("No panel image was generated in the response");
    }

    return {
      success: true,
      imageBase64: imageBase64,
    };
  } catch (error) {
    console.error("Panel image generation error:", error);
    if (error instanceof Error) {
      console.error("Error details:", {
        name: error.name,
        message: error.message,
        stack: error.stack,
      });
    }
    return {
      success: false,
      error: error instanceof Error ? error.message : "An unknown error occurred",
    };
  }
}

// export async function generatePanelImageDallE(
//   panelDescription: string,
//   characters: Character[]
// ): Promise<ImageGenerationResult> {
//   try {
//     // Filter to only include characters with generated images
//     const charactersWithImages = characters.filter((char) => char.imageBase64);

//     // Create character descriptions for the prompt
//     const characterDescriptions = characters
//       .map((char) => `${char.name}: ${char.appearance}`)
//       .join("\n");

//     // Create references to characters with images
//     const characterReferences =
//       charactersWithImages.length > 0
//         ? `\nReference characters: ${charactersWithImages
//             .map((char) => char.name)
//             .join(", ")}. Make sure these characters look exactly as described.`
//         : "";

//     // Create a detailed prompt for DALL-E 3
//     // DALL-E 3 works best with very detailed prompts
//     const prompt = `Create a black and white manga panel illustration in Japanese manga style with the following scene:

// SETTING: ${
//       panelDescription.includes("Setting:")
//         ? panelDescription.split("Setting:")[1].split("\n")[0].trim()
//         : "A manga scene"
//     }

// CHARACTERS: ${
//       panelDescription.includes("Characters:")
//         ? panelDescription.split("Characters:")[1].split("\n")[0].trim()
//         : "The manga characters"
//     }

// ACTION: ${
//       panelDescription.includes("Action/Expression:")
//         ? panelDescription.split("Action/Expression:")[1].split("\n")[0].trim()
//         : "Character interaction"
//     }

// DIALOGUE: ${
//       panelDescription.includes("Dialogue:")
//         ? panelDescription.split("Dialogue:")[1].split("\n")[0].trim()
//         : "None"
//     }

// CHARACTER DESCRIPTIONS:
// ${characterDescriptions}

// STYLE NOTES: Classic black and white manga with clean line art, proper perspective, dynamic composition, and manga-specific visual elements like speed lines and emotion indicators where appropriate.${characterReferences}

// This should look like a professional manga panel that could appear in a published Japanese manga. Make the art clean, detailed, and expressive.`;

//     console.log("DALL-E Prompt:", prompt);

//     // Call OpenAI's DALL-E 3 model
//     const response = await openai.images.generate({
//       model: "dall-e-3", // Explicitly specify DALL-E 3
//       prompt: prompt,
//       n: 1,
//       size: "1024x1024",
//       quality: "standard",
//       response_format: "b64_json",
//     });

//     // Extract the base64-encoded image from the response
//     const imageData = response.data[0]?.b64_json;

//     if (!imageData) {
//       throw new Error("No panel image was generated in the DALL-E response");
//     }

//     return {
//       success: true,
//       imageBase64: imageData,
//     };
//   } catch (error) {
//     console.error("Panel image generation error using DALL-E:", error);
//     return {
//       success: false,
//       error: error instanceof Error ? error.message : "An unknown error occurred",
//     };
//   }
// }

export async function generateCharacterImageDallE(
  character: Character
): Promise<ImageGenerationResult> {
  try {
    // Create a structured prompt for DALL-E 3
    const prompt = `Generate a manga-style line-art full body of a character with the following appearance: ${character.appearance}. 
    The character's name is ${character.name}. Draw it in white background drawn in a Japanese black and white Manga art style. ONLY draw a SINGLE character. SINGLE character.`;

    console.log("Character DALL-E Prompt:", prompt);

    // Call OpenAI's DALL-E 3 model
    const response = await openai.images.generate({
      model: "dall-e-3",
      prompt: prompt,
      n: 1,
      size: "1024x1024",
      quality: "standard",
      response_format: "b64_json",
    });

    // Extract the base64-encoded image from the response
    const imageData = response.data[0]?.b64_json;

    if (!imageData) {
      throw new Error("No character image was generated in the DALL-E response");
    }

    return {
      success: true,
      imageBase64: imageData,
    };
  } catch (error) {
    console.error("Character image generation error using DALL-E:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "An unknown error occurred",
    };
  }
}

export async function fixPanelDialogue(
  panelImageBase64: string,
  dialogue: string,
  panel: any
): Promise<ImageGenerationResult> {
  try {
    // Get the model with image generation capabilities
    const model = genAI.getGenerativeModel({
      model: "gemini-2.0-flash-exp-image-generation",
      generationConfig: {
      // @ts-ignore
      responseModalities: ["Text", "Image"],
      temperature: 0.4, // Lower temperature for more deterministic results
      topP: 0.95,
      },
    });

    console.log("Step 1: Removing existing speech bubbles from panel");

    // STEP 1: Remove all existing speech bubbles
    const cleanupPrompt = `
    Please remove all speech bubbles, text, and dialogue from this manga panel. 
    Keep everything else exactly the same - maintain all characters, backgrounds, and artwork.
    Just remove any text elements, speech bubbles, thought bubbles, or dialogue boxes.
    Return a clean manga panel image with no text elements.`;

    // Prepare first step content
    const cleanupParts = [
      {
        inlineData: {
          data: panelImageBase64,
          mimeType: "image/png",
        },
      },
      { text: cleanupPrompt },
    ];

    // First inference to clean up the panel
    const cleanupResponse = await model.generateContent(cleanupParts);

    // Extract the cleaned image
    let cleanedImageBase64 = null;
    for (const candidate of cleanupResponse.response.candidates || []) {
      for (const part of candidate.content.parts) {
        if (part.inlineData && part.inlineData.data) {
          cleanedImageBase64 = part.inlineData.data;
          break;
        }
      }
      if (cleanedImageBase64) break;
    }

    if (!cleanedImageBase64) {
      throw new Error("Failed to clean speech bubbles from the panel");
    }

    console.log("Step 2: Adding new speech bubbles with dialogue");

    // STEP 2: Add new speech bubbles with the dialogue
    const addTextPrompt = `
    Add manga-style speech bubbles to this clean panel with the following dialogue: "${dialogue}".
    Make the speech bubbles look authentic to manga style. Position the bubbles appropriately near the speaking characters.
    Keep the original artwork intact. If the dialogue is too long, please shorten it while maintaining the essence of the conversation.
    Create professional-looking manga speech bubbles that complement the art style.`;

    // Prepare second step content with cleaned image
    const addTextParts = [
      {
        inlineData: {
          data: cleanedImageBase64,
          mimeType: "image/png",
        },
      },
      { text: addTextPrompt },
      {
        text: "Important: Maintain the original art quality and style. Add clear, readable speech bubbles that look like they belong in a professional manga.",
      },
    ];

    // Second inference to add new speech bubbles
    const finalResponse = await model.generateContent(addTextParts);

    // Extract the final image
    let finalImageBase64 = null;
    for (const candidate of finalResponse.response.candidates || []) {
      for (const part of candidate.content.parts) {
        if (part.inlineData && part.inlineData.data) {
          finalImageBase64 = part.inlineData.data;
          break;
        }
      }
      if (finalImageBase64) break;
    }

    if (!finalImageBase64) {
      throw new Error("Failed to add dialogue to the cleaned panel");
    }

    return {
      success: true,
      imageBase64: finalImageBase64,
    };
  } catch (error) {
    console.error("Panel dialogue fixing error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "An unknown error occurred",
    };
  }
}
