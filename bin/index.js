#!/usr/bin/env node

const chalk = require("chalk");
const error = chalk.bold.red;
const warning = chalk.keyword("orange");
const info = chalk.keyword("gray");
const { Client, Upload, Download } = require("../");

var argv = require("yargs")
  .scriptName("gdrive")
  .usage("$0 <cmd> [args]")
  .command(
    "upload",
    chalk.blue("Upload file"),
    yargs => {
      yargs
        .positional("f", {
          alias: "file",
          type: "string",
          describe: chalk.gray("File path to upload")
        })
        .demandOption(
          "file",
          chalk.red("!") + warning("Please provide filepath")
        )
        .positional("share", {
          alias: "share",
          describe: chalk.gray("Share to 'everyone' or an email address"),
          type: "string",
        })
        .positional("del", {
          alias: "delete",
          describe: chalk.gray("Delete file after upload"),
          type: "boolean",
          default: false
        });
      yargs.example(
        "$0 upload -f foo.js --share khoazero123@gmail.com --delele",
        chalk.gray(
          "Upload foo.js and share to everone then delete file on local"
        )
      );
    },
    function(argv) {
      new Upload(argv.file, {
        cli: true,
        stdout: true,
        share: argv.hasOwnProperty("share") ? (argv.share ? argv.share : true) : false,
        delete: argv.hasOwnProperty("delete") ? (argv.delete ? true : false) : false
      });
    }
  )
  // .example("$0 upload -f foo.js", "upload file foo.js")
  .command(
    "download",
    chalk.blue("Download file"),
    yargs => {
      yargs
        .positional("id", {
          alias: "fileId",
          type: "string",
          describe: info("FileId to download")
        })
        .demandOption("id", chalk.red("!") + warning("Please provide fileId"));
    },
    function(argv) {
      // console.log(argv);
      var fileId = argv.id;
      var download = new Download();
      download.download(fileId).then(data => {
        // console.log(data);
      }).catch(err => {
        // console.error(err);
      });
    }
  )
  .command(
    "token:get",
    chalk.blue("Get token"),
    function(argv) {
      var client = new Client({auth_type: 'cli'});
      const scopes = [
        "https://www.googleapis.com/auth/drive",
        "https://www.googleapis.com/auth/drive.appdata",
        "https://www.googleapis.com/auth/drive.file",
        "https://www.googleapis.com/auth/drive.metadata",
        "https://www.googleapis.com/auth/drive.metadata.readonly",
        "https://www.googleapis.com/auth/drive.photos.readonly",
        "https://www.googleapis.com/auth/drive.readonly"
      ];
      client.authenticate(scopes, { force: true });
    }
  )
  .demandCommand(
    1,
    chalk.red("!") + warning("You need at least one command before moving on")
  )
  .help("h")
  .alias("h", "help")
  .epilog(chalk.blue("Copyright 2019 - khoazero123")).argv;

function main() {
  
}