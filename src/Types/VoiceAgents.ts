import type { OpenEnum } from './Shared';

/**
 * Engines a voice agent runs on. `lumen-*` synthesize the voice from text and accept the
 * `stability`, `similarity_boost` and `speed` knobs; `prisma-1` and `horizon-1` are realtime.
 */
export type VoiceAgentEngineVersion = OpenEnum<'lumen-mini' | 'lumen-1' | 'prisma-1' | 'horizon-1'>;

/** Engine and voice of an agent. */
export interface VoiceAgentEngine {
  version: VoiceAgentEngineVersion;
  /** A voice of that engine, from `voiceAgents.listVoices`. */
  voice_id: string;
}

/**
 * Body of `voiceAgents.create` and `voiceAgents.update`. The update is a full replacement: a field
 * left out is cleared, or set back to its default.
 */
export interface VoiceAgentParams {
  /** 1 to 100 characters. */
  name: string;
  /**
   * Instructions of the agent. The limit depends on the engine: 2000 characters on `lumen-mini`,
   * 25000 on `lumen-1`, 35000 on `prisma-1` and `horizon-1`.
   */
  prompt: string;
  engine: VoiceAgentEngine;
  /** What the agent says first, up to 600 characters. */
  greetings?: string;
  /** Up to 500 characters. */
  description?: string;
  /** A voice action the agent can run. Not supported on `lumen-mini`. */
  action_id?: string;
  /** 0 to 1, `lumen-*` only. Defaults to 0.7. */
  stability?: number;
  /** 0 to 1, `lumen-*` only. Defaults to 0.75. */
  similarity_boost?: number;
  /** 0.7 to 1.2, `lumen-*` only. Defaults to 1.0. */
  speed?: number;
}

/** A voice agent. */
export interface VoiceAgent {
  /** The agent id (UUID), sent as `voice_agent_id`. */
  id: string;
  app_id: string;
  name: string;
  prompt: string;
  engine: VoiceAgentEngine;
  greetings?: string;
  description?: string;
  action_id?: string;
  /** `lumen-*` only. */
  stability?: number;
  /** `lumen-*` only. */
  similarity_boost?: number;
  /** `lumen-*` only. */
  speed?: number;
  created_at: string;
  updated_at: string;
}

/** One voice of the catalog. */
export interface VoiceAgentVoice {
  /** The value to send as `engine.voice_id`. */
  id: string;
  name: string;
  gender: OpenEnum<'female' | 'male'>;
}

/** Answer of `voiceAgents.listVoices`: the voices of each engine. */
export interface VoiceAgentVoiceCatalog {
  engines: {
    version: VoiceAgentEngineVersion;
    voices: VoiceAgentVoice[];
  }[];
}
