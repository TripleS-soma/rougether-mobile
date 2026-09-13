Pod::Spec.new do |s|
  s.name = 'RougetherSpeaker'
  s.version = '1.0.0'
  s.summary = 'Looping room ambience with native lock screen controls'
  s.description = s.summary
  s.license = { :type => 'MIT' }
  s.author = 'Rougether'
  s.homepage = 'https://github.com/TripleS-soma/rougether-mobile'
  s.source = { :git => s.homepage }
  s.platforms = { :ios => '15.1' }
  s.swift_version = '5.9'
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.source_files = '**/*.swift'
end
