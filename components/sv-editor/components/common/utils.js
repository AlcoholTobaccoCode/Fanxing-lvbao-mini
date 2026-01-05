/**
 * 通用工具api
 * @author sonve
 * @version 1.0.0
 * @date 2024-12-04
 */

import store from "./store.js";

/**
 * 添加图片
 * @param {Function} uploadFunc 文件上传函数（开发者自行调用上传接口上传本地图片至服务器后获取服务器图片真实地址，需要return包含地址的数组）
 * @param {Object} options 图片配置项
 * @property {String} options.srcFiled 图片地址字段名，默认无时使用数组元素本身
 * @property {String} options.alt 图像无法显示时的替代文本
 * @property {String} options.width 图片宽度（pixels/百分比）为空时自适应图片本身宽度，默认空（不建议100%，预留一点空隙以便用户编辑）
 * @property {String} options.height 图片高度 (pixels/百分比）为空时自适应图片本身高度，默认空
 * @property {String} options.extClass 添加到图片 img 标签上的类名
 * @property {String} options.data 被序列化为 v1=1;v2=2 的格式挂在属性 data-custom 上
 * @returns {Array|Promise} 上传的文件数组
 */
export async function addImage(uploadFunc, options = {}) {
	const eid = store.actions.getEID();
	const editorCtx = store.actions.getEditor(eid);

	// 服务器上传图片
	if (!uploadFunc) return;
	const upRes = await uploadFunc(editorCtx);
	if (!upRes || !upRes?.length) return;

	// 取消键盘副作用
	noKeyboardEffect(() => {
		editorCtx.insertText({ text: "\n" });
		upRes?.forEach((item) => {
			editorCtx.insertImage({
				...options,
				src: options.srcFiled ? item[options.srcFiled] : item
			});
		});
		// 建议加个换行，虽然会导致input回调再次触发，不过问题不大
		editorCtx.insertText({ text: "\n" });
	});

	return upRes;
}

/**
 * 添加视频
 * @description uni-editor暂不支持插入视频，此处使用视频封面占位，将视频地址作为属性挂在至data-custom上，携带视频的富文本需要使用专用的api进行解析导出。注：建议后端配合返回视频封面图片地址，或者使用固定的网络图片作为封面。
 * @param {Function} uploadFunc 文件上传函数（开发者自行调用上传接口上传本地视频至服务器后获取服务器视频真实地址，需要return包含地址的数组）
 * @param {Object} options 视频封面图片配置项
 * @property {String} options.imageFiled 视频封面图片地址字段名，默认imagePath
 * @property {String} options.videoFiled 视频真实地址字段名，默认videoPath
 * @property {String} options.alt 视频封面图片无法显示时的替代文本
 * @property {String} options.width 视频封面图片宽度（pixels/百分比）默认空，但是要注意，不设置width的话，video标签默认宽度为300px
 * @property {String} options.height 视频封面图片高度 (pixels/百分比）默认空
 * @property {String} options.extClass 添加到视频封面图片 img 标签上的类名
 * @property {String} options.data 警告：视频地址已存入data-custom中，请勿使用此参数导致视频地址被覆盖
 * @returns {Array|Promise} 上传的文件数组
 */
export async function addVideo(uploadFunc, options = {}) {
	const eid = store.actions.getEID();
	const editorCtx = store.actions.getEditor(eid);

	// 服务器上传视频
	if (!uploadFunc) return;
	const upRes = await uploadFunc(editorCtx);
	console.log(upRes);
	if (!upRes || !upRes?.length) return;

	// 取消键盘副作用
	noKeyboardEffect(() => {
		editorCtx.insertText({ text: "\n" });
		upRes?.forEach((item) => {
			editorCtx.insertImage({
				...options,
				src: item[options.imageFiled || "imagePath"],
				data: { url: item[options.videoFiled || "videoPath"] }
			});
		});
		// 建议加个换行，虽然会导致input回调再次触发，不过问题不大
		editorCtx.insertText({ text: "\n" });
	});

	return upRes;
}

