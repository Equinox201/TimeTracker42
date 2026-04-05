import Foundation

@MainActor
@Observable
final class AppState {
    var backendBaseURL: String = "http://127.0.0.1:8000"
    var accessToken: String = ""
    var refreshToken: String = ""
    var accessTokenExpiresAt: Date?
    var userLogin: String = ""
    var isDataStale: Bool = false
    var isBootstrappingSession: Bool = true
    var goalSettings: GoalSettings?

    let mobileCallbackScheme = "timetracker42"

    private enum StorageKey {
        static let backendBaseURL = "backend_base_url"
        static let accessToken = "access_token"
        static let refreshToken = "refresh_token"
        static let accessTokenExpiresAt = "access_token_expires_at"
        static let userLogin = "user_login"
    }

    var isAuthenticated: Bool {
        !accessToken.isEmpty && !refreshToken.isEmpty
    }

    var apiClient: APIClient {
        APIClient(baseURLString: backendBaseURL)
    }

    func bootstrapSession() async {
        loadPersistedSession()

        guard isAuthenticated else {
            isBootstrappingSession = false
            return
        }

        do {
            _ = try await validAccessToken()
        } catch {
            clearSession()
        }

        isBootstrappingSession = false
    }

    func completeOAuthSignIn(baseURL: String, oneTimeCode: String) async throws {
        backendBaseURL = normalize(baseURL)
        let response = try await apiClient.exchangeOneTimeCode(oneTimeCode: oneTimeCode)
        applySession(response)
        persistSession()
    }

    func validAccessToken() async throws -> String {
        let trimmed = accessToken.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else {
            throw APIError.unauthorized
        }

        if let expiresAt = accessTokenExpiresAt, expiresAt.timeIntervalSinceNow > 60 {
            return trimmed
        }

        let refresh = refreshToken.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !refresh.isEmpty else {
            throw APIError.unauthorized
        }

        let refreshed = try await apiClient.refreshSession(refreshToken: refresh)
        applySession(refreshed)
        persistSession()
        return refreshed.accessToken
    }

    func signOut() async {
        let refresh = refreshToken
        clearSession()

        if !refresh.isEmpty {
            try? await apiClient.logout(refreshToken: refresh)
        }
    }

    private func applySession(_ response: TokenPairResponse) {
        accessToken = response.accessToken
        refreshToken = response.refreshToken
        accessTokenExpiresAt = response.accessTokenExpiresAt
        userLogin = response.user.login
    }

    func refreshGoalSettings() async throws -> GoalSettings {
        let accessToken = try await validAccessToken()
        let goals = try await apiClient.getCurrentGoals(accessToken: accessToken)
        goalSettings = goals
        return goals
    }

    func saveGoalSettings(request: GoalSettingsUpdateRequest) async throws -> GoalSettings {
        let accessToken = try await validAccessToken()
        let goals = try await apiClient.updateCurrentGoals(accessToken: accessToken, request: request)
        goalSettings = goals
        return goals
    }

    private func clearSession() {
        accessToken = ""
        refreshToken = ""
        accessTokenExpiresAt = nil
        userLogin = ""
        isDataStale = false
        goalSettings = nil
        deletePersistedSession()
    }

    private func normalize(_ url: String) -> String {
        let trimmed = url.trimmingCharacters(in: .whitespacesAndNewlines)
        if trimmed.isEmpty {
            return "http://127.0.0.1:8000"
        }
        return trimmed
    }

    private func persistSession() {
        UserDefaults.standard.set(backendBaseURL, forKey: StorageKey.backendBaseURL)

        try? KeychainStore.save(accessToken, for: StorageKey.accessToken)
        try? KeychainStore.save(refreshToken, for: StorageKey.refreshToken)
        try? KeychainStore.save(userLogin, for: StorageKey.userLogin)

        if let expires = accessTokenExpiresAt {
            try? KeychainStore.save(expires.ISO8601Format(), for: StorageKey.accessTokenExpiresAt)
        }
    }

    private func loadPersistedSession() {
        if let persistedURL = UserDefaults.standard.string(forKey: StorageKey.backendBaseURL),
           !persistedURL.isEmpty {
            backendBaseURL = persistedURL
        }

        accessToken = (try? KeychainStore.load(StorageKey.accessToken)) ?? ""
        refreshToken = (try? KeychainStore.load(StorageKey.refreshToken)) ?? ""
        userLogin = (try? KeychainStore.load(StorageKey.userLogin)) ?? ""

        if let rawExpires = try? KeychainStore.load(StorageKey.accessTokenExpiresAt),
           let parsed = Self.parseISODate(rawExpires) {
            accessTokenExpiresAt = parsed
        } else {
            accessTokenExpiresAt = nil
        }
    }

    private func deletePersistedSession() {
        try? KeychainStore.delete(StorageKey.accessToken)
        try? KeychainStore.delete(StorageKey.refreshToken)
        try? KeychainStore.delete(StorageKey.accessTokenExpiresAt)
        try? KeychainStore.delete(StorageKey.userLogin)
    }

    private static func parseISODate(_ value: String) -> Date? {
        if let date = Self.iso8601WithFractional.date(from: value) {
            return date
        }
        return Self.iso8601Basic.date(from: value)
    }

    private static let iso8601WithFractional: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter
    }()

    private static let iso8601Basic: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime]
        return formatter
    }()
}
