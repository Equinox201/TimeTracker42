import SwiftUI

struct RootView: View {
    @Environment(AppState.self) private var appState

    var body: some View {
        Group {
            if appState.isBootstrappingSession {
                ProgressView("Restoring session...")
            } else if appState.isAuthenticated {
                TabView {
                    DashboardView()
                        .tabItem { Label("Dashboard", systemImage: "gauge") }

                    AttendanceHistoryView()
                        .tabItem { Label("History", systemImage: "chart.bar.xaxis") }

                    SettingsView()
                        .tabItem { Label("Settings", systemImage: "gearshape") }
                }
            } else {
                LoginView()
            }
        }
    }
}
