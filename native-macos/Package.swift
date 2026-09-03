// swift-tools-version: 6.2
import PackageDescription

let package = Package(
    name: "YapperNative",
    platforms: [.macOS(.v14)],
    products: [
        .executable(name: "YapperNative", targets: ["YapperNative"]),
    ],
    targets: [
        .executableTarget(
            name: "YapperNative",
            path: "Sources/YapperNative",
            resources: [.copy("Resources/SoundEffects"), .copy("Resources/SceneIcons")],
            swiftSettings: [
                .unsafeFlags(["-Xfrontend", "-strict-concurrency=minimal"]),
            ]
        ),
        .testTarget(
            name: "YapperNativeTests",
            dependencies: ["YapperNative"],
            path: "Tests/YapperNativeTests"
        ),
    ]
)
