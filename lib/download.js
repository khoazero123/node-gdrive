const fs = require("fs");
const os = require("os");
const uuid = require("uuid");
const path = require("path");
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
    const scopes = [
      "https://www.googleapis.com/auth/drive",
      "https://www.googleapis.com/auth/drive.appdata",
      "https://www.googleapis.com/auth/drive.file",
      "https://www.googleapis.com/auth/drive.metadata",
      "https://www.googleapis.com/auth/drive.metadata.readonly",
      "https://www.googleapis.com/auth/drive.photos.readonly",
      "https://www.googleapis.com/auth/drive.readonly"
    ];
    client.authenticate(scopes).then(() => {
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
          const dest = fs.createWriteStream(filePath);
          let progress = 0;
          res = await drive.files.get(
            { fileId, alt: "media" },
            parameters ? parameters : { responseType: "stream" }
          );
          res.data
            .on("end", () => {
              self.write("\nDone downloading file.\n");
              resolve(filePath);
            })
            .on("error", err => {
              self.write("\nError downloading file.\n");
              reject(err);
            })
            .on("data", d => {
              progress += d.length;
              let startSizeOfFile = stats.size + progress;
              let statusSize = filesize(startSizeOfFile) + '/' + filesize(file.size);
              self.write(`Downloaded ${filesize(startSizeOfFile)} bytes (${statusSize})`,{ update: true });
            })
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

module.exports = {
  Download,
  client: client.oAuth2Client
};
