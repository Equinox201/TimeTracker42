import Foundation

enum APIError: Error {
    case invalidURL
    case network(Error)
    case invalidResponse
    case server(statusCode: Int)
    case unauthorized
    case decoding(Error)
    case encoding(Error)
}

extension APIError: LocalizedError {
    var errorDescription: String? {
        switch self {
        case .invalidURL:
            return "Invalid backend URL."
        case .network(let error):
            return "Network error: \(error.localizedDescription)"
        case .invalidResponse:
            return "Invalid response from server."
        case .server(let statusCode):
            return "Server returned status code \(statusCode)."
        case .unauthorized:
            return "Your session expired. Please sign in again."
        case .decoding:
            return "Failed to decode server response."
        case .encoding:
            return "Failed to encode request payload."
        }
    }
}
