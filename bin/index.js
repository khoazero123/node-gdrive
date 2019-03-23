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
        /* .demandOption(
          "file",
          chalk.red("!") + warning("Please provide filepath")
        ) */
        .check(function(argv) {
          var filePath = argv.file || argv._[1];
          if (!filePath) {
            throw new Error(error("Please provide filepath!"));
          }
          return true;
        })
        .positional("share", {
          alias: "share",
          describe: chalk.gray("Share to 'everyone' or an email address"),
          type: "string"
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
      // console.log(filePath);process.exit(1);
      var filePath = argv.file || argv._[1];
      new Upload(filePath, {
        cli: true,
        stdout: true,
        share: argv.hasOwnProperty("share") ? (argv.share ? argv.share : true) : false,
        delete: argv.hasOwnProperty("delete") ? (argv.delete ? true : false) : false
      });
    }
  )
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
        .positional("r", {
          alias: "resumable",
          type: "boolean",
          describe: info("Resume download"),
          default: true
        })
        .positional("f", {
          alias: "force",
          type: "boolean",
          describe: info("Override file if exists")
        })
        .positional("o", {
          alias: "output",
          type: "string",
          describe: info("Path to save file")
        })
        // .demandOption("id", chalk.red("!") + warning("Please provide fileId"));
        .check(function(argv) {
          var fileId = argv.id || argv._[1];
          if (!fileId) {
            throw new Error(error("Please provide fileId!"));
          }
          return true;
        });
    },
    function(argv) {
      var fileId = argv.id || argv._[1];
      // console.log(argv);process.exit(1);
      var download = new Download();
      download
        .download(fileId, {
          resumable: argv.resumable,
          force: argv.force,
          output: argv.output
        })
        .then(data => {
          // console.log(data);
        })
        .catch(err => {
          console.error(err.message);
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