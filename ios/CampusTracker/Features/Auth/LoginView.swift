import SwiftUI

struct LoginView: View {
    var body: some View {
        VStack(spacing: 16) {
            Text("TimeTracker42")
                .font(.largeTitle)
                .bold()

            Text("Sign in with 42 to load your attendance data.")
                .multilineTextAlignment(.center)
                .foregroundStyle(.secondary)

            Button("Continue with 42") {
                // TODO: Start ASWebAuthenticationSession with backend auth start endpoint.
            }
            .buttonStyle(.borderedProminent)
        }
        .padding()
    }
}
