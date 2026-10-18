#!/usr/bin/env node
/**
 * 可爱大肥鱼桌宠 · lib/ 构建 + 复现校验
 * ===========================================================================
 * src\src\**\*.ts 用 tsdown（配置见 ..\tsdown.config.ts）打成两个 bundle：
 *   src/host/index.ts   → index.js   （宿主半侧）
 *   src/client/index.ts → client.js  （浏览器半侧）
 *
 * 三件在别处看不出来的事，这里说清：
 *
 * 1) 为什么先拷一份 LF 源码副本再构建。
 *    签入的 lib\*.js 是 LF 字节（`git cat-file -s src/lib/client.js` = 137974）。仓库的
 *    .gitattributes 现在把 `/src/src/**` 与 `/src/lib/**` 都钉成 `text eol=lf`，所以正常检出
 *    本来就是 LF；但本机 core.autocrlf=true 的环境中，别人若拿到一份旧检出（或没走
 *    .gitattributes 的打包副本），源码会是 CRLF，而 rolldown 对 CRLF 里的块注释会多吐空行
 *    —— 同一份源码会构建出不同字节。这里把 src\src 拷到临时目录并统一成 LF，等于把
 *    「源码行尾」这个自变量彻底消掉，任何平台构建出的产物都应当与签入版逐字节一致
 *    （校验时把目标文件的行尾归一后再比；写回时反过来，跟随目标文件当前的行尾，
 *    免得把工作区改成「内容一样但 git status 报 M」）。
 *
 * 2) 为什么 lib\client.js 要再套一层 IIFE 外壳。
 *    DSH 宿主把每个插件 bundle 拼成同一个 classic script，顶层的 const/let
 *    会和别的插件撞名。tsdown 只管出原始 bundle，外壳在这里补（banner/footer
 *    没法只作用于其中一个 entry，所以在脚本里做）。
 *
 * 3) 为什么不重建 lib\index.js。
 *    它不只是 TS 的构建产物：上面还压着 21 条「本地补丁」（全局大脑开关、
 *    对话上下文注入、/say 与 /quip 路由、屏幕监测那几组……）。这些补丁**只存在于
 *    lib\index.js 里**，src\src\host\*.ts 里没有（那几处 TS 的差异是隐私与测试口径）
 *    （见 docs\differences-from-upstream.md：lib/index.js 是 18 个有差异的文件之一）。
 *    拿 TS 的构建结果覆盖它 = 把这些功能删掉，所以这里只报告差异，绝不写它。
 *
 * 用法：
 *   node scripts/build-lib.mjs            重建 lib/client.js（写回）；host 侧只报告差异
 *   node scripts/build-lib.mjs --check    只校验、不写任何文件（交付前 / CI 跑这个）
 *
 * 退出码：0 = 成功（检查模式下要求 client.js 逐字节一致）；1 = 复现失败；2 = 环境缺工具。
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."); // src\
const ROOT = path.dirname(SRC); // 仓库根
const SCRATCH = path.join(ROOT, "_libraw"); // 临时构建目录（仓库根 _* 已在 .gitignore）
const OUT = path.join(SCRATCH, "out");
const CHECK_ONLY = process.argv.includes("--check");

const CLIENT_BANNER = [
	"// The DSH host concatenates every plugin bundle into ONE classic script",
	'// (dsh-client-modules buildComboScript: source += <bundle> + ";\\n"), so any',
	"// top-level const/let/class here would collide with another plugin's bundle",
	'// ("SyntaxError: Identifier \'css\' has already been declared" aborts the whole',
	"// batch).  Everything, including the __ModuleLoader__ registration below, lives",
	"// inside this IIFE.  Keep it wrapped when rebuilding.",
	";(() => {"
].join("\n");

const toLF = (buf) => Buffer.from(buf.toString("utf8").replace(/\r\n/g, "\n"), "utf8");

/**
 * 写回时要跟随目标文件**当前**的行尾，否则会把工作区弄脏。
 * 本机 core.autocrlf=true：签入的是 LF，检出到工作区是 CRLF，写成 LF 会让
 * `git status` 报 ` M src/lib/client.js`（内容其实一样）。所以先看目标是什么
 * 行尾，比较和写入都用同一种，检出/未检出都保持 `git status` 干净。
 */
const eolOf = (buf) => (buf.includes(0x0d) ? "\r\n" : "\n"); // 0x0d = \r
const toCRLF = (lfBuf) => Buffer.from(lfBuf.toString("utf8").replace(/\n/g, "\r\n"), "utf8");
const emit = (lfBuf, eol) => (eol === "\r\n" ? toCRLF(lfBuf) : lfBuf);

/** 找 tsdown（npm workspaces 把它装在仓库根，src\node_modules 是不入库的运行期依赖） */
function tsdownBin() {
	for (const p of [path.join(ROOT, "node_modules", "tsdown", "bin", "tsdown.js"), path.join(SRC, "node_modules", "tsdown", "bin", "tsdown.js")]) {
		if (fs.existsSync(p)) return p;
	}
	return null;
}

