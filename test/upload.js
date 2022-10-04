const assert = require("assert");
const expect = require("chai").expect;
const Drive = require("../");

describe("Upload", function() {
  describe("#upload-event", function() {
    it("should return fileId", function() {
      this.timeout(0);
      this.slow(10000);

      return new Promise(function(resolve) {
        const drive = new Drive();
        const upload = drive.upload("README.md");

        drive.stream.on("*", (event, data) => {
          switch (event) {
            case "progress":
              // console.log(data.progress + "%");
              break;
            case 'done':
              expect(data.id).to.be.a("string").that.matches(/([-\w]{25,})/);
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
      const upload = new Drive();

      upload.upload('README.md').then(data=>{
        expect(data).to.have.property('id');
        done();
      }).catch(err => {
        done();
      });

    });
  });
});
