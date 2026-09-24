import Foundation
import Testing
@testable import YapperNative

@MainActor
struct StudioChirpyThreadTests {
    private func folder() throws -> URL {
        let url = FileManager.default.temporaryDirectory.appending(path: "chirpy-threads-\(UUID().uuidString)")
        try FileManager.default.createDirectory(at: url, withIntermediateDirectories: true)
        return url
    }

    @Test func eachTabKeepsItsOwnThreadAcrossLaunches() throws {
        let dir = try folder()
        let brain = AssistantConversation()
        brain.attachThread(key: "user:brain", url: dir.appending(path: "brain.json"))
        let poster = AssistantConversation()
        poster.attachThread(key: "user:poster", url: dir.appending(path: "poster.json"))

        brain.ask("Add a pillar about sports")
        brain.answer(.chirpy("Added it.", tone: .done))
        poster.ask("Write captions")

        let reopened = AssistantConversation()
        reopened.attachThread(key: "user:brain", url: dir.appending(path: "brain.json"))
        #expect(reopened.messages.map(\.text) == ["Add a pillar about sports", "Added it."])
        #expect(!reopened.messages.contains { $0.text == "Write captions" })
        #expect(reopened.recentHistory().map(\.author) == [.you, .chirpy])
    }

    @Test func aTabThreadKeepsTheSameIdentity() {
        #expect(UUID.named("user:brain") == UUID.named("user:brain"))
        #expect(UUID.named("user:brain") != UUID.named("user:poster"))
    }
}
