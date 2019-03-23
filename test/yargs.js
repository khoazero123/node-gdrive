require("yargs")
  .command({
    command: "configure <key> [value]",
    aliases: ["config", "cfg"],
    desc: "Set a config variable",
    builder: yargs => yargs.default("value", "true"),
    handler: argv => {
      console.log(`setting ${argv.key} to ${argv.value}`);
    }
  })
  // provide a minimum demand and a minimum demand message
  .demandCommand(1, "You need at least one command before moving on")
  .help().argv;
