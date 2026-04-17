import XCTest
import Foundation

final class TouchenvKeychainTests: XCTestCase {

    // Path to the built binary
    var binaryPath: String {
        // When run via `swift test`, the build products are in .build/debug/
        let basePath = URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent() // Tests/touchenv-keychainTests/
            .deletingLastPathComponent() // Tests/
            .deletingLastPathComponent() // swift/
        return basePath.appendingPathComponent(".build/debug/touchenv-keychain").path
    }

    // Unique account per test run to avoid collisions
    let testAccount = "/tmp/touchenv-test-\(ProcessInfo.processInfo.globallyUniqueString)"
    let validHexKey = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"

    override func tearDown() {
        // Clean up any keychain entry left behind
        _ = run(arguments: ["delete", testAccount])
        super.tearDown()
    }

    // MARK: - Helpers

    struct RunResult {
        let stdout: String
        let stderr: String
        let exitCode: Int32
    }

    func run(arguments: [String]) -> RunResult {
        let process = Process()
        process.executableURL = URL(fileURLWithPath: binaryPath)
        process.arguments = arguments

        let stdoutPipe = Pipe()
        let stderrPipe = Pipe()
        process.standardOutput = stdoutPipe
        process.standardError = stderrPipe

        do {
            try process.run()
            process.waitUntilExit()
        } catch {
            return RunResult(stdout: "", stderr: "failed to launch: \(error)", exitCode: -1)
        }

        let stdout = String(data: stdoutPipe.fileHandleForReading.readDataToEndOfFile(), encoding: .utf8) ?? ""
        let stderr = String(data: stderrPipe.fileHandleForReading.readDataToEndOfFile(), encoding: .utf8) ?? ""
        return RunResult(stdout: stdout, stderr: stderr, exitCode: process.terminationStatus)
    }

    // MARK: - CLI Argument Validation

    func testNoArgs() {
        let result = run(arguments: [])
        XCTAssertNotEqual(result.exitCode, 0)
        XCTAssertTrue(result.stderr.contains("Usage"))
    }

    func testUnknownCommand() {
        let result = run(arguments: ["foo"])
        XCTAssertNotEqual(result.exitCode, 0)
        XCTAssertTrue(result.stderr.contains("unknown command"))
    }

    func testStoreMissingArgs() {
        let result = run(arguments: ["store", testAccount])
        XCTAssertNotEqual(result.exitCode, 0)
        XCTAssertTrue(result.stderr.contains("store requires"))
    }

    func testStoreInvalidHexKey() {
        // Too short
        let result = run(arguments: ["store", testAccount, "abcd"])
        XCTAssertNotEqual(result.exitCode, 0)
        XCTAssertTrue(result.stderr.contains("64 hex characters"))
    }

    func testStoreInvalidHexChars() {
        // Right length but invalid chars
        let badKey = String(repeating: "zz", count: 32)
        let result = run(arguments: ["store", testAccount, badKey])
        XCTAssertNotEqual(result.exitCode, 0)
        XCTAssertTrue(result.stderr.contains("64 hex characters"))
    }

    func testRetrieveMissingArgs() {
        let result = run(arguments: ["retrieve"])
        XCTAssertNotEqual(result.exitCode, 0)
        XCTAssertTrue(result.stderr.contains("retrieve requires"))
    }

    func testDeleteMissingArgs() {
        let result = run(arguments: ["delete"])
        XCTAssertNotEqual(result.exitCode, 0)
        XCTAssertTrue(result.stderr.contains("delete requires"))
    }

    func testExistsMissingArgs() {
        let result = run(arguments: ["exists"])
        XCTAssertNotEqual(result.exitCode, 0)
        XCTAssertTrue(result.stderr.contains("exists requires"))
    }

    // MARK: - Keychain Integration (requires Keychain access)
    // Note: store/retrieve/delete require a writable login keychain. These
    // tests validate the CLI plumbing and may fail on headless CI unless the
    // keychain is initialized.

    func testExistsReturnsFalseForMissing() {
        let result = run(arguments: ["exists", testAccount])
        // Should exit 1 (not found) — not an error, just indicates absence
        XCTAssertEqual(result.exitCode, 1)
    }

    func testDeleteNonexistentSucceeds() {
        // Deleting a non-existent key should not error
        let result = run(arguments: ["delete", testAccount])
        XCTAssertEqual(result.exitCode, 0)
    }
}
