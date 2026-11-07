import Combine
import Foundation

/// Every export the app is running, apart from the editor.
///
/// The editor allows one long operation at a time, and an export used to be
/// one, which locked every edit until the render finished. A job here holds
/// no editor lease: it renders its own `ExportProjectSnapshot`, so the creator
/// can keep editing, open another project, or start a second export.
@MainActor
final class ExportJobCenter: ObservableObject {
    typealias Work = @MainActor (ExportJobReporter) async throws -> ExportJob.Result

    @Published private(set) var jobs: [ExportJob] = []
    /// Called once per job, when it stops for any reason.
    var onFinish: (@MainActor (ExportJob) -> Void)?

    private var tasks: [UUID: Task<Void, Never>] = [:]
    private var waiters: [UUID: [CheckedContinuation<ExportJob, Never>]] = [:]

    var runningJobs: [ExportJob] { jobs.filter(\.state.isRunning) }

    func job(_ id: UUID) -> ExportJob? {
        jobs.first { $0.id == id }
    }

    @discardableResult
    func start(
        _ snapshot: ExportProjectSnapshot,
        kind: ExportJob.Kind,
        to destination: URL,
        work: @escaping Work
    ) -> UUID {
        let job = ExportJob(
            id: UUID(),
            kind: kind,
            projectID: snapshot.projectID,
            projectName: snapshot.projectName,
            package: snapshot.package,
            destination: destination,
            startedAt: Date(),
            state: .preparing
        )
        jobs.append(job)
        let id = job.id
        let reporter = ExportJobReporter(
            rendered: { [weak self] fraction in
                // Whole percents: the bar cannot show finer, and every change
                // redraws the indicator.
                self?.advance(id, to: .rendering((fraction * 100).rounded(.down) / 100))
            },
            posting: { [weak self] stage in self?.advance(id, to: .posting(stage)) }
        )
        tasks[id] = Task { @MainActor [weak self] in
            let outcome: ExportJobState
            do {
                outcome = .finished(try await work(reporter))
            } catch {
                // AVFoundation reports its own cancellation as an ordinary
                // error, so ask the task rather than the error.
                outcome = Task.isCancelled || error is CancellationError
                    ? .canceled
                    : .failed(error.localizedDescription)
            }
            self?.finish(id, as: outcome)
        }
        return id
    }

    func cancel(_ id: UUID) {
        tasks[id]?.cancel()
    }

    /// Takes a finished, failed job off the list. Running jobs stay.
    func dismiss(_ id: UUID) {
        jobs.removeAll { $0.id == id && !$0.state.isRunning }
    }

    func dismissFinished() {
        jobs.removeAll { !$0.state.isRunning }
    }

    /// Waits for a job to stop and returns it as it ended.
    func completion(of id: UUID) async -> ExportJob? {
        guard let job = job(id) else { return nil }
        guard job.state.isRunning else { return job }
        return await withCheckedContinuation { waiters[id, default: []].append($0) }
    }

    /// True while an export is still copying this project's footage. Moving
    /// or trashing the package then would take files out from under the copy.
    func isReadingSources(of package: ProjectPackage) -> Bool {
        jobs.contains { $0.package == package && $0.state == .preparing }
    }

    /// Two jobs writing one file would each replace the other's result.
    func isExporting(to destination: URL) -> Bool {
        let target = destination.standardizedFileURL
        return runningJobs.contains { $0.destination.standardizedFileURL == target }
    }

    private func advance(_ id: UUID, to state: ExportJobState) {
        guard let index = jobs.firstIndex(where: { $0.id == id }),
              let next = jobs[index].state.advanced(to: state)
        else { return }
        jobs[index].state = next
    }

    private func finish(_ id: UUID, as outcome: ExportJobState) {
        tasks[id] = nil
        guard let index = jobs.firstIndex(where: { $0.id == id }) else { return }
        jobs[index].state = outcome
        let job = jobs[index]
        // A cancel was the creator's own choice. There is nothing to report.
        if outcome == .canceled { jobs.remove(at: index) }
        onFinish?(job)
        for waiter in waiters.removeValue(forKey: id) ?? [] {
            waiter.resume(returning: job)
        }
    }
}
