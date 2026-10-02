import { llmResponseSchema, type LLMRequest, type ProviderConfig } from "../llm.interface";

export class ProviderHttpError extends Error {
  constructor(readonly status: number, readonly diagnostic?: ProviderDiagnostic,
    readonly request?: { endpoint: string; model: string; payloadBytes: number; toolNames: string[] }) {
    super("Nhà cung cấp AI trả về lỗi HTTP.");
    this.name = "ProviderHttpError";
  }
}

type ProviderDiagnostic = { reason: string; fields: string[]; message?: string;
  code?: string | number; type?: string; status?: string; param?: string; requestId?: string;
  details?: Array<{ type?: string; reason?: string; fieldViolations?: Array<{ field?: string; description?: string }> }>;
  truncated?: boolean };

const asRecord = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value)
  ? value as Record<string, unknown> : {};

function redact(value: unknown, privateValues: string[], limit = 2000) {
  if (typeof value !== "string") return undefined;
  let text = value;
  for (const item of privateValues) {
    if (!item) continue;
    text = text.split(item).join("[đã che]").split(JSON.stringify(item).slice(1, -1)).join("[đã che]");
  }
  return text.replace(/\b(?:sk-[\w-]{8,}|AIza[\w-]{15,}|Bearer\s+[^\s,"'<>]+)/gi, "[đã che]")
    .replace(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi, "[đã che email]")
    .replace(/[\u0000-\u001f\u007f]/g, " ").slice(0, limit);
}

// Chỉ giữ thông tin chẩn đoán; bỏ metadata, prompt và nội dung request bị phản chiếu trong lỗi.
export function providerDiagnostic(body: unknown, privateValues: string[] = []): ProviderDiagnostic {
  const root = asRecord(body);
  const error = root.error && typeof root.error === "object" ? asRecord(root.error) : root;
  const message = redact(error.message ?? (typeof body === "string" ? body : undefined), privateValues);
  const details = Array.isArray(error.details) ? error.details.slice(0, 8).map((entry) => {
    const detail = asRecord(entry);
    return { type: redact(detail["@type"], privateValues, 200), reason: redact(detail.reason, privateValues, 200),
      fieldViolations: Array.isArray(detail.fieldViolations) ? detail.fieldViolations.slice(0, 10).map((entry) => {
        const violation = asRecord(entry);
        return { field: redact(violation.field, privateValues, 300), description: redact(violation.description, privateValues, 500) };
      }) : undefined };
  }) : undefined;
  const code = typeof error.code === "number" ? error.code : redact(error.code, privateValues, 120);
  const type = redact(error.type, privateValues, 120);
  const status = redact(error.status, privateValues, 120);
  const param = redact(error.param, privateValues, 300);
  const text = `${message ?? ""} ${code ?? ""} ${type ?? ""} ${status ?? ""} ${param ?? ""} ${JSON.stringify(details ?? [])}`;
  const reason = /API_KEY_INVALID|API key not valid|invalid api.?key/i.test(text) ? "INVALID_API_KEY"
    : /API_KEY_SERVICE_BLOCKED|API_KEY_HTTP_REFERRER_BLOCKED|API_KEY_IP_ADDRESS_BLOCKED|PERMISSION_DENIED|SERVICE_DISABLED/i.test(text) ? "ACCESS_DENIED"
    : /too many states for serving|schema.{0,40}too complex|compiled grammar.{0,20}too large/i.test(text) ? "SCHEMA_TOO_COMPLEX"
    : /context_length_exceeded|context.{0,30}(?:limit|length|window)|too many (?:input )?tokens|token.{0,30}(?:limit|exceed)|maximum.{0,20}tokens|prompt is too long/i.test(text) ? "CONTEXT_LIMIT"
    : /model_not_found|model.*not found|model.*does not exist/i.test(text) ? "MODEL_NOT_FOUND"
    : /tool_call_id|tool_use_id|tool_result|messages responding to|function_response/i.test(text) ? "INVALID_TOOL_HISTORY"
    : /response_format|response_schema|responseSchema|responseJsonSchema/i.test(text) ? "INVALID_RESPONSE_SCHEMA"
    : /function_declarations|functionDeclarations|parametersJsonSchema|parameters_json_schema|invalid_function_parameters|schema for (?:function|tool)|tools[\[.].*(?:parameters|input_schema)/i.test(text) ? "INVALID_TOOL_SCHEMA"
    : /not supported|unsupported|not available for/i.test(text) ? "UNSUPPORTED_FEATURE"
    : /messages[\[.]|contents[\[.]|invalid.{0,30}(?:content|role)|expected.{0,20}string.{0,20}null/i.test(text) ? "INVALID_MESSAGES"
    : /INVALID_ARGUMENT|invalid_request_error|invalid.*(?:request|payload)|unknown name|missing.{0,20}required|extra inputs/i.test(text) ? "INVALID_REQUEST"
    : "UNCLASSIFIED";
  const fields = [...new Set([...(param ? [param] : []),
    ...(details?.flatMap((detail) => detail.fieldViolations?.flatMap((item) => item.field ? [item.field] : []) ?? []) ?? []),
    ...(text.match(/\b(?:tools|messages|contents)(?:\[\d{1,3}\]|\.[a-zA-Z_][\w]*|\.\d{1,3})*|\b(?:generation_config|generationConfig|tool_config|toolConfig|system_instruction|systemInstruction)\b/g) ?? []),
  ])].slice(0, 10);
  return { reason, fields, message, code, type, status, param, details,
    requestId: redact(root.request_id, privateValues, 200) };
}

function requestPrivateValues(body: unknown, apiKey: string, headers: Record<string, string>) {
  const values = new Set([apiKey, ...Object.entries(headers).filter(([key]) => /authorization|api.?key/i.test(key)).map(([, value]) => value)]);
  const visit = (value: unknown, depth = 0) => {
    if (depth > 20) return;
    if (typeof value === "string") {
      if (value.length >= 8) values.add(value);
      try { const parsed: unknown = JSON.parse(value); if (parsed && typeof parsed === "object") visit(parsed, depth + 1); } catch { /* Văn bản thường không phải JSON. */ }
    } else if (Array.isArray(value)) value.forEach((item) => visit(item, depth + 1));
    else for (const item of Object.values(asRecord(value))) visit(item, depth + 1);
  };
  const request = asRecord(body);
  for (const key of ["system", "systemInstruction", "messages", "contents"]) visit(request[key]);
  return [...values].filter(Boolean).sort((a, b) => b.length - a.length);
}

export const requestContext = (request: LLMRequest) => JSON.stringify({
  currentTime: new Date().toISOString(), timezone: "Asia/Ho_Chi_Minh",
  goal: request.goal, taskContext: request.taskContext, conversation: request.conversation,
});

export async function postJson(url: string, headers: Record<string, string>, body: unknown,
  config: ProviderConfig, signal: AbortSignal): Promise<unknown> {
  const serialized = JSON.stringify(body);
  const response = await fetch(url, {
    method: "POST", headers: { "Content-Type": "application/json", ...headers },
    body: serialized, signal: AbortSignal.any([signal, AbortSignal.timeout(config.timeoutMs)]),
  });
  // Lỗi gốc đã che dữ liệu chỉ phục vụ log backend, không trả về hội thoại.
  if (!response.ok) {
    // Giới hạn đọc lỗi để tránh phản hồi bất thường làm đầy bộ nhớ.
    const reader = response.body?.getReader();
    const privateValues = requestPrivateValues(body, config.apiKey, headers);
    let diagnostic: ProviderDiagnostic = { reason: "UNCLASSIFIED", fields: [] };
    if (reader) {
      try {
        const chunks: Uint8Array[] = [];
        let length = 0;
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          const remaining = 64000 - length;
          chunks.push(value.subarray(0, remaining));
          length += value.byteLength;
          if (length > 64000) break;
        }
        const text = Buffer.concat(chunks).toString("utf8");
        let errorBody: unknown = text;
        try { errorBody = JSON.parse(text); } catch { /* Giữ thông báo lỗi dạng văn bản để chẩn đoán. */ }
        diagnostic = providerDiagnostic(errorBody, privateValues);
        if (length > 64000) diagnostic.truncated = true;
      } catch { /* Lỗi đọc response vẫn giữ được mã HTTP và mã request. */ }
      finally { await reader.cancel().catch(() => undefined); }
    }
    diagnostic.requestId = redact(response.headers.get("x-request-id") ?? response.headers.get("request-id")
      ?? diagnostic.requestId, privateValues, 200);
    const request = asRecord(body);
    const toolNames = Array.isArray(request.tools) ? request.tools.flatMap((value) => {
      const tool = asRecord(value);
      return Array.isArray(tool.functionDeclarations) ? tool.functionDeclarations.map((value) => asRecord(value).name)
        : [asRecord(tool.function).name ?? tool.name];
    }).filter((name): name is string => typeof name === "string").map((name) => redact(name, privateValues, 100)!) : [];
    const endpoint = new URL(url);
    throw new ProviderHttpError(response.status, diagnostic, { endpoint: `${endpoint.origin}${endpoint.pathname}`,
      model: redact(config.model, privateValues, 120)!, payloadBytes: Buffer.byteLength(serialized), toolNames });
  }
  const text = await response.text();
  if (text.length > 256_000) throw new Error("Phản hồi AI vượt giới hạn.");
  return JSON.parse(text) as unknown;
}

export function parseReply(text: string) {
  const trimmed = text.trim();
  const fenced = /^```(?:json)?\s*\n([\s\S]*?)\n```$/i.exec(trimmed);
  return llmResponseSchema.parse(JSON.parse(fenced ? fenced[1] : trimmed));
}
