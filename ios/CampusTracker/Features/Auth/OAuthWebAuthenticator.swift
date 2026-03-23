import AuthenticationServices
import Foundation
import UIKit

enum OAuthWebAuthenticatorError: LocalizedError {
    case invalidBaseURL
    case invalidStartURL
    case unableToStartSession
    case cancelled
    case missingOneTimeCode

    var errorDescription: String? {
        switch self {
        case .invalidBaseURL:
            return "Backend URL is invalid."
        case .invalidStartURL:
            return "Unable to build OAuth start URL."
        case .unableToStartSession:
            return "Could not start secure sign-in session."
        case .cancelled:
            return "Sign-in was cancelled."
        case .missingOneTimeCode:
            return "OAuth callback did not include a one-time code."
        }
    }
}

@MainActor
final class OAuthWebAuthenticator: NSObject {
    private var currentSession: ASWebAuthenticationSession?

    func startSignIn(baseURL: String, callbackScheme: String) async throws -> String {
        guard let base = URL(string: baseURL) else {
            throw OAuthWebAuthenticatorError.invalidBaseURL
        }

        var components = URLComponents(
            url: base.appendingPathComponent("api/v1/auth/42/start"),
            resolvingAgainstBaseURL: false
        )
        components?.queryItems = [
            URLQueryItem(
                name: "mobile_redirect_uri",
                value: "\(callbackScheme)://auth/callback"
            ),
        ]

        guard let startURL = components?.url else {
            throw OAuthWebAuthenticatorError.invalidStartURL
        }

        return try await withCheckedThrowingContinuation { continuation in
            let session = ASWebAuthenticationSession(
                url: startURL,
                callbackURLScheme: callbackScheme
            ) { [weak self] callbackURL, error in
                self?.currentSession = nil

                if let authError = error as? ASWebAuthenticationSessionError,
                   authError.code == .canceledLogin {
                    continuation.resume(throwing: OAuthWebAuthenticatorError.cancelled)
                    return
                }

                if let error {
                    continuation.resume(throwing: error)
                    return
                }

                guard let callbackURL else {
                    continuation.resume(throwing: OAuthWebAuthenticatorError.missingOneTimeCode)
                    return
                }

                guard let queryItems = URLComponents(
                    url: callbackURL,
                    resolvingAgainstBaseURL: false
                )?.queryItems,
                let oneTimeCode = queryItems.first(where: { $0.name == "otc" })?.value,
                !oneTimeCode.isEmpty else {
                    continuation.resume(throwing: OAuthWebAuthenticatorError.missingOneTimeCode)
                    return
                }

                continuation.resume(returning: oneTimeCode)
            }

            session.presentationContextProvider = self
            session.prefersEphemeralWebBrowserSession = true
            currentSession = session

            if !session.start() {
                continuation.resume(throwing: OAuthWebAuthenticatorError.unableToStartSession)
                currentSession = nil
            }
        }
    }
}

extension OAuthWebAuthenticator: ASWebAuthenticationPresentationContextProviding {
    func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        let scenes = UIApplication.shared.connectedScenes
            .compactMap { $0 as? UIWindowScene }

        if let keyWindow = scenes
            .flatMap({ $0.windows })
            .first(where: { $0.isKeyWindow }) {
            return keyWindow
        }

        if let firstScene = scenes.first {
            return UIWindow(windowScene: firstScene)
        }

        preconditionFailure("No active window scene available for authentication session.")
    }
}