/**
 * 添加链接
 * @param {Object} options 链接配置项
 * @property {String} options.link 链接地址
 * @property {String} options.text 链接文本 空缺时使用link
 * @property {String} options.textDecoration 下划线
 * @property {String} options.color 颜色 默认#007aff
 * @property {Object} options.style 其他样式，例如 { bold: true, italic: true } 等，详见：https://quilljs.com/docs/delta
 * @param {Function} callback 添加链接成功后回调
 * @returns {void}
 */
export async function addLink(options = {}, callback) {
	const eid = store.actions.getEID();
	const editorCtx = store.actions.getEditor(eid);

	// 取消键盘副作用
	noKeyboardEffect(() => {
		insertLink(
			editorCtx,
			{
				...options,
				link: options.link,
				text: ` ${options.text || options.link} ` // 前后各加一个空格
			},
			() => {
				editorCtx.changeInput(); // 通知更新编辑器input事件
				if (callback) callback();
			}
		);
	});
}

/**
 * 添加附件
 * @param {Function} uploadFunc 文件上传函数（开发者自行调用上传接口上传本地附件至服务器后获取服务器附件真实地址，需要return包含地址的对象）
 * @param {Object} options 附件配置项
 * @property {String} options.srcFiled 附件地址字段名，默认path
 * @property {String} options.link 附件地址 注：临时地址会自动转成about:blank导致无效
 * @property {String} options.text 附件文本 空缺时使用link
 * @property {String} options.textDecoration 下划线
 * @property {String} options.color 颜色 默认#34d19d
 * @property {Object} options.style 其他样式，例如 { bold: true, italic: true } 等，详见：https://quilljs.com/docs/delta
 * @param {Function} callback 添加附件成功后回调
 * @returns {Object|Promise} 上传的文件对象
 */
export async function addAttachment(uploadFunc, options = {}, callback) {
	const eid = store.actions.getEID();
	const editorCtx = store.actions.getEditor(eid);

	// 服务器上传附件
	if (!uploadFunc) return;
	const upRes = await uploadFunc(editorCtx);
	if (!upRes) return;

	const link = upRes[options.srcFiled || "path"] || options.link;
	if (!link) return;
	const text = ` 📄${upRes.text || options.text || upRes.file?.name || link} `; // 加上附件图标前置，并前后各加一个空格
	// 取消键盘副作用
	noKeyboardEffect(() => {
		insertLink(
			editorCtx,
			{
				color: "#34d19d",
				...options,
				text,
				link
			},
			() => {
				editorCtx.changeInput(); // 通知更新编辑器input事件
				if (callback) callback();
			}
		);
	});

	return upRes;
}

/**
 * 添加提及
 * @param {Object} options 提及配置项
 * @property {String} options.username 用户名称
 * @property {String} options.userid 用户id
 * @property {String} options.textDecoration 下划线
 * @property {String} options.color 颜色 默认#66ccff
 * @property {Object} options.style 其他样式，例如 { bold: true, italic: true } 等，详见：https://quilljs.com/docs/delta
 * @param {Function} callback 添加链接成功后回调
 */
export async function addAt(options = {}, callback) {
	const eid = store.actions.getEID();
	const editorCtx = store.actions.getEditor(eid);

	// 取消键盘副作用
	noKeyboardEffect(() => {
		insertLink(
			editorCtx,
			{
				color: "#66ccff",
				...options,
				link: `@${options.userid}`, // 添加特殊前缀，后续便于解析标识
				text: ` @${options.username} ` // 前后各加一个空格
			},
			() => {
				editorCtx.changeInput(); // 通知更新编辑器input事件
				if (callback) callback();
			}
		);
	});
}

/**
 * 添加话题
 * @param {Object} options 话题配置项
 * @property {String} options.link 话题链接
 * @property {String} options.topic 话题名称
 * @property {String} options.textDecoration 下划线
 * @property {String} options.color 颜色 默认#909399
 * @property {Object} options.style 其他样式，例如 { bold: true, italic: true } 等，详见：https://quilljs.com/docs/delta
 * @param {Function} callback 添加链接成功后回调
 */
