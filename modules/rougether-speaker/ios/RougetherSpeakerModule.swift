import ExpoModulesCore

public class RougetherSpeakerModule: Module {
  private let engine = SpeakerEngine()

  public func definition() -> ModuleDefinition {
    Name("RougetherSpeaker")
    Events("onStatus")
    OnCreate { [weak self] in
      self?.engine.onStatus = { [weak self] id, playing, error in
        self?.sendEvent("onStatus", ["id": id, "playing": playing, "error": error])
      }
    }
    AsyncFunction("prepare") { (id: String, uri: String, volume: Double, title: String, artist: String) in
      try self.engine.prepare(id: id, uri: uri, volume: volume, title: title, artist: artist)
    }.runOnQueue(.main)
    AsyncFunction("play") { (id: String) in try self.engine.play(id: id) }.runOnQueue(.main)
    AsyncFunction("pause") { (id: String) in self.engine.pause(id: id) }.runOnQueue(.main)
    AsyncFunction("setVolume") { (id: String, volume: Double) in self.engine.setVolume(id: id, volume: volume) }.runOnQueue(.main)
    AsyncFunction("dispose") { (id: String) in self.engine.dispose(id: id) }.runOnQueue(.main)
    AsyncFunction("refresh") { (id: String) in self.engine.refresh(id: id) }.runOnQueue(.main)
    OnDestroy { [weak self] in
      guard let engine = self?.engine else { return }
      DispatchQueue.main.async { engine.clear() }
    }
  }
}
