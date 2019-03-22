const fs = require("fs");
const streamify = require("streamify");
const readline = require("readline");
const path = require("path");
const { google } = require("googleapis");
const Client = require("./client");
const share = require("./share");
const client = new Client();

const drive = google.drive({
  version: "v3",
  auth: client.oAuth2Client
});
class Upload {
  constructor(filePath, options = {}) {
    this.stream = streamify();
    const scopes = ["https://www.googleapis.com/auth/drive.file"];
    client.authenticate(scopes).then(() => {
      if(filePath) {
        this.stream.resolve(this.upload(filePath, options));
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
    if (event !== "error") {
      this.stream.emit("*", event, data);
    }
  }

  upload(filePath, options = {}) {
    var self = this;
    var promise = new Promise((resolve, reject) => {
      if (!fs.existsSync(filePath)) {
        let message = "File not found: " + filePath;
        self.emit("error", message);
        return reject(new Error(message));
      }
      const fileSize = fs.statSync(filePath).size;

      var requestBody = {
        name: options.name || path.basename(filePath)
      };
      if (options.folderId) {
        requestBody.parents = [options.folderId];
      }
      drive.files.create({
          requestBody: requestBody,
          media: {
            body: fs.createReadStream(filePath)
          }
        }, {
          // Use the `onUploadProgress` event from Axios to track the
          // number of bytes uploaded to this point.
          onUploadProgress: evt => {
            const progress = (evt.bytesRead / fileSize) * 100;
            self.emit("progress", progress);
            // readline.clearLine();
            // readline.cursorTo(0);
            // process.stdout.write(`${Math.round(progress)}% complete\n`);
          }
        }, function (err, data) {
          if (err) {
            self.emit("error", err);
            return reject(err);
          } else {
            let file = data.data;
            self.emit("done", file);
            if(options.share) {
              share(drive, file.id, options.share).then(result => {
                console.error("Share result:", result);
              }).catch(err => {
                console.error('Share error:',err);
              });
            }
            return resolve(file);
          }
        }
      );
    });
    return promise;
  }
}

module.exports = {
  Upload,
  client: client.oAuth2Client
};
