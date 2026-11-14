import Testing

/// Polls until `condition` holds, for state that settles a hop or two later.
@MainActor
func eventually(
    _ condition: @MainActor () async -> Bool,
    sourceLocation: SourceLocation = #_sourceLocation
) async throws {
    for _ in 0 ..< 600 {
        if await condition() { return }
        try await Task.sleep(for: .milliseconds(5))
    }
    Issue.record("Condition was never met", sourceLocation: sourceLocation)
}
