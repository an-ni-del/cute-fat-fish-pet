"use strict";
// 说明（1.1.0 独立仓库）：本文件**就是成品源码**，不再由「蓝本 + 生成脚本」产出——
// 老版本那套覆盖层（build\mk-rec-overlay.mjs）连同 overlay\、patch-app.mjs 一起取消了。
// 下面两点当年是「发布版改动」，现在就是本文件的本体行为：
//  ① 配置放在「每用户数据根」，不写进可能只读的程序目录；
//  ② petRoute() 读数据根里的 runtime.json，找不到运行中的实例就报「没在跑」，
//     不再回落到 3080（那是同一台机器上另一只桌宠常坐的端口）。
// 打开东西 / 让她说话 —— 控制台和 AI agent 共用的底层实现。
// （录屏功能已于 1.2.2 移除：起停委托外部软件的路子只对 OBS 成立，性价比不够，
//   连带 obs-ctl.js、右键菜单录屏项和 AI agent 的录屏工具一起下线了。）
//
// 一、打开软件 / 文件 / 网页：交给 Electron 的 shell，纯本地动作，不经过桌宠、不走 shell。
//     浏览器偏好和默认搜索引擎写在 <数据根>\dsh-pet\record.json 里（文件名沿用录屏时代的，
//     现在只存 browser / search 两项）。
//
// 二、permission 闸门：桌宠渲染进程里的 dsh-pet-perm-main（app / file / url 三个开关）说了算。
//     这是「她能不能动你的电脑」的唯一真相来源，控制台只读不改，AI 也无权打开它。

const fs = require("node:fs");
const path = require("node:path");
const { spawn } = require("node:child_process");

const petApi = require("./pet-api");

const HERE = __dirname;
const REPO = path.resolve(HERE, "..");
// 配置跟着「每用户数据根」走（%APPDATA%\BlueHairMaid，或 portable.txt /
// data-root.txt / DSH_PET_DATA_DIR 指定的地方），不写进程序目录：装到 Program Files
// 这类只读目录时，主人的偏好会保存失败。
const PATHS = require("./paths").resolvePaths(HERE);
const DATA_ROOT = PATHS.dataRoot;
// 运行器写的 runtime.json 在**数据根**里（standalone/main.mjs 的 RUNTIME_FILE）。
const RUNTIME_FILE = path.join(PATHS.userRoot, "runtime.json");
const PREFS_FILE = path.join(DATA_ROOT, "record.json");

function readJson(file) {
	try {
		return JSON.parse(fs.readFileSync(file, "utf8"));
	} catch {
		return null;
	}
}

function writeJson(file, obj) {
	fs.mkdirSync(path.dirname(file), { recursive: true });
	const tmp = `${file}.tmp`;
	fs.writeFileSync(tmp, `${JSON.stringify(obj, null, 2)}\n`, "utf8");
	fs.copyFileSync(tmp, file);
	fs.rmSync(tmp, { force: true });
}

// ---------------------------------------------------------------------------
// 配置（浏览器 / 搜索引擎偏好；文件名沿用录屏时代的 record.json）
// ---------------------------------------------------------------------------
function readPrefs() {
	const raw = readJson(PREFS_FILE) || {};
	return {
		browser: String(raw.browser || ""),
		search: raw.search === "baidu" ? "baidu" : "bing",
		updatedAt: Number(raw.updatedAt) || 0,
	};
}

function writePrefs(patch) {
	const cur = readPrefs();
	const p = patch && typeof patch === "object" ? patch : {};
	const next = {
		browser: p.browser === undefined ? cur.browser : String(p.browser || ""),
		search: p.search === undefined ? cur.search : p.search === "baidu" ? "baidu" : "bing",
		updatedAt: Date.now(),
	};
	writeJson(PREFS_FILE, next);
	return { ok: true, record: next, file: PREFS_FILE };
}

