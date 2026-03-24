import SwiftUI

@main
struct TimeTracker42App: App {
    @State private var appState = AppState()
    @AppStorage("ui_theme_mode") private var themeModeRaw = TT42ThemeMode.system.rawValue

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(appState)
                .preferredColorScheme(currentThemeMode.colorScheme)
                .task {
                    await appState.bootstrapSession()
                }
        }
    }

    private var currentThemeMode: TT42ThemeMode {
        TT42ThemeMode(rawValue: themeModeRaw) ?? .system
    }
}
