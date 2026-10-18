/**
 * 「无人互动」信号的宿主侧纯逻辑（[local patch idle-gate@1]）。
 *
 * 为什么单独一个文件：lib/index.js 顶层 import 了 @deepseek-ai/*，单测没法 import 它；
 * 而「距上一次键鼠输入已经过去多久」这件事既不重不漏、又要能单测，所以照 lib/pet-registry.js
 * 的做法把纯逻辑拆出来。信号源是桌面助手 stdout 的 idle 通知
 * （runtime/electron-helper/main.js 的同名补丁，底层是 Electron powerMonitor.getSystemIdleTime()）。
 *
 * 语义要点：
 *   - 通知里带的是「助手那一刻测到的系统空闲秒数」，所以本模块记下**到达时刻 + 那一刻的空闲秒数**，
 *     之后自己往上加时间 ⇒ 不需要助手不停地报；助手的周期上报（30s 一次）只用来防止
 *     「连续动鼠标 10 分钟」被误算成没人（见助手侧注释）。
 *   - 从来没有收到过通知时 idleMs() 返回 null（没助手 / 纯浏览器模式）——调用方必须把它
 *     当「不启用这道闸」，绝不拿陈旧值去停监测。
 */
export function createIdleSignal(now = Date.now) {
	let last = null;
	return {
		/** 记一条助手通知；idleSec = 系统键鼠已空闲秒数（0 = 刚刚有输入）。非法值按 0 处理 */
		note(idleSec) {
			const sec = Number(idleSec);
			last = { at: now(), idleSec: Number.isFinite(sec) && sec > 0 ? sec : 0 };
		},
		/** 当前估计的空闲毫秒；null = 没有任何信号 */
		idleMs() {
			return last === null ? null : Math.max(0, now() - last.at) + last.idleSec * 1000;
		},
		/** 助手停掉/换新时清信号：清掉之后调用方会退回「不启用这道闸」 */
		clear() {
			last = null;
		},
	};
}
