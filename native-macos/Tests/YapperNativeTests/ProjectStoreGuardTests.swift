import Foundation
import Testing
@testable import YapperNative

/// The tests must never be able to touch the creator's own project.
///
/// An `EditorSession` made without a store loads the saved project the moment
/// it exists and saves again after almost any edit, and plenty of tests make
/// one. The guard that sends those somewhere harmless was written for XCTest
/// and quietly stopped matching when the suite moved to swift-testing, so a
/// `swift test` wrote a fixture over an afternoon's editing. A guard nobody
/// checks is not a guard.
@Suite
struct ProjectStoreGuardTests {
    @Test("The suite knows it is the suite")
    func detectsTheTestRun() {
        #expect(ProjectStore.isTesting)
    }

    @Test("Nothing here writes anywhere near the real project")
    func staysOutOfApplicationSupport() {
        let path = ProjectStore.directory.path
        #expect(!path.contains("Application Support"))
        #expect(path.contains("YapperNativeTests"))
    }

    @MainActor
    @Test("A store made the ordinary way is still safe here")
    func defaultStoreIsRedirected() async {
        let session = EditorSession()
        session.updateProject { project in
            project = EditorProject(name: "fixture that must not escape")
        }
        _ = session
        let real = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)
            .first?
            .appending(path: "Yapper Studio Native/CurrentProject.json")
        if let real, let data = try? Data(contentsOf: real),
           let text = String(data: data, encoding: .utf8)
        {
            #expect(!text.contains("fixture that must not escape"))
        }
    }
}
