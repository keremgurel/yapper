import Foundation

/// Fractions of the camera preview, so the saved reading area survives changes
/// of window size, focus mode and camera aspect ratio.
struct TeleprompterLayout: Codable, Equatable {
    var x: Double = 0.04
    var y: Double = 0.04
    var width: Double = 0.92
    var height: Double = 0.44

    static let minimumSize = CGSize(width: 180, height: 96)

    init(x: Double = 0.04, y: Double = 0.04, width: Double = 0.92, height: Double = 0.44) {
        self.x = x; self.y = y; self.width = width; self.height = height
    }

    init(frame: CGRect, in size: CGSize) {
        guard size.width > 0, size.height > 0 else { self.init(); return }
        self.init(x: frame.minX / size.width, y: frame.minY / size.height,
                  width: frame.width / size.width, height: frame.height / size.height)
    }

    func frame(in size: CGSize) -> CGRect {
        guard size.width.isFinite, size.height.isFinite, size.width > 0, size.height > 0 else { return .zero }
        let w = min(size.width, max(min(Self.minimumSize.width, size.width), finite(width, fallback: 0.92) * size.width))
        let h = min(size.height, max(min(Self.minimumSize.height, size.height), finite(height, fallback: 0.44) * size.height))
        return CGRect(x: min(max(0, finite(x, fallback: 0.04) * size.width), size.width - w),
                      y: min(max(0, finite(y, fallback: 0.04) * size.height), size.height - h), width: w, height: h)
    }

    enum Handle: CaseIterable, Hashable {
        case topLeft, top, topRight, right, bottomRight, bottom, bottomLeft, left
        var movesLeft: Bool { self == .topLeft || self == .left || self == .bottomLeft }
        var movesRight: Bool { self == .topRight || self == .right || self == .bottomRight }
        var movesTop: Bool { self == .topLeft || self == .top || self == .topRight }
        var movesBottom: Bool { self == .bottomLeft || self == .bottom || self == .bottomRight }
    }

    /// A nil handle moves the whole box. Resizing keeps the opposite edge fixed.
    static func adjusting(_ frame: CGRect, handle: Handle?, by delta: CGSize, in size: CGSize) -> CGRect {
        guard let handle else {
            return CGRect(x: min(max(0, frame.minX + delta.width), max(0, size.width - frame.width)),
                          y: min(max(0, frame.minY + delta.height), max(0, size.height - frame.height)),
                          width: frame.width, height: frame.height)
        }
        let minWidth = min(minimumSize.width, size.width)
        let minHeight = min(minimumSize.height, size.height)
        var left = frame.minX, right = frame.maxX, top = frame.minY, bottom = frame.maxY
        if handle.movesLeft { left = min(max(0, left + delta.width), right - minWidth) }
        if handle.movesRight { right = max(min(size.width, right + delta.width), left + minWidth) }
        if handle.movesTop { top = min(max(0, top + delta.height), bottom - minHeight) }
        if handle.movesBottom { bottom = max(min(size.height, bottom + delta.height), top + minHeight) }
        return CGRect(x: left, y: top, width: right - left, height: bottom - top)
    }

    private func finite(_ value: Double, fallback: Double) -> Double { value.isFinite ? value : fallback }
}
