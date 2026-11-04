const { execFileSync } = require('node:child_process');
const { addFbsdkReactLink } = require('../../plugins/with-fbsdk-react-link');

describe('react-native-fbsdk-next React linking (#1616)', () => {
  const podfile = 'post_install do |installer|\nend\n';

  it('links the fbsdk pod against React once, keeps flags, leaves other pods alone', () => {
    const generated = addFbsdkReactLink(podfile);
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
  configurations = [nil, '$(inherited) -lc++', ['-framework', 'React']].map do |flags|
    Configuration.new({'OTHER_LDFLAGS' => flags})
  end
  other = Configuration.new({'OTHER_LDFLAGS' => '-lz'})
  installer = Installer.new(Project.new([
    Target.new('react-native-fbsdk-next', configurations), Target.new('OtherPod', [other])
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
        { OTHER_LDFLAGS: ['$(inherited)', '-framework', 'React'] },
        { OTHER_LDFLAGS: ['$(inherited)', '-lc++', '-framework', 'React'] },
        { OTHER_LDFLAGS: ['$(inherited)', '-framework', 'React'] },
      ],
      { OTHER_LDFLAGS: '-lz' },
    ]);
  });

  it('is idempotent across prebuilds', () => {
    const once = addFbsdkReactLink('post_install do |installer|\nend\n');
    expect(addFbsdkReactLink(once)).toBe(once);
  });
});
