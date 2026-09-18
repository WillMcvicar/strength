// The Android backup rules include the database directory (DESIGN §2.7, NFR-4).
import {
  backupRulesXml,
  dataExtractionRulesXml,
  setBackupAttributes,
} from '../plugins/withAndroidBackup';

const databaseDir = '<include domain="file" path="SQLite/" />';

describe('NFR-4 Android backup rules', () => {
  it('back up the expo-sqlite directory before Android 12', () => {
    expect(backupRulesXml()).toContain(`<full-backup-content>\n  ${databaseDir}`);
  });

  it('back up the expo-sqlite directory to the cloud and on device transfer from Android 12', () => {
    const xml = dataExtractionRulesXml();
    expect(xml).toMatch(new RegExp(`<cloud-backup>\\s*${databaseDir}\\s*</cloud-backup>`));
    expect(xml).toMatch(new RegExp(`<device-transfer>\\s*${databaseDir}\\s*</device-transfer>`));
  });

  it('turns backup on and points the application at both rule files', () => {
    const manifest = {
      manifest: { $: {}, application: [{ $: { 'android:name': '.MainApplication' } }] },
    };
    expect(setBackupAttributes(manifest).manifest.application[0].$).toEqual({
      'android:name': '.MainApplication',
      'android:allowBackup': 'true',
      'android:fullBackupContent': '@xml/backup_rules',
      'android:dataExtractionRules': '@xml/data_extraction_rules',
    });
  });
});
