import AppKit
import CoreImage
import Foundation
import Testing
@testable import YapperNative

struct OverlayBackdropTests {
    /// Every preset keeps the caption band (75 to 85% down) dark enough for
    /// white captions with a black outline. Set `BACKDROP_DUMP_DIR` to write
    /// each preset out as a PNG for a look by eye.
    @Test(arguments: BackdropPreset.allCases)
    func presetsKeepTheCaptionBandDark(_ preset: BackdropPreset) throws {
        let width = 270
        let height = 480
        let image = try #require(BackdropPresetRenderer.image(preset, width: width, height: height))
        let rep = NSBitmapImageRep(cgImage: image)

        var total = 0.0
        var count = 0
        for y in Int(Double(height) * 0.75) ..< Int(Double(height) * 0.85) {
            for x in stride(from: 0, to: width, by: 3) {
                guard let c = rep.colorAt(x: x, y: y) else { continue }
                total += 0.2126 * c.redComponent + 0.7152 * c.greenComponent + 0.0722 * c.blueComponent
                count += 1
            }
        }
        let luminance = total / Double(max(1, count))
        #expect(luminance < 0.12, "\(preset.title) caption band is \(luminance)")

        if let dir = ProcessInfo.processInfo.environment["BACKDROP_DUMP_DIR"],
           let full = BackdropPresetRenderer.image(preset, width: 1080, height: 1920),
           let png = NSBitmapImageRep(cgImage: full).representation(using: .png, properties: [:])
        {
            try png.write(to: URL(fileURLWithPath: dir).appendingPathComponent("\(preset.rawValue).png"))
        }
    }

    @Test func tokensRoundTrip() {
        #expect(OverlayBackdrop(token: "frosted") == .frosted)
        #expect(OverlayBackdrop(token: "navyGlow") == .preset(.navyGlow))
        #expect(OverlayBackdrop(token: "none") == nil)
        for preset in BackdropPreset.allCases {
            #expect(OverlayBackdrop(token: OverlayBackdrop.preset(preset).token) == .preset(preset))
        }
    }

    @Test func overlaysSavedBeforeBackdropsStillDecode() throws {
        let json = """
        {"id":"\(UUID().uuidString)","mediaID":"\(UUID().uuidString)","timelineStart":1,"duration":2,
         "sourceStart":0,"x":0.1,"y":0.1,"width":0.5,"height":0.5}
        """
        let overlay = try JSONDecoder().decode(ProjectOverlay.self, from: Data(json.utf8))
        #expect(overlay.backdrop == nil)
        var project = EditorProject(overlays: [overlay])
        #expect(!project.hasOverlayBackdrops)
        project.overlays?[0].backdrop = .frosted
        #expect(project.hasOverlayBackdrops)
        #expect(project.needsStudioCompositor)
    }

    @Test func fadeEasesInOverAThirdOfASecond() {
        let span = OverlayBackdropSpan(start: 2, end: 5, lane: 0, fill: .frosted)
        #expect(span.fade.duration == OverlayBackdrop.fadeIn)
        #expect(span.fade.opacity(atTimeline: 2) == 0)
        #expect(span.fade.opacity(atTimeline: 2 + OverlayBackdrop.fadeIn) == 1)
        #expect(span.boundaries == [2, 2 + OverlayBackdrop.fadeIn, 5])
    }

    @Test func higherLaneBackdropWins() {
        let low = OverlayBackdropSpan(start: 0, end: 4, lane: 0, fill: .frosted)
        let high = OverlayBackdropSpan(start: 1, end: 3, lane: 2, fill: .frosted)
        #expect(OverlayBackdropSpans.active(in: [low, high], from: 1.5, to: 2)?.lane == 2)
        #expect(OverlayBackdropSpans.active(in: [low, high], from: 3.5, to: 4)?.lane == 0)
        #expect(OverlayBackdropSpans.active(in: [low, high], from: 4, to: 5) == nil)
    }

    @Test func frostedFillsTheFrame() {
        let frame = CGRect(x: 0, y: 0, width: 1080, height: 1920)
        let speaker = CIImage(color: .gray).cropped(to: CGRect(x: 0, y: 300, width: 1080, height: 1320))
        #expect(FrostedBackdrop.frosted(speaker, frame: frame).extent == frame)
    }

    @Test func presetColoursFallBackSlotBySlot() {
        let preset = BackdropPreset.navyGlow
        #expect(preset.resolvedColors(nil) == preset.defaultColors)
        #expect(preset.resolvedColors(["#112233"]) == ["#112233"] + preset.defaultColors.dropFirst())
        #expect(preset.resolvedColors(["nope", "#aabbcc"]) == [preset.defaultColors[0], "#AABBCC", preset.defaultColors[2]])
        for preset in BackdropPreset.allCases {
            #expect(preset.colorNames.count == preset.defaultColors.count)
        }
    }

    @Test func customColoursRepaintThePreset() throws {
        let plain = try #require(BackdropPresetRenderer.image(.shapeGrid, width: 90, height: 160))
        let red = try #require(BackdropPresetRenderer.image(.shapeGrid, width: 90, height: 160, colors: ["#600000"]))
        let a = try #require(plain.sample(x: 45, y: 10))
        let b = try #require(red.sample(x: 45, y: 10))
        #expect(b.red > a.red + 40 && b.red > b.blue)
    }
}
