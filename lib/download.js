const fs = require("fs");
const os = require("os");
const uuid = require("uuid");
const path = require("path");
const {throttle} = require("lodash");
const streamify = require("streamify");
const readline = require("readline");
const { google } = require("googleapis");
const filesize = require("filesize");
const Client = require("./client");
const share = require("./share");
const client = new Client();

const drive = google.drive({
  version: "v3",
  auth: client.oAuth2Client
});
class Download {
  constructor(fileId, options = {cli: false}) {
    this.stream = streamify();
    this.options = options;
    client.authenticate().then(() => {
      if (fileId) {
        this.stream.resolve(this.download(fileId, this.options));
      } else {
        this.stream.resolve(Promise.resolve());
        // return this;
      }
    }).catch(console.error);
    if (fileId) {
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

  download(fileId, options = {}) {
    this.options = Object.assign({}, this.options, options);
    var self = this;
    var promise = new Promise((resolve, reject) => {
      drive.files.get(
        { fileId, fields: "*" }, async (err, res) => {
          if(err) {
            return reject(err);
          }
          let file = res.data;
          let filePath = path.join(process.cwd(), file.name);
          if(self.options.randomFileName) {
            filePath = path.join(process.cwd(), uuid()+".bin");
          }
          if(self.options.output) {
            let output = self.options.output;
            if(fs.lstatSync(output).isDirectory()) {
              filePath = path.join(output, file.name);
            } else if(output.endsWith('/')) {
              fs.mkdirSync(output);
              filePath = path.join(output, file.name);
            } else {
              filePath = output;
            }
          }
          
          let parameters = { responseType: "stream" };
          let stats = {size: 0};
          if (fs.existsSync(filePath)) {
            stats = fs.statSync(filePath);
            if(stats.size == file.size) {
              self.write('File '+filePath+ ' exists!'+"\n");
              if(!self.options.force) {
                self.emit("done", filePath);
                return resolve(filePath);
              }
            } else if(self.options.resumable) {
              parameters.headers = {
                Range: "bytes=" + stats.size + "-" + file.size
              };
              self.write("Resume at bytes " + filesize(stats.size)+"\n");
            }
          }
          self.write(`Writing to ${filePath}\n`);

          self.handlePrintProgress = throttle(data => {
            util.write(data, { update: true });
          }, 0);

          const dest = fs.createWriteStream(filePath);
          let progress = 0;
          res = await drive.files.get(
            { fileId, alt: "media" },
            parameters ? parameters : { responseType: "stream" }
          );
          res.data
            .on("end", () => {
              self.write("\nDone downloading file.\n");
              self.emit("done", filePath);
              resolve(filePath);
            })
            .on("error", err => {
              self.write("\nError downloading file.\n");
              self.emit("error", err);
              reject(err);
            })
            .on("data", /* throttle( */d => {
              progress += d.length;
              const percent = ((progress / file.size) * 100).toFixed(2);
              let statusSize = filesize(progress) + '/' + filesize(file.size);
              let message = `Downloaded ${filesize(progress)} bytes (${statusSize})`;
              self.handlePrintProgress(message);
              self.emit("progress", {
                progress: percent,
                bytesRead: progress,
                bytesTotal: file.size
              });
            }/* , 500) */)
            .pipe(dest);
        }
      );
    });
    return promise;
  }

  write(data, options = {update: false}) {
    if (process.stdout.isTTY) {
      if(options.update) {
        readline.clearLine(process.stdout, 0);
        readline.cursorTo(process.stdout, 0, null);
      }
      process.stdout.write(data);
    }
  }
  writeStdErr(data, options = {update: false}) {
    if (process.stdout.isTTY) {
      if(options.update) {
        readline.clearLine();
        readline.cursorTo(0);
      }
      process.stderr.write(data);
    }
  }
}

module.exports = Download;
