const Fs = require('fs');
const ChildProcess = require('child_process');

/**
 * Run "npm outdated" to check if a newer version exists.
 * If so, just print instructions on how to update.
 */
function checkForUpdates () {
  Promise.all([readPackageJsonVersion(), getLatestAvailableVersion()])
    .then((versions) => {
      if (versions[0] !== versions[1]) {
        console.warn('\n');
        console.warn('\x1b[33;1mA newer version of SpaceKit is available' +
                     versions[1] + '.');
        console.warn('Please update by running the following command:');
        console.warn('');
        console.warn('   npm -g install spacekit\x1b[0m');
        console.warn('');
      }
    }, (err) => {
      console.error(`Error checking for updates (${err}).`);
    });
}

module.exports = checkForUpdates;

function readPackageJsonVersion () {
  return new Promise((resolve, reject) => {
    Fs.readFile(__dirname + '/../package.json', (err, data) => {
      if (err) {
        reject(err);
      } else {
        try {
          resolve(JSON.parse(data.toString('utf-8')).version);
        } catch (e) {
          reject(e);
        }
      }
    });
  });
}

function getLatestAvailableVersion () {
  return new Promise((resolve, reject) => {
    ChildProcess.exec('npm show spacekit version', (err, stdout, stderr) => {
      if (err) {
        reject(err);
      } else {
        resolve(stdout.trim());
      }
    });
  });
}
