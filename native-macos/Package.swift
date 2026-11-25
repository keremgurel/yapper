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
        .package(url: "https://github.com/sparkle-project/Sparkle.git", exact: "2.10.1"),
    ],
    targets: [
        .executableTarget(
            name: "YapperNative",
            dependencies: [
                .product(name: "PostHog", package: "posthog-ios"),
                .product(name: "Sparkle", package: "Sparkle"),
            ],
            path: "Sources/YapperNative",
            resources: [.copy("Resources/SoundEffects"), .copy("Resources/SceneIcons"), .copy("Resources/Backdrops")],
            swiftSettings: [
                .unsafeFlags(["-Xfrontend", "-strict-concurrency=minimal"]),
            ],
            // The packaged app keeps Sparkle.framework in Contents/Frameworks.
            // `swift run` still finds it next to the binary through @loader_path.
            linkerSettings: [
                .unsafeFlags(["-Xlinker", "-rpath", "-Xlinker", "@executable_path/../Frameworks"]),
            ]
        ),
        .testTarget(
            name: "YapperNativeTests",
            dependencies: ["YapperNative"],
            path: "Tests/YapperNativeTests"
        ),
    ]
)
