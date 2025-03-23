

// export async function addTextBubbles(
//   // dialogue: Map<string, string>,
//   // panel: Panel,
//   // character: string,
// ): Promise<Panel> {
//   // Create a new panel with the same properties as the original
//   const newPanel = { ...panel };

//   // Add the dialogue for the specified character
//   if (dialogue.has(character)) {
//     newPanel.Dialogue = dialogue.get(character) || "";
//   }

//   return newPanel;
// }

function splitByBrackets(str: string): string[] {
  // The regex captures the bracketed parts as separate tokens.
  const parts = str.split(/(\[.*?\])/);
  // Optionally filter out any empty strings.
  return parts.filter(part => part !== "");
}

// Example usage:
// const input = "[first] and [second]";
// const result = splitByBrackets(input);
// console.log(result); // Output: ["[first]", " and ", "[second]"]

export async function extract_Dialogues(dialogue: string): Promise<Map<string, string>> {
  const dialogueMap = new Map<string, string>();
  let  square_count = 0;

  // Split the dialogue into lines
  const strs = splitByBrackets(dialogue);

  for (const str of strs) {
    if (str.startsWith("[")) {
      const bracket_text = str.slice(1, -1); // Remove the brackets
      dialogueMap.set(`squarebracket_${square_count}`, bracket_text); // Initialize with empty dialogue
      square_count++; // Increment the square count
    } else {
      // If the line doesn't start with a bracket, it might be a character and their dialogue
      const trimmed = str.trim();
      const colonCount = (trimmed.match(/:/g) || []).length;
      if (colonCount !== 1) {
        throw new Error(`Invalid format: expected exactly one colon in line: "${trimmed}"`);
      }
    
      // Split by the first colon
      const colonIndex = trimmed.indexOf(":");
      const key = trimmed.slice(0, colonIndex).trim();
      const value = trimmed.slice(colonIndex + 1).trim();
      dialogueMap.set(key, value);
    }
  }
  return dialogueMap;
}