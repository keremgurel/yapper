import Foundation
import Testing
@testable import YapperNative

/// The rail and the search field are the whole navigation of a page that holds
/// twenty-odd sounds, so what is tested here is that a shelf shows what it
/// claims to and that its count agrees with it.
@Suite
struct AudioLibraryFilterTests {
    private func saved(
        _ name: String,
        kind: SavedAudioKind = .effect,
        addedAt: Date = Date()
    ) -> SavedAudio {
        SavedAudio(
            name: name,
            kind: kind,
            fileName: "\(name).m4a",
            duration: 1,
            contentHash: name,
            addedAt: addedAt
        )
    }

    @Test("The creator's own sounds come before the shipped ones")
    func ownSoundsFirst() {
        let entries = AudioEntry.all(saved: [saved("Mine")])
        #expect(entries.first?.name == "Mine")
        #expect(entries.count == 1 + SoundEffectDescriptor.library.count)
    }

    @Test("Newest import first, so what just landed is at the top")
    func newestFirst() {
        let old = saved("Older", addedAt: Date(timeIntervalSince1970: 1))
        let new = saved("Newer", addedAt: Date(timeIntervalSince1970: 2))
        let entries = AudioEntry.all(saved: [old, new]).filter(\.isSaved)
        #expect(entries.map(\.name) == ["Newer", "Older"])
    }

    @Test("A shelf shows what it claims to")
    func shelvesFilter() {
        let entries = AudioEntry.all(saved: [saved("Bed", kind: .music)])

        let yours = AudioLibraryFilter.entries(entries, section: .yours, search: "")
        #expect(yours.map(\.name) == ["Bed"])

        let music = AudioLibraryFilter.entries(entries, section: .savedKind(.music), search: "")
        #expect(music.map(\.name) == ["Bed"])
        #expect(AudioLibraryFilter.entries(entries, section: .savedKind(.voice), search: "").isEmpty)

        let builtIn = AudioLibraryFilter.entries(entries, section: .builtIn, search: "")
        #expect(builtIn.count == SoundEffectDescriptor.library.count)
        #expect(builtIn.allSatisfy { !$0.isSaved })

        let clicks = AudioLibraryFilter.entries(entries, section: .effects(.clicks), search: "")
        #expect(!clicks.isEmpty)
        #expect(clicks.allSatisfy { $0.effect?.category == .clicks })
    }

    @Test("Search reads the name, the description and the shelf")
    func searchIsBroad() {
        let entries = AudioEntry.all(saved: [])
        // By name.
        #expect(
            AudioLibraryFilter.entries(entries, section: .all, search: "swoosh")
                .allSatisfy { $0.name.localizedCaseInsensitiveContains("swoosh") }
        )
        // By what it is, which is how anyone looks for a cash register.
        let register = AudioLibraryFilter.entries(entries, section: .all, search: "cash register")
        #expect(register.map(\.name) == ["Cha-ching"])
        // Case does not matter.
        #expect(!AudioLibraryFilter.entries(entries, section: .all, search: "POP").isEmpty)
    }

    @Test("A search that matches nothing shows nothing rather than everything")
    func emptySearch() {
        let entries = AudioEntry.all(saved: [])
        #expect(AudioLibraryFilter.entries(entries, section: .all, search: "zzzz").isEmpty)
        // Whitespace is not a query: it must not empty the page.
        #expect(
            AudioLibraryFilter.entries(entries, section: .all, search: "   ").count
                == entries.count
        )
    }

    @Test("Counts in the rail follow the search")
    func countsFollowSearch() {
        let entries = AudioEntry.all(saved: [saved("My click", kind: .effect)])
        let all = AudioLibraryFilter.count(entries, section: .all, search: "click")
        let yours = AudioLibraryFilter.count(entries, section: .yours, search: "click")
        let clicks = AudioLibraryFilter.count(entries, section: .effects(.clicks), search: "click")

        #expect(yours == 1)
        #expect(clicks > 0)
        #expect(all >= yours + clicks)
        #expect(AudioLibraryFilter.count(entries, section: .yours, search: "swoosh") == 0)
    }

    @Test("Groups keep the order they were given")
    func groupsKeepOrder() {
        let entries = AudioEntry.all(saved: [saved("Mine", kind: .music)])
        let groups = AudioLibraryFilter.groups(entries)
        #expect(groups.first?.title == SavedAudioKind.music.title)
        #expect(groups.map(\.title).count == Set(groups.map(\.title)).count)
        #expect(groups.reduce(0) { $0 + $1.entries.count } == entries.count)
    }

    @Test("Every rail row is reachable and distinct")
    func railIsWellFormed() {
        let rail = AudioLibrarySection.rail
        #expect(rail.count == Set(rail.map(\.id)).count)
        #expect(rail.first == .all)
        #expect(rail.contains(.yours))
        #expect(rail.contains(.builtIn))
        for kind in SavedAudioKind.allCases {
            #expect(rail.contains(.savedKind(kind)))
        }
        for category in SoundEffectCategory.allCases {
            #expect(rail.contains(.effects(category)))
        }
    }
}
