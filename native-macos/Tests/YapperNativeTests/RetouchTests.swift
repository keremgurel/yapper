import CoreGraphics
import CoreImage
import Foundation
import Testing
@testable import YapperNative

/// The two retouch effects are arithmetic on an image and a mask, so both can
/// be checked on pictures built for the purpose: skin with a faint spot on it,
/// and a bright yellowish tooth next to the dark gap behind it.
struct RetouchTests {
    private static let size = 400
    private static let context = CIContext(options: [.workingColorSpace: NSNull()])

    /// A face-coloured square with a blemish in the middle of the left half and
    /// a hard black bar down the right half. The spot is what should go; the
    /// bar is an edge, and edges are what a blur must not touch.
    ///
    /// The spot is deliberately faint. A blemish is a few percent away from the
    /// skin around it, and an earlier version of this fixture used a disc at
    /// four times that, which is a mole rather than a spot. The filter was
    /// right to keep it and the test was wrong to ask.
    private static func skin(spot: Bool = true) -> CIImage {
        let context = CGContext(
            data: nil,
            width: size,
            height: size,
            bitsPerComponent: 8,
            bytesPerRow: 0,
            space: CGColorSpaceCreateDeviceRGB(),
            bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
        )!
        context.setFillColor(CGColor(red: 0.86, green: 0.70, blue: 0.62, alpha: 1))
        context.fill(CGRect(x: 0, y: 0, width: size, height: size))
        if spot {
            context.setFillColor(CGColor(red: 0.76, green: 0.60, blue: 0.52, alpha: 1))
            context.fillEllipse(in: CGRect(x: 96, y: 196, width: 8, height: 8))
        }
        context.setFillColor(CGColor(red: 0, green: 0, blue: 0, alpha: 1))
        context.fill(CGRect(x: 300, y: 0, width: 100, height: size))
        return CIImage(cgImage: context.makeImage()!)
    }

    private static func rendered(_ image: CIImage) -> CGImage {
        context.createCGImage(image, from: image.extent, format: .RGBA8, colorSpace: nil)!
    }

    private static var wholeFrame: CGRect {
        CGRect(x: 0, y: 0, width: size, height: size)
    }

    /// A mask covering everything, so a test can look at the smoothing on its
    /// own without the face ellipse deciding the answer.
    private static var everywhere: CIImage {
        CIImage(color: .white).cropped(to: wholeFrame)
    }

    // MARK: - Clearing blemishes

    /// A disc over the spot, which is what the detector hands the filter.
    private static func patch(at centre: CGPoint, radius: Double) -> CIImage {
        let gradient = CIFilter(name: "CIRadialGradient")!
        gradient.setValue(CIVector(cgPoint: centre), forKey: kCIInputCenterKey)
        gradient.setValue(radius, forKey: "inputRadius0")
        gradient.setValue(radius * 1.6, forKey: "inputRadius1")
        gradient.setValue(CIColor.white, forKey: "inputColor0")
        gradient.setValue(CIColor(red: 0, green: 0, blue: 0, alpha: 1), forKey: "inputColor1")
        return gradient.outputImage!
            .composited(over: CIImage(color: .black).cropped(to: wholeFrame))
            .cropped(to: wholeFrame)
    }

    private static var overTheSpot: CIImage {
        patch(at: CGPoint(x: 100, y: 200), radius: 10)
    }

    @Test("A spot inside a patch settles into the skin around it")
    func theSpotGoes() {
        let skinRed = Self.rendered(Self.skin()).sample(x: 200, y: Self.size - 200)!.red
        let before = Self.rendered(Self.skin()).sample(x: 100, y: Self.size - 200)!
        let after = Self.rendered(
            BlemishSmoothing.applied(
                to: Self.skin(),
                patches: Self.overTheSpot,
                faceWidth: 400,
                strength: 1
            )
        ).sample(x: 100, y: Self.size - 200)!
        #expect(abs(after.red - skinRed) < abs(before.red - skinRed))
    }

    /// The property that makes this safe. Whatever the detector gets wrong, it
    /// cannot get it wrong anywhere it was not pointed.
    @Test("Everything outside a patch comes back byte for byte")
    func outsideThePatchIsUntouched() {
        let cleared = BlemishSmoothing.applied(
            to: Self.skin(),
            patches: Self.overTheSpot,
            faceWidth: 400,
            strength: 1
        )
        let frame = Self.rendered(cleared)
        let original = Self.rendered(Self.skin())
        for (x, y) in [(320, 200), (280, 40), (40, 360), (200, 300)] {
            let before = original.sample(x: x, y: y)!
            let after = frame.sample(x: x, y: y)!
            #expect(before.red == after.red)
            #expect(before.green == after.green)
            #expect(before.blue == after.blue)
        }
    }

    /// The failure that took five attempts to understand. A correction worked
    /// out as signed arithmetic goes through blends that clamp to nought and
    /// one, and footage carrying values outside that comes back flattened to
    /// white: a bright disc on a face, however small the correction was. Mixing
    /// towards a blurred copy of the picture cannot exceed what the picture
    /// already held, so the result must sit between the two.
    @Test("A patch can never come out brighter than the skin it sits between")
    func nothingIsEverBrightened() {
        let frame = Self.rendered(
            BlemishSmoothing.applied(
                to: Self.skin(),
                patches: Self.overTheSpot,
                faceWidth: 400,
                strength: 1
            )
        )
        let original = Self.rendered(Self.skin())
        let skin = original.sample(x: 200, y: Self.size - 200)!.red
        for x in 88 ... 112 {
            let after = frame.sample(x: x, y: Self.size - 200)!
            let before = original.sample(x: x, y: Self.size - 200)!
            // Between where it was and the skin around it, and never past it.
            #expect(after.red <= max(before.red, skin) + 1)
            #expect(after.red >= min(before.red, skin) - 1)
        }
    }

