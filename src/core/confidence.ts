import { GoogleGenAI } from '@google/genai';

export interface ConfidenceResult {
  confidence: number;
  confidenceMethod: string;
  completions: string[];
  inputTokens: number;
  outputTokens: number;
}

export interface ConfidenceScorer {
  score(
    ai: GoogleGenAI,
    model: string,
    prompt: string,
    k?: number
  ): Promise<ConfidenceResult>;
}

/**
 * Tokenizes a string into a set of lowercased alphanumeric words.
 */
export function getTokens(text: string): Set<string> {
  const words = text.toLowerCase().match(/\b\w+\b/g) || [];
  return new Set(words);
}

/**
 * Computes Jaccard similarity between two token sets.
 */
export function jaccardSimilarity(setA: Set<string>, setB: Set<string>): number {
  if (setA.size === 0 && setB.size === 0) return 1.0;
  
  let intersectionSize = 0;
  for (const item of setA) {
    if (setB.has(item)) {
      intersectionSize++;
    }
  }
  
  const unionSize = setA.size + setB.size - intersectionSize;
  if (unionSize === 0) return 0.0;
  return intersectionSize / unionSize;
}

/**
 * Self-consistency confidence scorer that draws k low-temperature completions,
 * computes the average pairwise Jaccard similarity, and returns the result.
 */
export class SelfConsistencyScorer implements ConfidenceScorer {
  async score(
    ai: GoogleGenAI,
    model: string,
    prompt: string,
    k: number = 5
  ): Promise<ConfidenceResult> {
    // Generate k completions in parallel at temperature 0.3
    const promises = Array.from({ length: k }).map(async () => {
      try {
        const response = await ai.models.generateContent({
          model: model,
          contents: prompt,
          config: {
            temperature: 0.3,
          },
        });
        
        const text = response.text || '';
        const inputTokens = response.usageMetadata?.promptTokenCount || 0;
        const outputTokens = response.usageMetadata?.candidatesTokenCount || 0;
        
        return { text, inputTokens, outputTokens };
      } catch (error) {
        console.error(`Error calling Gemini model ${model}:`, error);
        // Return fallback/empty result so that the rest of the batch can proceed
        return { text: '', inputTokens: 0, outputTokens: 0 };
      }
    });

    const results = await Promise.all(promises);
    
    const completions = results.map(r => r.text).filter(t => t !== '');
    const totalInputTokens = results.reduce((acc, r) => acc + r.inputTokens, 0);
    const totalOutputTokens = results.reduce((acc, r) => acc + r.outputTokens, 0);

    if (completions.length < 2) {
      // If we failed to get at least 2 completions, we can't do pairwise comparison
      return {
        confidence: completions.length === 1 ? 1.0 : 0.0,
        confidenceMethod: `self_consistency_k${k}`,
        completions: completions.length > 0 ? completions : [''],
        inputTokens: totalInputTokens,
        outputTokens: totalOutputTokens,
      };
    }

    // Compute pairwise similarity for all C(n, 2) pairs
    const tokenSets = completions.map(getTokens);
    let totalSimilarity = 0;
    let pairsCount = 0;

    for (let i = 0; i < tokenSets.length; i++) {
      for (let j = i + 1; j < tokenSets.length; j++) {
        totalSimilarity += jaccardSimilarity(tokenSets[i], tokenSets[j]);
        pairsCount++;
      }
    }

    const confidence = pairsCount > 0 ? totalSimilarity / pairsCount : 0.0;

    return {
      confidence,
      confidenceMethod: `self_consistency_k${k}`,
      completions, // We return the list of completions so the cascade can use completions[0]
      inputTokens: totalInputTokens,
      outputTokens: totalOutputTokens,
    };
  }
}
