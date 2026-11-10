# Use GitHub's official API for the exact SDK archive whose release download returns 504.
# CocoaPods retains its own download, retry, SHA256 verification, and extraction behavior.
require 'cocoapods-downloader'

module RougetherFbsdkHttpDownload
  ORIGINAL_URL = 'https://github.com/facebook/facebook-ios-sdk/releases/download/v18.1.1/FacebookSDK_Dynamic.xcframework.zip'.freeze
  ASSET_URL = 'https://api.github.com/repos/facebook/facebook-ios-sdk/releases/assets/532904913'.freeze
  SHA256 = '23c0bb829b49d1611d4640aa5a2459d3008a63ea31300cc4b553b5f862baa7d1'.freeze

  def initialize(target_path, source_url, source_options)
    return super unless source_url == ORIGINAL_URL

    # Http 2.1 expects headers as an array of complete HTTP header strings.
    headers = Array(source_options[:headers]).reject { |header| header.match?(/\AAccept\s*:/i) }
    options = source_options.merge(
      :type => :zip,
      :sha256 => SHA256,
      :headers => headers + ['Accept: application/octet-stream']
    )
    super(target_path, ASSET_URL, options)
  end
end

unless Pod::Downloader::Http.ancestors.include?(RougetherFbsdkHttpDownload)
  Pod::Downloader::Http.prepend(RougetherFbsdkHttpDownload)
end
