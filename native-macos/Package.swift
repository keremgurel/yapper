// swift-tools-version: 6.2
import PackageDescription

let package = Package(
    name: "YapperNative",
    platforms: [.macOS(.v14)],
    products: [
        .executable(name: "YapperNative", targets: ["YapperNative"]),
    ],
    dependencies: [
        .package(url: "https://github.com/PostHog/posthog-ios.git", exact: "3.92.0"),
    ],
    targets: [
        .executableTarget(
            name: "YapperNative",
            dependencies: [.product(name: "PostHog", package: "posthog-ios")],
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
