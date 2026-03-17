/**
 * pnpm hook file — rewrites vulnerable transitive dependency versions
 * to their patched equivalents before resolution.
 */
function readPackage(pkg, context) {
  const upgrades = {
    flatted: '>=3.4.0',
    glob: '>=10.5.0',
    'node-forge': '>=1.3.2',
    'serialize-javascript': '>=7.0.3',
    tar: '>=7.5.11',
  };

  const allDeps = [
    'dependencies',
    'devDependencies',
    'optionalDependencies',
    'peerDependencies',
  ];

  allDeps.forEach((field) => {
    if (!pkg[field]) return;

    Object.keys(upgrades).forEach((name) => {
      if (pkg[field][name]) {
        pkg[field][name] = upgrades[name];
      }
    });

    if (pkg[field].minimatch) {
      const cur = pkg[field].minimatch;
      const major = parseInt(cur.replace(/[^0-9]/, ''), 10);
      if (!isNaN(major)) {
        if (major <= 3) pkg[field].minimatch = '>=3.1.4 <4';
        else if (major <= 9 || cur.includes('^9') || cur.includes('~9')) pkg[field].minimatch = '>=9.0.7 <10';
      } else {
        if (cur.startsWith('^3') || cur.startsWith('~3') || cur === '3.x') pkg[field].minimatch = '>=3.1.4 <4';
        else if (cur.startsWith('^9') || cur.startsWith('~9') || cur === '9.x') pkg[field].minimatch = '>=9.0.7 <10';
      }
    }

    if (pkg[field].immutable) {
      const cur = pkg[field].immutable;
      if (cur.startsWith('^3') || cur.startsWith('~3') || cur.startsWith('3.')) {
        pkg[field].immutable = '>=3.8.3 <4';
      }
    }

    if (pkg[field].undici) {
      const cur = pkg[field].undici;
      if (cur.startsWith('^6') || cur.startsWith('~6') || cur.startsWith('6.') || cur === '6.21.3') {
        pkg[field].undici = '>=6.24.0 <7';
      } else if (cur.startsWith('^7') || cur.startsWith('~7') || cur.startsWith('7.') || cur === '7.10.0') {
        pkg[field].undici = '>=7.24.0 <8';
      }
    }
  });

  return pkg;
}

module.exports = {
  hooks: {
    readPackage,
  },
};
