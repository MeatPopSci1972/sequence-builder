// sequence-builder.test-runner.js -- Sequence Builder test runner
// Requires the test array from sequence-builder.test.js and executes all tests.
// Usage: node sequence-builder.test-runner.js
'use strict'

const _tests = require('./sequence-builder.test.js')
;(function runAll() {
  var groups = [], groupMap = {}
  for (var i = 0; i < _tests.length; i++) {
    var tt = _tests[i], g = tt.group || "Tests"
    if (!groupMap[g]) { groupMap[g] = []; groups.push(g) }
    groupMap[g].push(tt)
  }
  var passed = 0, failed = 0
  for (var gi = 0; gi < groups.length; gi++) {
    var gn = groups[gi], gt = groupMap[gn]
    console.log("\n" + gn)
    for (var ti = 0; ti < gt.length; ti++) {
      var tt = gt[ti]
      try { tt.fn(); console.log("  ✓  " + tt.desc); passed++ }
      catch(e) { console.log("  ✗  " + tt.desc); console.log("       " + e.message); failed++ }
    }
  }
  var total = passed + failed
  console.log("\n" + "──────────────────────────────────────────────────")

  console.log("  " + passed + " passed  |  " + failed + " failed  |  " + total + " total")
  console.log("──────────────────────────────────────────────────" + "\n")
  if (failed > 0) { console.log("  Gate failed."); process.exit(1) }
  console.log("  All tests pass. Gate green."); process.exit(0)
})()

