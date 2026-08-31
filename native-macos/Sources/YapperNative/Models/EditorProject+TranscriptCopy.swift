import Foundation

extension EditorProject {
    /// Everything the transcriber returned for media that is still used by the
    /// main timeline. This matches the transcript panel, including struck-out
    /// words, and keeps the transcriber's source order.
    var fullTranscriptText: String {
        joinedTranscriptWords(timelineTranscript)
    }

    /// Only speech that survives the edit, in the order it plays.
    ///
    /// Walking clips rather than merely filtering `timelineTranscript` matters:
    /// clips can be rearranged, and the same source stretch can deliberately be
    /// used more than once. The copied text should describe the finished video.
    var keptTranscriptText: String {
        guard let transcript else { return "" }
        let byMedia = Dictionary(grouping: transcript, by: \.mediaID)
        let kept = clips.flatMap { clip in
            (byMedia[clip.mediaID] ?? [])
                .filter { word in
                    word.playbackAnchor >= clip.sourceStart && word.playbackAnchor < clip.sourceEnd
                }
                .sorted { left, right in
                    if left.start != right.start { return left.start < right.start }
                    return left.end < right.end
                }
        }
        return joinedTranscriptWords(kept)
    }

    private func joinedTranscriptWords(_ words: [TranscriptWord]) -> String {
        words.lazy
            .map { $0.text.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty }
            .joined(separator: " ")
    }
}
