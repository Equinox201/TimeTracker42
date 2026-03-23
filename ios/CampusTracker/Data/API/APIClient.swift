import Foundation

struct APIClient {
    let baseURL: URL

    init(baseURLString: String) {
        self.baseURL = URL(string: baseURLString) ?? URL(string: "http://127.0.0.1:8000")!
    }

    func getHealth() async throws -> String {
        let data = try await get(path: "/api/v1/health")

        struct HealthResponse: Decodable { let status: String }
        return try decode(HealthResponse.self, from: data).status
    }

    func getDashboardSummary(accessToken: String) async throws -> DashboardSummary {
        let data = try await get(path: "/api/v1/dashboard/summary", accessToken: accessToken)
        return try decode(DashboardSummary.self, from: data)
    }

    func getAttendanceHistory(
        accessToken: String,
        from fromDate: Date,
        to toDate: Date
    ) async throws -> AttendanceHistoryResponse {
        let query = [
            URLQueryItem(name: "from", value: Self.dayFormatter.string(from: fromDate)),
            URLQueryItem(name: "to", value: Self.dayFormatter.string(from: toDate))
        ]
        let data = try await get(
            path: "/api/v1/attendance/history",
            queryItems: query,
            accessToken: accessToken
        )
        return try decode(AttendanceHistoryResponse.self, from: data)
    }

    func triggerManualSync(accessToken: String, force: Bool = false) async throws {
        let query = force ? [URLQueryItem(name: "force", value: "true")] : []
        _ = try await post(path: "/api/v1/sync/manual", queryItems: query, accessToken: accessToken)
    }

    func exchangeOneTimeCode(oneTimeCode: String) async throws -> TokenPairResponse {
        let payload = MobileExchangeRequest(oneTimeCode: oneTimeCode)
        let body = try encode(payload)
        let data = try await post(path: "/api/v1/auth/mobile/exchange", body: body)
        return try decode(TokenPairResponse.self, from: data)
    }

    func refreshSession(refreshToken: String) async throws -> TokenPairResponse {
        let payload = RefreshRequest(refreshToken: refreshToken)
        let body = try encode(payload)
        let data = try await post(path: "/api/v1/auth/refresh", body: body)
        return try decode(TokenPairResponse.self, from: data)
    }

    func logout(refreshToken: String) async throws {
        let payload = LogoutRequest(refreshToken: refreshToken)
        let body = try encode(payload)
        _ = try await post(path: "/api/v1/auth/logout", body: body)
    }

    private func get(
        path: String,
        queryItems: [URLQueryItem] = [],
        accessToken: String? = nil
    ) async throws -> Data {
        let request = try buildRequest(
            path: path,
            method: "GET",
            queryItems: queryItems,
            accessToken: accessToken
        )

        do {
            let (data, response) = try await URLSession.shared.data(for: request)
            return try validateResponse(data: data, response: response)
        } catch let error as APIError {
            throw error
        } catch {
            throw APIError.network(error)
        }
    }

    private func post(
        path: String,
        queryItems: [URLQueryItem] = [],
        accessToken: String? = nil,
        body: Data? = nil
    ) async throws -> Data {
        let request = try buildRequest(
            path: path,
            method: "POST",
            queryItems: queryItems,
            accessToken: accessToken,
            body: body
        )

        do {
            let (data, response) = try await URLSession.shared.data(for: request)
            return try validateResponse(data: data, response: response)
        } catch let error as APIError {
            throw error
        } catch {
            throw APIError.network(error)
        }
    }

    private func buildRequest(
        path: String,
        method: String,
        queryItems: [URLQueryItem],
        accessToken: String?,
        body: Data? = nil
    ) throws -> URLRequest {
        guard var components = URLComponents(
            url: baseURL.appendingPathComponent(path.trimmingCharacters(in: CharacterSet(charactersIn: "/"))),
            resolvingAgainstBaseURL: false
        ) else {
            throw APIError.invalidURL
        }

        if !queryItems.isEmpty {
            components.queryItems = queryItems
        }

        guard let url = components.url else {
            throw APIError.invalidURL
        }

        var request = URLRequest(url: url)
        request.httpMethod = method
        request.setValue("application/json", forHTTPHeaderField: "Accept")

        if let accessToken {
            request.setValue("Bearer \(accessToken)", forHTTPHeaderField: "Authorization")
        }

        if let body {
            request.httpBody = body
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        }

        return request
    }

    private func validateResponse(data: Data, response: URLResponse) throws -> Data {
        guard let http = response as? HTTPURLResponse else {
            throw APIError.invalidResponse
        }

        if http.statusCode == 401 {
            throw APIError.unauthorized
        }

        guard (200..<300).contains(http.statusCode) else {
            throw APIError.server(statusCode: http.statusCode)
        }

        return data
    }

    private func decode<T: Decodable>(_ type: T.Type, from data: Data) throws -> T {
        let decoder = JSONDecoder()
        decoder.keyDecodingStrategy = .convertFromSnakeCase
        decoder.dateDecodingStrategy = .custom { decoder in
            let container = try decoder.singleValueContainer()
            let raw = try container.decode(String.self)

            if let date = Self.iso8601WithFractional.date(from: raw) {
                return date
            }
            if let date = Self.iso8601Basic.date(from: raw) {
                return date
            }

            throw DecodingError.dataCorruptedError(
                in: container,
                debugDescription: "Invalid date value: \(raw)"
            )
        }

        do {
            return try decoder.decode(type, from: data)
        } catch {
            throw APIError.decoding(error)
        }
    }

    private func encode<T: Encodable>(_ body: T) throws -> Data {
        let encoder = JSONEncoder()
        encoder.keyEncodingStrategy = .convertToSnakeCase
        do {
            return try encoder.encode(body)
        } catch {
            throw APIError.encoding(error)
        }
    }
}

private extension APIClient {
    static let dayFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = TimeZone(secondsFromGMT: 0)
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter
    }()

    static let iso8601WithFractional: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter
    }()

    static let iso8601Basic: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime]
        return formatter
    }()
}