    @Test("At nothing, nothing happens")
    func zeroIsOff() {
        let cleared = BlemishSmoothing.applied(
            to: Self.skin(),
            patches: Self.overTheSpot,
            faceWidth: 400,
            strength: 0
        )
        let before = Self.rendered(Self.skin()).sample(x: 100, y: Self.size - 200)!
        let after = Self.rendered(cleared).sample(x: 100, y: Self.size - 200)!
        #expect(before.red == after.red)
    }

    /// Strength is a dial, not a switch.
    @Test("Half strength lands between untouched and full")
    func strengthScales() {
        func spot(at strength: Double) -> Int {
            Self.rendered(
                BlemishSmoothing.applied(
                    to: Self.skin(),
                    patches: Self.overTheSpot,
                    faceWidth: 400,
                    strength: strength
                )
            ).sample(x: 100, y: Self.size - 200)!.red
        }
        let off = spot(at: 0)
        let half = spot(at: 0.5)
        let full = spot(at: 1)
        #expect(half > off)
        #expect(half < full)
    }

    // MARK: - Whitening teeth

    /// A mouth: a bright yellowish tooth next to the dark gap behind it.
    private static func mouth() -> CIImage {
        let context = CGContext(
            data: nil,
            width: size,
            height: size,
            bitsPerComponent: 8,
            bytesPerRow: 0,
            space: CGColorSpaceCreateDeviceRGB(),
            bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
        )!
        context.setFillColor(CGColor(red: 0.86, green: 0.70, blue: 0.62, alpha: 1))
        context.fill(CGRect(x: 0, y: 0, width: size, height: size))
        context.setFillColor(CGColor(red: 0.80, green: 0.74, blue: 0.45, alpha: 1))
        context.fill(CGRect(x: 150, y: 190, width: 50, height: 30))
        context.setFillColor(CGColor(red: 0.06, green: 0.03, blue: 0.03, alpha: 1))
        context.fill(CGRect(x: 200, y: 190, width: 50, height: 30))
        return CIImage(cgImage: context.makeImage()!)
    }

    private static var mouthMask: CIImage {
        RetouchMask.mouth(
            [
                CGPoint(x: 145, y: 185),
                CGPoint(x: 255, y: 185),
                CGPoint(x: 255, y: 225),
                CGPoint(x: 145, y: 225),
            ],
            in: wholeFrame
        )!
    }

    @Test("A yellow tooth loses its yellow")
    func theToothIsWhitened() {
        let before = Self.rendered(Self.mouth()).sample(x: 175, y: Self.size - 205)!
        let after = Self.rendered(
            TeethWhitening.applied(to: Self.mouth(), mouthMask: Self.mouthMask, strength: 1)
        ).sample(x: 175, y: Self.size - 205)!
        // Yellow is red and green without blue, so whitening closes that gap.
        #expect(after.green - after.blue < before.green - before.blue)
        #expect(after.blue > before.blue)
    }

    /// The mouth outline holds the gap at the back of it as well as the teeth,
    /// and lighting that up gives someone a glowing mouth.
    @Test("The dark gap behind the teeth is not lit up")
    func theGapStaysDark() {
        let before = Self.rendered(Self.mouth()).sample(x: 225, y: Self.size - 205)!
        let after = Self.rendered(
            TeethWhitening.applied(to: Self.mouth(), mouthMask: Self.mouthMask, strength: 1)
        ).sample(x: 225, y: Self.size - 205)!
        #expect(abs(after.red - before.red) <= 6)
    }

    @Test("Skin outside the mouth keeps its colour")
    func theFaceIsNotWhitened() {
        let before = Self.rendered(Self.mouth()).sample(x: 60, y: 60)!
        let after = Self.rendered(
            TeethWhitening.applied(to: Self.mouth(), mouthMask: Self.mouthMask, strength: 1)
        ).sample(x: 60, y: 60)!
        #expect(before.red == after.red)
        #expect(before.blue == after.blue)
    }

    @Test("At nothing, nothing happens")
    func whiteningZeroIsOff() {
        let before = Self.rendered(Self.mouth()).sample(x: 175, y: Self.size - 205)!
        let after = Self.rendered(
            TeethWhitening.applied(to: Self.mouth(), mouthMask: Self.mouthMask, strength: 0)
        ).sample(x: 175, y: Self.size - 205)!
        #expect(before.blue == after.blue)
    }

    // MARK: - Settings

    @Test("Strengths are held between nothing and full")
    func settingsAreClamped() {
        let settings = ClipRetouch(whitenTeeth: -2)
        #expect(settings.whitenTeeth == 0)
    }

    @Test("A clip at nothing is not retouched at all")
    func neutralIsOff() {
        #expect(ClipRetouch.none.isNeutral)
        #expect(!ClipRetouch(whitenTeeth: 0.01).isNeutral)
    }

    /// A mouth needs three points to be a shape. Two is a closed pair of lips
    /// Vision was unsure about, and there is nothing to whiten inside a line.
    @Test("A mouth that is not a shape produces no mask")
    func aDegenerateMouthIsIgnored() {
        #expect(RetouchMask.mouth([], in: Self.wholeFrame) == nil)
        #expect(
            RetouchMask.mouth(
                [CGPoint(x: 10, y: 10), CGPoint(x: 20, y: 10)],
                in: Self.wholeFrame
            ) == nil
        )
    }
}
