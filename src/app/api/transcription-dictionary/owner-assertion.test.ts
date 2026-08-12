import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";
import { DICTIONARY_OWNER_HEADER } from "@/lib/studio/transcription-dictionary-owner";

const mocks = vi.hoisted(() => ({
  deleteDictionaryEntry: vi.fn(),
  ensureUser: vi.fn(),
  listDictionaryEntries: vi.fn(),
  updateDictionaryEntry: vi.fn(),
  upsertDictionaryEntry: vi.fn(),
}));

vi.mock("@clerk/nextjs/server", () => ({
  auth: vi.fn().mockResolvedValue({ userId: "user_B" }),
}));
vi.mock("@/lib/db/users", () => ({ ensureUser: mocks.ensureUser }));
vi.mock("@/lib/db/transcription-dictionary", () => ({
  deleteDictionaryEntry: mocks.deleteDictionaryEntry,
  listDictionaryEntries: mocks.listDictionaryEntries,
  updateDictionaryEntry: mocks.updateDictionaryEntry,
  upsertDictionaryEntry: mocks.upsertDictionaryEntry,
}));

import { DELETE, PATCH } from "./[id]/route";
import { GET, POST } from "./route";

const request = (method: string) =>
  new Request("https://ypr.app/api/transcription-dictionary/entry", {
    method,
    headers: {
      "Content-Type": "application/json",
      [DICTIONARY_OWNER_HEADER]: "user_A",
    },
    body:
      method === "POST" || method === "PATCH"
        ? JSON.stringify({ term: "Private term", aliases: [] })
        : undefined,
  }) as NextRequest;

beforeEach(() => vi.clearAllMocks());

describe("dictionary request owner assertion", () => {
  it("rejects an A request executing under B before any database work", async () => {
    const params = { params: Promise.resolve({ id: "entry" }) };
    const responses = await Promise.all([
      GET(request("GET")),
      POST(request("POST")),
      PATCH(request("PATCH"), params),
      DELETE(request("DELETE"), params),
    ]);

    expect(responses.map((response) => response.status)).toEqual([
      409, 409, 409, 409,
    ]);
    for (const response of responses) {
      await expect(response.json()).resolves.toEqual({
        error: "account_changed",
      });
    }
    expect(mocks.ensureUser).not.toHaveBeenCalled();
    expect(mocks.listDictionaryEntries).not.toHaveBeenCalled();
    expect(mocks.upsertDictionaryEntry).not.toHaveBeenCalled();
    expect(mocks.updateDictionaryEntry).not.toHaveBeenCalled();
    expect(mocks.deleteDictionaryEntry).not.toHaveBeenCalled();
  });

  it("keeps the authenticated native client compatible without a header", async () => {
    mocks.listDictionaryEntries.mockResolvedValue([]);

    const response = await GET(
      new Request(
        "https://ypr.app/api/transcription-dictionary",
      ) as NextRequest,
    );

    expect(response.status).toBe(200);
    expect(mocks.listDictionaryEntries).toHaveBeenCalledWith("user_B");
  });
});
