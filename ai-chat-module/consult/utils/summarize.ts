/**
 * 对话总结服务
 * 用于将咨询对话总结后发送给律师
 */
import { CallBareModel, type BareModelMessage } from "@/api/bare-model";
import type { ConsultMessage } from "@/cool/store/chatInput-store/consultSession";

const SUMMARIZE_SYSTEM_PROMPT = `你是一个专业的法律咨询助手。请将以下用户与AI的对话内容进行总结，生成一段简洁的摘要，方便律师快速了解用户的法律问题和诉求。

要求：
1. 总结要简洁明了，控制在400字以内
2. 突出用户的核心法律问题和诉求
3. 如有涉及的法律领域，请明确指出
4. 使用第三方视角描述，如"该用户..."
5. 不要包含AI的建议内容，只总结用户的问题`;

/**
 * 总结咨询对话
 * @param messages 咨询消息列表
 * @returns 总结文本
 */
export async function summarizeConversation(messages: ConsultMessage[]): Promise<string> {
	if (!messages || messages.length === 0) {
		return "";
	}

	// 取最近 5 轮对话（问+答为一轮，即最多 10 条消息）
	const recentMessages = messages.slice(-10);

	// 转换为接口需要的格式
	const modelMessages: BareModelMessage[] = recentMessages.filter(
		(m) => m.content && m.content.trim()
	);

	try {
		const res = await CallBareModel({
			model: "qwen-turbo",
			messages: modelMessages,
			prompt: SUMMARIZE_SYSTEM_PROMPT,
			enable_thinking: false,
			stream: false
		});

		const content = res?.content || "";
		return content.trim();
	} catch (err) {
		console.error("[summarizeConversation] 总结对话失败", err);
		throw err;
	}
}
