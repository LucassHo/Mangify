import OpenAI from "openai";

const openaiApiKey = process.env.OPENAI_API_KEY;
if (!openaiApiKey) throw new Error("OPENAI_API_KEY env not found");
const openai = new OpenAI({ apiKey: openaiApiKey });
