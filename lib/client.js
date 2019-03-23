const chalk = require("chalk");
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
const tokendir = path.join(homedir, ".gdrive");

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
    this.options = Object.assign(
      {},
      {
        auth_type: "cli", // cli | web
        scopes: [],
        client: {
          client_id:
            process.env.GDRIVE_CLIENT_ID ||
            "137307177884-vg7uu3vuaptihnfadkch6so8p5k2ovr7.apps.googleusercontent.com",
          project_id: process.env.GDRIVE_PROJECT_ID || "gdrive-170107",
          client_secret:
            process.env.GDRIVE_CLIENT_SECRET || "RluDC9VpCL6aXIRzVHgBUbTy",
          redirect_uris: process.env.GDRIVE_REDIRECT_URIS || [
            "urn:ietf:wg:oauth:2.0:oob",
            "http://localhost:8885/oauth2callback"
          ],
          auth_uri: "https://accounts.google.com/o/oauth2/auth",
          token_uri: "https://oauth2.googleapis.com/token",
          auth_provider_x509_cert_url:
            "https://www.googleapis.com/oauth2/v1/certs"
        },
        credentials_path: path.join(tokendir, "oauth2.keys.json"),
        token_path: path.join(tokendir, "oauth2.token.json"),
        server_port: 8885
      },
      options
    );

    if (!fs.existsSync(tokendir)) {
      fs.mkdirSync(tokendir);
    }
    let isCredentialsExists = fs.existsSync(this.options.credentials_path);
    let keys = {};
    if (this.options.client && this.options.client.client_id) {
      keys = this.options.client;
    } else if (isCredentialsExists) {
      let keyFile = require(this.options.credentials_path);
      keys = keyFile.installed || keyFile.web;
    } else {
      fs.writeFile(
        this.options.credentials_path,
        JSON.stringify({installed: this.options.client}),
        function(err) {}
      ); 
      throw new Error(
        "Please config credentials file at: " +
          chalk.bold.red(this.options.credentials_path)
      );
    }
    if(!isCredentialsExists) {
      fs.writeFile(
        this.options.credentials_path,
        JSON.stringify({ installed: this.options.client }),
        function(err) {}
      ); 
    }

    // validate the redirectUri.  This is a frequent cause of confusion.
    if (!keys.redirect_uris || keys.redirect_uris.length === 0) {
      throw new Error(invalidRedirectUri);
    }

    this.redirectUri = this.options.auth_type == "cli" ? "urn:ietf:wg:oauth:2.0:oob" : keys.redirect_uris[keys.redirect_uris.length - 1];
    const parts = new url.URL(this.redirectUri);
    if (this.redirectUri.length === 0) {
      throw new Error(invalidRedirectUri);
    }

    // create an oAuth client to authorize the API call
    this.oAuth2Client = new google.auth.OAuth2(
      keys.client_id,
      keys.client_secret,
      this.redirectUri
    );
    try {
      let tokens = fs.readFileSync(this.options.token_path, "utf8");
      this.oAuth2Client.setCredentials(JSON.parse(tokens));
    } catch (err) {}
  }

  // Open an http server to accept the oauth callback. In this
  // simple example, the only request to our webserver is to
  // /oauth2callback?code=<code>
  async authenticate(scopes = [], options = {force: false}) {
    return new Promise((resolve, reject) => {
      var tokenPath = this.options.token_path;
      // var tokenPath = path.join(tokendir, 'oauth2.token.' + md5(scopes.join(",")) + ".json");
      if(!options.force) {
        let fileContents;
        try {
          fileContents = fs.readFileSync(tokenPath, "utf8");
          this.oAuth2Client.setCredentials(JSON.parse(fileContents));
          // let isTokenExpiring = this.oAuth2Client.isTokenExpiring();
          return resolve(this.oAuth2Client);
        } catch (err) {}
      }

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
        process.stdout.write(`Opening web browser to auth...\n`);
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
