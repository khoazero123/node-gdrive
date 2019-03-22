
const { google } = require("googleapis");
const readline = require("readline");
const md5 = require("md5");
const http = require("http");
const url = require("url");
const opn = require("opn");
const destroyer = require("server-destroy");
const fs = require("fs");
const path = require("path");

const keyPath = path.join(__dirname, "oauth2.keys.json");

let keys = {
  redirect_uris: [
    "urn:ietf:wg:oauth:2.0:oob",
    "http://localhost:3000/oauth2callback"
  ]
};
if (fs.existsSync(keyPath)) {
  const keyFile = require(keyPath);
  keys = keyFile.installed || keyFile.web;
}

const invalidRedirectUri = `The provided keyfile does not define a valid
redirect URI. There must be at least one redirect URI defined, and this sample
assumes it redirects to 'http://localhost:3000/oauth2callback'.  Please edit
your keyfile, and add a 'redirect_uris' section.  For example:

"redirect_uris": [
  "http://localhost:3000/oauth2callback"
]
`;

class SampleClient {
  constructor(options) {
    this._options = options || { scopes: [] };

    // validate the redirectUri.  This is a frequent cause of confusion.
    if (!keys.redirect_uris || keys.redirect_uris.length === 0) {
      throw new Error(invalidRedirectUri);
    }
    // const redirectUri = keys.redirect_uris[keys.redirect_uris.length - 1]; // redirect
    this.redirectUri = keys.redirect_uris[0];
    const parts = new url.URL(this.redirectUri);
    if (
      this.redirectUri.length === 0
      // || parts.port !== '3000'
      // || parts.hostname !== 'localhost'
      // || parts.pathname !== '/oauth2callback'
    ) {
      throw new Error(invalidRedirectUri);
    }

    // create an oAuth client to authorize the API call
    this.oAuth2Client = new google.auth.OAuth2(
      keys.client_id,
      keys.client_secret,
      this.redirectUri
    );
  }

  // Open an http server to accept the oauth callback. In this
  // simple example, the only request to our webserver is to
  // /oauth2callback?code=<code>
  async authenticate(scopes = []) {
    return new Promise((resolve, reject) => {
      var tokenPath = path.join(__dirname, md5(scopes.join(",")) + ".json");
      var fileContents;
      try {
        fileContents = fs.readFileSync(tokenPath, "utf8");
        this.oAuth2Client.setCredentials(JSON.parse(fileContents));
        return resolve(this.oAuth2Client);
      } catch (err) {}

      this.authorizeUrl = this.oAuth2Client.generateAuthUrl({
        access_type: "offline",
        scope: scopes.join(" ")
      });

      if (this.redirectUri == "urn:ietf:wg:oauth:2.0:oob") {
        console.log(
          "Authorize this app by visiting this url:",
          this.authorizeUrl
        );
        const rl = readline.createInterface({
          input: process.stdin,
          output: process.stdout
        });
        rl.question("Enter the code from that page here: ", code => {
          rl.close();
          this.oAuth2Client.getToken(code, (err, token) => {
            if (err) return console.error("Error retrieving access token", err);
            this.oAuth2Client.setCredentials(token);
            // Store the token to disk for later program executions
            fs.writeFile(tokenPath, JSON.stringify(token), err => {
              if (err) return console.error(err);
              console.log("Token stored to", tokenPath);
            });
            resolve(this.oAuth2Client);
          });
        });
      } else {
        // grab the url that will be used for authorization
        const server = http
          .createServer(async (req, res) => {
            try {
              if (req.url.indexOf("/oauth2callback") > -1) {
                const qs = new url.URL(req.url, "http://localhost:3000")
                  .searchParams;
                res.end(
                  "Authentication successful! Please return to the console."
                );
                server.destroy();
                const { tokens } = await this.oAuth2Client.getToken(
                  qs.get("code")
                );
                this.oAuth2Client.credentials = tokens;
                fs.writeFile(tokenPath, JSON.stringify(tokens), err => {
                  if (err) return console.error(err);
                  console.log("Token stored to", tokenPath);
                });
                resolve(this.oAuth2Client);
              }
            } catch (e) {
              reject(e);
            }
          })
          .listen(3000, () => {
            // open the browser to the authorize url to start the workflow
            opn(this.authorizeUrl, { wait: false }).then(cp => cp.unref());
          });
        destroyer(server);
      }
    });
  }
}

module.exports = new SampleClient();