/** 把源码（统一 LF）拷进临时构建目录；顺带把 tsdown.config.ts 也拷过去 */
function prepareScratch() {
	fs.rmSync(SCRATCH, { recursive: true, force: true });
	const copy = (from, to) => {
		fs.mkdirSync(to, { recursive: true });
		for (const e of fs.readdirSync(from, { withFileTypes: true })) {
			const p = path.join(from, e.name);
			const q = path.join(to, e.name);
			if (e.isDirectory()) copy(p, q);
			else fs.writeFileSync(q, toLF(fs.readFileSync(p)));
		}
	};
	copy(path.join(SRC, "src"), path.join(SCRATCH, "src"));
	fs.copyFileSync(path.join(SRC, "package.json"), path.join(SCRATCH, "package.json"));
	fs.copyFileSync(path.join(SRC, "tsdown.config.ts"), path.join(SCRATCH, "tsdown.config.ts"));
}

/** 浏览器半侧的外壳：原始 bundle 前面加 banner、后面补收尾，行尾一律 LF */
function wrapClient(raw) {
	const body = raw.toString("utf8").replace(/^\n/, ""); // 原始 bundle 开头多一个空行
	return toLF(Buffer.from(`${CLIENT_BANNER}\n${body}\n})();\n`, "utf8"));
}

/** 数一下两份文件差几处（用 git 的 diff，不引依赖） */
function hunks(aFile, bFile) {
	const r = spawnSync("git", ["diff", "--no-index", "--unified=3", "--", aFile, bFile], { encoding: "utf8" });
	if (r.error || typeof r.stdout !== "string") return -1;
	return (r.stdout.match(/^@@/gm) || []).length;
}

const bin = tsdownBin();
if (!bin) {
	console.error("✗ 找不到 tsdown。请在仓库根跑一次 `npm install`（workspaces 会把它装到根 node_modules）。");
	process.exit(2);
}

console.log(`可爱大肥鱼桌宠 · 构建 lib/  ${CHECK_ONLY ? "(只校验，不写文件)" : ""}`);
console.log(`  源码   : ${SRC}`);
console.log(`  临时树 : ${SCRATCH}（LF 归一后的副本，构建在这里发生）`);
prepareScratch();

const build = spawnSync(process.execPath, [bin], { cwd: SCRATCH, encoding: "utf8" });
if (build.status !== 0) {
	console.error("✗ tsdown 构建失败：");
	console.error(build.stdout || "");
	console.error(build.stderr || "");
	process.exit(1);
}
console.log("  tsdown : 构建完成");

let failed = false;

// ---- 浏览器半侧：client.js 是可靠的，可以逐字节复现 ----
const target = path.join(SRC, "lib", "client.js");
const builtLf = wrapClient(fs.readFileSync(path.join(OUT, "client.js")));
const targetRaw = fs.readFileSync(target);
const targetEol = eolOf(targetRaw);
const current = toLF(targetRaw); // 归一后的字节数 = 签入 blob 的字节数
const built = emit(builtLf, targetEol); // 比较与写回都用目标当前的行尾
const same = Buffer.compare(built, targetRaw) === 0;
console.log("");
console.log(`[client.js] 构建 ${current.length} B / 签入 ${current.length} B → ${same ? "逐字节一致 ✓" : "不一致 ✗"}  （行尾 ${targetEol === "\r\n" ? "CRLF（本机检出）" : "LF"}）`);
if (!same) {
	const wrapped = path.join(SCRATCH, "client.wrapped.js");
	fs.writeFileSync(wrapped, built);
	const n = hunks(wrapped, target);
	console.log(`           差异 ${n < 0 ? "?" : n} 处（用 git diff --no-index "${wrapped}" "${target}" 看详情）`);
	if (CHECK_ONLY) failed = true;
	else {
		fs.writeFileSync(target, built);
		console.log(`           已写回 ${path.relative(ROOT, target)}（保持目标原有行尾，git status 应无变化）`);
	}
}

// ---- 宿主半侧：index.js 只报告差异，不覆盖 ----
const hostTarget = path.join(SRC, "lib", "index.js");
const hostBuilt = toLF(fs.readFileSync(path.join(OUT, "index.js")));
const hostCurrent = toLF(fs.readFileSync(hostTarget));
const hostSame = Buffer.compare(hostBuilt, hostCurrent) === 0;
console.log("");
console.log(`[index.js]  TS 构建 ${hostBuilt.length} B / 签入 ${hostCurrent.length} B → ${hostSame ? "一致 ✓" : "有差异（本地补丁）"}`);
if (!hostSame) {
	// 两边都归一成 LF 再比，否则行尾差异会混进 hunk 计数里
	const hostCurrentLf = path.join(SCRATCH, "index.signin.js");
	fs.writeFileSync(hostCurrentLf, hostCurrent);
	const n = hunks(path.join(OUT, "index.js"), hostCurrentLf);
	console.log(`           差 ${n < 0 ? "?" : n} 处 —— 这些就是只写在 lib\\index.js 里的本地补丁。`);
	console.log("           宿主半侧请**继续就地改 lib\\index.js**，不要用 TS 覆盖（会把补丁一起删掉）。");
	console.log(`           看详情：git diff --no-index "${path.join(OUT, "index.js")}" "${hostCurrentLf}"`);
}

console.log("");
if (failed) {
	console.log("✗ client.js 无法由 TS 复现 —— 源码与签入产物已经对不上，先查 src\\src\\client。");
	process.exit(1);
}
console.log(CHECK_ONLY ? "✓ 校验结束（未写任何文件）" : "✓ 完成。");
console.log("  临时目录 _libraw\\ 可以随时删（仓库根的 /_*/ 已在 .gitignore）。");
