const fs = require("fs");
const forEach = require("async-foreach").forEach;
const moment = require("moment");
const throttle = require("lodash.throttle");
const streamify = require("streamify");
const readline = require("readline");
const path = require("path");
const { google } = require("googleapis");
const filesize = require("filesize");
const Client = require("./client");
const Share = require("./share");
const util = require("./util");
const client = new Client();

const drive = google.drive({
  version: "v3",
  auth: client.oAuth2Client
});
class Upload {
  constructor(filePath, options = {cli: false}) {
    this.stream = streamify();
    this.options = options;
    // console.log(this.options);process.exit(1);
    client.authenticate().then(() => {
      if(filePath) {
        this.stream.resolve(this.upload(filePath, this.options));
      } else {
        this.stream.resolve(Promise.resolve());
      }
    }).catch(console.error);
    if(filePath) {
      return this.stream;
    }
    return this;
  }

  emit(event, data = null) {
    this.stream.emit(event, data);
    switch (event) {
      case 'error':
        if(!this.options.cli) {
          this.stream.emit(event, data); 
        }
        break;
      default:
        this.stream.emit("*", event, data);
        break;
    }
  }

  /* handleDownloadProgress = throttle(percent => {
    self.emit("download.progress", percent);
  }, 1000); */

  upload(distPath, options = {}) {
    var self = this;
    return new Promise((resolve, reject) => {
      if (!fs.existsSync(distPath)) {
        let message = "Path not found: " + distPath;
        self.writeStdErr(message + "\n");
        if (!this.options.cli) {
          self.emit("error", message);
        }
        return !this.options.cli && reject(new Error(message));
      } else if(fs.lstatSync(distPath).isDirectory()) { // upload folder
        util.getFiles(distPath).then(files => {
          // console.log('Files:',files);
          forEach(files, function(filePath, index) {
            var done = this.async();
            // const filePath = path.join(distPath, fileName);
            console.log("filePath:", filePath);
            var promise = self.uploadFile(filePath, self.options).then(result => {
              console.error(result);
            }).catch(err => {
              console.error(err);
              process.exit(1);
            });

            Promise.all([promise.catch(error => {return error;})]).then(function(values) {
              console.log("Promise.all: self.uploadFile:", values);
              done();
            });

          }, function (notAborted, files) {

          });
        }).catch(err => {
          console.error(err);
          reject(err);
        });
      } else { // upload file
        resolve(this.uploadFile(distPath, options));
      }
    });
  }

  uploadFile(filePath, options = {}) {
    this.options = Object.assign({}, this.options, options);
    var self = this;
    // console.log(this.options);process.exit(1);
    var promise = new Promise((resolve, reject) => {
      const fileSize = fs.statSync(filePath).size;

      var requestBody = {
        name: this.options.name || path.basename(filePath)
      };
      if (this.options.parent) {
        requestBody.parents = [this.options.parent];
      }
      if (this.options.description) {
        requestBody.description = this.options.description;
      }
      if (this.options.mime) {
        requestBody.mimeType = this.options.mime;
      }
      let started = moment().unix();
      drive.files.create({
          requestBody: requestBody,
          media: {
            body: fs.createReadStream(filePath)
          }
        }, {
          onUploadProgress: throttle(evt => {
            const percent = ((evt.bytesRead / fileSize) * 100).toFixed(2);
            self.emit("progress", {
              progress: percent,
              bytesRead: evt.bytesRead,
              bytesTotal: fileSize
            });
            if(self.options.progress) { // no-progress
              util.write(
                "Uploading " +
                  Math.round(percent) +
                  "% " +
                  (filesize(evt.bytesRead, { base: 10, round: 2 }) +
                    "/" +
                    filesize(fileSize, { base: 10 })),
                { update: true }
              );
            }
            
          }, 1000)
        }, function (err, data) {
          if (err) {
            self.emit("error", err);
            self.write("\n"+err.message+"\n");
            return reject(err);
          } else {
            let file = data.data;
            self.emit("done", file);
            self.write(`\nUploaded ${file.id}\n`);
            var promises = [];
            if (self.options.share) {
              let promise = new Promise(function(resolveShare, rejectShare) {
                let share = new Share(file.id, self.options.share);

                share.then(result => {
                  let url = 'https://drive.google.com/uc?export=download&id='+file.id;
                  // let url = 'https://drive.google.com/open?id='+file.id;
                  self.write(`${url}\n`);
                  resolveShare();
                })
                .catch(err => {
                  self.writeStdErr(`Shared error ${err}\n`);
                  rejectShare();
                });
              });
              promises.push(promise.catch(err => {return err;}));
            }
            // console.log(self.options);process.exit(1);
            if (self.options.delete) {
              Promise.all(promises).then(function(values) {
                fs.unlink(filePath, function(err) {
                  if(err) {
                    return self.writeStdErr(`Delete error ${err}\n`);
                  }
                  self.write("Deleted file " + filePath+ "\n");
                });
              });
            }
            return resolve(file);
          }
        }
      );
    });
    return promise;
  }

  write(data, options = {update: false}) {
    if (this.options.stdout) {
      if(options.update) {
        readline.clearLine(process.stdout, 0);
        readline.cursorTo(process.stdout, 0, null);
      } // else data = "\n" + data;
      process.stdout.write(data);
    }
  }
  writeStdErr(data, options = {update: false}) {
    if (this.options.stdout) {
      if(options.update) {
        readline.clearLine();
        readline.cursorTo(0);
      }
      process.stderr.write(data);
    }
  }
}

module.exports = Upload;
