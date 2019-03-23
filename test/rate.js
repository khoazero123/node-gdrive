var moment = require('moment');
const filesize = require("filesize");
/* 
var _convertSize = function(e) {
  return e > 1073741824
    ? (Math.round((100 * e) / 1073741824) / 100).toString() + " Gb"
    : e > 1048576
    ? (Math.round((100 * e) / 1048576) / 100).toString() + " Mb"
    : (Math.round((100 * e) / 1024) / 100).toString() + " Kb";
};

speedRate = function(e, x, _, c) {
  var t = x - e,
      d = 0;
  if (0 != t) {
      var n = (c - _) / t;
      return d = navigator.userAgent.toLowerCase().indexOf("firefox") > -1 ? parseInt(1e3 * n * 1e3) : parseInt(1e3 * n), _convertSize(d) + "/s"
  }
  return d = navigator.userAgent.toLowerCase().indexOf("firefox") > -1 ? parseInt(1e3 * c) : parseInt(c), _convertSize(d) + "/s"
}

var d = 0,
n = 0;

r = speedRate(n, e.timeStamp, d, x)

console.log(r) */
calcRate = function(bytes, start, end) {
  let seconds = end - start;
  if (seconds < 1.0) {
    return bytes;
  }
  return round(bytes / seconds);
};

let started = moment().unix();
rate = calcRate(1024*9, started, moment().unix())

console.log(filesize(rate) + "/s");