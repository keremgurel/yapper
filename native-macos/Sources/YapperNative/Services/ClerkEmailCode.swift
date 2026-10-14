import Foundation

/// Email-code sign-in, carried out by Clerk in the hidden web page.
///
/// That page already holds the session every native request borrows, so
/// signing in there is signing in the app, and it stays signed in across
/// launches the same way. Clerk emails a six-digit code, the creator types it
/// into the native screen, and Clerk turns it into a session. An address Clerk
/// has never seen gets an account the same way, so there is no separate
/// sign-up step to choose.
@MainActor
enum ClerkEmailCode {
    /// A known address signs in; a new one signs up. The code is checked
    /// against whichever of the two Clerk started.
    enum Flow: String, Equatable, Sendable {
        case signIn = "sign_in"
        case signUp = "sign_up"
    }

    enum SendResult: Equatable {
        case sent(Flow)
        case alreadySignedIn(Identity)
        case failed(String)
    }

    enum VerifyResult: Equatable {
        case signedIn(Identity)
        case failed(String)
    }

    struct Identity: Equatable {
        let userID: String?
        let name: String?
        let email: String?
        let imageURL: String?
    }

    static func send(to email: String) async -> SendResult {
        let reply = await run(sendScript, arguments: ["email": email], timeout: 20)
        switch reply?["status"] as? String {
        case "sent":
            return .sent(Flow(rawValue: reply?["flow"] as? String ?? "") ?? .signIn)
        case "signed_in":
            return .alreadySignedIn(identity(in: reply))
        default:
            return .failed(ClerkEmailCodeMessages.message(for: reply))
        }
    }

    static func verify(_ code: String, flow: Flow) async -> VerifyResult {
        let reply = await run(verifyScript, arguments: ["code": code, "flow": flow.rawValue], timeout: 20)
        guard reply?["status"] as? String == "complete" else {
            return .failed(ClerkEmailCodeMessages.message(for: reply))
        }
        return .signedIn(identity(in: reply))
    }

    private static func identity(in reply: [String: Any]?) -> Identity {
        Identity(
            userID: reply?["userId"] as? String,
            name: reply?["name"] as? String,
            email: reply?["email"] as? String,
            imageURL: reply?["imageURL"] as? String
        )
    }

    /// Nil when the page never answered: asleep, still loading, or offline.
    private static func run(_ body: String, arguments: [String: Any], timeout: TimeInterval) async -> [String: Any]? {
        let result = await StudioWebCommands.shared.runJavaScript(
            prelude + body,
            arguments: arguments,
            timeout: timeout
        )
        return result as? [String: Any]
    }

    /// Waits for clerk-js, which a page that has only just started loading
    /// may not have yet. Both scripts read Clerk's first error, and describe
    /// whoever ends up signed in, the same way.
    private static let prelude = """
    let clerk = window.Clerk;
    for (let attempt = 0; !clerk && attempt < 100; attempt += 1) {
      await new Promise(resolve => setTimeout(resolve, 50));
      clerk = window.Clerk;
    }
    if (!clerk) return { error: 'not_ready' };
    await clerk.load();
    const failure = (error) => {
      const first = error?.errors?.[0];
      return { error: first?.code || 'unknown', message: first?.longMessage || first?.message || null };
    };
    const describe = (status) => {
      const user = clerk.user;
      const name = user?.fullName || [user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.username || null;
      return {
        status,
        userId: user?.id ?? null,
        name,
        email: user?.primaryEmailAddress?.emailAddress ?? null,
        imageURL: user?.imageUrl ?? null,
      };
    };

    """

    /// Tries the address as a sign-in first, and only an address Clerk does
    /// not know becomes a sign-up.
    private static let sendScript = """
    if (clerk.user) return describe('signed_in');
    try {
      const signIn = await clerk.client.signIn.create({ identifier: email });
      const factor = (signIn.supportedFirstFactors || []).find(f => f.strategy === 'email_code');
      if (!factor) return { error: 'no_email_code' };
      await signIn.prepareFirstFactor({ strategy: 'email_code', emailAddressId: factor.emailAddressId });
      return { status: 'sent', flow: 'sign_in' };
    } catch (error) {
      if (error?.errors?.[0]?.code !== 'form_identifier_not_found') return failure(error);
    }
    try {
      const signUp = await clerk.client.signUp.create({ emailAddress: email });
      await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
      return { status: 'sent', flow: 'sign_up' };
    } catch (error) {
      return failure(error);
    }
    """

    private static let verifyScript = """
    if (clerk.user) return describe('complete');
    try {
      const attempt = flow === 'sign_up'
        ? await clerk.client.signUp.attemptEmailAddressVerification({ code })
        : await clerk.client.signIn.attemptFirstFactor({ strategy: 'email_code', code });
      if (attempt.status !== 'complete' || !attempt.createdSessionId) return { error: 'incomplete' };
      await clerk.setActive({ session: attempt.createdSessionId });
      return describe('complete');
    } catch (error) {
      if (error?.errors?.[0]?.code === 'session_exists') return describe('complete');
      return failure(error);
    }
    """
}
