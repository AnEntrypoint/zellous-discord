import type { Config } from "../config.js";

export interface VoiceProof {
  identityCount: number;
  frameCount: number;
  discordToZellousFrames: number;
  zellousToDiscordFrames: number;
  mixedAudio: boolean;
}

export interface VoiceReadiness {
  complete: boolean;
  degraded: boolean;
  reason: string | null;
  voiceTokenCount: number;
  voicePoolState: "absent" | "insufficient" | "ready";
  voiceReflectionComplete: boolean;
  identityCount: number;
  frameCount: number;
}

export function emptyVoiceProof(): VoiceProof {
  return { identityCount: 0, frameCount: 0, discordToZellousFrames: 0, zellousToDiscordFrames: 0, mixedAudio: false };
}

export function voiceReadiness(config: Config, proof: VoiceProof): VoiceReadiness {
  const complete = config.voiceTokens.length >= 2 && config.privilegedIntentsEnabled && !proof.mixedAudio && proof.identityCount >= 2 && proof.frameCount >= 2 && proof.discordToZellousFrames > 0 && proof.zellousToDiscordFrames > 0;
  let reason: string | null = null;
  if (config.voiceTokens.length === 0) reason = "VOICE_POOL_ABSENT";
  else if (config.voiceTokens.length === 1) reason = "VOICE_POOL_INSUFFICIENT";
  else if (!config.privilegedIntentsEnabled) reason = "PRIVILEGED_INTENTS_ABSENT";
  else if (proof.identityCount < 2 || proof.frameCount < 2 || proof.discordToZellousFrames === 0 || proof.zellousToDiscordFrames === 0) reason = "VOICE_FRAMES_UNPROVEN";
  const voicePoolState = config.voiceTokens.length === 0 ? "absent" : config.voiceTokens.length === 1 ? "insufficient" : "ready";
  return { complete, degraded: !complete, reason, voiceTokenCount: config.voiceTokens.length, voicePoolState, voiceReflectionComplete: complete, identityCount: proof.identityCount, frameCount: proof.frameCount };
}
