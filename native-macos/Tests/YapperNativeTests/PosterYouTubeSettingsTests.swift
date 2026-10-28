import Testing
@testable import YapperNative

/// The same rules as the web's YouTube settings: public and not made for kids
/// until the creator changes them, and descriptions measured the way YouTube
/// measures them.
@Suite
struct PosterYouTubeSettingsTests {
    @Test func startsPublicAndNotMadeForKids() {
        let settings = PosterYouTubeSettings()
        #expect(settings.body["privacyStatus"] as? String == "public")
        #expect(settings.body["selfDeclaredMadeForKids"] as? Bool == false)
        #expect(settings.body["containsSyntheticMedia"] as? Bool == false)
    }

    @Test func sendsWhatWasChosen() {
        var settings = PosterYouTubeSettings()
        settings.visibility = .unlisted
        settings.madeForKids = false
        #expect(settings.body["privacyStatus"] as? String == "unlisted")
        #expect(settings.body["selfDeclaredMadeForKids"] as? Bool == false)
    }

    @Test func countsDescriptionBytesNotCharacters() {
        #expect(!PosterYouTubeSettings.descriptionTooLong(String(repeating: "a", count: 5000)))
        // An emoji is four bytes, so 1,251 of them run past 5,000.
        #expect(PosterYouTubeSettings.descriptionTooLong(String(repeating: "🎬", count: 1251)))
    }
}
