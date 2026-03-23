import Foundation

struct SessionUser: Codable {
    let id: UUID
    let login: String
    let displayName: String
}

struct TokenPairResponse: Codable {
    let accessToken: String
    let refreshToken: String
    let tokenType: String
    let accessTokenExpiresAt: Date
    let user: SessionUser
}

struct MobileExchangeRequest: Encodable {
    let oneTimeCode: String
}

struct RefreshRequest: Encodable {
    let refreshToken: String
}

struct LogoutRequest: Encodable {
    let refreshToken: String
}
