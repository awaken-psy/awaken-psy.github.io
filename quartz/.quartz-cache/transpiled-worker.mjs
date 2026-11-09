var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });
var __esm = (fn, res, err) => function __init() {
  if (err) throw err[0];
  try {
    return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
  } catch (e) {
    throw err = [e], e;
  }
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// quartz/cfg.ts
var SIDEBAR_MODES;
var init_cfg = __esm({
  "quartz/cfg.ts"() {
    "use strict";
    SIDEBAR_MODES = ["fit", "scroll", "static"];
  }
});

// quartz/cli/subprocess.js
import { execFile, execFileSync } from "node:child_process";
import { promisify } from "node:util";
function assertCommit(commit) {
  if (typeof commit !== "string" || !/^[0-9a-f]{7,64}$/i.test(commit)) {
    throw new Error(`Invalid commit ${JSON.stringify(commit)}: expected a hexadecimal SHA`);
  }
  return commit;
}
function assertRef(ref) {
  const invalid = typeof ref !== "string" || ref === "" || ref === "@" || ref.startsWith("-") || ref.startsWith("/") || /[\s\x00-\x1f\x7f~^:?*[\\]/.test(ref) || ref.includes("..") || ref.includes("@{") || ref.includes("//") || /(^|\/)\./.test(ref) || /[/.]$/.test(ref) || ref.endsWith(".lock");
  if (invalid) throw new Error(`Invalid git ref ${JSON.stringify(ref)}`);
  return ref;
}
function assertRepoUrl(url2) {
  if (typeof url2 !== "string" || url2 === "" || url2.startsWith("-") || /[\x00-\x1f\x7f]/.test(url2)) {
    throw new Error(`Invalid repository ${JSON.stringify(url2)}`);
  }
  return url2;
}
function assertNpmSpec(spec) {
  if (typeof spec !== "string") throw new Error(`Invalid npm package ${JSON.stringify(spec)}`);
  const at = spec.lastIndexOf("@");
  const hasVersion = at > 0;
  const name = hasVersion ? spec.slice(0, at) : spec;
  const version = hasVersion ? spec.slice(at + 1) : void 0;
  if (!NPM_NAME.test(name) || name.length > 214 || version !== void 0 && (version === "" || !NPM_VERSION.test(version))) {
    throw new Error(`Invalid npm package ${JSON.stringify(spec)}`);
  }
  return spec;
}
function options(opts = {}, timeout) {
  return {
    cwd: opts.cwd,
    env: opts.env,
    encoding: "utf8",
    stdio: opts.stdio ?? "pipe",
    timeout: opts.timeout ?? timeout,
    maxBuffer: MAX_BUFFER,
    windowsHide: true
  };
}
function git(args, opts) {
  return execFileSync("git", args, options(opts, GIT_TIMEOUT_MS)) ?? "";
}
function npmCommand(args, platform = process.platform) {
  if (platform !== "win32") return { file: "npm", args, shell: false };
  const quoted = args.map((arg) => {
    if (!WINDOWS_SHELL_SAFE.test(arg)) {
      throw new Error(`Refusing to pass ${JSON.stringify(arg)} to npm through the Windows shell`);
    }
    return `"${arg}"`;
  });
  return { file: "npm.cmd", args: quoted, shell: true };
}
function npm(args, opts) {
  const cmd = npmCommand(args);
  return execFileSync(cmd.file, cmd.args, { ...options(opts, NPM_TIMEOUT_MS), shell: cmd.shell }) ?? "";
}
var execFileAsync, GIT_TIMEOUT_MS, NPM_TIMEOUT_MS, MAX_BUFFER, NPM_NAME, NPM_VERSION, WINDOWS_SHELL_SAFE;
var init_subprocess = __esm({
  "quartz/cli/subprocess.js"() {
    "use strict";
    execFileAsync = promisify(execFile);
    GIT_TIMEOUT_MS = 12e4;
    NPM_TIMEOUT_MS = 6e5;
    MAX_BUFFER = 64 * 1024 * 1024;
    __name(assertCommit, "assertCommit");
    __name(assertRef, "assertRef");
    __name(assertRepoUrl, "assertRepoUrl");
    NPM_NAME = /^(?:@[a-z0-9~][a-z0-9._~-]*\/)?[a-z0-9~][a-z0-9._~-]*$/;
    NPM_VERSION = /^[0-9A-Za-z.^~<>=*|+ -]+$/;
    __name(assertNpmSpec, "assertNpmSpec");
    __name(options, "options");
    __name(git, "git");
    WINDOWS_SHELL_SAFE = /^[A-Za-z0-9@._/:=+~^,<>|* -]+$/;
    __name(npmCommand, "npmCommand");
    __name(npm, "npm");
  }
});

// quartz/cli/plugin-index.js
var init_plugin_index = __esm({
  "quartz/cli/plugin-index.js"() {
    "use strict";
    init_subprocess();
  }
});

// quartz/plugins/loader/gitLoader.ts
import fs from "fs";
import path from "path";
import git2 from "isomorphic-git";
import http from "isomorphic-git/http/node";
import { styleText } from "util";
import { pathToFileURL } from "url";
function toFileUrl(filePath) {
  if (path.isAbsolute(filePath)) {
    return pathToFileURL(filePath).href;
  }
  return filePath;
}
function readLockedCommit(spec, lockfilePath = LOCKFILE_PATH) {
  try {
    const lock = JSON.parse(fs.readFileSync(lockfilePath, "utf-8"));
    const entry = lock?.plugins?.[spec.name];
    if (!entry || typeof entry.commit !== "string") return void 0;
    if (entry.commit === "local" || entry.commit === "unknown") return void 0;
    if (entry.resolved && entry.resolved !== spec.repo) return void 0;
    if ((entry.subdir ?? void 0) !== (spec.subdir ?? void 0)) return void 0;
    return entry.commit;
  } catch {
    return void 0;
  }
}
function cloneArgs(repo, ref, dir) {
  return [
    "clone",
    "--depth",
    "1",
    ...ref ? ["--branch", assertRef(ref)] : [],
    "--",
    assertRepoUrl(repo),
    dir
  ];
}
function checkoutLockedCommit(dir, commit, name) {
  try {
    assertCommit(commit);
    const head = git(["rev-parse", "HEAD"], { cwd: dir }).trim();
    if (head === commit) return;
    git(["fetch", "--depth", "1", "origin", commit], { cwd: dir, timeout: GIT_TIMEOUT_MS2 });
    git(["checkout", "--quiet", commit], { cwd: dir, timeout: 6e4 });
  } catch {
    console.warn(
      styleText("yellow", `\u26A0`) + ` ${name}: could not check out ${commit.slice(0, 7)} pinned in quartz.lock.json; using the latest commit instead. Run 'npx quartz plugin install' to fix the lockfile.`
    );
  }
}
function isLocalSource(source) {
  if (typeof source === "object") {
    return isLocalSource(source.repo);
  }
  if (source.startsWith("./") || source.startsWith("../") || source.startsWith("/")) {
    return true;
  }
  if (/^[A-Za-z]:[\\/]/.test(source)) {
    return true;
  }
  return false;
}
function parsePluginSource(source) {
  if (typeof source === "object" && source !== null) {
    const url2 = source.repo;
    const subdir = source.subdir;
    const ref = source.ref;
    if (isLocalSource(url2)) {
      const resolved = path.resolve(url2);
      const name2 = source.name ?? path.basename(resolved);
      return { name: name2, repo: resolved, local: true, subdir };
    }
    const expanded = parsePluginSource(url2);
    const name = source.name ?? expanded.name;
    return {
      name,
      repo: expanded.repo,
      ref: ref || expanded.ref || void 0,
      subdir,
      local: expanded.local,
      npmPackage: expanded.npmPackage
    };
  }
  if (isLocalSource(source)) {
    const resolved = path.resolve(source);
    const name = path.basename(resolved);
    return { name, repo: resolved, local: true };
  }
  if (source.startsWith("github:")) {
    const withoutPrefix = source.replace("github:", "");
    const [repoPath, ref] = withoutPrefix.split("#");
    const [owner, repo] = repoPath.split("/");
    if (!owner || !repo) {
      throw new Error(`Invalid GitHub source: ${source}. Expected format: github:user/repo`);
    }
    return {
      name: repo,
      repo: `https://github.com/${owner}/${repo}.git`,
      ref: ref || void 0
    };
  }
  if (source.startsWith("git+")) {
    const raw = source.replace("git+", "");
    const [url2, ref] = raw.split("#");
    const name = extractRepoName(url2);
    return { name, repo: url2, ref: ref || void 0 };
  }
  if (source.startsWith("https://")) {
    const [url2, ref] = source.split("#");
    const name = extractRepoName(url2);
    return { name, repo: url2, ref: ref || void 0 };
  }
  if (typeof source === "string" && source.startsWith("@") && source.includes("/") && !source.includes(":")) {
    return { name: source, repo: "", npmPackage: true };
  }
  const [shorthand, shorthandRef] = source.split("#");
  const parts = shorthand.split("/");
  if (parts.length === 2 && parts[0] && parts[1]) {
    return {
      name: parts[1],
      repo: `https://github.com/${shorthand}.git`,
      ref: shorthandRef || void 0
    };
  }
  throw new Error(
    `Cannot parse plugin source "${source}". Expected github:owner/repo, owner/repo, an https:// or git+https:// URL, an @scope/package npm name, or a local path (./path).`
  );
}
function extractRepoName(url2) {
  const match2 = url2.match(/\/([^\/]+?)(?:\.git)?$/);
  return match2 ? match2[1] : "unknown";
}
function collectNativeDeps(pluginDir) {
  const result = /* @__PURE__ */ new Map();
  const pkgPath = path.join(pluginDir, "package.json");
  if (!fs.existsSync(pkgPath)) return result;
  try {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
    const manifest = pkg.quartz ?? pkg.manifest ?? {};
    if (!manifest.requiresInstall) return result;
    const peerDeps = pkg.peerDependencies ?? {};
    const sharedExternals = getSharedExternals();
    for (const [name, range] of Object.entries(peerDeps)) {
      if (sharedExternals.some((prefix) => name.startsWith(prefix))) {
        continue;
      }
      result.set(name, range);
    }
  } catch {
  }
  return result;
}
function installNativeDeps(nativeDeps, options3) {
  const merged = /* @__PURE__ */ new Map();
  for (const [pluginName, deps] of nativeDeps) {
    for (const [pkg, range] of deps) {
      if (!merged.has(pkg)) {
        merged.set(pkg, /* @__PURE__ */ new Map());
      }
      merged.get(pkg).set(pluginName, range);
    }
  }
  if (merged.size === 0) return;
  const installArgs = [];
  for (const [pkg, pluginRanges] of merged) {
    const ranges = [...pluginRanges.values()];
    const uniqueRanges = [...new Set(ranges)];
    if (options3.verbose) {
      const sources = [...pluginRanges.entries()].map(([plugin, range]) => `${plugin} (${range})`).join(", ");
      console.log(
        styleText("cyan", `\u2192`),
        `Native dep ${styleText("bold", pkg)} required by: ${sources}`
      );
    }
    if (uniqueRanges.length === 1) {
      installArgs.push(assertNpmSpec(`${pkg}@${uniqueRanges[0]}`));
    } else {
      if (options3.verbose) {
        console.warn(
          styleText("yellow", `\u26A0`),
          `Multiple version ranges for ${pkg}: ${uniqueRanges.join(", ")}. npm will attempt to resolve a compatible version.`
        );
      }
      installArgs.push(assertNpmSpec(`${pkg}@${uniqueRanges[0]}`));
    }
  }
  if (installArgs.length === 0) return;
  if (options3.verbose) {
    console.log(
      styleText("cyan", `\u2192`),
      `Installing ${installArgs.length} native package(s) into Quartz root...`
    );
  }
  try {
    npm(["install", "--no-save", ...installArgs], {
      cwd: process.cwd(),
      stdio: options3.verbose ? "inherit" : "pipe",
      timeout: 12e4
    });
    if (options3.verbose) {
      console.log(
        styleText("green", `\u2713`),
        `Installed native dependencies: ${[...merged.keys()].join(", ")}`
      );
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(
      styleText("red", `\u2717`),
      `Failed to install native dependencies. This may indicate incompatible version ranges across plugins.
  Packages: ${[...merged.keys()].join(", ")}
  Error: ${message}`
    );
    throw new Error(`Native dependency installation failed: ${message}`);
  }
}
function isDistGitignored(pluginDir) {
  const gitignorePath = path.join(pluginDir, ".gitignore");
  if (!fs.existsSync(gitignorePath)) return false;
  const lines = fs.readFileSync(gitignorePath, "utf-8").split("\n");
  return lines.some((line) => {
    const trimmed = line.trim();
    return trimmed === "dist" || trimmed === "dist/" || trimmed === "/dist" || trimmed === "/dist/";
  });
}
function hasPrebuiltDist(pluginDir) {
  const distDir = path.join(pluginDir, "dist");
  return fs.existsSync(distDir) && !isDistGitignored(pluginDir);
}
function needsBuild(pluginDir) {
  if (isDistGitignored(pluginDir)) return true;
  const distDir = path.join(pluginDir, "dist");
  return !fs.existsSync(distDir);
}
function findPluginByPackageName(packageName) {
  if (!fs.existsSync(PLUGINS_CACHE_DIR)) return null;
  const plugins = fs.readdirSync(PLUGINS_CACHE_DIR).filter((entry) => {
    const entryPath = path.join(PLUGINS_CACHE_DIR, entry);
    return fs.statSync(entryPath).isDirectory();
  });
  for (const pluginDirName of plugins) {
    const pkgPath = path.join(PLUGINS_CACHE_DIR, pluginDirName, "package.json");
    if (!fs.existsSync(pkgPath)) continue;
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
      if (pkg.name === packageName) {
        return path.join(PLUGINS_CACHE_DIR, pluginDirName);
      }
    } catch {
    }
  }
  return null;
}
function trySymlink(target, linkPath) {
  try {
    fs.symlinkSync(target, linkPath, "dir");
  } catch (err) {
    if (err.code === "EEXIST") return;
    throw err;
  }
}
function linkPeerDependencies(pluginDir) {
  const pkgPath = path.join(pluginDir, "package.json");
  if (!fs.existsSync(pkgPath)) return;
  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
  const peers = pkg.peerDependencies ?? {};
  const quartzRoot = path.resolve(pluginDir, "..", "..", "..");
  const hostNodeModules = path.join(quartzRoot, "node_modules");
  const realDir = fs.realpathSync(pluginDir);
  const local = fs.lstatSync(pluginDir).isSymbolicLink();
  for (const peerName of Object.keys(peers)) {
    const peerNodeModulesPath = path.join(realDir, "node_modules", ...peerName.split("/"));
    const hostPeerPath = path.join(hostNodeModules, ...peerName.split("/"));
    if (fs.existsSync(peerNodeModulesPath)) {
      if (!local || peerName.startsWith("@quartz-community/") || !fs.existsSync(hostPeerPath)) {
        continue;
      }
      if (fs.realpathSync(peerNodeModulesPath) === fs.realpathSync(hostPeerPath)) continue;
      if (!fs.lstatSync(peerNodeModulesPath).isSymbolicLink()) {
        console.warn(
          styleText("yellow", `\u26A0`),
          `${peerName} is installed in ${realDir}, so it will not share Quartz's copy`
        );
        continue;
      }
      fs.unlinkSync(peerNodeModulesPath);
    } else if (fs.lstatSync(peerNodeModulesPath, { throwIfNoEntry: false })?.isSymbolicLink()) {
      fs.unlinkSync(peerNodeModulesPath);
    }
    if (peerName.startsWith("@quartz-community/")) {
      const siblingPlugin = findPluginByPackageName(peerName);
      if (!siblingPlugin) continue;
      const scopeDir = path.join(realDir, "node_modules", peerName.split("/")[0]);
      fs.mkdirSync(scopeDir, { recursive: true });
      const target2 = path.relative(scopeDir, siblingPlugin);
      trySymlink(target2, peerNodeModulesPath);
      continue;
    }
    if (!fs.existsSync(hostPeerPath)) continue;
    const parts = peerName.split("/");
    if (parts.length > 1) {
      const scopeDir = path.join(realDir, "node_modules", parts[0]);
      fs.mkdirSync(scopeDir, { recursive: true });
    } else {
      fs.mkdirSync(path.join(realDir, "node_modules"), { recursive: true });
    }
    const target = path.relative(path.dirname(peerNodeModulesPath), hostPeerPath);
    trySymlink(target, peerNodeModulesPath);
  }
}
function buildInstalledPlugin(pluginDir, name, verbose) {
  if (hasPrebuiltDist(pluginDir)) {
    if (verbose) {
      console.log(styleText("green", `\u2713`), `${name}: using pre-built dist/`);
    }
    linkPeerDependencies(pluginDir);
    return;
  }
  try {
    const shouldBuild = needsBuild(pluginDir);
    if (verbose) {
      console.log(styleText("cyan", `\u2192`), `${name}: installing dependencies...`);
    }
    npm(["install", "--ignore-scripts", "--legacy-peer-deps"], {
      cwd: pluginDir,
      stdio: verbose ? "inherit" : "pipe",
      timeout: 12e4
    });
    if (shouldBuild) {
      if (verbose) {
        console.log(styleText("cyan", `\u2192`), `${name}: building...`);
      }
      npm(["run", "build"], {
        cwd: pluginDir,
        stdio: verbose ? "inherit" : "pipe",
        timeout: 12e4
      });
    }
    npm(["prune", "--omit=dev", "--legacy-peer-deps"], {
      cwd: pluginDir,
      stdio: verbose ? "inherit" : "pipe",
      timeout: 6e4
    });
    linkPeerDependencies(pluginDir);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(styleText("red", `\u2717`), `${name}: post-install build failed: ${message}`);
    throw new Error(`Failed to build plugin ${name}: ${message}`);
  }
}
async function installPlugin(spec, options3 = {}) {
  const pluginDir = path.join(PLUGINS_CACHE_DIR, spec.name);
  if (spec.local) {
    if (!fs.existsSync(spec.repo)) {
      throw new Error(`Local plugin path does not exist: ${spec.repo}`);
    }
    if (!options3.force && fs.existsSync(pluginDir)) {
      let linked = false;
      try {
        const stat = fs.lstatSync(pluginDir);
        linked = stat.isSymbolicLink() && fs.realpathSync(pluginDir) === fs.realpathSync(spec.repo);
      } catch {
      }
      if (linked) {
        if (options3.verbose) {
          console.log(styleText("cyan", `\u2192`), `Plugin ${spec.name} already linked`);
        }
        linkPeerDependencies(pluginDir);
        return { pluginDir, nativeDeps: collectNativeDeps(pluginDir) };
      }
    }
    if (fs.existsSync(pluginDir)) {
      const stat = fs.lstatSync(pluginDir);
      if (stat.isSymbolicLink()) {
        fs.unlinkSync(pluginDir);
      } else {
        fs.rmSync(pluginDir, { recursive: true });
      }
    }
    const parentDir = path.dirname(pluginDir);
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }
    if (options3.verbose) {
      console.log(styleText("cyan", `\u2192`), `Linking ${spec.name} from ${spec.repo}...`);
    }
    fs.symlinkSync(spec.repo, pluginDir, "dir");
    if (options3.verbose) {
      console.log(styleText("green", `\u2713`), `Linked ${spec.name}`);
    }
    linkPeerDependencies(pluginDir);
    return { pluginDir, nativeDeps: collectNativeDeps(pluginDir) };
  }
  if (!options3.force && fs.existsSync(pluginDir)) {
    if (spec.subdir) {
      const pkgPath = path.join(pluginDir, "package.json");
      if (fs.existsSync(pkgPath)) {
        if (options3.verbose) {
          console.log(styleText("cyan", `\u2192`), `Plugin ${spec.name} already installed`);
        }
        return { pluginDir, nativeDeps: collectNativeDeps(pluginDir) };
      }
    } else {
      try {
        await git2.resolveRef({ fs, dir: pluginDir, ref: "HEAD" });
        if (options3.verbose) {
          console.log(styleText("cyan", `\u2192`), `Plugin ${spec.name} already installed`);
        }
        return { pluginDir, nativeDeps: collectNativeDeps(pluginDir) };
      } catch {
      }
    }
  }
  if (fs.existsSync(pluginDir)) {
    fs.rmSync(pluginDir, { recursive: true });
  }
  if (options3.verbose) {
    const refSuffix = spec.ref ? `#${spec.ref}` : "";
    const subdirSuffix = spec.subdir ? ` (subdir: ${spec.subdir})` : "";
    console.log(
      styleText("cyan", `\u2192`),
      `Cloning ${spec.name} from ${spec.repo}${refSuffix}${subdirSuffix}...`
    );
  }
  if (spec.subdir) {
    const tmpDir = pluginDir + ".__tmp__";
    if (fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true });
    }
    git(cloneArgs(spec.repo, spec.ref, tmpDir), { timeout: GIT_TIMEOUT_MS2 });
    const locked = readLockedCommit(spec);
    if (locked) checkoutLockedCommit(tmpDir, locked, spec.name);
    const subdirPath = path.join(tmpDir, spec.subdir);
    if (!fs.existsSync(subdirPath)) {
      fs.rmSync(tmpDir, { recursive: true });
      throw new Error(`Subdirectory "${spec.subdir}" not found in repository ${spec.repo}`);
    }
    fs.renameSync(subdirPath, pluginDir);
    fs.rmSync(tmpDir, { recursive: true });
  } else {
    git(cloneArgs(spec.repo, spec.ref, pluginDir), { timeout: GIT_TIMEOUT_MS2 });
    const locked = readLockedCommit(spec);
    if (locked) checkoutLockedCommit(pluginDir, locked, spec.name);
  }
  buildInstalledPlugin(pluginDir, spec.name, options3.verbose);
  if (options3.verbose) {
    console.log(styleText("green", `\u2713`), `Installed ${spec.name}`);
  }
  return { pluginDir, nativeDeps: collectNativeDeps(pluginDir) };
}
function getPluginDir(name) {
  return path.join(PLUGINS_CACHE_DIR, name);
}
function getPluginEntryPoint(name) {
  const pluginDir = getPluginDir(name);
  const searchDir = pluginDir;
  const pkgJsonPath = path.join(searchDir, "package.json");
  if (fs.existsSync(pkgJsonPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, "utf-8"));
      const exportEntry = pkg.exports?.["."];
      const importPath = typeof exportEntry === "string" ? exportEntry : exportEntry?.import;
      if (importPath) {
        const resolved = path.join(searchDir, importPath);
        if (fs.existsSync(resolved)) {
          return resolved;
        }
      }
      const mainField = pkg.module ?? pkg.main;
      if (mainField) {
        const resolved = path.join(searchDir, mainField);
        if (fs.existsSync(resolved)) {
          return resolved;
        }
      }
    } catch {
    }
  }
  const candidates = [
    path.join(searchDir, "dist", "index.js"),
    path.join(searchDir, "dist", "index.mjs"),
    path.join(searchDir, "index.js"),
    path.join(searchDir, "index.ts"),
    path.join(searchDir, "src", "index.js"),
    path.join(searchDir, "src", "index.ts")
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return searchDir;
}
function getPluginSubpathEntry(name, subpath) {
  const pluginDir = getPluginDir(name);
  const searchDir = pluginDir;
  const pkgJsonPath = path.join(searchDir, "package.json");
  if (fs.existsSync(pkgJsonPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, "utf-8"));
      const exportEntry = pkg.exports?.[subpath];
      const importPath = typeof exportEntry === "string" ? exportEntry : exportEntry?.import;
      if (importPath) {
        const resolved = path.join(searchDir, importPath);
        if (fs.existsSync(resolved)) {
          return resolved;
        }
      }
    } catch {
    }
  }
  const subpathClean = subpath.replace(/^\.\/?/, "");
  const fallbackCandidates = [
    path.join(searchDir, "dist", subpathClean, "index.js"),
    path.join(searchDir, "dist", `${subpathClean}.js`),
    path.join(searchDir, subpathClean, "index.js")
  ];
  for (const candidate of fallbackCandidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return null;
}
function getSharedExternals() {
  if (_sharedExternalsCache) return _sharedExternalsCache;
  const externals = [...SINGLETON_EXTERNALS, ...SHARED_SCOPES];
  const quartzPkgPath = path.join(process.cwd(), "package.json");
  if (fs.existsSync(quartzPkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(quartzPkgPath, "utf-8"));
      const deps = Object.keys(pkg.dependencies ?? {});
      for (const dep of deps) {
        if (!externals.includes(dep)) {
          externals.push(dep);
        }
      }
    } catch {
    }
  }
  _sharedExternalsCache = externals;
  return externals;
}
function isAllowedExternal(specifier, pluginPeerDeps) {
  if (specifier.startsWith("node:")) return true;
  const bare = specifier.split("/")[0];
  if (NODE_BUILTINS.has(bare)) return true;
  const sharedExternals = getSharedExternals();
  if (sharedExternals.some((prefix) => specifier.startsWith(prefix))) return true;
  if (pluginPeerDeps.some((dep) => specifier === dep || specifier.startsWith(dep + "/"))) {
    return true;
  }
  return false;
}
function validatePluginExternals(pluginName, entryPoint, _options) {
  try {
    const content = fs.readFileSync(entryPoint, "utf-8");
    let peerDeps = [];
    const pluginDir = path.dirname(entryPoint).replace(/\/dist$/, "");
    const pkgPath = path.join(pluginDir, "package.json");
    if (fs.existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
        peerDeps = Object.keys(pkg.peerDependencies ?? {});
      } catch {
      }
    }
    const importPattern = /^\s*(?:import\s+.*\s+from|export\s+.*\s+from)\s+["']([^"'./][^"']*)["']/gm;
    const unexpected = [];
    for (const match2 of content.matchAll(importPattern)) {
      const specifier = match2[1];
      if (!isAllowedExternal(specifier, peerDeps)) {
        unexpected.push(specifier);
      }
    }
    const unique = [...new Set(unexpected)];
    if (unique.length > 0) {
      console.error(
        styleText("red", `\u2717`) + ` Plugin ${styleText("cyan", pluginName)} has unbundled external imports that will fail at runtime:
` + unique.map((s) => `  - ${s}`).join("\n") + `
  These packages are not provided by Quartz. The plugin must bundle them into dist/.
  In the plugin's tsup.config.ts, add these to noExternal or remove the imports.`
      );
    }
    return unique;
  } catch {
    return [];
  }
}
var PLUGINS_CACHE_DIR, LOCKFILE_PATH, GIT_TIMEOUT_MS2, NODE_BUILTINS, SINGLETON_EXTERNALS, SHARED_SCOPES, _sharedExternalsCache;
var init_gitLoader = __esm({
  "quartz/plugins/loader/gitLoader.ts"() {
    "use strict";
    init_subprocess();
    init_plugin_index();
    __name(toFileUrl, "toFileUrl");
    PLUGINS_CACHE_DIR = path.join(process.cwd(), ".quartz", "plugins");
    LOCKFILE_PATH = path.join(process.cwd(), "quartz.lock.json");
    GIT_TIMEOUT_MS2 = 3e5;
    __name(readLockedCommit, "readLockedCommit");
    __name(cloneArgs, "cloneArgs");
    __name(checkoutLockedCommit, "checkoutLockedCommit");
    __name(isLocalSource, "isLocalSource");
    __name(parsePluginSource, "parsePluginSource");
    __name(extractRepoName, "extractRepoName");
    __name(collectNativeDeps, "collectNativeDeps");
    __name(installNativeDeps, "installNativeDeps");
    __name(isDistGitignored, "isDistGitignored");
    __name(hasPrebuiltDist, "hasPrebuiltDist");
    __name(needsBuild, "needsBuild");
    __name(findPluginByPackageName, "findPluginByPackageName");
    __name(trySymlink, "trySymlink");
    __name(linkPeerDependencies, "linkPeerDependencies");
    __name(buildInstalledPlugin, "buildInstalledPlugin");
    __name(installPlugin, "installPlugin");
    __name(getPluginDir, "getPluginDir");
    __name(getPluginEntryPoint, "getPluginEntryPoint");
    __name(getPluginSubpathEntry, "getPluginSubpathEntry");
    NODE_BUILTINS = /* @__PURE__ */ new Set([
      "assert",
      "buffer",
      "child_process",
      "cluster",
      "console",
      "constants",
      "crypto",
      "dgram",
      "dns",
      "domain",
      "events",
      "fs",
      "http",
      "http2",
      "https",
      "inspector",
      "module",
      "net",
      "os",
      "path",
      "perf_hooks",
      "process",
      "punycode",
      "querystring",
      "readline",
      "repl",
      "stream",
      "string_decoder",
      "sys",
      "timers",
      "tls",
      "trace_events",
      "tty",
      "url",
      "util",
      "v8",
      "vm",
      "wasi",
      "worker_threads",
      "zlib"
    ]);
    SINGLETON_EXTERNALS = ["preact", "@jackyzha0/quartz", "vfile", "unified"];
    SHARED_SCOPES = ["@quartz-community/", "@quartz-themes/"];
    _sharedExternalsCache = null;
    __name(getSharedExternals, "getSharedExternals");
    __name(isAllowedExternal, "isAllowedExternal");
    __name(validatePluginExternals, "validatePluginExternals");
  }
});

// quartz/components/registry.ts
var ComponentRegistry, componentRegistry;
var init_registry = __esm({
  "quartz/components/registry.ts"() {
    "use strict";
    ComponentRegistry = class {
      static {
        __name(this, "ComponentRegistry");
      }
      components = /* @__PURE__ */ new Map();
      instanceCache = /* @__PURE__ */ new Map();
      optionOverrides = /* @__PURE__ */ new Map();
      register(name, component, source, manifest) {
        const existing = this.components.get(name);
        if (existing && existing.source !== source) {
          console.warn(`Component "${name}" is being overwritten by ${source}`);
        }
        this.components.set(name, { component, source, manifest });
      }
      get(name) {
        return this.components.get(name);
      }
      getAll() {
        return new Map(this.components);
      }
      /** Store option overrides for a plugin, keyed by plugin directory name. */
      setOptionOverrides(pluginName, opts) {
        if (!opts || Object.keys(opts).length === 0) return;
        this.optionOverrides.set(pluginName, { ...this.optionOverrides.get(pluginName), ...opts });
        this.instanceCache.clear();
      }
      getOptionOverrides(pluginName) {
        return this.optionOverrides.get(pluginName);
      }
      /**
       * Instantiate a component constructor with options, returning a cached instance
       * if the same constructor was already called with equivalent options.
       * This prevents duplicate afterDOMLoaded scripts when the same component
       * appears in multiple page-type layouts.
       */
      instantiate(constructor, options3) {
        const optsKey = options3 !== void 0 ? JSON.stringify(options3) : "";
        const ctorId = constructor.__cacheId ?? (constructor.__cacheId = `ctor_${this.instanceCache.size}`);
        const cacheKey = `${ctorId}:${optsKey}`;
        const cached = this.instanceCache.get(cacheKey);
        if (cached) return cached;
        const instance = constructor(options3);
        this.instanceCache.set(cacheKey, instance);
        return instance;
      }
      getAllComponents() {
        const seen = /* @__PURE__ */ new Set();
        const results = [];
        for (const r of this.components.values()) {
          if (seen.has(r.component)) continue;
          seen.add(r.component);
          try {
            let instance;
            if (typeof r.component === "function") {
              const existing = this.findCachedInstance(r.component);
              instance = existing ?? this.instantiate(r.component, void 0);
            } else {
              instance = r.component;
            }
            if (instance) {
              results.push(instance);
            }
          } catch {
          }
        }
        return results;
      }
      /** @internal For testing only — resets all registry state. */
      clear() {
        this.components.clear();
        this.instanceCache.clear();
        this.optionOverrides.clear();
      }
      findCachedInstance(constructor) {
        const ctorId = constructor.__cacheId;
        if (!ctorId) return void 0;
        for (const [key, instance] of this.instanceCache) {
          if (key.startsWith(`${ctorId}:`)) return instance;
        }
        return void 0;
      }
    };
    componentRegistry = new ComponentRegistry();
  }
});

// quartz/util/diagnostics.ts
import { styleText as styleText2 } from "util";
import { isMainThread } from "node:worker_threads";
function store() {
  const g = globalThis;
  return g[STORE_KEY] ??= {
    diagnostics: [],
    keys: /* @__PURE__ */ new Set(),
    origins: /* @__PURE__ */ new WeakMap(),
    originsByName: /* @__PURE__ */ new Map(),
    knownProblems: /* @__PURE__ */ new Map(),
    filtered: /* @__PURE__ */ new Map()
  };
}
function recordDiagnostic(diagnostic) {
  const s = store();
  const key = `${diagnostic.severity}\0${diagnostic.area}\0${diagnostic.message}`;
  if (s.keys.has(key)) return false;
  s.keys.add(key);
  s.diagnostics.push(diagnostic);
  if (diagnostic.plugin && diagnostic.severity !== "info") {
    const list = s.knownProblems.get(diagnostic.plugin) ?? [];
    list.push(diagnostic.message);
    s.knownProblems.set(diagnostic.plugin, list);
  }
  return true;
}
function registerPluginOrigin(instance, origin) {
  const s = store();
  s.origins.set(instance, origin);
  for (const key of [origin.name, origin.displayName]) {
    if (!s.originsByName.has(key)) s.originsByName.set(key, origin);
  }
}
function getPluginOrigin(instanceOrName) {
  const s = store();
  return typeof instanceOrName === "string" ? s.originsByName.get(instanceOrName) : s.origins.get(instanceOrName);
}
function knownProblemsFor(origin) {
  const s = store();
  return [
    .../* @__PURE__ */ new Set([
      ...s.knownProblems.get(origin.displayName) ?? [],
      ...s.knownProblems.get(origin.name) ?? []
    ])
  ];
}
function recordFiltered(slug, filter) {
  store().filtered.set(slug, filter);
}
function warn(diagnostic) {
  const fresh = recordDiagnostic({ ...diagnostic, severity: "warning" });
  if (!fresh || !isMainThread || process.env.QUARTZ_CONFIG_QUIET === "1") return;
  console.warn(styleText2("yellow", "\u26A0") + ` ${diagnostic.message}`);
  if (diagnostic.hint) console.warn(styleText2("gray", `    \u2192 ${diagnostic.hint}`));
}
function reportError(diagnostic) {
  const fresh = recordDiagnostic({ ...diagnostic, severity: "error" });
  if (!fresh || !isMainThread || process.env.QUARTZ_CONFIG_QUIET === "1") return;
  console.error(styleText2("red", "\u2717") + ` ${diagnostic.message}`);
  for (const line of diagnostic.hint?.split("\n") ?? [])
    console.error(styleText2("gray", `    \u2192 ${line}`));
}
var STORE_KEY;
var init_diagnostics = __esm({
  "quartz/util/diagnostics.ts"() {
    "use strict";
    STORE_KEY = /* @__PURE__ */ Symbol.for("quartz.diagnostics");
    __name(store, "store");
    __name(recordDiagnostic, "recordDiagnostic");
    __name(registerPluginOrigin, "registerPluginOrigin");
    __name(getPluginOrigin, "getPluginOrigin");
    __name(knownProblemsFor, "knownProblemsFor");
    __name(recordFiltered, "recordFiltered");
    __name(warn, "warn");
    __name(reportError, "reportError");
  }
});

// quartz/util/pluginErrors.ts
function unreadableFileError(err, file) {
  const code = err?.code;
  if (typeof code !== "string") return void 0;
  const reason = fileErrorReasons[code] ?? err.message;
  return new ContentError(`Cannot read \`${file}\`: ${reason} (${code})`, { cause: err });
}
function isContentError(err) {
  let e = err;
  for (let depth = 0; depth < 10 && e && typeof e === "object"; depth++) {
    if (e.quartzContent === true) return true;
    e = e.cause;
  }
  return false;
}
function pluginErrorInfo(err) {
  const info = err?.quartzPlugin;
  return info && typeof info === "object" && info.origin ? info : void 0;
}
function attributeError(err, info) {
  if (pluginErrorInfo(err)) return err;
  return new PluginError(err, info);
}
function fileLabel(file) {
  if (!file) return void 0;
  const data = file.data;
  return data?.relativePath ?? file.path ?? data?.slug;
}
function wrapTransformer(fn, origin, stage) {
  const fail = /* @__PURE__ */ __name((err, file) => attributeError(err, { origin, stage, file: fileLabel(file) }), "fail");
  if (fn.length >= 3) {
    return function(tree, file, next) {
      const done = next;
      try {
        return fn.call(
          this,
          tree,
          file,
          (err, ...rest) => done(err ? fail(err, file) : err, ...rest)
        );
      } catch (err) {
        throw fail(err, file);
      }
    };
  }
  return function(tree, file) {
    try {
      const result = fn.call(this, tree, file);
      if (result && typeof result.then === "function") {
        return result.then(void 0, (err) => {
          throw fail(err, file);
        });
      }
      return result;
    } catch (err) {
      throw fail(err, file);
    }
  };
}
function wrapAttacher(attacher, origin, stage) {
  const cached = wrappedAttachers.get(attacher);
  if (cached) return cached;
  const wrapped = /* @__PURE__ */ __name(function(...args) {
    let transformer;
    try {
      transformer = attacher.apply(this, args);
    } catch (err) {
      throw attributeError(err, { origin, stage });
    }
    return typeof transformer === "function" ? wrapTransformer(transformer, origin, stage) : transformer;
  }, "wrapped");
  Object.defineProperty(wrapped, "name", { value: attacher.name });
  wrappedAttachers.set(attacher, wrapped);
  return wrapped;
}
function attributePluggables(list, origin, stage) {
  if (!origin) return list;
  return list.map((item) => {
    if (typeof item === "function")
      return wrapAttacher(item, origin, stage);
    if (Array.isArray(item) && typeof item[0] === "function") {
      const [attacher, ...settings] = item;
      return [wrapAttacher(attacher, origin, stage), ...settings];
    }
    return item;
  });
}
function originOf(instance) {
  return getPluginOrigin(instance) ?? {
    name: instance.name ?? "unknown",
    displayName: instance.name ?? "unknown",
    source: instance.name ?? "unknown"
  };
}
var PluginError, ContentError, fileErrorReasons, wrappedAttachers;
var init_pluginErrors = __esm({
  "quartz/util/pluginErrors.ts"() {
    "use strict";
    init_diagnostics();
    PluginError = class extends Error {
      static {
        __name(this, "PluginError");
      }
      quartzPlugin;
      constructor(cause, info) {
        const base = cause instanceof Error ? cause : new Error(String(cause));
        super(base.message, { cause: base });
        this.name = base.name;
        this.quartzPlugin = info;
        this.stack = base.stack;
      }
    };
    ContentError = class extends Error {
      static {
        __name(this, "ContentError");
      }
      quartzContent = true;
      constructor(message, options3) {
        super(message, options3);
        this.name = "ContentError";
      }
    };
    fileErrorReasons = {
      EACCES: "permission denied",
      EPERM: "permission denied",
      EISDIR: "it is a directory",
      ENOENT: "it no longer exists"
    };
    __name(unreadableFileError, "unreadableFileError");
    __name(isContentError, "isContentError");
    __name(pluginErrorInfo, "pluginErrorInfo");
    __name(attributeError, "attributeError");
    __name(fileLabel, "fileLabel");
    __name(wrapTransformer, "wrapTransformer");
    wrappedAttachers = /* @__PURE__ */ new WeakMap();
    __name(wrapAttacher, "wrapAttacher");
    __name(attributePluggables, "attributePluggables");
    __name(originOf, "originOf");
  }
});

// quartz/components/attribution.ts
import { cloneElement, isValidElement } from "preact";
function shortPluginName(pluginName) {
  const cleaned = pluginName.replace(/#.*$/, "").replace(/\/+$/, "");
  return cleaned.split(/[/:]/).pop() ?? cleaned;
}
function attributeVNode(rendered, attribution) {
  if (!isValidElement(rendered)) return rendered;
  const vnode = rendered;
  if (typeof vnode.type !== "string") return rendered;
  const props = vnode.props ?? {};
  if (props[PLUGIN_ATTRIBUTE] !== void 0) return rendered;
  return cloneElement(vnode, {
    [PLUGIN_ATTRIBUTE]: attribution.plugin,
    [COMPONENT_ATTRIBUTE]: attribution.component
  });
}
function attributeComponent(component, attribution) {
  if (component[ATTRIBUTED]) return component;
  const wrapped = /* @__PURE__ */ __name(((props) => {
    let rendered;
    try {
      rendered = component(props);
    } catch (err) {
      throw attributeError(err, {
        origin: getPluginOrigin(attribution.plugin) ?? {
          name: attribution.plugin,
          displayName: attribution.plugin,
          source: attribution.plugin
        },
        stage: "render",
        component: attribution.component,
        file: props?.fileData?.slug
      });
    }
    return attributeVNode(rendered, attribution);
  }), "wrapped");
  Object.assign(wrapped, component);
  Object.defineProperty(wrapped, "name", { value: component.name || attribution.component });
  Object.defineProperty(wrapped, ATTRIBUTED, { value: true });
  return wrapped;
}
function attributeComponentExport(exported, attribution) {
  if (typeof exported !== "function") return exported;
  if (exported[ATTRIBUTED]) return exported;
  if ("displayName" in exported) {
    return attributeComponent(exported, attribution);
  }
  const ctor = exported;
  const wrappedCtor = /* @__PURE__ */ __name(((opts) => {
    const instance = ctor(opts);
    return typeof instance === "function" ? attributeComponent(instance, attribution) : instance;
  }), "wrappedCtor");
  Object.assign(wrappedCtor, ctor);
  Object.defineProperty(wrappedCtor, "name", { value: ctor.name || attribution.component });
  Object.defineProperty(wrappedCtor, ATTRIBUTED, { value: true });
  return wrappedCtor;
}
var PLUGIN_ATTRIBUTE, COMPONENT_ATTRIBUTE, ATTRIBUTED;
var init_attribution = __esm({
  "quartz/components/attribution.ts"() {
    "use strict";
    init_pluginErrors();
    init_diagnostics();
    PLUGIN_ATTRIBUTE = "data-quartz-plugin";
    COMPONENT_ATTRIBUTE = "data-quartz-component";
    ATTRIBUTED = /* @__PURE__ */ Symbol.for("quartz.attributed");
    __name(shortPluginName, "shortPluginName");
    __name(attributeVNode, "attributeVNode");
    __name(attributeComponent, "attributeComponent");
    __name(attributeComponentExport, "attributeComponentExport");
  }
});

// quartz/plugins/loader/componentLoader.ts
var componentLoader_exports = {};
__export(componentLoader_exports, {
  loadComponentsFromPackage: () => loadComponentsFromPackage
});
async function loadComponentsFromPackage(pluginName, manifest) {
  if (!manifest?.components) return;
  try {
    const componentsPath = getPluginSubpathEntry(pluginName, "./components");
    let componentsModule;
    if (componentsPath) {
      componentsModule = await import(toFileUrl(componentsPath));
    } else {
      componentsModule = await import(`${pluginName}/components`);
    }
    const componentEntries = Object.entries(manifest.components);
    const attributed = /* @__PURE__ */ new Map();
    const resolveExport = /* @__PURE__ */ __name((exportName) => {
      if (!attributed.has(exportName)) {
        const raw = componentsModule[exportName];
        attributed.set(
          exportName,
          raw ? attributeComponentExport(raw, {
            plugin: shortPluginName(pluginName),
            component: exportName
          }) : raw
        );
      }
      return attributed.get(exportName);
    }, "resolveExport");
    for (const [exportName, componentManifest] of componentEntries) {
      const component = resolveExport(exportName);
      if (!component) {
        console.warn(
          `Component "${exportName}" declared in manifest but not found in ${pluginName}/components`
        );
        continue;
      }
      componentRegistry.register(
        `${pluginName}/${exportName}`,
        component,
        pluginName,
        componentManifest
      );
      if (!componentRegistry.get(exportName)) {
        componentRegistry.register(
          exportName,
          component,
          pluginName,
          componentManifest
        );
      }
    }
    if (componentEntries.length === 1) {
      const [exportName] = componentEntries[0];
      const component = resolveExport(exportName);
      if (component && !componentRegistry.get(pluginName)) {
        componentRegistry.register(
          pluginName,
          component,
          pluginName,
          componentEntries[0][1]
        );
      }
    }
  } catch {
    if (manifest.components && Object.keys(manifest.components).length > 0) {
      console.warn(`Plugin "${pluginName}" declares components but failed to load them`);
    }
  }
}
var init_componentLoader = __esm({
  "quartz/plugins/loader/componentLoader.ts"() {
    "use strict";
    init_registry();
    init_gitLoader();
    init_attribution();
    __name(loadComponentsFromPackage, "loadComponentsFromPackage");
  }
});

// quartz/components/frames/registry.ts
var FrameRegistry, frameRegistry;
var init_registry2 = __esm({
  "quartz/components/frames/registry.ts"() {
    "use strict";
    FrameRegistry = class {
      static {
        __name(this, "FrameRegistry");
      }
      frames = /* @__PURE__ */ new Map();
      register(name, frame, source) {
        const existing = this.frames.get(name);
        if (existing && existing.source !== source) {
          console.warn(
            `Page frame "${name}" from ${source} is overwriting frame from ${existing.source}`
          );
        }
        this.frames.set(name, { frame, source });
      }
      get(name) {
        return this.frames.get(name);
      }
      getAll() {
        return new Map(this.frames);
      }
      has(name) {
        return this.frames.has(name);
      }
    };
    frameRegistry = new FrameRegistry();
  }
});

// quartz/plugins/loader/frameLoader.ts
async function loadFramesFromPackage(pluginName, manifest) {
  if (!manifest?.frames) return;
  try {
    const framesPath = getPluginSubpathEntry(pluginName, "./frames");
    let framesModule;
    if (framesPath) {
      framesModule = await import(toFileUrl(framesPath));
    } else {
      framesModule = await import(`${pluginName}/frames`);
    }
    for (const [exportName, _frameMeta] of Object.entries(manifest.frames)) {
      const frame = framesModule[exportName];
      if (!frame) {
        console.warn(
          `Frame "${exportName}" declared in manifest but not found in ${pluginName}/frames`
        );
        continue;
      }
      const pageFrame = frame;
      if (!pageFrame.name || typeof pageFrame.render !== "function") {
        console.warn(
          `Frame "${exportName}" from ${pluginName} is not a valid PageFrame (missing name or render)`
        );
        continue;
      }
      frameRegistry.register(pageFrame.name, pageFrame, pluginName);
    }
  } catch {
    if (manifest.frames && Object.keys(manifest.frames).length > 0) {
      console.warn(`Plugin "${pluginName}" declares frames but failed to load them`);
    }
  }
}
var init_frameLoader = __esm({
  "quartz/plugins/loader/frameLoader.ts"() {
    "use strict";
    init_registry2();
    init_gitLoader();
    __name(loadFramesFromPackage, "loadFramesFromPackage");
  }
});

// quartz/plugins/loader/capabilities.ts
import { isMainThread as isMainThread2 } from "node:worker_threads";
import { styleText as styleText3 } from "util";
function coreCapabilities(configuration) {
  return {
    // quartz/processors/parse.ts
    data: ["slug", "filePath", "relativePath"],
    // renderPage.tsx / frames
    dom: ["#quartz-body", ".page", ".center", "article", ".popover-hint", ".sidebar"],
    // renderPage.tsx (fetchData), componentResources.ts (spaNavigate/addCleanup, SPA or not)
    globals: ["fetchData", "addCleanup", "spaNavigate"],
    // componentResources.ts dispatches "nav" in both modes; spa.inline.ts adds "prenav"
    events: configuration?.enableSPA === false ? ["nav"] : ["nav", "prenav"]
  };
}
function normalize(kind, value) {
  const v = value.trim();
  if (kind === "files") return v.replace(/^\/+/, "");
  return v;
}
function parseCapabilities(raw, pluginName) {
  const problems = [];
  if (raw === void 0 || raw === null) return { capabilities: void 0, problems };
  if (typeof raw !== "object" || Array.isArray(raw)) {
    problems.push(`Plugin "${pluginName}": quartz.capabilities must be an object (ignored).`);
    return { capabilities: void 0, problems };
  }
  const out = {};
  for (const section of ["provides", "requires", "optional"]) {
    const value = raw[section];
    if (value === void 0) continue;
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      problems.push(`Plugin "${pluginName}": capabilities.${section} must be an object (ignored).`);
      continue;
    }
    const parsed = {};
    for (const [kind, list] of Object.entries(value)) {
      if (!CAPABILITY_KINDS.includes(kind)) {
        problems.push(
          `Plugin "${pluginName}": unknown capability kind "${section}.${kind}" (ignored). Known kinds: ${CAPABILITY_KINDS.join(", ")}.`
        );
        continue;
      }
      if (!Array.isArray(list)) {
        problems.push(`Plugin "${pluginName}": capabilities.${section}.${kind} must be an array.`);
        continue;
      }
      const items = list.filter((item) => {
        const ok = typeof item === "string" || section !== "provides" && typeof item === "object" && item !== null && typeof item.name === "string";
        if (!ok) {
          problems.push(
            `Plugin "${pluginName}": invalid entry in capabilities.${section}.${kind}: ${JSON.stringify(item)}`
          );
        }
        return ok;
      });
      parsed[kind] = items;
    }
    ;
    out[section] = parsed;
  }
  return { capabilities: out, problems };
}
function toRequirement(req) {
  if (typeof req === "string") return { name: req, from: [] };
  const from = req.from === void 0 ? [] : Array.isArray(req.from) ? req.from : [req.from];
  return { name: req.name, from, reason: req.reason };
}
function describeKind(kind) {
  switch (kind) {
    case "data":
      return "data";
    case "dom":
      return "DOM element";
    case "globals":
      return "browser global";
    case "events":
      return "event";
    case "files":
      return "file";
    case "cssVars":
      return "CSS variable";
  }
}
function checkCapabilities(enabled, options3 = {}) {
  const report = { warnings: [], infos: [], missing: [] };
  const parsedEnabled = enabled.map((plugin) => {
    const { capabilities, problems } = parseCapabilities(plugin.capabilities, plugin.name);
    report.infos.push(...problems);
    return { plugin, capabilities };
  });
  const parsedAvailable = (options3.available ?? []).map((plugin) => ({
    plugin,
    capabilities: parseCapabilities(plugin.capabilities, plugin.name).capabilities
  }));
  const key = /* @__PURE__ */ __name((kind, name) => `${kind}\0${normalize(kind, name)}`, "key");
  const provided = /* @__PURE__ */ new Set();
  for (const [kind, names] of Object.entries(options3.core ?? {})) {
    for (const name of names ?? []) provided.add(key(kind, name));
  }
  for (const { capabilities } of parsedEnabled) {
    for (const [kind, names] of Object.entries(capabilities?.provides ?? {})) {
      for (const name of names ?? []) provided.add(key(kind, name));
    }
  }
  const enabledNames = /* @__PURE__ */ new Set();
  for (const { plugin } of parsedEnabled) {
    enabledNames.add(plugin.name);
    for (const alias of plugin.aliases ?? []) enabledNames.add(alias);
  }
  for (const { plugin, capabilities } of parsedEnabled) {
    if (!capabilities) continue;
    for (const required of [true, false]) {
      const section = required ? capabilities.requires : capabilities.optional;
      for (const [kindRaw, reqs] of Object.entries(section ?? {})) {
        const kind = kindRaw;
        for (const raw of reqs ?? []) {
          const req = toRequirement(raw);
          if (provided.has(key(kind, req.name))) continue;
          if (req.from.some((name) => enabledNames.has(name))) continue;
          const renamed = /* @__PURE__ */ __name((name) => parsedAvailable.find(
            (o) => o.plugin.name === name || (o.plugin.aliases ?? []).includes(name)
          )?.plugin.name ?? name, "renamed");
          const candidates = new Set(req.from.map(renamed));
          for (const other of parsedAvailable) {
            const names = other.capabilities?.provides?.[kind] ?? [];
            if (names.some((n) => normalize(kind, n) === normalize(kind, req.name))) {
              candidates.add(other.plugin.name);
            }
          }
          const missing = {
            plugin: plugin.name,
            kind,
            name: req.name,
            required,
            reason: req.reason,
            candidates: [...candidates]
          };
          report.missing.push(missing);
          const what = `${describeKind(kind)} "${req.name}"`;
          const hint = missing.candidates.length > 0 ? ` \u2014 enable ${missing.candidates.map((c) => `"${c}"`).join(" or ")}` : "";
          const why = req.reason ? ` (${req.reason})` : "";
          if (required) {
            report.warnings.push(
              `Plugin "${plugin.name}" requires ${what}, but no enabled plugin provides it${hint}.${why}`
            );
          } else {
            report.infos.push(
              `Plugin "${plugin.name}" can use ${what}, which no enabled plugin provides${hint}.${why}`
            );
          }
        }
      }
    }
  }
  return report;
}
async function validatePluginCapabilities(args) {
  const toPlugin = /* @__PURE__ */ __name(async (entry) => {
    let manifest;
    try {
      manifest = await args.manifestFor(entry);
    } catch {
      manifest = void 0;
    }
    const sourceName = args.nameOf(entry);
    const shortName2 = sourceName.replace(/^@[^/]+\//, "");
    const name = manifest?.name ?? shortName2;
    return {
      name,
      aliases: [.../* @__PURE__ */ new Set([sourceName, shortName2, manifest?.displayName ?? name])],
      capabilities: manifest?.capabilities
    };
  }, "toPlugin");
  const enabled = [
    ...args.builtins?.enabled ?? [],
    ...await Promise.all(args.entries.filter((e) => e.enabled).map(toPlugin))
  ];
  const core = coreCapabilities(args.configuration);
  const first = checkCapabilities(enabled, { core });
  if (first.missing.length === 0) return first;
  const available = [
    ...args.builtins?.available ?? [],
    ...await Promise.all(args.entries.filter((e) => !e.enabled).map(toPlugin))
  ];
  return checkCapabilities(enabled, { core, available });
}
function printCapabilityWarnings(report) {
  for (const m of report.missing) {
    if (!m.required) continue;
    const warning = report.warnings.find(
      (w) => w.startsWith(`Plugin "${m.plugin}" requires`) && w.includes(`"${m.name}"`)
    );
    recordDiagnostic({
      severity: "warning",
      area: "capabilities",
      plugin: m.plugin,
      message: warning ?? `${m.plugin} requires ${m.kind} "${m.name}", which nothing provides`
    });
  }
  if (!isMainThread2 || process.env.QUARTZ_CONFIG_QUIET === "1") return;
  for (const w of report.warnings) {
    if (printedWarnings.has(w)) continue;
    printedWarnings.add(w);
    console.warn(styleText3("yellow", "\u26A0") + ` ${w}`);
  }
}
var CAPABILITY_KINDS, printedWarnings;
var init_capabilities = __esm({
  "quartz/plugins/loader/capabilities.ts"() {
    "use strict";
    init_diagnostics();
    CAPABILITY_KINDS = ["data", "dom", "globals", "events", "files", "cssVars"];
    __name(coreCapabilities, "coreCapabilities");
    __name(normalize, "normalize");
    __name(parseCapabilities, "parseCapabilities");
    __name(toRequirement, "toRequirement");
    __name(describeKind, "describeKind");
    __name(checkCapabilities, "checkCapabilities");
    __name(validatePluginCapabilities, "validatePluginCapabilities");
    printedWarnings = globalThis[/* @__PURE__ */ Symbol.for("quartz.printedCapabilityWarnings")] ??= /* @__PURE__ */ new Set();
    __name(printCapabilityWarnings, "printCapabilityWarnings");
  }
});

// quartz/util/escape.ts
import { escapeHTML, unescapeHTML } from "@quartz-community/utils";
var init_escape = __esm({
  "quartz/util/escape.ts"() {
    "use strict";
  }
});

// quartz/i18n/locales/en-US.ts
var en_US_default;
var init_en_US = __esm({
  "quartz/i18n/locales/en-US.ts"() {
    "use strict";
    en_US_default = {
      propertyDefaults: {
        title: "Untitled",
        description: "No description provided"
      },
      components: {
        callout: {
          note: "Note",
          abstract: "Abstract",
          info: "Info",
          todo: "Todo",
          tip: "Tip",
          success: "Success",
          question: "Question",
          warning: "Warning",
          failure: "Failure",
          danger: "Danger",
          bug: "Bug",
          example: "Example",
          quote: "Quote"
        },
        backlinks: {
          title: "Backlinks",
          noBacklinksFound: "No backlinks found"
        },
        themeToggle: {
          lightMode: "Light mode",
          darkMode: "Dark mode"
        },
        readerMode: {
          title: "Reader mode"
        },
        explorer: {
          title: "Explorer"
        },
        footer: {
          createdWith: "Created with"
        },
        graph: {
          title: "Graph View"
        },
        recentNotes: {
          title: "Recent Notes",
          seeRemainingMore: /* @__PURE__ */ __name(({ remaining }) => `See ${remaining} more \u2192`, "seeRemainingMore")
        },
        transcludes: {
          transcludeOf: /* @__PURE__ */ __name(({ targetSlug }) => `Transclude of ${targetSlug}`, "transcludeOf"),
          linkToOriginal: "Link to original"
        },
        search: {
          title: "Search",
          searchBarPlaceholder: "Search for something"
        },
        tableOfContents: {
          title: "Table of Contents"
        },
        contentMeta: {
          readingTime: /* @__PURE__ */ __name(({ minutes }) => `${minutes} min read`, "readingTime")
        }
      },
      pages: {
        rss: {
          recentNotes: "Recent notes",
          lastFewNotes: /* @__PURE__ */ __name(({ count }) => `Last ${count} notes`, "lastFewNotes")
        },
        error: {
          title: "Not Found",
          notFound: "Either this page is private or doesn't exist.",
          home: "Return to Homepage"
        },
        folderContent: {
          folder: "Folder",
          itemsUnderFolder: /* @__PURE__ */ __name(({ count }) => count === 1 ? "1 item under this folder." : `${count} items under this folder.`, "itemsUnderFolder")
        },
        tagContent: {
          tag: "Tag",
          tagIndex: "Tag Index",
          itemsUnderTag: /* @__PURE__ */ __name(({ count }) => count === 1 ? "1 item with this tag." : `${count} items with this tag.`, "itemsUnderTag"),
          showingFirst: /* @__PURE__ */ __name(({ count }) => `Showing first ${count} tags.`, "showingFirst"),
          totalTags: /* @__PURE__ */ __name(({ count }) => `Found ${count} total tags.`, "totalTags")
        }
      }
    };
  }
});

// quartz/i18n/locales/en-GB.ts
var en_GB_default;
var init_en_GB = __esm({
  "quartz/i18n/locales/en-GB.ts"() {
    "use strict";
    en_GB_default = {
      propertyDefaults: {
        title: "Untitled",
        description: "No description provided"
      },
      components: {
        callout: {
          note: "Note",
          abstract: "Abstract",
          info: "Info",
          todo: "To-Do",
          tip: "Tip",
          success: "Success",
          question: "Question",
          warning: "Warning",
          failure: "Failure",
          danger: "Danger",
          bug: "Bug",
          example: "Example",
          quote: "Quote"
        },
        backlinks: {
          title: "Backlinks",
          noBacklinksFound: "No backlinks found"
        },
        themeToggle: {
          lightMode: "Light mode",
          darkMode: "Dark mode"
        },
        readerMode: {
          title: "Reader mode"
        },
        explorer: {
          title: "Explorer"
        },
        footer: {
          createdWith: "Created with"
        },
        graph: {
          title: "Graph View"
        },
        recentNotes: {
          title: "Recent Notes",
          seeRemainingMore: /* @__PURE__ */ __name(({ remaining }) => `See ${remaining} more \u2192`, "seeRemainingMore")
        },
        transcludes: {
          transcludeOf: /* @__PURE__ */ __name(({ targetSlug }) => `Transclude of ${targetSlug}`, "transcludeOf"),
          linkToOriginal: "Link to original"
        },
        search: {
          title: "Search",
          searchBarPlaceholder: "Search for something"
        },
        tableOfContents: {
          title: "Table of Contents"
        },
        contentMeta: {
          readingTime: /* @__PURE__ */ __name(({ minutes }) => `${minutes} min read`, "readingTime")
        }
      },
      pages: {
        rss: {
          recentNotes: "Recent notes",
          lastFewNotes: /* @__PURE__ */ __name(({ count }) => `Last ${count} notes`, "lastFewNotes")
        },
        error: {
          title: "Not Found",
          notFound: "Either this page is private or doesn't exist.",
          home: "Return to Homepage"
        },
        folderContent: {
          folder: "Folder",
          itemsUnderFolder: /* @__PURE__ */ __name(({ count }) => count === 1 ? "1 item under this folder." : `${count} items under this folder.`, "itemsUnderFolder")
        },
        tagContent: {
          tag: "Tag",
          tagIndex: "Tag Index",
          itemsUnderTag: /* @__PURE__ */ __name(({ count }) => count === 1 ? "1 item with this tag." : `${count} items with this tag.`, "itemsUnderTag"),
          showingFirst: /* @__PURE__ */ __name(({ count }) => `Showing first ${count} tags.`, "showingFirst"),
          totalTags: /* @__PURE__ */ __name(({ count }) => `Found ${count} total tags.`, "totalTags")
        }
      }
    };
  }
});

// quartz/i18n/locales/fr-FR.ts
var fr_FR_default;
var init_fr_FR = __esm({
  "quartz/i18n/locales/fr-FR.ts"() {
    "use strict";
    fr_FR_default = {
      propertyDefaults: {
        title: "Sans titre",
        description: "Aucune description fournie"
      },
      components: {
        callout: {
          note: "Note",
          abstract: "R\xE9sum\xE9",
          info: "Info",
          todo: "\xC0 faire",
          tip: "Conseil",
          success: "Succ\xE8s",
          question: "Question",
          warning: "Avertissement",
          failure: "\xC9chec",
          danger: "Danger",
          bug: "Bogue",
          example: "Exemple",
          quote: "Citation"
        },
        backlinks: {
          title: "Liens retour",
          noBacklinksFound: "Aucun lien retour trouv\xE9"
        },
        themeToggle: {
          lightMode: "Mode clair",
          darkMode: "Mode sombre"
        },
        readerMode: {
          title: "Mode lecture"
        },
        explorer: {
          title: "Explorateur"
        },
        footer: {
          createdWith: "Cr\xE9\xE9 avec"
        },
        graph: {
          title: "Vue graphique"
        },
        recentNotes: {
          title: "Notes R\xE9centes",
          seeRemainingMore: /* @__PURE__ */ __name(({ remaining }) => `Voir ${remaining} de plus \u2192`, "seeRemainingMore")
        },
        transcludes: {
          transcludeOf: /* @__PURE__ */ __name(({ targetSlug }) => `Transclusion de ${targetSlug}`, "transcludeOf"),
          linkToOriginal: "Lien vers l'original"
        },
        search: {
          title: "Recherche",
          searchBarPlaceholder: "Rechercher quelque chose"
        },
        tableOfContents: {
          title: "Table des mati\xE8res"
        },
        contentMeta: {
          readingTime: /* @__PURE__ */ __name(({ minutes }) => `${minutes} min de lecture`, "readingTime")
        }
      },
      pages: {
        rss: {
          recentNotes: "Notes r\xE9centes",
          lastFewNotes: /* @__PURE__ */ __name(({ count }) => `Les derni\xE8res ${count} notes`, "lastFewNotes")
        },
        error: {
          title: "Introuvable",
          notFound: "Cette page est soit priv\xE9e, soit elle n'existe pas.",
          home: "Retour \xE0 la page d'accueil"
        },
        folderContent: {
          folder: "Dossier",
          itemsUnderFolder: /* @__PURE__ */ __name(({ count }) => count === 1 ? "1 \xE9l\xE9ment sous ce dossier." : `${count} \xE9l\xE9ments sous ce dossier.`, "itemsUnderFolder")
        },
        tagContent: {
          tag: "\xC9tiquette",
          tagIndex: "Index des \xE9tiquettes",
          itemsUnderTag: /* @__PURE__ */ __name(({ count }) => count === 1 ? "1 \xE9l\xE9ment avec cette \xE9tiquette." : `${count} \xE9l\xE9ments avec cette \xE9tiquette.`, "itemsUnderTag"),
          showingFirst: /* @__PURE__ */ __name(({ count }) => `Affichage des premi\xE8res ${count} \xE9tiquettes.`, "showingFirst"),
          totalTags: /* @__PURE__ */ __name(({ count }) => `Trouv\xE9 ${count} \xE9tiquettes au total.`, "totalTags")
        }
      }
    };
  }
});

// quartz/i18n/locales/it-IT.ts
var it_IT_default;
var init_it_IT = __esm({
  "quartz/i18n/locales/it-IT.ts"() {
    "use strict";
    it_IT_default = {
      propertyDefaults: {
        title: "Senza titolo",
        description: "Nessuna descrizione"
      },
      components: {
        callout: {
          note: "Nota",
          abstract: "Abstract",
          info: "Info",
          todo: "Da fare",
          tip: "Consiglio",
          success: "Completato",
          question: "Domanda",
          warning: "Attenzione",
          failure: "Errore",
          danger: "Pericolo",
          bug: "Problema",
          example: "Esempio",
          quote: "Citazione"
        },
        backlinks: {
          title: "Link entranti",
          noBacklinksFound: "Nessun link entrante"
        },
        themeToggle: {
          lightMode: "Tema chiaro",
          darkMode: "Tema scuro"
        },
        readerMode: {
          title: "Modalit\xE0 lettura"
        },
        explorer: {
          title: "Esplora"
        },
        footer: {
          createdWith: "Creato con"
        },
        graph: {
          title: "Vista grafico"
        },
        recentNotes: {
          title: "Note recenti",
          seeRemainingMore: /* @__PURE__ */ __name(({ remaining }) => remaining === 1 ? "Vedi 1 altra \u2192" : `Vedi altre ${remaining} \u2192`, "seeRemainingMore")
        },
        transcludes: {
          transcludeOf: /* @__PURE__ */ __name(({ targetSlug }) => `Inclusione di ${targetSlug}`, "transcludeOf"),
          linkToOriginal: "Link all'originale"
        },
        search: {
          title: "Cerca",
          searchBarPlaceholder: "Cerca qualcosa"
        },
        tableOfContents: {
          title: "Indice"
        },
        contentMeta: {
          readingTime: /* @__PURE__ */ __name(({ minutes }) => minutes === 1 ? "1 minuto" : `${minutes} minuti`, "readingTime")
        }
      },
      pages: {
        rss: {
          recentNotes: "Note recenti",
          lastFewNotes: /* @__PURE__ */ __name(({ count }) => count === 1 ? "Ultima nota" : `Ultime ${count} note`, "lastFewNotes")
        },
        error: {
          title: "Non trovato",
          notFound: "Questa pagina \xE8 privata o non esiste.",
          home: "Ritorna alla home page"
        },
        folderContent: {
          folder: "Cartella",
          itemsUnderFolder: /* @__PURE__ */ __name(({ count }) => count === 1 ? "1 oggetto in questa cartella." : `${count} oggetti in questa cartella.`, "itemsUnderFolder")
        },
        tagContent: {
          tag: "Etichetta",
          tagIndex: "Indice etichette",
          itemsUnderTag: /* @__PURE__ */ __name(({ count }) => count === 1 ? "1 oggetto con questa etichetta." : `${count} oggetti con questa etichetta.`, "itemsUnderTag"),
          showingFirst: /* @__PURE__ */ __name(({ count }) => count === 1 ? "Prima etichetta." : `Prime ${count} etichette.`, "showingFirst"),
          totalTags: /* @__PURE__ */ __name(({ count }) => count === 1 ? "Trovata 1 etichetta in totale." : `Trovate ${count} etichette totali.`, "totalTags")
        }
      }
    };
  }
});

// quartz/i18n/locales/ja-JP.ts
var ja_JP_default;
var init_ja_JP = __esm({
  "quartz/i18n/locales/ja-JP.ts"() {
    "use strict";
    ja_JP_default = {
      propertyDefaults: {
        title: "\u7121\u984C",
        description: "\u8AAC\u660E\u306A\u3057"
      },
      components: {
        callout: {
          note: "\u30CE\u30FC\u30C8",
          abstract: "\u6284\u9332",
          info: "\u60C5\u5831",
          todo: "\u3084\u308B\u3079\u304D\u3053\u3068",
          tip: "\u30D2\u30F3\u30C8",
          success: "\u6210\u529F",
          question: "\u8CEA\u554F",
          warning: "\u8B66\u544A",
          failure: "\u5931\u6557",
          danger: "\u5371\u967A",
          bug: "\u30D0\u30B0",
          example: "\u4F8B",
          quote: "\u5F15\u7528"
        },
        backlinks: {
          title: "\u30D0\u30C3\u30AF\u30EA\u30F3\u30AF",
          noBacklinksFound: "\u30D0\u30C3\u30AF\u30EA\u30F3\u30AF\u306F\u3042\u308A\u307E\u305B\u3093"
        },
        themeToggle: {
          lightMode: "\u30E9\u30A4\u30C8\u30E2\u30FC\u30C9",
          darkMode: "\u30C0\u30FC\u30AF\u30E2\u30FC\u30C9"
        },
        readerMode: {
          title: "\u30EA\u30FC\u30C0\u30FC\u30E2\u30FC\u30C9"
        },
        explorer: {
          title: "\u30A8\u30AF\u30B9\u30D7\u30ED\u30FC\u30E9\u30FC"
        },
        footer: {
          createdWith: "\u4F5C\u6210"
        },
        graph: {
          title: "\u30B0\u30E9\u30D5\u30D3\u30E5\u30FC"
        },
        recentNotes: {
          title: "\u6700\u8FD1\u306E\u8A18\u4E8B",
          seeRemainingMore: /* @__PURE__ */ __name(({ remaining }) => `\u3055\u3089\u306B${remaining}\u4EF6 \u2192`, "seeRemainingMore")
        },
        transcludes: {
          transcludeOf: /* @__PURE__ */ __name(({ targetSlug }) => `${targetSlug}\u306E\u307E\u3068\u3081`, "transcludeOf"),
          linkToOriginal: "\u5143\u8A18\u4E8B\u3078\u306E\u30EA\u30F3\u30AF"
        },
        search: {
          title: "\u691C\u7D22",
          searchBarPlaceholder: "\u691C\u7D22\u30EF\u30FC\u30C9\u3092\u5165\u529B"
        },
        tableOfContents: {
          title: "\u76EE\u6B21"
        },
        contentMeta: {
          readingTime: /* @__PURE__ */ __name(({ minutes }) => `${minutes} min read`, "readingTime")
        }
      },
      pages: {
        rss: {
          recentNotes: "\u6700\u8FD1\u306E\u8A18\u4E8B",
          lastFewNotes: /* @__PURE__ */ __name(({ count }) => `\u6700\u65B0\u306E${count}\u4EF6`, "lastFewNotes")
        },
        error: {
          title: "Not Found",
          notFound: "\u30DA\u30FC\u30B8\u304C\u5B58\u5728\u3057\u306A\u3044\u304B\u3001\u975E\u516C\u958B\u8A2D\u5B9A\u306B\u306A\u3063\u3066\u3044\u307E\u3059\u3002",
          home: "\u30DB\u30FC\u30E0\u30DA\u30FC\u30B8\u306B\u623B\u308B"
        },
        folderContent: {
          folder: "\u30D5\u30A9\u30EB\u30C0",
          itemsUnderFolder: /* @__PURE__ */ __name(({ count }) => `${count}\u4EF6\u306E\u30DA\u30FC\u30B8`, "itemsUnderFolder")
        },
        tagContent: {
          tag: "\u30BF\u30B0",
          tagIndex: "\u30BF\u30B0\u4E00\u89A7",
          itemsUnderTag: /* @__PURE__ */ __name(({ count }) => `${count}\u4EF6\u306E\u30DA\u30FC\u30B8`, "itemsUnderTag"),
          showingFirst: /* @__PURE__ */ __name(({ count }) => `\u306E\u3046\u3061\u6700\u521D\u306E${count}\u4EF6\u3092\u8868\u793A\u3057\u3066\u3044\u307E\u3059`, "showingFirst"),
          totalTags: /* @__PURE__ */ __name(({ count }) => `\u5168${count}\u500B\u306E\u30BF\u30B0\u3092\u8868\u793A\u4E2D`, "totalTags")
        }
      }
    };
  }
});

// quartz/i18n/locales/de-DE.ts
var de_DE_default;
var init_de_DE = __esm({
  "quartz/i18n/locales/de-DE.ts"() {
    "use strict";
    de_DE_default = {
      propertyDefaults: {
        title: "Unbenannt",
        description: "Keine Beschreibung angegeben"
      },
      components: {
        callout: {
          note: "Hinweis",
          abstract: "Zusammenfassung",
          info: "Info",
          todo: "Zu erledigen",
          tip: "Tipp",
          success: "Erfolg",
          question: "Frage",
          warning: "Warnung",
          failure: "Fehlgeschlagen",
          danger: "Gefahr",
          bug: "Fehler",
          example: "Beispiel",
          quote: "Zitat"
        },
        backlinks: {
          title: "Backlinks",
          noBacklinksFound: "Keine Backlinks gefunden"
        },
        themeToggle: {
          lightMode: "Heller Modus",
          darkMode: "Dunkler Modus"
        },
        readerMode: {
          title: "Lesemodus"
        },
        explorer: {
          title: "Explorer"
        },
        footer: {
          createdWith: "Erstellt mit"
        },
        graph: {
          title: "Graphansicht"
        },
        recentNotes: {
          title: "Zuletzt bearbeitete Seiten",
          seeRemainingMore: /* @__PURE__ */ __name(({ remaining }) => `${remaining} weitere ansehen \u2192`, "seeRemainingMore")
        },
        transcludes: {
          transcludeOf: /* @__PURE__ */ __name(({ targetSlug }) => `Transklusion von ${targetSlug}`, "transcludeOf"),
          linkToOriginal: "Link zum Original"
        },
        search: {
          title: "Suche",
          searchBarPlaceholder: "Suche nach etwas"
        },
        tableOfContents: {
          title: "Inhaltsverzeichnis"
        },
        contentMeta: {
          readingTime: /* @__PURE__ */ __name(({ minutes }) => `${minutes} Min. Lesezeit`, "readingTime")
        }
      },
      pages: {
        rss: {
          recentNotes: "Zuletzt bearbeitete Seiten",
          lastFewNotes: /* @__PURE__ */ __name(({ count }) => `Letzte ${count} Seiten`, "lastFewNotes")
        },
        error: {
          title: "Nicht gefunden",
          notFound: "Diese Seite ist entweder nicht \xF6ffentlich oder existiert nicht.",
          home: "Zur Startseite"
        },
        folderContent: {
          folder: "Ordner",
          itemsUnderFolder: /* @__PURE__ */ __name(({ count }) => count === 1 ? "1 Datei in diesem Ordner." : `${count} Dateien in diesem Ordner.`, "itemsUnderFolder")
        },
        tagContent: {
          tag: "Tag",
          tagIndex: "Tag-\xDCbersicht",
          itemsUnderTag: /* @__PURE__ */ __name(({ count }) => count === 1 ? "1 Datei mit diesem Tag." : `${count} Dateien mit diesem Tag.`, "itemsUnderTag"),
          showingFirst: /* @__PURE__ */ __name(({ count }) => `Die ersten ${count} Tags werden angezeigt.`, "showingFirst"),
          totalTags: /* @__PURE__ */ __name(({ count }) => `${count} Tags insgesamt.`, "totalTags")
        }
      }
    };
  }
});

// quartz/i18n/locales/nl-NL.ts
var nl_NL_default;
var init_nl_NL = __esm({
  "quartz/i18n/locales/nl-NL.ts"() {
    "use strict";
    nl_NL_default = {
      propertyDefaults: {
        title: "Naamloos",
        description: "Geen beschrijving gegeven."
      },
      components: {
        callout: {
          note: "Notitie",
          abstract: "Samenvatting",
          info: "Info",
          todo: "Te doen",
          tip: "Tip",
          success: "Succes",
          question: "Vraag",
          warning: "Waarschuwing",
          failure: "Mislukking",
          danger: "Gevaar",
          bug: "Bug",
          example: "Voorbeeld",
          quote: "Citaat"
        },
        backlinks: {
          title: "Backlinks",
          noBacklinksFound: "Geen backlinks gevonden"
        },
        themeToggle: {
          lightMode: "Lichte modus",
          darkMode: "Donkere modus"
        },
        readerMode: {
          title: "Leesmodus"
        },
        explorer: {
          title: "Verkenner"
        },
        footer: {
          createdWith: "Gemaakt met"
        },
        graph: {
          title: "Grafiekweergave"
        },
        recentNotes: {
          title: "Recente notities",
          seeRemainingMore: /* @__PURE__ */ __name(({ remaining }) => `Zie ${remaining} meer \u2192`, "seeRemainingMore")
        },
        transcludes: {
          transcludeOf: /* @__PURE__ */ __name(({ targetSlug }) => `Invoeging van ${targetSlug}`, "transcludeOf"),
          linkToOriginal: "Link naar origineel"
        },
        search: {
          title: "Zoeken",
          searchBarPlaceholder: "Doorzoek de website"
        },
        tableOfContents: {
          title: "Inhoudsopgave"
        },
        contentMeta: {
          readingTime: /* @__PURE__ */ __name(({ minutes }) => minutes === 1 ? "1 minuut leestijd" : `${minutes} minuten leestijd`, "readingTime")
        }
      },
      pages: {
        rss: {
          recentNotes: "Recente notities",
          lastFewNotes: /* @__PURE__ */ __name(({ count }) => `Laatste ${count} notities`, "lastFewNotes")
        },
        error: {
          title: "Niet gevonden",
          notFound: "Deze pagina is niet zichtbaar of bestaat niet.",
          home: "Keer terug naar de start pagina"
        },
        folderContent: {
          folder: "Map",
          itemsUnderFolder: /* @__PURE__ */ __name(({ count }) => count === 1 ? "1 item in deze map." : `${count} items in deze map.`, "itemsUnderFolder")
        },
        tagContent: {
          tag: "Label",
          tagIndex: "Label-index",
          itemsUnderTag: /* @__PURE__ */ __name(({ count }) => count === 1 ? "1 item met dit label." : `${count} items met dit label.`, "itemsUnderTag"),
          showingFirst: /* @__PURE__ */ __name(({ count }) => count === 1 ? "Eerste label tonen." : `Eerste ${count} labels tonen.`, "showingFirst"),
          totalTags: /* @__PURE__ */ __name(({ count }) => `${count} labels gevonden.`, "totalTags")
        }
      }
    };
  }
});

// quartz/i18n/locales/ro-RO.ts
var ro_RO_default;
var init_ro_RO = __esm({
  "quartz/i18n/locales/ro-RO.ts"() {
    "use strict";
    ro_RO_default = {
      propertyDefaults: {
        title: "F\u0103r\u0103 titlu",
        description: "Nici o descriere furnizat\u0103"
      },
      components: {
        callout: {
          note: "Not\u0103",
          abstract: "Rezumat",
          info: "Informa\u021Bie",
          todo: "De f\u0103cut",
          tip: "Sfat",
          success: "Succes",
          question: "\xCEntrebare",
          warning: "Avertisment",
          failure: "E\u0219ec",
          danger: "Pericol",
          bug: "Bug",
          example: "Exemplu",
          quote: "Citat"
        },
        backlinks: {
          title: "Leg\u0103turi \xEEnapoi",
          noBacklinksFound: "Nu s-au g\u0103sit leg\u0103turi \xEEnapoi"
        },
        themeToggle: {
          lightMode: "Modul luminos",
          darkMode: "Modul \xEEntunecat"
        },
        readerMode: {
          title: "Modul de citire"
        },
        explorer: {
          title: "Explorator"
        },
        footer: {
          createdWith: "Creat cu"
        },
        graph: {
          title: "Graf"
        },
        recentNotes: {
          title: "Noti\u021Be recente",
          seeRemainingMore: /* @__PURE__ */ __name(({ remaining }) => `Vezi \xEEnc\u0103 ${remaining} \u2192`, "seeRemainingMore")
        },
        transcludes: {
          transcludeOf: /* @__PURE__ */ __name(({ targetSlug }) => `Extras din ${targetSlug}`, "transcludeOf"),
          linkToOriginal: "Leg\u0103tur\u0103 c\u0103tre original"
        },
        search: {
          title: "C\u0103utare",
          searchBarPlaceholder: "Introduce\u021Bi termenul de c\u0103utare..."
        },
        tableOfContents: {
          title: "Cuprins"
        },
        contentMeta: {
          readingTime: /* @__PURE__ */ __name(({ minutes }) => minutes == 1 ? `lectur\u0103 de 1 minut` : `lectur\u0103 de ${minutes} minute`, "readingTime")
        }
      },
      pages: {
        rss: {
          recentNotes: "Noti\u021Be recente",
          lastFewNotes: /* @__PURE__ */ __name(({ count }) => `Ultimele ${count} noti\u021Be`, "lastFewNotes")
        },
        error: {
          title: "Pagina nu a fost g\u0103sit\u0103",
          notFound: "Fie aceast\u0103 pagin\u0103 este privat\u0103, fie nu exist\u0103.",
          home: "Reveni\u021Bi la pagina de pornire"
        },
        folderContent: {
          folder: "Dosar",
          itemsUnderFolder: /* @__PURE__ */ __name(({ count }) => count === 1 ? "1 articol \xEEn acest dosar." : `${count} elemente \xEEn acest dosar.`, "itemsUnderFolder")
        },
        tagContent: {
          tag: "Etichet\u0103",
          tagIndex: "Indexul etichetelor",
          itemsUnderTag: /* @__PURE__ */ __name(({ count }) => count === 1 ? "1 articol cu aceast\u0103 etichet\u0103." : `${count} articole cu aceast\u0103 etichet\u0103.`, "itemsUnderTag"),
          showingFirst: /* @__PURE__ */ __name(({ count }) => `Se afi\u0219eaz\u0103 primele ${count} etichete.`, "showingFirst"),
          totalTags: /* @__PURE__ */ __name(({ count }) => `Au fost g\u0103site ${count} etichete \xEEn total.`, "totalTags")
        }
      }
    };
  }
});

// quartz/i18n/locales/ca-ES.ts
var ca_ES_default;
var init_ca_ES = __esm({
  "quartz/i18n/locales/ca-ES.ts"() {
    "use strict";
    ca_ES_default = {
      propertyDefaults: {
        title: "Sense t\xEDtol",
        description: "Sense descripci\xF3"
      },
      components: {
        callout: {
          note: "Nota",
          abstract: "Resum",
          info: "Informaci\xF3",
          todo: "Per fer",
          tip: "Consell",
          success: "\xC8xit",
          question: "Pregunta",
          warning: "Advert\xE8ncia",
          failure: "Fall",
          danger: "Perill",
          bug: "Error",
          example: "Exemple",
          quote: "Cita"
        },
        backlinks: {
          title: "Retroenlla\xE7",
          noBacklinksFound: "No s'han trobat retroenlla\xE7os"
        },
        themeToggle: {
          lightMode: "Mode clar",
          darkMode: "Mode fosc"
        },
        readerMode: {
          title: "Mode lector"
        },
        explorer: {
          title: "Explorador"
        },
        footer: {
          createdWith: "Creat amb"
        },
        graph: {
          title: "Vista Gr\xE0fica"
        },
        recentNotes: {
          title: "Notes Recents",
          seeRemainingMore: /* @__PURE__ */ __name(({ remaining }) => `Vegi ${remaining} m\xE9s \u2192`, "seeRemainingMore")
        },
        transcludes: {
          transcludeOf: /* @__PURE__ */ __name(({ targetSlug }) => `Transcluit de ${targetSlug}`, "transcludeOf"),
          linkToOriginal: "Enlla\xE7 a l'original"
        },
        search: {
          title: "Cercar",
          searchBarPlaceholder: "Cerca alguna cosa"
        },
        tableOfContents: {
          title: "Taula de Continguts"
        },
        contentMeta: {
          readingTime: /* @__PURE__ */ __name(({ minutes }) => `Es llegeix en ${minutes} min`, "readingTime")
        }
      },
      pages: {
        rss: {
          recentNotes: "Notes recents",
          lastFewNotes: /* @__PURE__ */ __name(({ count }) => `\xDAltimes ${count} notes`, "lastFewNotes")
        },
        error: {
          title: "No s'ha trobat.",
          notFound: "Aquesta p\xE0gina \xE9s privada o no existeix.",
          home: "Torna a la p\xE0gina principal"
        },
        folderContent: {
          folder: "Carpeta",
          itemsUnderFolder: /* @__PURE__ */ __name(({ count }) => count === 1 ? "1 article en aquesta carpeta." : `${count} articles en esta carpeta.`, "itemsUnderFolder")
        },
        tagContent: {
          tag: "Etiqueta",
          tagIndex: "\xEDndex d'Etiquetes",
          itemsUnderTag: /* @__PURE__ */ __name(({ count }) => count === 1 ? "1 article amb aquesta etiqueta." : `${count} article amb aquesta etiqueta.`, "itemsUnderTag"),
          showingFirst: /* @__PURE__ */ __name(({ count }) => `Mostrant les primeres ${count} etiquetes.`, "showingFirst"),
          totalTags: /* @__PURE__ */ __name(({ count }) => `S'han trobat ${count} etiquetes en total.`, "totalTags")
        }
      }
    };
  }
});

// quartz/i18n/locales/es-ES.ts
var es_ES_default;
var init_es_ES = __esm({
  "quartz/i18n/locales/es-ES.ts"() {
    "use strict";
    es_ES_default = {
      propertyDefaults: {
        title: "Sin t\xEDtulo",
        description: "Sin descripci\xF3n"
      },
      components: {
        callout: {
          note: "Nota",
          abstract: "Resumen",
          info: "Informaci\xF3n",
          todo: "Por hacer",
          tip: "Consejo",
          success: "\xC9xito",
          question: "Pregunta",
          warning: "Advertencia",
          failure: "Fallo",
          danger: "Peligro",
          bug: "Error",
          example: "Ejemplo",
          quote: "Cita"
        },
        backlinks: {
          title: "Retroenlaces",
          noBacklinksFound: "No se han encontrado retroenlaces"
        },
        themeToggle: {
          lightMode: "Modo claro",
          darkMode: "Modo oscuro"
        },
        readerMode: {
          title: "Modo lector"
        },
        explorer: {
          title: "Explorador"
        },
        footer: {
          createdWith: "Creado con"
        },
        graph: {
          title: "Vista Gr\xE1fica"
        },
        recentNotes: {
          title: "Notas Recientes",
          seeRemainingMore: /* @__PURE__ */ __name(({ remaining }) => `Vea ${remaining} m\xE1s \u2192`, "seeRemainingMore")
        },
        transcludes: {
          transcludeOf: /* @__PURE__ */ __name(({ targetSlug }) => `Transcluido de ${targetSlug}`, "transcludeOf"),
          linkToOriginal: "Enlace al original"
        },
        search: {
          title: "Buscar",
          searchBarPlaceholder: "Busca algo"
        },
        tableOfContents: {
          title: "Tabla de Contenidos"
        },
        contentMeta: {
          readingTime: /* @__PURE__ */ __name(({ minutes }) => `Se lee en ${minutes} min`, "readingTime")
        }
      },
      pages: {
        rss: {
          recentNotes: "Notas recientes",
          lastFewNotes: /* @__PURE__ */ __name(({ count }) => `\xDAltimas ${count} notas`, "lastFewNotes")
        },
        error: {
          title: "No se ha encontrado.",
          notFound: "Esta p\xE1gina es privada o no existe.",
          home: "Regresa a la p\xE1gina principal"
        },
        folderContent: {
          folder: "Carpeta",
          itemsUnderFolder: /* @__PURE__ */ __name(({ count }) => count === 1 ? "1 art\xEDculo en esta carpeta." : `${count} art\xEDculos en esta carpeta.`, "itemsUnderFolder")
        },
        tagContent: {
          tag: "Etiqueta",
          tagIndex: "\xCDndice de Etiquetas",
          itemsUnderTag: /* @__PURE__ */ __name(({ count }) => count === 1 ? "1 art\xEDculo con esta etiqueta." : `${count} art\xEDculos con esta etiqueta.`, "itemsUnderTag"),
          showingFirst: /* @__PURE__ */ __name(({ count }) => `Mostrando las primeras ${count} etiquetas.`, "showingFirst"),
          totalTags: /* @__PURE__ */ __name(({ count }) => `Se han encontrado ${count} etiquetas en total.`, "totalTags")
        }
      }
    };
  }
});

// quartz/i18n/locales/ar-SA.ts
var ar_SA_default;
var init_ar_SA = __esm({
  "quartz/i18n/locales/ar-SA.ts"() {
    "use strict";
    ar_SA_default = {
      propertyDefaults: {
        title: "\u063A\u064A\u0631 \u0645\u0639\u0646\u0648\u0646",
        description: "\u0644\u0645 \u064A\u062A\u0645 \u062A\u0642\u062F\u064A\u0645 \u0623\u064A \u0648\u0635\u0641"
      },
      direction: "rtl",
      components: {
        callout: {
          note: "\u0645\u0644\u0627\u062D\u0638\u0629",
          abstract: "\u0645\u0644\u062E\u0635",
          info: "\u0645\u0639\u0644\u0648\u0645\u0627\u062A",
          todo: "\u0644\u0644\u0642\u064A\u0627\u0645",
          tip: "\u0646\u0635\u064A\u062D\u0629",
          success: "\u0646\u062C\u0627\u062D",
          question: "\u0633\u0624\u0627\u0644",
          warning: "\u062A\u062D\u0630\u064A\u0631",
          failure: "\u0641\u0634\u0644",
          danger: "\u062E\u0637\u0631",
          bug: "\u062E\u0644\u0644",
          example: "\u0645\u062B\u0627\u0644",
          quote: "\u0627\u0642\u062A\u0628\u0627\u0633"
        },
        backlinks: {
          title: "\u0648\u0635\u0644\u0627\u062A \u0627\u0644\u0639\u0648\u062F\u0629",
          noBacklinksFound: "\u0644\u0627 \u064A\u0648\u062C\u062F \u0648\u0635\u0644\u0627\u062A \u0639\u0648\u062F\u0629"
        },
        themeToggle: {
          lightMode: "\u0627\u0644\u0648\u0636\u0639 \u0627\u0644\u0646\u0647\u0627\u0631\u064A",
          darkMode: "\u0627\u0644\u0648\u0636\u0639 \u0627\u0644\u0644\u064A\u0644\u064A"
        },
        explorer: {
          title: "\u0627\u0644\u0645\u0633\u062A\u0639\u0631\u0636"
        },
        readerMode: {
          title: "\u0648\u0636\u0639 \u0627\u0644\u0642\u0627\u0631\u0626"
        },
        footer: {
          createdWith: "\u0623\u064F\u0646\u0634\u0626 \u0628\u0627\u0633\u062A\u062E\u062F\u0627\u0645"
        },
        graph: {
          title: "\u0627\u0644\u062A\u0645\u062B\u064A\u0644 \u0627\u0644\u062A\u0641\u0627\u0639\u0644\u064A"
        },
        recentNotes: {
          title: "\u0622\u062E\u0631 \u0627\u0644\u0645\u0644\u0627\u062D\u0638\u0627\u062A",
          seeRemainingMore: /* @__PURE__ */ __name(({ remaining }) => `\u062A\u0635\u0641\u062D ${remaining} \u0623\u0643\u062B\u0631 \u2192`, "seeRemainingMore")
        },
        transcludes: {
          transcludeOf: /* @__PURE__ */ __name(({ targetSlug }) => `\u0645\u0642\u062A\u0628\u0633 \u0645\u0646 ${targetSlug}`, "transcludeOf"),
          linkToOriginal: "\u0648\u0635\u0644\u0629 \u0644\u0644\u0645\u0644\u0627\u062D\u0638\u0629 \u0627\u0644\u0631\u0626\u064A\u0633\u0629"
        },
        search: {
          title: "\u0628\u062D\u062B",
          searchBarPlaceholder: "\u0627\u0628\u062D\u062B \u0639\u0646 \u0634\u064A\u0621 \u0645\u0627"
        },
        tableOfContents: {
          title: "\u0641\u0647\u0631\u0633 \u0627\u0644\u0645\u062D\u062A\u0648\u064A\u0627\u062A"
        },
        contentMeta: {
          readingTime: /* @__PURE__ */ __name(({ minutes }) => minutes == 1 ? `\u062F\u0642\u064A\u0642\u0629 \u0623\u0648 \u0623\u0642\u0644 \u0644\u0644\u0642\u0631\u0627\u0621\u0629` : minutes == 2 ? `\u062F\u0642\u064A\u0642\u062A\u0627\u0646 \u0644\u0644\u0642\u0631\u0627\u0621\u0629` : `${minutes} \u062F\u0642\u0627\u0626\u0642 \u0644\u0644\u0642\u0631\u0627\u0621\u0629`, "readingTime")
        }
      },
      pages: {
        rss: {
          recentNotes: "\u0622\u062E\u0631 \u0627\u0644\u0645\u0644\u0627\u062D\u0638\u0627\u062A",
          lastFewNotes: /* @__PURE__ */ __name(({ count }) => `\u0622\u062E\u0631 ${count} \u0645\u0644\u0627\u062D\u0638\u0629`, "lastFewNotes")
        },
        error: {
          title: "\u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F",
          notFound: "\u0625\u0645\u0627 \u0623\u0646 \u0647\u0630\u0647 \u0627\u0644\u0635\u0641\u062D\u0629 \u062E\u0627\u0635\u0629 \u0623\u0648 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F\u0629.",
          home: "\u0627\u0644\u0639\u0648\u062F\u0647 \u0644\u0644\u0635\u0641\u062D\u0629 \u0627\u0644\u0631\u0626\u064A\u0633\u064A\u0629"
        },
        folderContent: {
          folder: "\u0645\u062C\u0644\u062F",
          itemsUnderFolder: /* @__PURE__ */ __name(({ count }) => count === 1 ? "\u064A\u0648\u062C\u062F \u0639\u0646\u0635\u0631 \u0648\u0627\u062D\u062F \u0641\u0642\u0637 \u062A\u062D\u062A \u0647\u0630\u0627 \u0627\u0644\u0645\u062C\u0644\u062F" : `\u064A\u0648\u062C\u062F ${count} \u0639\u0646\u0627\u0635\u0631 \u062A\u062D\u062A \u0647\u0630\u0627 \u0627\u0644\u0645\u062C\u0644\u062F.`, "itemsUnderFolder")
        },
        tagContent: {
          tag: "\u0627\u0644\u0648\u0633\u0645",
          tagIndex: "\u0645\u0624\u0634\u0631 \u0627\u0644\u0648\u0633\u0645",
          itemsUnderTag: /* @__PURE__ */ __name(({ count }) => count === 1 ? "\u064A\u0648\u062C\u062F \u0639\u0646\u0635\u0631 \u0648\u0627\u062D\u062F \u0641\u0642\u0637 \u062A\u062D\u062A \u0647\u0630\u0627 \u0627\u0644\u0648\u0633\u0645" : `\u064A\u0648\u062C\u062F ${count} \u0639\u0646\u0627\u0635\u0631 \u062A\u062D\u062A \u0647\u0630\u0627 \u0627\u0644\u0648\u0633\u0645.`, "itemsUnderTag"),
          showingFirst: /* @__PURE__ */ __name(({ count }) => `\u0625\u0638\u0647\u0627\u0631 \u0623\u0648\u0644 ${count} \u0623\u0648\u0633\u0645\u0629.`, "showingFirst"),
          totalTags: /* @__PURE__ */ __name(({ count }) => `\u064A\u0648\u062C\u062F ${count} \u0623\u0648\u0633\u0645\u0629.`, "totalTags")
        }
      }
    };
  }
});

// quartz/i18n/locales/uk-UA.ts
var uk_UA_default;
var init_uk_UA = __esm({
  "quartz/i18n/locales/uk-UA.ts"() {
    "use strict";
    uk_UA_default = {
      propertyDefaults: {
        title: "\u0411\u0435\u0437 \u043D\u0430\u0437\u0432\u0438",
        description: "\u041E\u043F\u0438\u0441 \u043D\u0435 \u043D\u0430\u0434\u0430\u043D\u043E"
      },
      components: {
        callout: {
          note: "\u041F\u0440\u0438\u043C\u0456\u0442\u043A\u0430",
          abstract: "\u0410\u0431\u0441\u0442\u0440\u0430\u043A\u0442",
          info: "\u0406\u043D\u0444\u043E\u0440\u043C\u0430\u0446\u0456\u044F",
          todo: "\u0417\u0430\u0432\u0434\u0430\u043D\u043D\u044F",
          tip: "\u041F\u043E\u0440\u0430\u0434\u0430",
          success: "\u0423\u0441\u043F\u0456\u0445",
          question: "\u041F\u0438\u0442\u0430\u043D\u043D\u044F",
          warning: "\u041F\u043E\u043F\u0435\u0440\u0435\u0434\u0436\u0435\u043D\u043D\u044F",
          failure: "\u041D\u0435\u0432\u0434\u0430\u0447\u0430",
          danger: "\u041D\u0435\u0431\u0435\u0437\u043F\u0435\u043A\u0430",
          bug: "\u0411\u0430\u0433",
          example: "\u041F\u0440\u0438\u043A\u043B\u0430\u0434",
          quote: "\u0426\u0438\u0442\u0430\u0442\u0430"
        },
        backlinks: {
          title: "\u0417\u0432\u043E\u0440\u043E\u0442\u043D\u0456 \u043F\u043E\u0441\u0438\u043B\u0430\u043D\u043D\u044F",
          noBacklinksFound: "\u0417\u0432\u043E\u0440\u043E\u0442\u043D\u0438\u0445 \u043F\u043E\u0441\u0438\u043B\u0430\u043D\u044C \u043D\u0435 \u0437\u043D\u0430\u0439\u0434\u0435\u043D\u043E"
        },
        themeToggle: {
          lightMode: "\u0421\u0432\u0456\u0442\u043B\u0438\u0439 \u0440\u0435\u0436\u0438\u043C",
          darkMode: "\u0422\u0435\u043C\u043D\u0438\u0439 \u0440\u0435\u0436\u0438\u043C"
        },
        readerMode: {
          title: "\u0420\u0435\u0436\u0438\u043C \u0447\u0438\u0442\u0430\u043D\u043D\u044F"
        },
        explorer: {
          title: "\u041F\u0440\u043E\u0432\u0456\u0434\u043D\u0438\u043A"
        },
        footer: {
          createdWith: "\u0421\u0442\u0432\u043E\u0440\u0435\u043D\u043E \u0437\u0430 \u0434\u043E\u043F\u043E\u043C\u043E\u0433\u043E\u044E"
        },
        graph: {
          title: "\u0412\u0438\u0433\u043B\u044F\u0434 \u0433\u0440\u0430\u0444\u0430"
        },
        recentNotes: {
          title: "\u041E\u0441\u0442\u0430\u043D\u043D\u0456 \u043D\u043E\u0442\u0430\u0442\u043A\u0438",
          seeRemainingMore: /* @__PURE__ */ __name(({ remaining }) => `\u041F\u0435\u0440\u0435\u0433\u043B\u044F\u043D\u0443\u0442\u0438 \u0449\u0435 ${remaining} \u2192`, "seeRemainingMore")
        },
        transcludes: {
          transcludeOf: /* @__PURE__ */ __name(({ targetSlug }) => `\u0412\u0438\u0434\u043E\u0431\u0443\u0442\u043E \u0437 ${targetSlug}`, "transcludeOf"),
          linkToOriginal: "\u041F\u043E\u0441\u0438\u043B\u0430\u043D\u043D\u044F \u043D\u0430 \u043E\u0440\u0438\u0433\u0456\u043D\u0430\u043B"
        },
        search: {
          title: "\u041F\u043E\u0448\u0443\u043A",
          searchBarPlaceholder: "\u0428\u0443\u043A\u0430\u0442\u0438 \u0449\u043E\u0441\u044C"
        },
        tableOfContents: {
          title: "\u0417\u043C\u0456\u0441\u0442"
        },
        contentMeta: {
          readingTime: /* @__PURE__ */ __name(({ minutes }) => `${minutes} \u0445\u0432 \u0447\u0438\u0442\u0430\u043D\u043D\u044F`, "readingTime")
        }
      },
      pages: {
        rss: {
          recentNotes: "\u041E\u0441\u0442\u0430\u043D\u043D\u0456 \u043D\u043E\u0442\u0430\u0442\u043A\u0438",
          lastFewNotes: /* @__PURE__ */ __name(({ count }) => `\u041E\u0441\u0442\u0430\u043D\u043D\u0456 \u043D\u043E\u0442\u0430\u0442\u043A\u0438: ${count}`, "lastFewNotes")
        },
        error: {
          title: "\u041D\u0435 \u0437\u043D\u0430\u0439\u0434\u0435\u043D\u043E",
          notFound: "\u0426\u044F \u0441\u0442\u043E\u0440\u0456\u043D\u043A\u0430 \u0430\u0431\u043E \u043F\u0440\u0438\u0432\u0430\u0442\u043D\u0430, \u0430\u0431\u043E \u043D\u0435 \u0456\u0441\u043D\u0443\u0454.",
          home: "\u041F\u043E\u0432\u0435\u0440\u043D\u0443\u0442\u0438\u0441\u044F \u043D\u0430 \u0433\u043E\u043B\u043E\u0432\u043D\u0443 \u0441\u0442\u043E\u0440\u0456\u043D\u043A\u0443"
        },
        folderContent: {
          folder: "\u0422\u0435\u043A\u0430",
          itemsUnderFolder: /* @__PURE__ */ __name(({ count }) => count === 1 ? "\u0423 \u0446\u0456\u0439 \u0442\u0435\u0446\u0456 1 \u0435\u043B\u0435\u043C\u0435\u043D\u0442." : `\u0415\u043B\u0435\u043C\u0435\u043D\u0442\u0456\u0432 \u0443 \u0446\u0456\u0439 \u0442\u0435\u0446\u0456: ${count}.`, "itemsUnderFolder")
        },
        tagContent: {
          tag: "\u041C\u0456\u0442\u043A\u0430",
          tagIndex: "\u0406\u043D\u0434\u0435\u043A\u0441 \u043C\u0456\u0442\u043A\u0438",
          itemsUnderTag: /* @__PURE__ */ __name(({ count }) => count === 1 ? "1 \u0435\u043B\u0435\u043C\u0435\u043D\u0442 \u0437 \u0446\u0456\u0454\u044E \u043C\u0456\u0442\u043A\u043E\u044E." : `\u0415\u043B\u0435\u043C\u0435\u043D\u0442\u0456\u0432 \u0437 \u0446\u0456\u0454\u044E \u043C\u0456\u0442\u043A\u043E\u044E: ${count}.`, "itemsUnderTag"),
          showingFirst: /* @__PURE__ */ __name(({ count }) => `\u041F\u043E\u043A\u0430\u0437 \u043F\u0435\u0440\u0448\u0438\u0445 ${count} \u043C\u0456\u0442\u043E\u043A.`, "showingFirst"),
          totalTags: /* @__PURE__ */ __name(({ count }) => `\u0412\u0441\u044C\u043E\u0433\u043E \u0437\u043D\u0430\u0439\u0434\u0435\u043D\u043E \u043C\u0456\u0442\u043E\u043A: ${count}.`, "totalTags")
        }
      }
    };
  }
});

// quartz/i18n/locales/ru-RU.ts
function getForm(number, form1, form2, form5) {
  const remainder100 = number % 100;
  const remainder10 = remainder100 % 10;
  if (remainder100 >= 10 && remainder100 <= 20) return form5;
  if (remainder10 > 1 && remainder10 < 5) return form2;
  if (remainder10 == 1) return form1;
  return form5;
}
var ru_RU_default;
var init_ru_RU = __esm({
  "quartz/i18n/locales/ru-RU.ts"() {
    "use strict";
    ru_RU_default = {
      propertyDefaults: {
        title: "\u0411\u0435\u0437 \u043D\u0430\u0437\u0432\u0430\u043D\u0438\u044F",
        description: "\u041E\u043F\u0438\u0441\u0430\u043D\u0438\u0435 \u043E\u0442\u0441\u0443\u0442\u0441\u0442\u0432\u0443\u0435\u0442"
      },
      components: {
        callout: {
          note: "\u0417\u0430\u043C\u0435\u0442\u043A\u0430",
          abstract: "\u0420\u0435\u0437\u044E\u043C\u0435",
          info: "\u0418\u043D\u0444\u043E",
          todo: "\u0421\u0434\u0435\u043B\u0430\u0442\u044C",
          tip: "\u041F\u043E\u0434\u0441\u043A\u0430\u0437\u043A\u0430",
          success: "\u0423\u0441\u043F\u0435\u0445",
          question: "\u0412\u043E\u043F\u0440\u043E\u0441",
          warning: "\u041F\u0440\u0435\u0434\u0443\u043F\u0440\u0435\u0436\u0434\u0435\u043D\u0438\u0435",
          failure: "\u041D\u0435\u0443\u0434\u0430\u0447\u0430",
          danger: "\u041E\u043F\u0430\u0441\u043D\u043E\u0441\u0442\u044C",
          bug: "\u0411\u0430\u0433",
          example: "\u041F\u0440\u0438\u043C\u0435\u0440",
          quote: "\u0426\u0438\u0442\u0430\u0442\u0430"
        },
        backlinks: {
          title: "\u041E\u0431\u0440\u0430\u0442\u043D\u044B\u0435 \u0441\u0441\u044B\u043B\u043A\u0438",
          noBacklinksFound: "\u041E\u0431\u0440\u0430\u0442\u043D\u044B\u0435 \u0441\u0441\u044B\u043B\u043A\u0438 \u043E\u0442\u0441\u0443\u0442\u0441\u0442\u0432\u0443\u044E\u0442"
        },
        themeToggle: {
          lightMode: "\u0421\u0432\u0435\u0442\u043B\u044B\u0439 \u0440\u0435\u0436\u0438\u043C",
          darkMode: "\u0422\u0451\u043C\u043D\u044B\u0439 \u0440\u0435\u0436\u0438\u043C"
        },
        readerMode: {
          title: "\u0420\u0435\u0436\u0438\u043C \u0447\u0442\u0435\u043D\u0438\u044F"
        },
        explorer: {
          title: "\u041F\u0440\u043E\u0432\u043E\u0434\u043D\u0438\u043A"
        },
        footer: {
          createdWith: "\u0421\u043E\u0437\u0434\u0430\u043D\u043E \u0441 \u043F\u043E\u043C\u043E\u0449\u044C\u044E"
        },
        graph: {
          title: "\u0412\u0438\u0434 \u0433\u0440\u0430\u0444\u0430"
        },
        recentNotes: {
          title: "\u041D\u0435\u0434\u0430\u0432\u043D\u0438\u0435 \u0437\u0430\u043C\u0435\u0442\u043A\u0438",
          seeRemainingMore: /* @__PURE__ */ __name(({ remaining }) => `\u041F\u043E\u0441\u043C\u043E\u0442\u0440\u0435\u0442\u044C \u043E\u0441\u0442\u0430\u0432\u0448${getForm(remaining, "\u0443\u044E\u0441\u044F", "\u0438\u0435\u0441\u044F", "\u0438\u0435\u0441\u044F")} ${remaining} \u2192`, "seeRemainingMore")
        },
        transcludes: {
          transcludeOf: /* @__PURE__ */ __name(({ targetSlug }) => `\u041F\u0435\u0440\u0435\u0445\u043E\u0434 \u0438\u0437 ${targetSlug}`, "transcludeOf"),
          linkToOriginal: "\u0421\u0441\u044B\u043B\u043A\u0430 \u043D\u0430 \u043E\u0440\u0438\u0433\u0438\u043D\u0430\u043B"
        },
        search: {
          title: "\u041F\u043E\u0438\u0441\u043A",
          searchBarPlaceholder: "\u041D\u0430\u0439\u0442\u0438 \u0447\u0442\u043E-\u043D\u0438\u0431\u0443\u0434\u044C"
        },
        tableOfContents: {
          title: "\u041E\u0433\u043B\u0430\u0432\u043B\u0435\u043D\u0438\u0435"
        },
        contentMeta: {
          readingTime: /* @__PURE__ */ __name(({ minutes }) => `\u0432\u0440\u0435\u043C\u044F \u0447\u0442\u0435\u043D\u0438\u044F ~${minutes} \u043C\u0438\u043D.`, "readingTime")
        }
      },
      pages: {
        rss: {
          recentNotes: "\u041D\u0435\u0434\u0430\u0432\u043D\u0438\u0435 \u0437\u0430\u043C\u0435\u0442\u043A\u0438",
          lastFewNotes: /* @__PURE__ */ __name(({ count }) => `\u041F\u043E\u0441\u043B\u0435\u0434\u043D${getForm(count, "\u044F\u044F", "\u0438\u0435", "\u0438\u0435")} ${count} \u0437\u0430\u043C\u0435\u0442${getForm(count, "\u043A\u0430", "\u043A\u0438", "\u043E\u043A")}`, "lastFewNotes")
        },
        error: {
          title: "\u0421\u0442\u0440\u0430\u043D\u0438\u0446\u0430 \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D\u0430",
          notFound: "\u042D\u0442\u0430 \u0441\u0442\u0440\u0430\u043D\u0438\u0446\u0430 \u043F\u0440\u0438\u0432\u0430\u0442\u043D\u0430\u044F \u0438\u043B\u0438 \u043D\u0435 \u0441\u0443\u0449\u0435\u0441\u0442\u0432\u0443\u0435\u0442",
          home: "\u0412\u0435\u0440\u043D\u0443\u0442\u044C\u0441\u044F \u043D\u0430 \u0433\u043B\u0430\u0432\u043D\u0443\u044E \u0441\u0442\u0440\u0430\u043D\u0438\u0446\u0443"
        },
        folderContent: {
          folder: "\u041F\u0430\u043F\u043A\u0430",
          itemsUnderFolder: /* @__PURE__ */ __name(({ count }) => `\u0432 \u044D\u0442\u043E\u0439 \u043F\u0430\u043F\u043A\u0435 ${count} \u044D\u043B\u0435\u043C\u0435\u043D\u0442${getForm(count, "", "\u0430", "\u043E\u0432")}`, "itemsUnderFolder")
        },
        tagContent: {
          tag: "\u0422\u0435\u0433",
          tagIndex: "\u0418\u043D\u0434\u0435\u043A\u0441 \u0442\u0435\u0433\u043E\u0432",
          itemsUnderTag: /* @__PURE__ */ __name(({ count }) => `\u0441 \u044D\u0442\u0438\u043C \u0442\u0435\u0433\u043E\u043C ${count} \u044D\u043B\u0435\u043C\u0435\u043D\u0442${getForm(count, "", "\u0430", "\u043E\u0432")}`, "itemsUnderTag"),
          showingFirst: /* @__PURE__ */ __name(({ count }) => `\u041F\u043E\u043A\u0430\u0437\u044B\u0432\u0430${getForm(count, "\u0435\u0442\u0441\u044F", "\u044E\u0442\u0441\u044F", "\u044E\u0442\u0441\u044F")} ${count} \u0442\u0435\u0433${getForm(count, "", "\u0430", "\u043E\u0432")}`, "showingFirst"),
          totalTags: /* @__PURE__ */ __name(({ count }) => `\u0412\u0441\u0435\u0433\u043E ${count} \u0442\u0435\u0433${getForm(count, "", "\u0430", "\u043E\u0432")}`, "totalTags")
        }
      }
    };
    __name(getForm, "getForm");
  }
});

// quartz/i18n/locales/ko-KR.ts
var ko_KR_default;
var init_ko_KR = __esm({
  "quartz/i18n/locales/ko-KR.ts"() {
    "use strict";
    ko_KR_default = {
      propertyDefaults: {
        title: "\uC81C\uBAA9 \uC5C6\uC74C",
        description: "\uC124\uBA85 \uC5C6\uC74C"
      },
      components: {
        callout: {
          note: "\uB178\uD2B8",
          abstract: "\uAC1C\uC694",
          info: "\uC815\uBCF4",
          todo: "\uD560\uC77C",
          tip: "\uD301",
          success: "\uC131\uACF5",
          question: "\uC9C8\uBB38",
          warning: "\uC8FC\uC758",
          failure: "\uC2E4\uD328",
          danger: "\uC704\uD5D8",
          bug: "\uBC84\uADF8",
          example: "\uC608\uC2DC",
          quote: "\uC778\uC6A9"
        },
        backlinks: {
          title: "\uBC31\uB9C1\uD06C",
          noBacklinksFound: "\uBC31\uB9C1\uD06C\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4."
        },
        themeToggle: {
          lightMode: "\uB77C\uC774\uD2B8 \uBAA8\uB4DC",
          darkMode: "\uB2E4\uD06C \uBAA8\uB4DC"
        },
        readerMode: {
          title: "\uB9AC\uB354 \uBAA8\uB4DC"
        },
        explorer: {
          title: "\uD0D0\uC0C9\uAE30"
        },
        footer: {
          createdWith: "Created with"
        },
        graph: {
          title: "\uADF8\uB798\uD504 \uBDF0"
        },
        recentNotes: {
          title: "\uCD5C\uADFC \uAC8C\uC2DC\uAE00",
          seeRemainingMore: /* @__PURE__ */ __name(({ remaining }) => `${remaining}\uAC74 \uB354\uBCF4\uAE30 \u2192`, "seeRemainingMore")
        },
        transcludes: {
          transcludeOf: /* @__PURE__ */ __name(({ targetSlug }) => `${targetSlug}\uC758 \uD3EC\uD568`, "transcludeOf"),
          linkToOriginal: "\uC6D0\uBCF8 \uB9C1\uD06C"
        },
        search: {
          title: "\uAC80\uC0C9",
          searchBarPlaceholder: "\uAC80\uC0C9\uC5B4\uB97C \uC785\uB825\uD558\uC138\uC694"
        },
        tableOfContents: {
          title: "\uBAA9\uCC28"
        },
        contentMeta: {
          readingTime: /* @__PURE__ */ __name(({ minutes }) => `${minutes} min read`, "readingTime")
        }
      },
      pages: {
        rss: {
          recentNotes: "\uCD5C\uADFC \uAC8C\uC2DC\uAE00",
          lastFewNotes: /* @__PURE__ */ __name(({ count }) => `\uCD5C\uADFC ${count} \uAC74`, "lastFewNotes")
        },
        error: {
          title: "Not Found",
          notFound: "\uD398\uC774\uC9C0\uAC00 \uC874\uC7AC\uD558\uC9C0 \uC54A\uAC70\uB098 \uBE44\uACF5\uAC1C \uC124\uC815\uC774 \uB418\uC5B4 \uC788\uC2B5\uB2C8\uB2E4.",
          home: "\uD648\uD398\uC774\uC9C0\uB85C \uB3CC\uC544\uAC00\uAE30"
        },
        folderContent: {
          folder: "\uD3F4\uB354",
          itemsUnderFolder: /* @__PURE__ */ __name(({ count }) => `${count}\uAC74\uC758 \uD56D\uBAA9`, "itemsUnderFolder")
        },
        tagContent: {
          tag: "\uD0DC\uADF8",
          tagIndex: "\uD0DC\uADF8 \uBAA9\uB85D",
          itemsUnderTag: /* @__PURE__ */ __name(({ count }) => `${count}\uAC74\uC758 \uD56D\uBAA9`, "itemsUnderTag"),
          showingFirst: /* @__PURE__ */ __name(({ count }) => `\uCC98\uC74C ${count}\uAC1C\uC758 \uD0DC\uADF8`, "showingFirst"),
          totalTags: /* @__PURE__ */ __name(({ count }) => `\uCD1D ${count}\uAC1C\uC758 \uD0DC\uADF8\uB97C \uCC3E\uC558\uC2B5\uB2C8\uB2E4.`, "totalTags")
        }
      }
    };
  }
});

// quartz/i18n/locales/zh-CN.ts
var zh_CN_default;
var init_zh_CN = __esm({
  "quartz/i18n/locales/zh-CN.ts"() {
    "use strict";
    zh_CN_default = {
      propertyDefaults: {
        title: "\u65E0\u9898",
        description: "\u65E0\u63CF\u8FF0"
      },
      components: {
        callout: {
          note: "\u7B14\u8BB0",
          abstract: "\u6458\u8981",
          info: "\u63D0\u793A",
          todo: "\u5F85\u529E",
          tip: "\u63D0\u793A",
          success: "\u6210\u529F",
          question: "\u95EE\u9898",
          warning: "\u8B66\u544A",
          failure: "\u5931\u8D25",
          danger: "\u5371\u9669",
          bug: "\u9519\u8BEF",
          example: "\u793A\u4F8B",
          quote: "\u5F15\u7528"
        },
        backlinks: {
          title: "\u53CD\u5411\u94FE\u63A5",
          noBacklinksFound: "\u65E0\u6CD5\u627E\u5230\u53CD\u5411\u94FE\u63A5"
        },
        themeToggle: {
          lightMode: "\u4EAE\u8272\u6A21\u5F0F",
          darkMode: "\u6697\u8272\u6A21\u5F0F"
        },
        readerMode: {
          title: "\u9605\u8BFB\u6A21\u5F0F"
        },
        explorer: {
          title: "\u63A2\u7D22"
        },
        footer: {
          createdWith: "Created with"
        },
        graph: {
          title: "\u5173\u7CFB\u56FE\u8C31"
        },
        recentNotes: {
          title: "\u6700\u8FD1\u7684\u7B14\u8BB0",
          seeRemainingMore: /* @__PURE__ */ __name(({ remaining }) => `\u67E5\u770B\u66F4\u591A${remaining}\u7BC7\u7B14\u8BB0 \u2192`, "seeRemainingMore")
        },
        transcludes: {
          transcludeOf: /* @__PURE__ */ __name(({ targetSlug }) => `\u5305\u542B${targetSlug}`, "transcludeOf"),
          linkToOriginal: "\u6307\u5411\u539F\u59CB\u7B14\u8BB0\u7684\u94FE\u63A5"
        },
        search: {
          title: "\u641C\u7D22",
          searchBarPlaceholder: "\u641C\u7D22\u4E9B\u4EC0\u4E48"
        },
        tableOfContents: {
          title: "\u76EE\u5F55"
        },
        contentMeta: {
          readingTime: /* @__PURE__ */ __name(({ minutes }) => `${minutes}\u5206\u949F\u9605\u8BFB`, "readingTime")
        }
      },
      pages: {
        rss: {
          recentNotes: "\u6700\u8FD1\u7684\u7B14\u8BB0",
          lastFewNotes: /* @__PURE__ */ __name(({ count }) => `\u6700\u8FD1\u7684${count}\u6761\u7B14\u8BB0`, "lastFewNotes")
        },
        error: {
          title: "\u65E0\u6CD5\u627E\u5230",
          notFound: "\u79C1\u6709\u7B14\u8BB0\u6216\u7B14\u8BB0\u4E0D\u5B58\u5728\u3002",
          home: "\u8FD4\u56DE\u9996\u9875"
        },
        folderContent: {
          folder: "\u6587\u4EF6\u5939",
          itemsUnderFolder: /* @__PURE__ */ __name(({ count }) => `\u6B64\u6587\u4EF6\u5939\u4E0B\u6709${count}\u6761\u7B14\u8BB0\u3002`, "itemsUnderFolder")
        },
        tagContent: {
          tag: "\u6807\u7B7E",
          tagIndex: "\u6807\u7B7E\u7D22\u5F15",
          itemsUnderTag: /* @__PURE__ */ __name(({ count }) => `\u6B64\u6807\u7B7E\u4E0B\u6709${count}\u6761\u7B14\u8BB0\u3002`, "itemsUnderTag"),
          showingFirst: /* @__PURE__ */ __name(({ count }) => `\u663E\u793A\u524D${count}\u4E2A\u6807\u7B7E\u3002`, "showingFirst"),
          totalTags: /* @__PURE__ */ __name(({ count }) => `\u603B\u5171\u6709${count}\u4E2A\u6807\u7B7E\u3002`, "totalTags")
        }
      }
    };
  }
});

// quartz/i18n/locales/zh-TW.ts
var zh_TW_default;
var init_zh_TW = __esm({
  "quartz/i18n/locales/zh-TW.ts"() {
    "use strict";
    zh_TW_default = {
      propertyDefaults: {
        title: "\u7121\u984C",
        description: "\u7121\u63CF\u8FF0"
      },
      components: {
        callout: {
          note: "\u7B46\u8A18",
          abstract: "\u6458\u8981",
          info: "\u63D0\u793A",
          todo: "\u5F85\u8FA6",
          tip: "\u63D0\u793A",
          success: "\u6210\u529F",
          question: "\u554F\u984C",
          warning: "\u8B66\u544A",
          failure: "\u5931\u6557",
          danger: "\u5371\u96AA",
          bug: "\u932F\u8AA4",
          example: "\u7BC4\u4F8B",
          quote: "\u5F15\u7528"
        },
        backlinks: {
          title: "\u53CD\u5411\u9023\u7D50",
          noBacklinksFound: "\u7121\u6CD5\u627E\u5230\u53CD\u5411\u9023\u7D50"
        },
        themeToggle: {
          lightMode: "\u4EAE\u8272\u6A21\u5F0F",
          darkMode: "\u6697\u8272\u6A21\u5F0F"
        },
        readerMode: {
          title: "\u95B1\u8B80\u6A21\u5F0F"
        },
        explorer: {
          title: "\u63A2\u7D22"
        },
        footer: {
          createdWith: "Created with"
        },
        graph: {
          title: "\u95DC\u4FC2\u5716\u8B5C"
        },
        recentNotes: {
          title: "\u6700\u8FD1\u7684\u7B46\u8A18",
          seeRemainingMore: /* @__PURE__ */ __name(({ remaining }) => `\u67E5\u770B\u66F4\u591A ${remaining} \u7BC7\u7B46\u8A18 \u2192`, "seeRemainingMore")
        },
        transcludes: {
          transcludeOf: /* @__PURE__ */ __name(({ targetSlug }) => `\u5305\u542B ${targetSlug}`, "transcludeOf"),
          linkToOriginal: "\u6307\u5411\u539F\u59CB\u7B46\u8A18\u7684\u9023\u7D50"
        },
        search: {
          title: "\u641C\u5C0B",
          searchBarPlaceholder: "\u641C\u5C0B\u4E9B\u4EC0\u9EBC"
        },
        tableOfContents: {
          title: "\u76EE\u9304"
        },
        contentMeta: {
          readingTime: /* @__PURE__ */ __name(({ minutes }) => `\u95B1\u8B80\u6642\u9593\u7D04 ${minutes} \u5206\u9418`, "readingTime")
        }
      },
      pages: {
        rss: {
          recentNotes: "\u6700\u8FD1\u7684\u7B46\u8A18",
          lastFewNotes: /* @__PURE__ */ __name(({ count }) => `\u6700\u8FD1\u7684 ${count} \u689D\u7B46\u8A18`, "lastFewNotes")
        },
        error: {
          title: "\u7121\u6CD5\u627E\u5230",
          notFound: "\u79C1\u4EBA\u7B46\u8A18\u6216\u7B46\u8A18\u4E0D\u5B58\u5728\u3002",
          home: "\u8FD4\u56DE\u9996\u9801"
        },
        folderContent: {
          folder: "\u8CC7\u6599\u593E",
          itemsUnderFolder: /* @__PURE__ */ __name(({ count }) => `\u6B64\u8CC7\u6599\u593E\u4E0B\u6709 ${count} \u689D\u7B46\u8A18\u3002`, "itemsUnderFolder")
        },
        tagContent: {
          tag: "\u6A19\u7C64",
          tagIndex: "\u6A19\u7C64\u7D22\u5F15",
          itemsUnderTag: /* @__PURE__ */ __name(({ count }) => `\u6B64\u6A19\u7C64\u4E0B\u6709 ${count} \u689D\u7B46\u8A18\u3002`, "itemsUnderTag"),
          showingFirst: /* @__PURE__ */ __name(({ count }) => `\u986F\u793A\u524D ${count} \u500B\u6A19\u7C64\u3002`, "showingFirst"),
          totalTags: /* @__PURE__ */ __name(({ count }) => `\u7E3D\u5171\u6709 ${count} \u500B\u6A19\u7C64\u3002`, "totalTags")
        }
      }
    };
  }
});

// quartz/i18n/locales/vi-VN.ts
var vi_VN_default;
var init_vi_VN = __esm({
  "quartz/i18n/locales/vi-VN.ts"() {
    "use strict";
    vi_VN_default = {
      propertyDefaults: {
        title: "Kh\xF4ng c\xF3 ti\xEAu \u0111\u1EC1",
        description: "Kh\xF4ng c\xF3 m\xF4 t\u1EA3"
      },
      components: {
        callout: {
          note: "Ghi ch\xFA",
          abstract: "T\u1ED5ng quan",
          info: "Th\xF4ng tin",
          todo: "C\u1EA7n ph\u1EA3i l\xE0m",
          tip: "G\u1EE3i \xFD",
          success: "Th\xE0nh c\xF4ng",
          question: "C\xE2u h\u1ECFi",
          warning: "C\u1EA3nh b\xE1o",
          failure: "Th\u1EA5t b\u1EA1i",
          danger: "Nguy hi\u1EC3m",
          bug: "L\u1ED7i",
          example: "V\xED d\u1EE5",
          quote: "Tr\xEDch d\u1EABn"
        },
        backlinks: {
          title: "Li\xEAn k\u1EBFt ng\u01B0\u1EE3c",
          noBacklinksFound: "Kh\xF4ng c\xF3 li\xEAn k\u1EBFt ng\u01B0\u1EE3c n\xE0o"
        },
        themeToggle: {
          lightMode: "Ch\u1EBF \u0111\u1ED9 s\xE1ng",
          darkMode: "Ch\u1EBF \u0111\u1ED9 t\u1ED1i"
        },
        readerMode: {
          title: "Ch\u1EBF \u0111\u1ED9 \u0111\u1ECDc"
        },
        explorer: {
          title: "N\u1ED9i dung"
        },
        footer: {
          createdWith: "\u0110\u01B0\u1EE3c t\u1EA1o b\u1EB1ng"
        },
        graph: {
          title: "S\u01A1 \u0111\u1ED3"
        },
        recentNotes: {
          title: "Ghi ch\xFA g\u1EA7n \u0111\xE2y",
          seeRemainingMore: /* @__PURE__ */ __name(({ remaining }) => `Xem th\xEAm ${remaining} ghi ch\xFA \u2192`, "seeRemainingMore")
        },
        transcludes: {
          transcludeOf: /* @__PURE__ */ __name(({ targetSlug }) => `Tr\xEDch d\u1EABn to\xE0n b\u1ED9 t\u1EEB ${targetSlug}`, "transcludeOf"),
          linkToOriginal: "Xem trang g\u1ED1c"
        },
        search: {
          title: "T\xECm",
          searchBarPlaceholder: "T\xECm ki\u1EBFm th\xF4ng tin"
        },
        tableOfContents: {
          title: "M\u1EE5c l\u1EE5c"
        },
        contentMeta: {
          readingTime: /* @__PURE__ */ __name(({ minutes }) => `${minutes} ph\xFAt \u0111\u1ECDc`, "readingTime")
        }
      },
      pages: {
        rss: {
          recentNotes: "Ghi ch\xFA g\u1EA7n \u0111\xE2y",
          lastFewNotes: /* @__PURE__ */ __name(({ count }) => `${count} Trang g\u1EA7n \u0111\xE2y`, "lastFewNotes")
        },
        error: {
          title: "Kh\xF4ng t\xECm th\u1EA5y",
          notFound: "Trang n\xE0y ri\xEAng t\u01B0 ho\u1EB7c kh\xF4ng t\u1ED3n t\u1EA1i.",
          home: "V\u1EC1 trang ch\u1EE7"
        },
        folderContent: {
          folder: "Th\u01B0 m\u1EE5c",
          itemsUnderFolder: /* @__PURE__ */ __name(({ count }) => `C\xF3 ${count} trang trong th\u01B0 m\u1EE5c n\xE0y.`, "itemsUnderFolder")
        },
        tagContent: {
          tag: "Th\u1EBB",
          tagIndex: "Danh s\xE1ch th\u1EBB",
          itemsUnderTag: /* @__PURE__ */ __name(({ count }) => `C\xF3 ${count} trang g\u1EAFn th\u1EBB n\xE0y.`, "itemsUnderTag"),
          showingFirst: /* @__PURE__ */ __name(({ count }) => `\u0110ang hi\u1EC3n th\u1ECB ${count} trang \u0111\u1EA7u ti\xEAn.`, "showingFirst"),
          totalTags: /* @__PURE__ */ __name(({ count }) => `C\xF3 t\u1ED5ng c\u1ED9ng ${count} th\u1EBB.`, "totalTags")
        }
      }
    };
  }
});

// quartz/i18n/locales/pt-BR.ts
var pt_BR_default;
var init_pt_BR = __esm({
  "quartz/i18n/locales/pt-BR.ts"() {
    "use strict";
    pt_BR_default = {
      propertyDefaults: {
        title: "Sem t\xEDtulo",
        description: "Sem descri\xE7\xE3o"
      },
      components: {
        callout: {
          note: "Nota",
          abstract: "Abstrato",
          info: "Info",
          todo: "Pend\xEAncia",
          tip: "Dica",
          success: "Sucesso",
          question: "Pergunta",
          warning: "Aviso",
          failure: "Falha",
          danger: "Perigo",
          bug: "Bug",
          example: "Exemplo",
          quote: "Cita\xE7\xE3o"
        },
        backlinks: {
          title: "Backlinks",
          noBacklinksFound: "Sem backlinks encontrados"
        },
        themeToggle: {
          lightMode: "Tema claro",
          darkMode: "Tema escuro"
        },
        readerMode: {
          title: "Modo leitor"
        },
        explorer: {
          title: "Explorador"
        },
        footer: {
          createdWith: "Criado com"
        },
        graph: {
          title: "Vis\xE3o de gr\xE1fico"
        },
        recentNotes: {
          title: "Notas recentes",
          seeRemainingMore: /* @__PURE__ */ __name(({ remaining }) => `Veja mais ${remaining} \u2192`, "seeRemainingMore")
        },
        transcludes: {
          transcludeOf: /* @__PURE__ */ __name(({ targetSlug }) => `Transcrever de ${targetSlug}`, "transcludeOf"),
          linkToOriginal: "Link ao original"
        },
        search: {
          title: "Pesquisar",
          searchBarPlaceholder: "Pesquisar por algo"
        },
        tableOfContents: {
          title: "Sum\xE1rio"
        },
        contentMeta: {
          readingTime: /* @__PURE__ */ __name(({ minutes }) => `Leitura de ${minutes} min`, "readingTime")
        }
      },
      pages: {
        rss: {
          recentNotes: "Notas recentes",
          lastFewNotes: /* @__PURE__ */ __name(({ count }) => `\xDAltimas ${count} notas`, "lastFewNotes")
        },
        error: {
          title: "N\xE3o encontrado",
          notFound: "Esta p\xE1gina \xE9 privada ou n\xE3o existe.",
          home: "Retornar a p\xE1gina inicial"
        },
        folderContent: {
          folder: "Arquivo",
          itemsUnderFolder: /* @__PURE__ */ __name(({ count }) => count === 1 ? "1 item neste arquivo." : `${count} items neste arquivo.`, "itemsUnderFolder")
        },
        tagContent: {
          tag: "Tag",
          tagIndex: "Sum\xE1rio de Tags",
          itemsUnderTag: /* @__PURE__ */ __name(({ count }) => count === 1 ? "1 item com esta tag." : `${count} items com esta tag.`, "itemsUnderTag"),
          showingFirst: /* @__PURE__ */ __name(({ count }) => `Mostrando as ${count} primeiras tags.`, "showingFirst"),
          totalTags: /* @__PURE__ */ __name(({ count }) => `Encontradas ${count} tags.`, "totalTags")
        }
      }
    };
  }
});

// quartz/i18n/locales/hu-HU.ts
var hu_HU_default;
var init_hu_HU = __esm({
  "quartz/i18n/locales/hu-HU.ts"() {
    "use strict";
    hu_HU_default = {
      propertyDefaults: {
        title: "N\xE9vtelen",
        description: "Nincs le\xEDr\xE1s"
      },
      components: {
        callout: {
          note: "Jegyzet",
          abstract: "Abstract",
          info: "Inform\xE1ci\xF3",
          todo: "Tennival\xF3",
          tip: "Tipp",
          success: "Siker",
          question: "K\xE9rd\xE9s",
          warning: "Figyelmeztet\xE9s",
          failure: "Hiba",
          danger: "Vesz\xE9ly",
          bug: "Bug",
          example: "P\xE9lda",
          quote: "Id\xE9zet"
        },
        backlinks: {
          title: "Visszautal\xE1sok",
          noBacklinksFound: "Nincs visszautal\xE1s"
        },
        themeToggle: {
          lightMode: "Vil\xE1gos m\xF3d",
          darkMode: "S\xF6t\xE9t m\xF3d"
        },
        readerMode: {
          title: "Olvas\xF3 m\xF3d"
        },
        explorer: {
          title: "F\xE1jlb\xF6ng\xE9sz\u0151"
        },
        footer: {
          createdWith: "K\xE9sz\xEDtve ezzel:"
        },
        graph: {
          title: "Grafikonn\xE9zet"
        },
        recentNotes: {
          title: "Legut\xF3bbi jegyzetek",
          seeRemainingMore: /* @__PURE__ */ __name(({ remaining }) => `${remaining} tov\xE1bbi megtekint\xE9se \u2192`, "seeRemainingMore")
        },
        transcludes: {
          transcludeOf: /* @__PURE__ */ __name(({ targetSlug }) => `${targetSlug} \xE1thivatkoz\xE1sa`, "transcludeOf"),
          linkToOriginal: "Hivatkoz\xE1s az eredetire"
        },
        search: {
          title: "Keres\xE9s",
          searchBarPlaceholder: "Keress valamire"
        },
        tableOfContents: {
          title: "Tartalomjegyz\xE9k"
        },
        contentMeta: {
          readingTime: /* @__PURE__ */ __name(({ minutes }) => `${minutes} perces olvas\xE1s`, "readingTime")
        }
      },
      pages: {
        rss: {
          recentNotes: "Legut\xF3bbi jegyzetek",
          lastFewNotes: /* @__PURE__ */ __name(({ count }) => `Legut\xF3bbi ${count} jegyzet`, "lastFewNotes")
        },
        error: {
          title: "Nem tal\xE1lhat\xF3",
          notFound: "Ez a lap vagy priv\xE1t vagy nem l\xE9tezik.",
          home: "Vissza a kezd\u0151lapra"
        },
        folderContent: {
          folder: "Mappa",
          itemsUnderFolder: /* @__PURE__ */ __name(({ count }) => `Ebben a mapp\xE1ban ${count} elem tal\xE1lhat\xF3.`, "itemsUnderFolder")
        },
        tagContent: {
          tag: "C\xEDmke",
          tagIndex: "C\xEDmke index",
          itemsUnderTag: /* @__PURE__ */ __name(({ count }) => `${count} elem tal\xE1lhat\xF3 ezzel a c\xEDmk\xE9vel.`, "itemsUnderTag"),
          showingFirst: /* @__PURE__ */ __name(({ count }) => `Els\u0151 ${count} c\xEDmke megjelen\xEDtve.`, "showingFirst"),
          totalTags: /* @__PURE__ */ __name(({ count }) => `\xD6sszesen ${count} c\xEDmke tal\xE1lhat\xF3.`, "totalTags")
        }
      }
    };
  }
});

// quartz/i18n/locales/fa-IR.ts
var fa_IR_default;
var init_fa_IR = __esm({
  "quartz/i18n/locales/fa-IR.ts"() {
    "use strict";
    fa_IR_default = {
      propertyDefaults: {
        title: "\u0628\u062F\u0648\u0646 \u0639\u0646\u0648\u0627\u0646",
        description: "\u062A\u0648\u0636\u06CC\u062D \u062E\u0627\u0635\u06CC \u0627\u0636\u0627\u0641\u0647 \u0646\u0634\u062F\u0647 \u0627\u0633\u062A"
      },
      direction: "rtl",
      components: {
        callout: {
          note: "\u06CC\u0627\u062F\u062F\u0627\u0634\u062A",
          abstract: "\u0686\u06A9\u06CC\u062F\u0647",
          info: "\u0627\u0637\u0644\u0627\u0639\u0627\u062A",
          todo: "\u0627\u0642\u062F\u0627\u0645",
          tip: "\u0646\u06A9\u062A\u0647",
          success: "\u062A\u06CC\u06A9",
          question: "\u0633\u0624\u0627\u0644",
          warning: "\u0647\u0634\u062F\u0627\u0631",
          failure: "\u0634\u06A9\u0633\u062A",
          danger: "\u062E\u0637\u0631",
          bug: "\u0628\u0627\u06AF",
          example: "\u0645\u062B\u0627\u0644",
          quote: "\u0646\u0642\u0644 \u0642\u0648\u0644"
        },
        backlinks: {
          title: "\u0628\u06A9\u200C\u0644\u06CC\u0646\u06A9\u200C\u0647\u0627",
          noBacklinksFound: "\u0628\u062F\u0648\u0646 \u0628\u06A9\u200C\u0644\u06CC\u0646\u06A9"
        },
        themeToggle: {
          lightMode: "\u062D\u0627\u0644\u062A \u0631\u0648\u0634\u0646",
          darkMode: "\u062D\u0627\u0644\u062A \u062A\u0627\u0631\u06CC\u06A9"
        },
        readerMode: {
          title: "\u062D\u0627\u0644\u062A \u062E\u0648\u0627\u0646\u062F\u0646"
        },
        explorer: {
          title: "\u0645\u0637\u0627\u0644\u0628"
        },
        footer: {
          createdWith: "\u0633\u0627\u062E\u062A\u0647 \u0634\u062F\u0647 \u0628\u0627"
        },
        graph: {
          title: "\u0646\u0645\u0627\u06CC \u06AF\u0631\u0627\u0641"
        },
        recentNotes: {
          title: "\u06CC\u0627\u062F\u062F\u0627\u0634\u062A\u200C\u0647\u0627\u06CC \u0627\u062E\u06CC\u0631",
          seeRemainingMore: /* @__PURE__ */ __name(({ remaining }) => `${remaining} \u06CC\u0627\u062F\u062F\u0627\u0634\u062A \u062F\u06CC\u06AF\u0631 \u2192`, "seeRemainingMore")
        },
        transcludes: {
          transcludeOf: /* @__PURE__ */ __name(({ targetSlug }) => `\u0627\u0632 ${targetSlug}`, "transcludeOf"),
          linkToOriginal: "\u067E\u06CC\u0648\u0646\u062F \u0628\u0647 \u0627\u0635\u0644\u06CC"
        },
        search: {
          title: "\u062C\u0633\u062A\u062C\u0648",
          searchBarPlaceholder: "\u0645\u0637\u0644\u0628\u06CC \u0631\u0627 \u062C\u0633\u062A\u062C\u0648 \u06A9\u0646\u06CC\u062F"
        },
        tableOfContents: {
          title: "\u0641\u0647\u0631\u0633\u062A"
        },
        contentMeta: {
          readingTime: /* @__PURE__ */ __name(({ minutes }) => `\u0632\u0645\u0627\u0646 \u062A\u0642\u0631\u06CC\u0628\u06CC \u0645\u0637\u0627\u0644\u0639\u0647: ${minutes} \u062F\u0642\u06CC\u0642\u0647`, "readingTime")
        }
      },
      pages: {
        rss: {
          recentNotes: "\u06CC\u0627\u062F\u062F\u0627\u0634\u062A\u200C\u0647\u0627\u06CC \u0627\u062E\u06CC\u0631",
          lastFewNotes: /* @__PURE__ */ __name(({ count }) => `${count} \u06CC\u0627\u062F\u062F\u0627\u0634\u062A \u0627\u062E\u06CC\u0631`, "lastFewNotes")
        },
        error: {
          title: "\u06CC\u0627\u0641\u062A \u0646\u0634\u062F",
          notFound: "\u0627\u06CC\u0646 \u0635\u0641\u062D\u0647 \u06CC\u0627 \u062E\u0635\u0648\u0635\u06CC \u0627\u0633\u062A \u06CC\u0627 \u0648\u062C\u0648\u062F \u0646\u062F\u0627\u0631\u062F",
          home: "\u0628\u0627\u0632\u06AF\u0634\u062A \u0628\u0647 \u0635\u0641\u062D\u0647 \u0627\u0635\u0644\u06CC"
        },
        folderContent: {
          folder: "\u067E\u0648\u0634\u0647",
          itemsUnderFolder: /* @__PURE__ */ __name(({ count }) => count === 1 ? ".\u06CC\u06A9 \u0645\u0637\u0644\u0628 \u062F\u0631 \u0627\u06CC\u0646 \u067E\u0648\u0634\u0647 \u0627\u0633\u062A" : `${count} \u0645\u0637\u0644\u0628 \u062F\u0631 \u0627\u06CC\u0646 \u067E\u0648\u0634\u0647 \u0627\u0633\u062A.`, "itemsUnderFolder")
        },
        tagContent: {
          tag: "\u0628\u0631\u0686\u0633\u0628",
          tagIndex: "\u0641\u0647\u0631\u0633\u062A \u0628\u0631\u0686\u0633\u0628\u200C\u0647\u0627",
          itemsUnderTag: /* @__PURE__ */ __name(({ count }) => count === 1 ? "\u06CC\u06A9 \u0645\u0637\u0644\u0628 \u0628\u0627 \u0627\u06CC\u0646 \u0628\u0631\u0686\u0633\u0628" : `${count} \u0645\u0637\u0644\u0628 \u0628\u0627 \u0627\u06CC\u0646 \u0628\u0631\u0686\u0633\u0628.`, "itemsUnderTag"),
          showingFirst: /* @__PURE__ */ __name(({ count }) => `\u062F\u0631 \u062D\u0627\u0644 \u0646\u0645\u0627\u06CC\u0634 ${count} \u0628\u0631\u0686\u0633\u0628.`, "showingFirst"),
          totalTags: /* @__PURE__ */ __name(({ count }) => `${count} \u0628\u0631\u0686\u0633\u0628 \u06CC\u0627\u0641\u062A \u0634\u062F.`, "totalTags")
        }
      }
    };
  }
});

// quartz/i18n/locales/pl-PL.ts
var pl_PL_default;
var init_pl_PL = __esm({
  "quartz/i18n/locales/pl-PL.ts"() {
    "use strict";
    pl_PL_default = {
      propertyDefaults: {
        title: "Bez nazwy",
        description: "Brak opisu"
      },
      components: {
        callout: {
          note: "Notatka",
          abstract: "Streszczenie",
          info: "informacja",
          todo: "Do zrobienia",
          tip: "Wskaz\xF3wka",
          success: "Zrobione",
          question: "Pytanie",
          warning: "Ostrze\u017Cenie",
          failure: "Usterka",
          danger: "Niebiezpiecze\u0144stwo",
          bug: "B\u0142\u0105d w kodzie",
          example: "Przyk\u0142ad",
          quote: "Cytat"
        },
        backlinks: {
          title: "Odno\u015Bniki zwrotne",
          noBacklinksFound: "Brak po\u0142\u0105cze\u0144 zwrotnych"
        },
        themeToggle: {
          lightMode: "Trzyb jasny",
          darkMode: "Tryb ciemny"
        },
        readerMode: {
          title: "Tryb czytania"
        },
        explorer: {
          title: "Przegl\u0105daj"
        },
        footer: {
          createdWith: "Stworzone z u\u017Cyciem"
        },
        graph: {
          title: "Graf"
        },
        recentNotes: {
          title: "Najnowsze notatki",
          seeRemainingMore: /* @__PURE__ */ __name(({ remaining }) => `Zobacz ${remaining} nastepnych \u2192`, "seeRemainingMore")
        },
        transcludes: {
          transcludeOf: /* @__PURE__ */ __name(({ targetSlug }) => `Osadzone ${targetSlug}`, "transcludeOf"),
          linkToOriginal: "\u0141\u0105cze do orygina\u0142u"
        },
        search: {
          title: "Szukaj",
          searchBarPlaceholder: "Wpisz fraz\u0119 wyszukiwania"
        },
        tableOfContents: {
          title: "Spis tre\u015Bci"
        },
        contentMeta: {
          readingTime: /* @__PURE__ */ __name(({ minutes }) => `${minutes} min. czytania `, "readingTime")
        }
      },
      pages: {
        rss: {
          recentNotes: "Najnowsze notatki",
          lastFewNotes: /* @__PURE__ */ __name(({ count }) => `Ostatnie ${count} notatek`, "lastFewNotes")
        },
        error: {
          title: "Nie znaleziono",
          notFound: "Ta strona jest prywatna lub nie istnieje.",
          home: "Powr\xF3t do strony g\u0142\xF3wnej"
        },
        folderContent: {
          folder: "Folder",
          itemsUnderFolder: /* @__PURE__ */ __name(({ count }) => count === 1 ? "W tym folderze jest 1 element." : `Element\xF3w w folderze: ${count}.`, "itemsUnderFolder")
        },
        tagContent: {
          tag: "Znacznik",
          tagIndex: "Spis znacznik\xF3w",
          itemsUnderTag: /* @__PURE__ */ __name(({ count }) => count === 1 ? "Oznaczony 1 element." : `Element\xF3w z tym znacznikiem: ${count}.`, "itemsUnderTag"),
          showingFirst: /* @__PURE__ */ __name(({ count }) => `Pokazuje ${count} pierwszych znacznik\xF3w.`, "showingFirst"),
          totalTags: /* @__PURE__ */ __name(({ count }) => `Znalezionych wszystkich znacznik\xF3w: ${count}.`, "totalTags")
        }
      }
    };
  }
});

// quartz/i18n/locales/cs-CZ.ts
var cs_CZ_default;
var init_cs_CZ = __esm({
  "quartz/i18n/locales/cs-CZ.ts"() {
    "use strict";
    cs_CZ_default = {
      propertyDefaults: {
        title: "Bez n\xE1zvu",
        description: "Nebyl uveden \u017E\xE1dn\xFD popis"
      },
      components: {
        callout: {
          note: "Pozn\xE1mka",
          abstract: "Abstract",
          info: "Info",
          todo: "Todo",
          tip: "Tip",
          success: "\xDAsp\u011Bch",
          question: "Ot\xE1zka",
          warning: "Upozorn\u011Bn\xED",
          failure: "Chyba",
          danger: "Nebezpe\u010D\xED",
          bug: "Bug",
          example: "P\u0159\xEDklad",
          quote: "Citace"
        },
        backlinks: {
          title: "P\u0159\xEDchoz\xED odkazy",
          noBacklinksFound: "Nenalezeny \u017E\xE1dn\xE9 p\u0159\xEDchoz\xED odkazy"
        },
        themeToggle: {
          lightMode: "Sv\u011Btl\xFD re\u017Eim",
          darkMode: "Tmav\xFD re\u017Eim"
        },
        readerMode: {
          title: "Re\u017Eim \u010Dte\u010Dky"
        },
        explorer: {
          title: "Proch\xE1zet"
        },
        footer: {
          createdWith: "Vytvo\u0159eno pomoc\xED"
        },
        graph: {
          title: "Graf"
        },
        recentNotes: {
          title: "Nejnov\u011Bj\u0161\xED pozn\xE1mky",
          seeRemainingMore: /* @__PURE__ */ __name(({ remaining }) => `Zobraz ${remaining} dal\u0161\xEDch \u2192`, "seeRemainingMore")
        },
        transcludes: {
          transcludeOf: /* @__PURE__ */ __name(({ targetSlug }) => `Zobrazen\xED ${targetSlug}`, "transcludeOf"),
          linkToOriginal: "Odkaz na p\u016Fvodn\xED dokument"
        },
        search: {
          title: "Hledat",
          searchBarPlaceholder: "Hledejte n\u011Bco"
        },
        tableOfContents: {
          title: "Obsah"
        },
        contentMeta: {
          readingTime: /* @__PURE__ */ __name(({ minutes }) => `${minutes} min \u010Dten\xED`, "readingTime")
        }
      },
      pages: {
        rss: {
          recentNotes: "Nejnov\u011Bj\u0161\xED pozn\xE1mky",
          lastFewNotes: /* @__PURE__ */ __name(({ count }) => `Posledn\xEDch ${count} pozn\xE1mek`, "lastFewNotes")
        },
        error: {
          title: "Nenalezeno",
          notFound: "Tato str\xE1nka je bu\u010F soukrom\xE1, nebo neexistuje.",
          home: "N\xE1vrat na domovskou str\xE1nku"
        },
        folderContent: {
          folder: "Slo\u017Eka",
          itemsUnderFolder: /* @__PURE__ */ __name(({ count }) => count === 1 ? "1 polo\u017Eka v t\xE9to slo\u017Ece." : `${count} polo\u017Eek v t\xE9to slo\u017Ece.`, "itemsUnderFolder")
        },
        tagContent: {
          tag: "Tag",
          tagIndex: "Rejst\u0159\xEDk tag\u016F",
          itemsUnderTag: /* @__PURE__ */ __name(({ count }) => count === 1 ? "1 polo\u017Eka s t\xEDmto tagem." : `${count} polo\u017Eek s t\xEDmto tagem.`, "itemsUnderTag"),
          showingFirst: /* @__PURE__ */ __name(({ count }) => `Zobrazuj\xED se prvn\xED ${count} tagy.`, "showingFirst"),
          totalTags: /* @__PURE__ */ __name(({ count }) => `Nalezeno celkem ${count} tag\u016F.`, "totalTags")
        }
      }
    };
  }
});

// quartz/i18n/locales/tr-TR.ts
var tr_TR_default;
var init_tr_TR = __esm({
  "quartz/i18n/locales/tr-TR.ts"() {
    "use strict";
    tr_TR_default = {
      propertyDefaults: {
        title: "\u0130simsiz",
        description: "Herhangi bir a\xE7\u0131klama eklenmedi"
      },
      components: {
        callout: {
          note: "Not",
          abstract: "\xD6zet",
          info: "Bilgi",
          todo: "Yap\u0131lacaklar",
          tip: "\u0130pucu",
          success: "Ba\u015Far\u0131l\u0131",
          question: "Soru",
          warning: "Uyar\u0131",
          failure: "Ba\u015Far\u0131s\u0131z",
          danger: "Tehlike",
          bug: "Hata",
          example: "\xD6rnek",
          quote: "Al\u0131nt\u0131"
        },
        backlinks: {
          title: "Backlinkler",
          noBacklinksFound: "Backlink bulunamad\u0131"
        },
        themeToggle: {
          lightMode: "A\xE7\u0131k mod",
          darkMode: "Koyu mod"
        },
        readerMode: {
          title: "Okuma modu"
        },
        explorer: {
          title: "Gezgin"
        },
        footer: {
          createdWith: "\u015Eununla olu\u015Fturuldu"
        },
        graph: {
          title: "Grafik G\xF6r\xFCn\xFCm\xFC"
        },
        recentNotes: {
          title: "Son Notlar",
          seeRemainingMore: /* @__PURE__ */ __name(({ remaining }) => `${remaining} tane daha g\xF6r \u2192`, "seeRemainingMore")
        },
        transcludes: {
          transcludeOf: /* @__PURE__ */ __name(({ targetSlug }) => `${targetSlug} sayfas\u0131ndan al\u0131nt\u0131`, "transcludeOf"),
          linkToOriginal: "Orijinal ba\u011Flant\u0131"
        },
        search: {
          title: "Arama",
          searchBarPlaceholder: "Bir \u015Fey aray\u0131n"
        },
        tableOfContents: {
          title: "\u0130\xE7indekiler"
        },
        contentMeta: {
          readingTime: /* @__PURE__ */ __name(({ minutes }) => `${minutes} dakika okuma s\xFCresi`, "readingTime")
        }
      },
      pages: {
        rss: {
          recentNotes: "Son notlar",
          lastFewNotes: /* @__PURE__ */ __name(({ count }) => `Son ${count} not`, "lastFewNotes")
        },
        error: {
          title: "Bulunamad\u0131",
          notFound: "Bu sayfa ya \xF6zel ya da mevcut de\u011Fil.",
          home: "Anasayfaya geri d\xF6n"
        },
        folderContent: {
          folder: "Klas\xF6r",
          itemsUnderFolder: /* @__PURE__ */ __name(({ count }) => count === 1 ? "Bu klas\xF6r alt\u0131nda 1 \xF6\u011Fe." : `Bu klas\xF6r alt\u0131ndaki ${count} \xF6\u011Fe.`, "itemsUnderFolder")
        },
        tagContent: {
          tag: "Etiket",
          tagIndex: "Etiket S\u0131ras\u0131",
          itemsUnderTag: /* @__PURE__ */ __name(({ count }) => count === 1 ? "Bu etikete sahip 1 \xF6\u011Fe." : `Bu etiket alt\u0131ndaki ${count} \xF6\u011Fe.`, "itemsUnderTag"),
          showingFirst: /* @__PURE__ */ __name(({ count }) => `\u0130lk ${count} etiket g\xF6steriliyor.`, "showingFirst"),
          totalTags: /* @__PURE__ */ __name(({ count }) => `Toplam ${count} adet etiket bulundu.`, "totalTags")
        }
      }
    };
  }
});

// quartz/i18n/locales/th-TH.ts
var th_TH_default;
var init_th_TH = __esm({
  "quartz/i18n/locales/th-TH.ts"() {
    "use strict";
    th_TH_default = {
      propertyDefaults: {
        title: "\u0E44\u0E21\u0E48\u0E21\u0E35\u0E0A\u0E37\u0E48\u0E2D",
        description: "\u0E44\u0E21\u0E48\u0E44\u0E14\u0E49\u0E23\u0E30\u0E1A\u0E38\u0E04\u0E33\u0E2D\u0E18\u0E34\u0E1A\u0E32\u0E22\u0E22\u0E48\u0E2D"
      },
      components: {
        callout: {
          note: "\u0E2B\u0E21\u0E32\u0E22\u0E40\u0E2B\u0E15\u0E38",
          abstract: "\u0E1A\u0E17\u0E04\u0E31\u0E14\u0E22\u0E48\u0E2D",
          info: "\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25",
          todo: "\u0E15\u0E49\u0E2D\u0E07\u0E17\u0E33\u0E40\u0E1E\u0E34\u0E48\u0E21\u0E40\u0E15\u0E34\u0E21",
          tip: "\u0E04\u0E33\u0E41\u0E19\u0E30\u0E19\u0E33",
          success: "\u0E40\u0E23\u0E35\u0E22\u0E1A\u0E23\u0E49\u0E2D\u0E22",
          question: "\u0E04\u0E33\u0E16\u0E32\u0E21",
          warning: "\u0E04\u0E33\u0E40\u0E15\u0E37\u0E2D\u0E19",
          failure: "\u0E02\u0E49\u0E2D\u0E1C\u0E34\u0E14\u0E1E\u0E25\u0E32\u0E14",
          danger: "\u0E2D\u0E31\u0E19\u0E15\u0E23\u0E32\u0E22",
          bug: "\u0E1A\u0E31\u0E4A\u0E01",
          example: "\u0E15\u0E31\u0E27\u0E2D\u0E22\u0E48\u0E32\u0E07",
          quote: "\u0E04\u0E33\u0E1E\u0E39\u0E01\u0E22\u0E01\u0E21\u0E32"
        },
        backlinks: {
          title: "\u0E2B\u0E19\u0E49\u0E32\u0E17\u0E35\u0E48\u0E01\u0E25\u0E48\u0E32\u0E27\u0E16\u0E36\u0E07",
          noBacklinksFound: "\u0E44\u0E21\u0E48\u0E21\u0E35\u0E2B\u0E19\u0E49\u0E32\u0E17\u0E35\u0E48\u0E42\u0E22\u0E07\u0E21\u0E32\u0E2B\u0E19\u0E49\u0E32\u0E19\u0E35\u0E49"
        },
        themeToggle: {
          lightMode: "\u0E42\u0E2B\u0E21\u0E14\u0E2A\u0E27\u0E48\u0E32\u0E07",
          darkMode: "\u0E42\u0E2B\u0E21\u0E14\u0E21\u0E37\u0E14"
        },
        readerMode: {
          title: "\u0E42\u0E2B\u0E21\u0E14\u0E2D\u0E48\u0E32\u0E19"
        },
        explorer: {
          title: "\u0E23\u0E32\u0E22\u0E01\u0E32\u0E23\u0E2B\u0E19\u0E49\u0E32"
        },
        footer: {
          createdWith: "\u0E2A\u0E23\u0E49\u0E32\u0E07\u0E14\u0E49\u0E27\u0E22"
        },
        graph: {
          title: "\u0E21\u0E38\u0E21\u0E21\u0E2D\u0E07\u0E01\u0E23\u0E32\u0E1F"
        },
        recentNotes: {
          title: "\u0E1A\u0E31\u0E19\u0E17\u0E36\u0E01\u0E25\u0E48\u0E32\u0E2A\u0E38\u0E14",
          seeRemainingMore: /* @__PURE__ */ __name(({ remaining }) => `\u0E14\u0E39\u0E40\u0E1E\u0E34\u0E48\u0E21\u0E2D\u0E35\u0E01 ${remaining} \u0E23\u0E32\u0E22\u0E01\u0E32\u0E23 \u2192`, "seeRemainingMore")
        },
        transcludes: {
          transcludeOf: /* @__PURE__ */ __name(({ targetSlug }) => `\u0E23\u0E27\u0E21\u0E02\u0E49\u0E32\u0E21\u0E40\u0E19\u0E37\u0E49\u0E2D\u0E2B\u0E32\u0E08\u0E32\u0E01 ${targetSlug}`, "transcludeOf"),
          linkToOriginal: "\u0E14\u0E39\u0E2B\u0E19\u0E49\u0E32\u0E15\u0E49\u0E19\u0E17\u0E32\u0E07"
        },
        search: {
          title: "\u0E04\u0E49\u0E19\u0E2B\u0E32",
          searchBarPlaceholder: "\u0E04\u0E49\u0E19\u0E2B\u0E32\u0E1A\u0E32\u0E07\u0E2D\u0E22\u0E48\u0E32\u0E07"
        },
        tableOfContents: {
          title: "\u0E2A\u0E32\u0E23\u0E1A\u0E31\u0E0D"
        },
        contentMeta: {
          readingTime: /* @__PURE__ */ __name(({ minutes }) => `\u0E2D\u0E48\u0E32\u0E19\u0E23\u0E32\u0E27 ${minutes} \u0E19\u0E32\u0E17\u0E35`, "readingTime")
        }
      },
      pages: {
        rss: {
          recentNotes: "\u0E1A\u0E31\u0E19\u0E17\u0E36\u0E01\u0E25\u0E48\u0E32\u0E2A\u0E38\u0E14",
          lastFewNotes: /* @__PURE__ */ __name(({ count }) => `${count} \u0E1A\u0E31\u0E19\u0E17\u0E36\u0E01\u0E25\u0E48\u0E32\u0E2A\u0E38\u0E14`, "lastFewNotes")
        },
        error: {
          title: "\u0E44\u0E21\u0E48\u0E21\u0E35\u0E2B\u0E19\u0E49\u0E32\u0E19\u0E35\u0E49",
          notFound: "\u0E2B\u0E19\u0E49\u0E32\u0E19\u0E35\u0E49\u0E2D\u0E32\u0E08\u0E15\u0E31\u0E49\u0E07\u0E04\u0E48\u0E32\u0E40\u0E1B\u0E47\u0E19\u0E2A\u0E48\u0E27\u0E19\u0E15\u0E31\u0E27\u0E2B\u0E23\u0E37\u0E2D\u0E22\u0E31\u0E07\u0E44\u0E21\u0E48\u0E16\u0E39\u0E01\u0E2A\u0E23\u0E49\u0E32\u0E07",
          home: "\u0E01\u0E25\u0E31\u0E1A\u0E2B\u0E19\u0E49\u0E32\u0E2B\u0E25\u0E31\u0E01"
        },
        folderContent: {
          folder: "\u0E42\u0E1F\u0E25\u0E40\u0E14\u0E2D\u0E23\u0E4C",
          itemsUnderFolder: /* @__PURE__ */ __name(({ count }) => `\u0E21\u0E35 ${count} \u0E23\u0E32\u0E22\u0E01\u0E32\u0E23\u0E43\u0E19\u0E42\u0E1F\u0E25\u0E40\u0E14\u0E2D\u0E23\u0E4C\u0E19\u0E35\u0E49`, "itemsUnderFolder")
        },
        tagContent: {
          tag: "\u0E41\u0E17\u0E47\u0E01",
          tagIndex: "\u0E41\u0E17\u0E47\u0E01\u0E17\u0E31\u0E49\u0E07\u0E2B\u0E21\u0E14",
          itemsUnderTag: /* @__PURE__ */ __name(({ count }) => `\u0E21\u0E35 ${count} \u0E23\u0E32\u0E22\u0E01\u0E32\u0E23\u0E43\u0E19\u0E41\u0E17\u0E47\u0E01\u0E19\u0E35\u0E49`, "itemsUnderTag"),
          showingFirst: /* @__PURE__ */ __name(({ count }) => `\u0E41\u0E2A\u0E14\u0E07 ${count} \u0E41\u0E17\u0E47\u0E01\u0E41\u0E23\u0E01`, "showingFirst"),
          totalTags: /* @__PURE__ */ __name(({ count }) => `\u0E21\u0E35\u0E17\u0E31\u0E49\u0E07\u0E2B\u0E21\u0E14 ${count} \u0E41\u0E17\u0E47\u0E01`, "totalTags")
        }
      }
    };
  }
});

// quartz/i18n/locales/lt-LT.ts
var lt_LT_default;
var init_lt_LT = __esm({
  "quartz/i18n/locales/lt-LT.ts"() {
    "use strict";
    lt_LT_default = {
      propertyDefaults: {
        title: "Be Pavadinimo",
        description: "Apra\u0161ymas Nepateiktas"
      },
      components: {
        callout: {
          note: "Pastaba",
          abstract: "Santrauka",
          info: "Informacija",
          todo: "Darb\u0173 s\u0105ra\u0161as",
          tip: "Patarimas",
          success: "S\u0117kmingas",
          question: "Klausimas",
          warning: "\u012Esp\u0117jimas",
          failure: "Nes\u0117kmingas",
          danger: "Pavojus",
          bug: "Klaida",
          example: "Pavyzdys",
          quote: "Citata"
        },
        backlinks: {
          title: "Atgalin\u0117s Nuorodos",
          noBacklinksFound: "Atgalini\u0173 Nuorod\u0173 Nerasta"
        },
        themeToggle: {
          lightMode: "\u0160viesus Re\u017Eimas",
          darkMode: "Tamsus Re\u017Eimas"
        },
        readerMode: {
          title: "Modalit\xE0 lettore"
        },
        explorer: {
          title: "Nar\u0161ykl\u0117"
        },
        footer: {
          createdWith: "Sukurta Su"
        },
        graph: {
          title: "Grafiko Vaizdas"
        },
        recentNotes: {
          title: "Naujausi U\u017Era\u0161ai",
          seeRemainingMore: /* @__PURE__ */ __name(({ remaining }) => `Per\u017Ei\u016Br\u0117ti dar ${remaining} \u2192`, "seeRemainingMore")
        },
        transcludes: {
          transcludeOf: /* @__PURE__ */ __name(({ targetSlug }) => `\u012Eterpimas i\u0161 ${targetSlug}`, "transcludeOf"),
          linkToOriginal: "Nuoroda \u012F original\u0105"
        },
        search: {
          title: "Paie\u0161ka",
          searchBarPlaceholder: "Ie\u0161koti"
        },
        tableOfContents: {
          title: "Turinys"
        },
        contentMeta: {
          readingTime: /* @__PURE__ */ __name(({ minutes }) => `${minutes} min skaitymo`, "readingTime")
        }
      },
      pages: {
        rss: {
          recentNotes: "Naujausi u\u017Era\u0161ai",
          lastFewNotes: /* @__PURE__ */ __name(({ count }) => count === 1 ? "Paskutinis 1 u\u017Era\u0161as" : count < 10 ? `Paskutiniai ${count} u\u017Era\u0161ai` : `Paskutiniai ${count} u\u017Era\u0161\u0173`, "lastFewNotes")
        },
        error: {
          title: "Nerasta",
          notFound: "Arba \u0161is puslapis yra pasiekiamas tik tam tikriems vartotojams, arba tokio puslapio n\u0117ra.",
          home: "Gr\u012F\u017Eti \u012F pagrindin\u012F puslap\u012F"
        },
        folderContent: {
          folder: "Aplankas",
          itemsUnderFolder: /* @__PURE__ */ __name(({ count }) => count === 1 ? "1 elementas \u0161iame aplanke." : count < 10 ? `${count} elementai \u0161iame aplanke.` : `${count} element\u0173 \u0161iame aplanke.`, "itemsUnderFolder")
        },
        tagContent: {
          tag: "\u017Dyma",
          tagIndex: "\u017Dym\u0173 indeksas",
          itemsUnderTag: /* @__PURE__ */ __name(({ count }) => count === 1 ? "1 elementas su \u0161ia \u017Eyma." : count < 10 ? `${count} elementai su \u0161ia \u017Eyma.` : `${count} element\u0173 su \u0161ia \u017Eyma.`, "itemsUnderTag"),
          showingFirst: /* @__PURE__ */ __name(({ count }) => count < 10 ? `Rodomos pirmosios ${count} \u017Eymos.` : `Rodomos pirmosios ${count} \u017Eym\u0173.`, "showingFirst"),
          totalTags: /* @__PURE__ */ __name(({ count }) => count === 1 ? "Rasta i\u0161 viso 1 \u017Eyma." : count < 10 ? `Rasta i\u0161 viso ${count} \u017Eymos.` : `Rasta i\u0161 viso ${count} \u017Eym\u0173.`, "totalTags")
        }
      }
    };
  }
});

// quartz/i18n/locales/fi-FI.ts
var fi_FI_default;
var init_fi_FI = __esm({
  "quartz/i18n/locales/fi-FI.ts"() {
    "use strict";
    fi_FI_default = {
      propertyDefaults: {
        title: "Nimet\xF6n",
        description: "Ei kuvausta saatavilla"
      },
      components: {
        callout: {
          note: "Merkint\xE4",
          abstract: "Tiivistelm\xE4",
          info: "Info",
          todo: "Teht\xE4v\xE4lista",
          tip: "Vinkki",
          success: "Onnistuminen",
          question: "Kysymys",
          warning: "Varoitus",
          failure: "Ep\xE4onnistuminen",
          danger: "Vaara",
          bug: "Virhe",
          example: "Esimerkki",
          quote: "Lainaus"
        },
        backlinks: {
          title: "Takalinkit",
          noBacklinksFound: "Takalinkkej\xE4 ei l\xF6ytynyt"
        },
        themeToggle: {
          lightMode: "Vaalea tila",
          darkMode: "Tumma tila"
        },
        readerMode: {
          title: "Lukijatila"
        },
        explorer: {
          title: "Selain"
        },
        footer: {
          createdWith: "Luotu k\xE4ytt\xE4en"
        },
        graph: {
          title: "Verkkon\xE4kym\xE4"
        },
        recentNotes: {
          title: "Viimeisimm\xE4t muistiinpanot",
          seeRemainingMore: /* @__PURE__ */ __name(({ remaining }) => `N\xE4yt\xE4 ${remaining} lis\xE4\xE4 \u2192`, "seeRemainingMore")
        },
        transcludes: {
          transcludeOf: /* @__PURE__ */ __name(({ targetSlug }) => `Upote kohteesta ${targetSlug}`, "transcludeOf"),
          linkToOriginal: "Linkki alkuper\xE4iseen"
        },
        search: {
          title: "Haku",
          searchBarPlaceholder: "Hae jotain"
        },
        tableOfContents: {
          title: "Sis\xE4llysluettelo"
        },
        contentMeta: {
          readingTime: /* @__PURE__ */ __name(({ minutes }) => `${minutes} min lukuaika`, "readingTime")
        }
      },
      pages: {
        rss: {
          recentNotes: "Viimeisimm\xE4t muistiinpanot",
          lastFewNotes: /* @__PURE__ */ __name(({ count }) => `Viimeiset ${count} muistiinpanoa`, "lastFewNotes")
        },
        error: {
          title: "Ei l\xF6ytynyt",
          notFound: "T\xE4m\xE4 sivu on joko yksityinen tai sit\xE4 ei ole olemassa.",
          home: "Palaa etusivulle"
        },
        folderContent: {
          folder: "Kansio",
          itemsUnderFolder: /* @__PURE__ */ __name(({ count }) => count === 1 ? "1 kohde t\xE4ss\xE4 kansiossa." : `${count} kohdetta t\xE4ss\xE4 kansiossa.`, "itemsUnderFolder")
        },
        tagContent: {
          tag: "Tunniste",
          tagIndex: "Tunnisteluettelo",
          itemsUnderTag: /* @__PURE__ */ __name(({ count }) => count === 1 ? "1 kohde t\xE4ll\xE4 tunnisteella." : `${count} kohdetta t\xE4ll\xE4 tunnisteella.`, "itemsUnderTag"),
          showingFirst: /* @__PURE__ */ __name(({ count }) => `N\xE4ytet\xE4\xE4n ensimm\xE4iset ${count} tunnistetta.`, "showingFirst"),
          totalTags: /* @__PURE__ */ __name(({ count }) => `L\xF6ytyi yhteens\xE4 ${count} tunnistetta.`, "totalTags")
        }
      }
    };
  }
});

// quartz/i18n/locales/nb-NO.ts
var nb_NO_default;
var init_nb_NO = __esm({
  "quartz/i18n/locales/nb-NO.ts"() {
    "use strict";
    nb_NO_default = {
      propertyDefaults: {
        title: "Uten navn",
        description: "Ingen beskrivelse angitt"
      },
      components: {
        callout: {
          note: "Notis",
          abstract: "Abstrakt",
          info: "Info",
          todo: "Husk p\xE5",
          tip: "Tips",
          success: "Suksess",
          question: "Sp\xF8rsm\xE5l",
          warning: "Advarsel",
          failure: "Feil",
          danger: "Farlig",
          bug: "Bug",
          example: "Eksempel",
          quote: "Sitat"
        },
        backlinks: {
          title: "Tilbakekoblinger",
          noBacklinksFound: "Ingen tilbakekoblinger funnet"
        },
        themeToggle: {
          lightMode: "Lys modus",
          darkMode: "M\xF8rk modus"
        },
        readerMode: {
          title: "L\xE6semodus"
        },
        explorer: {
          title: "Utforsker"
        },
        footer: {
          createdWith: "Laget med"
        },
        graph: {
          title: "Graf-visning"
        },
        recentNotes: {
          title: "Nylige notater",
          seeRemainingMore: /* @__PURE__ */ __name(({ remaining }) => `Se ${remaining} til \u2192`, "seeRemainingMore")
        },
        transcludes: {
          transcludeOf: /* @__PURE__ */ __name(({ targetSlug }) => `Transkludering of ${targetSlug}`, "transcludeOf"),
          linkToOriginal: "Lenke til original"
        },
        search: {
          title: "S\xF8k",
          searchBarPlaceholder: "S\xF8k etter noe"
        },
        tableOfContents: {
          title: "Oversikt"
        },
        contentMeta: {
          readingTime: /* @__PURE__ */ __name(({ minutes }) => `${minutes} min lesning`, "readingTime")
        }
      },
      pages: {
        rss: {
          recentNotes: "Nylige notat",
          lastFewNotes: /* @__PURE__ */ __name(({ count }) => `Siste ${count} notat`, "lastFewNotes")
        },
        error: {
          title: "Ikke funnet",
          notFound: "Enten er denne siden privat eller s\xE5 finnes den ikke.",
          home: "Returner til hovedsiden"
        },
        folderContent: {
          folder: "Mappe",
          itemsUnderFolder: /* @__PURE__ */ __name(({ count }) => count === 1 ? "1 gjenstand i denne mappen." : `${count} gjenstander i denne mappen.`, "itemsUnderFolder")
        },
        tagContent: {
          tag: "Tagg",
          tagIndex: "Tagg Indeks",
          itemsUnderTag: /* @__PURE__ */ __name(({ count }) => count === 1 ? "1 gjenstand med denne taggen." : `${count} gjenstander med denne taggen.`, "itemsUnderTag"),
          showingFirst: /* @__PURE__ */ __name(({ count }) => `Viser f\xF8rste ${count} tagger.`, "showingFirst"),
          totalTags: /* @__PURE__ */ __name(({ count }) => `Fant totalt ${count} tagger.`, "totalTags")
        }
      }
    };
  }
});

// quartz/i18n/locales/id-ID.ts
var id_ID_default;
var init_id_ID = __esm({
  "quartz/i18n/locales/id-ID.ts"() {
    "use strict";
    id_ID_default = {
      propertyDefaults: {
        title: "Tanpa Judul",
        description: "Tidak ada deskripsi"
      },
      components: {
        callout: {
          note: "Catatan",
          abstract: "Abstrak",
          info: "Info",
          todo: "Daftar Tugas",
          tip: "Tips",
          success: "Berhasil",
          question: "Pertanyaan",
          warning: "Peringatan",
          failure: "Gagal",
          danger: "Bahaya",
          bug: "Bug",
          example: "Contoh",
          quote: "Kutipan"
        },
        backlinks: {
          title: "Tautan Balik",
          noBacklinksFound: "Tidak ada tautan balik ditemukan"
        },
        themeToggle: {
          lightMode: "Mode Terang",
          darkMode: "Mode Gelap"
        },
        readerMode: {
          title: "Mode Pembaca"
        },
        explorer: {
          title: "Penjelajah"
        },
        footer: {
          createdWith: "Dibuat dengan"
        },
        graph: {
          title: "Tampilan Grafik"
        },
        recentNotes: {
          title: "Catatan Terbaru",
          seeRemainingMore: /* @__PURE__ */ __name(({ remaining }) => `Lihat ${remaining} lagi \u2192`, "seeRemainingMore")
        },
        transcludes: {
          transcludeOf: /* @__PURE__ */ __name(({ targetSlug }) => `Transklusi dari ${targetSlug}`, "transcludeOf"),
          linkToOriginal: "Tautan ke asli"
        },
        search: {
          title: "Cari",
          searchBarPlaceholder: "Cari sesuatu"
        },
        tableOfContents: {
          title: "Daftar Isi"
        },
        contentMeta: {
          readingTime: /* @__PURE__ */ __name(({ minutes }) => `${minutes} menit baca`, "readingTime")
        }
      },
      pages: {
        rss: {
          recentNotes: "Catatan terbaru",
          lastFewNotes: /* @__PURE__ */ __name(({ count }) => `${count} catatan terakhir`, "lastFewNotes")
        },
        error: {
          title: "Tidak Ditemukan",
          notFound: "Halaman ini bersifat privat atau tidak ada.",
          home: "Kembali ke Beranda"
        },
        folderContent: {
          folder: "Folder",
          itemsUnderFolder: /* @__PURE__ */ __name(({ count }) => count === 1 ? "1 item di bawah folder ini." : `${count} item di bawah folder ini.`, "itemsUnderFolder")
        },
        tagContent: {
          tag: "Tag",
          tagIndex: "Indeks Tag",
          itemsUnderTag: /* @__PURE__ */ __name(({ count }) => count === 1 ? "1 item dengan tag ini." : `${count} item dengan tag ini.`, "itemsUnderTag"),
          showingFirst: /* @__PURE__ */ __name(({ count }) => `Menampilkan ${count} tag pertama.`, "showingFirst"),
          totalTags: /* @__PURE__ */ __name(({ count }) => `Ditemukan total ${count} tag.`, "totalTags")
        }
      }
    };
  }
});

// quartz/i18n/locales/kk-KZ.ts
var kk_KZ_default;
var init_kk_KZ = __esm({
  "quartz/i18n/locales/kk-KZ.ts"() {
    "use strict";
    kk_KZ_default = {
      propertyDefaults: {
        title: "\u0410\u0442\u0430\u0443\u0441\u044B\u0437",
        description: "\u0421\u0438\u043F\u0430\u0442\u0442\u0430\u043C\u0430 \u0431\u0435\u0440\u0456\u043B\u043C\u0435\u0433\u0435\u043D"
      },
      components: {
        callout: {
          note: "\u0415\u0441\u043A\u0435\u0440\u0442\u0443",
          abstract: "\u0410\u043D\u043D\u043E\u0442\u0430\u0446\u0438\u044F",
          info: "\u0410\u049B\u043F\u0430\u0440\u0430\u0442",
          todo: "\u0406\u0441\u0442\u0435\u0443 \u043A\u0435\u0440\u0435\u043A",
          tip: "\u041A\u0435\u04A3\u0435\u0441",
          success: "\u0421\u04D9\u0442\u0442\u0456\u043B\u0456\u043A",
          question: "\u0421\u04B1\u0440\u0430\u049B",
          warning: "\u0415\u0441\u043A\u0435\u0440\u0442\u0443",
          failure: "\u049A\u0430\u0442\u0435",
          danger: "\u049A\u0430\u0443\u0456\u043F",
          bug: "\u049A\u0430\u0442\u0435",
          example: "\u041C\u044B\u0441\u0430\u043B",
          quote: "\u0414\u04D9\u0439\u0435\u043A\u0441\u04E9\u0437"
        },
        backlinks: {
          title: "\u0410\u0440\u0442\u049B\u0430 \u0441\u0456\u043B\u0442\u0435\u043C\u0435\u043B\u0435\u0440",
          noBacklinksFound: "\u0410\u0440\u0442\u049B\u0430 \u0441\u0456\u043B\u0442\u0435\u043C\u0435\u043B\u0435\u0440 \u0442\u0430\u0431\u044B\u043B\u043C\u0430\u0434\u044B"
        },
        themeToggle: {
          lightMode: "\u0416\u0430\u0440\u044B\u049B \u0440\u0435\u0436\u0438\u043C\u0456",
          darkMode: "\u049A\u0430\u0440\u0430\u04A3\u0493\u044B \u0440\u0435\u0436\u0438\u043C"
        },
        readerMode: {
          title: "\u041E\u049B\u0443 \u0440\u0435\u0436\u0438\u043C\u0456"
        },
        explorer: {
          title: "\u0417\u0435\u0440\u0442\u0442\u0435\u0443\u0448\u0456"
        },
        footer: {
          createdWith: "\u049A\u04B1\u0440\u0430\u0441\u0442\u044B\u0440\u044B\u043B\u0493\u0430\u043D \u049B\u04B1\u0440\u0430\u043B:"
        },
        graph: {
          title: "\u0413\u0440\u0430\u0444 \u043A\u04E9\u0440\u0456\u043D\u0456\u0441\u0456"
        },
        recentNotes: {
          title: "\u0421\u043E\u04A3\u0493\u044B \u0436\u0430\u0437\u0431\u0430\u043B\u0430\u0440",
          seeRemainingMore: /* @__PURE__ */ __name(({ remaining }) => `\u0422\u0430\u0493\u044B ${remaining} \u0436\u0430\u0437\u0431\u0430\u043D\u044B \u049B\u0430\u0440\u0430\u0443 \u2192`, "seeRemainingMore")
        },
        transcludes: {
          transcludeOf: /* @__PURE__ */ __name(({ targetSlug }) => `${targetSlug} \u043A\u0456\u0440\u0456\u0441\u0442\u0456\u0440\u0443`, "transcludeOf"),
          linkToOriginal: "\u0411\u0430\u0441\u0442\u0430\u043F\u049B\u044B\u0493\u0430 \u0441\u0456\u043B\u0442\u0435\u043C\u0435"
        },
        search: {
          title: "\u0406\u0437\u0434\u0435\u0443",
          searchBarPlaceholder: "\u0411\u0456\u0440\u0434\u0435\u04A3\u0435 \u0456\u0437\u0434\u0435\u0443"
        },
        tableOfContents: {
          title: "\u041C\u0430\u0437\u043C\u04B1\u043D\u044B"
        },
        contentMeta: {
          readingTime: /* @__PURE__ */ __name(({ minutes }) => `${minutes} \u043C\u0438\u043D \u043E\u049B\u0443`, "readingTime")
        }
      },
      pages: {
        rss: {
          recentNotes: "\u0421\u043E\u04A3\u0493\u044B \u0436\u0430\u0437\u0431\u0430\u043B\u0430\u0440",
          lastFewNotes: /* @__PURE__ */ __name(({ count }) => `\u0421\u043E\u04A3\u0493\u044B ${count} \u0436\u0430\u0437\u0431\u0430`, "lastFewNotes")
        },
        error: {
          title: "\u0422\u0430\u0431\u044B\u043B\u043C\u0430\u0434\u044B",
          notFound: "\u0411\u04B1\u043B \u0431\u0435\u0442 \u0436\u0435\u043A\u0435 \u043D\u0435\u043C\u0435\u0441\u0435 \u0436\u043E\u049B \u0431\u043E\u043B\u0443\u044B \u043C\u04AF\u043C\u043A\u0456\u043D.",
          home: "\u0411\u0430\u0441\u0442\u044B \u0431\u0435\u0442\u043A\u0435 \u043E\u0440\u0430\u043B\u0443"
        },
        folderContent: {
          folder: "\u049A\u0430\u043B\u0442\u0430",
          itemsUnderFolder: /* @__PURE__ */ __name(({ count }) => count === 1 ? "\u0411\u04B1\u043B \u049B\u0430\u043B\u0442\u0430\u0434\u0430 1 \u044D\u043B\u0435\u043C\u0435\u043D\u0442 \u0431\u0430\u0440." : `\u0411\u04B1\u043B \u049B\u0430\u043B\u0442\u0430\u0434\u0430 ${count} \u044D\u043B\u0435\u043C\u0435\u043D\u0442 \u0431\u0430\u0440.`, "itemsUnderFolder")
        },
        tagContent: {
          tag: "\u0422\u0435\u0433",
          tagIndex: "\u0422\u0435\u0433\u0442\u0435\u0440 \u0438\u043D\u0434\u0435\u043A\u0441\u0456",
          itemsUnderTag: /* @__PURE__ */ __name(({ count }) => count === 1 ? "\u0411\u04B1\u043B \u0442\u0435\u0433\u043F\u0435\u043D 1 \u044D\u043B\u0435\u043C\u0435\u043D\u0442." : `\u0411\u04B1\u043B \u0442\u0435\u0433\u043F\u0435\u043D ${count} \u044D\u043B\u0435\u043C\u0435\u043D\u0442.`, "itemsUnderTag"),
          showingFirst: /* @__PURE__ */ __name(({ count }) => `\u0410\u043B\u0493\u0430\u0448\u049B\u044B ${count} \u0442\u0435\u0433 \u043A\u04E9\u0440\u0441\u0435\u0442\u0456\u043B\u0443\u0434\u0435.`, "showingFirst"),
          totalTags: /* @__PURE__ */ __name(({ count }) => `\u0411\u0430\u0440\u043B\u044B\u0493\u044B ${count} \u0442\u0435\u0433 \u0442\u0430\u0431\u044B\u043B\u0434\u044B.`, "totalTags")
        }
      }
    };
  }
});

// quartz/i18n/locales/he-IL.ts
var he_IL_default;
var init_he_IL = __esm({
  "quartz/i18n/locales/he-IL.ts"() {
    "use strict";
    he_IL_default = {
      propertyDefaults: {
        title: "\u05DC\u05DC\u05D0 \u05DB\u05D5\u05EA\u05E8\u05EA",
        description: "\u05DC\u05D0 \u05E1\u05D5\u05E4\u05E7 \u05EA\u05D9\u05D0\u05D5\u05E8"
      },
      direction: "rtl",
      components: {
        callout: {
          note: "\u05D4\u05E2\u05E8\u05D4",
          abstract: "\u05EA\u05E7\u05E6\u05D9\u05E8",
          info: "\u05DE\u05D9\u05D3\u05E2",
          todo: "\u05DC\u05E2\u05E9\u05D5\u05EA",
          tip: "\u05D8\u05D9\u05E4",
          success: "\u05D4\u05E6\u05DC\u05D7\u05D4",
          question: "\u05E9\u05D0\u05DC\u05D4",
          warning: "\u05D0\u05D6\u05D4\u05E8\u05D4",
          failure: "\u05DB\u05E9\u05DC\u05D5\u05DF",
          danger: "\u05E1\u05DB\u05E0\u05D4",
          bug: "\u05D1\u05D0\u05D2",
          example: "\u05D3\u05D5\u05D2\u05DE\u05D4",
          quote: "\u05E6\u05D9\u05D8\u05D5\u05D8"
        },
        backlinks: {
          title: "\u05E7\u05D9\u05E9\u05D5\u05E8\u05D9\u05DD \u05D7\u05D5\u05D6\u05E8\u05D9\u05DD",
          noBacklinksFound: "\u05DC\u05D0 \u05E0\u05DE\u05E6\u05D0\u05D5 \u05E7\u05D9\u05E9\u05D5\u05E8\u05D9\u05DD \u05D7\u05D5\u05D6\u05E8\u05D9\u05DD"
        },
        themeToggle: {
          lightMode: "\u05DE\u05E6\u05D1 \u05D1\u05D4\u05D9\u05E8",
          darkMode: "\u05DE\u05E6\u05D1 \u05DB\u05D4\u05D4"
        },
        readerMode: {
          title: "\u05DE\u05E6\u05D1 \u05E7\u05E8\u05D9\u05D0\u05D4"
        },
        explorer: {
          title: "\u05E1\u05D9\u05D9\u05E8"
        },
        footer: {
          createdWith: "\u05E0\u05D5\u05E6\u05E8 \u05D1\u05D0\u05DE\u05E6\u05E2\u05D5\u05EA"
        },
        graph: {
          title: "\u05DE\u05D1\u05D8 \u05D2\u05E8\u05E3"
        },
        recentNotes: {
          title: "\u05D4\u05E2\u05E8\u05D5\u05EA \u05D0\u05D7\u05E8\u05D5\u05E0\u05D5\u05EA",
          seeRemainingMore: /* @__PURE__ */ __name(({ remaining }) => `\u05E2\u05D9\u05D9\u05DF \u05D1 ${remaining} \u05E0\u05D5\u05E1\u05E4\u05D9\u05DD \u2192`, "seeRemainingMore")
        },
        transcludes: {
          transcludeOf: /* @__PURE__ */ __name(({ targetSlug }) => `\u05DE\u05E6\u05D5\u05D8\u05D8 \u05DE ${targetSlug}`, "transcludeOf"),
          linkToOriginal: "\u05E7\u05D9\u05E9\u05D5\u05E8 \u05DC\u05DE\u05E7\u05D5\u05E8\u05D9"
        },
        search: {
          title: "\u05D7\u05D9\u05E4\u05D5\u05E9",
          searchBarPlaceholder: "\u05D7\u05E4\u05E9\u05D5 \u05DE\u05E9\u05D4\u05D5"
        },
        tableOfContents: {
          title: "\u05EA\u05D5\u05DB\u05DF \u05E2\u05E0\u05D9\u05D9\u05E0\u05D9\u05DD"
        },
        contentMeta: {
          readingTime: /* @__PURE__ */ __name(({ minutes }) => `${minutes} \u05D3\u05E7\u05D5\u05EA \u05E7\u05E8\u05D9\u05D0\u05D4`, "readingTime")
        }
      },
      pages: {
        rss: {
          recentNotes: "\u05D4\u05E2\u05E8\u05D5\u05EA \u05D0\u05D7\u05E8\u05D5\u05E0\u05D5\u05EA",
          lastFewNotes: /* @__PURE__ */ __name(({ count }) => `${count} \u05D4\u05E2\u05E8\u05D5\u05EA \u05D0\u05D7\u05E8\u05D5\u05E0\u05D5\u05EA`, "lastFewNotes")
        },
        error: {
          title: "\u05DC\u05D0 \u05E0\u05DE\u05E6\u05D0",
          notFound: "\u05D4\u05E2\u05DE\u05D5\u05D3 \u05D4\u05D6\u05D4 \u05E4\u05E8\u05D8\u05D9 \u05D0\u05D5 \u05DC\u05D0 \u05E7\u05D9\u05D9\u05DD.",
          home: "\u05D7\u05D6\u05E8\u05D4 \u05DC\u05E2\u05DE\u05D5\u05D3 \u05D4\u05D1\u05D9\u05EA"
        },
        folderContent: {
          folder: "\u05EA\u05D9\u05E7\u05D9\u05D9\u05D4",
          itemsUnderFolder: /* @__PURE__ */ __name(({ count }) => count === 1 ? "\u05E4\u05E8\u05D9\u05D8 \u05D0\u05D7\u05D3 \u05EA\u05D7\u05EA \u05EA\u05D9\u05E7\u05D9\u05D9\u05D4 \u05D6\u05D5." : `${count} \u05E4\u05E8\u05D9\u05D8\u05D9\u05DD \u05EA\u05D7\u05EA \u05EA\u05D9\u05E7\u05D9\u05D9\u05D4 \u05D6\u05D5.`, "itemsUnderFolder")
        },
        tagContent: {
          tag: "\u05EA\u05D2\u05D9\u05EA",
          tagIndex: "\u05DE\u05E4\u05EA\u05D7 \u05D4\u05EA\u05D2\u05D9\u05D5\u05EA",
          itemsUnderTag: /* @__PURE__ */ __name(({ count }) => count === 1 ? "\u05E4\u05E8\u05D9\u05D8 \u05D0\u05D7\u05D3 \u05E2\u05DD \u05EA\u05D2\u05D9\u05EA \u05D6\u05D5." : `${count} \u05E4\u05E8\u05D9\u05D8\u05D9\u05DD \u05E2\u05DD \u05EA\u05D2\u05D9\u05EA \u05D6\u05D5.`, "itemsUnderTag"),
          showingFirst: /* @__PURE__ */ __name(({ count }) => `\u05DE\u05E8\u05D0\u05D4 \u05D0\u05EA \u05D4-${count} \u05EA\u05D2\u05D9\u05D5\u05EA \u05D4\u05E8\u05D0\u05E9\u05D5\u05E0\u05D5\u05EA.`, "showingFirst"),
          totalTags: /* @__PURE__ */ __name(({ count }) => `${count} \u05EA\u05D2\u05D9\u05D5\u05EA \u05E0\u05DE\u05E6\u05D0\u05D5 \u05E1\u05DA \u05D4\u05DB\u05DC.`, "totalTags")
        }
      }
    };
  }
});

// quartz/i18n/index.ts
var TRANSLATIONS, defaultTranslation, i18n;
var init_i18n = __esm({
  "quartz/i18n/index.ts"() {
    "use strict";
    init_en_US();
    init_en_GB();
    init_fr_FR();
    init_it_IT();
    init_ja_JP();
    init_de_DE();
    init_nl_NL();
    init_ro_RO();
    init_ca_ES();
    init_es_ES();
    init_ar_SA();
    init_uk_UA();
    init_ru_RU();
    init_ko_KR();
    init_zh_CN();
    init_zh_TW();
    init_vi_VN();
    init_pt_BR();
    init_hu_HU();
    init_fa_IR();
    init_pl_PL();
    init_cs_CZ();
    init_tr_TR();
    init_th_TH();
    init_lt_LT();
    init_fi_FI();
    init_nb_NO();
    init_id_ID();
    init_kk_KZ();
    init_he_IL();
    TRANSLATIONS = {
      "en-US": en_US_default,
      "en-GB": en_GB_default,
      "fr-FR": fr_FR_default,
      "it-IT": it_IT_default,
      "ja-JP": ja_JP_default,
      "de-DE": de_DE_default,
      "nl-NL": nl_NL_default,
      "nl-BE": nl_NL_default,
      "ro-RO": ro_RO_default,
      "ro-MD": ro_RO_default,
      "ca-ES": ca_ES_default,
      "es-ES": es_ES_default,
      "ar-SA": ar_SA_default,
      "ar-AE": ar_SA_default,
      "ar-QA": ar_SA_default,
      "ar-BH": ar_SA_default,
      "ar-KW": ar_SA_default,
      "ar-OM": ar_SA_default,
      "ar-YE": ar_SA_default,
      "ar-IR": ar_SA_default,
      "ar-SY": ar_SA_default,
      "ar-IQ": ar_SA_default,
      "ar-JO": ar_SA_default,
      "ar-PL": ar_SA_default,
      "ar-LB": ar_SA_default,
      "ar-EG": ar_SA_default,
      "ar-SD": ar_SA_default,
      "ar-LY": ar_SA_default,
      "ar-MA": ar_SA_default,
      "ar-TN": ar_SA_default,
      "ar-DZ": ar_SA_default,
      "ar-MR": ar_SA_default,
      "uk-UA": uk_UA_default,
      "ru-RU": ru_RU_default,
      "ko-KR": ko_KR_default,
      "zh-CN": zh_CN_default,
      "zh-TW": zh_TW_default,
      "vi-VN": vi_VN_default,
      "pt-BR": pt_BR_default,
      "hu-HU": hu_HU_default,
      "fa-IR": fa_IR_default,
      "pl-PL": pl_PL_default,
      "cs-CZ": cs_CZ_default,
      "tr-TR": tr_TR_default,
      "th-TH": th_TH_default,
      "lt-LT": lt_LT_default,
      "fi-FI": fi_FI_default,
      "nb-NO": nb_NO_default,
      "id-ID": id_ID_default,
      "kk-KZ": kk_KZ_default,
      "he-IL": he_IL_default
    };
    defaultTranslation = "en-US";
    i18n = /* @__PURE__ */ __name((locale) => TRANSLATIONS[locale ?? defaultTranslation], "i18n");
  }
});

// quartz/util/path.ts
import {
  isFilePath,
  isFullSlug,
  isSimpleSlug,
  isRelativeURL,
  isAbsoluteURL,
  getFullSlug,
  slugifyFilePath,
  simplifySlug,
  joinSegments,
  endsWith,
  trimSuffix,
  stripSlashes,
  getFileExtension,
  isFolderPath,
  getAllSegmentPrefixes,
  pathToRoot,
  resolveRelative,
  splitAnchor,
  slugTag,
  transformInternalLink,
  transformLink,
  normalizeHastElement
} from "@quartz-community/utils";
var QUARTZ;
var init_path = __esm({
  "quartz/util/path.ts"() {
    "use strict";
    QUARTZ = "quartz";
  }
});

// quartz/plugins/builtins/contentIndex.ts
import path2 from "node:path";
import fs2 from "node:fs/promises";
import { toHtml } from "hast-util-to-html";
import { styleText as styleText4 } from "util";
import { getDate } from "@quartz-community/utils";
function collectContentIndexExtensions(ctx) {
  const plugins = ctx.cfg?.plugins;
  if (!plugins) return [];
  const instances = [
    ...plugins.transformers,
    ...plugins.filters,
    ...plugins.emitters,
    ...plugins.pageTypes ?? []
  ];
  const extensions = [];
  for (const instance of instances) {
    const extend = instance.extendContentIndex;
    if (typeof extend === "function") {
      extensions.push({ plugin: instance.name, extend });
    }
  }
  return extensions;
}
function warnOnce(message) {
  if (warned.has(message)) return;
  warned.add(message);
  console.warn(styleText4("yellow", "\u26A0") + ` ${message}`);
}
function applyContentIndexExtensions(ctx, extensions, entry, fileData) {
  if (extensions.length === 0) return entry;
  const owners = /* @__PURE__ */ new Map();
  const result = { ...entry };
  for (const { plugin, extend } of extensions) {
    let fields;
    try {
      fields = extend({ ctx, fileData, entry: Object.freeze({ ...entry }) });
    } catch (err) {
      warnOnce(
        `Content index: "${plugin}".extendContentIndex threw for ${entry.slug}: ${err instanceof Error ? err.message : String(err)}`
      );
      continue;
    }
    if (!fields || typeof fields !== "object") continue;
    for (const [key, value] of Object.entries(fields)) {
      if (value === void 0) continue;
      if (CORE_CONTENT_INDEX_FIELDS.has(key)) {
        warnOnce(
          `Content index: "${plugin}" tried to override core field "${key}" (ignored). Use a different key.`
        );
        continue;
      }
      const owner = owners.get(key);
      if (owner !== void 0 && owner !== plugin) {
        warnOnce(
          `Content index: "${plugin}" and "${owner}" both add field "${key}"; keeping "${owner}"'s value.`
        );
        continue;
      }
      owners.set(key, plugin);
      result[key] = value;
    }
  }
  return result;
}
function buildContentIndex(ctx, content, options3 = contentIndexDefaults) {
  const extensions = collectContentIndexExtensions(ctx);
  const index = /* @__PURE__ */ new Map();
  for (const [tree, file] of content) {
    const data = file.data ?? {};
    if (data.unlisted === true) continue;
    const text = data.text;
    if (!(options3.includeEmptyFiles ?? true) && !(text && text !== "")) continue;
    const slug = data.slug;
    const frontmatter = data.frontmatter ?? {};
    const entry = {
      slug,
      filePath: data.relativePath,
      title: frontmatter.title ?? "",
      links: data.links ?? [],
      tags: frontmatter.tags ?? [],
      content: text ?? "",
      richContent: options3.rssFullHtml && data.encrypted !== true ? escapeHTML(toHtml(tree, { allowDangerousHtml: true })) : void 0,
      date: getDate(data) ?? /* @__PURE__ */ new Date(),
      description: data.description ?? ""
    };
    index.set(slug, applyContentIndexExtensions(ctx, extensions, entry, data));
  }
  return index;
}
async function write(ctx, slug, ext, content) {
  const pathToPage = joinSegments(ctx.argv.output, slug + ext);
  await fs2.mkdir(path2.dirname(pathToPage), { recursive: true });
  await fs2.writeFile(pathToPage, content);
  return pathToPage;
}
function generateSiteMap(cfg, idx) {
  const base = cfg.baseUrl ?? "";
  const createURLEntry = /* @__PURE__ */ __name((slug, content) => `<url>
    <loc>https://${joinSegments(base, encodeURI(slug))}</loc>
    ${content.date && `<lastmod>${content.date.toISOString()}</lastmod>`}
  </url>`, "createURLEntry");
  const urls = Array.from(idx).map(([slug, content]) => createURLEntry(simplifySlug(slug), content)).join("");
  return `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">${urls}</urlset>`;
}
function generateRSSFeed(cfg, idx, limit) {
  const base = cfg.baseUrl ?? "";
  const pageTitle = cfg.pageTitle ?? "";
  const createURLEntry = /* @__PURE__ */ __name((slug, content) => `<item>
    <title>${escapeHTML(content.title)}</title>
    <link>https://${joinSegments(base, encodeURI(slug))}</link>
    <guid>https://${joinSegments(base, encodeURI(slug))}</guid>
    <description><![CDATA[ ${content.richContent ?? content.description} ]]></description>
    <pubDate>${content.date?.toUTCString()}</pubDate>
  </item>`, "createURLEntry");
  const items = Array.from(idx).sort(([_, f1], [__, f2]) => {
    if (f1.date && f2.date) return f2.date.getTime() - f1.date.getTime();
    if (f1.date && !f2.date) return -1;
    if (!f1.date && f2.date) return 1;
    return f1.title.localeCompare(f2.title);
  }).map(([slug, content]) => createURLEntry(simplifySlug(slug), content)).slice(0, limit ?? idx.size).join("");
  const rss = i18n(cfg.locale).pages.rss;
  const description = `${limit ? rss.lastFewNotes({ count: limit }) : rss.recentNotes} on ${escapeHTML(pageTitle)}`;
  return `<?xml version="1.0" encoding="UTF-8" ?>
<rss version="2.0">
    <channel>
      <title>${escapeHTML(pageTitle)}</title>
      <link>https://${base}</link>
      <description>${description}</description>
      <generator>Quartz -- quartz.jzhao.xyz</generator>
      ${items}
    </channel>
  </rss>`;
}
function serializeContentIndex(idx) {
  const simplified = Object.fromEntries(
    Array.from(idx).map(([slug, { date: _date, description: _description, ...rest }]) => [
      slug,
      rest
    ])
  );
  return JSON.stringify(simplified);
}
var contentIndexDefaults, CORE_CONTENT_INDEX_FIELDS, warned, ContentIndex;
var init_contentIndex = __esm({
  "quartz/plugins/builtins/contentIndex.ts"() {
    "use strict";
    init_escape();
    init_i18n();
    init_path();
    contentIndexDefaults = {
      enableSiteMap: true,
      enableRSS: true,
      rssLimit: 10,
      rssFullHtml: false,
      rssSlug: "index",
      includeEmptyFiles: true
    };
    CORE_CONTENT_INDEX_FIELDS = /* @__PURE__ */ new Set([
      "slug",
      "filePath",
      "title",
      "links",
      "tags",
      "content",
      "richContent",
      "date",
      "description"
    ]);
    __name(collectContentIndexExtensions, "collectContentIndexExtensions");
    warned = /* @__PURE__ */ new Set();
    __name(warnOnce, "warnOnce");
    __name(applyContentIndexExtensions, "applyContentIndexExtensions");
    __name(buildContentIndex, "buildContentIndex");
    __name(write, "write");
    __name(generateSiteMap, "generateSiteMap");
    __name(generateRSSFeed, "generateRSSFeed");
    __name(serializeContentIndex, "serializeContentIndex");
    ContentIndex = /* @__PURE__ */ __name((userOpts) => {
      const opts = { ...contentIndexDefaults, ...userOpts };
      const emitAll = /* @__PURE__ */ __name(async (ctx, content) => {
        const cfg = ctx.cfg.configuration;
        const index = ctx.contentIndex ?? buildContentIndex(ctx, content, opts);
        const outputs = [];
        if (opts.enableSiteMap) {
          outputs.push(await write(ctx, "sitemap", ".xml", generateSiteMap(cfg, index)));
        }
        if (opts.enableRSS) {
          outputs.push(
            await write(
              ctx,
              opts.rssSlug ?? "index",
              ".xml",
              generateRSSFeed(cfg, index, opts.rssLimit)
            )
          );
        }
        outputs.push(
          await write(
            ctx,
            joinSegments("static", "contentIndex"),
            ".json",
            serializeContentIndex(index)
          )
        );
        return outputs;
      }, "emitAll");
      return {
        name: "ContentIndex",
        emit: /* @__PURE__ */ __name((ctx, content) => emitAll(ctx, content), "emit"),
        partialEmit: /* @__PURE__ */ __name((ctx, content) => emitAll(ctx, content), "partialEmit")
      };
    }, "ContentIndex");
  }
});

// quartz/plugins/builtins/drafts.ts
function isDraft(frontmatter) {
  const draft = frontmatter?.draft;
  return draft === true || draft === "true";
}
var Drafts;
var init_drafts = __esm({
  "quartz/plugins/builtins/drafts.ts"() {
    "use strict";
    __name(isDraft, "isDraft");
    Drafts = /* @__PURE__ */ __name(() => ({
      name: "Drafts",
      shouldPublish(_ctx, [_tree, vfile]) {
        return !isDraft(vfile.data?.frontmatter);
      }
    }), "Drafts");
  }
});

// quartz/plugins/builtins/frontmatter.ts
import matter from "gray-matter";
import remarkFrontmatter from "remark-frontmatter";
import yaml from "js-yaml";
import toml from "toml";
function coalesceAliases(data, aliases) {
  for (const alias of aliases) {
    if (data[alias] !== void 0 && data[alias] !== null) return data[alias];
  }
  return void 0;
}
function coerceToArray(input) {
  if (input === void 0 || input === null) return void 0;
  if (!Array.isArray(input)) {
    return String(input).split(",").map((s) => s.trim());
  }
  return input.filter((v) => typeof v === "string" || typeof v === "number").map((v) => v.toString());
}
function getAliasSlugs(aliases) {
  return aliases.map((alias) => {
    const isMd = getFileExtension(alias) === ".md";
    const mockFp = isMd ? alias : alias + ".md";
    return slugifyFilePath(mockFp);
  });
}
function slugifyWikilinkTarget(target) {
  const [rawPath, anchor] = splitAnchor(target);
  if (!rawPath) return anchor;
  const pathWithExt = rawPath.endsWith(".md") ? rawPath : `${rawPath}.md`;
  return slugifyFilePath(pathWithExt) + anchor;
}
function extractLinksFromValue(value) {
  if (typeof value === "string") {
    const links = [];
    for (const match2 of value.matchAll(WIKILINK_PATTERN))
      links.push(slugifyWikilinkTarget(match2[1]));
    for (const match2 of value.matchAll(MDLINK_PATTERN)) links.push(match2[1]);
    return links;
  }
  if (Array.isArray(value)) return value.flatMap((item) => extractLinksFromValue(item));
  if (value !== null && typeof value === "object") {
    return Object.values(value).flatMap((v) => extractLinksFromValue(v));
  }
  return [];
}
function normalizeFrontmatter(data, fallbackTitle) {
  if (data.title != null && data.title.toString() !== "") {
    data.title = data.title.toString();
  } else {
    data.title = fallbackTitle;
  }
  const tags = coerceToArray(coalesceAliases(data, ["tags", "tag"]));
  if (tags) data.tags = [...new Set(tags.map((tag) => slugTag(tag)))];
  const aliasSlugs = [];
  const aliases = coerceToArray(coalesceAliases(data, ["aliases", "alias"]));
  if (aliases) {
    data.aliases = aliases;
    aliasSlugs.push(...getAliasSlugs(aliases));
  }
  if (data.permalink != null && data.permalink.toString() !== "") {
    data.permalink = data.permalink.toString();
  }
  const cssclasses = coerceToArray(coalesceAliases(data, ["cssclasses", "cssclass"]));
  if (cssclasses) data.cssclasses = cssclasses;
  const socialImage = coalesceAliases(data, ["socialImage", "image", "cover"]);
  const created = coalesceAliases(data, ["created", "date"]);
  if (created) data.created = created;
  const modified = coalesceAliases(data, ["modified", "lastmod", "updated", "last-modified"]);
  if (modified) data.modified = modified;
  data.modified ||= created;
  const published = coalesceAliases(data, ["published", "publishDate", "date"]);
  if (published) data.published = published;
  if (socialImage) data.socialImage = socialImage;
  return { aliases: aliasSlugs };
}
function readFrontmatterData(source, options3 = {}) {
  const language = options3.language ?? frontmatterDefaults.language;
  if (language !== "yaml" && language !== "toml") {
    throw new Error(
      `Frontmatter: unsupported \`language\` option ${JSON.stringify(language)} (use "yaml" or "toml")`
    );
  }
  try {
    const { data } = matter(Buffer.isBuffer(source) ? source : Buffer.from(source), {
      delimiters: options3.delimiters ?? frontmatterDefaults.delimiters,
      language,
      engines: {
        yaml: /* @__PURE__ */ __name((s) => yaml.load(s, { schema: yaml.JSON_SCHEMA }), "yaml"),
        toml: /* @__PURE__ */ __name((s) => toml.parse(s), "toml"),
        javascript: refuseJavaScript,
        js: refuseJavaScript
      }
    });
    if (typeof data !== "object" || data === null || Array.isArray(data)) {
      const kind = Array.isArray(data) ? "list" : typeof data;
      throw new ContentError(
        `Invalid frontmatter: expected properties (\`key: value\` lines), got a ${kind} (${JSON.stringify(data)})`
      );
    }
    return data;
  } catch (err) {
    if (err instanceof ContentError) throw err;
    throw new ContentError(`Invalid frontmatter: ${err instanceof Error ? err.message : err}`, {
      cause: err
    });
  }
}
var frontmatterDefaults, WIKILINK_PATTERN, MDLINK_PATTERN, refuseJavaScript, Frontmatter;
var init_frontmatter = __esm({
  "quartz/plugins/builtins/frontmatter.ts"() {
    "use strict";
    init_pluginErrors();
    init_path();
    frontmatterDefaults = {
      delimiters: "---",
      language: "yaml"
    };
    __name(coalesceAliases, "coalesceAliases");
    __name(coerceToArray, "coerceToArray");
    __name(getAliasSlugs, "getAliasSlugs");
    __name(slugifyWikilinkTarget, "slugifyWikilinkTarget");
    WIKILINK_PATTERN = /\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g;
    MDLINK_PATTERN = /\[(?:[^\]]*)\]\(([^)]+)\)/g;
    __name(extractLinksFromValue, "extractLinksFromValue");
    __name(normalizeFrontmatter, "normalizeFrontmatter");
    refuseJavaScript = /* @__PURE__ */ __name(() => {
      throw new ContentError(
        "JavaScript frontmatter (---js / ---javascript) is not supported: Quartz does not execute code from content. Use YAML or TOML frontmatter."
      );
    }, "refuseJavaScript");
    __name(readFrontmatterData, "readFrontmatterData");
    Frontmatter = /* @__PURE__ */ __name((userOpts) => {
      const opts = { ...frontmatterDefaults, ...userOpts };
      return {
        name: "Frontmatter",
        markdownPlugins(ctx) {
          const { allSlugs } = ctx;
          return [
            [remarkFrontmatter, ["yaml", "toml"]],
            () => {
              return (_, file) => {
                const data = readFrontmatterData(Buffer.from(file.value), opts);
                const { aliases } = normalizeFrontmatter(data, file.stem ?? "Untitled");
                const pathSlug = file.data.relativePath ? slugifyFilePath(file.data.relativePath) : void 0;
                if (pathSlug && file.data.slug && file.data.slug !== pathSlug) aliases.push(pathSlug);
                if (aliases.length > 0) {
                  file.data.aliases = aliases;
                  allSlugs.push(...aliases);
                  const unique = [...new Set(allSlugs)];
                  allSlugs.splice(0, allSlugs.length, ...unique);
                }
                const frontmatterLinks = extractLinksFromValue(data);
                if (frontmatterLinks.length > 0) {
                  file.data.frontmatterLinks = [
                    ...file.data.frontmatterLinks ?? [],
                    ...frontmatterLinks
                  ];
                }
                file.data.frontmatter = data;
              };
            }
          ];
        }
      };
    }, "Frontmatter");
  }
});

// quartz/util/permalinks.ts
function slugForFile(file, permalinks) {
  return permalinks?.[file] ?? slugifyFilePath(file);
}
function permalinkTargets(permalinks) {
  return new Map(
    Object.entries(permalinks ?? {}).map(([file, slug]) => [
      slugifyFilePath(file),
      slug
    ])
  );
}
var init_permalinks = __esm({
  "quartz/util/permalinks.ts"() {
    "use strict";
    init_path();
    __name(slugForFile, "slugForFile");
    __name(permalinkTargets, "permalinkTargets");
  }
});

// quartz/plugins/builtins/links.ts
import path3 from "path";
import { visit } from "unist-util-visit";
import isAbsoluteUrl from "is-absolute-url";
function canonicalSlug(dest, curSlug) {
  const url2 = new URL(dest, "https://base.com/" + stripSlashes(curSlug, true));
  let [canonical] = splitAnchor(url2.pathname);
  if (canonical.endsWith("/")) canonical += "index";
  return decodeURIComponent(stripSlashes(canonical, true));
}
var linksDefaults, legacyCrawlLinksDefaults, isAbsolute, isExternalUrl, EXTERNAL_ICON_PATH, Links;
var init_links = __esm({
  "quartz/plugins/builtins/links.ts"() {
    "use strict";
    init_path();
    init_permalinks();
    linksDefaults = {
      markdownLinkResolution: "shortest",
      prettyLinks: true,
      openLinksInNewTab: false,
      lazyLoad: false,
      externalLinkIcon: true,
      disableBrokenWikilinks: false
    };
    legacyCrawlLinksDefaults = {
      markdownLinkResolution: "absolute"
    };
    isAbsolute = isAbsoluteUrl;
    isExternalUrl = /* @__PURE__ */ __name((url2) => isAbsolute(url2, { httpOnly: false }), "isExternalUrl");
    EXTERNAL_ICON_PATH = "M320 0H288V64h32 82.7L201.4 265.4 178.7 288 224 333.3l22.6-22.6L448 109.3V192v32h64V192 32 0H480 320zM32 32H0V64 480v32H32 456h32V480 352 320H424v32 96H64V96h96 32V32H160 32z";
    __name(canonicalSlug, "canonicalSlug");
    Links = /* @__PURE__ */ __name((userOpts) => {
      const opts = { ...linksDefaults, ...userOpts };
      return {
        name: "Links",
        htmlPlugins(ctx) {
          return [
            () => {
              return (tree, file) => {
                const fileSlug = file.data.slug;
                const curSlug = simplifySlug(fileSlug);
                const outgoing = /* @__PURE__ */ new Set();
                const transformOptions = {
                  strategy: opts.markdownLinkResolution,
                  allSlugs: ctx.allSlugs
                };
                const targets = permalinkTargets(ctx.permalinks);
                const pathSlug = file.data.relativePath ? slugifyFilePath(file.data.relativePath) : fileSlug;
                const rebase = targets.size > 0 || pathSlug !== fileSlug;
                const resolveLink = /* @__PURE__ */ __name((raw) => {
                  const rel = transformLink(pathSlug, raw, transformOptions);
                  if (!rebase) return rel;
                  const hash = rel.indexOf("#");
                  const anchor = hash === -1 ? "" : rel.slice(hash);
                  const target = canonicalSlug(rel, simplifySlug(pathSlug));
                  return resolveRelative(fileSlug, targets.get(target) ?? target) + anchor;
                }, "resolveLink");
                visit(tree, "element", (node) => {
                  if (node.tagName === "a" && node.properties && typeof node.properties.href === "string") {
                    let dest = node.properties.href;
                    const classes = node.properties.className ?? [];
                    const isExternal = isExternalUrl(dest);
                    classes.push(
                      ...isExternal ? ["external", "external-link"] : ["internal", "internal-link"]
                    );
                    if (isExternal && opts.externalLinkIcon) {
                      node.children.push({
                        type: "element",
                        tagName: "svg",
                        properties: {
                          "aria-hidden": "true",
                          class: "external-icon",
                          style: "max-width:0.8em;max-height:0.8em",
                          viewBox: "0 0 512 512"
                        },
                        children: [
                          {
                            type: "element",
                            tagName: "path",
                            properties: { d: EXTERNAL_ICON_PATH },
                            children: []
                          }
                        ]
                      });
                    }
                    const firstChild = node.children[0];
                    if (node.children.length === 1 && firstChild?.type === "text" && firstChild.value !== dest) {
                      classes.push("alias");
                    }
                    node.properties.className = classes;
                    if (isExternal && opts.openLinksInNewTab) {
                      node.properties.target = "_blank";
                    }
                    const isInternal = !(isExternal || dest.startsWith("#"));
                    if (isInternal) {
                      const isGeneratedTag = classes.includes("tag-link") && /^(?:\.\.?\/)*tags\//.test(dest);
                      const resolved = isGeneratedTag ? resolveRelative(fileSlug, dest.replace(/^(?:\.\.?\/)*/, "")) : resolveLink(dest);
                      dest = node.properties.href = resolved;
                      const full = canonicalSlug(dest, curSlug);
                      outgoing.add(simplifySlug(full));
                      node.properties["data-slug"] = full;
                      if (opts.disableBrokenWikilinks && !ctx.allSlugs.includes(full)) {
                        classes.push("broken");
                        node.properties.className = classes;
                      }
                    }
                    if (opts.prettyLinks && isInternal && node.children.length === 1) {
                      const textChild = node.children[0];
                      if (textChild?.type === "text" && !textChild.value.startsWith("#") && !classes.includes("alias")) {
                        textChild.value = path3.basename(textChild.value);
                      }
                    }
                  }
                  if (["img", "video", "audio", "iframe"].includes(node.tagName) && node.properties && typeof node.properties.src === "string") {
                    if (opts.lazyLoad) node.properties.loading = "lazy";
                    if (!isExternalUrl(node.properties.src)) {
                      node.properties.src = resolveLink(node.properties.src);
                    }
                  }
                  const resourceAttr = node.tagName === "object" ? "data" : node.tagName === "source" ? "src" : void 0;
                  if (resourceAttr && node.properties) {
                    const value = node.properties[resourceAttr];
                    if (typeof value === "string" && value.length > 0 && !value.startsWith("#") && !isExternalUrl(value)) {
                      node.properties[resourceAttr] = resolveLink(value);
                    }
                  }
                });
                for (const fmLink of file.data.frontmatterLinks ?? []) {
                  if (isExternalUrl(fmLink)) continue;
                  const [targetRaw] = splitAnchor(fmLink);
                  if (!targetRaw) continue;
                  const dest = resolveLink(targetRaw);
                  outgoing.add(simplifySlug(canonicalSlug(dest, curSlug)));
                }
                file.data.links = [...outgoing];
              };
            }
          ];
        }
      };
    }, "Links");
  }
});

// quartz/plugins/builtins/index.ts
function officialPluginName(source) {
  if (typeof source === "object" && source !== null) {
    return officialPluginName(source.repo);
  }
  const npm2 = source.match(/^@quartz-community\/([a-z0-9-]+)(?:@.*)?$/);
  if (npm2) return npm2[1];
  const github = source.match(
    /^(?:github:|git\+https:\/\/github\.com\/|https:\/\/github\.com\/)quartz-community\/([a-z0-9-]+?)(?:\.git)?(?:#.*)?$/
  );
  return github?.[1];
}
function absorbingBuiltin(entry) {
  const name = officialPluginName(entry.source);
  if (!name) return void 0;
  return BUILTINS.find((b) => b.absorbs.includes(name));
}
function overlaps(a, b) {
  if (!b) return false;
  for (const [kind, names] of Object.entries(a)) {
    const other = b[kind] ?? [];
    const normalized = new Set(other.map((n) => n.replace(/^\/+/, "")));
    if ((names ?? []).some((n) => normalized.has(n.replace(/^\/+/, "")))) return true;
  }
  return false;
}
function shortName(entry, nameOf) {
  return officialPluginName(entry.source) ?? nameOf(entry).replace(/^@[^/]+\//, "");
}
function planBuiltins(input) {
  const notices = [];
  const absorbedEntries = /* @__PURE__ */ new Set();
  const builtins = [];
  for (const spec of BUILTINS) {
    const raw = input.configuration[spec.configKey];
    const configured = typeof raw === "boolean" ? { enabled: raw } : raw && typeof raw === "object" ? raw : {};
    const { enabled: explicitEnabled, order: configuredOrder, ...configuredOptions } = configured;
    for (const key of Object.keys(configuredOptions)) {
      if (!(key in spec.defaults)) {
        notices.push(
          `configuration.${spec.configKey}.${key} is not a known option (known: enabled, order, ${Object.keys(spec.defaults).join(", ")}).`
        );
      }
    }
    let options3 = { ...spec.defaults };
    let order = spec.order;
    let enabled = explicitEnabled !== false;
    let note = explicitEnabled === false ? "disabled in configuration" : void 0;
    let absorbed;
    let replacedBy;
    const legacy = input.entries.filter((e) => absorbingBuiltin(e) === spec);
    for (const entry of legacy) absorbedEntries.add(entry);
    const legacyEntry = legacy.find((e) => e.enabled) ?? legacy[0];
    if (legacyEntry) {
      absorbed = legacyEntry;
      const name = shortName(legacyEntry, input.nameOf);
      if (legacyEntry.enabled) {
        options3 = { ...options3, ...spec.absorbedDefaults, ...legacyEntry.options };
        if (legacyEntry.order !== void 0) order = legacyEntry.order;
        notices.push(
          `"${name}" is built into Quartz now: its entry in quartz.config.yaml is applied to configuration.${spec.configKey} (run \`npx quartz plugin doctor --fix\` to move it).`
        );
      } else if (explicitEnabled === void 0) {
        enabled = false;
        note = `disabled because "${name}" is disabled in quartz.config.yaml`;
        notices.push(
          `"${name}" is built into Quartz now and disabled in quartz.config.yaml, so configuration.${spec.configKey} is off (run \`npx quartz plugin doctor --fix\` to move this setting).`
        );
      }
    }
    for (const donor of spec.optionDonors ?? []) {
      const entry = input.entries.find(
        (e) => e.enabled && shortName(e, input.nameOf) === donor.plugin
      );
      for (const key of donor.keys) {
        const value = entry?.options?.[key];
        if (value !== void 0 && configuredOptions[key] === void 0) options3[key] = value;
      }
    }
    options3 = { ...options3, ...configuredOptions };
    if (typeof configuredOrder === "number") order = configuredOrder;
    if (enabled && explicitEnabled !== true) {
      const provider = input.entries.find(
        (e) => e.enabled && !absorbedEntries.has(e) && !legacy.includes(e) && overlaps(spec.replacedBy, input.providesOf(e))
      );
      if (provider) {
        enabled = false;
        replacedBy = input.nameOf(provider);
        note = `replaced by plugin "${replacedBy}"`;
      }
    }
    builtins.push({ spec, enabled, options: options3, order, note, replacedBy, absorbed });
  }
  return { builtins, absorbedEntries, notices };
}
function instantiateBuiltins(plan, category) {
  return plan.builtins.filter((b) => b.enabled && b.spec.category === category).filter((b) => !(b.spec.id === "drafts" && b.options.publish === true)).map((b) => {
    const instance = b.spec.create(b.options);
    registerPluginOrigin(instance, {
      name: instance.name,
      displayName: `configuration.${b.spec.configKey}`,
      source: "built-in",
      category: b.spec.category,
      builtin: true
    });
    return { order: b.order, instance };
  });
}
var BUILTINS;
var init_builtins = __esm({
  "quartz/plugins/builtins/index.ts"() {
    "use strict";
    init_contentIndex();
    init_drafts();
    init_frontmatter();
    init_links();
    init_diagnostics();
    init_contentIndex();
    BUILTINS = [
      {
        id: "frontmatter",
        configKey: "frontmatter",
        category: "transformer",
        order: 0,
        defaults: frontmatterDefaults,
        absorbs: [],
        optionDonors: [{ plugin: "note-properties", keys: ["delimiters", "language"] }],
        replacedBy: { data: ["frontmatter"] },
        capabilities: { provides: { data: ["frontmatter", "aliases", "frontmatterLinks"] } },
        create: /* @__PURE__ */ __name((o) => Frontmatter(o), "create")
      },
      {
        id: "links",
        configKey: "links",
        category: "transformer",
        order: 60,
        defaults: linksDefaults,
        absorbs: ["crawl-links"],
        absorbedDefaults: legacyCrawlLinksDefaults,
        replacedBy: { data: ["links"] },
        capabilities: {
          provides: { data: ["links"], dom: [".internal", ".external", ".broken"] },
          requires: { data: ["slug"] }
        },
        create: /* @__PURE__ */ __name((o) => Links(o), "create")
      },
      {
        id: "drafts",
        configKey: "drafts",
        category: "filter",
        order: 50,
        defaults: { publish: false },
        absorbs: ["remove-draft"],
        replacedBy: {},
        capabilities: {
          provides: {},
          requires: {
            data: [
              {
                name: "frontmatter",
                reason: "frontmatter is not parsed, so pages marked `draft: true` ARE PUBLISHED"
              }
            ]
          }
        },
        create: /* @__PURE__ */ __name((o) => Drafts(o), "create")
      },
      {
        id: "contentIndex",
        configKey: "contentIndex",
        category: "emitter",
        order: 50,
        defaults: contentIndexDefaults,
        absorbs: ["content-index"],
        replacedBy: { files: ["static/contentIndex.json"] },
        capabilities: {
          provides: { files: ["static/contentIndex.json", "sitemap.xml"] }
        },
        create: /* @__PURE__ */ __name((o) => ContentIndex(o), "create")
      }
    ];
    __name(officialPluginName, "officialPluginName");
    __name(absorbingBuiltin, "absorbingBuiltin");
    __name(overlaps, "overlaps");
    __name(shortName, "shortName");
    __name(planBuiltins, "planBuiltins");
    __name(instantiateBuiltins, "instantiateBuiltins");
  }
});

// quartz/util/trace.ts
import { styleText as styleText5 } from "util";
import process2 from "process";
import esbuild from "esbuild";
import { isMainThread as isMainThread3 } from "workerpool";
function firstPluginFrame(err) {
  if (!(err instanceof Error) || !err.stack) return void 0;
  const frames = err.stack.split("\n").slice(1).map((line) => line.trim()).filter((line) => line.startsWith("at "));
  const frame = frames.find((l) => pluginFrame.test(l)) ?? frames.find((l) => !l.includes("node_modules"));
  if (!frame) return void 0;
  const location = frame.match(/\(([^)]+)\)$/)?.[1] ?? frame.slice(3);
  return location.replace(/^file:\/\//, "");
}
function describePluginError(info) {
  const { origin } = info;
  const lines = [];
  const what = origin.builtin ? `Quartz built-in ${styleText5("bold", origin.displayName)}` : `plugin ${styleText5("bold", origin.displayName)}${origin.version ? `@${origin.version}` : ""}`;
  const component = info.component ? ` (component ${info.component})` : "";
  const target = info.file ? ` ${styleText5("cyan", info.file)}` : "";
  lines.push(` The error came from ${what}${component} while ${STAGE_LABEL[info.stage]}${target}.`);
  if (!origin.builtin && origin.source !== origin.displayName) {
    lines.push(styleText5("gray", `   source: ${origin.source}`));
  }
  const problems = knownProblemsFor(origin);
  if (problems.length > 0) {
    lines.push("");
    lines.push(` Known problems with ${origin.displayName} (reported before the build started):`);
    for (const p of problems.slice(0, 5)) lines.push(styleText5("yellow", `   \u2022 ${p}`));
  }
  lines.push("");
  if (origin.builtin) {
    lines.push(
      styleText5(
        "gray",
        ` This is likely a Quartz bug: https://github.com/jackyzha0/quartz/issues \u2014 include the output of \`npx quartz info\`.`
      )
    );
  } else {
    lines.push(
      styleText5(
        "gray",
        ` To check whether it's the plugin: disable it (\`npx quartz plugin disable ${origin.displayName}\`) and build again.`
      )
    );
    lines.push(
      styleText5(
        "gray",
        ` Report it${origin.issues ? ` at ${origin.issues}` : " to the plugin's author"} \u2014 include the output of \`npx quartz info\`.`
      )
    );
  }
  return lines;
}
function trace(msg, err) {
  let stack = err.stack ?? "";
  const info = pluginErrorInfo(err);
  const lines = [];
  lines.push("");
  lines.push(
    "\n" + styleText5(["bgRed", "black", "bold"], " ERROR ") + "\n\n" + styleText5("red", ` ${msg}`) + (err.message.length > 0 ? `: ${err.message}` : "")
  );
  const contentError = isContentError(err);
  if (contentError) {
    lines.push("");
    lines.push(
      styleText5("gray", " This is a problem in the file's content: fix it and build again.")
    );
  } else if (info) {
    lines.push("");
    lines.push(...describePluginError(info));
  }
  lines.push("");
  let reachedEndOfLegibleTrace = contentError;
  for (const line of stack.split("\n").slice(1)) {
    if (reachedEndOfLegibleTrace) {
      break;
    }
    if (!line.includes("node_modules") || pluginFrame.test(line)) {
      lines.push(` ${line}`);
      if (rootFile.test(line)) {
        reachedEndOfLegibleTrace = true;
      }
    }
  }
  const traceMsg = lines.join("\n");
  if (!isMainThread3) {
    throw new Error(traceMsg);
  } else {
    console.error(traceMsg);
    exitBuild(1);
  }
}
function exitBuild(code) {
  void esbuild.stop();
  process2.exit(code);
}
var rootFile, pluginFrame, STAGE_LABEL;
var init_trace = __esm({
  "quartz/util/trace.ts"() {
    "use strict";
    init_pluginErrors();
    init_diagnostics();
    rootFile = /.*at file:/;
    pluginFrame = /node_modules[\\/]@quartz-community[\\/]|[\\/]\.quartz[\\/]plugins[\\/]/;
    STAGE_LABEL = {
      textTransform: "transforming the raw text of",
      markdown: "transforming the Markdown of",
      html: "transforming the HTML of",
      filter: "deciding whether to publish",
      emit: "emitting files",
      render: "rendering",
      config: "loading the configuration"
    };
    __name(firstPluginFrame, "firstPluginFrame");
    __name(describePluginError, "describePluginError");
    __name(trace, "trace");
    __name(exitBuild, "exitBuild");
  }
});

// quartz/cli/compat.js
import fs3 from "node:fs";
import path4 from "node:path";
import semver from "semver";
function readQuartzVersion(root = process.cwd()) {
  try {
    const pkg = JSON.parse(fs3.readFileSync(path4.join(root, "package.json"), "utf8"));
    if (pkg?.name === QUARTZ_PACKAGE && typeof pkg.version === "string") return pkg.version;
  } catch {
  }
  return void 0;
}
function checkQuartzRequirement(range, version) {
  if (range === void 0 || range === null || range === "") {
    return { status: "none", range: void 0, version };
  }
  if (typeof range !== "string" || semver.validRange(range) === null) {
    return { status: "invalid", range: String(range), version };
  }
  if (!version || semver.valid(version) === null) return { status: "unknown", range, version };
  const ok = semver.satisfies(version, range, { includePrerelease: true });
  return { status: ok ? "ok" : "incompatible", range, version };
}
function describeRequirementProblem(pluginName, result, pluginVersion) {
  const label = pluginVersion ? `${pluginName}@${pluginVersion}` : pluginName;
  if (result.status === "invalid") {
    return {
      message: `${label} declares quartzVersion "${result.range}", which is not a valid semver range (ignored).`,
      hint: `Plugin authors: use e.g. ">=5.1.0" in package.json \u2192 quartz.quartzVersion.`
    };
  }
  if (result.status !== "incompatible") return void 0;
  const min = semver.minVersion(result.range);
  const newer = min && semver.gt(min, result.version);
  return {
    message: `${label} requires Quartz ${result.range}, but this is Quartz ${result.version}.`,
    hint: newer ? `Update Quartz (npx quartz upgrade), or use an older version of ${pluginName} that supports ${result.version}.` : `${pluginName} does not support this Quartz version yet \u2014 check for a newer release of the plugin.`
  };
}
function incompatiblePluginsFailBuild(env = process.env) {
  if (env.QUARTZ_ALLOW_INCOMPATIBLE_PLUGINS === "1") return false;
  return isCI(env);
}
function brokenPluginsFailBuild(env = process.env) {
  if (env.QUARTZ_ALLOW_BROKEN_PLUGINS === "1") return false;
  return isCI(env);
}
function isCI(env = process.env) {
  const ci = env.CI;
  return ci !== void 0 && ci !== "" && ci !== "0" && ci.toLowerCase() !== "false";
}
function describeDeprecation(pluginName, deprecated) {
  if (typeof deprecated !== "string" || deprecated.trim() === "") return void 0;
  return {
    message: `${pluginName} is deprecated: ${deprecated.trim()}`,
    hint: `Remove it when you have switched: npx quartz plugin remove ${pluginName}`
  };
}
var QUARTZ_PACKAGE;
var init_compat = __esm({
  "quartz/cli/compat.js"() {
    "use strict";
    QUARTZ_PACKAGE = "@jackyzha0/quartz";
    __name(readQuartzVersion, "readQuartzVersion");
    __name(checkQuartzRequirement, "checkQuartzRequirement");
    __name(describeRequirementProblem, "describeRequirementProblem");
    __name(incompatiblePluginsFailBuild, "incompatiblePluginsFailBuild");
    __name(brokenPluginsFailBuild, "brokenPluginsFailBuild");
    __name(isCI, "isCI");
    __name(describeDeprecation, "describeDeprecation");
  }
});

// quartz/cli/plugin-validation.js
function levenshtein(a, b) {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
  }
  return d[a.length][b.length];
}
function suggestClosest(input, candidates) {
  const lower = String(input).toLowerCase();
  let best = null;
  let bestDistance = Infinity;
  for (const candidate of candidates) {
    if (candidate === input) continue;
    const candLower = candidate.toLowerCase();
    if (candLower === lower) return candidate;
    const distance = levenshtein(lower, candLower);
    const threshold = Math.max(1, Math.floor(Math.max(lower.length, candLower.length) / 3));
    if (distance <= threshold && distance < bestDistance) {
      best = candidate;
      bestDistance = distance;
    } else if (bestDistance === Infinity && lower.length >= 4 && (candLower.startsWith(lower) || lower.startsWith(candLower))) {
      best = candidate;
      bestDistance = threshold + 1;
    }
  }
  return best;
}
function describeType(value) {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  return typeof value;
}
function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function validatePluginOptions(options3, manifest, prefix = "") {
  const issues = [];
  if (!isPlainObject(options3) || !manifest) return issues;
  const defaults = isPlainObject(manifest.defaultOptions) ? manifest.defaultOptions : {};
  const schema = isPlainObject(manifest.configSchema) ? manifest.configSchema : null;
  const schemaProps = schema && isPlainObject(schema.properties) ? schema.properties : {};
  const known = /* @__PURE__ */ new Set([...Object.keys(defaults), ...Object.keys(schemaProps)]);
  if (known.size === 0) return issues;
  for (const [key, value] of Object.entries(options3)) {
    const path12 = prefix ? `${prefix}.${key}` : key;
    if (!known.has(key)) {
      const suggestion = suggestClosest(key, known);
      if (suggestion) {
        issues.push({
          severity: "warning",
          path: path12,
          suggestion,
          message: `unknown option "${path12}" \u2014 did you mean "${prefix ? `${prefix}.` : ""}${suggestion}"?`
        });
      } else if (schema && schema.additionalProperties === false) {
        issues.push({
          severity: "warning",
          path: path12,
          message: `unknown option "${path12}" (known options: ${[...known].join(", ")})`
        });
      } else {
        issues.push({
          severity: "info",
          path: path12,
          message: `option "${path12}" is not one of the plugin's documented defaults (${[...known].join(", ")})`
        });
      }
      continue;
    }
    if (value === null || value === void 0) continue;
    const prop = schemaProps[key];
    if (isPlainObject(prop) && Array.isArray(prop.enum) && !prop.enum.includes(value)) {
      const suggestion = typeof value === "string" ? suggestClosest(value, prop.enum.map(String)) : null;
      issues.push({
        severity: "warning",
        path: path12,
        ...suggestion && { suggestion },
        message: `option "${path12}" must be one of ${prop.enum.map((v) => JSON.stringify(v)).join(", ")}, got ${JSON.stringify(value)}` + (suggestion ? ` \u2014 did you mean ${JSON.stringify(suggestion)}?` : "")
      });
      continue;
    }
    const expected = isPlainObject(prop) && typeof prop.type === "string" ? prop.type === "integer" ? "number" : prop.type : key in defaults && defaults[key] !== null && defaults[key] !== void 0 ? describeType(defaults[key]) : null;
    const actual = describeType(value);
    if (expected && expected !== actual) {
      const shown = key in defaults ? ` (default: ${JSON.stringify(defaults[key])})` : "";
      issues.push({
        severity: "warning",
        path: path12,
        message: `option "${path12}" should be ${expected === "array" || expected === "object" ? "an" : "a"} ${expected}${shown}, got ${actual} ${JSON.stringify(value)}`
      });
      continue;
    }
    if (isPlainObject(value) && isPlainObject(defaults[key]) && Object.keys(defaults[key]).length) {
      const nested = validatePluginOptions(value, { defaultOptions: defaults[key] }, path12);
      issues.push(...nested.filter((issue) => issue.severity === "warning"));
    }
  }
  return issues;
}
function validatePluginEntry(entry) {
  const issues = [];
  if (!isPlainObject(entry)) {
    issues.push({ severity: "error", message: "plugin entry must be a mapping with a `source`" });
    return issues;
  }
  for (const key of Object.keys(entry)) {
    if (PLUGIN_ENTRY_KEYS.includes(key)) continue;
    const suggestion = suggestClosest(key, PLUGIN_ENTRY_KEYS);
    issues.push({
      severity: "warning",
      ...suggestion && { suggestion },
      message: suggestion ? `unknown key "${key}" \u2014 did you mean "${suggestion}"? (it is ignored as written)` : `unknown key "${key}" is ignored (allowed: ${PLUGIN_ENTRY_KEYS.join(", ")})`
    });
  }
  if (entry.source === void 0 || entry.source === null || entry.source === "") {
    issues.push({ severity: "error", message: "missing `source`" });
  } else if (isPlainObject(entry.source)) {
    if (typeof entry.source.repo !== "string") {
      issues.push({ severity: "error", message: "object `source` needs a `repo` string" });
    }
    for (const key of Object.keys(entry.source)) {
      if (SOURCE_OBJECT_KEYS.includes(key)) continue;
      const suggestion = suggestClosest(key, SOURCE_OBJECT_KEYS);
      issues.push({
        severity: "warning",
        ...suggestion && { suggestion },
        message: suggestion ? `unknown source key "${key}" \u2014 did you mean "${suggestion}"?` : `unknown source key "${key}" (allowed: ${SOURCE_OBJECT_KEYS.join(", ")})`
      });
    }
  } else if (typeof entry.source !== "string") {
    issues.push({ severity: "error", message: "`source` must be a string or a { repo, \u2026 } object" });
  }
  if (!("enabled" in entry)) {
    issues.push({
      severity: "warning",
      message: "no `enabled` field \u2014 the plugin is treated as disabled. Add `enabled: true`"
    });
  } else if (typeof entry.enabled !== "boolean") {
    issues.push({
      severity: "warning",
      message: `\`enabled\` should be true or false, got ${JSON.stringify(entry.enabled)} (treated as ${entry.enabled ? "enabled" : "disabled"})`
    });
  }
  if ("options" in entry && entry.options !== null && !isPlainObject(entry.options)) {
    issues.push({ severity: "error", message: "`options` must be a mapping of option names" });
  }
  if ("order" in entry && typeof entry.order !== "number") {
    issues.push({
      severity: "warning",
      message: `\`order\` should be a number, got ${JSON.stringify(entry.order)}`
    });
  }
  if ("layout" in entry && entry.layout !== null) {
    if (!isPlainObject(entry.layout)) {
      issues.push({ severity: "error", message: "`layout` must be a mapping" });
    } else {
      for (const key of Object.keys(entry.layout)) {
        if (LAYOUT_KEYS.includes(key)) continue;
        const suggestion = suggestClosest(key, LAYOUT_KEYS);
        issues.push({
          severity: "warning",
          ...suggestion && { suggestion },
          message: suggestion ? `unknown layout key "${key}" \u2014 did you mean "${suggestion}"?` : `unknown layout key "${key}" (allowed: ${LAYOUT_KEYS.join(", ")})`
        });
      }
      const { position, display } = entry.layout;
      if (position !== void 0 && !LAYOUT_POSITIONS.includes(position)) {
        const suggestion = suggestClosest(String(position), LAYOUT_POSITIONS);
        issues.push({
          severity: "warning",
          ...suggestion && { suggestion },
          message: `layout.position ${JSON.stringify(position)} is not a known slot (${LAYOUT_POSITIONS.join(", ")})` + (suggestion ? ` \u2014 did you mean "${suggestion}"?` : "")
        });
      }
      if (display !== void 0 && !LAYOUT_DISPLAYS.includes(display)) {
        const suggestion = suggestClosest(String(display), LAYOUT_DISPLAYS);
        issues.push({
          severity: "warning",
          ...suggestion && { suggestion },
          message: `layout.display ${JSON.stringify(display)} is not valid (${LAYOUT_DISPLAYS.join(", ")})` + (suggestion ? ` \u2014 did you mean "${suggestion}"?` : "")
        });
      }
    }
  }
  return issues;
}
var PLUGIN_ENTRY_KEYS, SOURCE_OBJECT_KEYS, LAYOUT_KEYS, LAYOUT_POSITIONS, LAYOUT_DISPLAYS;
var init_plugin_validation = __esm({
  "quartz/cli/plugin-validation.js"() {
    "use strict";
    PLUGIN_ENTRY_KEYS = ["source", "enabled", "options", "order", "layout"];
    SOURCE_OBJECT_KEYS = ["repo", "subdir", "ref", "name"];
    LAYOUT_KEYS = ["position", "priority", "display", "condition", "group", "groupOptions"];
    LAYOUT_POSITIONS = ["header", "beforeBody", "left", "right", "afterBody", "footer"];
    LAYOUT_DISPLAYS = ["all", "mobile-only", "desktop-only"];
    __name(levenshtein, "levenshtein");
    __name(suggestClosest, "suggestClosest");
    __name(describeType, "describeType");
    __name(isPlainObject, "isPlainObject");
    __name(validatePluginOptions, "validatePluginOptions");
    __name(validatePluginEntry, "validatePluginEntry");
  }
});

// quartz/plugins/loader/option-validation.ts
import { styleText as styleText6 } from "util";
function collectPluginConfigWarnings(entries, manifestFor, nameOf) {
  const warnings = [];
  for (const entry of entries) {
    let plugin;
    try {
      plugin = nameOf(entry);
    } catch {
      plugin = String(entry?.source ?? "plugin");
    }
    for (const issue of validatePluginEntry(entry)) {
      warnings.push({ plugin, message: issue.message });
    }
    if (!entry?.enabled) continue;
    for (const issue of validatePluginOptions(entry.options, manifestFor(entry))) {
      if (issue.severity === "warning") warnings.push({ plugin, message: issue.message });
    }
  }
  return warnings;
}
function printPluginConfigWarnings(warnings) {
  for (const { plugin, message } of warnings) {
    recordDiagnostic({
      severity: "warning",
      area: "config",
      plugin,
      message: `quartz.config.yaml: ${plugin}: ${message}`
    });
  }
  if (process.env.QUARTZ_CONFIG_QUIET === "1") return;
  for (const { plugin, message } of warnings) {
    console.warn(
      styleText6("yellow", `\u26A0`) + ` quartz.config.yaml: ${styleText6("cyan", plugin)}: ${message}`
    );
  }
  if (warnings.length > 0) {
    console.warn(
      styleText6("gray", `  Run 'npx quartz plugin doctor' for a full check of your plugin setup.`)
    );
  }
}
var init_option_validation = __esm({
  "quartz/plugins/loader/option-validation.ts"() {
    "use strict";
    init_diagnostics();
    init_plugin_validation();
    __name(collectPluginConfigWarnings, "collectPluginConfigWarnings");
    __name(printPluginConfigWarnings, "printPluginConfigWarnings");
  }
});

// quartz/plugins/loader/conditions.ts
function hasBacklinks(props) {
  const slug = props.fileData.slug;
  if (!slug) return false;
  const target = simplifySlug(slug);
  return (props.allFiles ?? []).some((file) => {
    const f = file;
    return f.unlisted !== true && Array.isArray(f.links) && f.links.includes(target);
  });
}
function getCondition(name) {
  return customConditions.get(name) ?? builtinConditions[name];
}
function getAllConditionNames() {
  return [...Object.keys(builtinConditions), ...customConditions.keys()];
}
var builtinConditions, customConditions;
var init_conditions = __esm({
  "quartz/plugins/loader/conditions.ts"() {
    "use strict";
    init_path();
    builtinConditions = {
      "not-index": /* @__PURE__ */ __name((props) => props.fileData.slug !== "index", "not-index"),
      "has-tags": /* @__PURE__ */ __name((props) => {
        const tags = props.fileData.frontmatter?.tags;
        return Array.isArray(tags) && tags.length > 0;
      }, "has-tags"),
      // Backlinks are not stored on fileData; they are derived at render time from
      // every other file's `links` (same rule as the backlinks plugin: unlisted
      // pages don't count, and links are compared against the simplified slug).
      "has-backlinks": /* @__PURE__ */ __name((props) => hasBacklinks(props), "has-backlinks"),
      "has-toc": /* @__PURE__ */ __name((props) => {
        const toc = props.fileData.toc;
        return Array.isArray(toc) && toc.length > 0;
      }, "has-toc")
    };
    __name(hasBacklinks, "hasBacklinks");
    customConditions = /* @__PURE__ */ new Map();
    __name(getCondition, "getCondition");
    __name(getAllConditionNames, "getAllConditionNames");
  }
});

// quartz/plugins/loader/layoutReport.ts
import { isMainThread as isMainThread4 } from "node:worker_threads";
import { styleText as styleText7 } from "util";
function isLayoutSlot(value) {
  return typeof value === "string" && LAYOUT_SLOTS.includes(value);
}
function emptyLayoutReport() {
  return {
    defaults: [],
    byPageType: {},
    tsOverrides: { defaults: [], byPageType: {} },
    warnings: []
  };
}
function suggest(value, candidates) {
  const v = value.toLowerCase();
  let best;
  let bestDist = Infinity;
  for (const c of candidates) {
    const d = levenshtein2(v, c.toLowerCase());
    if (d < bestDist) {
      bestDist = d;
      best = c;
    }
  }
  return bestDist <= Math.max(2, Math.floor(value.length / 3)) ? best : void 0;
}
function levenshtein2(a, b) {
  const dp = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = dp[j];
      dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return dp[b.length];
}
function setLayoutReport(report) {
  lastReport = report;
}
function printLayoutWarnings(warnings) {
  for (const w of warnings) {
    recordDiagnostic({ severity: "warning", area: "layout", message: w.replace(/^Layout:\s*/, "") });
  }
  if (!isMainThread4 || process.env.QUARTZ_CONFIG_QUIET === "1") return;
  for (const w of warnings) {
    if (printedWarnings2.has(w)) continue;
    printedWarnings2.add(w);
    console.warn(styleText7("yellow", "\u26A0") + ` Layout: ${w}`);
  }
}
var LAYOUT_SLOTS, LayoutDiagnostics, lastReport, printedWarnings2;
var init_layoutReport = __esm({
  "quartz/plugins/loader/layoutReport.ts"() {
    "use strict";
    init_diagnostics();
    LAYOUT_SLOTS = [
      "header",
      "beforeBody",
      "afterBody",
      "left",
      "right",
      "footer"
    ];
    __name(isLayoutSlot, "isLayoutSlot");
    __name(emptyLayoutReport, "emptyLayoutReport");
    LayoutDiagnostics = class {
      static {
        __name(this, "LayoutDiagnostics");
      }
      placements = [];
      warnings = [];
      warn(message) {
        if (!this.warnings.includes(message)) this.warnings.push(message);
      }
      place(p) {
        this.placements.push(p);
      }
    };
    __name(suggest, "suggest");
    __name(levenshtein2, "levenshtein");
    lastReport = emptyLayoutReport();
    printedWarnings2 = /* @__PURE__ */ new Set();
    __name(setLayoutReport, "setLayoutReport");
    __name(printLayoutWarnings, "printLayoutWarnings");
  }
});

// quartz/util/resources.tsx
import { randomUUID } from "crypto";
import { jsx } from "preact/jsx-runtime";
function JSResourceToScriptElement(resource, preserve) {
  const scriptType = resource.moduleType ?? "application/javascript";
  const spaPreserve = preserve ?? resource.spaPreserve;
  if (resource.contentType === "external") {
    return /* @__PURE__ */ jsx("script", { src: resource.src, type: scriptType, "data-persist": spaPreserve }, resource.src);
  } else {
    const content = resource.script;
    return /* @__PURE__ */ jsx(
      "script",
      {
        type: scriptType,
        "data-persist": spaPreserve,
        dangerouslySetInnerHTML: { __html: content }
      },
      randomUUID()
    );
  }
}
function CSSResourceToStyleElement(resource, preserve) {
  const spaPreserve = preserve ?? resource.spaPreserve;
  if (resource.inline ?? false) {
    return /* @__PURE__ */ jsx("style", { dangerouslySetInnerHTML: { __html: resource.content } });
  } else {
    return /* @__PURE__ */ jsx(
      "link",
      {
        href: resource.content,
        rel: "stylesheet",
        type: "text/css",
        "data-persist": spaPreserve
      },
      resource.content
    );
  }
}
function normalizeResource(resource) {
  if (!resource) return [];
  if (Array.isArray(resource)) return resource;
  return [resource];
}
function concatenateResources(...resources) {
  return resources.filter((resource) => resource !== void 0).flat();
}
var init_resources = __esm({
  "quartz/util/resources.tsx"() {
    "use strict";
    __name(JSResourceToScriptElement, "JSResourceToScriptElement");
    __name(CSSResourceToStyleElement, "CSSResourceToStyleElement");
    __name(normalizeResource, "normalizeResource");
    __name(concatenateResources, "concatenateResources");
  }
});

// quartz/util/lang.ts
import { capitalize, classNames } from "@quartz-community/utils";
var init_lang = __esm({
  "quartz/util/lang.ts"() {
    "use strict";
  }
});

// quartz/components/Flex.tsx
import { jsx as jsx2 } from "preact/jsx-runtime";
var Flex_default;
var init_Flex = __esm({
  "quartz/components/Flex.tsx"() {
    "use strict";
    init_resources();
    init_lang();
    Flex_default = /* @__PURE__ */ __name(((config2) => {
      const Flex = /* @__PURE__ */ __name((props) => {
        const direction = config2.direction ?? "row";
        const wrap = config2.wrap ?? "nowrap";
        const gap = config2.gap ?? "1rem";
        return /* @__PURE__ */ jsx2(
          "div",
          {
            class: classNames(props.displayClass, "flex-component"),
            style: `flex-direction: ${direction}; flex-wrap: ${wrap}; gap: ${gap};`,
            children: config2.components.map((c) => {
              const grow = c.grow ? 1 : 0;
              const shrink = c.shrink ?? true ? 1 : 0;
              const basis = c.basis ?? "auto";
              const order = c.order ?? 0;
              const align = c.align ?? "center";
              const justify = c.justify ?? "center";
              return /* @__PURE__ */ jsx2(
                "div",
                {
                  style: `flex-grow: ${grow}; flex-shrink: ${shrink}; flex-basis: ${basis}; order: ${order}; align-self: ${align}; justify-self: ${justify};`,
                  children: /* @__PURE__ */ jsx2(c.Component, { ...props })
                }
              );
            })
          }
        );
      }, "Flex");
      Flex.afterDOMLoaded = concatenateResources(
        ...config2.components.map((c) => c.Component.afterDOMLoaded)
      );
      Flex.beforeDOMLoaded = concatenateResources(
        ...config2.components.map((c) => c.Component.beforeDOMLoaded)
      );
      Flex.css = concatenateResources(...config2.components.map((c) => c.Component.css));
      return Flex;
    }), "default");
  }
});

// quartz/components/MobileOnly.tsx
import { jsx as jsx3 } from "preact/jsx-runtime";
var MobileOnly_default;
var init_MobileOnly = __esm({
  "quartz/components/MobileOnly.tsx"() {
    "use strict";
    MobileOnly_default = /* @__PURE__ */ __name(((component) => {
      const Component = component;
      const MobileOnly = /* @__PURE__ */ __name((props) => {
        return /* @__PURE__ */ jsx3("div", { class: "mobile-only", children: /* @__PURE__ */ jsx3(Component, { ...props }) });
      }, "MobileOnly");
      MobileOnly.displayName = component.displayName;
      MobileOnly.afterDOMLoaded = component?.afterDOMLoaded;
      MobileOnly.beforeDOMLoaded = component?.beforeDOMLoaded;
      MobileOnly.css = component?.css;
      return MobileOnly;
    }), "default");
  }
});

// quartz/components/DesktopOnly.tsx
import { jsx as jsx4 } from "preact/jsx-runtime";
var DesktopOnly_default;
var init_DesktopOnly = __esm({
  "quartz/components/DesktopOnly.tsx"() {
    "use strict";
    DesktopOnly_default = /* @__PURE__ */ __name(((component) => {
      const Component = component;
      const DesktopOnly = /* @__PURE__ */ __name((props) => {
        return /* @__PURE__ */ jsx4("div", { class: "desktop-only", children: /* @__PURE__ */ jsx4(Component, { ...props }) });
      }, "DesktopOnly");
      DesktopOnly.displayName = component.displayName;
      DesktopOnly.afterDOMLoaded = component?.afterDOMLoaded;
      DesktopOnly.beforeDOMLoaded = component?.beforeDOMLoaded;
      DesktopOnly.css = component?.css;
      return DesktopOnly;
    }), "default");
  }
});

// quartz/components/ConditionalRender.tsx
import { jsx as jsx5 } from "preact/jsx-runtime";
var ConditionalRender_default;
var init_ConditionalRender = __esm({
  "quartz/components/ConditionalRender.tsx"() {
    "use strict";
    ConditionalRender_default = /* @__PURE__ */ __name(((config2) => {
      const ConditionalRender = /* @__PURE__ */ __name((props) => {
        if (config2.condition(props)) {
          return /* @__PURE__ */ jsx5(config2.component, { ...props });
        }
        return null;
      }, "ConditionalRender");
      ConditionalRender.afterDOMLoaded = config2.component.afterDOMLoaded;
      ConditionalRender.beforeDOMLoaded = config2.component.beforeDOMLoaded;
      ConditionalRender.css = config2.component.css;
      return ConditionalRender;
    }), "default");
  }
});

// quartz/plugins/transformers/index.ts
var init_transformers = __esm({
  "quartz/plugins/transformers/index.ts"() {
    "use strict";
  }
});

// quartz/plugins/filters/index.ts
var init_filters = __esm({
  "quartz/plugins/filters/index.ts"() {
    "use strict";
  }
});

// quartz/util/glob.ts
import path5 from "path";
import { globby } from "globby";
function toPosixPath(fp) {
  return fp.split(path5.sep).join("/");
}
async function glob(pattern, cwd, ignorePatterns) {
  const fps = (await globby(pattern, {
    cwd,
    ignore: ignorePatterns,
    gitignore: true
  })).map(toPosixPath);
  return fps;
}
var init_glob = __esm({
  "quartz/util/glob.ts"() {
    "use strict";
    __name(toPosixPath, "toPosixPath");
    __name(glob, "glob");
  }
});

// quartz/plugins/emitters/assets.ts
import path6 from "path";
import fs4 from "fs";
import { visit as visit2 } from "unist-util-visit";
function getPageTypeExtensions(ctx) {
  const extensions = /* @__PURE__ */ new Set();
  const pageTypes = ctx.cfg.plugins.pageTypes ?? [];
  for (const pt of pageTypes) {
    if (pt.fileExtensions) {
      for (const ext of pt.fileExtensions) {
        extensions.add(ext);
      }
    }
  }
  return extensions;
}
function normalizeAssetPath(raw) {
  return path6.posix.normalize(raw.split("?")[0].split("#")[0]).replace(/^\.\//, "");
}
function decode(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
function extractAssetReferences(content) {
  const assets = /* @__PURE__ */ new Set();
  for (const [tree, file] of content) {
    const location = file.data.slug ?? file.data.relativePath ?? "";
    const baseDir = path6.posix.dirname(location) === "." ? "" : path6.posix.dirname(location);
    const add = /* @__PURE__ */ __name((raw) => {
      if (/^[a-z][a-z0-9+.-]*:/i.test(raw) || raw.startsWith("//") || raw.startsWith("#")) return;
      let ref = decode(raw.split("?")[0].split("#")[0]);
      if (!ref) return;
      ref = ref.startsWith("/") ? ref.slice(1) : path6.posix.join(baseDir, ref);
      ref = path6.posix.normalize(ref).replace(/^\.\//, "");
      if (ref && !ref.startsWith("..")) assets.add(ref);
    }, "add");
    visit2(tree, "element", (node) => {
      for (const attr of URL_ATTRIBUTES) {
        const value = node.properties?.[attr];
        if (typeof value === "string") add(value);
      }
      const srcset = node.properties?.srcSet ?? node.properties?.srcset;
      for (const candidate of Array.isArray(srcset) ? srcset : typeof srcset === "string" ? srcset.split(",") : []) {
        const url2 = String(candidate).trim().split(/\s+/)[0];
        if (url2) add(url2);
      }
    });
  }
  return assets;
}
function isReferenced(references, fp) {
  return references.has(normalizeAssetPath(fp)) || references.has(slugifyFilePath(fp));
}
async function unreadableSource(err, src, fp) {
  if (err?.code === "ENOENT") return err;
  try {
    await fs4.promises.access(src, fs4.constants.R_OK);
    return err;
  } catch {
    return unreadableFileError(err, fp) ?? err;
  }
}
var URL_ATTRIBUTES, filesToCopy, copyFile, Assets;
var init_assets = __esm({
  "quartz/plugins/emitters/assets.ts"() {
    "use strict";
    init_path();
    init_glob();
    init_pluginErrors();
    __name(getPageTypeExtensions, "getPageTypeExtensions");
    __name(normalizeAssetPath, "normalizeAssetPath");
    URL_ATTRIBUTES = ["src", "href", "data", "poster"];
    __name(decode, "decode");
    __name(extractAssetReferences, "extractAssetReferences");
    __name(isReferenced, "isReferenced");
    filesToCopy = /* @__PURE__ */ __name(async (argv, cfg, excludeExtensions) => {
      const excludePatterns = ["**/*.md", ...cfg.configuration.ignorePatterns];
      for (const ext of excludeExtensions) {
        excludePatterns.push(`**/*${ext}`);
      }
      return await glob("**", argv.directory, excludePatterns);
    }, "filesToCopy");
    copyFile = /* @__PURE__ */ __name(async (argv, fp) => {
      const src = joinSegments(argv.directory, fp);
      const name = slugifyFilePath(fp);
      const dest = joinSegments(argv.output, name);
      const dir = path6.dirname(dest);
      await fs4.promises.mkdir(dir, { recursive: true });
      try {
        await fs4.promises.copyFile(src, dest);
      } catch (err) {
        throw await unreadableSource(err, src, fp);
      }
      return dest;
    }, "copyFile");
    __name(unreadableSource, "unreadableSource");
    Assets = /* @__PURE__ */ __name(() => {
      return {
        name: "Assets",
        async *emit(ctx, content) {
          const cfg = ctx.cfg.configuration;
          const publishAssets = cfg.publishAssets ?? "all";
          const excludeExtensions = getPageTypeExtensions(ctx);
          const allCandidates = await filesToCopy(ctx.argv, ctx.cfg, excludeExtensions);
          if (publishAssets === "referenced") {
            const referencedAssets = extractAssetReferences(content);
            for (const fp of allCandidates) {
              if (isReferenced(referencedAssets, fp)) {
                yield copyFile(ctx.argv, fp);
              }
            }
          } else {
            for (const fp of allCandidates) {
              yield copyFile(ctx.argv, fp);
            }
          }
        },
        async *partialEmit(ctx, content, _resources, changeEvents) {
          const cfg = ctx.cfg.configuration;
          const publishAssets = cfg.publishAssets ?? "all";
          const excludeExtensions = getPageTypeExtensions(ctx);
          const markdownChanged = changeEvents.some((e) => path6.extname(e.path) === ".md");
          if (publishAssets === "referenced" && markdownChanged) {
            const referencedAssets2 = extractAssetReferences(content);
            const allCandidates = await filesToCopy(ctx.argv, ctx.cfg, excludeExtensions);
            for (const fp of allCandidates) {
              const dest = joinSegments(ctx.argv.output, slugifyFilePath(fp));
              if (isReferenced(referencedAssets2, fp)) {
                yield copyFile(ctx.argv, fp);
              } else {
                await fs4.promises.rm(dest, { force: true });
              }
            }
            return;
          }
          const referencedAssets = publishAssets === "referenced" ? extractAssetReferences(content) : null;
          for (const changeEvent of changeEvents) {
            const ext = path6.extname(changeEvent.path);
            if (excludeExtensions.has(ext)) continue;
            if (ext === ".md") {
              continue;
            }
            if (publishAssets === "referenced" && !isReferenced(referencedAssets, changeEvent.path)) {
              continue;
            }
            if (changeEvent.type === "add" || changeEvent.type === "change") {
              try {
                yield copyFile(ctx.argv, changeEvent.path);
              } catch (err) {
                if (err.code !== "ENOENT") throw err;
              }
            } else if (changeEvent.type === "delete") {
              const name = slugifyFilePath(changeEvent.path);
              const dest = joinSegments(ctx.argv.output, name);
              await fs4.promises.rm(dest, { force: true });
            }
          }
        }
      };
    }, "Assets");
  }
});

// quartz/plugins/emitters/static.ts
import fs5 from "fs";
import { dirname } from "path";
var Static;
var init_static = __esm({
  "quartz/plugins/emitters/static.ts"() {
    "use strict";
    init_path();
    init_glob();
    Static = /* @__PURE__ */ __name(() => ({
      name: "Static",
      async *emit({ argv, cfg }) {
        const staticPath = joinSegments(QUARTZ, "static");
        const fps = await glob("**", staticPath, cfg.configuration.ignorePatterns);
        const outputStaticPath = joinSegments(argv.output, "static");
        await fs5.promises.mkdir(outputStaticPath, { recursive: true });
        for (const fp of fps) {
          const src = joinSegments(staticPath, fp);
          const dest = joinSegments(outputStaticPath, fp);
          await fs5.promises.mkdir(dirname(dest), { recursive: true });
          await fs5.promises.copyFile(src, dest);
          yield dest;
        }
      },
      async *partialEmit() {
      }
    }), "Static");
  }
});

// quartz/plugins/emitters/staticAssets.ts
import fs6 from "fs";
import path7 from "path";
function normalizeAssetTarget(to) {
  if (typeof to !== "string") return void 0;
  const trimmed = to.replace(/^\/+|\/+$/g, "");
  if (!trimmed || trimmed.includes("\\")) return void 0;
  const parts = trimmed.split("/");
  if (parts.some((p) => p === "" || p === "." || p === "..")) return void 0;
  return parts.join("/");
}
async function* walk(dir) {
  for (const entry of await fs6.promises.readdir(dir, { withFileTypes: true })) {
    const full = path7.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else if (entry.isFile()) yield full;
  }
}
async function* emitStaticAssets(ctx, assets) {
  const claimed = /* @__PURE__ */ new Map();
  for (const asset of assets ?? []) {
    const target = normalizeAssetTarget(asset?.to);
    if (!target) {
      warn({
        area: "assets",
        message: `A plugin asset has an invalid target ${JSON.stringify(asset?.to)} (must be a relative path below static/plugins/).`
      });
      continue;
    }
    const previous = claimed.get(target);
    if (previous !== void 0) {
      if (previous !== asset.from) {
        warn({
          area: "assets",
          message: `Two plugin assets are copied to static/plugins/${target} (${previous} and ${asset.from}); keeping the first.`
        });
      }
      continue;
    }
    claimed.set(target, asset.from);
    let stat;
    try {
      stat = await fs6.promises.stat(asset.from);
    } catch {
      warn({
        area: "assets",
        message: `Plugin asset ${asset.from} (for static/plugins/${target}) does not exist.`,
        hint: "Reinstall the plugin, or report it to the plugin's author."
      });
      continue;
    }
    const destRoot = joinSegments(ctx.argv.output, PLUGIN_ASSET_DIR, target);
    const files = stat.isDirectory() ? walk(asset.from) : single(asset.from);
    for await (const file of files) {
      const dest = stat.isDirectory() ? path7.join(destRoot, path7.relative(asset.from, file)) : destRoot;
      await fs6.promises.mkdir(path7.dirname(dest), { recursive: true });
      await fs6.promises.copyFile(file, dest);
      yield dest;
    }
  }
}
async function* single(file) {
  yield file;
}
var PLUGIN_ASSET_DIR;
var init_staticAssets = __esm({
  "quartz/plugins/emitters/staticAssets.ts"() {
    "use strict";
    init_path();
    init_diagnostics();
    PLUGIN_ASSET_DIR = "static/plugins";
    __name(normalizeAssetTarget, "normalizeAssetTarget");
    __name(walk, "walk");
    __name(emitStaticAssets, "emitStaticAssets");
    __name(single, "single");
  }
});

// quartz/components/scripts/spa.inline.ts
var spa_inline_default;
var init_spa_inline = __esm({
  "quartz/components/scripts/spa.inline.ts"() {
    spa_inline_default = "";
  }
});

// quartz/components/scripts/popover.inline.ts
var popover_inline_default;
var init_popover_inline = __esm({
  "quartz/components/scripts/popover.inline.ts"() {
    popover_inline_default = "";
  }
});

// quartz/styles/base.scss
var base_default;
var init_base = __esm({
  "quartz/styles/base.scss"() {
    base_default = "";
  }
});

// quartz/styles/custom.scss
var custom_default;
var init_custom = __esm({
  "quartz/styles/custom.scss"() {
    custom_default = "";
  }
});

// quartz/components/styles/popover.scss
var popover_default;
var init_popover = __esm({
  "quartz/components/styles/popover.scss"() {
    popover_default = "";
  }
});

// quartz/util/theme.ts
function getFontSpecificationName(spec) {
  if (typeof spec === "string") {
    return spec;
  }
  return spec.name;
}
function formatFontSpecification(type, spec) {
  if (typeof spec === "string") {
    spec = { name: spec };
  }
  const defaultIncludeWeights = type === "header" ? [400, 700] : [400, 600];
  const defaultIncludeItalic = type === "body";
  const weights = spec.weights ?? defaultIncludeWeights;
  const italic = spec.includeItalic ?? defaultIncludeItalic;
  const features = [];
  if (italic) {
    features.push("ital");
  }
  if (weights.length > 1) {
    const weightSpec = italic ? weights.flatMap((w) => [`0,${w}`, `1,${w}`]).sort().join(";") : weights.join(";");
    features.push(`wght@${weightSpec}`);
  }
  if (features.length > 0) {
    return `${spec.name}:${features.join(",")}`;
  }
  return spec.name;
}
function googleFontHref(theme) {
  const { header, body, code } = theme.typography;
  const headerFont = formatFontSpecification("header", header);
  const bodyFont = formatFontSpecification("body", body);
  const codeFont = formatFontSpecification("code", code);
  return `https://fonts.googleapis.com/css2?family=${headerFont}&family=${bodyFont}&family=${codeFont}&display=swap`;
}
function googleFontSubsetHref(theme, text) {
  const title = theme.typography.title || theme.typography.header;
  const titleFont = formatFontSpecification("title", title);
  return `https://fonts.googleapis.com/css2?family=${titleFont}&text=${encodeURIComponent(text)}&display=swap`;
}
async function processGoogleFonts(stylesheet, baseUrl) {
  const fontSourceRegex = /url\((https:\/\/fonts.gstatic.com\/.+(?:\/|(?:kit=))(.+?)[.&].+?)\)\sformat\('(\w+?)'\);/g;
  const fontFiles = [];
  let processedStylesheet = stylesheet;
  let match2;
  while ((match2 = fontSourceRegex.exec(stylesheet)) !== null) {
    const url2 = match2[1];
    const filename = match2[2];
    const extension = fontMimeMap[match2[3].toLowerCase()];
    const staticUrl = `https://${baseUrl}/static/fonts/${filename}.${extension}`;
    processedStylesheet = processedStylesheet.replace(url2, staticUrl);
    fontFiles.push({ url: url2, filename, extension });
  }
  return { processedStylesheet, fontFiles };
}
function hexToHsl(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return { h: 0, s: 0, l: 0 };
  const r = parseInt(result[1], 16) / 255;
  const g = parseInt(result[2], 16) / 255;
  const b = parseInt(result[3], 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l: Math.round(l * 100) };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h2 = 0;
  switch (max) {
    case r:
      h2 = ((g - b) / d + (g < b ? 6 : 0)) / 6;
      break;
    case g:
      h2 = ((b - r) / d + 2) / 6;
      break;
    case b:
      h2 = ((r - g) / d + 4) / 6;
      break;
  }
  return { h: Math.round(h2 * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}
function joinStyles(theme, ...stylesheet) {
  return `
${stylesheet.join("\n\n")}

:root {
  --light: ${theme.colors.lightMode.light};
  --lightgray: ${theme.colors.lightMode.lightgray};
  --gray: ${theme.colors.lightMode.gray};
  --darkgray: ${theme.colors.lightMode.darkgray};
  --dark: ${theme.colors.lightMode.dark};
  --secondary: ${theme.colors.lightMode.secondary};
  --tertiary: ${theme.colors.lightMode.tertiary};
  --highlight: ${theme.colors.lightMode.highlight};
  --textHighlight: ${theme.colors.lightMode.textHighlight};

  --titleFont: "${getFontSpecificationName(theme.typography.title || theme.typography.header)}", ${DEFAULT_SANS_SERIF};
  --headerFont: "${getFontSpecificationName(theme.typography.header)}", ${DEFAULT_SANS_SERIF};
  --bodyFont: "${getFontSpecificationName(theme.typography.body)}", ${DEFAULT_SANS_SERIF};
  --codeFont: "${getFontSpecificationName(theme.typography.code)}", ${DEFAULT_MONO};
}

:root[saved-theme="dark"] {
  --light: ${theme.colors.darkMode.light};
  --lightgray: ${theme.colors.darkMode.lightgray};
  --gray: ${theme.colors.darkMode.gray};
  --darkgray: ${theme.colors.darkMode.darkgray};
  --dark: ${theme.colors.darkMode.dark};
  --secondary: ${theme.colors.darkMode.secondary};
  --tertiary: ${theme.colors.darkMode.tertiary};
  --highlight: ${theme.colors.darkMode.highlight};
  --textHighlight: ${theme.colors.darkMode.textHighlight};
}

:root {
  /* Surface colors */
  --background-primary: var(--light);
  --background-primary-alt: var(--light);
  --background-secondary: var(--lightgray);
  --background-secondary-alt: var(--lightgray);
  --background-modifier-border: var(--lightgray);
  --background-modifier-border-hover: var(--gray);
  --background-modifier-border-focus: var(--secondary);

  /* Text colors */
  --text-normal: var(--darkgray);
  --text-muted: var(--gray);
  --text-faint: var(--gray);
  --text-accent: var(--secondary);
  --text-accent-hover: var(--tertiary);
  --text-on-accent: var(--light);
  --text-on-accent-inverted: var(--dark);
  --text-highlight-bg: var(--textHighlight);

  /* Interactive */
  --interactive-normal: var(--light);
  --interactive-hover: var(--lightgray);
  --interactive-accent: var(--secondary);
  --interactive-accent-hover: var(--tertiary);

  /* Base scale */
  --color-base-00: var(--light);
  --color-base-05: var(--light);
  --color-base-10: var(--light);
  --color-base-20: var(--lightgray);
  --color-base-25: var(--lightgray);
  --color-base-30: var(--lightgray);
  --color-base-35: var(--lightgray);
  --color-base-40: var(--gray);
  --color-base-50: var(--gray);
  --color-base-60: var(--gray);
  --color-base-70: var(--darkgray);
  --color-base-100: var(--dark);

  /* Font aliases */
  --font-text: var(--bodyFont);
  --font-monospace: var(--codeFont);
  --font-interface: var(--bodyFont);

  /* Nav/sidebar */
  --nav-item-color: var(--darkgray);
  --nav-item-color-hover: var(--dark);
  --nav-item-color-active: var(--secondary);
  --nav-item-background-hover: var(--lightgray);
  --nav-item-background-active: var(--highlight);

  /* Tags */
  --tag-background: var(--highlight);
  --tag-color: var(--secondary);
  --tag-background-hover: var(--lightgray);

  /* Misc */
  --icon-color: var(--darkgray);
  --icon-color-hover: var(--dark);
  --icon-color-active: var(--secondary);
  --divider-color: var(--lightgray);
  --link-color: var(--secondary);
  --link-color-hover: var(--tertiary);

  /* Accent HSL (computed from secondary) */
  --accent-h: ${hexToHsl(theme.colors.lightMode.secondary).h};
  --accent-s: ${hexToHsl(theme.colors.lightMode.secondary).s}%;
  --accent-l: ${hexToHsl(theme.colors.lightMode.secondary).l}%;
}

:root[saved-theme="dark"] {
  /* Surface colors */
  --background-primary: var(--light);
  --background-primary-alt: var(--light);
  --background-secondary: var(--lightgray);
  --background-secondary-alt: var(--lightgray);
  --background-modifier-border: var(--lightgray);
  --background-modifier-border-hover: var(--gray);
  --background-modifier-border-focus: var(--secondary);

  /* Text colors */
  --text-normal: var(--darkgray);
  --text-muted: var(--gray);
  --text-faint: var(--gray);
  --text-accent: var(--secondary);
  --text-accent-hover: var(--tertiary);
  --text-on-accent: var(--light);
  --text-on-accent-inverted: var(--dark);
  --text-highlight-bg: var(--textHighlight);

  /* Interactive */
  --interactive-normal: var(--light);
  --interactive-hover: var(--lightgray);
  --interactive-accent: var(--secondary);
  --interactive-accent-hover: var(--tertiary);

  /* Base scale */
  --color-base-00: var(--light);
  --color-base-05: var(--light);
  --color-base-10: var(--light);
  --color-base-20: var(--lightgray);
  --color-base-25: var(--lightgray);
  --color-base-30: var(--lightgray);
  --color-base-35: var(--lightgray);
  --color-base-40: var(--gray);
  --color-base-50: var(--gray);
  --color-base-60: var(--gray);
  --color-base-70: var(--darkgray);
  --color-base-100: var(--dark);

  /* Font aliases */
  --font-text: var(--bodyFont);
  --font-monospace: var(--codeFont);
  --font-interface: var(--bodyFont);

  /* Nav/sidebar */
  --nav-item-color: var(--darkgray);
  --nav-item-color-hover: var(--dark);
  --nav-item-color-active: var(--secondary);
  --nav-item-background-hover: var(--lightgray);
  --nav-item-background-active: var(--highlight);

  /* Tags */
  --tag-background: var(--highlight);
  --tag-color: var(--secondary);
  --tag-background-hover: var(--lightgray);

  /* Misc */
  --icon-color: var(--darkgray);
  --icon-color-hover: var(--dark);
  --icon-color-active: var(--secondary);
  --divider-color: var(--lightgray);
  --link-color: var(--secondary);
  --link-color-hover: var(--tertiary);

  /* Accent HSL (computed from secondary) */
  --accent-h: ${hexToHsl(theme.colors.darkMode.secondary).h};
  --accent-s: ${hexToHsl(theme.colors.darkMode.secondary).s}%;
  --accent-l: ${hexToHsl(theme.colors.darkMode.secondary).l}%;
}
`;
}
var DEFAULT_SANS_SERIF, DEFAULT_MONO, fontMimeMap;
var init_theme = __esm({
  "quartz/util/theme.ts"() {
    "use strict";
    DEFAULT_SANS_SERIF = 'system-ui, "Segoe UI", Roboto, Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol"';
    DEFAULT_MONO = "ui-monospace, SFMono-Regular, SF Mono, Menlo, monospace";
    __name(getFontSpecificationName, "getFontSpecificationName");
    __name(formatFontSpecification, "formatFontSpecification");
    __name(googleFontHref, "googleFontHref");
    __name(googleFontSubsetHref, "googleFontSubsetHref");
    fontMimeMap = {
      truetype: "ttf",
      woff: "woff",
      woff2: "woff2",
      opentype: "otf"
    };
    __name(processGoogleFonts, "processGoogleFonts");
    __name(hexToHsl, "hexToHsl");
    __name(joinStyles, "joinStyles");
  }
});

// quartz/plugins/emitters/helpers.ts
import path8 from "path";
import fs7 from "fs";
var ensuredDirs, write2;
var init_helpers = __esm({
  "quartz/plugins/emitters/helpers.ts"() {
    "use strict";
    init_path();
    ensuredDirs = /* @__PURE__ */ new Map();
    write2 = /* @__PURE__ */ __name(async ({ ctx, slug, ext, content }) => {
      const pathToPage = joinSegments(ctx.argv.output, slug + ext);
      const dir = path8.dirname(pathToPage);
      let ensured = ensuredDirs.get(dir);
      if (!ensured) {
        ensured = fs7.promises.mkdir(dir, { recursive: true });
        ensuredDirs.set(dir, ensured);
      }
      await ensured;
      await fs7.promises.writeFile(pathToPage, content);
      return pathToPage;
    }, "write");
  }
});

// quartz/plugins/emitters/componentResources.ts
import { createHash } from "crypto";
import { Features, transform } from "lightningcss";
import { transform as transpile } from "esbuild";
function hashContent(content) {
  return createHash("sha256").update(content).digest("hex").slice(0, 8);
}
function getComponentResources(ctx) {
  const allComponents = /* @__PURE__ */ new Set();
  for (const emitter of ctx.cfg.plugins.emitters) {
    const components = emitter.getQuartzComponents?.(ctx) ?? [];
    for (const component of components) {
      allComponents.add(component);
    }
  }
  for (const component of componentRegistry.getAllComponents()) {
    allComponents.add(component);
  }
  const componentResources = {
    css: /* @__PURE__ */ new Set(),
    beforeDOMLoaded: /* @__PURE__ */ new Set(),
    afterDOMLoaded: /* @__PURE__ */ new Set()
  };
  for (const component of allComponents) {
    const { css, beforeDOMLoaded, afterDOMLoaded } = component;
    for (const c of normalizeResource(css)) componentResources.css.add(c);
    for (const b of normalizeResource(beforeDOMLoaded)) componentResources.beforeDOMLoaded.add(b);
    for (const a of normalizeResource(afterDOMLoaded)) componentResources.afterDOMLoaded.add(a);
  }
  return {
    css: [...componentResources.css],
    beforeDOMLoaded: [...componentResources.beforeDOMLoaded],
    afterDOMLoaded: [...componentResources.afterDOMLoaded],
    componentCssStrings: new Set(componentResources.css)
  };
}
async function joinScripts(scripts) {
  const script = scripts.map((script2) => `(function () {${script2}})();`).join("\n");
  const res = await transpile(script, {
    minify: true
  });
  return res.code;
}
function addGlobalPageResources(ctx, componentResources) {
  const cfg = ctx.cfg.configuration;
  if (cfg.enablePopovers) {
    componentResources.afterDOMLoaded.push(popover_inline_default);
    componentResources.css.push(popover_default);
  }
  const js = /* @__PURE__ */ __name((value) => JSON.stringify(String(value)).replace(/</g, "\\u003c"), "js");
  const analytics = cfg.analytics;
  if (analytics?.provider === "google") {
    componentResources.afterDOMLoaded.push(`
      const tagId = ${js(analytics.tagId)};
      const gtagScript = document.createElement('script');
      gtagScript.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(tagId);
      gtagScript.defer = true;
      gtagScript.onload = () => {
        window.dataLayer = window.dataLayer || [];
        function gtag() {
          dataLayer.push(arguments);
        }
        gtag('js', new Date());
        gtag('config', tagId, { send_page_view: false });
        gtag('event', 'page_view', { page_title: document.title, page_location: location.href });
        document.addEventListener('nav', () => {
          gtag('event', 'page_view', { page_title: document.title, page_location: location.href });
        });
      };

      document.head.appendChild(gtagScript);
    `);
  } else if (analytics?.provider === "plausible") {
    componentResources.afterDOMLoaded.push(`
      const plausibleScript = document.createElement('script');
      plausibleScript.src = ${js(analytics.host ?? "https://plausible.io")} + '/js/script.manual.js';
      plausibleScript.setAttribute('data-domain', location.hostname);
      plausibleScript.defer = true;
      plausibleScript.onload = () => {
        window.plausible = window.plausible || function () { (window.plausible.q = window.plausible.q || []).push(arguments); };
        plausible('pageview');
        document.addEventListener('nav', () => {
          plausible('pageview');
        });
      };

      document.head.appendChild(plausibleScript);
    `);
  } else if (analytics?.provider === "umami") {
    componentResources.afterDOMLoaded.push(`
      const umamiScript = document.createElement("script");
      umamiScript.src = ${js(analytics.host ?? "https://analytics.umami.is")} + "/" + ${js(analytics.script ?? "script.js")};
      umamiScript.setAttribute("data-website-id", ${js(analytics.websiteId)});
      umamiScript.setAttribute("data-auto-track", "true");
      umamiScript.defer = true;

      document.head.appendChild(umamiScript);
    `);
  } else if (analytics?.provider === "goatcounter") {
    componentResources.afterDOMLoaded.push(`
      window.goatcounter = { no_onload: true };

      const endpoint = "https://" + ${js(analytics.websiteId)} + "." + ${js(analytics.host ?? "goatcounter.com")} + "/count";
      // Both routers emit an initial nav. Register before loading count.js so
      // cached scripts cannot count it twice, and slow scripts cannot miss it.
      let goatcounterLoaded = false;
      let pendingPageviews = [];
      document.addEventListener('nav', () => {
        const pageview = { path: location.pathname, title: document.title };
        if (goatcounterLoaded) {
          goatcounter.count(pageview);
        } else {
          pendingPageviews.push(pageview);
        }
      });

      const goatcounterScript = document.createElement('script');
      goatcounterScript.src = ${js(analytics.scriptSrc ?? "https://gc.zgo.at/count.js")};
      goatcounterScript.defer = true;
      goatcounterScript.setAttribute('data-goatcounter', endpoint);
      goatcounterScript.onload = () => {
        window.goatcounter.endpoint = endpoint;
        goatcounterLoaded = true;
        pendingPageviews.forEach((pageview) => goatcounter.count(pageview));
        pendingPageviews = [];
      };

      document.head.appendChild(goatcounterScript);
    `);
  } else if (analytics?.provider === "posthog") {
    const options3 = [
      `api_host: ${js(analytics.apiHost ?? analytics.host ?? "https://app.posthog.com")},`,
      analytics.uiHost ? `ui_host: ${js(analytics.uiHost)},` : "",
      analytics.personProfiles ? `person_profiles: ${js(analytics.personProfiles)},` : ""
    ].join("\n        ");
    componentResources.afterDOMLoaded.push(`
      !function(t,e){var o,n,p,r;e.__SV||(window.posthog=e,e._i=[],e.init=function(i,s,a){function g(t,e){var o=e.split(".");2==o.length&&(t=t[o[0]],e=o[1]),t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}}(p=t.createElement("script")).type="text/javascript",p.async=!0,p.src=s.api_host+"/static/array.js",(r=t.getElementsByTagName("script")[0]).parentNode.insertBefore(p,r);var u=e;for(void 0!==a?u=e[a]=[]:a="posthog",u.people=u.people||[],u.toString=function(t){var e="posthog";return"posthog"!==a&&(e+="."+a),t||(e+=" (stub)"),e},u.people.toString=function(){return u.toString(1)+".people (stub)"},o="capture identify alias people.set people.set_once set_config register register_once unregister opt_out_capturing has_opted_out_capturing opt_in_capturing reset isFeatureEnabled onFeatureFlags getFeatureFlag getFeatureFlagPayload reloadFeatureFlags group updateEarlyAccessFeatureEnrollment getEarlyAccessFeatures getActiveMatchingSurveys getSurveys onSessionId".split(" "),n=0;n<o.length;n++)g(u,o[n]);e._i.push([i,s,a])},e.__SV=1)}(document,window.posthog||[]);
      window.posthog.init(${js(analytics.apiKey)}, {
        ${options3}
        capture_pageview: false,
      });
      document.addEventListener('nav', () => {
        window.posthog.capture('$pageview', { path: location.pathname });
      });
    `);
  } else if (analytics?.provider === "tinylytics") {
    componentResources.afterDOMLoaded.push(`
      const tinylyticsScript = document.createElement('script');
      tinylyticsScript.src = 'https://tinylytics.app/embed/' + encodeURIComponent(${js(analytics.siteId)}) + '.js?spa';
      tinylyticsScript.defer = true;
      tinylyticsScript.onload = () => {
        window.tinylytics.triggerUpdate();
        document.addEventListener('nav', () => {
          window.tinylytics.triggerUpdate();
        });
      };

      document.head.appendChild(tinylyticsScript);
    `);
  } else if (analytics?.provider === "cabin") {
    componentResources.afterDOMLoaded.push(`
      const cabinScript = document.createElement("script")
      cabinScript.src = ${js(analytics.host ?? "https://scripts.withcabin.com")} + "/hello.js"
      cabinScript.defer = true
      document.head.appendChild(cabinScript)
    `);
  } else if (analytics?.provider === "clarity") {
    componentResources.afterDOMLoaded.push(`
      (function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
      t=l.createElement(r);t.defer=1;t.src="https://www.clarity.ms/tag/"+i;
      y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
      })(window, document, "clarity", "script", ${js(analytics.projectId)});
    `);
  } else if (analytics?.provider === "matomo") {
    componentResources.afterDOMLoaded.push(`
      const _paq = window._paq = window._paq || [];

      // Track SPA navigation
      // https://developer.matomo.org/guides/spa-tracking
      document.addEventListener("nav", () => {
        _paq.push(['setCustomUrl', location.pathname]);
        _paq.push(['setDocumentTitle', document.title]);
        _paq.push(['trackPageView']);
      });

      _paq.push(['trackPageView']);
      _paq.push(['enableLinkTracking']);
      (function() {
        const u = "//" + ${js(analytics.host)} + "/";
        _paq.push(['setTrackerUrl', u + 'matomo.php']);
        _paq.push(['setSiteId', ${js(analytics.siteId)}]);
        const d = document, g = d.createElement('script'), s = d.getElementsByTagName('script')[0];
        g.type = 'text/javascript'; g.async = true; g.src = u + 'matomo.js'; s.parentNode.insertBefore(g, s);
      })();
    `);
  } else if (analytics?.provider === "vercel") {
    componentResources.beforeDOMLoaded.push(`
      window.va = window.va || function () { (window.vaq = window.vaq || []).push(arguments); };
    `);
    componentResources.afterDOMLoaded.push(`
      const vercelInsightsScript = document.createElement("script")
      vercelInsightsScript.src = "/_vercel/insights/script.js"
      vercelInsightsScript.defer = true
      document.head.appendChild(vercelInsightsScript)
    `);
  } else if (analytics?.provider === "rybbit") {
    componentResources.afterDOMLoaded.push(`
      const rybbitScript = document.createElement("script");
      rybbitScript.src = ${js(analytics.host ?? "https://app.rybbit.io")} + "/api/script.js";
      rybbitScript.setAttribute("data-site-id", ${js(analytics.siteId)});
      rybbitScript.async = true;
      rybbitScript.defer = true;

      document.head.appendChild(rybbitScript);
    `);
  }
  if (cfg.enableSPA) {
    componentResources.afterDOMLoaded.push(spa_inline_default);
  } else {
    componentResources.afterDOMLoaded.push(`
      window.spaNavigate = (url, _) => window.location.assign(url)
      window.addCleanup = () => {}
      const event = new CustomEvent("nav", { detail: { url: document.body.dataset.slug } })
      document.dispatchEvent(event)
    `);
  }
}
var ComponentResources;
var init_componentResources = __esm({
  "quartz/plugins/emitters/componentResources.ts"() {
    "use strict";
    init_path();
    init_staticAssets();
    init_spa_inline();
    init_popover_inline();
    init_base();
    init_custom();
    init_popover();
    init_resources();
    init_registry();
    init_theme();
    init_helpers();
    __name(hashContent, "hashContent");
    __name(getComponentResources, "getComponentResources");
    __name(joinScripts, "joinScripts");
    __name(addGlobalPageResources, "addGlobalPageResources");
    ComponentResources = /* @__PURE__ */ __name(() => {
      return {
        name: "ComponentResources",
        async *emit(ctx, _content, resources) {
          const cfg = ctx.cfg.configuration;
          const componentResources = getComponentResources(ctx);
          let googleFontsStyleSheet = "";
          if (cfg.theme.fontOrigin === "local") {
          } else if (cfg.theme.fontOrigin === "googleFonts" && !cfg.theme.cdnCaching) {
            const theme = ctx.cfg.configuration.theme;
            const response = await fetch(googleFontHref(theme));
            googleFontsStyleSheet = await response.text();
            if (theme.typography.title) {
              const title = ctx.cfg.configuration.pageTitle;
              const response2 = await fetch(googleFontSubsetHref(theme, title));
              googleFontsStyleSheet += `
${await response2.text()}`;
            }
            if (!cfg.baseUrl) {
              throw new Error(
                "baseUrl must be defined when using Google Fonts without cfg.theme.cdnCaching"
              );
            }
            const { processedStylesheet, fontFiles } = await processGoogleFonts(
              googleFontsStyleSheet,
              cfg.baseUrl
            );
            googleFontsStyleSheet = processedStylesheet;
            for (const fontFile of fontFiles) {
              const res = await fetch(fontFile.url);
              if (!res.ok) {
                throw new Error(`Failed to fetch font ${fontFile.filename}`);
              }
              const buf = await res.arrayBuffer();
              yield write2({
                ctx,
                slug: joinSegments("static", "fonts", fontFile.filename),
                ext: `.${fontFile.extension}`,
                content: Buffer.from(buf)
              });
            }
          }
          addGlobalPageResources(ctx, componentResources);
          const useHashing = !ctx.argv.serve;
          const globalCss = componentResources.css.filter(
            (c) => !componentResources.componentCssStrings.has(c)
          );
          const quartzBase = joinStyles(
            ctx.cfg.configuration.theme,
            googleFontsStyleSheet,
            ...globalCss,
            base_default
          );
          const stylesheet = `@layer quartz-base {
${quartzBase}
}
${custom_default}`;
          const prescript = await joinScripts(componentResources.beforeDOMLoaded);
          let postscript;
          if (!useHashing) {
            postscript = await joinScripts(componentResources.afterDOMLoaded);
          } else {
            const scripts = componentResources.afterDOMLoaded;
            const scriptFilenames = [];
            for (let i = 0; i < scripts.length; i++) {
              const hash = hashContent(scripts[i]);
              const slug = `static/scripts/script-${i}-${hash}`;
              const filename = `${slug}.js`;
              scriptFilenames.push(filename);
              yield write2({
                ctx,
                slug,
                ext: ".js",
                content: scripts[i]
              });
            }
            const componentImports = scriptFilenames.slice(0, -1).map((f) => `import("./${f}")`).join(",\n  ");
            const spaImport = `await import("./${scriptFilenames[scriptFilenames.length - 1]}");`;
            postscript = [`await Promise.all([
  ${componentImports}
]);`, spaImport].filter(Boolean).join("\n");
          }
          const lightningTargets = {
            safari: 15 << 16 | 6 << 8,
            // 15.6
            ios_saf: 15 << 16 | 6 << 8,
            // 15.6
            edge: 115 << 16,
            firefox: 102 << 16,
            chrome: 109 << 16
          };
          const cssContent = transform({
            filename: "index.css",
            code: Buffer.from(stylesheet),
            minify: true,
            targets: lightningTargets,
            include: Features.MediaQueries
          }).code.toString();
          const cssStringToFilename = /* @__PURE__ */ new Map();
          for (const cssString of componentResources.componentCssStrings) {
            if (cssStringToFilename.has(cssString)) continue;
            const wrapped = `@layer quartz-base {
${cssString}
}`;
            const minified = transform({
              filename: "component.css",
              code: Buffer.from(wrapped),
              minify: true,
              targets: lightningTargets,
              include: Features.MediaQueries
            }).code.toString();
            const hash = hashContent(minified);
            const slug = `component-${hash}`;
            const filename = `${slug}.css`;
            cssStringToFilename.set(cssString, filename);
            yield write2({
              ctx,
              slug,
              ext: ".css",
              content: minified
            });
          }
          ctx.componentCssMap = cssStringToFilename;
          const extractedInlineResources = /* @__PURE__ */ new Map();
          for (const cssResource of resources.css) {
            if (!(cssResource.inline ?? false)) continue;
            let output;
            try {
              output = transform({
                filename: "plugin-resource.css",
                code: Buffer.from(cssResource.content),
                minify: true,
                targets: lightningTargets,
                include: Features.MediaQueries
              }).code.toString();
            } catch {
              output = cssResource.content;
            }
            const hash = hashContent(output);
            const slug = `static/resource-style-${hash}`;
            const filename = `${slug}.css`;
            extractedInlineResources.set(cssResource.content, filename);
            yield write2({
              ctx,
              slug,
              ext: ".css",
              content: output
            });
          }
          for (const jsResource of resources.js) {
            if (jsResource.contentType !== "inline") continue;
            const minified = await joinScripts([jsResource.script]);
            const hash = hashContent(minified);
            const loadTimePrefix = jsResource.loadTime === "beforeDOMReady" ? "before" : "after";
            const slug = `static/resource-${loadTimePrefix}-${hash}`;
            const filename = `${slug}.js`;
            extractedInlineResources.set(jsResource.script, filename);
            yield write2({
              ctx,
              slug,
              ext: ".js",
              content: minified
            });
          }
          ctx.extractedInlineResources = extractedInlineResources;
          yield* emitStaticAssets(ctx, resources.assets);
          const cssHash = useHashing ? hashContent(cssContent) : null;
          const prescriptHash = useHashing ? hashContent(prescript) : null;
          const postscriptHash = useHashing ? hashContent(postscript) : null;
          const cssSlug = cssHash ? `index-${cssHash}` : "index";
          const prescriptSlug = prescriptHash ? `prescript-${prescriptHash}` : "prescript";
          const postscriptSlug = postscriptHash ? `postscript-${postscriptHash}` : "postscript";
          ctx.hashedResourceNames = {
            "index.css": `${cssSlug}.css`,
            "prescript.js": `${prescriptSlug}.js`,
            "postscript.js": `${postscriptSlug}.js`
          };
          yield write2({
            ctx,
            slug: cssSlug,
            ext: ".css",
            content: cssContent
          });
          yield write2({
            ctx,
            slug: prescriptSlug,
            ext: ".js",
            content: prescript
          });
          yield write2({
            ctx,
            slug: postscriptSlug,
            ext: ".js",
            content: postscript
          });
        },
        async *partialEmit() {
        }
      };
    }, "ComponentResources");
  }
});

// quartz/plugins/emitters/index.ts
var init_emitters = __esm({
  "quartz/plugins/emitters/index.ts"() {
    "use strict";
    init_assets();
    init_static();
    init_componentResources();
  }
});

// quartz/plugins/types.ts
var init_types = __esm({
  "quartz/plugins/types.ts"() {
    "use strict";
  }
});

// quartz/plugins/config.ts
function isLoadedPlugin(plugin) {
  return typeof plugin === "object" && plugin !== null && "plugin" in plugin && "manifest" in plugin && "type" in plugin && typeof plugin.plugin === "function";
}
function getPluginInstance(plugin, options3) {
  if (isLoadedPlugin(plugin)) {
    const factory = plugin.plugin;
    return factory(options3);
  }
  return plugin;
}
var init_config = __esm({
  "quartz/plugins/config.ts"() {
    "use strict";
    __name(isLoadedPlugin, "isLoadedPlugin");
    __name(getPluginInstance, "getPluginInstance");
  }
});

// quartz/plugins/pageTypes/matchers.ts
var match;
var init_matchers = __esm({
  "quartz/plugins/pageTypes/matchers.ts"() {
    "use strict";
    match = {
      ext: /* @__PURE__ */ __name((extension) => {
        const normalized = extension.startsWith(".") ? extension : `.${extension}`;
        return ({ slug }) => slug.endsWith(normalized) || !slug.includes(".");
      }, "ext"),
      slugPrefix: /* @__PURE__ */ __name((prefix) => {
        return ({ slug }) => slug.startsWith(prefix);
      }, "slugPrefix"),
      frontmatter: /* @__PURE__ */ __name((key, predicate) => {
        return ({ fileData }) => {
          const fm = fileData.frontmatter;
          return fm ? predicate(fm[key]) : false;
        };
      }, "frontmatter"),
      and: /* @__PURE__ */ __name((...matchers) => {
        return (args) => matchers.every((m) => m(args));
      }, "and"),
      or: /* @__PURE__ */ __name((...matchers) => {
        return (args) => matchers.some((m) => m(args));
      }, "or"),
      not: /* @__PURE__ */ __name((matcher) => {
        return (args) => !matcher(args);
      }, "not"),
      all: /* @__PURE__ */ __name(() => {
        return () => true;
      }, "all"),
      none: /* @__PURE__ */ __name(() => {
        return () => false;
      }, "none")
    };
  }
});

// quartz/components/pages/404.tsx
import { jsx as jsx6, jsxs } from "preact/jsx-runtime";
var NotFound, __default;
var init__ = __esm({
  "quartz/components/pages/404.tsx"() {
    "use strict";
    init_i18n();
    NotFound = /* @__PURE__ */ __name(({ cfg, ctx }) => {
      const url2 = new URL(`https://${cfg.baseUrl ?? "example.com"}`);
      const baseDir = ctx.argv.serve ? "/" : url2.pathname;
      return /* @__PURE__ */ jsxs("article", { class: "popover-hint", children: [
        /* @__PURE__ */ jsx6("h1", { children: "404" }),
        /* @__PURE__ */ jsx6("p", { children: i18n(cfg.locale).pages.error.notFound }),
        /* @__PURE__ */ jsx6("a", { href: baseDir, children: i18n(cfg.locale).pages.error.home }),
        /* @__PURE__ */ jsx6(
          "script",
          {
            dangerouslySetInnerHTML: {
              __html: `
          if (typeof fetchData !== "undefined") {
            fetchData.then(function(index) {
              var basePath = document.body.dataset.basepath || "";
              if (basePath.length > 1 && basePath.endsWith("/")) {
                basePath = basePath.slice(0, -1);
              }
              var pathname = window.location.pathname;
              var hasBasePrefix = basePath.length > 1 && pathname.startsWith(basePath);
              if (hasBasePrefix) {
                pathname = pathname.slice(basePath.length);
              }
              if (pathname.startsWith("/")) {
                pathname = pathname.slice(1);
              }
              if (pathname.endsWith("/")) {
                pathname = pathname.slice(0, -1);
              }
              if (pathname.endsWith(".html")) {
                pathname = pathname.slice(0, -5);
              }
              if (pathname.endsWith("/index")) {
                pathname = pathname.slice(0, -6);
              }
              var lowered = pathname.toLowerCase();
              if (lowered !== pathname && index[lowered] != null) {
                var prefix = hasBasePrefix ? basePath : "";
                var target = prefix + (prefix.endsWith("/") ? "" : "/") + lowered;
                window.location.replace(target);
              }
            });
          }
          `
            }
          }
        )
      ] });
    }, "NotFound");
    __default = /* @__PURE__ */ __name((() => NotFound), "default");
  }
});

// quartz/components/Head.tsx
var Head_exports = {};
__export(Head_exports, {
  default: () => Head_default
});
import { Fragment, jsx as jsx7, jsxs as jsxs2 } from "preact/jsx-runtime";
var Head_default;
var init_Head = __esm({
  "quartz/components/Head.tsx"() {
    "use strict";
    init_i18n();
    init_path();
    init_resources();
    init_theme();
    init_escape();
    Head_default = /* @__PURE__ */ __name((() => {
      const Head = /* @__PURE__ */ __name(({
        cfg,
        fileData,
        externalResources,
        ctx
      }) => {
        const titleSuffix = cfg.pageTitleSuffix ?? "";
        const title = (fileData.frontmatter?.title ?? i18n(cfg.locale).propertyDefaults.title) + titleSuffix;
        const description = fileData.frontmatter?.socialDescription ?? fileData.frontmatter?.description ?? unescapeHTML(fileData.description?.trim() ?? i18n(cfg.locale).propertyDefaults.description);
        const { css, js, additionalHead } = externalResources;
        const url2 = new URL(`https://${cfg.baseUrl ?? "example.com"}`);
        const path12 = url2.pathname;
        const baseDir = fileData.slug === "404" ? path12 : pathToRoot(fileData.slug);
        const iconPath = joinSegments(baseDir, "static/icon.png");
        const socialUrl = fileData.slug === "404" ? url2.toString() : joinSegments(url2.toString(), fileData.slug);
        const usesCustomOgImage = ctx.cfg.plugins.emitters.some((e) => e.name === "CustomOgImages");
        const ogImageDefaultPath = `https://${cfg.baseUrl}/static/og-image.png`;
        const coreStylesheet = css[0]?.content;
        const coreScript = js.find(
          (r) => r.loadTime === "beforeDOMReady" && r.contentType === "external"
        );
        return /* @__PURE__ */ jsxs2("head", { children: [
          /* @__PURE__ */ jsx7("title", { children: title }),
          /* @__PURE__ */ jsx7("meta", { charSet: "utf-8" }),
          coreStylesheet && /* @__PURE__ */ jsx7("link", { rel: "preload", href: coreStylesheet, as: "style" }),
          coreScript && coreScript.contentType === "external" && /* @__PURE__ */ jsx7("link", { rel: "preload", href: coreScript.src, as: "script" }),
          cfg.theme.cdnCaching && cfg.theme.fontOrigin === "googleFonts" && /* @__PURE__ */ jsxs2(Fragment, { children: [
            /* @__PURE__ */ jsx7("link", { rel: "preconnect", href: "https://fonts.googleapis.com" }),
            /* @__PURE__ */ jsx7("link", { rel: "preconnect", href: "https://fonts.gstatic.com" }),
            /* @__PURE__ */ jsx7("link", { rel: "stylesheet", href: googleFontHref(cfg.theme) }),
            cfg.theme.typography.title && /* @__PURE__ */ jsx7("link", { rel: "stylesheet", href: googleFontSubsetHref(cfg.theme, cfg.pageTitle) })
          ] }),
          /* @__PURE__ */ jsx7("link", { rel: "preconnect", href: "https://cdnjs.cloudflare.com", crossOrigin: "anonymous" }),
          /* @__PURE__ */ jsx7("meta", { name: "viewport", content: "width=device-width, initial-scale=1.0" }),
          /* @__PURE__ */ jsx7("meta", { name: "og:site_name", content: cfg.pageTitle }),
          /* @__PURE__ */ jsx7("meta", { property: "og:title", content: title }),
          /* @__PURE__ */ jsx7("meta", { property: "og:type", content: "website" }),
          /* @__PURE__ */ jsx7("meta", { name: "twitter:card", content: "summary_large_image" }),
          /* @__PURE__ */ jsx7("meta", { name: "twitter:title", content: title }),
          /* @__PURE__ */ jsx7("meta", { name: "twitter:description", content: description }),
          /* @__PURE__ */ jsx7("meta", { property: "og:description", content: description }),
          /* @__PURE__ */ jsx7("meta", { property: "og:image:alt", content: description }),
          !usesCustomOgImage && /* @__PURE__ */ jsxs2(Fragment, { children: [
            /* @__PURE__ */ jsx7("meta", { property: "og:image", content: ogImageDefaultPath }),
            /* @__PURE__ */ jsx7("meta", { property: "og:image:url", content: ogImageDefaultPath }),
            /* @__PURE__ */ jsx7("meta", { name: "twitter:image", content: ogImageDefaultPath }),
            /* @__PURE__ */ jsx7(
              "meta",
              {
                property: "og:image:type",
                content: `image/${getFileExtension(ogImageDefaultPath) ?? "png"}`
              }
            )
          ] }),
          cfg.baseUrl && /* @__PURE__ */ jsxs2(Fragment, { children: [
            /* @__PURE__ */ jsx7("meta", { property: "twitter:domain", content: cfg.baseUrl }),
            /* @__PURE__ */ jsx7("meta", { property: "og:url", content: socialUrl }),
            /* @__PURE__ */ jsx7("meta", { property: "twitter:url", content: socialUrl })
          ] }),
          /* @__PURE__ */ jsx7("link", { rel: "icon", href: iconPath }),
          /* @__PURE__ */ jsx7("meta", { name: "description", content: description }),
          /* @__PURE__ */ jsx7("meta", { name: "generator", content: "Quartz" }),
          css.map((resource) => CSSResourceToStyleElement(resource, true)),
          js.filter((resource) => resource.loadTime === "beforeDOMReady").map((res) => JSResourceToScriptElement(res, true)),
          additionalHead.map((resource) => {
            if (typeof resource === "function") {
              return resource(fileData);
            } else {
              return resource;
            }
          })
        ] });
      }, "Head");
      return Head;
    }), "default");
  }
});

// quartz/components/Spacer.tsx
import { jsx as jsx8 } from "preact/jsx-runtime";
var init_Spacer = __esm({
  "quartz/components/Spacer.tsx"() {
    "use strict";
    init_lang();
  }
});

// quartz/components/external.ts
var init_external = __esm({
  "quartz/components/external.ts"() {
    "use strict";
    init_registry();
  }
});

// quartz/components/index.ts
var init_components = __esm({
  "quartz/components/index.ts"() {
    "use strict";
    init__();
    init_Head();
    init_Spacer();
    init_DesktopOnly();
    init_MobileOnly();
    init_Flex();
    init_ConditionalRender();
    init_registry();
    init_external();
  }
});

// quartz/plugins/vfile.ts
import { VFile } from "vfile";
function defaultProcessedContent(vfileData) {
  const root = { type: "root", children: [] };
  const vfile = new VFile("");
  vfile.data = vfileData;
  return [root, vfile];
}
var init_vfile = __esm({
  "quartz/plugins/vfile.ts"() {
    "use strict";
    __name(defaultProcessedContent, "defaultProcessedContent");
  }
});

// quartz/plugins/pageTypes/404.ts
var NotFoundPageType;
var init__2 = __esm({
  "quartz/plugins/pageTypes/404.ts"() {
    "use strict";
    init_matchers();
    init_components();
    init_vfile();
    init_i18n();
    NotFoundPageType = /* @__PURE__ */ __name(() => ({
      name: "404",
      priority: -1,
      match: match.none(),
      generate({ cfg }) {
        const notFound = i18n(cfg.locale).pages.error.title;
        const slug = "404";
        const [, vfile] = defaultProcessedContent({
          slug,
          text: notFound,
          description: notFound,
          frontmatter: { title: notFound, tags: [] },
          unlisted: true
        });
        return [
          {
            slug,
            title: notFound,
            data: vfile.data
          }
        ];
      },
      layout: "404",
      frame: "minimal",
      body: __default
    }), "NotFoundPageType");
  }
});

// quartz/components/Body.tsx
import { jsx as jsx9 } from "preact/jsx-runtime";
var Body, Body_default;
var init_Body = __esm({
  "quartz/components/Body.tsx"() {
    "use strict";
    Body = /* @__PURE__ */ __name(({ children }) => {
      return /* @__PURE__ */ jsx9("div", { id: "quartz-body", children });
    }, "Body");
    Body_default = /* @__PURE__ */ __name((() => Body), "default");
  }
});

// quartz/util/clone.ts
import rfdc from "rfdc";
var clone;
var init_clone = __esm({
  "quartz/util/clone.ts"() {
    "use strict";
    clone = rfdc();
  }
});

// quartz/components/Header.tsx
import { jsx as jsx10 } from "preact/jsx-runtime";
var Header, Header_default;
var init_Header = __esm({
  "quartz/components/Header.tsx"() {
    "use strict";
    Header = /* @__PURE__ */ __name(({ children }) => {
      return children.length > 0 ? /* @__PURE__ */ jsx10("header", { children }) : null;
    }, "Header");
    Header.css = `
header {
  display: flex;
  flex-direction: row;
  align-items: center;
  margin: 2rem 0;
  gap: 1.5rem;
}

header h1 {
  margin: 0;
  flex: auto;
}
`;
    Header_default = /* @__PURE__ */ __name((() => Header), "default");
  }
});

// quartz/components/frames/DefaultFrame.tsx
import { Fragment as Fragment2, jsx as jsx11, jsxs as jsxs3 } from "preact/jsx-runtime";
var Header2, DefaultFrame;
var init_DefaultFrame = __esm({
  "quartz/components/frames/DefaultFrame.tsx"() {
    "use strict";
    init_Header();
    Header2 = Header_default();
    DefaultFrame = {
      name: "default",
      render({
        componentData,
        header,
        beforeBody,
        pageBody: Content,
        afterBody,
        left,
        right,
        footer,
        sidebars
      }) {
        return /* @__PURE__ */ jsxs3(Fragment2, { children: [
          /* @__PURE__ */ jsx11("div", { class: "left sidebar", "data-sidebar-mode": sidebars?.left ?? "fit", children: left.map((BodyComponent) => /* @__PURE__ */ jsx11(BodyComponent, { ...componentData })) }),
          /* @__PURE__ */ jsxs3("div", { class: "center", children: [
            /* @__PURE__ */ jsxs3("div", { class: "page-header", children: [
              /* @__PURE__ */ jsx11(Header2, { ...componentData, children: header.map((HeaderComponent) => /* @__PURE__ */ jsx11(HeaderComponent, { ...componentData })) }),
              /* @__PURE__ */ jsx11("div", { class: "popover-hint", children: beforeBody.map((BodyComponent) => /* @__PURE__ */ jsx11(BodyComponent, { ...componentData })) })
            ] }),
            /* @__PURE__ */ jsx11(Content, { ...componentData }),
            /* @__PURE__ */ jsx11("hr", {}),
            /* @__PURE__ */ jsx11("div", { class: "page-footer", children: afterBody.map((BodyComponent) => /* @__PURE__ */ jsx11(BodyComponent, { ...componentData })) })
          ] }),
          /* @__PURE__ */ jsx11("div", { class: "right sidebar", "data-sidebar-mode": sidebars?.right ?? "fit", children: right.map((BodyComponent) => /* @__PURE__ */ jsx11(BodyComponent, { ...componentData })) }),
          footer.map((FooterComponent) => /* @__PURE__ */ jsx11(FooterComponent, { ...componentData }))
        ] });
      }
    };
  }
});

// quartz/components/frames/FullWidthFrame.tsx
import { Fragment as Fragment3, jsx as jsx12, jsxs as jsxs4 } from "preact/jsx-runtime";
var Header3, FullWidthFrame;
var init_FullWidthFrame = __esm({
  "quartz/components/frames/FullWidthFrame.tsx"() {
    "use strict";
    init_Header();
    Header3 = Header_default();
    FullWidthFrame = {
      name: "full-width",
      render({
        componentData,
        header,
        beforeBody,
        pageBody: Content,
        afterBody,
        footer
      }) {
        return /* @__PURE__ */ jsxs4(Fragment3, { children: [
          /* @__PURE__ */ jsxs4("div", { class: "center full-width", children: [
            /* @__PURE__ */ jsxs4("div", { class: "page-header", children: [
              /* @__PURE__ */ jsx12(Header3, { ...componentData, children: header.map((HeaderComponent) => /* @__PURE__ */ jsx12(HeaderComponent, { ...componentData })) }),
              /* @__PURE__ */ jsx12("div", { class: "popover-hint", children: beforeBody.map((BodyComponent) => /* @__PURE__ */ jsx12(BodyComponent, { ...componentData })) })
            ] }),
            /* @__PURE__ */ jsx12(Content, { ...componentData }),
            /* @__PURE__ */ jsx12("hr", {}),
            /* @__PURE__ */ jsx12("div", { class: "page-footer", children: afterBody.map((BodyComponent) => /* @__PURE__ */ jsx12(BodyComponent, { ...componentData })) })
          ] }),
          footer.map((FooterComponent) => /* @__PURE__ */ jsx12(FooterComponent, { ...componentData }))
        ] });
      }
    };
  }
});

// quartz/components/frames/MinimalFrame.tsx
import { Fragment as Fragment4, jsx as jsx13, jsxs as jsxs5 } from "preact/jsx-runtime";
var MinimalFrame;
var init_MinimalFrame = __esm({
  "quartz/components/frames/MinimalFrame.tsx"() {
    "use strict";
    MinimalFrame = {
      name: "minimal",
      render({ componentData, pageBody: Content, footer }) {
        return /* @__PURE__ */ jsxs5(Fragment4, { children: [
          /* @__PURE__ */ jsx13("div", { class: "center minimal", children: /* @__PURE__ */ jsx13(Content, { ...componentData }) }),
          footer.map((FooterComponent) => /* @__PURE__ */ jsx13(FooterComponent, { ...componentData }))
        ] });
      }
    };
  }
});

// quartz/components/frames/index.ts
function resolveFrame(name) {
  if (!name || name === "default") {
    return DefaultFrame;
  }
  const registered = frameRegistry.get(name);
  if (registered) {
    return registered.frame;
  }
  const frame = builtinFrames[name];
  if (!frame) {
    if (warnedUnknownFrames.has(name)) return DefaultFrame;
    warnedUnknownFrames.add(name);
    const allFrameNames = [...Object.keys(builtinFrames), ...[...frameRegistry.getAll().keys()]];
    console.warn(
      `Unknown page frame "${name}", falling back to "default". Available frames: ${allFrameNames.join(", ")}`
    );
    return DefaultFrame;
  }
  return frame;
}
var builtinFrames, warnedUnknownFrames;
var init_frames = __esm({
  "quartz/components/frames/index.ts"() {
    "use strict";
    init_DefaultFrame();
    init_FullWidthFrame();
    init_MinimalFrame();
    init_registry2();
    init_DefaultFrame();
    init_FullWidthFrame();
    init_MinimalFrame();
    init_registry2();
    builtinFrames = {
      default: DefaultFrame,
      "full-width": FullWidthFrame,
      minimal: MinimalFrame
    };
    warnedUnknownFrames = /* @__PURE__ */ new Set();
    __name(resolveFrame, "resolveFrame");
  }
});

// quartz/components/renderPage.tsx
import { render } from "preact-render-to-string";
import { styleText as styleText8 } from "util";
import { jsx as jsx14, jsxs as jsxs6 } from "preact/jsx-runtime";
function headingHasId(heading, id) {
  if (heading.properties?.id === id) return true;
  const hasAlias = /* @__PURE__ */ __name((el) => el.children.some(
    (child) => child.type === "element" && (child.properties?.id === id && [].concat(child.properties?.className ?? []).includes("heading-alias") || hasAlias(child))
  ), "hasAlias");
  return hasAlias(heading);
}
function pageResources(baseDir, staticResources, ctx) {
  const hashedNames = ctx?.hashedResourceNames;
  const cssFile = hashedNames?.["index.css"] ?? "index.css";
  const prescriptFile = hashedNames?.["prescript.js"] ?? "prescript.js";
  const postscriptFile = hashedNames?.["postscript.js"] ?? "postscript.js";
  const componentCssResources = [];
  if (ctx?.componentCssMap) {
    const seen = /* @__PURE__ */ new Set();
    for (const filename of ctx.componentCssMap.values()) {
      if (seen.has(filename)) continue;
      seen.add(filename);
      componentCssResources.push({ content: joinSegments(baseDir, filename) });
    }
  }
  const extracted = ctx?.extractedInlineResources;
  const resolvedCss = staticResources.css.map((resource) => {
    if (!(resource.inline ?? false) || !extracted) return resource;
    const filename = extracted.get(resource.content);
    if (!filename) return resource;
    return { content: joinSegments(baseDir, filename) };
  });
  const resolvedJs = staticResources.js.map((resource) => {
    if (resource.contentType !== "inline" || !extracted) return resource;
    const filename = extracted.get(resource.script);
    if (!filename) return resource;
    return {
      src: joinSegments(baseDir, filename),
      loadTime: resource.loadTime,
      contentType: "external",
      moduleType: resource.moduleType,
      spaPreserve: resource.spaPreserve
    };
  });
  const contentIndexPath = joinSegments(baseDir, "static/contentIndex.json");
  const contentIndexScript = `const fetchData = fetch("${contentIndexPath}").then(r => { if (!r.ok) throw new Error("HTTP " + r.status); return r.json() }).catch(e => { console.warn("[Quartz] Could not load ${contentIndexPath} (" + e.message + "); is configuration.contentIndex disabled?"); return {} });window.quartzStaticUrl = new URL(${JSON.stringify(joinSegments(baseDir, "static") + "/")}, location.href).href`;
  const resources = {
    css: [
      {
        content: joinSegments(baseDir, cssFile)
      },
      ...componentCssResources,
      ...resolvedCss
    ],
    js: [
      {
        src: joinSegments(baseDir, prescriptFile),
        loadTime: "beforeDOMReady",
        contentType: "external"
      },
      {
        loadTime: "beforeDOMReady",
        contentType: "inline",
        spaPreserve: true,
        script: contentIndexScript
      },
      ...resolvedJs
    ],
    additionalHead: staticResources.additionalHead
  };
  resources.js.push({
    src: joinSegments(baseDir, postscriptFile),
    loadTime: "afterDOMReady",
    moduleType: "module",
    contentType: "external"
  });
  return resources;
}
function renderTranscludes(root, cfg, slug, componentData, visited) {
  function walk2(node) {
    const children = node.children ?? [];
    for (let i = 0; i < children.length; i++) {
      const child = children[i];
      if (child?.type !== "element") continue;
      const el = child;
      if (el.tagName !== "blockquote") {
        walk2(el);
        continue;
      }
      const classNames2 = el.properties?.className ?? [];
      if (!classNames2.includes("transclude")) {
        walk2(el);
        continue;
      }
      const inner = el.children[0];
      const transcludeTarget = inner.properties["data-slug"] ?? slug;
      if (visited.has(transcludeTarget)) {
        console.warn(
          styleText8(
            "yellow",
            `Warning: Skipping circular transclusion: ${slug} -> ${transcludeTarget}`
          )
        );
        el.children = [
          {
            type: "element",
            tagName: "p",
            properties: { style: "color: var(--secondary);" },
            children: [
              {
                type: "text",
                value: `Circular transclusion detected: ${transcludeTarget}`
              }
            ]
          }
        ];
        continue;
      }
      visited.add(transcludeTarget);
      let page = componentData.allFiles.find((f) => f.slug === transcludeTarget);
      if (!page) {
        const dotIdx = transcludeTarget.lastIndexOf(".");
        const slashIdx = transcludeTarget.lastIndexOf("/");
        if (dotIdx > slashIdx + 1) {
          const stripped = transcludeTarget.slice(0, dotIdx);
          page = componentData.allFiles.findLast((f) => f.slug === stripped);
        }
      }
      if (!page) {
        visited.delete(transcludeTarget);
        continue;
      }
      let blockRef = el.properties.dataBlock;
      if (blockRef?.startsWith("#^")) {
        blockRef = blockRef.slice("#^".length);
        let blockNode = page.blocks?.[blockRef];
        if (blockNode) {
          if (blockNode.tagName === "li") {
            blockNode = {
              type: "element",
              tagName: "ul",
              properties: {},
              children: [blockNode]
            };
          }
          el.children = [
            normalizeHastElement(blockNode, slug, transcludeTarget),
            {
              type: "element",
              tagName: "a",
              properties: {
                href: inner.properties?.href,
                class: ["internal", "internal-link", "transclude-src"]
              },
              children: [
                { type: "text", value: i18n(cfg.locale).components.transcludes.linkToOriginal }
              ]
            }
          ];
        }
      } else if (blockRef?.startsWith("#") && page.htmlAst) {
        blockRef = blockRef.slice(1);
        let startIdx = void 0;
        let startDepth = void 0;
        let endIdx = void 0;
        for (const [i2, htmlEl] of page.htmlAst.children.entries()) {
          if (!(htmlEl.type === "element" && htmlEl.tagName.match(headerRegex))) continue;
          const depth = Number(htmlEl.tagName.substring(1));
          if (startIdx === void 0 || startDepth === void 0) {
            if (headingHasId(htmlEl, blockRef)) {
              startIdx = i2;
              startDepth = depth;
            }
          } else if (depth <= startDepth) {
            endIdx = i2;
            break;
          }
        }
        if (startIdx === void 0) {
          visited.delete(transcludeTarget);
          continue;
        }
        el.children = [
          ...page.htmlAst.children.slice(startIdx, endIdx).map(
            (c) => normalizeHastElement(c, slug, transcludeTarget)
          ),
          {
            type: "element",
            tagName: "a",
            properties: {
              href: inner.properties?.href,
              class: ["internal", "internal-link", "transclude-src"]
            },
            children: [
              { type: "text", value: i18n(cfg.locale).components.transcludes.linkToOriginal }
            ]
          }
        ];
      } else if (page.htmlAst) {
        el.children = [
          {
            type: "element",
            tagName: "h1",
            properties: {},
            children: [
              {
                type: "text",
                value: page.frontmatter?.title ?? i18n(cfg.locale).components.transcludes.transcludeOf({
                  targetSlug: page.slug
                })
              }
            ]
          },
          ...page.htmlAst.children.map(
            (c) => normalizeHastElement(c, slug, transcludeTarget)
          ),
          {
            type: "element",
            tagName: "a",
            properties: {
              href: inner.properties?.href,
              class: ["internal", "internal-link", "transclude-src"]
            },
            children: [
              { type: "text", value: i18n(cfg.locale).components.transcludes.linkToOriginal }
            ]
          }
        ];
      }
      walk2(el);
      visited.delete(transcludeTarget);
    }
  }
  __name(walk2, "walk");
  walk2(root);
}
function renderPage(cfg, slug, componentData, components, pageResources2, treeTransforms) {
  const root = clone(componentData.tree);
  const visited = /* @__PURE__ */ new Set([slug]);
  renderTranscludes(root, cfg, slug, componentData, visited);
  if (treeTransforms) {
    for (const transform2 of treeTransforms) {
      transform2(root, slug, componentData);
    }
  }
  componentData.tree = root;
  const {
    head: Head,
    header,
    beforeBody,
    pageBody: Content,
    afterBody,
    left,
    right,
    footer,
    frame: frameName,
    sidebars
  } = components;
  const Body2 = Body_default();
  const frame = resolveFrame(frameName);
  const lang = componentData.fileData.frontmatter?.lang ?? cfg.locale?.split("-")[0] ?? "en";
  const direction = i18n(cfg.locale).direction ?? "ltr";
  const basePath = componentData.ctx.argv.serve || !cfg.baseUrl ? "" : new URL(`https://${cfg.baseUrl}`).pathname.replace(/\/$/, "");
  const doc = /* @__PURE__ */ jsxs6("html", { lang, dir: direction, children: [
    /* @__PURE__ */ jsx14(Head, { ...componentData }),
    /* @__PURE__ */ jsxs6("body", { "data-slug": slug, "data-basepath": basePath, children: [
      frame.css && /* @__PURE__ */ jsx14("style", { dangerouslySetInnerHTML: { __html: frame.css } }),
      /* @__PURE__ */ jsx14("div", { id: "quartz-root", class: "page", "data-frame": frame.name, children: /* @__PURE__ */ jsx14(Body2, { ...componentData, children: [
        frame.render({
          componentData,
          head: Head,
          header,
          beforeBody,
          pageBody: Content,
          afterBody,
          left,
          right,
          footer,
          sidebars: { left: sidebars?.left ?? "fit", right: sidebars?.right ?? "fit" }
        })
      ] }) })
    ] }),
    pageResources2.js.filter((resource) => resource.loadTime === "afterDOMReady").map((res) => JSResourceToScriptElement(res, true))
  ] });
  return "<!DOCTYPE html>\n" + render(doc);
}
var headerRegex;
var init_renderPage = __esm({
  "quartz/components/renderPage.tsx"() {
    "use strict";
    init_Body();
    init_resources();
    init_path();
    init_clone();
    init_i18n();
    init_frames();
    headerRegex = new RegExp(/h[1-6]/);
    __name(headingHasId, "headingHasId");
    __name(pageResources, "pageResources");
    __name(renderTranscludes, "renderTranscludes");
    __name(renderPage, "renderPage");
  }
});

// quartz/util/fileTrie.ts
var FileTrieNode;
var init_fileTrie = __esm({
  "quartz/util/fileTrie.ts"() {
    "use strict";
    init_path();
    FileTrieNode = class _FileTrieNode {
      static {
        __name(this, "FileTrieNode");
      }
      isFolder;
      children;
      slugSegments;
      // prefer showing the file path segment over the slug segment
      // so that folders that dont have index files can be shown as is
      // without dashes in the slug
      fileSegmentHint;
      displayNameOverride;
      data;
      constructor(segments, data) {
        this.children = [];
        this.slugSegments = segments;
        this.data = data ?? null;
        this.isFolder = false;
        this.displayNameOverride = void 0;
      }
      get displayName() {
        const nonIndexTitle = this.data?.title === "index" ? void 0 : this.data?.title;
        return this.displayNameOverride ?? nonIndexTitle ?? this.fileSegmentHint ?? this.slugSegment ?? "";
      }
      set displayName(name) {
        this.displayNameOverride = name;
      }
      get slug() {
        const path12 = joinSegments(...this.slugSegments);
        if (this.isFolder) {
          return joinSegments(path12, "index");
        }
        return path12;
      }
      get slugSegment() {
        return this.slugSegments[this.slugSegments.length - 1];
      }
      makeChild(path12, file) {
        const fullPath = [...this.slugSegments, path12[0]];
        const child = new _FileTrieNode(fullPath, file);
        this.children.push(child);
        return child;
      }
      insert(path12, file) {
        if (path12.length === 0) {
          throw new Error("path is empty");
        }
        this.isFolder = true;
        const segment = path12[0];
        if (path12.length === 1) {
          if (segment === "index") {
            this.data = file;
          } else {
            this.makeChild(path12, file);
          }
        } else if (path12.length > 1) {
          const child = this.children.find((c) => c.slugSegment === segment) ?? this.makeChild(path12, void 0);
          const fileParts = file.filePath.split("/");
          child.fileSegmentHint = fileParts.at(-path12.length);
          child.insert(path12.slice(1), file);
        }
      }
      // Add new file to trie
      /**
       * Add a page at `position` (its slug by default). The build passes the page's slugified file
       * path, so a note with a permalink stays in its folder for navigation (explorer, folder pages,
       * breadcrumbs) while `data.slug` — what links point at — is its permalink.
       */
      add(file, position = file.slug) {
        this.insert(position.split("/"), file);
      }
      findNode(path12) {
        if (path12.length === 0 || path12.length === 1 && path12[0] === "index") {
          return this;
        }
        return this.children.find((c) => c.slugSegment === path12[0])?.findNode(path12.slice(1));
      }
      ancestryChain(path12) {
        if (path12.length === 0 || path12.length === 1 && path12[0] === "index") {
          return [this];
        }
        const child = this.children.find((c) => c.slugSegment === path12[0]);
        if (!child) {
          return void 0;
        }
        const childPath = child.ancestryChain(path12.slice(1));
        if (!childPath) {
          return void 0;
        }
        return [this, ...childPath];
      }
      /**
       * Filter trie nodes. Behaves similar to `Array.prototype.filter()`, but modifies tree in place
       */
      filter(filterFn) {
        this.children = this.children.filter(filterFn);
        this.children.forEach((child) => child.filter(filterFn));
      }
      /**
       * Map over trie nodes. Behaves similar to `Array.prototype.map()`, but modifies tree in place
       */
      map(mapFn) {
        mapFn(this);
        this.children.forEach((child) => child.map(mapFn));
      }
      /**
       * Sort trie nodes according to sort/compare function
       */
      sort(sortFn) {
        this.children = this.children.sort(sortFn);
        this.children.forEach((e) => e.sort(sortFn));
      }
      static fromEntries(entries) {
        const trie = new _FileTrieNode([]);
        entries.forEach(([, entry]) => trie.add(entry));
        return trie;
      }
      /**
       * Get all entries in the trie
       * in the a flat array including the full path and the node
       */
      entries() {
        const traverse = /* @__PURE__ */ __name((node) => {
          const result = [[node.slug, node]];
          return result.concat(...node.children.map(traverse));
        }, "traverse");
        return traverse(this);
      }
      /**
       * Get all folder paths in the trie
       * @returns array containing folder state for trie
       */
      getFolderPaths() {
        return this.entries().filter(([_, node]) => node.isFolder).map(([path12, _]) => path12);
      }
    };
  }
});

// quartz/util/ctx.ts
function trieFromAllFiles(allFiles) {
  const trie = new FileTrieNode([]);
  allFiles.forEach((file) => {
    if (file.frontmatter) {
      trie.add(
        {
          ...file,
          slug: file.slug,
          title: file.frontmatter.title,
          filePath: file.filePath
        },
        // placed by file path (permalinked notes stay in their folder), linked by slug
        file.relativePath ? slugifyFilePath(file.relativePath) : file.slug
      );
    }
  });
  return trie;
}
var init_ctx = __esm({
  "quartz/util/ctx.ts"() {
    "use strict";
    init_fileTrie();
    init_path();
    __name(trieFromAllFiles, "trieFromAllFiles");
  }
});

// quartz/util/jsx.tsx
import { toJsxRuntime } from "hast-util-to-jsx-runtime";
import { Fragment as Fragment5, jsx as jsx15, jsxs as jsxs7 } from "preact/jsx-runtime";
import { h } from "preact";
import { jsx as jsx16 } from "preact/jsx-runtime";
function childrenToString(children) {
  if (typeof children === "string") return children;
  if (Array.isArray(children)) return children.map(childrenToString).join("");
  return String(children ?? "");
}
function htmlToJsx(fp, tree) {
  try {
    return toJsxRuntime(tree, {
      Fragment: Fragment5,
      jsx: jsx15,
      jsxs: jsxs7,
      elementAttributeNameCase: "html",
      components: customComponents
    });
  } catch (e) {
    trace(`Failed to parse Markdown in \`${fp}\` into JSX`, e);
  }
}
var customComponents;
var init_jsx = __esm({
  "quartz/util/jsx.tsx"() {
    "use strict";
    init_trace();
    __name(childrenToString, "childrenToString");
    customComponents = {
      table: /* @__PURE__ */ __name((props) => /* @__PURE__ */ jsx16("div", { class: "table-container", children: /* @__PURE__ */ jsx16("table", { ...props }) }), "table"),
      style: /* @__PURE__ */ __name(({ children, ...rest }) => h("style", { ...rest, dangerouslySetInnerHTML: { __html: childrenToString(children) } }), "style"),
      script: /* @__PURE__ */ __name(({ children, ...rest }) => h("script", { ...rest, dangerouslySetInnerHTML: { __html: childrenToString(children) } }), "script")
    };
    __name(htmlToJsx, "htmlToJsx");
  }
});

// quartz/util/perf.ts
import pretty from "pretty-time";
import { styleText as styleText9 } from "util";
var PerfTimer;
var init_perf = __esm({
  "quartz/util/perf.ts"() {
    "use strict";
    PerfTimer = class {
      static {
        __name(this, "PerfTimer");
      }
      evts;
      constructor() {
        this.evts = {};
        this.addEvent("start");
      }
      addEvent(evtName) {
        this.evts[evtName] = process.hrtime();
      }
      timeSince(evtName) {
        return styleText9("yellow", pretty(process.hrtime(this.evts[evtName ?? "start"])));
      }
    };
  }
});

// quartz/processors/filter.ts
function publishes(ctx, plugin, item) {
  try {
    return plugin.shouldPublish(ctx, item);
  } catch (err) {
    const file = item[1].data.relativePath ?? item[1].data.slug;
    trace(
      `Failed to filter \`${file}\``,
      attributeError(err, { origin: originOf(plugin), stage: "filter", file })
    );
    return false;
  }
}
function rejectingFilter(ctx, item) {
  for (const plugin of ctx.cfg.plugins?.filters ?? []) {
    if (publishes(ctx, plugin, item)) continue;
    const slug = item[1].data.slug;
    if (slug) recordFiltered(slug, plugin.name);
    if (ctx.argv?.verbose) console.log(`[filter:${plugin.name}] ${slug}`);
    return plugin.name;
  }
  return void 0;
}
var init_filter = __esm({
  "quartz/processors/filter.ts"() {
    "use strict";
    init_perf();
    init_pluginErrors();
    init_diagnostics();
    init_trace();
    __name(publishes, "publishes");
    __name(rejectingFilter, "rejectingFilter");
  }
});

// quartz/plugins/pageTypes/dispatcher.ts
import { render as render2 } from "preact-render-to-string";
import { fromHtml } from "hast-util-from-html";
import { toHtml as toHtml2 } from "hast-util-to-html";
import { unified } from "unified";
import fs8 from "fs";
import path9 from "path";
function getPageTypes(ctx) {
  return ctx.cfg.plugins.pageTypes ?? [];
}
function resolveLayout(pageType, sharedDefaults, byPageType) {
  const overrides = byPageType[pageType.layout] ?? {};
  const frame = overrides.frame ?? pageType.frame ?? "default";
  return {
    head: overrides.head ?? sharedDefaults.head,
    header: overrides.header ?? sharedDefaults.header ?? [],
    beforeBody: overrides.beforeBody ?? sharedDefaults.beforeBody ?? [],
    pageBody: pageType.body(void 0),
    afterBody: overrides.afterBody ?? sharedDefaults.afterBody ?? [],
    left: overrides.left ?? sharedDefaults.left ?? [],
    right: overrides.right ?? sharedDefaults.right ?? [],
    footer: overrides.footer ?? sharedDefaults.footer ?? [],
    frame,
    // layout.sidebars, with a page type's override merged per side
    sidebars: { ...sharedDefaults.sidebars, ...overrides.sidebars }
  };
}
function collectComponents(pageTypes, sharedDefaults, byPageType) {
  const seen = /* @__PURE__ */ new Set();
  for (const pt of pageTypes) {
    const layout2 = resolveLayout(pt, sharedDefaults, byPageType);
    const all = [
      layout2.head,
      ...layout2.header,
      ...layout2.beforeBody,
      layout2.pageBody,
      ...layout2.afterBody,
      ...layout2.left,
      ...layout2.right,
      ...layout2.footer
    ];
    for (const c of all) {
      if (c) seen.add(c);
    }
  }
  return [...seen];
}
async function emitPage(ctx, slug, tree, fileData, allFiles, layout2, resources, treeTransforms) {
  const cfg = ctx.cfg.configuration;
  const baseDir = slug === "404" ? ctx.argv.serve ? "/" : new URL(`https://${cfg.baseUrl ?? "example.com"}`).pathname : pathToRoot(slug);
  const externalResources = pageResources(baseDir, resources, ctx);
  const componentData = {
    ctx,
    fileData,
    externalResources,
    cfg,
    children: [],
    tree,
    allFiles
  };
  return write2({
    ctx,
    content: renderPage(cfg, slug, componentData, layout2, externalResources, treeTransforms),
    slug,
    ext: ".html"
  });
}
function pageOutputPath(outputDir, sourcePath, fileSlug) {
  const slug = fileSlug ?? slugifyFilePath(sourcePath);
  return joinSegments(outputDir, `${slug}.html`);
}
async function removeStalePageOutput(outputDir, sourcePath, currentSlugs, fileSlug) {
  const slug = fileSlug ?? slugifyFilePath(sourcePath);
  if (currentSlugs.has(slug)) return;
  const outputPath = pageOutputPath(outputDir, sourcePath, slug);
  await fs8.promises.rm(outputPath, { force: true });
  return outputPath;
}
async function generateVirtualPages(pageTypes, content, ctx, defaults, byPageType) {
  const cfg = ctx.cfg.configuration;
  const virtualEntries = [];
  let references;
  for (const pt of pageTypes) {
    if (!pt.generate) continue;
    const virtualPages = await pt.generate({ content, cfg, ctx });
    const layout2 = resolveLayout(pt, defaults, byPageType);
    const fileBacked = (pt.fileExtensions?.length ?? 0) > 0;
    for (const vp of virtualPages) {
      const vpSlug = vp.slug;
      const vpRelativePath = vpSlug + ".md";
      const [tree, vfile] = defaultProcessedContent({
        slug: vpSlug,
        relativePath: vpRelativePath,
        frontmatter: { title: vp.title, tags: [] },
        ...vp.data
      });
      if (fileBacked) {
        references ??= referencesByTarget(content);
        vfile.data.referencedBy = references.get(simplifySlug(vpSlug)) ?? [];
        if (rejectingFilter(ctx, [tree, vfile]) !== void 0) continue;
      }
      if (vpSlug !== "404") {
        ctx.virtualPages.push([tree, vfile]);
      }
      virtualEntries.push({ tree, vfile, layout: layout2, vpSlug, fileBacked });
    }
  }
  return virtualEntries;
}
function referencesByTarget(content) {
  const references = /* @__PURE__ */ new Map();
  for (const [, file] of content) {
    const slug = file.data.slug;
    if (!slug) continue;
    for (const target of new Set(file.data.links ?? [])) {
      const from = references.get(target);
      if (from) from.push(slug);
      else references.set(target, [slug]);
    }
  }
  return references;
}
function folderTrie(allFiles, virtualEntries) {
  const fileBacked = virtualEntries.filter((ve) => ve.fileBacked).map((ve) => ({
    ...ve.vfile.data,
    filePath: ve.vfile.data.filePath ?? ve.vfile.data.relativePath
  }));
  return trieFromAllFiles([...allFiles, ...fileBacked]);
}
function processVirtualPageHtml(ve, ctx, content) {
  if (!ve.fileBacked) return true;
  const transformers = (ctx.cfg.plugins?.transformers ?? []).filter((t) => t.virtualPageHtmlPlugins);
  if (transformers.length === 0) return true;
  const htmlAst = ve.vfile.data.htmlAst;
  if (!htmlAst) return false;
  const before = toHtml2(htmlAst, { allowDangerousHtml: true });
  for (const transformer of transformers) {
    try {
      const processor = unified().use(transformer.virtualPageHtmlPlugins(ctx, content));
      ve.vfile.data.htmlAst = processor.runSync(ve.vfile.data.htmlAst, ve.vfile);
    } catch (err) {
      const file = ve.vfile.data.relativePath ?? ve.vpSlug;
      trace(
        `Failed to process the HTML of \`${file}\``,
        attributeError(err, { origin: originOf(transformer), stage: "html", file })
      );
      return false;
    }
  }
  const processed = ve.vfile.data.htmlAst;
  if (toHtml2(processed, { allowDangerousHtml: true }) !== before) {
    ve.tree = processed;
    ve.layout = { ...ve.layout, pageBody: RenderedBody };
    const item = ctx.virtualPages.find(([, vfile]) => vfile === ve.vfile);
    if (item) item[0] = processed;
  }
  return true;
}
function populateVirtualPageHtmlAst(virtualEntries, ctx, allFiles, resources, content) {
  const cfg = ctx.cfg.configuration;
  const failed = /* @__PURE__ */ new Set();
  for (const ve of virtualEntries) {
    const BodyComponent = ve.layout.pageBody;
    const externalResources = pageResources(pathToRoot(ve.vpSlug), resources, ctx);
    const componentData = {
      ctx,
      fileData: ve.vfile.data,
      externalResources,
      cfg,
      children: [],
      tree: ve.tree,
      allFiles
    };
    try {
      const htmlString = render2(BodyComponent(componentData));
      const htmlAst = fromHtml(htmlString, { fragment: true });
      ve.vfile.data.htmlAst = htmlAst;
    } catch {
    }
    if (!processVirtualPageHtml(ve, ctx, content)) {
      failed.add(ve);
      ve.vfile.data.htmlAst = void 0;
    }
  }
  if (failed.size === 0) return virtualEntries;
  const failedData = new Set([...failed].map((ve) => ve.vfile.data));
  ctx.virtualPages = ctx.virtualPages.filter(([, vfile]) => !failedData.has(vfile.data));
  return virtualEntries.filter((ve) => !failed.has(ve));
}
var RenderedBody, PageTypeDispatcher;
var init_dispatcher = __esm({
  "quartz/plugins/pageTypes/dispatcher.ts"() {
    "use strict";
    init_renderPage();
    init_path();
    init_vfile();
    init_helpers();
    init_ctx();
    init_jsx();
    init_trace();
    init_pluginErrors();
    init_filter();
    __name(getPageTypes, "getPageTypes");
    __name(resolveLayout, "resolveLayout");
    __name(collectComponents, "collectComponents");
    __name(emitPage, "emitPage");
    __name(pageOutputPath, "pageOutputPath");
    __name(removeStalePageOutput, "removeStalePageOutput");
    __name(generateVirtualPages, "generateVirtualPages");
    __name(referencesByTarget, "referencesByTarget");
    __name(folderTrie, "folderTrie");
    RenderedBody = /* @__PURE__ */ __name(({ fileData, tree }) => htmlToJsx(fileData.filePath ?? fileData.relativePath ?? fileData.slug, tree), "RenderedBody");
    __name(processVirtualPageHtml, "processVirtualPageHtml");
    __name(populateVirtualPageHtmlAst, "populateVirtualPageHtmlAst");
    PageTypeDispatcher = /* @__PURE__ */ __name((userOpts) => {
      const defaults = userOpts?.defaults ?? {};
      const byPageType = userOpts?.byPageType ?? {};
      return {
        name: "PageTypeDispatcher",
        getQuartzComponents(ctx) {
          const pageTypes = getPageTypes(ctx);
          return collectComponents(pageTypes, defaults, byPageType);
        },
        async *emit(ctx, content, resources) {
          const pageTypes = [...getPageTypes(ctx)].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
          const cfg = ctx.cfg.configuration;
          const allFiles = content.map((c) => c[1].data);
          const treeTransforms = pageTypes.flatMap(
            (pt) => pt.treeTransforms?.(ctx) ?? []
          );
          ctx.trie ??= trieFromAllFiles(allFiles);
          const virtualEntries = await generateVirtualPages(
            pageTypes,
            content,
            ctx,
            defaults,
            byPageType
          );
          if (virtualEntries.some((ve) => ve.fileBacked)) {
            ctx.trie = folderTrie(allFiles, virtualEntries);
          }
          const allFilesWithVirtual = [...allFiles, ...virtualEntries.map((ve) => ve.vfile.data)];
          const entriesToEmit = populateVirtualPageHtmlAst(
            virtualEntries,
            ctx,
            allFilesWithVirtual,
            resources,
            content
          );
          for (const [tree, file] of content) {
            const slug = file.data.slug;
            const fileData = file.data;
            for (const pt of pageTypes) {
              if (pt.match({ slug, fileData, cfg })) {
                const layout2 = resolveLayout(pt, defaults, byPageType);
                yield emitPage(
                  ctx,
                  slug,
                  tree,
                  fileData,
                  allFilesWithVirtual,
                  layout2,
                  resources,
                  treeTransforms
                );
                break;
              }
            }
          }
          for (const ve of entriesToEmit) {
            yield emitPage(
              ctx,
              ve.vpSlug,
              ve.tree,
              ve.vfile.data,
              allFilesWithVirtual,
              ve.layout,
              resources,
              treeTransforms
            );
          }
        },
        async *partialEmit(ctx, content, resources, changeEvents) {
          const pageTypes = [...getPageTypes(ctx)].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
          const cfg = ctx.cfg.configuration;
          const allFiles = content.map((c) => c[1].data);
          const treeTransforms = pageTypes.flatMap(
            (pt) => pt.treeTransforms?.(ctx) ?? []
          );
          ctx.trie = trieFromAllFiles(allFiles);
          const currentSlugs = new Set(
            allFiles.flatMap((file) => file.slug ? [file.slug] : [])
          );
          const changedSlugs = /* @__PURE__ */ new Set();
          for (const changeEvent of changeEvents) {
            if (path9.extname(changeEvent.path).toLowerCase() !== ".md") continue;
            const slug = changeEvent.file?.data.slug ?? slugifyFilePath(changeEvent.path);
            if (currentSlugs.has(slug)) {
              changedSlugs.add(slug);
            } else {
              await removeStalePageOutput(ctx.argv.output, changeEvent.path, currentSlugs, slug);
            }
          }
          const virtualEntries = await generateVirtualPages(
            pageTypes,
            content,
            ctx,
            defaults,
            byPageType
          );
          ctx.trie = folderTrie(allFiles, virtualEntries);
          const allFilesWithVirtual = [...allFiles, ...virtualEntries.map((ve) => ve.vfile.data)];
          const entriesToEmit = populateVirtualPageHtmlAst(
            virtualEntries,
            ctx,
            allFilesWithVirtual,
            resources,
            content
          );
          for (const [tree, file] of content) {
            const slug = file.data.slug;
            if (!changedSlugs.has(slug)) continue;
            const fileData = file.data;
            for (const pt of pageTypes) {
              if (pt.match({ slug, fileData, cfg })) {
                const layout2 = resolveLayout(pt, defaults, byPageType);
                yield emitPage(
                  ctx,
                  slug,
                  tree,
                  fileData,
                  allFilesWithVirtual,
                  layout2,
                  resources,
                  treeTransforms
                );
                break;
              }
            }
          }
          for (const ve of entriesToEmit) {
            yield emitPage(
              ctx,
              ve.vpSlug,
              ve.tree,
              ve.vfile.data,
              allFilesWithVirtual,
              ve.layout,
              resources,
              treeTransforms
            );
          }
        }
      };
    }, "PageTypeDispatcher");
  }
});

// quartz/plugins/pageTypes/index.ts
var pageTypes_exports = {};
__export(pageTypes_exports, {
  NotFoundPageType: () => NotFoundPageType,
  PageTypeDispatcher: () => PageTypeDispatcher,
  match: () => match
});
var init_pageTypes = __esm({
  "quartz/plugins/pageTypes/index.ts"() {
    "use strict";
    init_matchers();
    init__2();
    init_dispatcher();
  }
});

// quartz/plugins/loader/index.ts
var loader_exports = {};
__export(loader_exports, {
  MINIMUM_QUARTZ_VERSION: () => MINIMUM_QUARTZ_VERSION,
  instantiatePlugin: () => instantiatePlugin,
  resolvePlugins: () => resolvePlugins,
  satisfiesVersion: () => satisfiesVersion
});
import { styleText as styleText10 } from "util";
function satisfiesVersion(required, current) {
  const result = checkQuartzRequirement(required, current);
  return result.status !== "incompatible";
}
async function tryImportPlugin(packageName) {
  try {
    const module = await import(packageName);
    const manifest = module.manifest ?? null;
    return { module, manifest };
  } catch (error) {
    throw new Error(
      `Failed to import package: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}
function detectPluginType(module) {
  if (!module || typeof module !== "object") return null;
  const mod = module;
  if (typeof mod.default === "function") {
    return null;
  }
  const hasPageTypeProps = ["match", "body", "layout"].every((key) => key in mod);
  const hasTransformerProps = ["textTransform", "markdownPlugins", "htmlPlugins"].some(
    (key) => key in mod && (typeof mod[key] === "function" || mod[key] === void 0)
  );
  const hasFilterProps = ["shouldPublish"].some(
    (key) => key in mod && typeof mod[key] === "function"
  );
  const hasEmitterProps = ["emit"].some((key) => key in mod && typeof mod[key] === "function");
  if (hasPageTypeProps) return "pageType";
  if (hasEmitterProps) return "emitter";
  if (hasFilterProps) return "filter";
  if (hasTransformerProps) return "transformer";
  return null;
}
function extractPluginFactory(module, type) {
  if (!module || typeof module !== "object") return null;
  const mod = module;
  const factory = mod.default ?? mod[type] ?? mod.plugin ?? null;
  if (typeof factory === "function") {
    return factory;
  }
  return null;
}
function isGitSource(source) {
  return isLocalSource(source) || source.startsWith("github:") || source.startsWith("git+") || source.startsWith("https://github.com/") || source.startsWith("https://gitlab.com/") || source.startsWith("https://bitbucket.org/");
}
async function resolveSinglePlugin(specifier, options3) {
  let packageName;
  let manifest = {};
  let pluginSource = "npm";
  if (typeof specifier === "string") {
    packageName = specifier;
    if (isGitSource(specifier)) {
      pluginSource = "git";
    }
  } else if ("name" in specifier) {
    packageName = specifier.name;
    if (isGitSource(specifier.name)) {
      pluginSource = "git";
    }
  } else if ("plugin" in specifier) {
    const rawType = specifier.manifest?.category ?? "transformer";
    const type = Array.isArray(rawType) ? rawType[0] : rawType;
    return {
      plugin: {
        plugin: specifier.plugin,
        manifest: {
          name: specifier.manifest?.name ?? "inline-plugin",
          displayName: specifier.manifest?.displayName ?? "Inline Plugin",
          description: specifier.manifest?.description ?? "Inline plugin instance",
          version: specifier.manifest?.version ?? "1.0.0",
          category: rawType,
          ...specifier.manifest
        },
        type,
        source: "inline"
      },
      error: null
    };
  } else {
    return {
      plugin: null,
      error: {
        plugin: "unknown",
        message: "Invalid plugin specifier format",
        type: "invalid-manifest"
      }
    };
  }
  if (pluginSource === "git") {
    try {
      const gitSpec = parsePluginSource(packageName);
      await installPlugin(gitSpec, { verbose: options3.verbose });
      const entryPoint = getPluginEntryPoint(gitSpec.name);
      const module = await import(toFileUrl(entryPoint));
      const importedManifest = module.manifest ?? null;
      validatePluginExternals(gitSpec.name, entryPoint, { verbose: options3.verbose });
      manifest = importedManifest ?? {};
      const categoryOrCategories = manifest.category ?? detectPluginType(module);
      if (!categoryOrCategories) {
        return {
          plugin: null,
          error: {
            plugin: packageName,
            message: "Could not detect plugin type from Git source",
            type: "invalid-manifest"
          }
        };
      }
      const processingCategories = ["transformer", "filter", "emitter", "pageType"];
      const detectedType = Array.isArray(categoryOrCategories) ? categoryOrCategories[0] : categoryOrCategories;
      const processingType = Array.isArray(categoryOrCategories) ? categoryOrCategories.find(
        (c) => processingCategories.includes(c)
      ) : processingCategories.includes(categoryOrCategories) ? categoryOrCategories : void 0;
      if (!processingType) {
        const fullManifest2 = {
          name: manifest.name ?? gitSpec.name,
          displayName: manifest.displayName ?? gitSpec.name,
          description: manifest.description ?? "No description provided",
          version: manifest.version ?? "1.0.0",
          author: manifest.author,
          homepage: manifest.homepage,
          keywords: manifest.keywords,
          category: manifest.category ?? detectedType,
          quartzVersion: manifest.quartzVersion,
          configSchema: manifest.configSchema
        };
        if (options3.verbose) {
          console.log(
            styleText10("green", `\u2713`) + ` Loaded ${detectedType} plugin: ${styleText10("cyan", fullManifest2.displayName)}@${fullManifest2.version} ${styleText10("gray", `(from ${gitSpec.repo})`)}`
          );
        }
        return { plugin: null, error: null };
      }
      const factory = extractPluginFactory(module, processingType);
      if (!factory) {
        return {
          plugin: null,
          error: {
            plugin: packageName,
            message: "Could not find plugin factory in Git source",
            type: "invalid-manifest"
          }
        };
      }
      const fullManifest = {
        name: manifest.name ?? gitSpec.name,
        displayName: manifest.displayName ?? gitSpec.name,
        description: manifest.description ?? "No description provided",
        version: manifest.version ?? "1.0.0",
        author: manifest.author,
        homepage: manifest.homepage,
        keywords: manifest.keywords,
        category: manifest.category ?? detectedType,
        quartzVersion: manifest.quartzVersion,
        configSchema: manifest.configSchema
      };
      const loadedPlugin = {
        plugin: factory,
        manifest: fullManifest,
        type: detectedType,
        source: gitSpec.local ? `local:${gitSpec.repo}` : `${gitSpec.repo}#${gitSpec.ref}`
      };
      if (options3.verbose) {
        console.log(
          styleText10("green", `\u2713`) + ` Loaded ${detectedType} plugin: ${styleText10("cyan", fullManifest.displayName)}@${fullManifest.version} ${styleText10("gray", `(from ${gitSpec.repo})`)}`
        );
      }
      return { plugin: loadedPlugin, error: null };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        plugin: null,
        error: {
          plugin: packageName,
          message: `Failed to load Git plugin: ${errorMessage}`,
          type: "import-error"
        }
      };
    }
  }
  try {
    const { module: importedModule, manifest: importedManifest } = await tryImportPlugin(packageName);
    manifest = importedManifest ?? {};
    if (manifest.components && Object.keys(manifest.components).length > 0) {
      const { loadComponentsFromPackage: loadComponentsFromPackage2 } = await Promise.resolve().then(() => (init_componentLoader(), componentLoader_exports));
      await loadComponentsFromPackage2(packageName, manifest);
    }
    const categoryOrCategories = manifest.category ?? detectPluginType(importedModule);
    if (!categoryOrCategories) {
      return {
        plugin: null,
        error: {
          plugin: packageName,
          message: `Could not detect plugin type. Ensure the plugin exports a valid factory function or has a 'category' field in its manifest.`,
          type: "invalid-manifest"
        }
      };
    }
    const processingCategories = ["transformer", "filter", "emitter", "pageType"];
    const detectedType = Array.isArray(categoryOrCategories) ? categoryOrCategories[0] : categoryOrCategories;
    const processingType = Array.isArray(categoryOrCategories) ? categoryOrCategories.find(
      (c) => processingCategories.includes(c)
    ) : processingCategories.includes(categoryOrCategories) ? categoryOrCategories : void 0;
    if (manifest.quartzVersion && !satisfiesVersion(manifest.quartzVersion, options3.quartzVersion)) {
      return {
        plugin: null,
        error: {
          plugin: packageName,
          message: `Plugin requires Quartz ${manifest.quartzVersion} but current version is ${options3.quartzVersion}`,
          type: "version-mismatch"
        }
      };
    }
    if (!processingType) {
      const fullManifest2 = {
        name: manifest.name ?? packageName,
        displayName: manifest.displayName ?? packageName,
        description: manifest.description ?? "No description provided",
        version: manifest.version ?? "1.0.0",
        author: manifest.author,
        homepage: manifest.homepage,
        keywords: manifest.keywords,
        category: manifest.category ?? detectedType,
        quartzVersion: manifest.quartzVersion,
        configSchema: manifest.configSchema
      };
      if (options3.verbose) {
        console.log(
          styleText10("green", `\u2713`) + ` Loaded ${detectedType} plugin: ${styleText10("cyan", fullManifest2.displayName)}@${fullManifest2.version}`
        );
      }
      return { plugin: null, error: null };
    }
    const factory = extractPluginFactory(importedModule, processingType);
    if (!factory) {
      return {
        plugin: null,
        error: {
          plugin: packageName,
          message: `Could not find plugin factory in module. Expected 'export default' or '${processingType}' export.`,
          type: "invalid-manifest"
        }
      };
    }
    const fullManifest = {
      name: manifest.name ?? packageName,
      displayName: manifest.displayName ?? packageName,
      description: manifest.description ?? "No description provided",
      version: manifest.version ?? "1.0.0",
      author: manifest.author,
      homepage: manifest.homepage,
      keywords: manifest.keywords,
      category: manifest.category ?? detectedType,
      quartzVersion: manifest.quartzVersion,
      configSchema: manifest.configSchema
    };
    const loadedPlugin = {
      plugin: factory,
      manifest: fullManifest,
      type: detectedType,
      source: packageName
    };
    if (options3.verbose) {
      console.log(
        styleText10("green", `\u2713`) + ` Loaded ${detectedType} plugin: ${styleText10("cyan", fullManifest.displayName)}@${fullManifest.version}`
      );
    }
    return { plugin: loadedPlugin, error: null };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (errorMessage.includes("Cannot find module") || errorMessage.includes("MODULE_NOT_FOUND")) {
      return {
        plugin: null,
        error: {
          plugin: packageName,
          message: `Plugin package not found. Run 'npm install ${packageName}' to install it.`,
          type: "not-found"
        }
      };
    }
    return {
      plugin: null,
      error: {
        plugin: packageName,
        message: errorMessage,
        type: "import-error"
      }
    };
  }
}
async function resolvePlugins(specifiers, options3) {
  const plugins = [];
  const errors = [];
  if (options3.verbose) {
    console.log(styleText10("cyan", `Resolving ${specifiers.length} external plugin(s)...`));
  }
  for (const specifier of specifiers) {
    const { plugin, error } = await resolveSinglePlugin(specifier, options3);
    if (plugin) {
      plugins.push(plugin);
    } else if (error) {
      errors.push(error);
      console.error(
        styleText10("red", `\u2717`) + ` Failed to load plugin: ${styleText10("yellow", error.plugin)}
  ${error.message}`
      );
    }
  }
  if (options3.verbose && plugins.length > 0) {
    const byType = plugins.reduce(
      (acc, p) => {
        acc[p.type] = (acc[p.type] || 0) + 1;
        return acc;
      },
      {}
    );
    console.log(
      styleText10("cyan", `External plugins loaded:`) + ` ${byType.transformer ?? 0} transformers, ${byType.filter ?? 0} filters, ${byType.emitter ?? 0} emitters, ${byType.pageType ?? 0} pageTypes`
    );
  }
  return { plugins, errors };
}
function instantiatePlugin(loadedPlugin, options3) {
  const factory = loadedPlugin.plugin;
  return factory(options3);
}
var MINIMUM_QUARTZ_VERSION;
var init_loader = __esm({
  "quartz/plugins/loader/index.ts"() {
    "use strict";
    init_compat();
    init_gitLoader();
    MINIMUM_QUARTZ_VERSION = "4.5.0";
    __name(satisfiesVersion, "satisfiesVersion");
    __name(tryImportPlugin, "tryImportPlugin");
    __name(detectPluginType, "detectPluginType");
    __name(extractPluginFactory, "extractPluginFactory");
    __name(isGitSource, "isGitSource");
    __name(resolveSinglePlugin, "resolveSinglePlugin");
    __name(resolvePlugins, "resolvePlugins");
    __name(instantiatePlugin, "instantiatePlugin");
  }
});

// quartz/plugins/index.ts
var plugins_exports = {};
__export(plugins_exports, {
  Assets: () => Assets,
  ComponentResources: () => ComponentResources,
  PageTypes: () => pageTypes_exports,
  PluginLoader: () => loader_exports,
  Static: () => Static,
  getPluginInstance: () => getPluginInstance,
  getStaticResourcesFromPlugins: () => getStaticResourcesFromPlugins,
  isLoadedPlugin: () => isLoadedPlugin
});
function getStaticResourcesFromPlugins(ctx) {
  const staticResources = {
    css: [],
    js: [],
    additionalHead: []
  };
  for (const transformer of [...ctx.cfg.plugins.transformers, ...ctx.cfg.plugins.emitters]) {
    const res = transformer.externalResources ? transformer.externalResources(ctx) : {};
    if (res?.js) {
      staticResources.js.push(...res.js);
    }
    if (res?.css) {
      staticResources.css.push(...res.css);
    }
    if (res?.additionalHead) {
      staticResources.additionalHead.push(...res.additionalHead);
    }
    if (res?.assets) {
      ;
      (staticResources.assets ??= []).push(...res.assets);
    }
  }
  if (ctx.argv.serve) {
    const wsHost = ctx.argv.remoteDevHost || "localhost";
    staticResources.js.push({
      loadTime: "afterDOMReady",
      contentType: "inline",
      script: `
        // the dev server speaks plain ws unless it sits behind a TLS proxy,
        // so follow the page instead of assuming
        const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:"
        const socket = new WebSocket(\`\${wsProtocol}//${wsHost}:${ctx.argv.wsPort}\`)
        // reload(true) ensures resources like images and scripts are fetched again in firefox
        socket.addEventListener('message', () => document.location.reload(true))
      `
    });
  }
  return staticResources;
}
var init_plugins = __esm({
  "quartz/plugins/index.ts"() {
    "use strict";
    init_transformers();
    init_filters();
    init_emitters();
    init_types();
    init_config();
    init_pageTypes();
    init_loader();
    __name(getStaticResourcesFromPlugins, "getStaticResourcesFromPlugins");
  }
});

// quartz/plugins/loader/config-loader.ts
import fs9 from "fs";
import path10 from "path";
import YAML from "yaml";
import { styleText as styleText11 } from "util";
import { fileURLToPath } from "node:url";
function resolveConfigPath() {
  if (fs9.existsSync(CONFIG_YAML_PATH)) return CONFIG_YAML_PATH;
  if (fs9.existsSync(LEGACY_PLUGINS_JSON_PATH)) return LEGACY_PLUGINS_JSON_PATH;
  if (fs9.existsSync(DEFAULT_CONFIG_YAML_PATH)) return DEFAULT_CONFIG_YAML_PATH;
  if (fs9.existsSync(LEGACY_DEFAULT_PLUGINS_JSON_PATH)) return LEGACY_DEFAULT_PLUGINS_JSON_PATH;
  return CONFIG_YAML_PATH;
}
function readPluginsJson() {
  const configPath = resolveConfigPath();
  if (!fs9.existsSync(configPath)) {
    return null;
  }
  const raw = fs9.readFileSync(configPath, "utf-8");
  if (configPath.endsWith(".yaml") || configPath.endsWith(".yml")) {
    return YAML.parse(raw);
  }
  return JSON.parse(raw);
}
function extractPluginName(source) {
  if (typeof source === "object" && source !== null) {
    if (source.name) return source.name;
    return extractPluginName(source.repo);
  }
  if (isLocalSource(source)) {
    return path10.basename(source.replace(/[\/]+$/, ""));
  }
  if (source.startsWith("github:")) {
    const withoutPrefix = source.replace("github:", "");
    const [repoPath] = withoutPrefix.split("#");
    const parts = repoPath.split("/");
    return parts[parts.length - 1];
  }
  if (source.startsWith("git+") || source.startsWith("https://")) {
    const url2 = source.replace("git+", "");
    const match2 = url2.match(/\/([^/]+?)(?:\.git)?(?:#|$)/);
    return match2?.[1] ?? source;
  }
  return source;
}
function formatSourceDisplay(source) {
  if (typeof source === "string") return source;
  const parts = [source.repo];
  if (source.subdir) parts.push(`(subdir: ${source.subdir})`);
  if (source.ref) parts.push(`(ref: ${source.ref})`);
  return parts.join(" ");
}
function sourceKey(source) {
  if (typeof source === "string") return source;
  return JSON.stringify(source);
}
function validateDependencies(entries, manifests) {
  const errors = [];
  const warnings = [];
  const sourceToEntry = /* @__PURE__ */ new Map();
  const nameToSource = /* @__PURE__ */ new Map();
  for (const entry of entries) {
    sourceToEntry.set(sourceKey(entry.source), entry);
    nameToSource.set(extractPluginName(entry.source), sourceKey(entry.source));
  }
  for (const entry of entries) {
    if (!entry.enabled) continue;
    const manifest = manifests.get(sourceKey(entry.source));
    if (!manifest?.dependencies?.length) continue;
    const pluginName = manifest.displayName || extractPluginName(entry.source);
    const pluginOrder = entry.order ?? manifest.defaultOrder ?? 50;
    for (const dep of manifest.dependencies) {
      const depEntry = sourceToEntry.get(dep);
      const depName = extractPluginName(dep);
      if (!depEntry) {
        errors.push(
          `Plugin "${pluginName}" requires "${depName}". Run: npx quartz plugin add ${dep}`
        );
        continue;
      }
      if (!depEntry.enabled) {
        warnings.push(
          `Plugin "${pluginName}" depends on "${depName}" which is disabled. "${pluginName}" may not function correctly.`
        );
      }
      const depManifest = manifests.get(dep);
      const depOrder = depEntry.order ?? depManifest?.defaultOrder ?? 50;
      if (pluginOrder < depOrder) {
        errors.push(
          `Plugin "${pluginName}" (order: ${pluginOrder}) depends on "${depName}" (order: ${depOrder}), but "${pluginName}" is configured to run first. Either increase "${pluginName}"'s order above ${depOrder} or decrease "${depName}"'s order below ${pluginOrder}.`
        );
      }
    }
  }
  const graph = /* @__PURE__ */ new Map();
  for (const entry of entries) {
    const manifest = manifests.get(sourceKey(entry.source));
    if (manifest?.dependencies?.length) {
      graph.set(sourceKey(entry.source), manifest.dependencies);
    }
  }
  const visited = /* @__PURE__ */ new Set();
  const inStack = /* @__PURE__ */ new Set();
  function detectCycle(node, pathSoFar) {
    if (inStack.has(node)) {
      const cycleStart = pathSoFar.indexOf(node);
      return pathSoFar.slice(cycleStart).concat(node);
    }
    if (visited.has(node)) return null;
    visited.add(node);
    inStack.add(node);
    for (const dep of graph.get(node) ?? []) {
      const cycle = detectCycle(dep, [...pathSoFar, node]);
      if (cycle) return cycle;
    }
    inStack.delete(node);
    return null;
  }
  __name(detectCycle, "detectCycle");
  for (const node of graph.keys()) {
    const cycle = detectCycle(node, []);
    if (cycle) {
      const names = cycle.map(extractPluginName);
      errors.push(`Circular dependency detected: ${names.join(" \u2192 ")}`);
      break;
    }
  }
  return { errors, warnings };
}
async function importPluginModule(spec) {
  return spec.npmPackage ? await import(spec.name) : await import(toFileUrl(getPluginEntryPoint(spec.name)));
}
async function resolvePluginManifest(source) {
  try {
    const module = await importPluginModule(parsePluginSource(source));
    return module.manifest ?? null;
  } catch {
    return null;
  }
}
async function readManifestFromPackageJson(source) {
  try {
    const gitSpec = parsePluginSource(source);
    let pkgPath;
    if (gitSpec.npmPackage) {
      pkgPath = fileURLToPath(import.meta.resolve(`${gitSpec.name}/package.json`));
    } else {
      const pluginDir = path10.join(process.cwd(), ".quartz", "plugins", gitSpec.name);
      pkgPath = path10.join(pluginDir, "package.json");
    }
    if (!fs9.existsSync(pkgPath)) return null;
    const pkg = JSON.parse(fs9.readFileSync(pkgPath, "utf-8"));
    if (!pkg.quartz) return null;
    const q = pkg.quartz;
    return {
      name: q.name ?? gitSpec.name,
      displayName: q.displayName ?? q.name ?? gitSpec.name,
      description: q.description ?? pkg.description ?? "No description",
      // the package version is the real one; quartz.version is often a stale copy
      version: pkg.version ?? q.version ?? "1.0.0",
      author: q.author ?? pkg.author,
      homepage: q.homepage ?? pkg.homepage,
      issues: issuesUrl(pkg),
      category: q.category,
      quartzVersion: q.quartzVersion,
      deprecated: q.deprecated,
      dependencies: q.dependencies,
      capabilities: q.capabilities,
      defaultOrder: q.defaultOrder,
      defaultEnabled: q.defaultEnabled,
      defaultOptions: q.defaultOptions,
      configSchema: q.configSchema,
      components: q.components,
      frames: q.frames
    };
  } catch {
    return null;
  }
}
function issuesUrl(pkg) {
  const bugs = typeof pkg.bugs === "string" ? pkg.bugs : pkg.bugs?.url;
  if (bugs) return bugs;
  const repo = typeof pkg.repository === "string" ? pkg.repository : pkg.repository?.url;
  const match2 = repo?.match(/github\.com[/:]([^/]+\/[^/#.]+)/) ?? repo?.match(/^github:([^/]+\/[^/#]+)/);
  return match2 ? `https://github.com/${match2[1].replace(/\.git$/, "")}/issues` : void 0;
}
async function getManifest(source) {
  return await readManifestFromPackageJson(source) ?? await resolvePluginManifest(source);
}
async function loadQuartzConfig(configOverrides) {
  const json = readPluginsJson();
  if (!json) {
    const oldConfig = await init_quartz().then(() => quartz_exports);
    return oldConfig.default;
  }
  const configuration = {
    ...json.configuration,
    ...configOverrides
  };
  const pluginEntries = json.plugins.filter((e) => !absorbingBuiltin(e));
  const enabledEntries = pluginEntries.filter((e) => e.enabled);
  const manifests = /* @__PURE__ */ new Map();
  const loadFailures = [];
  const pluginLoadFailed = /* @__PURE__ */ __name((entry, manifest, what, err) => {
    const name = manifest?.name ?? extractPluginName(entry.source);
    const label = manifest?.version ? `${name}@${manifest.version}` : name;
    const detail = err === void 0 ? "" : `: ${err instanceof Error ? err.message : String(err)}`;
    const frame = firstPluginFrame(err);
    reportError({
      area: "plugins",
      plugin: name,
      message: `${label} ${what}${detail}`,
      hint: [
        frame && `at ${frame}`,
        `source: ${formatSourceDisplay(entry.source)}`,
        `Try \`npx quartz plugin doctor\`, update or disable it (\`npx quartz plugin disable ${name}\`); report it${manifest?.issues ? ` at ${manifest.issues}` : " to the plugin's author"} with the output of \`npx quartz info\`.`
      ].filter(Boolean).join("\n")
    });
    if (!loadFailures.includes(name)) loadFailures.push(name);
  }, "pluginLoadFailed");
  const allNativeDeps = /* @__PURE__ */ new Map();
  for (const entry of enabledEntries) {
    try {
      const gitSpec = parsePluginSource(entry.source);
      if (gitSpec.npmPackage) {
        continue;
      }
      const result = await installPlugin(gitSpec, { verbose: false });
      if (result.nativeDeps.size > 0) {
        allNativeDeps.set(gitSpec.name, result.nativeDeps);
      }
    } catch (err) {
      pluginLoadFailed(entry, void 0, "could not be installed", err);
    }
  }
  if (allNativeDeps.size > 0) {
    installNativeDeps(allNativeDeps, { verbose: false });
  }
  for (const entry of enabledEntries) {
    try {
      const manifest = await getManifest(entry.source);
      if (manifest) {
        manifests.set(sourceKey(entry.source), manifest);
      }
    } catch (err) {
      pluginLoadFailed(entry, void 0, "has an unreadable manifest (package.json \u2192 quartz)", err);
    }
  }
  const quartzVersion = readQuartzVersion();
  const incompatible = [];
  for (const entry of enabledEntries) {
    const manifest = manifests.get(sourceKey(entry.source));
    if (!manifest) continue;
    const name = manifest.name ?? extractPluginName(entry.source);
    const requirement = checkQuartzRequirement(manifest.quartzVersion, quartzVersion);
    const problem = describeRequirementProblem(name, requirement, manifest.version);
    if (problem) warn({ area: "versions", plugin: name, ...problem });
    if (requirement.status === "incompatible") incompatible.push(name);
    const deprecation = describeDeprecation(name, manifest.deprecated);
    if (deprecation) warn({ area: "plugins", plugin: name, ...deprecation });
  }
  if (incompatible.length > 0 && incompatiblePluginsFailBuild() && process.env.QUARTZ_CONFIG_QUIET !== "1") {
    throw new Error(
      `${incompatible.length} enabled plugin${incompatible.length === 1 ? " does" : "s do"} not support Quartz ${quartzVersion}: ${incompatible.join(", ")} (see above). Builds in CI fail on this; locally it is a warning. Set QUARTZ_ALLOW_INCOMPATIBLE_PLUGINS=1 to build anyway.`
    );
  }
  const builtinPlan = planBuiltins({
    configuration,
    entries: json.plugins,
    nameOf: /* @__PURE__ */ __name((entry) => manifests.get(sourceKey(entry.source))?.name ?? extractPluginName(entry.source), "nameOf"),
    providesOf: /* @__PURE__ */ __name((entry) => parseCapabilities(manifests.get(sourceKey(entry.source))?.capabilities, "").capabilities?.provides, "providesOf")
  });
  activeBuiltinPlan = builtinPlan;
  printBuiltinNotices(builtinPlan);
  for (const b of builtinPlan.builtins) {
    ;
    configuration[b.spec.configKey] = {
      ...b.options,
      enabled: b.enabled,
      order: b.order
    };
  }
  const capabilityReport = await validatePluginCapabilities({
    entries: pluginEntries,
    nameOf: /* @__PURE__ */ __name((entry) => extractPluginName(entry.source), "nameOf"),
    manifestFor: /* @__PURE__ */ __name((entry) => manifests.get(sourceKey(entry.source)) ?? getManifest(entry.source), "manifestFor"),
    configuration,
    builtins: builtinCapabilityPlugins(builtinPlan)
  });
  printCapabilityWarnings(capabilityReport);
  printPluginConfigWarnings(
    collectPluginConfigWarnings(
      pluginEntries,
      (entry) => manifests.get(sourceKey(entry.source)),
      (entry) => extractPluginName(entry.source)
    )
  );
  const validation = validateDependencies(enabledEntries, manifests);
  for (const warning of validation.warnings) {
    console.warn(styleText11("yellow", `\u26A0`) + ` ${warning}`);
  }
  if (validation.errors.length > 0) {
    for (const error of validation.errors) {
      console.error(styleText11("red", `\u2717`) + ` ${error}`);
    }
    throw new Error(
      `Plugin dependency validation failed with ${validation.errors.length} error(s). See above for details.`
    );
  }
  const transformers = [];
  const filters = [];
  const emitters = [];
  const pageTypes = [];
  for (const entry of enabledEntries) {
    const manifest = manifests.get(sourceKey(entry.source));
    const category = manifest?.category;
    const processingCategories = ["transformer", "filter", "emitter", "pageType"];
    const categoryMap = {
      transformer: transformers,
      filter: filters,
      emitter: emitters,
      pageType: pageTypes
    };
    const categories = Array.isArray(category) ? category : category ? [category] : [];
    const matchedProcessing = categories.filter(
      (c) => processingCategories.includes(c)
    );
    if (matchedProcessing.length > 0) {
      for (const cat of matchedProcessing) {
        categoryMap[cat].push({ entry, manifest });
      }
    } else {
      const gitSpec = parsePluginSource(entry.source);
      const isComponentOnly = categories.length > 0 && categories.every((c) => c === "component");
      if (categories.length > 0 || manifest?.components) {
        registerPluginOrigin(
          {},
          {
            name: manifest?.name ?? extractPluginName(entry.source),
            displayName: manifest?.name ?? extractPluginName(entry.source),
            source: formatSourceDisplay(entry.source),
            version: manifest?.version,
            category: "component",
            issues: manifest?.issues,
            quartzVersion: manifest?.quartzVersion
          }
        );
      }
      if (isComponentOnly) {
        try {
          const module = await importPluginModule(gitSpec);
          if (typeof module.init === "function") {
            const initOverrides = componentRegistry.getOptionOverrides(gitSpec.name);
            const options3 = { ...manifest?.defaultOptions, ...entry.options, ...initOverrides };
            await module.init(Object.keys(options3).length > 0 ? options3 : void 0);
          }
        } catch (err) {
          pluginLoadFailed(entry, manifest, "failed to load its entry module", err);
        }
        if (manifest?.components && Object.keys(manifest.components).length > 0) {
          await loadComponentsFromPackage(gitSpec.name, manifest);
        }
        if (manifest?.frames && Object.keys(manifest.frames).length > 0) {
          await loadFramesFromPackage(gitSpec.name, manifest);
        }
      } else {
        try {
          const module = await importPluginModule(gitSpec);
          const detected = detectCategoryFromModule(module);
          if (detected) {
            categoryMap[detected].push({ entry, manifest });
          } else if (manifest?.components && Object.keys(manifest.components).length > 0) {
            await loadComponentsFromPackage(gitSpec.name, manifest);
            if (manifest?.frames && Object.keys(manifest.frames).length > 0) {
              await loadFramesFromPackage(gitSpec.name, manifest);
            }
          } else {
            pluginLoadFailed(
              entry,
              manifest,
              "was skipped: its category could not be determined (set quartz.category in its package.json)"
            );
          }
        } catch (err) {
          const hasComponents = manifest?.components && Object.keys(manifest.components).length > 0;
          const hasFrames = manifest?.frames && Object.keys(manifest.frames).length > 0;
          if (hasComponents) {
            await loadComponentsFromPackage(gitSpec.name, manifest);
          }
          if (hasFrames) {
            await loadFramesFromPackage(gitSpec.name, manifest);
          }
          pluginLoadFailed(
            entry,
            manifest,
            hasComponents || hasFrames ? "failed to load its entry module (only its components/frames were loaded)" : "was skipped: its entry module failed to load",
            err
          );
        }
      }
    }
  }
  const sortByOrder = /* @__PURE__ */ __name((a, b) => {
    const orderA = a.entry.order ?? a.manifest?.defaultOrder ?? 50;
    const orderB = b.entry.order ?? b.manifest?.defaultOrder ?? 50;
    return orderA - orderB;
  }, "sortByOrder");
  transformers.sort(sortByOrder);
  filters.sort(sortByOrder);
  emitters.sort(sortByOrder);
  pageTypes.sort(sortByOrder);
  const instantiate = /* @__PURE__ */ __name(async (items, expectedCategory) => {
    const instances = [];
    for (const { entry, manifest } of items) {
      try {
        const spec = parsePluginSource(entry.source);
        const module = await importPluginModule(spec);
        const pluginName = spec.name;
        if (manifest?.components && Object.keys(manifest.components).length > 0) {
          await loadComponentsFromPackage(pluginName, manifest);
        }
        if (manifest?.frames && Object.keys(manifest.frames).length > 0) {
          await loadFramesFromPackage(pluginName, manifest);
        }
        const factory = findFactory(module, expectedCategory);
        if (!factory) {
          pluginLoadFailed(
            entry,
            manifest,
            `was skipped: no ${expectedCategory} factory found (export a default function, a "plugin" named export, or a single function)`
          );
          continue;
        }
        const pluginOverrides = componentRegistry.getOptionOverrides(spec.name);
        const options3 = { ...manifest?.defaultOptions, ...entry.options, ...pluginOverrides };
        const instance = factory(Object.keys(options3).length > 0 ? options3 : void 0);
        if (!instance || typeof instance !== "object") {
          pluginLoadFailed(
            entry,
            manifest,
            "was skipped: its factory did not return a plugin instance"
          );
          continue;
        }
        if (!validateCategory(instance, expectedCategory)) {
          pluginLoadFailed(
            entry,
            manifest,
            `was skipped: it declares category "${expectedCategory}" but its instance lacks the required methods`
          );
          continue;
        }
        if (expectedCategory === "pageType" && typeof instance.body === "function") {
          instance.body = attributeComponentExport(instance.body, {
            plugin: shortPluginName(extractPluginName(entry.source)),
            component: typeof instance.name === "string" ? instance.name : "Body"
          });
        }
        registerPluginOrigin(instance, {
          name: typeof instance.name === "string" ? instance.name : extractPluginName(entry.source),
          displayName: manifest?.name ?? extractPluginName(entry.source),
          source: formatSourceDisplay(entry.source),
          version: manifest?.version,
          category: expectedCategory,
          issues: manifest?.issues,
          quartzVersion: manifest?.quartzVersion
        });
        instances.push({ order: entry.order ?? manifest?.defaultOrder ?? 50, instance });
      } catch (err) {
        pluginLoadFailed(entry, manifest, "was skipped: it failed to initialise", err);
      }
    }
    return instances;
  }, "instantiate");
  const builtinPlugins = await Promise.resolve().then(() => (init_plugins(), plugins_exports));
  const builtinEmitters = [
    builtinPlugins.ComponentResources(),
    builtinPlugins.Assets(),
    builtinPlugins.Static()
  ];
  const builtinPageTypes = [builtinPlugins.PageTypes.NotFoundPageType()];
  const withBuiltins = /* @__PURE__ */ __name((builtins, instances) => [...builtins, ...instances].map((item, index) => ({ ...item, index })).sort((a, b) => a.order - b.order || a.index - b.index).map((item) => item.instance), "withBuiltins");
  const plugins = {
    transformers: withBuiltins(
      instantiateBuiltins(builtinPlan, "transformer"),
      await instantiate(transformers, "transformer")
    ),
    filters: withBuiltins(
      instantiateBuiltins(builtinPlan, "filter"),
      await instantiate(filters, "filter")
    ),
    emitters: [
      ...builtinEmitters,
      ...withBuiltins(
        instantiateBuiltins(builtinPlan, "emitter"),
        await instantiate(emitters, "emitter")
      )
    ],
    pageTypes: [
      ...(await instantiate(pageTypes, "pageType")).map((item) => item.instance),
      ...builtinPageTypes
    ]
  };
  const layout2 = await loadQuartzLayout();
  activeLayout = layout2;
  plugins.emitters.push(
    builtinPlugins.PageTypes.PageTypeDispatcher({
      defaults: layout2.defaults,
      byPageType: layout2.byPageType
    })
  );
  if (loadFailures.length > 0 && brokenPluginsFailBuild() && process.env.QUARTZ_CONFIG_QUIET !== "1") {
    throw new Error(
      `${loadFailures.length} enabled plugin${loadFailures.length === 1 ? "" : "s"} could not be loaded: ${loadFailures.join(", ")} (see above). Builds in CI fail on this; locally the build continues without them. Set QUARTZ_ALLOW_BROKEN_PLUGINS=1 to build anyway.`
    );
  }
  return {
    configuration,
    plugins
  };
}
function printBuiltinNotices(plan) {
  for (const notice of plan.notices) {
    if (printedBuiltinNotices.has(notice)) continue;
    printedBuiltinNotices.add(notice);
    warn({ area: "config", message: notice });
  }
}
function builtinCapabilityPlugins(plan) {
  const enabled = [];
  const available = [];
  for (const b of plan.builtins) {
    const plugin = {
      name: b.enabled ? `built-in ${b.spec.id}` : `configuration.${b.spec.configKey}`,
      aliases: [...b.spec.absorbs, `quartz:${b.spec.id}`],
      capabilities: b.spec.capabilities
    };
    (b.enabled ? enabled : available).push(plugin);
  }
  return { enabled, available };
}
function validateCategory(instance, expected) {
  switch (expected) {
    case "pageType":
      return "match" in instance && "body" in instance && "layout" in instance;
    case "emitter":
      return "emit" in instance;
    case "filter":
      return "shouldPublish" in instance;
    case "transformer":
      return "textTransform" in instance || "markdownPlugins" in instance || "htmlPlugins" in instance;
  }
}
function findFactory(module, expectedCategory) {
  if (typeof module.default === "function") {
    return module.default;
  }
  if (typeof module.plugin === "function") {
    return module.plugin;
  }
  const exportedFunctions = Object.entries(module).filter(
    ([key, value]) => typeof value === "function" && !key.startsWith("__")
  );
  if (exportedFunctions.length === 1) {
    return exportedFunctions[0][1];
  }
  if (exportedFunctions.length > 1 && expectedCategory) {
    for (const [, fn] of exportedFunctions) {
      try {
        const instance = fn();
        if (instance && typeof instance === "object" && validateCategory(instance, expectedCategory)) {
          return fn;
        }
      } catch {
      }
    }
  }
  return null;
}
function detectCategoryFromModule(module) {
  if (!module || typeof module !== "object") return null;
  const mod = module;
  const factory = findFactory(mod);
  if (factory && "quartzCategory" in factory) {
    const cat = factory.quartzCategory;
    if (cat === "transformer" || cat === "filter" || cat === "emitter" || cat === "pageType") {
      return cat;
    }
  }
  if (typeof factory === "function") {
    try {
      const instance = factory();
      if (instance && typeof instance === "object") {
        if ("match" in instance && "body" in instance && "layout" in instance) return "pageType";
        if ("emit" in instance) return "emitter";
        if ("shouldPublish" in instance) return "filter";
        if ("textTransform" in instance || "markdownPlugins" in instance || "htmlPlugins" in instance)
          return "transformer";
      }
    } catch {
    }
  }
  return null;
}
function replaceContents(target, source) {
  const t = target;
  for (const key of Object.keys(t)) delete t[key];
  Object.assign(t, source);
}
function layoutNameAliases(pluginName) {
  const slash = pluginName.indexOf("/");
  if (pluginName.startsWith("@") && slash > 0) {
    return [pluginName, pluginName.slice(slash + 1)];
  }
  return [pluginName];
}
function parseSidebars(raw, where, warn2) {
  if (raw === void 0 || raw === null) return {};
  if (typeof raw !== "object" || Array.isArray(raw)) {
    warn2(`${where}: expected { left, right } with fit, scroll or static \u2014 ignored.`);
    return {};
  }
  const modes = {};
  for (const [side, value] of Object.entries(raw)) {
    if (side !== "left" && side !== "right") {
      warn2(`${where}: unknown sidebar "${side}" \u2014 use left or right.`);
      continue;
    }
    if (!SIDEBAR_MODES.includes(value)) {
      const hint = suggest(String(value), [...SIDEBAR_MODES]);
      warn2(
        `${where}.${side}: unknown mode ${JSON.stringify(value)}${hint ? ` (did you mean "${hint}"?)` : ""} \u2014 using fit. Modes: ${SIDEBAR_MODES.join(", ")}.`
      );
      continue;
    }
    modes[side] = value;
  }
  return modes;
}
function buildQuartzLayout(json, head, layoutOverrides) {
  const report = emptyLayoutReport();
  const warn2 = /* @__PURE__ */ __name((w) => {
    if (!report.warnings.includes(w)) report.warnings.push(w);
  }, "warn");
  const allEntries = Array.isArray(json.plugins) ? json.plugins : [];
  const enabledEntries = allEntries.filter((e) => e.enabled);
  const layoutConfig = json.layout ?? {};
  const defaultDiag = new LayoutDiagnostics();
  const defaultLayout = buildLayoutForEntries(enabledEntries, layoutConfig, defaultDiag);
  report.defaults = defaultDiag.placements;
  defaultDiag.warnings.forEach(warn2);
  const defaultSidebars = parseSidebars(layoutConfig.sidebars, "layout.sidebars", warn2);
  if (Object.keys(defaultSidebars).length > 0) defaultLayout.sidebars = defaultSidebars;
  const knownPluginNames = allEntries.flatMap((e) => layoutNameAliases(extractPluginName(e.source)));
  const enabledPluginNames = new Set(
    enabledEntries.flatMap((e) => layoutNameAliases(extractPluginName(e.source)))
  );
  const excludedBy = /* @__PURE__ */ __name((exclude, pluginName) => layoutNameAliases(pluginName).some((alias) => exclude.includes(alias)), "excludedBy");
  const byPageType = {};
  for (const [pageType, rawOverride] of Object.entries(layoutConfig.byPageType ?? {})) {
    const override = rawOverride ?? {};
    for (const key of Object.keys(override)) {
      if (!PAGE_TYPE_OVERRIDE_KEYS.includes(key)) {
        const hint = suggest(key, PAGE_TYPE_OVERRIDE_KEYS);
        warn2(
          `byPageType.${pageType}: unknown key "${key}"${hint ? ` (did you mean "${hint}"?)` : ""} \u2014 ignored. Supported: ${PAGE_TYPE_OVERRIDE_KEYS.join(", ")}.`
        );
      }
    }
    const exclude = Array.isArray(override.exclude) ? override.exclude : [];
    for (const name of exclude) {
      if (!knownPluginNames.includes(name)) {
        const hint = suggest(name, knownPluginNames);
        warn2(
          `byPageType.${pageType}.exclude: no plugin named "${name}"${hint ? ` (did you mean "${hint}"?)` : ""} \u2014 nothing excluded.`
        );
      }
    }
    const filteredEntries = enabledEntries.filter(
      (e) => !excludedBy(exclude, extractPluginName(e.source))
    );
    const ptDiag = new LayoutDiagnostics();
    const ptLayout = buildLayoutForEntries(filteredEntries, layoutConfig, ptDiag);
    ptDiag.warnings.forEach(warn2);
    const customized = /* @__PURE__ */ new Set();
    for (const p of report.defaults) {
      if (excludedBy(exclude, p.plugin)) customized.add(p.slot);
    }
    const cleared = [];
    for (const [pos, components] of Object.entries(override.positions ?? {})) {
      if (!isLayoutSlot(pos)) {
        const hint = suggest(pos, LAYOUT_SLOTS);
        warn2(
          `byPageType.${pageType}.positions: unknown position "${pos}"${hint ? ` (did you mean "${hint}"?)` : ""} \u2014 ignored. Valid positions: ${LAYOUT_SLOTS.join(", ")}.`
        );
        continue;
      }
      if (Array.isArray(components) && components.length === 0) {
        ;
        ptLayout[pos] = [];
        cleared.push(pos);
        customized.add(pos);
      } else {
        warn2(
          `byPageType.${pageType}.positions.${pos}: only an empty list ([]) is supported (clears the slot) \u2014 ignored. To move a component on this page type, use exclude plus the plugin's layout block.`
        );
      }
    }
    const entry = {};
    for (const slot of customized) {
      ;
      entry[slot] = ptLayout[slot];
    }
    if (override.template) {
      if (!BUILTIN_FRAME_NAMES.includes(override.template) && !frameRegistry.has(override.template)) {
        const available = [...BUILTIN_FRAME_NAMES, ...frameRegistry.getAll().keys()];
        warn2(
          `byPageType.${pageType}.template: unknown frame "${override.template}" \u2014 pages will use "default". Available: ${available.join(", ")}.`
        );
      }
      entry.frame = override.template;
    }
    if (override.sidebars !== void 0) {
      entry.sidebars = {
        ...defaultSidebars,
        ...parseSidebars(override.sidebars, `byPageType.${pageType}.sidebars`, warn2)
      };
    }
    byPageType[pageType] = entry;
    report.byPageType[pageType] = {
      exclude: exclude.filter((n) => enabledPluginNames.has(n)),
      cleared,
      template: override.template,
      customizedSlots: LAYOUT_SLOTS.filter((s) => customized.has(s)),
      placements: ptDiag.placements.filter((p) => !cleared.includes(p.slot))
    };
  }
  defaultLayout.head = head;
  defaultLayout.header = defaultLayout.header ?? [];
  defaultLayout.footer = defaultLayout.footer ?? [];
  const tsDefaults = layoutOverrides?.defaults ?? {};
  report.tsOverrides.defaults = Object.keys(tsDefaults);
  const mergedDefaults = { ...defaultLayout, ...tsDefaults };
  const mergedByPageType = { ...byPageType };
  for (const [pageType, overrideLayout] of Object.entries(layoutOverrides?.byPageType ?? {})) {
    mergedByPageType[pageType] = { ...mergedByPageType[pageType], ...overrideLayout };
    report.tsOverrides.byPageType[pageType] = Object.keys(overrideLayout ?? {});
  }
  return { layout: { defaults: mergedDefaults, byPageType: mergedByPageType }, report };
}
async function loadQuartzLayout(layoutOverrides) {
  const json = readPluginsJson();
  if (!json) {
    const oldLayout = await init_quartz().then(() => quartz_exports);
    return oldLayout.layout;
  }
  const HeadModule = await Promise.resolve().then(() => (init_Head(), Head_exports));
  const head = HeadModule.default();
  const { layout: layout2, report } = buildQuartzLayout(json, head, layoutOverrides);
  setLayoutReport(report);
  printLayoutWarnings(report.warnings);
  if (layoutOverrides && activeLayout) {
    replaceContents(activeLayout.defaults, layout2.defaults);
    replaceContents(activeLayout.byPageType, layout2.byPageType);
    return activeLayout;
  }
  return layout2;
}
function lookupRegisteredComponent(entry) {
  const name = extractPluginName(entry.source);
  const pascalName = name.split("-").map((s) => s.charAt(0).toUpperCase() + s.slice(1)).join("");
  return componentRegistry.get(name) ?? componentRegistry.get(`${formatSourceDisplay(entry.source)}/${name}`) ?? componentRegistry.get(pascalName);
}
function instantiateRegistered(reg, name, entry) {
  if (typeof reg.component === "function" && !("displayName" in reg.component)) {
    const tsOverrides = componentRegistry.getOptionOverrides(name);
    const opts = { ...entry.options, ...tsOverrides };
    const optsArg = Object.keys(opts).length > 0 ? opts : void 0;
    return componentRegistry.instantiate(reg.component, optsArg);
  }
  return reg.component;
}
function buildLayoutForEntries(entries, layoutConfig, diag = new LayoutDiagnostics()) {
  const positions = {
    header: [],
    left: [],
    right: [],
    beforeBody: [],
    afterBody: [],
    footer: []
  };
  const placedPlugins = /* @__PURE__ */ new Set();
  let seq = 0;
  for (const entry of entries) {
    if (!entry.enabled) continue;
    const name = extractPluginName(entry.source);
    const layout2 = entry.layout ?? void 0;
    const reg = lookupRegisteredComponent(entry);
    if (!reg) {
      if (layout2) {
        diag.warn(
          `plugin "${name}" has a layout block but no component is registered for it \u2014 not placed. (Does the plugin provide a component, and did it load?)`
        );
      }
      continue;
    }
    const manifest = reg.manifest;
    const fromConfig = layout2?.position !== void 0 && layout2?.position !== null;
    const position = fromConfig ? layout2.position : manifest?.defaultPosition;
    if (position === void 0 || position === null) {
      if (layout2) {
        diag.warn(
          `plugin "${name}": layout block has no position and the plugin declares no defaultPosition \u2014 not placed. Add layout.position (${LAYOUT_SLOTS.join(", ")}).`
        );
      }
      continue;
    }
    if (!isLayoutSlot(position)) {
      const hint = suggest(String(position), LAYOUT_SLOTS);
      diag.warn(
        fromConfig ? `plugin "${name}": unknown layout position "${position}"${hint ? ` (did you mean "${hint}"?)` : ""} \u2014 not placed. Valid positions: ${LAYOUT_SLOTS.join(", ")}.` : `plugin "${name}" declares unsupported defaultPosition "${position}" \u2014 not placed. Set layout.position in quartz.config.yaml to show it.`
      );
      continue;
    }
    let priority = layout2?.priority ?? manifest?.defaultPriority ?? 50;
    if (typeof priority !== "number" || Number.isNaN(priority)) {
      diag.warn(`plugin "${name}": layout priority "${priority}" is not a number \u2014 using 50.`);
      priority = 50;
    }
    if (placedPlugins.has(name)) {
      diag.warn(
        `plugin "${name}" is listed more than once in quartz.config.yaml \u2014 its component is rendered once per entry.`
      );
    }
    placedPlugins.add(name);
    let component = instantiateRegistered(reg, name, entry);
    const placement = {
      plugin: name,
      component: component.displayName ?? reg.manifest?.displayName,
      slot: position,
      priority,
      origin: layout2 ? "config" : "manifest"
    };
    const display = layout2?.display;
    if (display === "mobile-only" || display === "desktop-only") {
      component = applyDisplayWrapper(component, display);
      placement.display = display;
    } else if (display !== void 0 && display !== null && display !== "all") {
      diag.warn(
        `plugin "${name}": unknown display "${display}" \u2014 ignored (shown everywhere). Valid: all, mobile-only, desktop-only.`
      );
    }
    if (layout2?.condition) {
      placement.condition = layout2.condition;
      const wrapped = applyConditionWrapper(component, layout2.condition);
      if (wrapped === component) {
        placement.conditionUnknown = true;
        const known = getAllConditionNames();
        const hint = suggest(layout2.condition, known);
        diag.warn(
          `plugin "${name}": unknown condition "${layout2.condition}"${hint ? ` (did you mean "${hint}"?)` : ""} \u2014 component will always render. Known conditions: ${known.join(", ")}.`
        );
      }
      component = wrapped;
    }
    if (layout2?.group) placement.group = layout2.group;
    positions[position].push({
      component,
      priority,
      group: layout2?.group,
      groupOptions: layout2?.groupOptions,
      placement,
      rank: layout2 ? 0 : 1,
      seq: seq++
    });
  }
  const result = {};
  for (const [position, items] of Object.entries(positions)) {
    items.sort((a, b) => a.priority - b.priority || a.rank - b.rank || a.seq - b.seq);
    for (const item of items) diag.place(item.placement);
    const resolved = resolveGroups(items, layoutConfig.groups ?? {});
    result[position] = resolved;
  }
  return result;
}
function resolveGroups(items, groups) {
  const groupedComponents = /* @__PURE__ */ new Map();
  const groupPriority = /* @__PURE__ */ new Map();
  for (const item of items) {
    if (item.group) {
      if (!groupedComponents.has(item.group)) {
        groupedComponents.set(item.group, []);
        const groupConfig = groups[item.group];
        groupPriority.set(item.group, groupConfig?.priority ?? item.priority);
      }
      const groupMembers = groupedComponents.get(item.group);
      if (groupMembers) {
        groupMembers.push({
          component: item.component,
          groupOptions: item.groupOptions
        });
      }
    }
  }
  const entries = [];
  const processedGroups = /* @__PURE__ */ new Set();
  for (const item of items) {
    if (item.group) {
      if (processedGroups.has(item.group)) continue;
      processedGroups.add(item.group);
      const members = groupedComponents.get(item.group);
      if (!members) continue;
      const groupConfig = groups[item.group] ?? {};
      const flexComponents = members.map((m) => ({
        Component: m.component,
        grow: m.groupOptions?.grow,
        shrink: m.groupOptions?.shrink,
        basis: m.groupOptions?.basis,
        order: m.groupOptions?.order,
        align: m.groupOptions?.align,
        justify: m.groupOptions?.justify
      }));
      const flexComponent = Flex_default({
        components: flexComponents,
        direction: groupConfig.direction ?? "row",
        wrap: groupConfig.wrap,
        gap: groupConfig.gap ?? "1rem"
      });
      entries.push({ priority: groupPriority.get(item.group) ?? 50, component: flexComponent });
    } else {
      entries.push({ priority: item.priority, component: item.component });
    }
  }
  entries.sort((a, b) => a.priority - b.priority);
  return entries.map((e) => e.component);
}
function applyDisplayWrapper(component, display) {
  if (display === "mobile-only") {
    return MobileOnly_default(component);
  } else {
    return DesktopOnly_default(component);
  }
}
function applyConditionWrapper(component, conditionName) {
  const predicate = getCondition(conditionName);
  if (!predicate) return component;
  return ConditionalRender_default({
    component,
    condition: predicate
  });
}
var CONFIG_YAML_PATH, DEFAULT_CONFIG_YAML_PATH, LEGACY_PLUGINS_JSON_PATH, LEGACY_DEFAULT_PLUGINS_JSON_PATH, activeBuiltinPlan, printedBuiltinNotices, activeLayout, BUILTIN_FRAME_NAMES, PAGE_TYPE_OVERRIDE_KEYS;
var init_config_loader = __esm({
  "quartz/plugins/loader/config-loader.ts"() {
    "use strict";
    init_cfg();
    init_gitLoader();
    init_componentLoader();
    init_attribution();
    init_frameLoader();
    init_capabilities();
    init_builtins();
    init_diagnostics();
    init_trace();
    init_compat();
    init_option_validation();
    init_registry();
    init_registry2();
    init_conditions();
    init_layoutReport();
    init_Flex();
    init_MobileOnly();
    init_DesktopOnly();
    init_ConditionalRender();
    CONFIG_YAML_PATH = path10.join(process.cwd(), "quartz.config.yaml");
    DEFAULT_CONFIG_YAML_PATH = path10.join(process.cwd(), "quartz.config.default.yaml");
    LEGACY_PLUGINS_JSON_PATH = path10.join(process.cwd(), "quartz.plugins.json");
    LEGACY_DEFAULT_PLUGINS_JSON_PATH = path10.join(process.cwd(), "quartz.plugins.default.json");
    __name(resolveConfigPath, "resolveConfigPath");
    __name(readPluginsJson, "readPluginsJson");
    __name(extractPluginName, "extractPluginName");
    __name(formatSourceDisplay, "formatSourceDisplay");
    __name(sourceKey, "sourceKey");
    __name(validateDependencies, "validateDependencies");
    __name(importPluginModule, "importPluginModule");
    __name(resolvePluginManifest, "resolvePluginManifest");
    __name(readManifestFromPackageJson, "readManifestFromPackageJson");
    __name(issuesUrl, "issuesUrl");
    __name(getManifest, "getManifest");
    __name(loadQuartzConfig, "loadQuartzConfig");
    printedBuiltinNotices = globalThis[/* @__PURE__ */ Symbol.for("quartz.printedBuiltinNotices")] ??= /* @__PURE__ */ new Set();
    __name(printBuiltinNotices, "printBuiltinNotices");
    __name(builtinCapabilityPlugins, "builtinCapabilityPlugins");
    __name(validateCategory, "validateCategory");
    __name(findFactory, "findFactory");
    __name(detectCategoryFromModule, "detectCategoryFromModule");
    __name(replaceContents, "replaceContents");
    BUILTIN_FRAME_NAMES = ["default", "full-width", "minimal"];
    __name(layoutNameAliases, "layoutNameAliases");
    PAGE_TYPE_OVERRIDE_KEYS = ["exclude", "positions", "template", "sidebars"];
    __name(parseSidebars, "parseSidebars");
    __name(buildQuartzLayout, "buildQuartzLayout");
    __name(loadQuartzLayout, "loadQuartzLayout");
    __name(lookupRegisteredComponent, "lookupRegisteredComponent");
    __name(instantiateRegistered, "instantiateRegistered");
    __name(buildLayoutForEntries, "buildLayoutForEntries");
    __name(resolveGroups, "resolveGroups");
    __name(applyDisplayWrapper, "applyDisplayWrapper");
    __name(applyConditionWrapper, "applyConditionWrapper");
  }
});

// site.config.mjs
var site_config_default;
var init_site_config = __esm({
  "site.config.mjs"() {
    "use strict";
    site_config_default = {
      title: "awaken",
      description: "\u5018\u82E5\u91CD\u65B0\u7A7F\u8D8A\u65F6\u5149\u6CB3\u6D41",
      url: "https://awaken-psy.github.io",
      featuredNotes: [],
      links: { GitHub: "https://github.com/awaken-psy" },
      categories: [
        {
          title: "\u56FE\u5F62\u5B66\u4E0E\u6E32\u67D3",
          path: "\u5B66\u4E60\u7B14\u8BB0/cg",
          label: "GRAPHICS",
          description: "\u5149\u7167\u3001\u6750\u8D28\u4E0E\u5B9E\u65F6\u6E32\u67D3\uFF0C\u4ECE\u539F\u7406\u8D70\u8FDB\u753B\u9762\u3002"
        },
        {
          title: "\u7B97\u6CD5",
          path: "\u5B66\u4E60\u7B14\u8BB0/\u7B97\u6CD5",
          label: "ALGORITHMS",
          description: "\u62C6\u89E3\u95EE\u9898\uFF0C\u7406\u89E3\u601D\u8DEF\uFF0C\u8BB0\u5F55\u4EE3\u7801\u4E2D\u7684\u63A8\u6F14\u3002"
        },
        {
          title: "\u8BA1\u7B97\u673A\u57FA\u7840",
          path: "\u5B66\u4E60\u7B14\u8BB0/\u8BA1\u7B97\u673A\u57FA\u7840",
          label: "COMPUTER SCIENCE",
          description: "\u8BED\u8A00\u3001\u7CFB\u7EDF\u4E0E\u5E95\u5C42\u673A\u5236\uFF0C\u8865\u5168\u77E5\u8BC6\u4E4B\u95F4\u7684\u8FDE\u63A5\u3002"
        },
        {
          title: "AI",
          path: "\u5B66\u4E60\u7B14\u8BB0/ai",
          label: "ARTIFICIAL INTELLIGENCE",
          description: "\u795E\u7ECF\u7F51\u7EDC\u4E0E\u673A\u5668\u5B66\u4E60\uFF0C\u6CBF\u7740\u516C\u5F0F\u7406\u89E3\u6A21\u578B\u3002"
        }
      ],
      topics: [
        {
          title: "CUDA",
          path: "\u5B66\u4E60\u7B14\u8BB0/cg/cuda",
          description: "GPU \u7F16\u7A0B\u4E0E\u5E76\u884C\u8BA1\u7B97"
        },
        {
          title: "LearnOpenGL",
          path: "\u5B66\u4E60\u7B14\u8BB0/cg/LearnOpengl",
          description: "\u4ECE\u6E32\u67D3\u7BA1\u7EBF\u5230\u5149\u7167\u4E0E\u6750\u8D28"
        },
        {
          title: "GAMES202",
          path: "\u5B66\u4E60\u7B14\u8BB0/cg/games202",
          description: "\u9AD8\u8D28\u91CF\u5B9E\u65F6\u6E32\u67D3"
        }
      ]
    };
  }
});

// site/components.tsx
import { jsx as jsx17, jsxs as jsxs8 } from "preact/jsx-runtime";
function link(props, target) {
  return resolveRelative(
    props.fileData.slug ?? "index",
    slugifyFilePath(target)
  );
}
function publicNotes(props) {
  return props.allFiles.filter(
    (file) => file.frontmatter?.publish === true && !file.frontmatter?.kind
  );
}
function inFolder(file, folder) {
  return String(file.relativePath ?? "").startsWith(`${folder}/`);
}
function Sphere() {
  return /* @__PURE__ */ jsxs8("div", { class: "hero-geometry", "aria-hidden": "true", children: [
    /* @__PURE__ */ jsx17("div", { class: "geometry-label", children: "01 / LIGHT & SPACE" }),
    /* @__PURE__ */ jsxs8("svg", { viewBox: "0 0 360 300", fill: "none", children: [
      /* @__PURE__ */ jsxs8(
        "g",
        {
          transform: "translate(180 147) rotate(-22)",
          stroke: "currentColor",
          "stroke-width": "0.8",
          children: [
            /* @__PURE__ */ jsx17("circle", { r: "108" }),
            [28, 55, 79, 97].map((radius) => /* @__PURE__ */ jsx17("ellipse", { rx: radius, ry: "108" })),
            [28, 55, 79, 97].map((radius) => /* @__PURE__ */ jsx17("ellipse", { rx: "108", ry: radius })),
            /* @__PURE__ */ jsx17(
              "path",
              {
                d: "M-135 0H135M0-135V135",
                opacity: ".45",
                "stroke-dasharray": "3 5"
              }
            )
          ]
        }
      ),
      /* @__PURE__ */ jsx17("circle", { cx: "279", cy: "105", r: "3", fill: "currentColor" }),
      /* @__PURE__ */ jsx17("path", { d: "M279 105h38l14-14", stroke: "currentColor" })
    ] }),
    /* @__PURE__ */ jsx17("span", { class: "geometry-coordinate", children: "x / y / z" })
  ] });
}
function SectionTitle({
  number,
  title,
  href,
  label = "\u67E5\u770B\u5168\u90E8"
}) {
  return /* @__PURE__ */ jsxs8("div", { class: "section-heading", children: [
    /* @__PURE__ */ jsxs8("h2", { children: [
      /* @__PURE__ */ jsx17("span", { children: number }),
      title
    ] }),
    href && /* @__PURE__ */ jsxs8("a", { class: "quiet-link internal", href, children: [
      label,
      /* @__PURE__ */ jsx17("span", { "aria-hidden": "true", children: "\u2197" })
    ] })
  ] });
}
function TopicList(props) {
  const notes = publicNotes(props);
  return /* @__PURE__ */ jsx17("div", { class: "topic-grid", children: site_config_default.topics.map((topic) => {
    const count = notes.filter((file) => inFolder(file, topic.path)).length;
    return count > 0 && /* @__PURE__ */ jsxs8(
      "a",
      {
        class: "topic-item internal",
        href: link(props, `${topic.path}/index.md`),
        children: [
          /* @__PURE__ */ jsx17("span", { class: "topic-glyph", "aria-hidden": "true", children: topic.title === "CUDA" ? "\u2318" : topic.title === "LearnOpenGL" ? "\u25C7" : "\u25C8" }),
          /* @__PURE__ */ jsxs8("div", { children: [
            /* @__PURE__ */ jsx17("h3", { children: topic.title }),
            /* @__PURE__ */ jsx17("p", { children: topic.description })
          ] }),
          /* @__PURE__ */ jsxs8("span", { class: "topic-count", children: [
            count,
            " \u7BC7 ",
            /* @__PURE__ */ jsx17("span", { "aria-hidden": "true", children: "\u2197" })
          ] })
        ]
      }
    );
  }) });
}
function Home(props) {
  const notes = publicNotes(props);
  const recent = [...notes].sort((a, b) => {
    const order = String(b.frontmatter?.updated ?? "").localeCompare(
      String(a.frontmatter?.updated ?? "")
    );
    return order || String(a.relativePath).localeCompare(String(b.relativePath), "en");
  }).slice(0, 5);
  const featured = site_config_default.featuredNotes.slice(0, 6).flatMap(
    (name) => notes.filter((file) => file.relativePath === name)
  );
  return /* @__PURE__ */ jsxs8("main", { id: "main-content", class: "site-home", children: [
    /* @__PURE__ */ jsxs8("section", { class: "home-hero", children: [
      /* @__PURE__ */ jsxs8("div", { class: "hero-copy", children: [
        /* @__PURE__ */ jsxs8("p", { class: "eyebrow", children: [
          /* @__PURE__ */ jsx17("span", { class: "status-dot" }),
          "PERSONAL NOTES / DIGITAL GARDEN"
        ] }),
        /* @__PURE__ */ jsxs8("h1", { children: [
          "awaken",
          /* @__PURE__ */ jsx17("span", { class: "hero-period", "aria-hidden": "true", children: "." })
        ] }),
        /* @__PURE__ */ jsx17("p", { class: "hero-description", children: site_config_default.description }),
        /* @__PURE__ */ jsxs8("div", { class: "hero-actions", children: [
          /* @__PURE__ */ jsxs8("a", { class: "primary-link internal", href: link(props, "notes.md"), children: [
            "\u6D4F\u89C8\u7B14\u8BB0 ",
            /* @__PURE__ */ jsx17("span", { "aria-hidden": "true", children: "\u2197" })
          ] }),
          /* @__PURE__ */ jsxs8("a", { class: "quiet-link internal", href: link(props, "topics.md"), children: [
            "\u63A2\u7D22\u4E13\u9898 ",
            /* @__PURE__ */ jsx17("span", { "aria-hidden": "true", children: "\u2192" })
          ] })
        ] })
      ] }),
      /* @__PURE__ */ jsx17(Sphere, {}),
      /* @__PURE__ */ jsxs8("div", { class: "hero-baseline", children: [
        /* @__PURE__ */ jsx17("span", { children: "\u5B66\u4E60 \xB7 \u63A8\u6F14 \xB7 \u5B9E\u8DF5" }),
        /* @__PURE__ */ jsxs8("span", { children: [
          notes.length,
          " \u7BC7\u516C\u5F00\u7B14\u8BB0 ",
          /* @__PURE__ */ jsx17("span", { class: "baseline-divider", children: "/" }),
          " 4 \u4E2A\u5B66\u4E60\u65B9\u5411"
        ] })
      ] })
    ] }),
    /* @__PURE__ */ jsxs8("section", { class: "home-section", children: [
      /* @__PURE__ */ jsx17(
        SectionTitle,
        {
          number: "01",
          title: "\u63A2\u7D22\u7B14\u8BB0",
          href: link(props, "notes.md")
        }
      ),
      /* @__PURE__ */ jsx17("div", { class: "category-grid", children: site_config_default.categories.map((category, index) => /* @__PURE__ */ jsxs8(
        "a",
        {
          class: "category-card internal",
          href: link(props, `${category.path}/index.md`),
          children: [
            /* @__PURE__ */ jsxs8("div", { class: "category-topline", children: [
              /* @__PURE__ */ jsxs8("span", { class: "category-number", children: [
                "0",
                index + 1
              ] }),
              /* @__PURE__ */ jsx17("span", { "aria-hidden": "true", children: "\u2197" })
            ] }),
            /* @__PURE__ */ jsx17("p", { class: "category-label", children: category.label }),
            /* @__PURE__ */ jsx17("h3", { children: category.title }),
            /* @__PURE__ */ jsx17("p", { class: "category-description", children: category.description }),
            /* @__PURE__ */ jsxs8("span", { class: "category-total", children: [
              notes.filter((file) => inFolder(file, category.path)).length,
              /* @__PURE__ */ jsx17("span", { children: "\u7BC7\u7B14\u8BB0" })
            ] })
          ]
        }
      )) })
    ] }),
    /* @__PURE__ */ jsxs8("section", { class: "home-section", children: [
      /* @__PURE__ */ jsx17(
        SectionTitle,
        {
          number: "02",
          title: "\u6CBF\u7740\u4E13\u9898\u9605\u8BFB",
          href: link(props, "topics.md")
        }
      ),
      /* @__PURE__ */ jsx17(TopicList, { ...props })
    ] }),
    featured.length > 0 && /* @__PURE__ */ jsxs8("section", { class: "home-section", children: [
      /* @__PURE__ */ jsx17(SectionTitle, { number: "03", title: "\u7CBE\u9009\u7B14\u8BB0" }),
      /* @__PURE__ */ jsx17("div", { class: "note-list", children: featured.map((file) => /* @__PURE__ */ jsxs8(
        "a",
        {
          class: "note-row internal",
          href: link(props, String(file.relativePath)),
          children: [
            /* @__PURE__ */ jsx17("span", { children: file.frontmatter?.title }),
            /* @__PURE__ */ jsx17("span", { "aria-hidden": "true", children: "\u2197" })
          ]
        }
      )) })
    ] }),
    /* @__PURE__ */ jsxs8("section", { class: "home-section recent-section", children: [
      /* @__PURE__ */ jsx17(
        SectionTitle,
        {
          number: featured.length > 0 ? "04" : "03",
          title: "\u6700\u8FD1\u66F4\u65B0",
          href: link(props, "notes.md")
        }
      ),
      /* @__PURE__ */ jsx17("div", { class: "note-list", children: recent.map((file) => /* @__PURE__ */ jsxs8(
        "a",
        {
          class: "note-row internal",
          href: link(props, String(file.relativePath)),
          children: [
            /* @__PURE__ */ jsx17("time", { dateTime: String(file.frontmatter?.updated), children: String(file.frontmatter?.updated).slice(0, 10).replaceAll("-", ".") }),
            /* @__PURE__ */ jsxs8("div", { children: [
              /* @__PURE__ */ jsx17("h3", { children: file.frontmatter?.title }),
              /* @__PURE__ */ jsx17("span", { class: "note-location", children: String(file.relativePath).split("/").slice(1, -1).join(" / ") })
            ] }),
            /* @__PURE__ */ jsx17("span", { class: "note-arrow", "aria-hidden": "true", children: "\u2197" })
          ]
        }
      )) })
    ] })
  ] });
}
var SiteBehavior, AwakenFrame;
var init_components2 = __esm({
  "site/components.tsx"() {
    "use strict";
    init_path();
    init_site_config();
    __name(link, "link");
    __name(publicNotes, "publicNotes");
    __name(inFolder, "inFolder");
    __name(Sphere, "Sphere");
    __name(SectionTitle, "SectionTitle");
    __name(TopicList, "TopicList");
    __name(Home, "Home");
    SiteBehavior = /* @__PURE__ */ __name(() => null, "SiteBehavior");
    SiteBehavior.afterDOMLoaded = `
document.addEventListener("nav", () => {
  const media = window.matchMedia("(min-width: 1100px)")
  const update = () => document.querySelectorAll(".rail-disclosure").forEach(node => { node.open = media.matches })
  update()
  media.addEventListener("change", update)
  window.addCleanup(() => media.removeEventListener("change", update))
})
`;
    AwakenFrame = {
      name: "awaken",
      render({
        componentData: props,
        header,
        beforeBody,
        pageBody: Content,
        afterBody,
        left,
        right
      }) {
        const kind = props.fileData.frontmatter?.kind;
        const home = kind === "home";
        const hasHeading = props.tree.children?.some((node) => node.type === "element" && node.tagName === "h1");
        const current = String(props.fileData.slug ?? "index");
        return /* @__PURE__ */ jsxs8("div", { class: home ? "awaken-shell is-home" : "awaken-shell", children: [
          /* @__PURE__ */ jsx17("a", { class: "skip-link", href: "#main-content", children: "\u8DF3\u8F6C\u5230\u6B63\u6587" }),
          /* @__PURE__ */ jsxs8("header", { class: "site-topbar", children: [
            /* @__PURE__ */ jsxs8(
              "a",
              {
                class: "site-brand internal",
                href: link(props, "index.md"),
                "aria-label": "awaken \u9996\u9875",
                children: [
                  /* @__PURE__ */ jsx17("span", { class: "brand-mark", "aria-hidden": "true", children: "a" }),
                  "awaken",
                  /* @__PURE__ */ jsx17("span", { class: "brand-slash", "aria-hidden": "true", children: "/" })
                ]
              }
            ),
            /* @__PURE__ */ jsx17("nav", { class: "site-navigation", "aria-label": "\u4E3B\u8981\u5BFC\u822A", children: [
              ["index", "\u9996\u9875"],
              ["notes", "\u7B14\u8BB0"],
              ["topics", "\u4E13\u9898"],
              ["about", "\u5173\u4E8E"]
            ].map(([slug, label]) => /* @__PURE__ */ jsx17(
              "a",
              {
                class: "internal",
                href: link(props, `${slug}.md`),
                "aria-current": current === slug ? "page" : void 0,
                children: label
              }
            )) }),
            /* @__PURE__ */ jsx17("div", { class: "site-tools", children: header.map((Component) => /* @__PURE__ */ jsx17(Component, { ...props })) })
          ] }),
          home ? /* @__PURE__ */ jsx17(Home, { ...props }) : /* @__PURE__ */ jsxs8("div", { class: "reading-layout", children: [
            /* @__PURE__ */ jsx17("aside", { class: "site-rail site-rail-left", "aria-label": "\u7B14\u8BB0\u5206\u7C7B", children: /* @__PURE__ */ jsxs8("details", { class: "rail-disclosure", open: true, children: [
              /* @__PURE__ */ jsx17("summary", { children: "\u7B14\u8BB0\u76EE\u5F55" }),
              /* @__PURE__ */ jsx17("div", { class: "rail-content", children: left.map((Component) => /* @__PURE__ */ jsx17(Component, { ...props })) })
            ] }) }),
            /* @__PURE__ */ jsxs8("main", { class: "site-document", id: "main-content", children: [
              /* @__PURE__ */ jsx17("div", { class: "document-meta", children: beforeBody.map((Component) => /* @__PURE__ */ jsx17(Component, { ...props })) }),
              !hasHeading && /* @__PURE__ */ jsx17("h1", { class: "document-title", children: props.fileData.frontmatter?.title }),
              /* @__PURE__ */ jsx17(Content, { ...props }),
              kind === "topics" && /* @__PURE__ */ jsx17(TopicList, { ...props }),
              /* @__PURE__ */ jsx17("div", { class: "document-after", children: afterBody.map((Component) => /* @__PURE__ */ jsx17(Component, { ...props })) })
            ] }),
            /* @__PURE__ */ jsx17("aside", { class: "site-rail site-rail-right", "aria-label": "\u6587\u7AE0\u5BFC\u822A", children: /* @__PURE__ */ jsxs8("details", { class: "rail-disclosure", open: true, children: [
              /* @__PURE__ */ jsx17("summary", { children: "\u672C\u9875\u5BFC\u822A" }),
              /* @__PURE__ */ jsx17("div", { class: "rail-content", children: right.map((Component) => /* @__PURE__ */ jsx17(Component, { ...props })) })
            ] }) })
          ] }),
          /* @__PURE__ */ jsxs8("footer", { class: "site-footer", children: [
            /* @__PURE__ */ jsxs8("span", { children: [
              "awaken ",
              /* @__PURE__ */ jsx17("span", { class: "footer-separator", children: "/" }),
              " \u5018\u82E5\u91CD\u65B0\u7A7F\u8D8A\u65F6\u5149\u6CB3\u6D41"
            ] }),
            /* @__PURE__ */ jsxs8("a", { href: site_config_default.links.GitHub, target: "_blank", rel: "noopener noreferrer", children: [
              "GitHub ",
              /* @__PURE__ */ jsx17("span", { "aria-hidden": "true", children: "\u2197" })
            ] })
          ] })
        ] });
      }
    };
  }
});

// quartz.ts
var quartz_exports = {};
__export(quartz_exports, {
  default: () => quartz_default,
  layout: () => layout
});
var config, url, quartz_default, baseLayout, layout;
var init_quartz = __esm({
  async "quartz.ts"() {
    "use strict";
    init_config_loader();
    init_registry2();
    init_components2();
    init_site_config();
    frameRegistry.register("awaken", AwakenFrame, "awaken");
    config = await loadQuartzConfig();
    url = new URL(process.env.SITE_URL ?? site_config_default.url);
    config.configuration.baseUrl = `${url.host}${url.pathname.replace(/\/$/, "")}`;
    quartz_default = config;
    baseLayout = await loadQuartzLayout();
    layout = await loadQuartzLayout({
      defaults: {
        frame: "awaken",
        header: [...baseLayout.defaults.header ?? [], SiteBehavior]
      },
      byPageType: Object.fromEntries(
        ["content", "folder", "tag", "404"].map((name) => [
          name,
          { frame: "awaken" }
        ])
      )
    });
  }
});

// quartz/worker.ts
await init_quartz();
import sourceMapSupport from "source-map-support";

// quartz/processors/parse.ts
init_perf();
init_path();
init_permalinks();
import esbuild2 from "esbuild";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { unified as unified2 } from "unified";
import { read } from "to-vfile";
import path11 from "path";
import workerpool from "workerpool";

// quartz/util/log.ts
import truncate from "ansi-truncate";

// quartz/processors/parse.ts
init_trace();
init_pluginErrors();
function createMdProcessor(ctx) {
  const transformers = ctx.cfg.plugins.transformers;
  return unified2().use(remarkParse).use(
    transformers.flatMap(
      (plugin) => attributePluggables(plugin.markdownPlugins?.(ctx) ?? [], originOf(plugin), "markdown")
    )
  );
}
__name(createMdProcessor, "createMdProcessor");
function createHtmlProcessor(ctx) {
  const transformers = ctx.cfg.plugins.transformers;
  return unified2().use(remarkRehype, { allowDangerousHtml: true }).use(
    transformers.flatMap(
      (plugin) => attributePluggables(plugin.htmlPlugins?.(ctx) ?? [], originOf(plugin), "html")
    )
  );
}
__name(createHtmlProcessor, "createHtmlProcessor");
async function readContentFile(fp) {
  try {
    return await read(fp);
  } catch (err) {
    throw unreadableFileError(err, path11.basename(fp)) ?? err;
  }
}
__name(readContentFile, "readContentFile");
function createFileParser(ctx, fps) {
  const { argv, cfg } = ctx;
  return async (processor) => {
    const res = [];
    for (const fp of fps) {
      try {
        const perf = new PerfTimer();
        const file = await readContentFile(fp);
        file.value = file.value.toString().trim();
        for (const plugin of cfg.plugins.transformers.filter((p) => p.textTransform)) {
          try {
            file.value = plugin.textTransform(ctx, file.value.toString());
          } catch (err) {
            throw attributeError(err, {
              origin: originOf(plugin),
              stage: "textTransform",
              file: fp
            });
          }
        }
        file.data.filePath = file.path;
        file.data.relativePath = path11.posix.relative(argv.directory, file.path);
        file.data.slug = slugForFile(file.data.relativePath, ctx.permalinks);
        const ast = processor.parse(file);
        const newAst = await processor.run(ast, file);
        res.push([newAst, file]);
        if (argv.verbose) {
          console.log(`[markdown] ${fp} -> ${file.data.slug} (${perf.timeSince()})`);
        }
      } catch (err) {
        trace(`
Failed to process markdown \`${fp}\``, err);
      }
    }
    return res;
  };
}
__name(createFileParser, "createFileParser");
function createMarkdownParser(ctx, mdContent) {
  return async (processor) => {
    const res = [];
    for (const [ast, file] of mdContent) {
      try {
        const perf = new PerfTimer();
        const newAst = await processor.run(ast, file);
        res.push([newAst, file]);
        if (ctx.argv.verbose) {
          console.log(`[html] ${file.data.slug} (${perf.timeSince()})`);
        }
      } catch (err) {
        trace(`
Failed to process html \`${file.data.filePath}\``, err);
      }
    }
    return res;
  };
}
__name(createMarkdownParser, "createMarkdownParser");

// quartz/util/sourcemap.ts
import fs10 from "fs";
import { fileURLToPath as fileURLToPath2 } from "url";
var options2 = {
  // source map hack to get around query param
  // import cache busting
  retrieveSourceMap(source) {
    if (source.includes(".quartz-cache")) {
      let realSource = fileURLToPath2(source.split("?", 2)[0] + ".map");
      return {
        map: fs10.readFileSync(realSource, "utf8")
      };
    } else {
      return null;
    }
  }
};

// quartz/worker.ts
sourceMapSupport.install(options2);
async function parseMarkdown(partialCtx, fps) {
  const ctx = {
    ...partialCtx,
    cfg: quartz_default
  };
  return await createFileParser(ctx, fps)(createMdProcessor(ctx));
}
__name(parseMarkdown, "parseMarkdown");
function processHtml(partialCtx, mds) {
  const ctx = {
    ...partialCtx,
    cfg: quartz_default
  };
  return createMarkdownParser(ctx, mds)(createHtmlProcessor(ctx));
}
__name(processHtml, "processHtml");
export {
  parseMarkdown,
  processHtml
};
//# sourceMappingURL=transpiled-worker.mjs.map
