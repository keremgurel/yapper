import Foundation
import Testing
@testable import YapperNative

struct CalendarDecodingTests {
    private func decode<T: Decodable>(_ type: T.Type, _ json: String) throws -> T {
        try StudioJSONClient.decoder.decode(T.self, from: Data(json.utf8))
    }

    @Test func decodesTheContentList() throws {
        let response = try decode(CalendarItemsResponse.self, """
        {"items":[
          {"id":"a1","title":"  Why hooks fail ","status":"ready","stage":"library","formats":["short"],
           "ideaType":null,"scheduledFor":"2026-09-24T16:30:00.000Z","submissionId":"s1","pillar":null,
           "pillarId":null,"sourceUrl":null,"sourceTitle":null,"sourcePlatform":null,"transcriptStatus":null,
           "script":null,"originalNote":"","updatedAt":"2026-09-20T10:00:00.000Z","createdAt":"2026-09-01T10:00:00.000Z"},
          {"id":"a2","title":"","status":"drafting","stage":"library","formats":[],"ideaType":null,
           "scheduledFor":null,"submissionId":null,"pillar":null,"pillarId":null,"sourceUrl":null,
           "sourceTitle":null,"sourcePlatform":null,"transcriptStatus":null,"script":null,"originalNote":"",
           "updatedAt":"2026-09-20T10:00:00.000Z","createdAt":"2026-09-01T10:00:00.000Z"}
        ]}
        """)
        #expect(response.items.count == 2)
        #expect(response.items[0].status == .ready)
        #expect(response.items[0].displayTitle == "Why hooks fail")
        #expect(response.items[0].scheduledDate == StudioISODate.parse("2026-09-24T16:30:00Z"))
        #expect(response.items[1].displayTitle == "Untitled")
        #expect(response.items[1].scheduledDate == nil)
    }

    @Test func decodesTheSavedRowAfterAReschedule() throws {
        let response = try decode(CalendarItemResponse.self, """
        {"item":{"id":"a1","title":"Hooks","status":"posted","scheduledFor":"2026-09-25T16:30:00.000Z",
          "submissionId":null,"hooks":[],"blocks":[],"format":null,"summary":null,"points":[],"example":"","cta":""}}
        """)
        #expect(response.item.scheduledFor == "2026-09-25T16:30:00.000Z")
        #expect(response.item.status == .posted)
    }

    @Test func decodesSchedulesAndTheirErrorCopy() throws {
        let response = try decode(SchedulesResponse.self, """
        {"enabled":true,"schedules":[
          {"id":"s1","platform":"youtube","accountLabel":"@kerem","title":"Old","scheduledFor":"2026-09-01T10:00:00.000Z",
           "timezone":"America/Toronto","status":"published","error":null,"externalUrl":"https://youtube.com/shorts/x","contentItemId":"a1"},
          {"id":"s2","platform":"tiktok","accountLabel":"kerem","title":"Later","scheduledFor":"2026-10-02T10:00:00.000Z",
           "timezone":"America/Toronto","status":"scheduled","error":null,"externalUrl":null,"contentItemId":null},
          {"id":"s3","platform":"instagram","accountLabel":"kerem","title":"Sooner","scheduledFor":"2026-09-30T10:00:00.000Z",
           "timezone":"Europe/Istanbul","status":"needs_attention","error":"publish_state_pending","externalUrl":"http://x","contentItemId":null}
        ]}
        """)
        #expect(response.enabled)
        #expect(response.schedules[2].status == .needsAttention)
        #expect(response.schedules[0].postURL != nil)
        #expect(response.schedules[2].postURL == nil)
        #expect(response.schedules[1].platformLabel == "TikTok")
        #expect(ScheduleErrorCopy.message(forCode: "publish_state_pending").hasPrefix("The platform may have"))
    }

    @Test func decodesAScheduleChange() throws {
        let response = try decode(ScheduleChangeResponse.self, """
        {"schedule":{"id":"s2","platform":"facebook","accountLabel":"Page","title":"T","scheduledFor":"2026-10-02T10:00:00Z",
          "timezone":"UTC","status":"cancelled","error":null,"externalUrl":null,"contentItemId":null}}
        """)
        #expect(response.schedule.status == .cancelled)
        #expect(response.schedule.scheduledDate != nil)
    }

    @Test func monthGridCoversWholeWeeksStartingSunday() throws {
        let dates = CalendarDates(timeZone: TimeZone(identifier: "America/Toronto")!)
        let focus = try #require(StudioISODate.parse("2026-09-15T12:00:00Z"))
        let weeks = dates.monthWeeks(focus)
        #expect(weeks.count == 5)
        #expect(dates.dayKey(weeks[0][0]) == "2026-08-30")
        #expect(dates.dayKey(weeks[4][6]) == "2026-10-03")
        #expect(weeks.allSatisfy { $0.count == 7 })
    }

    @Test func rescheduleKeepsTheTimeOfDay() throws {
        let dates = CalendarDates(timeZone: TimeZone(identifier: "America/Toronto")!)
        let current = try #require(StudioISODate.parse("2026-09-24T16:30:00.000Z"))
        let target = try #require(StudioISODate.parse("2026-09-28T04:00:00.000Z"))
        #expect(StudioISODate.string(dates.rescheduled(current, to: target)) == "2026-09-28T16:30:00.000Z")
        #expect(StudioISODate.string(dates.rescheduled(nil, to: target)) == "2026-09-28T13:00:00.000Z")
    }
}
