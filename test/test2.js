const { Upload, Download } = require("../");
var upload = new Upload("README.md", {share: 'khoazero123@gmail.com'});

        upload.on("*", (event, data) => {
          console.log({event, data});
        });
