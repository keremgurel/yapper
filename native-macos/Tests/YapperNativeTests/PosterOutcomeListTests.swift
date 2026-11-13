import Foundation
import Testing
@testable import YapperNative

/// The outcome list shows every destination from the moment the press starts
/// and says in one line how the whole press went.
@Suite
struct PosterOutcomeListTests {
    private func outcome(_ platform: PublishPlatform, _ status: PosterOutcome.Status, url: String? = nil, error: String? = nil,
                         coverApplied: Bool? = nil, profile: String? = nil) -> PosterOutcome {
        PosterOutcome(videoID: "v", videoTitle: "Video", platform: platform, status: status, url: url.flatMap(URL.init(string:)),
                      error: error, coverApplied: coverApplied, profileURL: profile.flatMap(URL.init(string:)))
    }

    private func rows(_ outcomes: [PosterOutcome], inFlight: Set<PublishPlatform> = []) -> [PosterOutcomeRow] {
        PosterOutcomeRow.list(sent: Set(outcomes.map(\.platform)).union(inFlight), inFlight: inFlight, outcomes: outcomes)
    }

    @Test func everyDestinationIsListedWhileItGoesOut() {
        let list = rows([], inFlight: [.tiktok, .youtube])
        #expect(list.map(\.platform) == [.youtube, .tiktok])
        #expect(list.allSatisfy(\.isSending) && list.allSatisfy { $0.result == .sending })
        #expect(PosterOutcomeHeadline(rows: list) == PosterOutcomeHeadline(rows: rows([], inFlight: [.youtube, .tiktok])))
        #expect(PosterOutcomeHeadline(rows: list)?.text == "Publishing to YouTube and TikTok…")
        #expect(PosterOutcomeHeadline(rows: list)?.mark == .sending)
    }

    @Test func aRowFlipsToItsResultAsItLands() {
        let list = rows([outcome(.youtube, .posted, url: "https://youtube.com/shorts/abc")], inFlight: [.tiktok])
        #expect(list.map(\.isSending) == [false, true])
        #expect(list[0].result == .link(title: "View post", url: URL(string: "https://youtube.com/shorts/abc")!))
        #expect(PosterOutcomeHeadline(rows: list)?.text == "Publishing to TikTok…")
    }

    @Test func aDestinationSentAgainShowsAsSendingOverItsLastResult() {
        let failed = outcome(.tiktok, .failed, error: "post_failed")
        let list = PosterOutcomeRow.list(sent: [.youtube, .tiktok], inFlight: [.tiktok],
                                         outcomes: [outcome(.youtube, .posted, url: "https://youtube.com/shorts/abc"), failed])
        #expect(list.map(\.isSending) == [false, true])
        // If the press ends before a new result, the last one is back.
        let back = PosterOutcomeRow.list(sent: [.youtube, .tiktok], inFlight: [], outcomes: [failed])
        #expect(back.map(\.platform) == [.tiktok] && back[0].result == .status("Failed"))
    }

    @Test func tiktokWithoutAPostLinkOpensTheProfile() {
        let row = rows([outcome(.tiktok, .posted, profile: "https://www.tiktok.com/@kerem")])[0]
        #expect(row.result == .link(title: "Open profile", url: URL(string: "https://www.tiktok.com/@kerem")!))
        #expect(row.notes == ["It can take a few minutes to appear on your profile."])
        // A post link wins, and needs no note.
        let linked = rows([outcome(.tiktok, .posted, url: "https://www.tiktok.com/@kerem/video/1", profile: "https://www.tiktok.com/@kerem")])[0]
        #expect(linked.result == .link(title: "View post", url: URL(string: "https://www.tiktok.com/@kerem/video/1")!))
        #expect(linked.notes.isEmpty)
        #expect(rows([outcome(.tiktok, .posted)])[0].result == .status("Posted"))
    }

