import SwiftUI

/// The Ideas tab: the list, or one idea's canvas in its place while an idea
/// is open. Home opens ideas through `StudioNavigation.openIdea` too.
struct IdeasPage: View {
    @ObservedObject var navigation: StudioNavigation = .shared

    var body: some View {
        if let id = navigation.openIdeaID {
            IdeaCanvasPage(itemID: id) {
                navigation.openIdeaID = nil
                Task { await IdeasStore.shared.refresh() }
            }
            .id(id)
        } else {
            IdeasListPage()
        }
    }
}
