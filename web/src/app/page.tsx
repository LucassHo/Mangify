"use client";

import { useActionState } from "react";
import { extract_characters, extract_panels } from "@/functions/extract";
import { generateCharacterImage, generatePanelImage } from "@/functions/generate";
import { useState } from "react";
import {
  CharacterExtractionResponse,
  ExtractCharactersResult,
  Character,
  PanelExtractionResponse,
  Panel,
} from "@/types";

export default function Home() {
  const [storyContent, setStoryContent] = useState<string>("");
  const [extractionResult, setExtractionResult] = useState<CharacterExtractionResponse | null>(
    null
  );
  const [panelsResult, setPanelsResult] = useState<PanelExtractionResponse | null>(null);
  const [generatingImages, setGeneratingImages] = useState<Record<number, boolean>>({});
  const [extractingPanels, setExtractingPanels] = useState<boolean>(false);
  const [generatingPanelImages, setGeneratingPanelImages] = useState<Record<number, boolean>>({});

  const [error, extract_charactersAction, isLoading] = useActionState(
    async (_: unknown, formData: FormData) => {
      const storyText = formData.get("text_content")?.toString() || "";
      setStoryContent(storyText);

      const result = await extract_characters(_, formData);
      if (result.success && result.data) {
        setExtractionResult(result.data as CharacterExtractionResponse);
      }
      return result;
    },
    null as ExtractCharactersResult | null
  );

  // Function to generate image for a character
  const handleGenerateImage = async (character: Character, index: number) => {
    if (!extractionResult) return;

    // Set loading state for this character
    setGeneratingImages((prev) => ({ ...prev, [index]: true }));

    try {
      const result = await generateCharacterImage(character);

      if (result.success && result.imageBase64) {
        // Update character with image data
        const updatedCharacters = [...extractionResult.response.characters];
        updatedCharacters[index] = {
          ...updatedCharacters[index],
          imageBase64: result.imageBase64,
        };

        // Update state with new character data
        setExtractionResult({
          response: { characters: updatedCharacters },
        });
      } else {
        console.error("Failed to generate image:", result.error);
        alert(`Failed to generate image: ${result.error}`);
      }
    } catch (err) {
      console.error("Error generating image:", err);
    } finally {
      // Clear loading state
      setGeneratingImages((prev) => ({ ...prev, [index]: false }));
    }
  };

  // Function to extract panels
  const handleExtractPanels = async () => {
    if (!extractionResult || !storyContent) return;

    setExtractingPanels(true);

    try {
      const result = await extract_panels(storyContent, extractionResult.response.characters);

      if (result.success && result.data) {
        setPanelsResult(result.data as PanelExtractionResponse);
      } else {
        alert(`Failed to extract panels: ${result.error}`);
      }
    } catch (err) {
      console.error("Error extracting panels:", err);
      alert(
        `An error occurred while extracting panels: ${
          err instanceof Error ? err.message : String(err)
        }`
      );
    } finally {
      setExtractingPanels(false);
    }
  };

  // Function to generate panel image
  const handleGeneratePanelImage = async (panel: Panel, index: number) => {
    if (!panelsResult || !extractionResult) return;

    // Check if any characters mentioned in the panel have images
    const panelCharacterNames = panel.character || [];
    const charactersWithImages = extractionResult.response.characters.filter(
      (char) => char.imageBase64 && panelCharacterNames.includes(char.name)
    );

    // If no characters in this panel have images, warn the user
    if (charactersWithImages.length === 0 && panelCharacterNames.length > 0) {
      alert("Please generate images for at least one character in this panel first.");
      return;
    }

    // Set loading state for this panel
    setGeneratingPanelImages((prev) => ({ ...prev, [index]: true }));

    try {
      // Create a panel description
      const panelDescription = `
        Setting: ${panel.setting}
        Characters: ${panel.character.join(", ")}
        Action/Expression: ${panel.expression}
        Dialogue: ${panel.Dialogue || "None"}
        Style Notes: ${panel.Drawing_notes || "Standard manga style"}
      `;

      const result = await generatePanelImage(
        panelDescription,
        extractionResult.response.characters
      );

      if (result.success && result.imageBase64) {
        // Update panel with image data
        const updatedPanels = [...panelsResult.response.panels];
        updatedPanels[index] = {
          ...updatedPanels[index],
          imageBase64: result.imageBase64,
        };

        // Update state with new panel data
        setPanelsResult({
          response: { panels: updatedPanels },
        });
      } else {
        console.error("Failed to generate panel image:", result.error);
        alert(`Failed to generate panel image: ${result.error}`);
      }
    } catch (err) {
      console.error("Error generating panel image:", err);
    } finally {
      // Clear loading state
      setGeneratingPanelImages((prev) => ({ ...prev, [index]: false }));
    }
  };

  return (
    <main className="min-h-screen p-8">
      <div className="flex flex-col items-center max-w-5xl mx-auto">
        <h1 className="text-4xl font-bold">Manga Panel Generator</h1>
        {isLoading ? (
          <p className="mt-4 text-lg">Extracting characters...</p>
        ) : (
          <p className="mt-4 text-lg">Enter text to extract characters from a story.</p>
        )}
        <form action={extract_charactersAction} className="w-full max-w-lg mt-6">
          <textarea
            name="text_content"
            placeholder="Enter your story text here"
            required
            rows={6}
            className="mt-4 p-3 border border-gray-300 rounded w-full"
          />
          <button
            type="submit"
            className="mt-4 px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded"
            disabled={isLoading}
          >
            {isLoading ? "Processing..." : "Extract Characters"}
          </button>
        </form>

        {error && !error.success && (
          <div className="mt-8 p-4 bg-red-100 text-red-800 rounded-md w-full max-w-lg">
            <p className="font-medium">Error: {error.error}</p>
          </div>
        )}

        {extractionResult && (
          <div className="mt-10 w-full">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-semibold">Extracted Characters</h2>
              <button
                onClick={handleExtractPanels}
                disabled={extractingPanels}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded flex items-center"
              >
                {extractingPanels ? (
                  <>
                    <svg
                      className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                    Extracting Panels...
                  </>
                ) : (
                  "Extract Manga Panels"
                )}
              </button>
            </div>

            {extractionResult.response.characters.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {extractionResult.response.characters.map((character: Character, index: number) => (
                  <div key={index} className="border rounded-lg p-4 bg-white shadow flex flex-col">
                    <h3 className="text-xl font-bold mb-2">{character.name}</h3>
                    <p className="text-gray-700 mb-4">
                      <span className="font-medium">Appearance:</span> {character.appearance}
                    </p>

                    {character.imageBase64 ? (
                      <div className="mt-2 mb-2 bg-gray-100 rounded overflow-hidden">
                        <img
                          src={`data:image/png;base64,${character.imageBase64}`}
                          alt={`Generated image of ${character.name}`}
                          className="w-full h-auto object-contain"
                        />
                      </div>
                    ) : (
                      <div className="flex justify-center mt-4">
                        <button
                          onClick={() => handleGenerateImage(character, index)}
                          disabled={generatingImages[index]}
                          className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded flex items-center"
                        >
                          {generatingImages[index] ? (
                            <>
                              <svg
                                className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                                xmlns="http://www.w3.org/2000/svg"
                                fill="none"
                                viewBox="0 0 24 24"
                              >
                                <circle
                                  className="opacity-25"
                                  cx="12"
                                  cy="12"
                                  r="10"
                                  stroke="currentColor"
                                  strokeWidth="4"
                                ></circle>
                                <path
                                  className="opacity-75"
                                  fill="currentColor"
                                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                ></path>
                              </svg>
                              Generating...
                            </>
                          ) : (
                            "Generate Image"
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-600">No characters were found in the text.</p>
            )}
          </div>
        )}

        {panelsResult && (
          <div className="mt-16 w-full">
            <h2 className="text-2xl font-semibold mb-6">Manga Panels</h2>
            <div className="space-y-8">
              {panelsResult.response.panels.map((panel: Panel, index: number) => {
                // Check if any characters in this panel have images
                const panelCharacterNames = panel.character || [];
                const anyCharacterHasImage = extractionResult?.response.characters.some(
                  (char) => char.imageBase64 && panelCharacterNames.includes(char.name)
                );

                return (
                  <div key={index} className="border rounded-lg p-6 bg-white shadow">
                    <h3 className="text-xl font-bold mb-3">Panel {index + 1}</h3>

                    {panel.imageBase64 ? (
                      <div className="mb-6 bg-gray-100 rounded overflow-hidden">
                        <img
                          src={`data:image/png;base64,${panel.imageBase64}`}
                          alt={`Generated panel ${index + 1}`}
                          className="w-full h-auto object-contain"
                        />
                      </div>
                    ) : (
                      <div className="flex flex-col items-center mb-6">
                        <button
                          onClick={() => handleGeneratePanelImage(panel, index)}
                          disabled={generatingPanelImages[index] || !anyCharacterHasImage}
                          className={`px-4 py-2 text-white rounded flex items-center ${
                            anyCharacterHasImage
                              ? "bg-indigo-600 hover:bg-indigo-700"
                              : "bg-gray-400 cursor-not-allowed"
                          }`}
                        >
                          {generatingPanelImages[index] ? (
                            <>
                              <svg
                                className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                                xmlns="http://www.w3.org/2000/svg"
                                fill="none"
                                viewBox="0 0 24 24"
                              >
                                <circle
                                  className="opacity-25"
                                  cx="12"
                                  cy="12"
                                  r="10"
                                  stroke="currentColor"
                                  strokeWidth="4"
                                ></circle>
                                <path
                                  className="opacity-75"
                                  fill="currentColor"
                                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                ></path>
                              </svg>
                              Generating Panel...
                            </>
                          ) : (
                            "Generate Panel Image"
                          )}
                        </button>
                        {!anyCharacterHasImage && panel.character.length > 0 && (
                          <p className="text-sm text-gray-500 mt-2">
                            Generate character images first to create this panel
                          </p>
                        )}
                      </div>
                    )}

                    <div className="mb-3">
                      <p className="font-medium text-gray-700">Setting:</p>
                      <p className="text-gray-800">{panel.setting}</p>
                    </div>

                    {panel.character && panel.character.length > 0 && (
                      <div className="mb-3">
                        <p className="font-medium text-gray-700">Characters:</p>
                        <ul className="list-disc list-inside">
                          {panel.character.map((char, charIndex) => (
                            <li key={charIndex} className="text-gray-800">
                              {char}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {panel.expression && (
                      <div className="mb-3">
                        <p className="font-medium text-gray-700">Action/Expression:</p>
                        <p className="text-gray-800">{panel.expression}</p>
                      </div>
                    )}

                    {panel.Dialogue && (
                      <div className="mb-3">
                        <p className="font-medium text-gray-700">Dialogue/SFX:</p>
                        <p className="text-gray-800 italic">"{panel.Dialogue}"</p>
                      </div>
                    )}

                    {panel.Drawing_notes && (
                      <div className="mb-3">
                        <p className="font-medium text-gray-700">Style Notes:</p>
                        <p className="text-gray-800">{panel.Drawing_notes}</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
