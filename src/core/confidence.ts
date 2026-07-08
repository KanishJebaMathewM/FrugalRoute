import OpenAI from 'openai';

export interface ConfidenceResult {
  confidence: number;
  confidenceMethod: string;
  completions: string[];
  inputTokens: number;
  outputTokens: number;
}

export interface ConfidenceScorer {
  score(
    client: OpenAI,
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
    if (setB.has(item)) intersectionSize++;
  }

  const unionSize = setA.size + setB.size - intersectionSize;
  if (unionSize === 0) return 0.0;
  return intersectionSize / unionSize;
}

/**
 * Self-consistency confidence scorer using the OpenAI-compatible API (OpenRouter).
 * Draws k low-temperature completions, computes average pairwise Jaccard similarity.
 */
export class SelfConsistencyScorer implements ConfidenceScorer {
  async score(
    client: OpenAI,
    model: string,
    prompt: string,
    k: number = 3
  ): Promise<ConfidenceResult> {
    const promises = Array.from({ length: k }).map(async () => {
      try {
        const response = await client.chat.completions.create({
          model,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.3,
          max_tokens: 1024,
        });

        const text = response.choices?.[0]?.message?.content || '';
        const inputTokens = response.usage?.prompt_tokens || 0;
        const outputTokens = response.usage?.completion_tokens || 0;

        return { text, inputTokens, outputTokens };
      } catch (error: any) {
        console.error(`Error calling model ${model}:`, error?.message || error);
        return { text: '', inputTokens: 0, outputTokens: 0 };
      }
    });

    const results = await Promise.all(promises);

    const completions = results.map(r => r.text).filter(t => t !== '');
    const totalInputTokens = results.reduce((acc, r) => acc + r.inputTokens, 0);
    const totalOutputTokens = results.reduce((acc, r) => acc + r.outputTokens, 0);

    if (completions.length < 2) {
      return {
        confidence: completions.length === 1 ? 1.0 : 0.0,
        confidenceMethod: `self_consistency_k${k}`,
        completions: completions.length > 0 ? completions : [''],
        inputTokens: totalInputTokens,
        outputTokens: totalOutputTokens,
      };
    }

    // Compute pairwise Jaccard similarity for all C(n,2) pairs
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
      completions,
      inputTokens: totalInputTokens,
      outputTokens: totalOutputTokens,
    };
  }
}
