import assert from "node:assert/strict";
import { mock } from "node:test";
import { parseReply, postJson, ProviderHttpError, providerDiagnostic } from "../ai/llm/providers/provider-http";
import { AgentLoop } from "../ai/agent/agent-loop.service";
import { newSession } from "../ai/agent/agent-state";
import { ToolRegistry } from "../ai/tools/tool-registry";
import { withAgentTimeout } from "../ai/agent/timeout";
import { GeminiProvider } from "../ai/llm/providers/gemini.provider";
import { OpenAIProvider } from "../ai/llm/providers/openai.provider";
import { ClaudeProvider } from "../ai/llm/providers/claude.provider";
import { nativeTools, nativeToolReply } from "../ai/llm/providers/native-tools";

// Chỉ đọc schema tool thật; cô lập service tích hợp để không đọc .env hoặc kết nối bên ngoài.
for (const path of ["../services/agentBooking.service", "../services/order.service"]) {
  const id = require.resolve(path);
  require.cache[id] = { id, filename: id, loaded: true, exports: {} } as NodeModule;
}

const reply = { type: "MESSAGE", message: "Bạn muốn vệ sinh căn hộ hay nhà phố?" };
const json = JSON.stringify(reply);
assert.deepEqual(parseReply(json), reply);
assert.deepEqual(parseReply(`\uFEFF\n\`\`\`json\n${json}\n\`\`\``), reply);
assert.throws(() => parseReply(`${json}\n${json}`));
assert.throws(() => parseReply("Đã tạo đơn thành công"));

