
const { google } = require("googleapis");
const readline = require("readline");
const md5 = require("md5");
const http = require("http");
const url = require("url");
const opn = require("opn");
const destroyer = require("server-destroy");
const fs = require("fs");
const path = require("path");
const homedir = require("os").homedir();

const invalidRedirectUri = `The provided keyfile does not define a valid
redirect URI. There must be at least one redirect URI defined, and this sample
assumes it redirects to 'http://localhost:3000/oauth2callback'.  Please edit
your keyfile, and add a 'redirect_uris' section.  For example:

"redirect_uris": [
  "http://localhost:3000/oauth2callback"
]
`;

class Client {
  constructor(options) {
    this.options = Object.assign({}, {
      auth_type: 'cli', // cli | web
      scopes: [],
      client: {
        "client_id": "",
        "project_id": "",
        "client_secret": "",
        "redirect_uris": []
      },
      credentials_path: path.join(homedir, 'oauth2.keys.json'),
      token_path: path.join(homedir, 'oauth2.token.json'),
      server_port: 3009
    }, options);

    let keys = {};
    if (this.options.client && this.options.client.client_id) {
      keys = this.options.client;
    } else if (fs.existsSync(this.options.credentials_path)) {
      let keyFile = require(this.options.credentials_path);
      keys = keyFile.installed || keyFile.web;
    } else {
      throw new Error("Please config credentials file: " + this.options.credentials_path);
    }

    // validate the redirectUri.  This is a frequent cause of confusion.
    if (!keys.redirect_uris || keys.redirect_uris.length === 0) {
      throw new Error(invalidRedirectUri);
    }

    this.redirectUri = this.options.auth_type == "cli" ? "urn:ietf:wg:oauth:2.0:oob" : keys.redirect_uris[keys.redirect_uris.length - 1];
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
      var tokenPath = this.options.token_path; // path.join(__dirname, md5(scopes.join(",")) + ".json");
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
                const qs = new url.URL(req.url, "http://localhost:" + this.options.server_port).searchParams;
                res.end("Authentication successful! Please return to the console.");
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
          .listen(this.options.server_port, () => {
            // open the browser to the authorize url to start the workflow
            opn(this.authorizeUrl, { wait: false }).then(cp => cp.unref());
          });
        destroyer(server);
      }
    });
  }
}

// module.exports = new Client();
module.exports = Client;