    @Test func otherResultsSayWhatIsLeftToDo() {
        let draft = rows([outcome(.tiktok, .draft)])[0]
        #expect(draft.result == .status("In your inbox") && draft.notes.count == 1 && !draft.isPosted)
        let pending = rows([outcome(.tiktok, .pending, error: "publish_in_progress")])[0]
        #expect(pending.result == .status("Confirming") && pending.notes == [PosterErrorCopy.publish("publish_in_progress")])
        let failed = rows([outcome(.instagram, .failed, error: "not_professional")])[0]
        #expect(failed.result == .status("Failed") && failed.notes == [PosterErrorCopy.publish("not_professional")])
        #expect(rows([outcome(.youtube, .scheduled)])[0].result == .status("Scheduled"))
        let cover = rows([outcome(.youtube, .posted, url: "https://youtube.com/shorts/abc", coverApplied: false)])[0]
        #expect(cover.notes == ["YouTube didn’t apply the cover. You can add it in YouTube Studio."])
    }

    @Test func theHeadlineSaysHowThePressWent() {
        func headline(_ outcomes: [PosterOutcome]) -> PosterOutcomeHeadline? { PosterOutcomeHeadline(rows: rows(outcomes)) }
        #expect(headline([]) == nil)
        let posted = headline([outcome(.tiktok, .posted), outcome(.youtube, .posted, url: "https://youtube.com/shorts/abc")])
        #expect(posted?.text == "Posted to YouTube and TikTok" && posted?.mark == .done)
        #expect(headline([outcome(.instagram, .posted)])?.text == "Posted to Instagram")
        let three = headline([outcome(.youtube, .posted), outcome(.tiktok, .posted), outcome(.instagram, .posted)])
        #expect(three?.text == "Posted to YouTube, TikTok, and Instagram")
        let inbox = headline([outcome(.tiktok, .draft)])
        #expect(inbox?.text == "Sent to your TikTok inbox" && inbox?.mark == .done)
        #expect(headline([outcome(.youtube, .posted), outcome(.tiktok, .draft)])?.text == "Posted to YouTube and sent to your TikTok inbox")
        let waiting = headline([outcome(.youtube, .posted), outcome(.tiktok, .pending, error: "publish_in_progress")])
        #expect(waiting?.text == "Waiting for confirmation" && waiting?.mark == .waiting)
        let failed = headline([outcome(.youtube, .posted), outcome(.tiktok, .failed, error: "post_failed")])
        #expect(failed?.text == "1 of 2 posts failed" && failed?.mark == .failed)
        // A failure outranks a wait.
        #expect(headline([outcome(.youtube, .pending), outcome(.tiktok, .failed)])?.mark == .failed)
        #expect(headline([outcome(.tiktok, .failed, error: "post_failed")])?.text == "Couldn’t post to TikTok")
    }

    @Test @MainActor func aPressListsItsDestinationsUntilItEnds() {
        let session = PosterPublishSession()
        #expect(session.rows.isEmpty)
        #expect(session.begin(sending: [.tiktok, .youtube]))
        #expect(session.posting && session.rows.map(\.platform) == [.youtube, .tiktok] && session.rows.allSatisfy(\.isSending))
        // A second press while one is going does nothing.
        #expect(!session.begin(sending: [.instagram]))
        #expect(session.rows.count == 2)
        // Ending without results, as when preparing the video fails, clears the list.
        session.end()
        #expect(!session.posting && session.rows.isEmpty)
        // A scheduled press sends nothing now, so it lists nothing.
        #expect(session.begin())
        #expect(session.rows.isEmpty)
    }

    @Test func statusChecksStartQuicklyAndBackOff() {
        let waits = (0..<PosterPublishPolling.attempts - 1).map(PosterPublishPolling.wait(afterPending:))
        #expect(PosterPublishPolling.attempts == 32)
        #expect(waits.prefix(5).allSatisfy { $0 == .seconds(2) })
        #expect(waits[5..<15].allSatisfy { $0 == .seconds(3) })
        #expect(waits[15...].allSatisfy { $0 == .seconds(5) })
        // The whole run still covers two minutes.
        #expect(waits.reduce(Duration.zero, +) == .seconds(120))
    }
}