export async function addTopic(options = {}, callback) {
	const eid = store.actions.getEID();
	const editorCtx = store.actions.getEditor(eid);

	// 取消键盘副作用
	noKeyboardEffect(() => {
		insertLink(
			editorCtx,
			{
				color: "#909399",
				...options,
				link: `#${options.link}`, // 添加特殊前缀，后续便于解析标识
				text: ` #${options.topic}# ` // 前后各加一个空格
			},
			() => {
				editorCtx.changeInput(); // 通知更新编辑器input事件
				if (callback) callback();
			}
		);
	});
}

/**
 * 标识必须独一无二 - 标识是为了使用insertText插入标识文本后，查找到标识所在delta位置的索引
 * 注：因为做了一次insertText操作，所有可能会有linkFlag标识字样闪一下的副作用，没有办法避免
 */
export const linkFlag = "🔗添加链接中, 请稍后...🔗"; // 建议语义化该标识，否则闪烁的时候可能会有点尴尬
/**
 * 插入链接
 * @description uni-editor暂不支持插入链接，此api使用delta替换链接本文标识方式实现，因硬性原因会导致光标失焦
 * @param {Object} editorCtx 编辑器上下文
 * @param {Object} attr 链接属性
 * @property {String} attr.link 链接地址 注：临时地址会自动转成about:blank导致无效
 * @property {String} attr.text 链接文本 空缺时使用link
 * @property {String} attr.textDecoration 下划线
 * @property {String} attr.color 颜色 默认#007aff
 * @property {Object} attr.style 其他样式，例如 { bold: true, italic: true } 等，详见：https://quilljs.com/docs/delta
 * @param {Object} callback 成功回调
 */
export function insertLink(editorCtx, attr, callback) {
	// 先插入一段文本内容
	editorCtx.insertText({ text: linkFlag });
	// 必须先失焦，否则光标会移至开始位置
	editorCtx.blur();
	// 获取全文delta内容
	editorCtx.getContents({
		success: (res) => {
			let options = res.delta.ops;
			const findex = options.findIndex((item) => {
				return (
					item.insert &&
					typeof item.insert !== "object" &&
					item.insert?.indexOf(linkFlag) !== -1
				);
			});
			// 根据标识查找到插入的位置
			if (findex > -1) {
				const findOption = options[findex];
				const findAttributes = findOption.attributes;
				// 将该findOption分成三部分：前内容 要插入的link 后内容
				const [prefix, suffix] = findOption.insert.split(linkFlag);
				const handleOps = [];
				// 前内容
				if (prefix) {
					const prefixOps = findAttributes
						? {
								insert: prefix,
								attributes: findAttributes
							}
						: {
								insert: prefix
							};
					handleOps.push(prefixOps);
				}
				// 插入的link
				const linkOps = {
					insert: attr.text || attr.link,
					attributes: {
						link: attr.link,
						textDecoration: attr.textDecoration || "none", // 下划线
						color: attr.color || "#007aff",
						...attr.style
					}
				};
				handleOps.push(linkOps);
				// 后内容
				if (suffix) {
					const suffixOps = findAttributes
						? {
								insert: suffix,
								attributes: findAttributes
							}
						: {
								insert: suffix
							};
					handleOps.push(suffixOps);
				}
				// 删除原options[findex]并在findex位置插入上述三个ops
				options.splice(findex, 1);
				options.splice(findex, 0, ...handleOps);
				// 最后重新初始化内容
				editorCtx.setContents({
					delta: {
						ops: options
					}
				});
				// 清除格式，以防残留超链接格式
				editorCtx.removeFormat();
				editorCtx.format("color", "inherit");

				// 后续回调操作
				if (callback) callback();
			}
		}
	});
}

/**
 * 尽量消除键盘带来的影响；重要：核心功能！！！
 * @param {Function} callback 回调
 * @param {Object} options 配置项
 * @property {String} options.mode 可选：setInputMode：通过控制ql-editor的inputmode属性控制键盘 [H5 APP] | loseFocus：通过blur失焦隐藏键盘 [MP-WEIXIN] | hideKeyboard：通过hideKeyboard隐藏键盘 | setReadOnly：通过控制读写隐藏键盘
 * @property {Number} options.delay 延时（毫秒）默认50
 */
