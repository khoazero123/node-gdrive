
const { Download} = require("../");


const fileId = process.argv[2] || "1eoAgH8xgBkkUDXkTdyPSHSbaJViv33oX";

var download = new Download();
download
  .download(fileId)
  .then(file => {
    console.log("file", file);
  })
  .catch(err => {
    console.error("err", err);
  });
