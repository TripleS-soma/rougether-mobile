const { execFileSync } = require('node:child_process');
const { addAnalyticsLinkerFlag } = require('../../plugins/with-firebase-analytics-linker');

describe('Firebase Analytics Release linking', () => {
  const podfile = 'post_install do |installer|\nend\n';

  it('keeps categories in the Analytics pod, preserves flags and leaves other pods alone', () => {
    const generated = addAnalyticsLinkerFlag(podfile);
    const result = execFileSync(
      'ruby',
      [
        '-e',
        `
require 'json'
Configuration = Struct.new(:build_settings)
Target = Struct.new(:name, :build_configurations)
Project = Struct.new(:targets)
Installer = Struct.new(:pods_project)
def post_install
  configurations = [nil, '$(inherited) -lc++', ['-ObjC', '-lz']].map do |flags|
    Configuration.new({'OTHER_LDFLAGS' => flags})
  end
  other = Configuration.new({'OTHER_LDFLAGS' => '-lz'})
  installer = Installer.new(Project.new([
    Target.new('RNFBAnalytics', configurations), Target.new('OtherPod', [other])
  ]))
  yield installer
  puts JSON.generate([configurations.map(&:build_settings), other.build_settings])
end
${generated}
`,
      ],
      { encoding: 'utf8' },
    );
    expect(JSON.parse(result)).toEqual([
      [
        { OTHER_LDFLAGS: ['$(inherited)', '-ObjC'] },
        { OTHER_LDFLAGS: ['$(inherited)', '-lc++', '-ObjC'] },
        { OTHER_LDFLAGS: ['$(inherited)', '-ObjC', '-lz'] },
      ],
      { OTHER_LDFLAGS: '-lz' },
    ]);
    expect(addAnalyticsLinkerFlag(generated)).toBe(generated);
  });

  it('fails when the generated Podfile no longer provides the install hook', () => {
    expect(() => addAnalyticsLinkerFlag('target "App" do\nend')).toThrow();
  });
});
