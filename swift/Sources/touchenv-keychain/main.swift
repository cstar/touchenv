// touchenv-keychain: macOS Keychain manager for touchenv DEKs
// Commands: store, retrieve, delete, exists
// Uses kSecAccessControlBiometryCurrentSet for Secure Enclave protection

import Foundation
import Security

let service = "com.touchenv"

// MARK: - Keychain Operations

enum KeychainError: Error, CustomStringConvertible {
    case store(OSStatus)
    case retrieve(OSStatus)
    case delete(OSStatus)
    case notFound
    case accessControlCreation
    case unexpectedData

    var description: String {
        switch self {
        case .store(let status):
            return "keychain store failed: \(status) (\(secErrorMessage(status)))"
        case .retrieve(let status):
            return "keychain retrieve failed: \(status) (\(secErrorMessage(status)))"
        case .delete(let status):
            return "keychain delete failed: \(status) (\(secErrorMessage(status)))"
        case .notFound:
            return "key not found"
        case .accessControlCreation:
            return "failed to create access control"
        case .unexpectedData:
            return "unexpected data format in keychain"
        }
    }
}

func secErrorMessage(_ status: OSStatus) -> String {
    if let msg = SecCopyErrorMessageString(status, nil) {
        return msg as String
    }
    return "unknown"
}

func createAccessControl() throws -> SecAccessControl {
    var error: Unmanaged<CFError>?
    guard let access = SecAccessControlCreateWithFlags(
        kCFAllocatorDefault,
        kSecAttrAccessibleWhenUnlockedThisDeviceOnly,
        .biometryCurrentSet,
        &error
    ) else {
        throw KeychainError.accessControlCreation
    }
    return access
}

func store(account: String, hexKey: String) throws {
    guard let data = hexKey.data(using: .utf8) else {
        throw KeychainError.unexpectedData
    }

    // Delete existing item first (ignore error if not found)
    let deleteQuery: [String: Any] = [
        kSecClass as String: kSecClassGenericPassword,
        kSecAttrService as String: service,
        kSecAttrAccount as String: account,
    ]
    SecItemDelete(deleteQuery as CFDictionary)

    let access = try createAccessControl()

    let addQuery: [String: Any] = [
        kSecClass as String: kSecClassGenericPassword,
        kSecAttrService as String: service,
        kSecAttrAccount as String: account,
        kSecValueData as String: data,
        kSecAttrAccessControl as String: access,
    ]

    let status = SecItemAdd(addQuery as CFDictionary, nil)
    guard status == errSecSuccess else {
        throw KeychainError.store(status)
    }
}

func retrieve(account: String) throws -> String {
    let query: [String: Any] = [
        kSecClass as String: kSecClassGenericPassword,
        kSecAttrService as String: service,
        kSecAttrAccount as String: account,
        kSecReturnData as String: true,
        kSecMatchLimit as String: kSecMatchLimitOne,
    ]

    var item: CFTypeRef?
    let status = SecItemCopyMatching(query as CFDictionary, &item)

    guard status != errSecItemNotFound else {
        throw KeychainError.notFound
    }
    guard status == errSecSuccess else {
        throw KeychainError.retrieve(status)
    }
    guard let data = item as? Data,
          let hexKey = String(data: data, encoding: .utf8) else {
        throw KeychainError.unexpectedData
    }
    return hexKey
}

func delete(account: String) throws {
    let query: [String: Any] = [
        kSecClass as String: kSecClassGenericPassword,
        kSecAttrService as String: service,
        kSecAttrAccount as String: account,
    ]

    let status = SecItemDelete(query as CFDictionary)
    guard status == errSecSuccess || status == errSecItemNotFound else {
        throw KeychainError.delete(status)
    }
}

func exists(account: String) -> Bool {
    let query: [String: Any] = [
        kSecClass as String: kSecClassGenericPassword,
        kSecAttrService as String: service,
        kSecAttrAccount as String: account,
        kSecReturnData as String: false,
    ]

    let status = SecItemCopyMatching(query as CFDictionary, nil)
    return status == errSecSuccess
}

// MARK: - CLI

func printUsage() {
    let usage = """
    Usage: touchenv-keychain <command> <account> [hex-key]

    Commands:
      store <account> <hex-key>   Store a DEK in the Keychain
      retrieve <account>          Retrieve a DEK from the Keychain
      delete <account>            Delete a DEK from the Keychain
      exists <account>            Check if a DEK exists (exit 0 = yes, 1 = no)

    Arguments:
      account    Absolute path to the project directory
      hex-key    64-character hex-encoded 256-bit key (store only)
    """
    FileHandle.standardError.write(Data(usage.utf8))
}

func fatal(_ message: String) -> Never {
    FileHandle.standardError.write(Data("error: \(message)\n".utf8))
    exit(1)
}

let args = Array(CommandLine.arguments.dropFirst())

guard let command = args.first else {
    printUsage()
    exit(1)
}

switch command {
case "store":
    guard args.count == 3 else {
        fatal("store requires <account> <hex-key>")
    }
    let account = args[1]
    let hexKey = args[2]

    // Validate hex key: must be exactly 64 hex characters (32 bytes)
    let isValidHex = hexKey.count == 64 && hexKey.allSatisfy { $0.isHexDigit }
    guard isValidHex else {
        fatal("hex-key must be exactly 64 hex characters (256-bit key)")
    }

    do {
        try store(account: account, hexKey: hexKey)
    } catch {
        fatal("\(error)")
    }

case "retrieve":
    guard args.count == 2 else {
        fatal("retrieve requires <account>")
    }
    let account = args[1]

    do {
        let hexKey = try retrieve(account: account)
        print(hexKey, terminator: "")
    } catch {
        fatal("\(error)")
    }

case "delete":
    guard args.count == 2 else {
        fatal("delete requires <account>")
    }
    let account = args[1]

    do {
        try delete(account: account)
    } catch {
        fatal("\(error)")
    }

case "exists":
    guard args.count == 2 else {
        fatal("exists requires <account>")
    }
    let account = args[1]

    exit(exists(account: account) ? 0 : 1)

default:
    fatal("unknown command: \(command)")
}
