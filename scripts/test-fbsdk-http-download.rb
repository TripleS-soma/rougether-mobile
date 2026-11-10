# Run with the Ruby/GEM_HOME used by CocoaPods. No network or SDK fixtures are needed.
require 'pathname'
require 'tmpdir'
require 'digest'
require 'cocoapods-downloader'
raise 'Tests require the actual cocoapods-downloader 2.1 gem' unless Pod::Downloader::VERSION == '2.1'

loader = File.expand_path('../plugins/fbsdk-http-download', __dir__)
require loader
require loader

def assert(condition, message)
  raise message unless condition
end

adapter = RougetherFbsdkHttpDownload
assert(Pod::Downloader::Http.ancestors.count(adapter) == 1, 'duplicate adapter')
Dir.mktmpdir('rougether-fbsdk-test-') do |root|
  original_headers = ['X-Test: preserved', 'Accept: application/json'].freeze
  original_options = { :headers => original_headers, :flatten => false }.freeze
  downloader = Pod::Downloader::Http.new(root, adapter::ORIGINAL_URL, original_options)
  assert(downloader.url == adapter::ASSET_URL, 'matching source must use official API')
  assert(downloader.options[:sha256] == adapter::SHA256, 'pinned checksum missing')
  assert(downloader.send(:type) == :zip, 'extensionless API must retain ZIP extraction')
  assert(downloader.options[:flatten] == false, 'other options changed')
  assert(downloader.options[:headers] == ['X-Test: preserved', 'Accept: application/octet-stream'], 'header format or values changed')
  assert(original_options[:headers] == original_headers, 'caller options mutated')
  assert(original_headers.last == 'Accept: application/json', 'caller headers mutated')

  [adapter::ORIGINAL_URL.sub('v18.1.1', 'v18.1.0'), adapter::ORIGINAL_URL + '?query=1', 'https://example.org/other.zip'].each do |url|
    unchanged = Pod::Downloader::Http.new(root, url, original_options)
    assert(unchanged.url == url, 'non-matching URL changed')
    assert(unchanged.options.equal?(original_options), 'non-matching arguments changed')
  end
  no_headers = Pod::Downloader::Http.new(root, adapter::ORIGINAL_URL, {})
  assert(no_headers.options[:headers] == ['Accept: application/octet-stream'], 'nil headers unsupported')

  # Exercise actual Http#download_file and RemoteFile#verify_checksum. Only the executor is mocked.
  calls = []
  downloader.define_singleton_method(:execute_command) do |executable, args, _raise_on_failure = false|
    calls << [executable, args]
    raise 'unverified archive extracted' unless executable == 'curl'
    File.binwrite(args[args.index('-o') + 1], 'corrupt SDK archive')
    ''
  end
  begin
    downloader.download
    raise 'corrupt archive unexpectedly accepted'
  rescue Pod::Downloader::DownloaderError => error
    assert(error.message.include?('Verification checksum was incorrect'), 'checksum verification was bypassed')
  end
  assert(calls.length == 1, 'unexpected download or extraction retry')
  args = calls.first.last
  assert(args.include?(adapter::ASSET_URL), 'executor did not receive official URL')
  assert(args.include?('Accept: application/octet-stream'), 'executor lost Accept header')
  assert(args.include?('--retry') && args[args.index('--retry') + 1] == '2', 'CocoaPods retries changed')

  # Non-matching sources retain the real gem's ordinary successful download/checksum/extraction path.
  fixture = 'unrelated SDK fixture'
  other = Pod::Downloader::Http.new(File.join(root, 'other'), 'https://example.org/other.zip', { :sha256 => Digest::SHA256.hexdigest(fixture) })
  other_calls = []
  other.define_singleton_method(:execute_command) do |executable, args, _raise_on_failure = false|
    other_calls << executable
    File.binwrite(args[args.index('-o') + 1], fixture) if executable == 'curl'
    ''
  end
  other.download
  assert(other_calls == ['curl', 'unzip'], 'ordinary successful path changed')
end
puts 'Actual cocoapods-downloader 2.1 adapter checks passed (executor mocked; no network)'
