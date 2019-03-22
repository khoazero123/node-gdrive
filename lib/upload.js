const fs = require("fs");
const readline = require("readline");
const path = require("path");
const { google } = require("googleapis");
const sampleClient = require("../sampleclient");

const drive = google.drive({
  version: "v3",
  auth: sampleClient.oAuth2Client
});

async function runSample(filePath, meta = {}) {
  const fileSize = fs.statSync(filePath).size;

  var requestBody = {
    name: meta.name || path.basename(filePath)
  };
  if (meta.folderId) {
    requestBody.parents = [meta.folderId];
  }
  const res = await drive.files.create(
    {
      requestBody: requestBody,
      media: {
        body: fs.createReadStream(filePath)
      }
    },
    {
      // Use the `onUploadProgress` event from Axios to track the
      // number of bytes uploaded to this point.
      onUploadProgress: evt => {
        const progress = (evt.bytesRead / fileSize) * 100;
        readline.clearLine();
        readline.cursorTo(0);
        process.stdout.write(`${Math.round(progress)}% complete\n`);
      }
    }
  );
  console.log(res.data);
  return res.data;
}

// if invoked directly (not tests), authenticate and run the samples
if (module === require.main) {
  const filePath = process.argv[2];
  const scopes = ["https://www.googleapis.com/auth/drive.file"];
  sampleClient
    .authenticate(scopes)
    .then(() =>
      runSample(filePath, { folderId: "" })
    )
    .catch(console.error);
}

// export functions for testing purposes
module.exports = {
  runSample,
  client: sampleClient.oAuth2Client
};
