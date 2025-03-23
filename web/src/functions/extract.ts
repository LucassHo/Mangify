"use server";

import {
  GoogleGenerativeAI,
  GenerationConfig,
  GenerativeModel,
  Content,
  SchemaType,
} from "@google/generative-ai";
import { ExtractCharactersResult, CharacterExtractionResponse, Character } from "@/types";

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) throw new Error("GEMINI_API_KEY env not found");
const genAI = new GoogleGenerativeAI(apiKey);

export async function extract_characters(
  _: unknown,
  formData: FormData
): Promise<ExtractCharactersResult> {
  const file_content = formData.get("text_content")?.toString();

  const model: GenerativeModel = genAI.getGenerativeModel({
    model: "gemini-2.0-pro-exp-02-05",
    systemInstruction:
      "You will be given a story AND your task is to: list all of the characters in the story and for each character, extract their name and their character visual/physical appearance (describe generally, NOT appearance in specific events).",
  });

  const generationConfig: GenerationConfig = {
    temperature: 1,
    topP: 0.95,
    topK: 40,
    maxOutputTokens: 8192,
    responseMimeType: "application/json",
    responseSchema: {
      type: SchemaType.OBJECT,
      properties: {
        response: {
          type: SchemaType.OBJECT,
          properties: {
            characters: {
              type: SchemaType.ARRAY,
              items: {
                type: SchemaType.OBJECT,
                properties: {
                  name: {
                    type: SchemaType.STRING,
                  },
                  appearance: {
                    type: SchemaType.STRING,
                  },
                },
                required: ["name", "appearance"],
              },
            },
          },
          required: ["characters"],
        },
      },
      required: ["response"],
    },
  };

  const contents: Content[] = [
    {
      role: "user",
      parts: [{ text: "Story: " }],
    },
  ];

  contents.push({
    role: "user",
    parts: [{ text: file_content as string }],
  });

  try {
    if (!file_content) throw new Error("Missing required parameters");

    const result = await model.generateContent({
      generationConfig: generationConfig,
      contents: contents,
    });

    if (!result) throw new Error("No response from extraction model");

    const data = JSON.parse(await result.response.text()) as CharacterExtractionResponse;
    console.log("Characters:");
    console.log(data.response);

    // Removed revalidatePath("/") to avoid static generation store error
    return { success: true, data };
  } catch (error) {
    console.error("Characters extraction error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "An unknown error occurred",
    };
  }
}

export async function extract_panels(
  story: string,
  characters: Character[]
): Promise<ExtractCharactersResult> {
  const model: GenerativeModel = genAI.getGenerativeModel({
    model: "gemini-2.0-pro-exp-02-05",
    systemInstruction:
      "You are a creative consultant for manga adaptations. I will provide you with a story (or a chapter of a story) and character descriptions. Your job is to break down the narrative into a series of manga panels. For each panel, please include: 1. Panel Number/Title: A brief label for each panel or a short descriptive title. 2. Setting: Describe the environment or location, lighting, and any important background elements. 3. Characters: List who is present in the panel. 4. Action/Expression: Describe what is happening in the panel, what poses the characters are making, their facial expressions, and any relevant body language. 5. Dialogue: Include the full name of the character consistently and their suggested dialogue (if any) in quotes or parentheses. Also add sound effects (SFX) or onomatopoeia for environmental sounds, character actions, or dramatic emphasis. 6. Manga Style Notes: Provide stylistic directions such as use of shading, angle choices, or special effects (e.g., speed lines, hatching, focus lines). Your response should be in a structured, numbered list of panels. Each panel's description must be detailed enough for an artist to visualize and draw the scene accurately, capturing the mood and dynamics of the story. Finally, ensure the panel breakdown follows the chronological flow of the provided story. Do not skip any crucial moments, character interactions, or emotional beats that are important to understanding the plot or character development. The maximum number of panels are 20, so you have to pick the most important moments.",
  });

  const generationConfig: GenerationConfig = {
    temperature: 1,
    topP: 0.95,
    topK: 40,
    maxOutputTokens: 8192,
    responseMimeType: "application/json",
    responseSchema: {
      type: SchemaType.OBJECT,
      properties: {
        response: {
          type: SchemaType.OBJECT,
          properties: {
            panels: {
              type: SchemaType.ARRAY,
              items: {
                type: SchemaType.OBJECT,
                properties: {
                  setting: {
                    type: SchemaType.STRING,
                  },
                  character: {
                    type: SchemaType.ARRAY,
                    items: {
                      type: SchemaType.STRING,
                    },
                  },
                  expression: {
                    type: SchemaType.STRING,
                  },
                  Dialogue: {
                    type: SchemaType.STRING,
                  },
                  Drawing_notes: {
                    type: SchemaType.STRING,
                  },
                },
                required: ["setting"],
              },
            },
          },
          required: ["panels"],
        },
      },
      required: ["response"],
    },
  };

  // Prepare the content with story and characters
  const contents: Content[] = [
    {
      role: "user",
      parts: [{ text: "Story: " + story }],
    },
    {
      role: "user",
      parts: [
        {
          text:
            "Characters: " +
            characters.map((char) => `${char.name}: ${char.appearance}`).join("\n"),
        },
      ],
    },
  ];

  try {
    if (!story) throw new Error("Missing required story parameter");

    const result = await model.generateContent({
      generationConfig: generationConfig,
      contents: contents,
    });

    if (!result) throw new Error("No response from panel extraction model");

    const data = JSON.parse(await result.response.text()) as CharacterExtractionResponse;
    console.log("Panels:");
    console.log(data.response);

    return { success: true, data };
  } catch (error) {
    console.error("Panel extraction error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "An unknown error occurred",
    };
  }
}
