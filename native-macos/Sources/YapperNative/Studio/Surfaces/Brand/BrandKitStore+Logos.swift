import Foundation

/// Logo changes: upload, mark primary, delete.
extension BrandKitStore {
    var logos: [BrandLogo] { kit?.logos ?? [] }
    var canAddLogo: Bool { kit != nil && !busy && logos.count < BrandLimits.maxLogos }

    func uploadLogo(_ file: URL) async {
        await perform {
            let logo = try await BrandLogoUploader.upload(file)
            self.kit?.logos.append(logo)
        }
    }

    func makePrimary(logo: BrandLogo) async {
        await perform {
            try await StudioJSONClient.raw("api/brand/logos/\(Self.pathID(logo.id))", method: "PATCH", body: nil)
            guard var kit = self.kit else { return }
            for index in kit.logos.indices { kit.logos[index].isPrimary = kit.logos[index].id == logo.id }
            self.kit = kit
        }
    }

    func deleteLogo(_ logo: BrandLogo) async {
        await perform {
            try await StudioJSONClient.delete("api/brand/logos/\(Self.pathID(logo.id))")
        }
        // The server may promote another logo to primary; read it back.
        if actionError == nil { await refresh() }
    }

    private static func pathID(_ id: String) -> String {
        id.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed.subtracting(CharacterSet(charactersIn: "/"))) ?? id
    }
}
