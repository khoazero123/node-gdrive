const async = require("async");

module.exports = function share(drive, fileId, permissions = [{ type: "anyone", role: "reader" }]) {
  return new Promise((resolve, reject) => {
    /* var permissions = [{
        type: "user",
        role: "writer",
        emailAddress: "user@example.com"
      }, {
        type: "domain",
        role: "writer",
        domain: "example.com"
      }]; */
    if(!permissions || permissions === true) {
      permissions = [{ type: "anyone", role: "reader" }];
    } else if(typeof permissions == 'string') {
      permissions = [{
        type: "user",
        role: "reader",
        emailAddress: permissions // is email address
      }];
    }

    async.eachSeries(
      permissions,
      function(permission, permissionCallback) {
        drive.permissions.create({
            resource: permission,
            fileId: fileId,
            fields: "id"
          }, function(err, res) { // res = null
            if (err) {
              permissionCallback(err);
            } else {
              permissionCallback();
            }
          }
        );
      },
      function(err) {
        if (err) {
          return reject(err);
        } else {
          return resolve(permissions);
        }
      }
    );
  });
}