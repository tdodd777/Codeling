import type { ForgeConfig } from '@electron-forge/shared-types';
import { MakerSquirrel } from '@electron-forge/maker-squirrel';
import { MakerDMG } from '@electron-forge/maker-dmg';
import { MakerDeb } from '@electron-forge/maker-deb';
import { MakerRpm } from '@electron-forge/maker-rpm';
import { PublisherGithub } from '@electron-forge/publisher-github';
import { VitePlugin } from '@electron-forge/plugin-vite';

// Code signing & notarization are stubbed below. Both require paid certs:
//   - macOS: Apple Developer ID (~$99/yr) + an app-specific password for
//     `notarytool`. Set APPLE_ID / APPLE_PASSWORD / APPLE_TEAM_ID env vars,
//     drop the .p12 into the keychain, then uncomment the osxSign + osxNotarize
//     blocks. See https://www.electronforge.io/guides/code-signing
//   - Windows: Authenticode cert from a CA (Sectigo, DigiCert, etc). Set
//     WINDOWS_CERT_FILE + WINDOWS_CERT_PASSWORD env vars, then uncomment the
//     certificateFile + certificatePassword in MakerSquirrel options.
//
// Unsigned builds work today — users see a "publisher unknown" warning on
// first launch but can dismiss it. Document this in the README.

const config: ForgeConfig = {
  packagerConfig: {
    name: 'Codeling',
    asar: {
      unpack: '**/*.node',
    },
    extraResource: ['./assets', './proto'],
    // TODO: paid cert — uncomment once Apple Developer ID is provisioned.
    // osxSign: {
    //   identity: 'Developer ID Application: <Your Name> (<TEAMID>)',
    //   optionsForFile: () => ({ entitlements: 'build/entitlements.plist' }),
    // },
    // osxNotarize: {
    //   appleId: process.env.APPLE_ID!,
    //   appleIdPassword: process.env.APPLE_PASSWORD!,
    //   teamId: process.env.APPLE_TEAM_ID!,
    // },
  },
  rebuildConfig: {},
  makers: [
    new MakerSquirrel({
      // TODO: paid cert — uncomment once Authenticode cert is provisioned.
      // certificateFile: process.env.WINDOWS_CERT_FILE,
      // certificatePassword: process.env.WINDOWS_CERT_PASSWORD,
    }),
    new MakerDMG({}, ['darwin']),
    new MakerRpm({}),
    new MakerDeb({}),
  ],
  publishers: [
    // Pushes maker outputs to GitHub Releases. Requires GITHUB_TOKEN env var
    // (a PAT with `repo` scope, or a workflow `secrets.GITHUB_TOKEN`).
    // Creates a draft release on first run; subsequent runs upload artifacts
    // to the matching version's release. Bump `version` in package.json before
    // running `npm run publish` to cut a new release.
    new PublisherGithub({
      repository: {
        owner: 'tdodd777',
        name: 'Codeling',
      },
      draft: true,
      prerelease: false,
    }),
  ],
  plugins: [
    new VitePlugin({
      build: [
        {
          entry: 'src/main/index.ts',
          config: 'vite.main.config.ts',
          target: 'main',
        },
        {
          entry: 'src/preload/index.ts',
          config: 'vite.preload.config.ts',
          target: 'preload',
        },
      ],
      renderer: [
        {
          name: 'main_window',
          config: 'vite.renderer.config.ts',
        },
      ],
    }),
  ],
};

export default config;
