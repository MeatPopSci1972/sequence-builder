// launcher.js -- SequenceForge hot-reload wrapper
// Usage: node launcher.js  (instead of node sf-server.js)
// Watches sf-server.js for changes and auto-restarts the server.
// Zero dependencies -- uses only Node built-ins.

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const SERVER = path.join(__dirname, 'sf-server.js');
let child = null;
let restarting = false;

function start() {
  child = spawn('node', ['sf-server.js'], {
    cwd: __dirname,
    stdio: 'inherit'
  });
  child.on('exit', function(code) {
    if (!restarting) {
      console.log('[launcher] server exited with code ' + code + ', restarting...');
      setTimeout(start, 500);
    }
  });
  console.log('[launcher] server started (pid ' + child.pid + ')');
}

function restart() {
  if (restarting) return;
  restarting = true;
  console.log('[launcher] sf-server.js changed -- restarting...');
  child.kill();
  setTimeout(function() {
    restarting = false;
    start();
  }, 300);
}

// Watch sf-server.js for changes
fs.watch(SERVER, function(event) {
  if (event === 'change') restart();
});

console.log('[launcher] watching sf-server.js for changes');
start();