// ---------------------------------------------------------------------------
// 一、打开软件 / 文件 / 网页
// ---------------------------------------------------------------------------
const PATH_ALIAS = {
	edge: ["C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe", "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe"],
	chrome: ["C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe"],
	"谷歌浏览器": ["C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe"],
	"微软浏览器": ["C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe"],
	notepad: ["C:\\Windows\\System32\\notepad.exe"],
	"记事本": ["C:\\Windows\\System32\\notepad.exe"],
	calc: ["C:\\Windows\\System32\\calc.exe"],
	"计算器": ["C:\\Windows\\System32\\calc.exe"],
	"画图": ["C:\\Windows\\System32\\mspaint.exe"],
	mspaint: ["C:\\Windows\\System32\\mspaint.exe"],
	explorer: ["C:\\Windows\\explorer.exe"],
	"资源管理器": ["C:\\Windows\\explorer.exe"],
	"文件管理器": ["C:\\Windows\\explorer.exe"],
	taskmgr: ["C:\\Windows\\System32\\Taskmgr.exe"],
	"任务管理器": ["C:\\Windows\\System32\\Taskmgr.exe"],
	cmd: ["C:\\Windows\\System32\\cmd.exe"],
};

function exists(p) {
	try {
		return !!p && fs.existsSync(p);
	} catch {
		return false;
	}
}

function findBrowserExe(which) {
	const q = String(which || "").toLowerCase().trim();
	if (!q || q === "default" || q === "默认" || q === "系统默认") return "";
	const keys = Object.keys(PATH_ALIAS).filter((k) => k.toLowerCase().includes(q) || q.includes(k.toLowerCase()));
	for (const k of keys) for (const p of PATH_ALIAS[k]) if (exists(p)) return p;
	return "";
}

/** 找软件：先按字面路径，再按别名，再在开始菜单里模糊匹配。 */
function findApp(name) {
	const q = String(name || "").trim();
	if (!q) return null;
	if (exists(q)) return { name: path.basename(q), path: q };
	const ql = q.toLowerCase();
	const alias = PATH_ALIAS[ql] || [];
	for (const p of alias) if (exists(p)) return { name: q, path: p };
	const apps = petApi.listApps(2000).apps || [];
	const hit =
		apps.find((a) => a.name.toLowerCase() === ql) ||
		apps.find((a) => a.name.toLowerCase().includes(ql)) ||
		apps.find((a) => ql.length >= 2 && ql.includes(a.name.toLowerCase()));
	if (hit) return { name: hit.name, path: hit.path };
	const near = apps.filter((a) => a.name.toLowerCase().includes(ql.slice(0, 2))).slice(0, 8).map((a) => a.name);
	return { missing: true, near };
}

async function openApp(name) {
	const { shell } = require("electron");
	const hit = findApp(name);
	if (!hit) return { ok: false, reason: "empty", message: "没给软件名" };
	if (hit.missing) {
		return {
			ok: false,
			reason: "not-found",
			message: `开始菜单里没找到「${name}」${hit.near.length ? "，是不是： " + hit.near.join(" / ") : ""}`,
		};
	}
	const err = await shell.openPath(hit.path);
	return err ? { ok: false, reason: "open-failed", message: err } : { ok: true, opened: hit.path, name: hit.name };
}

