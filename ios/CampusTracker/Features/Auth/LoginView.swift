import SwiftUI

struct LoginView: View {
    @Environment(AppState.self) private var appState

    @State private var baseURLInput = "http://127.0.0.1:8000"
    @State private var isAuthenticating = false
    @State private var errorMessage: String?
    @State private var webAuthenticator = OAuthWebAuthenticator()

    var body: some View {
        VStack(spacing: 16) {
            Text("TimeTracker42")
                .font(.largeTitle)
                .bold()

            Text("Sign in with 42 to load your attendance from backend.")
                .multilineTextAlignment(.center)
                .foregroundStyle(.secondary)

            TextField("Backend URL", text: $baseURLInput)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
                .textFieldStyle(.roundedBorder)

            Button("Continue with 42") {
                Task { await startOAuthFlow() }
            }
            .buttonStyle(.borderedProminent)
            .disabled(isAuthenticating)

            if isAuthenticating {
                ProgressView("Opening secure sign-in...")
            }
        }
        .padding()
        .alert("Sign-In Error", isPresented: errorBinding) {
            Button("OK") { errorMessage = nil }
        } message: {
            Text(errorMessage ?? "")
        }
        .onAppear {
            if baseURLInput != appState.backendBaseURL {
                baseURLInput = appState.backendBaseURL
            }
        }
    }

    private var errorBinding: Binding<Bool> {
        Binding(
            get: { errorMessage != nil },
            set: { newValue in
                if !newValue {
                    errorMessage = nil
                }
            }
        )
    }

    private func startOAuthFlow() async {
        isAuthenticating = true
        defer { isAuthenticating = false }

        do {
            let oneTimeCode = try await webAuthenticator.startSignIn(
                baseURL: baseURLInput,
                callbackScheme: appState.mobileCallbackScheme
            )
            try await appState.completeOAuthSignIn(
                baseURL: baseURLInput,
                oneTimeCode: oneTimeCode
            )
            errorMessage = nil
        } catch {
            errorMessage = (error as? LocalizedError)?.errorDescription ?? error.localizedDescription
        }
    }
}
