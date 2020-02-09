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

const homedir = require('os').homedir();

const credentialsPath = path.join(homedir, '.googleAuth');
if (!fs.existsSync(credentialsPath)) fs.mkdirSync(credentialsPath);

class Client {
  constructor(options) {
    this.google = google;
    this.client = this;
    var defaultOptions = {
      auth_type: "cli", // cli | browser
      scopes: [
        "https://www.googleapis.com/auth/drive",
      ],
      client: {
        client_id:
          process.env.GDRIVE_CLIENT_ID ||
          "137307177884-vg7uu3vuaptihnfadkch6so8p5k2ovr7.apps.googleusercontent.com",
        project_id: process.env.GDRIVE_PROJECT_ID || "gdrive-170107",
        client_secret:
          process.env.GDRIVE_CLIENT_SECRET || "RluDC9VpCL6aXIRzVHgBUbTy",
        redirect_uris: process.env.GDRIVE_REDIRECT_URIS || [
          "urn:ietf:wg:oauth:2.0:oob",
        ],
        auth_uri: "https://accounts.google.com/o/oauth2/auth",
        token_uri: "https://oauth2.googleapis.com/token",
        auth_provider_x509_cert_url:
          "https://www.googleapis.com/oauth2/v1/certs"
      },
      credentials_path: path.join(credentialsPath, "oauth2.keys.json"),
      token_path: path.join(credentialsPath, "oauth2.token.json"),
      server_port: 8885
    };
    this.options = Object.assign({}, defaultOptions, options);
    // console.log(this.options);process.exit(1);
    if (!fs.existsSync(credentialsPath)) {
      fs.mkdirSync(credentialsPath);
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

    // create an oAuth client to authorize the API call
    this.oAuth2Client = new google.auth.OAuth2(
      keys.client_id,
      keys.client_secret,
      "urn:ietf:wg:oauth:2.0:oob"
    );

    try {
      let tokens = fs.readFileSync(this.options.token_path, "utf8");
      this.oAuth2Client.setCredentials(JSON.parse(tokens));
    } catch (err) {}
  }

  // Open an http server to accept the oauth callback. In this
  // simple example, the only request to our webserver is to
  // /oauth2callback?code=<code>
  async authenticate(options = {force: false}) {
    return new Promise((resolve, reject) => {
      // console.log(this.options);process.exit(1);
      this.options = Object.assign({}, this.options, options);
      let scopes = this.options.scopes;
      
      var tokenPath = this.options.token_path;
      // var tokenPath = path.join(credentialsPath, 'oauth2.token.' + md5(scopes.join(",")) + ".json");
      if(!options.force) {
        let fileContents;
        try {
          fileContents = fs.readFileSync(tokenPath, "utf8");
          this.oAuth2Client.setCredentials(JSON.parse(fileContents));
          if(this.oAuth2Client.isTokenExpiring()) {
            this.oAuth2Client.refreshAccessTokenAsync();
          }
          return resolve(this.oAuth2Client);
        } catch (err) {}
      }

      this.authorizeUrl = this.oAuth2Client.generateAuthUrl({
        access_type: "offline",
        scope: scopes.join(" ")
      });

      if (this.options.auth_type !== 'browser') {
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
                const { code } = url.parse(req.url, true).query;
                res.end("Authentication successful! Please return to the console.");
                server.destroy();
                const { tokens } = await this.oAuth2Client.getToken(code);
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
          .listen(0, () => {
            const port = server.address().port;
            const redirectUri = `http://localhost:${port}/oauth2callback`;
            this.oAuth2Client = new google.auth.OAuth2(
              keys.client_id,
              keys.client_secret,
              redirectUri
            );
            const authorizeUrl = this.oAuth2Client.generateAuthUrl({
              access_type: 'offline',
              scope: scopes.join(' '),
            });
            // open the browser to the authorize url to start the workflow
            opn(authorizeUrl, {wait: false}).then(cp => cp.unref());
          });
        destroyer(server);
      }
    });
  }
}

// module.exports = new Client();
module.exports = Client;
