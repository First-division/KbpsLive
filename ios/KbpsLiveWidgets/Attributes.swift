import ActivityKit

struct RadioActivityAttributes: ActivityAttributes {
  public struct ContentState: Codable, Hashable {
    var title: String
    var subtitle: String
    var isLive: Bool
    var artworkURL: String
    var waveformLevel: Double
  }

  var stationName: String
}
