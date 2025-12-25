import { ref } from "vue";
import { useStore } from "@/cool";
import { createModelSessionId } from "@/utils/assetsConfig";
import { SaveMessages, type SaveMessagesPayload } from "@/api/history-chat";
import { generateUUID } from "@/utils/util";
import { QueryCase } from "@/api/retrieve";
import type { ChatLaunchPayload } from "./flow";
import type { Tools } from "@/cool/types/chat-input";
import { GetCaseCardDetail, type CaseDetailResponse } from "@/api/references";

export interface CaseMessageReferences {
	searchList?: Array<{
		hostName?: string;
		hostLogo?: string;
		indexId?: number;
		time?: string;
		title?: string;
		body?: string;
		url?: string;
	}>;
	caseList?: string[];
	caseDetails?: CaseDetailResponse[];
	loadingCase?: boolean;
}

export interface CaseMessage {
	role: "user" | "system";
	content: string;
	fromVoice?: boolean;
	voiceUrl?: string;
	voiceLength?: number;
	references?: CaseMessageReferences;
}

export interface CaseStreamHooks {
	onTextChunk?: (chunk: string) => void;
}

export class CaseSessionStore {
	messages = ref<CaseMessage[]>([]);
	sessionId = ref<string | null>(null);
	loading = ref(false);
	streamStatus = ref<string | null>(null);

	initFromLaunch(launch: ChatLaunchPayload) {
		this.messages.value = [];
		this.sessionId.value = null;
	}

