import AVFoundation
import MediaPlayer

// PCM is crossfaded before bundling. AVAudioPlayer loops it on the audio thread,
// so neither loop scheduling nor remote commands depend on an awake JS runtime.
final class SpeakerEngine: NSObject, AVAudioPlayerDelegate {
  private var player: AVAudioPlayer?
  private var sessionId: String?
  private var title = ""
  private var artist = ""
  private var commandTargets: [(MPRemoteCommand, Any)] = []
  private var observers: [NSObjectProtocol] = []
  var onStatus: ((String, Bool, Bool) -> Void)?

  override init() {
    super.init()
    let center = NotificationCenter.default
    observers.append(center.addObserver(forName: AVAudioSession.interruptionNotification, object: nil, queue: .main) { [weak self] note in
      guard let raw = note.userInfo?[AVAudioSessionInterruptionTypeKey] as? UInt,
            AVAudioSession.InterruptionType(rawValue: raw) == .began else { return }
      // A phone call / another audio app stops playback. Do not auto-resume afterward.
      self?.pause()
    })
    observers.append(center.addObserver(forName: AVAudioSession.routeChangeNotification, object: nil, queue: .main) { [weak self] note in
      guard let raw = note.userInfo?[AVAudioSessionRouteChangeReasonKey] as? UInt,
            AVAudioSession.RouteChangeReason(rawValue: raw) == .oldDeviceUnavailable else { return }
      self?.pause()
    })
    observers.append(center.addObserver(forName: AVAudioSession.mediaServicesWereResetNotification, object: nil, queue: .main) { [weak self] _ in
      self?.emit(error: true)
      self?.clear()
    })
  }

  func prepare(id: String, uri: String, volume: Double, title: String, artist: String) throws {
    guard let url = URL(string: uri), url.isFileURL else {
      throw NSError(domain: "RougetherSpeaker", code: 1, userInfo: [NSLocalizedDescriptionKey: "Expected a bundled audio file"])
    }
    clear()
    let audio = try AVAudioPlayer(contentsOf: url)
    audio.numberOfLoops = -1
    audio.volume = Float(min(1, max(0, volume)))
    audio.delegate = self
    guard audio.prepareToPlay() else { throw NSError(domain: "RougetherSpeaker", code: 2) }
    player = audio
    sessionId = id
    self.title = title
    self.artist = artist
    installCommands()
  }

  func play(id: String) throws {
    guard id == sessionId, let player else { return }
    let audioSession = AVAudioSession.sharedInstance()
    try audioSession.setCategory(.playback, mode: .default)
    try audioSession.setActive(true)
    guard player.play() else { throw NSError(domain: "RougetherSpeaker", code: 3) }
    emit()
  }

  func pause(id: String? = nil) {
    guard id == nil || id == sessionId else { return }
    player?.pause()
    emit()
  }

  func setVolume(id: String, volume: Double) {
    guard id == sessionId else { return }
    player?.volume = Float(min(1, max(0, volume)))
  }

  func dispose(id: String) {
    guard id == sessionId else { return }
    clear()
  }

  func refresh(id: String) {
    guard id == sessionId else { return }
    emit()
  }

  private func installCommands() {
    let commands = MPRemoteCommandCenter.shared()
    for command in [commands.playCommand, commands.pauseCommand, commands.togglePlayPauseCommand, commands.stopCommand] {
      command.isEnabled = true
    }
    commandTargets = [
      (commands.playCommand, commands.playCommand.addTarget { [weak self] _ in self?.remotePlay() ?? .commandFailed }),
      (commands.pauseCommand, commands.pauseCommand.addTarget { [weak self] _ in self?.pause(); return .success }),
      (commands.stopCommand, commands.stopCommand.addTarget { [weak self] _ in self?.pause(); return .success }),
      (commands.togglePlayPauseCommand, commands.togglePlayPauseCommand.addTarget { [weak self] _ in
        guard let self else { return .commandFailed }
        if self.player?.isPlaying == true { self.pause(); return .success }
        return self.remotePlay()
      })
    ]
  }

  private func remotePlay() -> MPRemoteCommandHandlerStatus {
    guard let id = sessionId else { return .commandFailed }
    do { try play(id: id); return .success }
    catch { emit(error: true); return .commandFailed }
  }

  private func emit(error: Bool = false) {
    guard let id = sessionId else { return }
    let playing = player?.isPlaying == true
    MPNowPlayingInfoCenter.default().nowPlayingInfo = [
      MPMediaItemPropertyTitle: title,
      MPMediaItemPropertyArtist: artist,
      MPNowPlayingInfoPropertyIsLiveStream: true,
      MPNowPlayingInfoPropertyPlaybackRate: playing ? 1.0 : 0.0
    ]
    onStatus?(id, playing, error)
  }

  func clear() {
    let hadPlayer = player != nil
    player?.stop()
    player = nil
    sessionId = nil
    for (command, target) in commandTargets { command.removeTarget(target) }
    commandTargets.removeAll()
    if hadPlayer {
      MPNowPlayingInfoCenter.default().nowPlayingInfo = nil
      try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
    }
  }

  func audioPlayerDecodeErrorDidOccur(_ player: AVAudioPlayer, error: Error?) { emit(error: true) }
  func audioPlayerDidFinishPlaying(_ player: AVAudioPlayer, successfully flag: Bool) { emit(error: true) }

  deinit {
    observers.forEach { NotificationCenter.default.removeObserver($0) }
    clear()
  }
}
