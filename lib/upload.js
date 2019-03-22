const fs = require("fs");
const streamify = require("streamify");
const readline = require("readline");
const path = require("path");
const { google } = require("googleapis");
const Client = require("./client");
const client = new Client();

const drive = google.drive({
  version: "v3",
  auth: client.oAuth2Client
});
class Upload {
  constructor(filePath, meta = {}) {
    this.stream = streamify();
    const scopes = ["https://www.googleapis.com/auth/drive.file"];
    client.authenticate(scopes).then(() => {
      this.stream.resolve(this.upload(filePath, meta));
      // return this.upload(filePath, meta);
    }).catch(console.error);
    return this.stream;
  }

  emit(event, data = null) {
    this.stream.emit(event, data);
    if (event !== "error") {
      this.stream.emit("*", event, data);
    }
  }

  upload(filePath, meta = {}) {
    var self = this;
    var promise = new Promise((resolve, reject) => {
      const fileSize = fs.statSync(filePath).size;

      var requestBody = {
        name: meta.name || path.basename(filePath)
      };
      if (meta.folderId) {
        requestBody.parents = [meta.folderId];
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
            return resolve(file);
          }
        }
      );
    });
    this.stream.resolve(promise);
    return this.stream;
  }
}

module.exports = {
  Upload,
  client: client.oAuth2Client
};
