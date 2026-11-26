/*
 * Applies build/icon.ico and version metadata to the packaged Windows EXE.
 * electron-builder normally does this with rcedit, but rcedit needs Wine on Linux
 * and is skipped when signAndEditExecutable is false. resedit is pure JS, so this
 * works on any platform.
 */
const fs = require('fs');
const path = require('path');
const { NtExecutable, NtExecutableResource, Data, Resource } = require('resedit');

const root = path.join(__dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const exePath = process.argv[2] || path.join(root, 'release', 'win-unpacked', `${pkg.build.productName}.exe`);
const icoPath = path.join(root, 'appicons', 'icon.ico');

if (!fs.existsSync(icoPath)) {
  console.error(`Icon not found: ${icoPath}`);
  process.exit(1);
}

if (!fs.existsSync(exePath)) {
  console.error(`EXE not found: ${exePath}`);
  process.exit(1);
}

const exe = NtExecutable.from(fs.readFileSync(exePath));
const res = NtExecutableResource.from(exe);
const iconFile = Data.IconFile.from(fs.readFileSync(icoPath));

Resource.IconGroupEntry.replaceIconsForResource(
  res.entries,
  1,
  1033,
  iconFile.icons.map((item) => item.data)
);

const versions = Resource.VersionInfo.fromEntries(res.entries);
const [major, minor, patch] = pkg.version.split('.').map((n) => Number(n) || 0);
versions.forEach((version) => {
  version.setFileVersion(major, minor, patch, 0, 1033);
  version.setProductVersion(major, minor, patch, 0, 1033);
  version.setStringValues({ lang: 1033, codepage: 1200 }, {
    ProductName: pkg.build.productName,
    FileDescription: pkg.build.productName,
    CompanyName: pkg.author || pkg.build.productName,
    LegalCopyright: `Copyright © ${new Date().getFullYear()} ${pkg.author || pkg.build.productName}`,
    OriginalFilename: path.basename(exePath),
    InternalName: pkg.build.productName
  });
  version.outputToResourceEntries(res.entries);
});

res.outputResource(exe);
fs.writeFileSync(exePath, Buffer.from(exe.generate()));
console.log(`Icon and version info applied to ${path.basename(exePath)} (${iconFile.icons.length} icon sizes)`);
