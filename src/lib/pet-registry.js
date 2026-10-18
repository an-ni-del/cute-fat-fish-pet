/**
 * 桌宠注册表（host 半侧）——「现在有哪几只宠物 / 现在在跟哪一只交互 / 哪几只该显示到桌面」
 * 的唯一出处。纯逻辑，零依赖：只认注入进来的 readPets / isDesktopVisible 两个函数。
 *
 * 为什么单独一个模块（与 runtime\electron-helper\pointer-target.js 同一个理由）：
 *   lib\index.js 是 Cordis 插件入口，顶层 import 了 @deepseek-ai/* —— 单测里 import 它必然
 *   ERR_MODULE_NOT_FOUND；把「读配置 → 校验 → 回退」这条规则拎到这里，就能用 node:test 直接测。
 *   本文件是手写源码（不是构建产物），与 lib\index.js 同目录、同性质、随包发布。
 *
 * 它替掉的是原来散在 lib\index.js 里的三个函数：
 *   - resolveActivePetId()：每次调用重读配置 + 校验 + 回退，失败静默吞错（catch 里返回上一次的值）；
 *   - refreshDesktop()：又读一遍配置算「桌面有没有宠物」，结果存在 apply() 闭包的变量里；
 *   - desktopPetList()：再读一遍算出 Helper 要的那张 [{id,size}] 表。
 *   同一时刻三个功能各算各的，且 activePetId 是闭包里的可变变量——外部注入不了、测试换不掉、
 *   也没有谁是这份状态的主人。现在「id 失效就回退第一只」这条规则只在 active() 里写一次。
 *
 * 刻意**不缓存**宠物列表：配置在运行期可被改写（保存后由 syncDesktop() 触发重算），
 * 旧实现每次调用都读盘，这里逐字保留同一时序，只把「谁负责读」收了回来。
 */

/**
 * 造一个注册表。每个 apply() 实例造一个（宠物状态是进程级、随宿主一起生灭的）。
 *
 * @param {object} options
 * @param {() => Array<{id: unknown, name?: unknown, size?: unknown, display?: unknown}>} options.readPets
 *   读「当前生效宠物列表」的成品（合并器已填满默认值、id 唯一）；可能抛错（配置非法）。
 * @param {(display: unknown) => boolean} options.isDesktopVisible 判定某只宠物的 display 是否该显示到桌面。
 * @param {(message: string) => void} [options.onWarn] 配置非法时的告警出口（旧实现的 ctx.logger?.warn）。
 * @returns {{
 *   list: () => Array<object>,
 *   active: () => string,
 *   setActive: (id: unknown) => string,
 *   refresh: () => boolean,
 *   hasDesktop: () => boolean,
 *   desktopList: () => Array<{id: string, size: number}>
 * }}
 */
export function createPetRegistry({ readPets, isDesktopVisible, onWarn }) {
	/** 当前交互桌宠 id（进程内，重启回默认）。只为 setActive() 与 active() 而存在 */
	let activeId = "";
	/** 「桌面可见宠物是否存在」的缓存值 —— refresh() 算，launchHelper 直接问 hasDesktop() */
	let hasDesktop = false;

	/**
	 * 读一次列表，把「读失败」与「读到空」分开交回调用方：
	 * 这两件事在各方法里的处理并不一样（active() 要保住上一次的选择，其余按空列表处理）。
	 */
	const read = () => {
		try {
			return {
				ok: true,
				pets: readPets() ?? []
			};
		} catch (error) {
			return {
				ok: false,
				error
			};
		}
	};

	/** 当前生效宠物列表（命令与桌面模式都从这里取）；配置读不出来 → 空列表 */
	const list = () => {
		const r = read();
		return r.ok ? r.pets : [];
	};

	/**
	* 当前交互桌宠 id：已选且仍存在 → 该宠物；未选 / 已失效 → 列表第一只；一只都没有 → ""。
	* 配置读不出来时保持上一次的选择（旧 resolveActivePetId 的 catch 分支，逐字保留）。
	*/
	const active = () => {
		const r = read();
		if (!r.ok) return activeId;
		const eff = r.pets;
		if (eff.length === 0) return "";
		if (activeId && eff.some((p) => String(p.id) === activeId)) return activeId;
		return String(eff[0].id);
	};

	/** 选定交互桌宠（/pet 命令用）；不校验存在性——失效由 active() 兜底回退 */
	const setActive = (id) => {
		activeId = String(id ?? "");
		return activeId;
	};

	/** 重算「桌面有没有宠物」；配置非法 → 当作没有 + 告警一次（旧 refreshDesktop 的语义） */
	const refresh = () => {
		hasDesktop = false;
		try {
			const r = read();
			if (!r.ok) throw r.error;
			hasDesktop = r.pets.some((p) => isDesktopVisible(p.display));
		} catch (error) {
			onWarn?.(`[dsh-pet] 宠物配置非法，桌面模式已跳过：${error instanceof Error ? error.message : String(error)}`);
		}
		return hasDesktop;
	};

	/** 桌面可见宠物列表（[{id,size}]）：透传 Helper 决定创建几个局部窗口（每宠物一个） */
	const desktopList = () => {
		try {
			const r = read();
			if (!r.ok) throw r.error;
			return r.pets.filter((p) => isDesktopVisible(p.display)).map((p) => ({
				id: String(p.id),
				size: Number(p.size)
			}));
		} catch {
			return [];
		}
	};

	refresh();

	return {
		list,
		active,
		setActive,
		refresh,
		hasDesktop: () => hasDesktop,
		desktopList
	};
}