export function noKeyboardEffect(callback, options) {
	let defaultOpt = { delay: 50 };

	// #ifdef APP
	const isIOS = uni.getSystemInfoSync().platform == "ios";
	defaultOpt.mode = isIOS ? "loseFocus" : "setInputMode"; // iOS使用setInputMode无效
	// #endif

	// #ifdef H5
	defaultOpt.mode = "setInputMode";
	// #endif

	// #ifdef MP-WEIXIN
	defaultOpt.mode = "loseFocus";
	// #endif

	const opt = Object.assign(defaultOpt, options);

	const eid = store.actions.getEID();
	const editorCtx = store.actions.getEditor(eid);

	// 通过 uni.hideKeyboard() 隐藏键盘，但是会导致键盘闪烁
	// 微信小程序好像无法正常隐藏键盘
	if (opt.mode == "hideKeyboard") {
		callback();
		setTimeout(() => {
			uni.hideKeyboard();
		}, opt.delay);
	}

	// 通过控制编辑器失焦来隐藏键盘，但是会导致键盘闪烁
	// 只推荐微信小程序使用（也是无可奈何）
	if (opt.mode == "loseFocus") {
		callback();
		editorCtx.blur();
	}

	// 通过控制编辑器读写模式进行屏蔽焦点，虽然隐藏了键盘，但是也失焦了
	// 微信小程序中当只读时是无法使用api去修改内容的
	if (opt.mode == "setReadOnly") {
		store.actions.setReadOnly(true);
		callback();
		setTimeout(() => {
			store.actions.setReadOnly(false);
		}, opt.delay);
	}

	// 使用renderjs给ql-editor节点设置inputmode属性来控制键盘是否弹出
	// 设置none时将会阻止键盘弹出，设置remove将会恢复，完美适配H5、App(Android)，但是不支持App(iOS)和微信小程序
	if (opt.mode == "setInputMode") {
		// #ifdef APP || H5
		// 以下严格处理异步与延时操作，缺一不可
		editorCtx.changeInputMode("none");
		setTimeout(() => {
			callback();
			setTimeout(() => {
				editorCtx.changeInputMode("remove");
			}, opt.delay);
		}, opt.delay);
		// #endif
	}
}

/**
 * 版权信息
 */
import packageConfig from "../../package.json";
export function copyrightPrint() {
	/* 标题样式 */
	const styleTitle1 = `font-size:16px;font-weight:700;color:#ff4500;`;
	const styleTitle2 = `font-style:oblique;font-size:14px;color:#fb7299;`;
	const styleContent = `color:#66ccff;`;
	/* 版权信息 */
	const title1 = ` 📝 sv-editor v${packageConfig.version} `;
	const title2 = "by Sonve";
	const content = `
  版权声明：
  1. 本插件免费开源，还望保留此版权声明在控制台输出
  2. 如需借鉴源码，还望注明出处
  3. 未经授权您不得以任何形式转载、售卖本插件，或以其他形式侵犯版权及附属权利
  4. 作者将保留对此插件版权信息的最终解释权
  🏠 地址: https://ext.dcloud.net.cn/plugin?id=21184
  😸 Gitee: https://gitee.com/Sonve/sv-editor
  💬 微信: s1051399604
  🐧 QQ群: ① 852637893 ② 816646292


  ！！！感谢作者！！！
  `;
	console.log(`%c${title1}%c${title2}%c${content}`, styleTitle1, styleTitle2, styleContent);
}

export function noAuthorization(name) {
	/* 标题样式 */
	const styleTitle1 = `font-size:16px;font-weight:700;color:#e6a23c;`;
	const styleTitle2 = `font-style:oblique;font-size:14px;color:#fb7299;`;
	const styleContent = `color:#f56c6c;`;
	/* 授权信息 */
	const title1 = ` ⛔ sv-editor ${name} `;
	const title2 = "by Sonve";
	const content = `
  提示：您还未获取插件特殊扩展功能授权，可联系作者获取
  💬 微信: s1051399604 | 🐧 QQ群: ① 852637893 ② 816646292
  🏠 插件地址: https://ext.dcloud.net.cn/plugin?id=21184
  `;
	console.log(`%c${title1}%c${title2}%c${content}`, styleTitle1, styleTitle2, styleContent);
}
