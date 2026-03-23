import SwiftUI

struct SettingsView: View {
    @Environment(AppState.self) private var appState

    var body: some View {
        NavigationStack {
            Form {
                Section("Connection") {
                    LabeledContent("Backend URL", value: appState.backendBaseURL)
                    LabeledContent("Login", value: appState.userLogin.isEmpty ? "Unknown" : appState.userLogin)
                    LabeledContent(
                        "Data Freshness",
                        value: appState.isDataStale ? "Stale" : "Fresh"
                    )
                }

                Section {
                    Button("Sign Out", role: .destructive) {
                        Task { await appState.signOut() }
                    }
                }
            }
            .navigationTitle("Settings")
        }
    }
}
