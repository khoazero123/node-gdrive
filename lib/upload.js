const fs = require("fs");
const streamify = require("streamify");
const readline = require("readline");
const path = require("path");
const { google } = require("googleapis");
const filesize = require("filesize");
const Client = require("./client");
const share = require("./share");
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
      if(filePath) {
        this.stream.resolve(this.upload(filePath, this.options));
      } else {
        this.stream.resolve(Promise.resolve());
        // return this;
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

  upload(filePath, options = {}) {
    this.options = this.options || options;
    var self = this;
    // console.log(this.options);process.exit(1);
    var promise = new Promise((resolve, reject) => {
      if (!fs.existsSync(filePath)) {
        let message = "File not found: " + filePath;
        self.writeStdErr(message);
        if(!this.options.cli) {
          self.emit("error", message);
        }
        return !this.options.cli && reject(new Error(message));
      }
      const fileSize = fs.statSync(filePath).size;

      var requestBody = {
        name: this.options.name || path.basename(filePath)
      };
      if (this.options.folderId) {
        requestBody.parents = [this.options.folderId];
      }
      drive.files.create({
          requestBody: requestBody,
          media: {
            body: fs.createReadStream(filePath)
          }
        }, {
          onUploadProgress: evt => {
            const progress = (evt.bytesRead / fileSize) * 100;
            self.emit("progress", progress);
            self.write(
              "Uploading " +
                Math.round(progress) +
                "% " +
                (filesize(evt.bytesRead, { base: 10, round: 2 }) +
                  "/" +
                  filesize(fileSize, { base: 10 })),
              { update: true }
            );
          }
        }, function (err, data) {
          if (err) {
            self.emit("error", err);
            self.write(err.message);
            return reject(err);
          } else {
            let file = data.data;
            self.emit("done", file);
            self.write(`Uploaded ${file.id}\n`);
            var promises = [];
            if (self.options.share) {
              let promise = new Promise(function(resolve, reject) {
                share(drive, file.id, self.options.share)
                .then(result => {
                  // let url = 'https://drive.google.com/uc?export=download&id='+file.id;
                  let url = 'https://drive.google.com/open?id='+file.id;
                  self.write(`${url}\n`);
                  resolve();
                })
                .catch(err => {
                  self.writeStdErr(`Shared error ${err}\n`);
                  reject();
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
      } else data = "\n" + data;
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
  Upload,
  client: client.oAuth2Client
};
