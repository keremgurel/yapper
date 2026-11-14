import Foundation
import Testing
@testable import YapperNative

struct TranscriptionPiecePlanTests {
    private func plan(_ json: String) -> TranscriptionPiecePlan {
        TranscriptionPiecePlan.decoded(from: Data(json.utf8))
    }

    @Test func readsThePlanTheServiceSends() {
        #expect(plan(#"{"pieceSeconds":600,"overlapSeconds":5}"#)
            == TranscriptionPiecePlan(pieceSeconds: 600, overlapSeconds: 5))
        #expect(plan(#"{"pieceSeconds":120,"overlapSeconds":30}"#) == .overlapping)
    }

    @Test func fallsBackToOverlappingPiecesOnAnythingUnusable() {
        // An older service answers 404 with a page, a broken one with nothing.
        #expect(plan("<!doctype html>") == .overlapping)
        #expect(plan("") == .overlapping)
        #expect(plan(#"{"error":"unauthorized"}"#) == .overlapping)
        #expect(plan(#"{"pieceSeconds":"600","overlapSeconds":5}"#) == .overlapping)
    }

    @Test func refusesAPlanTheRouteWouldReject() {
        // Longer than the ten minutes one piece may be.
        #expect(plan(#"{"pieceSeconds":601,"overlapSeconds":5}"#) == .overlapping)
        // So short it would turn a take into hundreds of requests.
        #expect(plan(#"{"pieceSeconds":5,"overlapSeconds":1}"#) == .overlapping)
        // An overlap that leaves a piece barely advancing.
        #expect(plan(#"{"pieceSeconds":120,"overlapSeconds":90}"#) == .overlapping)
        #expect(plan(#"{"pieceSeconds":600,"overlapSeconds":-1}"#) == .overlapping)
    }

    @Test func aTakeUpToTenMinutesIsOnePieceOnTheLongPlan() {
        let sampleRate = 48_000
        let bytesPerSecond = sampleRate * 2
        let long = TranscriptionPiecePlan(pieceSeconds: 600, overlapSeconds: 5)
        let short = TranscriptionChunkPlan.make(
            byteCount: 386 * bytesPerSecond, sampleRate: sampleRate,
            chunkSeconds: long.pieceSeconds, overlapSeconds: long.overlapSeconds
        )
        #expect(short.count == 1)
        #expect(short.first?.duration == 386)

        // A 21.6 minute take: three pieces, each joined to the next by five
        // seconds, none longer than the route accepts, ending on the last byte.
        let pieces = TranscriptionChunkPlan.make(
            byteCount: 1_296 * bytesPerSecond, sampleRate: sampleRate,
            chunkSeconds: long.pieceSeconds, overlapSeconds: long.overlapSeconds
        )
        #expect(pieces.count == 3)
        #expect(pieces.allSatisfy { $0.duration <= 600 })
        #expect(pieces.last.map { $0.start + $0.length } == 1_296 * bytesPerSecond)
        for pair in zip(pieces, pieces.dropFirst()) {
            #expect(abs((pair.0.offset + pair.0.duration) - pair.1.offset - 5) < 0.000_1)
        }
    }
}
