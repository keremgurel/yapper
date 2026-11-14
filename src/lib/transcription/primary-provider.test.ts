import { afterEach, expect, it, vi } from "vitest";
import { elevenLabsPrimaryKey } from "./primary-provider";

afterEach(() => vi.unstubAllEnvs());

it("stays off until the flag names ElevenLabs", () => {
  vi.stubEnv("ELEVENLABS_API_KEY", "el_test");
  vi.stubEnv("TRANSCRIPTION_PRIMARY", "");
  expect(elevenLabsPrimaryKey()).toBeUndefined();
  vi.stubEnv("TRANSCRIPTION_PRIMARY", "deepgram");
  expect(elevenLabsPrimaryKey()).toBeUndefined();
});

it("stays off when the flag is set and the key is missing", () => {
  vi.stubEnv("TRANSCRIPTION_PRIMARY", "elevenlabs");
  vi.stubEnv("ELEVENLABS_API_KEY", "");
  expect(elevenLabsPrimaryKey()).toBeUndefined();
});

it("returns the key when both are set", () => {
  vi.stubEnv("TRANSCRIPTION_PRIMARY", "elevenlabs");
  vi.stubEnv("ELEVENLABS_API_KEY", "el_test");
  expect(elevenLabsPrimaryKey()).toBe("el_test");
});
