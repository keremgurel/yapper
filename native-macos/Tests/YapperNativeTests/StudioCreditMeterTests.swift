import XCTest
@testable import YapperNative

final class StudioCreditMeterTests: XCTestCase {
    func testSnapshotDecodesServerPaletteAndKeepsOlderServersCompatible() throws {
        let data = Data(##"{"balance":125,"entitled":true,"creditMeter":{"fraction":0.25,"allowance":500,"lightColor":"#c65a2d","darkColor":"#ff9759","planLabel":"Studio Creator · monthly"}}"##.utf8)
        let snapshot = try JSONDecoder().decode(StudioBillingSnapshot.self, from: data)
        XCTAssertEqual(snapshot.balance, 125)
        XCTAssertEqual(snapshot.creditMeter?.clampedFraction, 0.25)
        XCTAssertEqual(snapshot.creditMeter?.darkColor, "#ff9759")
        let old = try JSONDecoder().decode(StudioBillingSnapshot.self, from: Data(##"{"balance":42,"entitled":true}"##.utf8))
        XCTAssertEqual(old.balance, 42)
        XCTAssertNil(old.creditMeter)
    }

    func testProfilePhotoOnlyAcceptsHTTPSAndCanBeCleared() {
        let account = StudioAccountIdentity(userID: "one", displayName: "Creator", email: nil, imageURL: "https://img.clerk.com/avatar.png")
        XCTAssertEqual(account?.imageURL?.host, "img.clerk.com")
        XCTAssertNil(StudioAccountIdentity(userID: "two", displayName: nil, email: nil)?.imageURL)
        XCTAssertNil(StudioAccountIdentity(userID: "one", displayName: nil, email: nil, imageURL: "file:///tmp/private")?.imageURL)
    }
}
