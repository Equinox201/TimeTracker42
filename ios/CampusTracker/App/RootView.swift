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
                        .tabItem { Label("Main", systemImage: "gauge") }

                    AttendanceHistoryView()
                        .tabItem { Label("Historic", systemImage: "chart.bar.xaxis") }

                    SettingsView()
                        .tabItem { Label("Settings", systemImage: "gearshape") }
                }
                .tint(TT42Palette.magenta)
            } else {
                LoginView()
            }
        }
    }
}
