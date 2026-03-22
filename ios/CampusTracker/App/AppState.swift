import Foundation

@Observable
final class AppState {
    var isAuthenticated: Bool = false
    var isDataStale: Bool = false
}
