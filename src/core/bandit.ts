import { db } from '../db/client.js';
import { banditState } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { QualityBar } from '../types.js';

// Standard normal distribution sampler using Box-Muller transform
function randomNormal(): number {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

// Gamma distribution sampler using Marsaglia and Tsang method (2000)
function randomGamma(a: number): number {
  if (a < 1) {
    // Boost method for shape parameter < 1
    return randomGamma(a + 1) * Math.pow(Math.random(), 1.0 / a);
  }
  const d = a - 1.0 / 3.0;
  const c = 1.0 / Math.sqrt(9.0 * d);
  while (true) {
    const z = randomNormal();
    const v = 1.0 + c * z;
    if (v <= 0) continue;
    const v3 = v * v * v;
    const u = Math.random();
    if (u < 1.0 - 0.0331 * z * z * z * z) {
      return d * v3;
    }
    if (Math.log(u) < 0.5 * z * z + d * (1.0 - v3 + Math.log(v3))) {
      return d * v3;
    }
  }
}

/**
 * Samples a value from the Beta distribution Beta(alpha, beta).
 */
export function sampleBeta(alpha: number, beta: number): number {
  const y1 = randomGamma(alpha);
  const y2 = randomGamma(beta);
  if (y1 + y2 === 0) return 0.5; // Prevent division by zero
  return y1 / (y1 + y2);
}

/**
 * Bandit parameters for threshold updates.
 */
const LEARNING_RATE = 0.02;
const TARGET_ACCEPT_RATE = 0.90;

/**
 * Gets or initializes the bandit state for a given task type.
 */
export async function getOrCreateBanditState(taskType: string) {
  const states = await db.select().from(banditState).where(eq(banditState.taskType, taskType));
  if (states.length > 0) {
    return states[0];
  }
  
  // Initialize state
  const newState = {
    taskType,
    alpha: 1.0,
    beta: 1.0,
    confidenceThreshold: 0.85,
    samplesSeen: 0,
    updatedAt: new Date(),
  };

  try {
    await db.insert(banditState).values(newState);
  } catch (error) {
    // In case of parallel inserts, catch unique constraint and select again
    const fallback = await db.select().from(banditState).where(eq(banditState.taskType, taskType));
    if (fallback.length > 0) {
      return fallback[0];
    }
  }

  return newState;
}

/**
 * Samples a threshold at read-time via Thompson Sampling.
 * Applies the quality bar shift and clamps the result to [0, 1].
 */
export async function getThreshold(taskType: string, qualityBar: QualityBar): Promise<{
  threshold: number;
  perturbedThreshold: number;
  storedThreshold: number;
}> {
  const state = await getOrCreateBanditState(taskType);
  const { alpha, beta, confidenceThreshold: storedThreshold } = state;

  // Thompson Sampling: sample a success rate from the Beta distribution
  const p = sampleBeta(alpha, beta);
  const mean = alpha / (alpha + beta);

  // Perturb the threshold: nudge down if p > mean (optimistic), nudge up if p < mean (pessimistic)
  const perturbation = mean - p;
  const perturbedThreshold = Math.min(Math.max(storedThreshold + perturbation, 0.5), 0.99);

  // Apply quality bar offset: draft (-0.15), standard (0.00), strict (+0.10)
  let offset = 0;
  if (qualityBar === 'draft') {
    offset = -0.15;
  } else if (qualityBar === 'strict') {
    offset = 0.10;
  }

  const threshold = Math.min(Math.max(perturbedThreshold + offset, 0.0), 1.0);

  return {
    threshold,
    perturbedThreshold,
    storedThreshold,
  };
}

/**
 * Updates the bandit posterior after receiving feedback.
 */
export async function updateBanditState(taskType: string, accepted: boolean): Promise<typeof banditState.$inferSelect> {
  const state = await getOrCreateBanditState(taskType);
  
  const newAlpha = state.alpha + (accepted ? 1.0 : 0.0);
  const newBeta = state.beta + (accepted ? 0.0 : 1.0);
  
  const posteriorMean = newAlpha / (newAlpha + newBeta);
  
  // Recompute threshold: nudge down slightly if acceptance rate is high, nudge up if it's dropping
  const newThreshold = Math.min(
    Math.max(state.confidenceThreshold + LEARNING_RATE * (TARGET_ACCEPT_RATE - posteriorMean), 0.5),
    0.99
  );

  const updatedValues = {
    alpha: newAlpha,
    beta: newBeta,
    confidenceThreshold: newThreshold,
    samplesSeen: state.samplesSeen + 1,
    updatedAt: new Date(),
  };

  await db.update(banditState)
    .set(updatedValues)
    .where(eq(banditState.taskType, taskType));

  return {
    taskType,
    ...updatedValues,
  };
}
