import Foundation

enum TimeFormatters {
    static func hoursToReadable(_ hours: Double) -> String {
        let totalMinutes = max(Int((hours * 60).rounded()), 0)
        return minutesToReadable(totalMinutes)
    }

    static func secondsToReadable(_ seconds: Int?) -> String {
        guard let seconds, seconds > 0 else { return "0m" }
        let totalMinutes = seconds / 60
        return minutesToReadable(totalMinutes)
    }

    static func hoursToClock(_ hours: Double) -> String {
        let totalMinutes = max(Int((hours * 60).rounded()), 0)
        let h = totalMinutes / 60
        let m = totalMinutes % 60
        return String(format: "%d:%02d", h, m)
    }

    static func deltaHoursReadable(_ hours: Double) -> String {
        let sign = hours >= 0 ? "+" : "-"
        return "\(sign)\(hoursToReadable(abs(hours)))"
    }

    private static func minutesToReadable(_ totalMinutes: Int) -> String {
        let h = totalMinutes / 60
        let m = totalMinutes % 60

        if h == 0 { return "\(m)m" }
        if m == 0 { return "\(h)h" }
        return "\(h)h \(m)m"
    }
}
