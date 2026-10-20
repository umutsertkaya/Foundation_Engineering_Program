/** Run a repository tool with an existing Python, including from a Git worktree. */
const fs = require('node:fs');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');

function candidates(root = ROOT) {
  const roots = [root];
  const common = spawnSync('git', ['rev-parse', '--path-format=absolute', '--git-common-dir'], {
    cwd: root, encoding: 'utf8', windowsHide: true, shell: false,
  });
  if (common.status === 0 && common.stdout.trim()) {
    roots.push(path.dirname(path.resolve(root, common.stdout.trim())));
  }
  const result = [];
  for (const base of new Set(roots)) {
    for (const rel of ['.venv/Scripts/python.exe', '.venv/bin/python']) {
      const exe = path.join(base, rel);
      if (fs.existsSync(exe)) result.push([exe]);
    }
  }
  result.push(['python3'], ['python'], ['py', '-3']);
  return result;
}

function findPython(root = ROOT) {
  for (const command of candidates(root)) {
    const probe = spawnSync(command[0], [...command.slice(1), '-c', 'import sys; sys.exit(sys.version_info < (3, 11))'], {
      cwd: root, stdio: 'ignore', windowsHide: true, shell: false, timeout: 5000,
    });
    if (probe.status === 0) return command;
  }
  throw new Error('Python >=3.11 is unavailable. Use an existing project .venv or install Python in the selected environment. Nothing was installed.');
}

function main(args = process.argv.slice(2)) {
  if (!args.length) {
    process.stderr.write('Usage: node tools/run_python.cjs tools/<script>.py [arguments]\n');
    return 2;
  }
  const script = path.resolve(ROOT, args[0]);
  if (!script.startsWith(path.join(ROOT, 'tools') + path.sep) || !script.endsWith('.py') || !fs.existsSync(script)) {
    process.stderr.write('Expected an existing Python script inside this repository tools/ directory.\n');
    return 2;
  }
  let python;
  try { python = findPython(); }
  catch (error) { process.stderr.write(error.message + '\n'); return 2; }
  const child = spawn(python[0], [...python.slice(1), script, ...args.slice(1)], {
    cwd: ROOT, shell: false, stdio: 'inherit', windowsHide: true,
    env: { ...process.env, PYTHONUTF8: '1', PYTHONIOENCODING: 'utf-8' },
  });
  child.on('error', error => { process.stderr.write(`Cannot start Python: ${error.message}\n`); process.exitCode = 2; });
  child.on('exit', (code, signal) => { process.exitCode = code ?? (signal ? 1 : 0); });
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
  return undefined;
}

module.exports = { candidates, findPython, main };
if (require.main === module) {
  const code = main();
  if (code !== undefined) process.exitCode = code;
}
