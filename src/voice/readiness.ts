import type { Config } from "../config.js";

export interface VoiceProof {
  identityCount: number;
  frameCount: number;
  discordToZellousFrames: number;
  zellousToDiscordFrames: number;
}

export interface VoiceReadiness {
  complete: boolean;
  degraded: boolean;
  reason: string | null;
  voiceTokenCount: number;
  voiceReflectionComplete: boolean;
  identityCount: number;
  frameCount: number;
}

export function emptyVoiceProof(): VoiceProof {
  return { identityCount: 0, frameCount: 0, discordToZellousFrames: 0, zellousToDiscordFrames: 0 };
}

export function voiceReadiness(config: Config, proof: VoiceProof): VoiceReadiness {
  const complete = config.voiceTokens.length >= 2 && config.privilegedIntentsEnabled && proof.identityCount >= 2 && proof.frameCount >= 2 && proof.discordToZellousFrames > 0 && proof.zellousToDiscordFrames > 0;
  let reason: string | null = null;
  if (config.voiceTokens.length < 2) reason = "VOICE_POOL_ABSENT";
  else if (!config.privilegedIntentsEnabled) reason = "PRIVILEGED_INTENTS_ABSENT";
  else if (proof.identityCount < 2 || proof.frameCount < 2 || proof.discordToZellousFrames === 0 || proof.zellousToDiscordFrames === 0) reason = "VOICE_FRAMES_UNPROVEN";
  return { complete, degraded: !complete, reason, voiceTokenCount: config.voiceTokens.length, voiceReflectionComplete: complete, identityCount: proof.identityCount, frameCount: proof.frameCount };
}
