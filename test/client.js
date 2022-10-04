const assert = require("assert");
const expect = require("chai").expect;
const Drive = require("../");

describe("Drive", function() {
  describe("#generateAuthUrl", function() {
    it("should return authUrl", function() {

      var client = new Drive();

      const authUrl = client.generateAuthUrl();
      expect(authUrl).to.be.a('string');
    });
  });

  describe("#reedemCode", function() {
    it("should return error", function(done) {
      this.timeout(15000);
      this.slow(10000);
      var code = '4/1ARtbsJpwJLAnoUT2stmrXABWcmzdvnuF6j_mV3f_ELNQcOrzyqgVz1j0o04';

      var client = new Drive();
      client.reedemCode(code).then(() => {
        assert.ok(false);
      }).catch((err) => {
        expect(err.message).to.equal('invalid_grant');
        done();
      });
    });
  });
});
