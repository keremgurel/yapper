import Foundation

/// The sign-in form: an email, then the code Clerk sent to it.
///
/// The address is remembered on this Mac, so the next time the session runs
/// out signing back in is a code and nothing else.
@MainActor
final class EmailSignInModel: ObservableObject {
    enum Step: Equatable {
        case email
        case code(email: String, flow: ClerkEmailCode.Flow)
    }

    static let codeLength = 6
    static let resendDelay: TimeInterval = 30
    private static let lastEmailKey = "studioSignInEmail"

    @Published var email = UserDefaults.standard.string(forKey: lastEmailKey) ?? ""
    @Published private(set) var code = ""
    @Published private(set) var step: Step = .email
    @Published private(set) var isWorking = false
    @Published private(set) var error: String?
    /// When "Send a new code" comes back; Clerk limits how often it sends.
    @Published private(set) var resendAvailableAt = Date.distantPast

    var canSend: Bool {
        let trimmed = email.trimmingCharacters(in: .whitespacesAndNewlines)
        return !isWorking && trimmed.contains("@") && trimmed.count >= 3
    }

    func sendCode() async {
        guard canSend else { return }
        let address = email.trimmingCharacters(in: .whitespacesAndNewlines)
        await send(to: address)
    }

    func resend() async {
        guard case let .code(address, _) = step, !isWorking, Date() >= resendAvailableAt else { return }
        code = ""
        await send(to: address)
    }

    /// Keeps digits only, and checks the code as soon as it is all there:
    /// a pasted code signs in without another click.
    func updateCode(_ typed: String) {
        let digits = String(typed.filter(\.isNumber).prefix(Self.codeLength))
        guard digits != code else { return }
        code = digits
        error = nil
        if digits.count == Self.codeLength { Task { await verify() } }
    }

    func verify() async {
        guard case let .code(address, flow) = step, !isWorking, code.count == Self.codeLength else { return }
        isWorking = true
        error = nil
        let result = await ClerkEmailCode.verify(code, flow: flow)
        isWorking = false
        switch result {
        case let .signedIn(identity):
            UserDefaults.standard.set(address, forKey: Self.lastEmailKey)
            finish(identity)
        case let .failed(message):
            error = message
            code = ""
        }
    }

    func useDifferentEmail() {
        step = .email
        code = ""
        error = nil
    }

    private func send(to address: String) async {
        isWorking = true
        error = nil
        let result = await ClerkEmailCode.send(to: address)
        isWorking = false
        switch result {
        case let .sent(flow):
            step = .code(email: address, flow: flow)
            resendAvailableAt = Date().addingTimeInterval(Self.resendDelay)
        case let .alreadySignedIn(identity):
            finish(identity)
        case let .failed(message):
            error = message
        }
    }

    /// Clerk has the session; tell the shell rather than wait for the page
    /// to notice and say so itself.
    private func finish(_ identity: ClerkEmailCode.Identity) {
        StudioAuth.shared.report(
            signedIn: true,
            userID: identity.userID,
            displayName: identity.name,
            email: identity.email,
            imageURL: identity.imageURL
        )
    }
}