/** 打开网址：主人指定的浏览器优先，否则用系统默认。只认 http/https。 */
async function openUrl(url, opts = {}) {
	const { shell } = require("electron");
	let u = String(url || "").trim();
	if (!u) return { ok: false, reason: "empty", message: "没给网址" };
	if (!/^[a-z]+:\/\//i.test(u)) u = `https://${u}`;
	if (!/^https?:\/\//i.test(u)) return { ok: false, reason: "bad-url", message: "只认 http/https" };
	const want = String(opts.browser || readPrefs().browser || "").trim();
	const exe = findBrowserExe(want);
	if (exe) {
		try {
			const child = spawn(exe, [u], { detached: true, stdio: "ignore", shell: false });
			child.unref();
			return { ok: true, opened: u, browser: path.basename(exe) };
		} catch {
			/* 起不来就退回系统默认 */
		}
	}
	await shell.openExternal(u);
	return { ok: true, opened: u, browser: "系统默认" };
}

/** 浏览器里搜一下（不直接猜网址时用；B站这种有短路表）。 */
async function searchWeb(query, opts = {}) {
	const q = String(query || "").trim();
	if (!q) return { ok: false, reason: "empty", message: "没给要搜的词" };
	const engine = (opts.search || readPrefs().search) === "baidu" ? "baidu" : "bing";
	const url =
		engine === "baidu"
			? `https://www.baidu.com/s?wd=${encodeURIComponent(q)}`
			: `https://www.bing.com/search?q=${encodeURIComponent(q)}`;
	const r = await openUrl(url, opts);
	return Object.assign({ engine, query: q }, r);
}

// ---------------------------------------------------------------------------
// 二、让她说话 + 记一笔「她最近做了什么」
// ---------------------------------------------------------------------------
/** pid 还活着吗（EPERM 也算活着，说明进程在、只是没权限发信号）。 */
function pidAlive(pid) {
	if (!Number.isInteger(pid) || pid <= 0) return false;
	try {
		process.kill(pid, 0);
		return true;
	} catch (e) {
		return !!(e && e.code === "EPERM");
	}
}

/** 她这会儿在本机哪个端口（读数据根里的 runtime.json），**不回落到 3080**。 */
function petRoute() {
	// 以前这里读 <repo>\standalone\runtime.json —— 运行器根本不写那儿，
	// 于是永远回落到 3080：同一台机器上 3080 常常坐着另一只桌宠，控制台的「让她说这句话」
	// 和 AI agent 的每一步（/quip）就会打到别人家的桌宠上。找不到运行中的实例就返回
	// port:0，调用方会当成「桌宠没在跑」。
	const rt = readJson(RUNTIME_FILE);
	const port = rt && Number(rt.port);
	if (!port || !pidAlive(Number(rt.pid))) return { port: 0, route: "/dsh-pet-7340", running: false };
	return { port, route: "/dsh-pet-7340", running: true };
}

/** 直接让她把这句话说出来（宿主 POST /say → 渲染端冒泡 + TTS），不走模型、不改她的记忆。 */
async function say(text, timeoutMs = 8000) {
	const t = String(text || "").trim();
	if (!t) return { ok: false, reason: "empty", message: "没给要说的话" };
	const { port, route, running } = petRoute();
	if (!running) return { ok: false, reason: "pet-offline", message: "桌宠没在跑 —— 先点「启动桌宠」" };
	try {
		const res = await fetch(`http://127.0.0.1:${port}${route}/say`, {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ text: t.slice(0, 500) }),
			signal: AbortSignal.timeout(timeoutMs),
		});
		const obj = await res.json().catch(() => null);
		return obj && obj.ok ? { ok: true, said: t.slice(0, 120) } : { ok: false, reason: "say-failed", message: (obj && obj.message) || `HTTP ${res.status}` };
	} catch (e) {
		return { ok: false, reason: "pet-offline", message: `桌宠没在跑（${(e && e.message) || e}）` };
	}
}

/** 她自己的「最近做了什么」日志（渲染端 localStorage 的 perm.log）——外部动作也记进去，主人在控制台看得到。 */
async function appendPermLog(text) {
	const t = String(text || "").trim();
	if (!t) return { ok: false };
	try {
		const st = await petApi.controlState("main");
		if (!st || !st.ok) return { ok: false, reason: (st && st.error) || "no-control-bridge" };
		const perm = (st.data && st.data.perm) || {};
		const p = perm.perm && typeof perm.perm === "object" ? perm.perm : { app: false, file: false, url: false };
		const log = Array.isArray(perm.log) ? perm.log.slice(-19) : [];
		log.push({ t: Date.now(), text: t.slice(0, 120) });
		const r = await petApi.controlPatch("perm", { perm: p, log }, { reload: false });
		return { ok: !!(r && r.ok), count: log.length };
	} catch (e) {
		return { ok: false, reason: String((e && e.message) || e) };
	}
}

/** 读她的三个权限开关（唯一真相来源）。 */
async function readPerm() {
	try {
		const st = await petApi.controlState("main");
		if (!st || !st.ok) return { ok: false, reason: (st && st.error) || "no-control-bridge", perm: null };
		const perm = (st.data && st.data.perm) || {};
		const p = perm.perm && typeof perm.perm === "object" ? perm.perm : {};
		return { ok: true, perm: { app: p.app === true, file: p.file === true, url: p.url === true } };
	} catch (e) {
		return { ok: false, reason: String((e && e.message) || e), perm: null };
	}
}

module.exports = {
	REPO,
	DATA_ROOT,
	PREFS_FILE,
	readPrefs,
	writePrefs,
	findApp,
	findBrowserExe,
	openApp,
	openUrl,
	searchWeb,
	say,
	appendPermLog,
	readPerm,
	petRoute,
};
