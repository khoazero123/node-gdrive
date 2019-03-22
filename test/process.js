const readline = require("readline");

/* ... */

function waitingPercent(p) {
  readline.clearLine(process.stdout, 0);
  readline.cursorTo(process.stdout, 0);
  let text = `waiting ... ${p}%`;
  process.stdout.write(text);
}

for (let index = 0; index < 100; index++) {
  waitingPercent(index);
  
}