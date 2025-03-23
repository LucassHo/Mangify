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