	private buildSessionForSave(sessionId: string, msgList?: CaseMessage[]) {
		const list = msgList || this.messages.value;
		const firstUserMsg = list.find((m) => m.role === "user");
		const rawTitle = firstUserMsg?.content || "新对话";
		const title = rawTitle.length <= 30 ? rawTitle : rawTitle.slice(0, 30) + "...";
		const now = Date.now();
		const date = new Date(now);
		const pad = (n: number) => n.toString().padStart(2, "0");
		const dateTimeStr = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
			date.getDate()
		)} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;

		const mappedMessages = list.map((m) => ({
			id: generateUUID(),
			content: m.content,
			sender: m.role === "user" ? "user" : "ai",
			timestamp: dateTimeStr,
			isStreaming: false,
			references: m.references
		}));

		return {
			id: sessionId,
			title,
			messages: mappedMessages,
			createdAt: now,
			updatedAt: now
		} as Record<string, any>;
	}

	private async saveCurrentSessionSnapshot() {
		try {
			const { user } = useStore();
			const userId = (user as any)?.info?.value?.id as number | undefined;
			if (!this.sessionId.value || !userId) {
				return;
			}

			const session = this.buildSessionForSave(this.sessionId.value);
			const payload: SaveMessagesPayload = {
				user_id: userId,
				session_id: this.sessionId.value,
				message: session
			};

			await SaveMessages(payload);
		} catch (err) {
			console.error("[CaseSession] 保存会话失败", err);
		}
	}

	async sendTextQuestion(
		text: string,
		_tools: Tools,
		hooks?: CaseStreamHooks,
		options?: { fromVoice?: boolean; voiceUrl?: string; voiceLength?: number }
	) {
		const content = text.trim();
		if (!content || this.loading.value) return;

		if (!this.sessionId.value) {
			this.sessionId.value = createModelSessionId("case");
		}

		this.streamStatus.value = "正在检索案例...";

		// 添加用户消息
		this.messages.value.push({
			role: "user",
			content,
			fromVoice: !!options?.fromVoice,
			voiceUrl: options?.voiceUrl,
			voiceLength: options?.voiceLength
		});

		await this.saveCurrentSessionSnapshot();

		// 添加 AI 回复占位
		this.messages.value.push({ role: "system", content: "" });
		const aiMsg = this.messages.value[this.messages.value.length - 1];

		this.loading.value = true;

		try {
			// 调用案例检索 API
			const res = await QueryCase({
				content,
				pageNumber: 1,
				pageSize: 10
			});

			// 处理响应
			const responseData = (res as any)?.data ?? res;

			// 根据实际响应格式处理数据
			if (responseData) {
				// 如果返回的是文本内容
				if (typeof responseData === "string") {
					aiMsg.content = responseData;
				} else if (responseData.content) {
					aiMsg.content = responseData.content;
				} else if (responseData.answer) {
					aiMsg.content = responseData.answer;
				} else if (Array.isArray(responseData)) {
					// 如果返回的是案例列表，格式化显示
					aiMsg.content = this.formatCaseResults(responseData);
					aiMsg.references = {
						caseList: responseData.map((item: any) => item.caseId || item.id || "")
					};
				} else {
					// 尝试将对象转为可读内容
					aiMsg.content = JSON.stringify(responseData, null, 2);
				}

				hooks?.onTextChunk?.(aiMsg.content);
			}

			this.streamStatus.value = null;
			await this.saveCurrentSessionSnapshot();
			await this.fetchReferencesDetail(aiMsg);
		} catch (err) {
			console.error("[CaseSession] 检索失败", err);
			aiMsg.content = "检索失败，请稍后重试";
			this.streamStatus.value = null;
		} finally {
			this.loading.value = false;
		}
	}

	private formatCaseResults(results: any[]): string {
		if (!results.length) {
			return "未找到相关案例，请尝试其他关键词。";
		}

		const lines = ["根据您的检索，找到以下相关案例：\n"];
		results.forEach((item, index) => {
			const caseNo = item.caseNo || item.case_no || "";
			const caseName = item.caseName || item.title || item.name || `案例 ${index + 1}`;
			const court = item.court || item.courtName || "";
			const judgeDate = item.judgeDate || item.judge_date || "";

			lines.push(`**${index + 1}. ${caseName}**`);
			if (caseNo) lines.push(`案号：${caseNo}`);
			if (court) lines.push(`法院：${court}`);
			if (judgeDate) lines.push(`裁判日期：${judgeDate}`);
			lines.push("");
		});

		return lines.join("\n");
	}

	private async fetchReferencesDetail(aiMsg: CaseMessage) {
		try {
			if (!aiMsg.references) return;

			const msgIndex = this.messages.value.findIndex((m) => m === aiMsg);
			if (msgIndex === -1) return;

			const updateMessage = (updater: (refs: CaseMessageReferences) => void) => {
				const msg = this.messages.value[msgIndex];
				if (msg.references) {
					updater(msg.references);
					this.messages.value = [...this.messages.value];
				}
			};

			const refs = aiMsg.references;

			if (refs.caseList && refs.caseList.length > 0) {
				updateMessage((r) => (r.loadingCase = true));

				const validCaseIds = refs.caseList.filter((id) => !!id);

				if (validCaseIds.length > 0) {
					try {
						const res = await GetCaseCardDetail(validCaseIds);
						const caseData = (res as any)?.data ?? res ?? [];
						updateMessage((r) => {
							r.caseDetails = Array.isArray(caseData) ? caseData : [];
							r.loadingCase = false;
						});
					} catch (err) {
						console.error("[CaseSession] 获取案例详情失败", err);
						updateMessage((r) => {
							r.caseDetails = [];
							r.loadingCase = false;
						});
					}

					await this.saveCurrentSessionSnapshot();
				} else {
					updateMessage((r) => (r.loadingCase = false));
				}
			}
		} catch (err) {
			console.error("[CaseSession] 获取引用详情失败", err);
		}
	}

	restoreFromHistory(sessionId: string, messages: CaseMessage[]) {
		this.sessionId.value = sessionId;
		this.messages.value = messages;
		this.loading.value = false;
		this.streamStatus.value = null;

		this.loadMissingReferencesDetail();
	}

	private async loadMissingReferencesDetail() {
		for (const msg of this.messages.value) {
			if (msg.role !== "system" || !msg.references) continue;

			const refs = msg.references;
			const needLoadCase = refs.caseList?.length && !refs.caseDetails?.length;

			if (needLoadCase) {
				await this.fetchReferencesDetail(msg);
			}
		}
	}

	clear() {
		this.messages.value = [];
		this.sessionId.value = null;
	}
}

export const caseSessionStore = new CaseSessionStore();
