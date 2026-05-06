/**
 * src/services/ai.service.js
 * Generates a root cause hypothesis using Google Gemini 2.5 Flash.
 * Falls back to Groq (llama-3.3-70b) if Gemini fails or is rate limited.
 *
 * Input:  error message, hypothesis deploy, diff patch, confidence level
 * Output: { summary, confidence, whatToCheckFirst }
 */

import { GoogleGenerativeAI } from "@google/generative-ai";
import Groq from "groq-sdk";
import dotenv from "dotenv";
dotenv.config();

/**
 * buildPrompt
 * Constructs the prompt sent to the AI model.
 *
 * @param {string} errorMessage
 * @param {object} hypothesis
 * @param {string} confidence
 * @returns {string}
 */
function buildPrompt(errorMessage, hypothesis, confidence) {
  const minutesAgo = Math.round(
    (Date.now() - hypothesis.timestamp.getTime()) / (1000 * 60)
  );

  const filesChanged = hypothesis.filesChanged?.join(", ") || "unknown files";
  const patch = hypothesis.patch || "Diff not available";

  return `You are a senior software engineer doing root cause analysis.

A production error occurred:
Error: ${errorMessage}

The most likely culprit is a deploy made ${minutesAgo} minutes before the error:
- Commit: ${hypothesis.shortSha} by ${hypothesis.author}
- Message: "${hypothesis.message}"
- Files changed: ${filesChanged}
- Correlation confidence: ${confidence}

Code diff:
${patch}

Write a root cause hypothesis in exactly this JSON format, no markdown, no extra text:
{
  "summary": "3 sentences max. Sentence 1: what likely caused the error. Sentence 2: why this deploy is suspicious. Sentence 3: the likely mechanism of failure.",
  "confidence": "${confidence}",
  "whatToCheckFirst": "One specific thing to check or do first to confirm or rule out this hypothesis."
}`;
}

/**
 * callGemini
 * Calls Google Gemini 2.5 Flash with the root cause prompt.
 *
 * @param {string} prompt
 * @returns {Promise<string>}
 */
async function callGemini(prompt) {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not set");
  }

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

  const result = await model.generateContent(prompt);
  const response = await result.response;
  return response.text();
}

/**
 * callGroq
 * Fallback AI call using Groq llama-3.3-70b.
 *
 * @param {string} prompt
 * @returns {Promise<string>}
 */
async function callGroq(prompt) {
  if (!process.env.GROQ_API_KEY) {
    throw new Error("GROQ_API_KEY is not set");
  }

  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

  const completion = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.3,
    max_tokens: 500,
  });

  return completion.choices[0]?.message?.content ?? "";
}

/**
 * parseAIResponse
 * Parses the JSON response from the AI model.
 * Handles cases where the model wraps JSON in markdown code blocks.
 *
 * @param {string} raw
 * @returns {{ summary: string, confidence: string, whatToCheckFirst: string }}
 */
function parseAIResponse(raw) {
  try {
    const cleaned = raw
      .replace(/```json\n?/g, "")
      .replace(/```\n?/g, "")
      .trim();

    const parsed = JSON.parse(cleaned);

    return {
      summary: parsed.summary ?? "Could not generate summary.",
      confidence: parsed.confidence ?? "low",
      whatToCheckFirst: parsed.whatToCheckFirst ?? "Review the deploy diff manually.",
    };
  } catch {
    console.warn("[ai] Could not parse JSON response — using raw text as summary");
    return {
      summary: raw.slice(0, 500),
      confidence: "low",
      whatToCheckFirst: "Review the deploy diff manually.",
    };
  }
}

/**
 * generateHypothesis
 * Main export. Tries Gemini first, falls back to Groq on any error.
 *
 * @param {string} errorMessage
 * @param {object} hypothesis
 * @param {string} confidence
 * @returns {Promise<{ summary: string, confidence: string, whatToCheckFirst: string }>}
 */
export async function generateHypothesis(errorMessage, hypothesis, confidence) {
  const prompt = buildPrompt(errorMessage, hypothesis, confidence);

  // Try Gemini first
  try {
    console.log("[ai] Calling Gemini 2.5 Flash...");
    const raw = await callGemini(prompt);
    const result = parseAIResponse(raw);
    console.log(`[ai] Gemini response received — confidence: ${result.confidence}`);
    return result;
  } catch (geminiErr) {
    console.warn(`[ai] Gemini failed: ${geminiErr.message} — falling back to Groq`);
  }

  // Fallback to Groq
  try {
    console.log("[ai] Calling Groq llama-3.3-70b...");
    const raw = await callGroq(prompt);
    const result = parseAIResponse(raw);
    console.log(`[ai] Groq response received — confidence: ${result.confidence}`);
    return result;
  } catch (groqErr) {
    console.error(`[ai] Groq also failed: ${groqErr.message}`);
    return {
      summary: `A production error "${errorMessage}" occurred shortly after commit ${hypothesis.shortSha} by ${hypothesis.author}. The deploy changed ${hypothesis.filesChanged?.join(", ") || "unknown files"}. Manual investigation is required as AI summarisation is currently unavailable.`,
      confidence: "low",
      whatToCheckFirst: `Review commit ${hypothesis.shortSha} by ${hypothesis.author} and check if the changed files relate to the error.`,
    };
  }
}