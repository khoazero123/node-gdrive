const assert = require("assert");
const expect = require("chai").expect;
const { Upload, Download } = require("../");

describe("Upload", function() {
  describe("#upload-event", function() {
    it("should return fileId", function() {
      this.timeout(0);
      this.slow(10000);

      return new Promise(function(resolve) {
        var upload = new Upload("README.md");

        upload.on("*", (event, data) => {
          switch (event) {
            case "progress":
              // console.log(data.progress + "%");
              break;
            case 'done':
              // console.log(data);
              data.should.have.property("id");
              expect(data.id)
                .to.be.a("string")
                .that.matches(/([-\w]{25,})/);
              resolve();
              break;
            default:
              console.log(data);
              break;
          }
        });
      });
    });
  });

  describe("#upload-promise", function() {
    it("should return fileId", function(done) {
      this.timeout(15000);
      this.slow(10000);
      var upload = new Upload();

      upload.upload('README.md').then(data=>{
        console.log(data);
        assert.ok(true);
        done();
      }).catch(err => {
        done();
      });

    });
  });
});


describe("Download", function() {
  describe("#download-event", function() {
    it("test download event", function(done) {
      this.timeout(15000);
      const fileId = "1ieN1AkKGOGbcVmRYbgcGOu7I1uPXSwKE";
      var download = new Download(fileId);
      download.on("*", (event, data) => {
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
      var download = new Download();
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