import Foundation
import SwiftData

@Model
final class CachedDashboardSnapshot {
    var fetchedAt: Date
    var sourceSyncAt: Date?
    var hoursToday: Double
    var hoursWeek: Double
    var hoursMonth: Double
    var hoursLeftToGoal: Double

    init(
        fetchedAt: Date,
        sourceSyncAt: Date?,
        hoursToday: Double,
        hoursWeek: Double,
        hoursMonth: Double,
        hoursLeftToGoal: Double
    ) {
        self.fetchedAt = fetchedAt
        self.sourceSyncAt = sourceSyncAt
        self.hoursToday = hoursToday
        self.hoursWeek = hoursWeek
        self.hoursMonth = hoursMonth
        self.hoursLeftToGoal = hoursLeftToGoal
    }
}
