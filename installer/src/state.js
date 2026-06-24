var fs = require('fs');
var path = require('path');

var ALLOWED_ARTIFACTS = ['vpsId', 'ip', 'publicUrl'];

function fileFor(dir, installId) { return path.join(dir, installId + '.json'); }

function createState(opts) {
  return {
    installId: opts.installId,
    provider: opts.provider,
    dir: opts.dir,
    steps: {},
    artifacts: {}
  };
}

function persist(state) {
  fs.mkdirSync(state.dir, { recursive: true });
  var out = {
    installId: state.installId,
    provider: state.provider,
    steps: state.steps,
    artifacts: state.artifacts
  };
  fs.writeFileSync(fileFor(state.dir, state.installId), JSON.stringify(out, null, 2));
}

function loadState(opts) {
  var f = fileFor(opts.dir, opts.installId);
  if (!fs.existsSync(f)) return null;
  var data = JSON.parse(fs.readFileSync(f, 'utf8'));
  data.dir = opts.dir;
  return data;
}

function markStep(state, stepName, artifacts) {
  // Whitelist artifacts so secrets can never leak into state.
  Object.keys(artifacts || {}).forEach(function (k) {
    if (ALLOWED_ARTIFACTS.indexOf(k) !== -1) state.artifacts[k] = artifacts[k];
  });
  state.steps[stepName] = { done: true, at: new Date().toISOString() };
  persist(state);
  return state;
}

function isDone(state, stepName) {
  return !!(state.steps[stepName] && state.steps[stepName].done);
}

module.exports = {
  createState: createState,
  loadState: loadState,
  markStep: markStep,
  isDone: isDone
};
