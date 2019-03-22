
const { Upload, client } = require("../lib/upload");


const filePath = process.argv[2] || 'README.md';

var upload = new Upload(filePath);
// upload.then(file => console.log).catch(console.error);
upload.on('*', (event, data) => {
  console.log(event, data)
});