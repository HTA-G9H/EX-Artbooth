/*
 * electron-builder afterPack hook: stamps the Windows EXE with build/icon.ico and
 * version metadata using resedit (pure JS), so the icon is correct even when
 * rcedit is unavailable (Linux without Wine, or signAndEditExecutable: false).
 * Runs before the NSIS/portable installer is assembled, so installers get it too.
 */
const path = require('path');
const { execFileSync } = require('child_process');

exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== 'win32') return;
  const productName = context.packager.appInfo.productFilename;
  const exePath = path.join(context.appOutDir, `${productName}.exe`);
  try {
    execFileSync(process.execPath, [path.join(__dirname, 'set-exe-icon.js'), exePath], { stdio: 'inherit' });
  } catch (err) {
    console.warn('Could not stamp the EXE icon:', err.message);
  }
};
