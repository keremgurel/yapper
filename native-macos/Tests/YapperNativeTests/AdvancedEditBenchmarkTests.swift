import Foundation
import Testing
@testable import YapperNative

/// The advanced edit benchmark (docs/advanced-edit-benchmark.md): a real
/// project goes through the editor's own "add overlays" flow against a backend
/// you point it at, and the result is exported. Opt in, paid, and local: it
/// writes every request and reply, the edited project and the export into
/// ADVANCED_EDIT_OUTPUT and never saves over the source package.
@Suite(.serialized)
@MainActor
struct AdvancedEditBenchmarkTests {
    private actor NoSave: ProjectPersisting {
        func load() async throws -> EditorProject? { nil }
        func save(_ project: EditorProject) async throws {}
    }

    @Test(.enabled(if: ProcessInfo.processInfo.environment["RUN_ADVANCED_EDIT_BENCHMARK"] == "1"))
    func runsTheOverlayFlowOnARealProject() async throws {
        let environment = ProcessInfo.processInfo.environment
        let folder = URL(fileURLWithPath: try #require(environment["ADVANCED_EDIT_OUTPUT"]))
        let endpoint = try #require(environment["ADVANCED_EDIT_ENDPOINT"])
        let package = URL(fileURLWithPath: try #require(environment["ADVANCED_EDIT_PROJECT"]))
        let instruction = environment["ADVANCED_EDIT_INSTRUCTION"] ?? "Add overlays where they would improve the video."
        try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)

        var call = 0
        let session = EditorSession(store: NoSave(), generatedAssetRoot: folder, generatedOverlayRequest: { path, body in
            call += 1
            let stem = String(format: "%02d-%@", call, path)
            var request = URLRequest(url: URL(string: endpoint + "/" + path)!)
            request.httpMethod = "POST"
            request.timeoutInterval = 600
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.httpBody = try JSONSerialization.data(withJSONObject: body)
            try request.httpBody?.write(to: folder.appending(path: stem + ".request.json"))
            let began = Date()
            let (data, response) = try await URLSession.shared.data(for: request)
            try data.write(to: folder.appending(path: stem + ".reply.json"))
            let status = (response as? HTTPURLResponse)?.statusCode ?? 0
            let line = "\(stem) \(status) \(String(format: "%.1f", Date().timeIntervalSince(began))) s\n"
            if let log = try? FileHandle(forWritingTo: folder.appending(path: "calls.log")) {
                log.seekToEndOfFile(); log.write(Data(line.utf8)); try? log.close()
            } else {
                try Data(line.utf8).write(to: folder.appending(path: "calls.log"))
            }
            guard status == 200, let reply = try JSONSerialization.jsonObject(with: data) as? [String: Any] else {
                throw NativeEditorError.aiFailed("\(path) answered \(status): " + (String(data: data, encoding: .utf8) ?? ""))
            }
            return reply
        })

        let loaded = try #require(await ProjectPackageStore(package: ProjectPackage(url: package)).load())
        let source = try #require(loaded.media.first(where: { $0.id == loaded.clips.first?.mediaID }))
        await session.importMedia([source.url])
        session.updateProject { $0 = loaded }

        let began = Date()
        await session.performGeneratedOverlays(instruction: instruction, revising: [])
        let summary = [
            "instruction": instruction,
            "seconds": Date().timeIntervalSince(began),
            "status": session.statusMessage,
            "error": session.errorMessage ?? "",
            "scenes": session.project.media.filter(\.isScene).count,
        ] as [String: Any]
        try JSONSerialization.data(withJSONObject: summary, options: .prettyPrinted).write(to: folder.appending(path: "summary.json"))
        try JSONEncoder().encode(session.project).write(to: folder.appending(path: "edited-project.json"), options: .atomic)
        if environment["ADVANCED_EDIT_SKIP_EXPORT"] != "1" {
            try await ExportService.export(project: session.project, to: folder.appending(path: "export.mp4"), maximumRenderDimension: 1920)
        }
    }
}
