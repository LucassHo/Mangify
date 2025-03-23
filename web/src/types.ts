/**
 * Character extraction types
 */

// Individual character structure
export interface Character {
  name: string;
  appearance: string;
  imageBase64?: string;
}

// Structure representing the nested response from Gemini
export interface CharacterExtractionResponse {
  response: {
    characters: Character[];
  };
}

/**
 * Panel extraction types
 */
export interface Panel {
  setting: string;
  character: string[];
  expression: string;
  Dialogue: string;
  Drawing_notes: string;
  imageBase64?: string;
}

export interface PanelExtractionResponse {
  response: {
    panels: Panel[];
  };
}

// The final API response structure
export interface ExtractCharactersResult {
  success: boolean;
  data?: CharacterExtractionResponse | PanelExtractionResponse;
  error?: string;
}

/**
 * Image generation types
 */
export interface ImageGenerationResult {
  success: boolean;
  imageBase64?: string;
  error?: string;
}
