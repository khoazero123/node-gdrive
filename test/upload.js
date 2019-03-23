
const { Upload } = require("../");


const filePath = process.argv[2] || 'README.md';

var upload = new Upload(filePath, {share: true});
upload.on('*', (event, data) => {
  console.log(event, data);
});

/* var upload = new Upload(null, { cli: true, stdout: true });
upload.upload(filePath).then((file) => {
  console.log('file', file);
}).catch((err) => {
  console.error('err', err);}
);
 */