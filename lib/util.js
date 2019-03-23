const { promisify } = require("util");
const { resolve } = require("path");
const fs = require("fs");
const readline = require("readline");
const readdir = promisify(fs.readdir);
const rename = promisify(fs.rename);
const stat = promisify(fs.stat);

/**
 * Converts seconds to format hh:mm:ss
 *
 * @param {Number} seconds
 * @return {String}
 */
exports.formatDuration = function (seconds) {
  var parts = [];
  parts.push(seconds % 60);
  var minutes = Math.floor(seconds / 60);
  if (minutes > 0) {
    parts.push(minutes % 60);
    var hours = Math.floor(minutes / 60);
    if (hours > 0) {
      parts.push(hours);
    }
  }
  return parts.reverse().join(':');
};

exports.getFiles = async function getFiles(dir) {
  const subdirs = await readdir(dir);
  const files = await Promise.all(
    subdirs.map(async subdir => {
      const res = resolve(dir, subdir);
      return (await stat(res)).isDirectory() ? getFiles(res) : res;
    })
  );
  return files.reduce((a, f) => a.concat(f), []);
}

exports.calcRate = function(bytes, start, end) {
  let seconds = end - start;
  if (seconds < 1.0) {
    return bytes;
  }
  return Math.round(bytes / seconds);
};

exports.write = function(data, options = {update: false}) {
  if (process.stdout.isTTY) {
    if (options.update) {
      readline.clearLine(process.stdout, 0);
      readline.cursorTo(process.stdout, 0, null);
    }
    process.stdout.write(data);
  }
};

exports.writeStdErr = function(data, options = { update: false }) {
  if (process.stdout.isTTY) {
    if (options.update) {
      readline.clearLine();
      readline.cursorTo(0);
    }
    process.stderr.write(data);
  }
};