import Foundation

struct APIClient {
    let baseURL: URL

    init(baseURLString: String) {
        self.baseURL = URL(string: baseURLString) ?? URL(string: "http://127.0.0.1:8000")!
    }

    func getHealth() async throws -> String {
        let url = baseURL.appendingPathComponent("api/v1/health")
        let (data, response) = try await URLSession.shared.data(from: url)

        guard let http = response as? HTTPURLResponse else {
            throw APIError.invalidResponse
        }

        guard (200..<300).contains(http.statusCode) else {
            throw APIError.server(statusCode: http.statusCode)
        }

        struct HealthResponse: Decodable {
            let status: String
        }

        do {
            return try JSONDecoder().decode(HealthResponse.self, from: data).status
        } catch {
            throw APIError.decoding(error)
        }
    }
}
