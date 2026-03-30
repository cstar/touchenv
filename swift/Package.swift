// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "touchenv-keychain",
    platforms: [.macOS(.v13)],
    targets: [
        .executableTarget(
            name: "touchenv-keychain",
            path: "Sources/touchenv-keychain"
        ),
        .testTarget(
            name: "touchenv-keychainTests",
            dependencies: ["touchenv-keychain"],
            path: "Tests/touchenv-keychainTests"
        ),
    ]
)
