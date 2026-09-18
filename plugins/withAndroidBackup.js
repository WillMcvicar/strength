// Android Auto Backup for the database (DESIGN §2.7, NFR-4). expo-sqlite keeps its files in
// `filesDir/SQLite` (the "file" domain), so the rules back up that directory, WAL files included.
// Once a rule includes anything, Android backs up only what is included, so caches and every
// other directory stay out.
const { AndroidConfig, withAndroidManifest, withDangerousMod } = require('expo/config-plugins');
const fs = require('node:fs');
const path = require('node:path');

const DATABASE_DIR = 'SQLite/';

/** `android:fullBackupContent`, used up to Android 11. */
function backupRulesXml() {
  return `<?xml version="1.0" encoding="utf-8"?>
<full-backup-content>
  <include domain="file" path="${DATABASE_DIR}" />
</full-backup-content>
`;
}

/** `android:dataExtractionRules`, used from Android 12. */
function dataExtractionRulesXml() {
  return `<?xml version="1.0" encoding="utf-8"?>
<data-extraction-rules>
  <cloud-backup>
    <include domain="file" path="${DATABASE_DIR}" />
  </cloud-backup>
  <device-transfer>
    <include domain="file" path="${DATABASE_DIR}" />
  </device-transfer>
</data-extraction-rules>
`;
}

/** Points the main application at the two rule files. Pure, so it can be tested. */
function setBackupAttributes(manifest) {
  const app = AndroidConfig.Manifest.getMainApplicationOrThrow(manifest);
  app.$['android:allowBackup'] = 'true';
  app.$['android:fullBackupContent'] = '@xml/backup_rules';
  app.$['android:dataExtractionRules'] = '@xml/data_extraction_rules';
  return manifest;
}

const withAndroidBackup = (config) => {
  config = withAndroidManifest(config, (mod) => {
    mod.modResults = setBackupAttributes(mod.modResults);
    return mod;
  });
  return withDangerousMod(config, [
    'android',
    async (mod) => {
      const dir = path.join(mod.modRequest.platformProjectRoot, 'app/src/main/res/xml');
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'backup_rules.xml'), backupRulesXml());
      fs.writeFileSync(path.join(dir, 'data_extraction_rules.xml'), dataExtractionRulesXml());
      return mod;
    },
  ]);
};

module.exports = withAndroidBackup;
module.exports.backupRulesXml = backupRulesXml;
module.exports.dataExtractionRulesXml = dataExtractionRulesXml;
module.exports.setBackupAttributes = setBackupAttributes;
