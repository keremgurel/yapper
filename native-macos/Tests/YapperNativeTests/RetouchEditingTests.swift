import Foundation
import Testing
@testable import YapperNative

struct RetouchEditingTests {
    private let settings = ClipRetouch(clearBlemishes: 0.4, whitenTeeth: 0.2)

    private func clip() -> TimelineClip {
        TimelineClip(mediaID: UUID(), sourceStart: 0, sourceEnd: 6, retouch: settings)
    }

    @Test("Splitting a retouched clip preserves its look on both halves")
    func split() {
        let source = clip()
        var project = EditorProject(clips: [source])
        #expect(project.split(clipID: source.id, atTimelineTime: 3))
        #expect(project.clips.count == 2)
        #expect(project.clips.allSatisfy { $0.resolvedRetouch == settings })
        #expect(Set(project.clips.map(\.id)).count == 2)
    }

    @Test("Removing transcript ranges preserves retouch on the surviving footage")
    func removeRange() {
        let source = clip()
        var project = EditorProject(clips: [source])
        project.removeSourceRanges([(2, 4)], for: source.mediaID)
        #expect(project.clips.count == 2)
        #expect(project.clips.allSatisfy { $0.resolvedRetouch == settings })
        #expect(project.duration == 4)
    }

    @Test("Copying and clearing clip properties includes retouch")
    func copyLook() {
        let source = clip()
        let target = TimelineClip(mediaID: source.mediaID, sourceStart: 1, sourceEnd: 3)
        let copied = ClipLook.of(source).applied(to: target)
        #expect(copied.resolvedRetouch == settings)
        #expect(copied.id == target.id)
        #expect(copied.sourceStart == target.sourceStart)
        #expect(ClipLook.of(target).applied(to: copied).resolvedRetouch.isNeutral)
    }

    @Test("Restoring a range does not spread neighboring retouch onto it")
    func restoreRange() {
        let source = clip()
        var project = EditorProject(clips: [source])
        project.removeSourceRanges([(2, 4)], for: source.mediaID)
        project.restoreSourceRange((2, 4), for: source.mediaID)
        #expect(project.clips.count == 3)
        #expect(project.clips[1].resolvedRetouch.isNeutral)
        #expect(project.clips.first?.resolvedRetouch == settings)
        #expect(project.clips.last?.resolvedRetouch == settings)
    }
}
