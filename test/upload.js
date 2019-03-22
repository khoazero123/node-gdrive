
const { Upload} = require("../");


const filePath = process.argv[2] || 'README.md';

var upload = new Upload(filePath);
upload.on('*', (event, data) => {
  console.log(event, data);
});

/* var upload = new Upload();
upload.upload(filePath).then((file) => {
  console.log('file', file);
}).catch((err) => {
  console.error('err', err);}
); */
