import Foundation

struct AttendanceHistoryResponse: Codable {
    let fromDate: String
    let toDate: String
    let totalDays: Int
    let totalHours: Double
    let isStale: Bool
    let staleAgeHours: Double?
    let lastSyncedAt: String?
    let days: [AttendanceHistoryDay]
}

struct AttendanceHistoryDay: Codable, Identifiable {
    let day: String
    let durationSeconds: Int?
    let hours: Double
    let sourceValueRaw: String?
    let hasRecord: Bool

    var id: String { day }
    var dayDate: Date? { Self.dayFormatter.date(from: day) }
}

private extension AttendanceHistoryDay {
    static let dayFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = TimeZone(secondsFromGMT: 0)
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter
    }()
}
