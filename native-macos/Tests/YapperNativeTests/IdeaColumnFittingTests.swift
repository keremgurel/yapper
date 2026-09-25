import Foundation
import Testing
@testable import YapperNative

struct IdeaColumnFittingTests {
    @Test func everyColumnShowsWhenThereIsRoom() {
        let columns = IdeaColumn.defaults
        #expect(IdeaColumn.fitting(columns, in: IdeaColumn.minimumWidth(columns)) == columns)
        #expect(IdeaColumn.fitting(columns, in: 0) == columns)
    }

    @Test func narrowWindowsDropTheLeastImportantFirst() {
        let columns = IdeaColumn.defaults
        let tight = IdeaColumn.minimumWidth(columns) - 1
        let shown = IdeaColumn.fitting(columns, in: tight)
        #expect(!shown.contains(.added))
        #expect(shown.contains(.status) && shown.contains(.title) && shown.contains(.updated))
    }

    @Test func titleStatusAndActionsAlwaysStay() {
        let shown = IdeaColumn.fitting(IdeaColumn.allCases, in: 300)
        #expect(shown == [.title, .status, .actions])
    }

    @Test func sortingByUpdatedIsNewestFirstAndStable() {
        func item(_ id: String, _ updated: String) -> IdeaItem {
            try! JSONDecoder().decode(IdeaItem.self, from: Data(#"{"id":"\#(id)","updatedAt":"\#(updated)"}"#.utf8))
        }
        let rows = [item("a", "2026-09-01T00:00:00Z"), item("b", "2026-09-03T00:00:00Z"), item("c", "2026-09-01T00:00:00Z")]
        #expect(IdeaSort().apply(rows).map(\.id) == ["b", "a", "c"])
    }
}
