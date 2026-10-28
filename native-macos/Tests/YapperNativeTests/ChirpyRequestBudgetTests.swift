import Foundation
import Testing
@testable import YapperNative

/// A planning request over the endpoint's limit loses the overlay image
/// before Chirpy refuses it.
struct ChirpyRequestBudgetTests {
    @Test func oversizedRequestsDropTheOverlayImageBeforeRefusing() throws {
        let small: [String: ActionJSON] = ["context": .object(["name": .string("Edit"), "selectedOverlayImage": .object(["jpeg": .string("/9j/")])])]
        #expect(try JSONDecoder().decode(ActionJSON.self, from: ChirpyRequestBudget.encode(small)) == .object(small))

        let image: ActionJSON = .object(["jpeg": .string(String(repeating: "A", count: ChirpyRequestBudget.maxBytes))])
        let large: [String: ActionJSON] = ["context": .object(["name": .string("Edit"), "selectedOverlayImage": image])]
        let sent = try JSONDecoder().decode(ActionJSON.self, from: ChirpyRequestBudget.encode(large))
        #expect(sent["context"]?["selectedOverlayImage"] == .null)
        #expect(sent["context"]?["name"] == .string("Edit"))

        let huge: [String: ActionJSON] = ["context": .object(["transcript": .string(String(repeating: "A", count: ChirpyRequestBudget.maxBytes))])]
        #expect(throws: AppActionError.self) { try ChirpyRequestBudget.encode(huge) }
    }
}
