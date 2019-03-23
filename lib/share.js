const async = require("async");
const { google } = require("googleapis");
const Client = require("./client");

class Share extends Client {
  constructor(options={permissions: [{ type: "anyone", role: "reader" }]}) {
    super();
    this.options = Object.assign({}, this.options, options);
    this.drive = google.drive({
      version: "v3",
      auth: this.client.oAuth2Client
    });

    this.client.authenticate().then(() => {
      let fileId = options.fileId || options.id;
      if (fileId) {
        return this.share(fileId, options.permissions);
      }
    }).catch(console.error);
  }
  
  share(fileId, permissions = [{ type: "anyone", role: "reader" }]) {
    const self = this;
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
          self.drive.permissions.create(
            {
              resource: permission,
              fileId: fileId,
              fields: "id"
            },
            function(err, res) {
              // res = null
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
}
module.exports = Share;
