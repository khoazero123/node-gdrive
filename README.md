# node-gdrive

Upload file to google drive

## Installation

With [npm](https://www.npmjs.com/) do:

```sh
npm install node-gdrive
```

Use command line global:

```sh
npm install node-gdrive -g
```

## Config

```sh
gdrive token:get # generator new token
```

## Usage

### Node project

```js
const Drive = require("node-gdrive");

// Get token 
const drive = new Drive();
const authUrl = drive.generateAuthUrl();
console.log(`Please go to ${authUrl}`);

var code = '4/1ARtbsJpwJLAnoUT2stmrXABWcmzdvnuF6j_mV3f_ELNQcOrzyqgVz1j0o04';
var token = await drive.reedemCode(code);

// upload file
let filePath = 'foo.txt';

var upload = drive.upload(filePath, {share: true});
upload.on('*', (event, data) => {
  console.log(event, data);
});

// Download file
let fileId = "1eoAgH8xgBkkUDXkTdyPSHSbaJViv33oX";

drive
  .download(fileId, {
    resumable: true, // Resume download session
    force: false, // Override file if exists
    output: './tmp/', // Dir or filepath to save file
  })
  .then(file => {
    console.log("file", file);
  })
  .catch(err => {
    console.error("err", err);
  });

```

#### Commands line

``` sh
gdrive upload file.txt --share user@gmail.com # upload and share file

gdrive donwload 1eoAgH8xgBkkUDXkTdyPSHSbaJViv33oX # download file

gdrive --help
```

## License

MIT
