const assert = require("assert");
const expect = require("chai").expect;
const Drive = require("../src");

describe("Download", function() {
  describe("#download-event", function() {
    it("test download event", function(done) {
      this.timeout(15000);
      const drive = new Drive();
      const fileId = "1ieN1AkKGOGbcVmRYbgcGOu7I1uPXSwKE";
      const download = drive.download(fileId);
      drive.stream.on("*", (event, data) => {
        switch (event) {
          case "progress":
            console.log(event, data.progress + "%");
            break;
          case "done":
            console.log(event, data);
            done()
            break;
          default:
            console.log(event, data);
            break;
        }
      });
    });
  });

  describe("#download-promise", function() {
    it("test download promise", function(done) {
      this.timeout(15000);
      const fileId = "1ieN1AkKGOGbcVmRYbgcGOu7I1uPXSwKE";
      const download = new Drive();
      download
        .download(fileId, {randomFileName: true})
        .then(file => {
          console.log("file", file);
          assert.ok(true);
          done();
        })
        .catch(err => {
          console.error("err", err);
          done();
        });
    });
  });
});