/**
 * lib/ 的构建配置：src\src\**\*.ts → 两个 bundle
 *   src\host\index.ts   → index.js   （宿主半侧，Cordis 插件入口 apply/inject/name）
 *   src\client\index.ts → client.js  （浏览器半侧，加载时 __ModuleLoader__.load）
 *
 * 别在 src\ 里直接跑这个配置：`outDir: "out"` 是给临时构建目录用的（见下），
 * 产物是**未加工的原始 bundle**，而签入的 lib\client.js 还要套一层 IIFE 外壳、
 * lib\index.js 上面还压着 21 条只在 JS 里的本地补丁。构建与校验一律走
 * scripts\build-lib.mjs（它会把本文件连同源码拷成 LF 副本再构建）。
 *
 * 为什么要拷副本：签入的 lib\ 是在 LF 行尾的检出上构建的；Windows 检出按
 * .gitattributes 的 `* text=auto` 是 CRLF，而 rolldown 处理 CRLF 里的块注释会
 * 多吐空行 —— 同一份源码会构建出不同字节。拷成 LF 才能在任何平台复现同一份产物。
 */
export default {
	entry: {
		index: "src/host/index.ts",
		client: "src/client/index.ts"
	},
	outDir: "out",
	format: "esm",
	dts: false,
	sourcemap: false,
	clean: true,
	// 宿主半侧与浏览器半侧各自独立成包（仓库里没有共享 chunk 文件）
	splitting: false
};
