import OpenAI from "openai";
import type { NextConfig } from "next";

const openaiApiKey = process.env.OPENAI_API_KEY;
if (!openaiApiKey) throw new Error("OPENAI_API_KEY env not found");
const openai = new OpenAI({ apiKey: openaiApiKey });
const nextConfig: NextConfig = {
  /* config options here */
  env: {
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  },
};

export default nextConfig