import Foundation
import Testing
@testable import YapperNative

struct CloudLinkRouterTests {
    @Test func nativeSidebarMatchesTheWebStudioDestinations() {
        let visible = StudioDestination.groups.flatMap(\.1)

        #expect(visible == [
            .home,
            .brain, .ideas, .library,
            .recorder, .editor,
            .poster, .calendar, .automations,
            .brand, .storage, .dictionary, .connections,
        ])
        #expect(!visible.contains(.audio))
        #expect(visible.filter(\.isNative) == [.editor])
    }

    @Test func brandAndStorageLeadTheSettingsSidebarGroup() {
        let settings = StudioDestination.groups.first { $0.0 == "Settings" }

        #expect(settings?.1 == [.brand, .storage, .dictionary, .connections])
        #expect(StudioDestination.brand.group == "Settings")
        #expect(StudioDestination.storage.group == "Settings")
    }

    @Test func externalWebLinksOpenInTheDefaultBrowser() throws {
        let url = try #require(URL(string: "https://www.instagram.com/p/example/"))

        #expect(
            CloudLinkRouter.disposition(for: url, nativeDestination: .ideas)
                == .openInBrowser
        )
    }

    @Test func appSidebarLinksNavigateThroughTheNativeShell() throws {
        let url = try #require(URL(string: "https://ypr.app/studio/calendar"))

        #expect(
            CloudLinkRouter.disposition(for: url, nativeDestination: .ideas)
                == .navigateInShell(.calendar)
        )
    }

    @Test func brandLinksNavigateThroughTheNativeShell() throws {
        let url = try #require(URL(string: "https://ypr.app/studio/brand"))

        #expect(
            CloudLinkRouter.disposition(for: url, nativeDestination: .brain)
                == .navigateInShell(.brand)
        )
    }

    @Test func storageLinksNavigateThroughTheNativeShell() throws {
        let url = try #require(URL(string: "https://ypr.app/studio/storage"))

        #expect(
            CloudLinkRouter.disposition(for: url, nativeDestination: .brain)
                == .navigateInShell(.storage)
        )
    }

    @Test func samePageAndNestedAppLinksStayInTheEmbeddedSurface() throws {
        let samePage = try #require(URL(string: "https://ypr.app/studio/ideas"))
        let nestedPage = try #require(URL(string: "https://ypr.app/studio/library/example"))

        #expect(
            CloudLinkRouter.disposition(for: samePage, nativeDestination: .ideas)
                == .allowInApp
        )
        #expect(
            CloudLinkRouter.disposition(for: nestedPage, nativeDestination: .library)
                == .allowInApp
        )
    }

    @Test func sameOriginPublicLinksStillLeaveTheAppShell() throws {
        let url = try #require(URL(string: "https://ypr.app/blog/editor-tips"))

        #expect(
            CloudLinkRouter.disposition(for: url, nativeDestination: .ideas)
                == .openInBrowser
        )
    }
}