async function main() {
  assert.equal(providerDiagnostic({ error: { code: 400, status: "INVALID_ARGUMENT",
    message: "The specified schema produces a constraint that has too many states for serving." } }).reason, "SCHEMA_TOO_COMPLEX");
  const diagnostic = providerDiagnostic({ error: { message: "Invalid tools[0].function_declarations[2].parameters: expected OBJECT", details: [] } });
  assert.equal(diagnostic.reason, "INVALID_TOOL_SCHEMA");
  assert.ok(diagnostic.fields.includes("tools[0].function_declarations[2].parameters"));
  assert.match(diagnostic.message ?? "", /expected OBJECT/);
  const unsupported = providerDiagnostic({ error: { message: "Unsupported parameter: 'temperature' is not supported with this model.",
    type: "invalid_request_error", param: "temperature", code: "unsupported_parameter" } });
  assert.equal(unsupported.reason, "UNSUPPORTED_FEATURE");
  assert.equal(unsupported.param, "temperature");
  assert.equal(unsupported.code, "unsupported_parameter");
  const schemaError = providerDiagnostic({ error: { message: "Invalid schema for function 'create_booking': array schema missing items.",
    type: "invalid_request_error", param: "tools[0].function.parameters", code: "invalid_function_parameters" } });
  assert.equal(schemaError.reason, "INVALID_TOOL_SCHEMA");
  assert.ok(schemaError.fields.includes("tools[0].function.parameters"));
  assert.equal(providerDiagnostic({ error: { code: "context_length_exceeded", message: "Too many input tokens." } }).reason, "CONTEXT_LIMIT");
  assert.equal(providerDiagnostic({ error: { message: "An assistant message with tool_calls must be followed by tool messages responding to each tool_call_id." } }).reason, "INVALID_TOOL_HISTORY");
  assert.equal(providerDiagnostic({ error: { message: "Invalid schema for response_format." } }).reason, "INVALID_RESPONSE_SCHEMA");
  assert.equal(providerDiagnostic({ error: { message: "Invalid value for content: expected a string, got null.", param: "messages[0].content" } }).reason, "INVALID_MESSAGES");
  const detailError = providerDiagnostic({ error: { code: 400, status: "INVALID_ARGUMENT", message: "Request contains an invalid argument.",
    details: [{ "@type": "type.googleapis.com/google.rpc.BadRequest", fieldViolations: [
      { field: "tools[0].function_declarations[0].parameters_json_schema", description: "Schema must describe an object." },
    ] }] } });
  assert.equal(detailError.reason, "INVALID_TOOL_SCHEMA");
  assert.match(JSON.stringify(detailError.details), /Schema must describe an object/);
  assert.equal(providerDiagnostic({ error: { message: "API key not valid. khóa-giả-lập" } }).reason, "INVALID_API_KEY");
  assert.equal(providerDiagnostic({ error: { message: "Lỗi không nhận diện" } }).reason, "UNCLASSIFIED");
  assert.equal(providerDiagnostic({ error: { message: "Lỗi không nhận diện" } }).message, "Lỗi không nhận diện");
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async () => new Response("Bad Request: upstream rejected this payload", { status: 400 });
    await assert.rejects(postJson("https://example.invalid", {}, {}, {
      apiKey: "", model: "kiểm-thử", temperature: 0, timeoutMs: 1000,
    }, new AbortController().signal), (error: unknown) => error instanceof ProviderHttpError
      && error.status === 400 && Boolean(error.diagnostic?.message?.includes("upstream rejected")));
    const privateContent = "Địa chỉ thử nghiệm cần được che trong log";
    const privateKey = "khóa-giả-lập-không-ghi-log";
    globalThis.fetch = async () => new Response(JSON.stringify({ error: { message: `Invalid parametersJsonSchema: ${privateContent}; key=${privateKey}` } }),
      { status: 400, headers: { "x-request-id": "req-test-400" } });
    await assert.rejects(postJson("https://example.invalid", {}, { messages: [{ role: "user", content: JSON.stringify({ goal: privateContent }) }] }, {
      apiKey: privateKey, model: "kiểm-thử", temperature: 0, timeoutMs: 1000,
    }, new AbortController().signal), (error: unknown) => error instanceof ProviderHttpError
      && error.status === 400 && error.diagnostic?.reason === "INVALID_TOOL_SCHEMA"
      && error.diagnostic.requestId === "req-test-400"
      && !JSON.stringify(error).includes(privateContent) && !JSON.stringify(error).includes(privateKey));
    globalThis.fetch = async () => new Response("Bad request. ".repeat(6000), { status: 400 });
    await assert.rejects(postJson("https://example.invalid", {}, {}, {
      apiKey: "", model: "kiểm-thử", temperature: 0, timeoutMs: 1000,
    }, new AbortController().signal), (error: unknown) => error instanceof ProviderHttpError
      && error.diagnostic?.truncated === true && error.diagnostic.message?.length === 2000);
  } finally { globalThis.fetch = originalFetch; }

  const { registerTools } = await import("../ai/tools/register-tools");
  const tools = registerTools({}).list({ user: { id: "khách-thử", role: "CUSTOMER" }, sessionId: "phiên-thử", signal: new AbortController().signal });
  assert.equal(tools.length, 25, "Tất cả tool đang đăng ký phải xuất được JSON Schema.");
  const request = { system: "Kiểm thử", goal: "Đặt vệ sinh nhà", tools, signal: new AbortController().signal,
    conversation: [
      { id: "1", role: "user" as const, content: "Đặt vệ sinh nhà", createdAt: new Date().toISOString() },
      { id: "2", role: "tool" as const, tool: "search_services", content: JSON.stringify({ items: [] }), createdAt: new Date().toISOString() },
    ] };
  const declarations = nativeTools(request);
  const originalTools = JSON.stringify(tools);
  assert.equal(declarations.length, 26);
  for (const tool of declarations) {
    assert.equal(tool.inputSchema.type, "object", tool.name);
    assert.equal(tool.inputSchema.$schema, undefined);
    const properties = tool.inputSchema.properties as Record<string, unknown>;
    assert.ok(properties && typeof properties === "object");
    for (const key of (tool.inputSchema.required ?? []) as string[]) assert.ok(key in properties, `${tool.name}.${key}`);
  }
  const providerConfig = { apiKey: "khóa-thử-nghiệm", model: "mô-hình-thử", temperature: 0, timeoutMs: 1000 };
  const responses = [
    { candidates: [{ finishReason: "STOP", content: { parts: [{ functionCall: { name: "respond_to_customer", args: reply } }] } }] },
    { choices: [{ finish_reason: "tool_calls", message: { content: null, tool_calls: [{ type: "function", function: { name: "respond_to_customer", arguments: json } }] } }] },
    { stop_reason: "tool_use", content: [{ type: "tool_use", name: "respond_to_customer", input: reply }] },
  ];
  const providers = [new GeminiProvider(providerConfig), new OpenAIProvider(providerConfig), new ClaudeProvider(providerConfig)];
  for (const [index, provider] of providers.entries()) {
    try {
      globalThis.fetch = async (_url, init) => {
        const body = JSON.parse(String(init?.body));
        assert.ok(body.tools?.length);
        assert.equal(body.generationConfig?.responseMimeType, undefined);
        assert.equal(body.response_format, undefined);
        if (index === 0) {
          assert.equal(body.tools[0].functionDeclarations.length, 26);
          assert.equal(body.tools[0].functionDeclarations[0].parameters, undefined);
          assert.equal(body.tools[0].functionDeclarations[0].parametersJsonSchema.type, "object");
          const checkSchema = (schema: Record<string, unknown>) => {
            for (const key of ["pattern", "format", "minimum", "maximum", "exclusiveMinimum", "exclusiveMaximum",
              "multipleOf", "minItems", "maxItems", "minLength", "maxLength", "default"]) {
              assert.equal(schema[key], undefined, `Schema Gemini không được chứa ràng buộc ${key}.`);
            }
            for (const child of Object.values((schema.properties ?? {}) as Record<string, Record<string, unknown>>)) checkSchema(child);
            if (schema.items) checkSchema(schema.items as Record<string, unknown>);
            for (const child of (schema.anyOf ?? []) as Array<Record<string, unknown>>) checkSchema(child);
          };
          for (const tool of body.tools[0].functionDeclarations) checkSchema(tool.parametersJsonSchema);
          const draft = body.tools[0].functionDeclarations[0].parametersJsonSchema;
          assert.equal(draft.properties.quantity.type, "integer");
          assert.deepEqual(draft.properties.orderType.enum, ["normal", "scheduled"]);
          assert.equal(draft.properties.selectedOptions.anyOf[0].items.properties.optionId.type, "string");
          assert.equal(draft.properties.selectedOptions.anyOf[1].type, "null");
          assert.deepEqual(body.tools[0].functionDeclarations[25].parametersJsonSchema.required, ["type", "message"]);
          assert.equal(JSON.stringify(tools), originalTools, "Rút gọn schema không được sửa schema gốc.");
          assert.equal(body.contents[0].role, "user");
          assert.equal(typeof body.contents[0].parts[0].text, "string");
          assert.deepEqual(JSON.parse(body.contents[0].parts[0].text).conversation, request.conversation);
        } else {
          assert.equal(body.tools.length, 26);
          for (const message of body.messages) {
            assert.ok(["system", "user"].includes(message.role));
            assert.equal(typeof message.content, "string");
            assert.equal(message.tool_call_id, undefined);
            assert.equal(message.tool_calls, undefined);
          }
          const content = body.messages[body.messages.length - 1].content;
          assert.deepEqual(JSON.parse(content).conversation, request.conversation);
          for (const [toolIndex, tool] of body.tools.entries()) {
            assert.deepEqual(index === 1 ? tool.function.parameters : tool.input_schema, declarations[toolIndex].inputSchema,
              "Schema OpenAI/Claude phải giữ nguyên.");
          }
        }
        return new Response(JSON.stringify(responses[index]), { status: 200 });
      };
      assert.deepEqual(await provider.generate(request), reply);
    } finally { globalThis.fetch = originalFetch; }
  }

  const draftTool = registerTools({}).get("update_booking_draft", {
    user: { id: "khách-thử", role: "CUSTOMER" }, sessionId: "phiên-thử", signal: new AbortController().signal,
  });
  for (const args of [{ quantity: 100 }, { quantity: 0 }, { serviceId: "id-sai" }, { scheduledAt: "ngày mai" },
    { selectedOptions: Array.from({ length: 51 }, () => ({ optionId: "111111111111111111111111", quantity: 1 })) }]) {
    assert.equal(draftTool.inputSchema.safeParse(args).success, false, "Backend vẫn phải từ chối dữ liệu vượt giới hạn.");
  }
  assert.throws(() => nativeToolReply("respond_to_customer", { type: "MESSAGE", message: "Chọn dịch vụ", choiceGroups: [
    { label: "Dịch vụ", multiple: false, options: Array.from({ length: 13 }, (_, index) => `Dịch vụ ${index}`) },
  ] }));

  for (const model of ["gemini-2.5-flash", "models/gemini-2.5-flash"]) {
    try {
      globalThis.fetch = async (url) => {
        assert.equal(String(url), "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent");
        return new Response(JSON.stringify(responses[0]));
      };
      await new GeminiProvider({ ...providerConfig, model }).generate(request);
    } finally { globalThis.fetch = originalFetch; }
  }
  for (const [model, temperature] of [["gpt-5", undefined], ["gpt-5-mini", undefined], ["gpt-5-2025-08-07", undefined],
    ["o3-mini", undefined], ["gpt-4.1-mini", 0], ["gpt-5.1", 0]] as const) {
    try {
      globalThis.fetch = async (_url, init) => {
        assert.equal(JSON.parse(String(init?.body)).temperature, temperature, model);
        return new Response(JSON.stringify(responses[1]));
      };
      await new OpenAIProvider({ ...providerConfig, model }).generate(request);
    } finally { globalThis.fetch = originalFetch; }
  }
  for (const [model, temperature] of [["claude-sonnet-4-5", 0], ["claude-opus-4-6", 0], ["claude-opus-4-7", undefined],
    ["claude-sonnet-5", undefined], ["claude-mythos-preview", undefined]] as const) {
    try {
      globalThis.fetch = async (_url, init) => {
        assert.equal(JSON.parse(String(init?.body)).temperature, temperature, model);
        return new Response(JSON.stringify(responses[2]));
      };
      await new ClaudeProvider({ ...providerConfig, model }).generate(request);
    } finally { globalThis.fetch = originalFetch; }
  }

  const warning = mock.method(console, "warn", () => {});
  try {
    globalThis.fetch = async () => new Response(JSON.stringify({ error: { code: 400, status: "INVALID_ARGUMENT",
      message: "Schema must describe an object.", details: [{ "@type": "type.googleapis.com/google.rpc.BadRequest",
        fieldViolations: [{ field: "tools[0].function_declarations[0].parameters_json_schema", description: "Expected OBJECT." }] }] } }),
      { status: 400, headers: { "x-request-id": "req-log-test" } });
    const session = newSession("phiên-log-thử", "khách-thử");
    const loop = new AgentLoop(new GeminiProvider({ ...providerConfig, model: "gemini-2.5-flash" }), registerTools({}),
      { maxIterations: 2, timeoutMs: 1000, systemPrompt: "Prompt thử không xuất ra log" });
    const message = await loop.run(session, { user: { id: session.userId, role: "CUSTOMER" }, sessionId: session.id,
      signal: new AbortController().signal }, async () => {});
    assert.match(message, /HTTP 400/);
    assert.ok(!message.includes("Schema"));
    assert.equal(warning.mock.callCount(), 1);
    const logged = JSON.parse(String(warning.mock.calls[0].arguments[1]));
    assert.equal(logged.diagnostic.requestId, "req-log-test");
    assert.equal(logged.diagnostic.details[0].fieldViolations[0].description, "Expected OBJECT.");
    assert.equal(logged.request.model, "gemini-2.5-flash");
    assert.equal(logged.request.toolNames.length, 26);
    assert.ok(logged.request.payloadBytes > 0);
    assert.ok(!JSON.stringify(logged).includes(providerConfig.apiKey));
    assert.ok(!JSON.stringify(logged).includes("Prompt thử"));
  } finally { warning.mock.restore(); globalThis.fetch = originalFetch; }

  const context = { user: { id: "khách-hàng", role: "CUSTOMER" as const }, sessionId: "kiểm-thử", signal: new AbortController().signal };
  for (const status of [400, 401, 403, 429, 503]) {
    let attempts = 0;
    const session = newSession(context.sessionId, context.user.id);
    const loop = new AgentLoop({ generate: async () => { attempts += 1; throw new ProviderHttpError(status); } },
      new ToolRegistry(), { maxIterations: 4, timeoutMs: 1000, systemPrompt: "Kiểm thử" });
    const message = await loop.run(session, context, async () => {});
    assert.equal(attempts, status === 503 ? 2 : 1);
    assert.equal(session.state, "FAILED");
    assert.ok(!message.includes("thời gian"));
    if (status === 400) {
      assert.ok(message.includes("HTTP 400"));
      assert.ok(!message.includes("quyền truy cập"));
    }
    assert.equal(session.conversation.some((item) => item.tool === "agent_protocol"), false);
  }
  let attempts = 0;
  const session = newSession(context.sessionId, context.user.id);
  const loop = new AgentLoop({ generate: async () => {
    attempts += 1;
    return parseReply(attempts === 1 ? "JSON không hợp lệ" : `\`\`\`json\n${json}\n\`\`\``);
  } }, new ToolRegistry(), { maxIterations: 4, timeoutMs: 1000, systemPrompt: "Kiểm thử" });
  assert.equal(await loop.run(session, context, async () => {}), reply.message);
  assert.equal(session.state, "WAITING_USER_INPUT");
  assert.equal(attempts, 2);
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(withAgentTimeout(Promise.resolve(null), controller.signal, 1000),
    (error: unknown) => error instanceof Error && error.name === "TimeoutError");
  console.log("Đã kiểm tra payload 25 tool trên ba provider, model/temperature, lỗi HTTP 400, log lỗi gốc đã che dữ liệu, giới hạn kích thước và thử lại; không gọi AI thật.");
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
