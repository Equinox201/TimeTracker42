import Foundation

enum APIError: Error {
    case invalidURL
    case network(Error)
    case invalidResponse
    case server(statusCode: Int)
    case decoding(Error)
}
