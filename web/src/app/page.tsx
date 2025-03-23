"use client";

import { useActionState } from "react";
import { extract_characters, extract_panels } from "@/functions/extract";
import {
  generateCharacterImageDallE,
  generatePanelImage,
  fixPanelDialogue,
} from "@/functions/generate";
import { useState } from "react";
import {
  CharacterExtractionResponse,
  ExtractCharactersResult,
  Character,
  PanelExtractionResponse,
  Panel,
  ProcessStep,
} from "@/types";

// Display mode type for manga reader
type DisplayMode = "detailed" | "images-only";

export default function Home() {
  const [storyContent, setStoryContent] = useState<string>("");
  const [extractionResult, setExtractionResult] = useState<CharacterExtractionResponse | null>(
    null
  );
  const [panelsResult, setPanelsResult] = useState<PanelExtractionResponse | null>(null);

  // Process tracking states
  const [currentStep, setCurrentStep] = useState<ProcessStep>("idle");
  const [progress, setProgress] = useState<Record<ProcessStep, number>>({
    idle: 0,
    extractingCharacters: 0,
    generatingCharacters: 0,
    extractingPanels: 0,
    generatingPanels: 0,
    addingDialogue: 0,
    completed: 0,
  });
  const [processingError, setProcessingError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  // State for individual operations (keeping for backwards compatibility)
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

  // Add new state variables for panel batching
  const [processedPanelCount, setProcessedPanelCount] = useState<number>(0);
  const [isBatchProcessing, setIsBatchProcessing] = useState<boolean>(false);
  const PANELS_PER_BATCH = 10;

  // Add display mode state
  const [displayMode, setDisplayMode] = useState<DisplayMode>("detailed");

  // Add state to track if characters section is expanded
  const [isCharactersExpanded, setIsCharactersExpanded] = useState<boolean>(false);

  // Function for one-click manga generation
  const handleGenerateCompleteManga = async () => {
    if (!storyContent) {
      alert("Please enter a story first");
      return;
    }

    try {
      setIsProcessing(true);
      setCurrentStep("extractingCharacters");
      setProcessingError(null);

      // Step 1: Extract characters
      setProgress((prev) => ({ ...prev, extractingCharacters: 30 }));
      const charactersResult = await extract_characters(
        null,
        new FormData(document.querySelector("form") as HTMLFormElement)
      );

      if (!charactersResult.success || !charactersResult.data) {
        throw new Error("Failed to extract characters: " + charactersResult.error);
      }

      setExtractionResult(charactersResult.data as CharacterExtractionResponse);
      setProgress((prev) => ({ ...prev, extractingCharacters: 100 }));

      // Step 2: Generate character images in parallel
      setCurrentStep("generatingCharacters");
      const characters = (charactersResult.data as CharacterExtractionResponse).response.characters;

      const characterImagePromises = characters.map(async (character, index) => {
        try {
          const imageResult = await generateCharacterImageDallE(character);
          if (imageResult.success && imageResult.imageBase64) {
            // Update progress after each character
            setProgress((prev) => ({
              ...prev,
              generatingCharacters: Math.round(((index + 1) / characters.length) * 100),
            }));
            return {
              ...character,
              imageBase64: imageResult.imageBase64,
            };
          }
          return character;
        } catch (err) {
          console.error(`Error generating image for ${character.name}:`, err);
          return character;
        }
      });

      // Wait for all character images to be generated
      const charactersWithImages = await Promise.all(characterImagePromises);

      setExtractionResult({
        response: { characters: charactersWithImages },
      });
      setProgress((prev) => ({ ...prev, generatingCharacters: 100 }));

      // Step 3: Extract panels
      setCurrentStep("extractingPanels");
      setProgress((prev) => ({ ...prev, extractingPanels: 30 }));

      const panelsResult = await extract_panels(storyContent, charactersWithImages);

      if (!panelsResult.success || !panelsResult.data) {
        throw new Error("Failed to extract panels: " + panelsResult.error);
      }

      setPanelsResult(panelsResult.data as PanelExtractionResponse);
      setProgress((prev) => ({ ...prev, extractingPanels: 100 }));

      const allPanels = (panelsResult.data as PanelExtractionResponse).response.panels;

      // Step 4: Generate panel images in parallel (only first batch)
      setCurrentStep("generatingPanels");
      const initialBatchSize = Math.min(PANELS_PER_BATCH, allPanels.length);

      // Process only the first batch of panels
      const firstBatchPanels = allPanels.slice(0, initialBatchSize);
      const panelImagePromises = firstBatchPanels.map(async (panel, index) => {
        try {
          // Create a panel description
          const panelDescription = `
            Setting: ${panel.setting}
            Characters: ${panel.character.join(", ")}
            Action/Expression: ${panel.expression}
            Dialogue: ${panel.Dialogue || "None"}
            Style Notes: ${panel.Drawing_notes || "Standard manga style"}
          `;

          const imageResult = await generatePanelImage(panelDescription, charactersWithImages);

          // Update progress based on batch size
          setProgress((prev) => ({
            ...prev,
            generatingPanels: Math.round(((index + 1) / initialBatchSize) * 100),
          }));

          if (imageResult.success && imageResult.imageBase64) {
            return {
              ...panel,
              imageBase64: imageResult.imageBase64,
            };
          }
          return panel;
        } catch (err) {
          console.error(`Error generating panel ${index}:`, err);
          return panel;
        }
      });

      // Wait for the first batch of panel images
      const firstBatchWithImages = await Promise.all(panelImagePromises);

      // Combine first batch with remaining panels
      const combinedPanels = [...firstBatchWithImages, ...allPanels.slice(initialBatchSize)];

      setPanelsResult({
        response: { panels: combinedPanels },
      });
      setProcessedPanelCount(initialBatchSize);
      setProgress((prev) => ({ ...prev, generatingPanels: 100 }));

      // Step 5: Add dialogue to panels in parallel (only first batch)
      setCurrentStep("addingDialogue");

      const panelsWithDialoguePromises = firstBatchWithImages.map(async (panel, index) => {
        if (!panel.imageBase64 || !panel.Dialogue) {
          return panel;
        }

        try {
          const dialogueResult = await fixPanelDialogue(panel.imageBase64, panel.Dialogue, panel);

          // Update progress based on batch
          setProgress((prev) => ({
            ...prev,
            addingDialogue: Math.round(((index + 1) / initialBatchSize) * 100),
          }));

          if (dialogueResult.success && dialogueResult.imageBase64) {
            return {
              ...panel,
              imageBase64: dialogueResult.imageBase64,
            };
          }
          return panel;
        } catch (err) {
          console.error(`Error adding dialogue to panel ${index}:`, err);
          return panel;
        }
      });

      // Wait for the first batch of dialogue additions
      const firstBatchWithDialogue = await Promise.all(panelsWithDialoguePromises);

      // Update panel state with the processed first batch
      const finalPanels = [...firstBatchWithDialogue, ...allPanels.slice(initialBatchSize)];

      setPanelsResult({
        response: { panels: finalPanels },
      });
      setProgress((prev) => ({ ...prev, addingDialogue: 100 }));

      // Complete
      setCurrentStep("completed");
      setProgress((prev) => ({ ...prev, completed: 100 }));
    } catch (err) {
      console.error("Error in manga generation pipeline:", err);
      setProcessingError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsProcessing(false);
    }
  };

  // Function to load and process the next batch of panels
  const handleLoadMorePanels = async () => {
    if (!panelsResult || !extractionResult) return;

    try {
      setIsBatchProcessing(true);

      const allPanels = panelsResult.response.panels;
      const nextBatchStartIndex = processedPanelCount;
      const nextBatchEndIndex = Math.min(nextBatchStartIndex + PANELS_PER_BATCH, allPanels.length);

      if (nextBatchStartIndex >= allPanels.length) {
        console.log("No more panels to process");
        setIsBatchProcessing(false);
        return;
      }

      // Get the next batch of panels
      const nextBatchPanels = allPanels.slice(nextBatchStartIndex, nextBatchEndIndex);

      // Generate panel images for the next batch
      const panelImagePromises = nextBatchPanels.map(async (panel, batchIndex) => {
        const globalIndex = nextBatchStartIndex + batchIndex;

        try {
          // Skip if the panel already has an image
          if (panel.imageBase64) {
            return panel;
          }

          const panelDescription = `
            Setting: ${panel.setting}
            Characters: ${panel.character.join(", ")}
            Action/Expression: ${panel.expression}
            Dialogue: ${panel.Dialogue || "None"}
            Style Notes: ${panel.Drawing_notes || "Standard manga style"}
          `;

          const imageResult = await generatePanelImage(
            panelDescription,
            extractionResult.response.characters
          );

          if (imageResult.success && imageResult.imageBase64) {
            const panelWithImage = { ...panel, imageBase64: imageResult.imageBase64 };

            // If the panel has dialogue, add speech bubbles
            if (panelWithImage.Dialogue) {
              const dialogueResult = await fixPanelDialogue(
                panelWithImage.imageBase64,
                panelWithImage.Dialogue,
                panelWithImage
              );

              if (dialogueResult.success && dialogueResult.imageBase64) {
                return { ...panelWithImage, imageBase64: dialogueResult.imageBase64 };
              }
            }

            return panelWithImage;
          }

          return panel;
        } catch (err) {
          console.error(`Error processing panel ${globalIndex}:`, err);
          return panel;
        }
      });

      // Wait for all panels in this batch to be processed
      const processedBatch = await Promise.all(panelImagePromises);

      // Update the panels result with the new batch
      const updatedPanels = [...panelsResult.response.panels];
      processedBatch.forEach((panel, batchIndex) => {
        const globalIndex = nextBatchStartIndex + batchIndex;
        updatedPanels[globalIndex] = panel;
      });

      setPanelsResult({
        response: { panels: updatedPanels },
      });
      setProcessedPanelCount(nextBatchEndIndex);
    } catch (err) {
      console.error("Error processing next batch:", err);
    } finally {
      setIsBatchProcessing(false);
    }
  };

  // Individual functions for each step (kept for backwards compatibility)
  // ...existing code for handleGenerateImage, handleExtractPanels, etc.

  // Function to calculate the overall progress percentage
  const calculateOverallProgress = (): number => {
    const weights = {
      idle: 0,
      extractingCharacters: 0.15,
      generatingCharacters: 0.2,
      extractingPanels: 0.15,
      generatingPanels: 0.3,
      addingDialogue: 0.2,
      completed: 0,
    };

    let weightedProgress = 0;
    let totalWeight = 0;

    Object.entries(weights).forEach(([step, weight]) => {
      if (step !== "idle" && step !== "completed") {
        weightedProgress += progress[step as ProcessStep] * weight;
        totalWeight += weight;
      }
    });

    if (currentStep === "completed") return 100;
    if (currentStep === "idle") return 0;

    return Math.round(weightedProgress / totalWeight);
  };

  // Function to toggle display mode
  const toggleDisplayMode = () => {
    setDisplayMode((prev) => (prev === "detailed" ? "images-only" : "detailed"));
  };

  // Function to toggle characters section expansion
  const toggleCharactersSection = () => {
    setIsCharactersExpanded((prev) => !prev);
  };

  return (
    <main className="min-h-screen p-8 bg-slate-900">
      <div className="flex flex-col items-center max-w-6xl mx-auto">
        <h1 className="text-4xl font-bold text-center">Manga Panel Generator</h1>

        {/* Step Indicator */}
        {currentStep !== "idle" && (
          <div className="w-full mt-8">
            <ul className="steps steps-vertical md:steps-horizontal w-full">
              <li className={`step ${progress.extractingCharacters > 0 ? "step-primary" : ""}`}>
                Extract Characters{" "}
                {progress.extractingCharacters > 0 && progress.extractingCharacters < 100
                  ? `(${progress.extractingCharacters}%)`
                  : ""}
              </li>
              <li className={`step ${progress.generatingCharacters > 0 ? "step-primary" : ""}`}>
                Generate Characters{" "}
                {progress.generatingCharacters > 0 && progress.generatingCharacters < 100
                  ? `(${progress.generatingCharacters}%)`
                  : ""}
              </li>
              <li className={`step ${progress.extractingPanels > 0 ? "step-primary" : ""}`}>
                Extract Panels{" "}
                {progress.extractingPanels > 0 && progress.extractingPanels < 100
                  ? `(${progress.extractingPanels}%)`
                  : ""}
              </li>
              <li className={`step ${progress.generatingPanels > 0 ? "step-primary" : ""}`}>
                Generate Panels{" "}
                {progress.generatingPanels > 0 && progress.generatingPanels < 100
                  ? `(${progress.generatingPanels}%)`
                  : ""}
              </li>
              <li className={`step ${progress.addingDialogue > 0 ? "step-primary" : ""}`}>
                Add Dialogue{" "}
                {progress.addingDialogue > 0 && progress.addingDialogue < 100
                  ? `(${progress.addingDialogue}%)`
                  : ""}
              </li>
            </ul>

            {/* Overall progress bar */}
            <div className="w-full mt-4 bg-gray-200 rounded-full h-4 dark:bg-gray-700">
              <div
                className="bg-blue-600 h-4 rounded-full transition-all duration-300 ease-in-out"
                style={{ width: `${calculateOverallProgress()}%` }}
              ></div>
            </div>

            <p className="text-center mt-2">
              {currentStep === "completed"
                ? "Complete! Scroll down to see your manga."
                : `${calculateOverallProgress()}% complete - ${currentStep
                    .replace(/([A-Z])/g, " $1")
                    .replace(/^./, (str) => str.toUpperCase())}`}
            </p>
          </div>
        )}

        {/* Story Input Form */}
        <div className="card w-full bg-base-100 shadow-xl mt-8">
          <div className="card-body">
            <h2 className="card-title">Your Story</h2>
            {isLoading ? (
              <p className="mt-4 text-lg">Extracting characters...</p>
            ) : (
              <p className="mt-2 text-gray-600">Enter your story text below to generate a manga.</p>
            )}

            <form action={extract_charactersAction} className="w-full mt-4">
              <textarea
                name="text_content"
                placeholder="Enter your story text here"
                required
                rows={8}
                className="textarea textarea-bordered w-full"
                value={storyContent}
                onChange={(e) => setStoryContent(e.target.value)}
              />

              <div className="card-actions justify-end mt-6">
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={isLoading || isProcessing}
                >
                  {isLoading ? "Processing..." : "Extract Characters"}
                </button>

                <button
                  type="button"
                  className="btn btn-accent"
                  disabled={isProcessing || !storyContent}
                  onClick={handleGenerateCompleteManga}
                >
                  {isProcessing ? (
                    <>
                      <span className="loading loading-spinner"></span>
                      Generating...
                    </>
                  ) : (
                    "One-Click Generate Manga"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>

        {processingError && (
          <div className="alert alert-error mt-8 w-full">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="stroke-current shrink-0 h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <span>Error: {processingError}</span>
          </div>
        )}

        {/* Characters Section - Now Collapsible */}
        {extractionResult && (
          <div className="mt-10 w-full">
            <div className="flex flex-col">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-semibold card-title">Characters</h2>
                <button onClick={toggleCharactersSection} className="btn btn-sm btn-ghost">
                  {isCharactersExpanded ? (
                    <div className="flex items-center">
                      <span className="mr-2">Collapse</span>
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-5 w-5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 15l7-7 7 7"
                        />
                      </svg>
                    </div>
                  ) : (
                    <div className="flex items-center">
                      <span className="mr-2">Expand</span>
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-5 w-5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 9l-7 7-7-7"
                        />
                      </svg>
                    </div>
                  )}
                </button>
              </div>

              {/* Characters Content - Conditionally rendered based on expanded state */}
              {isCharactersExpanded &&
                (extractionResult.response.characters.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {extractionResult.response.characters.map(
                      (character: Character, index: number) => (
                        <div key={index} className="card bg-base-100 shadow-lg">
                          <div className="card-body">
                            <h3 className="card-title">{character.name}</h3>
                            <p className="text-gray-400">
                              <span className="font-medium">Appearance:</span>{" "}
                              {character.appearance}
                            </p>

                            {character.imageBase64 ? (
                              <figure className="mt-4">
                                <img
                                  src={`data:image/png;base64,${character.imageBase64}`}
                                  alt={`Generated image of ${character.name}`}
                                  className="w-full rounded-lg"
                                />
                              </figure>
                            ) : (
                              <div className="card-actions justify-end mt-4">
                                <button
                                  disabled={generatingImages[index] || isProcessing}
                                  className="btn btn-primary btn-sm"
                                >
                                  {generatingImages[index] ? (
                                    <>
                                      <span className="loading loading-spinner loading-xs"></span>
                                      Generating...
                                    </>
                                  ) : (
                                    "Generate Image"
                                  )}
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    )}
                  </div>
                ) : (
                  <div className="alert alert-info">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      className="stroke-current shrink-0 w-6 h-6"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      ></path>
                    </svg>
                    <span>No characters were found in the text.</span>
                  </div>
                ))}

              {/* Character count summary when collapsed */}
              {!isCharactersExpanded && extractionResult.response.characters.length > 0 && (
                <div className="text-gray-400 text-sm">
                  {extractionResult.response.characters.length} character
                  {extractionResult.response.characters.length !== 1 ? "s" : ""} generated. Click
                  expand to view.
                </div>
              )}
            </div>
          </div>
        )}

        {/* Panels Section */}
        {panelsResult && (
          <div className="mt-16 w-full">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-semibold card-title">Manga Panels</h2>

              {/* Display mode toggle */}
              <div className="flex items-center gap-2">
                <span className="text-sm opacity-70">Display mode:</span>
                <button onClick={toggleDisplayMode} className="btn btn-sm btn-outline">
                  {displayMode === "detailed" ? (
                    <>
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-5 w-5 mr-1"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                        />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                        />
                      </svg>
                      Reading Mode
                    </>
                  ) : (
                    <>
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-5 w-5 mr-1"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                        />
                      </svg>
                      Detailed Mode
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Images-only mode */}
            {displayMode === "images-only" ? (
              <div className="space-y-6 max-w-4xl mx-auto">
                {panelsResult.response.panels.map((panel: Panel, index: number) =>
                  panel.imageBase64 ? (
                    <div key={index} className="manga-panel">
                      <img
                        src={`data:image/png;base64,${panel.imageBase64}`}
                        alt={`Panel ${index + 1}`}
                        className="w-full rounded-lg shadow-lg"
                      />
                      <div className="text-center text-sm text-gray-400 mt-1">
                        Panel {index + 1}{" "}
                        {panel.Dialogue
                          ? `- "${panel.Dialogue.substring(0, 30)}${
                              panel.Dialogue.length > 30 ? "..." : ""
                            }"`
                          : ""}
                      </div>
                    </div>
                  ) : null
                )}

                {/* Load More Panels button for image mode */}
                {panelsResult.response.panels.length > processedPanelCount && (
                  <div className="text-center mt-8">
                    <button
                      onClick={handleLoadMorePanels}
                      disabled={isBatchProcessing || isProcessing}
                      className="btn btn-primary btn-lg"
                    >
                      {isBatchProcessing ? (
                        <>
                          <span className="loading loading-spinner"></span>
                          Processing Next Batch...
                        </>
                      ) : (
                        `Load Next ${Math.min(
                          PANELS_PER_BATCH,
                          panelsResult.response.panels.length - processedPanelCount
                        )} Panels`
                      )}
                    </button>
                    <p className="mt-2 text-sm text-gray-500">
                      {processedPanelCount} of {panelsResult.response.panels.length} panels
                      processed
                    </p>
                  </div>
                )}
              </div>
            ) : (
              // Original detailed view
              <div className="space-y-8">
                {panelsResult.response.panels.map((panel: Panel, index: number) => (
                  <div key={index} className="card bg-base-100 shadow-lg">
                    <div className="card-body">
                      <h3 className="card-title">Panel {index + 1}</h3>

                      {panel.imageBase64 ? (
                        <figure className="mb-6">
                          <img
                            src={`data:image/png;base64,${panel.imageBase64}`}
                            alt={`Generated panel ${index + 1}`}
                            className="w-full rounded-lg"
                          />

                          {panel.Dialogue && !isProcessing && (
                            <div className="card-actions justify-end mt-4">
                              {/* <button
                                // onClick={() => handleFixPanelDialogue(panel, index)}
                                disabled={generatingPanelImages[index] || isProcessing}
                                className="btn btn-secondary btn-sm"
                              >
                                {generatingPanelImages[index] ? (
                                  <>
                                    <span className="loading loading-spinner loading-xs"></span>
                                    Adding Dialogue...
                                  </>
                                ) : (
                                  "Regenerate Dialogue"
                                )}
                              </button> */}
                            </div>
                          )}
                        </figure>
                      ) : (
                        <div className="flex flex-col gap-3 items-center mb-6">
                          <button
                            // onClick={() => handleGeneratePanelImage(panel, index)}
                            disabled={generatingPanelImages[index] || isProcessing}
                            className="btn btn-primary"
                          >
                            {generatingPanelImages[index] ? (
                              <>
                                <span className="loading loading-spinner loading-xs"></span>
                                Generating Panel...
                              </>
                            ) : (
                              "Generate Panel"
                            )}
                          </button>
                        </div>
                      )}

                      <div className="collapse collapse-arrow bg-base-200">
                        <input type="checkbox" />
                        <div className="collapse-title text-lg font-medium">Panel Details</div>
                        <div className="collapse-content">
                          <div className="mb-3">
                            <p className="font-medium text-gray-400">Setting:</p>
                            <p className="text-gray-500">{panel.setting}</p>
                          </div>

                          {panel.character && panel.character.length > 0 && (
                            <div className="mb-3">
                              <p className="font-medium text-gray-400">Characters:</p>
                              <div className="flex flex-wrap gap-1 mt-1">
                                {panel.character.map((char, charIndex) => (
                                  <div key={charIndex} className="badge badge-outline">
                                    {char}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {panel.expression && (
                            <div className="mb-3">
                              <p className="font-medium text-gray-400">Action/Expression:</p>
                              <p className="text-gray-500">{panel.expression}</p>
                            </div>
                          )}

                          {panel.Dialogue && (
                            <div className="mb-3">
                              <p className="font-medium text-gray-400">Dialogue/SFX:</p>
                              <p className="text-gray-500 italic">"{panel.Dialogue}"</p>
                            </div>
                          )}

                          {panel.Drawing_notes && (
                            <div className="mb-3">
                              <p className="font-medium text-gray-400">Style Notes:</p>
                              <p className="text-gray-500">{panel.Drawing_notes}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}

                {/* Load More Panels button */}
                {panelsResult.response.panels.length > processedPanelCount && (
                  <div className="text-center mt-8">
                    <button
                      onClick={handleLoadMorePanels}
                      disabled={isBatchProcessing || isProcessing}
                      className="btn btn-primary btn-lg"
                    >
                      {isBatchProcessing ? (
                        <>
                          <span className="loading loading-spinner"></span>
                          Processing Next Batch...
                        </>
                      ) : (
                        `Load Next ${Math.min(
                          PANELS_PER_BATCH,
                          panelsResult.response.panels.length - processedPanelCount
                        )} Panels`
                      )}
                    </button>
                    <p className="mt-2 text-sm text-gray-500">
                      {processedPanelCount} of {panelsResult.response.panels.length} panels
                      processed
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
