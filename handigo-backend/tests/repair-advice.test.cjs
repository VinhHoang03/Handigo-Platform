const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

// Nạp code thật, chỉ giả lập danh mục và provider; không đọc .env hay kết nối database.
function loadRepairModules(search = async () => [], searchNews = async () => [{ title: 'Bài hướng dẫn đang công bố', path: '/tin-tuc/bai-huong-dan', content: 'Nguyên nhân có thể và hướng dẫn an toàn mới nhất.' }]) {
  const cache = new Map();
  const root = path.resolve(__dirname, '../src');
  function load(relative) {
    const filename = path.resolve(root, relative);
    if (cache.has(filename)) return cache.get(filename);
    const exports = {}; cache.set(filename, exports);
    const source = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    vm.runInNewContext(source, { exports, Date, Map, Set, AbortSignal, console,
      require(name) {
        if (['zod', 'node:crypto'].includes(name)) return require(name);
        if (name.endsWith('/agentBooking.service')) return { AgentBookingService: { search } };
        if (name.endsWith('/repairNews.service')) return { searchRepairArticles: searchNews };
        if (name.endsWith('/timeout')) return { withAgentTimeout: operation => operation };
        if (name.endsWith('/appError')) return { AppError: Error };
        if (name.endsWith('/customer-knowledge')) return { knowledgeTopics: ['overview', 'booking', 'payment', 'cancellation', 'complaint', 'support', 'account'] };
        if (!name.startsWith('.')) throw new Error(`Module chưa được giả lập: ${name}`);
        return load(path.relative(root, path.resolve(path.dirname(filename), `${name}.ts`)));
      },
    }, { filename });
    return exports;
  }
  return { advice: load('ai/knowledge/repair-advice.ts'), data: load('ai/knowledge/repair-cases.ts'),
    tool: load('ai/tools/implementations/get-repair-advice.tool.ts').getRepairAdviceTool, load };
}

test('Nhận đúng 12 trường hợp và mô tả không dấu theo thiết bị', () => {
  const { advice } = loadRepairModules();
  const cases = [
    ['Máy lạnh không mát', 'ac-not-cooling'], ['dieu hoa chay nuoc', 'ac-water'],
    ['Máy giặt không xả nước', 'washer-drain'], ['Máy giặt rò nước', 'washer-leak'],
    ['Máy giặt rung mạnh khi vắt', 'washer-vibration'], ['tu lanh khong lanh', 'fridge-not-cooling'],
    ['Tủ lạnh kêu ồn', 'fridge-noise'], ['Bình nóng lạnh lâu nóng', 'heater-not-hot'],
    ['Aptomat nhảy khi bật máy', 'electrical-breaker'], ['Vòi nước rò rỉ', 'water-leak'],
    ['Bồn cầu nghẹt', 'drain-blocked'], ['Tivi có tiếng màn hình đen', 'tv-black-screen'],
  ];
  for (const [description, id] of cases) {
    const result = advice.assessRepairDescription(description);
    assert.equal(result.status, 'advice', description);
    assert.equal(result.cases[0].id, id, description);
    assert.ok(result.cases[0].possibleCauses.length);
    assert.ok(result.cases[0].safeActions.length);
    assert.ok(result.cases[0].avoidActions.length);
  }
});

test('Không đoán lỗi khi chưa đủ dữ liệu hoặc ngoài phạm vi, không có dữ liệu gas', () => {
  const { advice, data } = loadRepairModules();
  for (const description of ['Máy hỏng rồi', 'Máy giặt', 'Bếp gas không đánh lửa', 'Bình gas có mùi gas', 'Tôi muốn tư vấn cổ phiếu']) {
    const result = advice.assessRepairDescription(description);
    assert.equal(result.status, 'needs_details'); assert.equal(result.cases.length, 0);
    assert.ok(result.questions.length);
  }
  assert.ok(!JSON.stringify(data.repairKnowledgeSources()).toLowerCase().includes('gas'));
});

test('Khói, mùi khét, rò điện và phản ứng hóa chất được ưu tiên trước chẩn đoán', () => {
  const { advice } = loadRepairModules();
  for (const description of ['Máy giặt có mùi khét', 'Ổ cắm có tia lửa', 'Tivi có khói',
    'Bình nóng lạnh chạm vào tê tay', 'Máy giặt bị rò điện', 'Nước ngập gần ổ cắm', 'Tôi trộn javen với axit']) {
    const result = advice.assessRepairDescription(description);
    assert.equal(result.status, 'urgent', description);
    assert.ok(result.message.length > 100); assert.ok(result.references.length);
    assert.equal(result.cases, undefined);
  }
});

test('Dấu hiệu được phủ định không bị coi là đang xảy ra, dấu hiệu sau nhưng vẫn được nhận', () => {
  const { advice } = loadRepairModules();
  for (const text of ['Điều hòa không lạnh, không có mùi khét', 'Máy giặt không có tia lửa, chưa bị rò điện', 'Tivi không có khói']) {
    assert.equal(advice.repairSafetyAdvice(text), null, text);
  }
  assert.equal(advice.repairSafetyAdvice('Không có mùi khét nhưng có tia lửa').status, 'urgent');
});

test('Chỉ đưa dịch vụ từ danh mục thật, loại trùng và không kèm giá suy đoán', async () => {
  const calls = [];
  const { tool } = loadRepairModules(async query => {
    calls.push(query); return [{ id: 'real-id', name: 'Sửa chữa điều hòa', serviceType: 'variable_price', minOptionPrice: 10000 }];
  });
  const result = await tool.execute({ signal: AbortSignal.timeout(5000) }, { description: 'Điều hòa không lạnh' });
  assert.equal(result.serviceLookup, 'found'); assert.equal(result.services.length, 1);
  assert.equal(result.services[0].id, 'real-id'); assert.equal(result.services[0].minOptionPrice, undefined);
  assert.ok(calls.every(query => query.includes('sửa')));
  assert.equal(tool.mutates, false); assert.equal(tool.requiresConfirmation, false);
  assert.deepEqual([...tool.roles], ['CUSTOMER']);
});

test('Danh mục lỗi hoặc không có dịch vụ vẫn trả nguyên nhân và an toàn, không bịa dịch vụ', async () => {
  for (const failed of [false, true]) {
    const { tool } = loadRepairModules(async () => { if (failed) throw new Error('Lỗi danh mục giả lập'); return []; });
    const result = await tool.execute({ signal: AbortSignal.timeout(5000) }, { description: 'Máy giặt không vắt' });
    assert.equal(result.serviceLookup, failed ? 'unavailable' : 'no_match');
    assert.equal(result.services.length, 0); assert.ok(result.articles[0].content.length);
    assert.equal(result.cases[0].possibleCauses, undefined);
  }
});

test('Nguy hiểm trả lời trực tiếp bằng nguồn, không gọi database hoặc model', async () => {
  const { tool } = loadRepairModules(async () => { assert.fail('Không tra dịch vụ khi có nguy hiểm'); });
  const result = await tool.execute({ signal: AbortSignal.timeout(5000) }, { description: 'Điều hòa bốc khói' });
  const reply = tool.reply(result);
  assert.equal(reply.state, 'WAITING_USER_INPUT'); assert.match(reply.message, /114/);
  assert.match(reply.message, /https:\/\/www.evn.com.vn/);
  assert.match(reply.message, /an toàn/);
});

test('Schema không cho truyền userId, chỉ dẫn nhận dạng hoặc mô tả quá dài', () => {
  const { tool } = loadRepairModules();
  assert.equal(tool.inputSchema.safeParse({ description: 'Máy giặt hỏng', userId: 'other' }).success, false);
  assert.equal(tool.inputSchema.safeParse({ description: 'x'.repeat(4001) }).success, false);
  assert.equal(tool.inputSchema.safeParse({ description: '' }).success, false);
});

test('25 nguồn nhập hợp lệ, định danh/checksum ổn định và có nguồn gốc đối chiếu', () => {
  const { data, load } = loadRepairModules();
  const { loadKnowledgeConfig } = load('ai/knowledge/knowledge.config.ts');
  const { prepareKnowledgeSource } = load('ai/knowledge/ingestion/chunker.ts');
  const config = loadKnowledgeConfig({});
  const sources = data.repairKnowledgeSources();
  assert.equal(sources.length, 25); assert.equal(new Set(sources.map(source => source.sourceKey)).size, 25);
  for (const source of sources) {
    const first = prepareKnowledgeSource(source, config), second = prepareKnowledgeSource(source, config);
    assert.equal(first.versionId, second.versionId); assert.equal(first.documentId, second.documentId);
    assert.ok(first.chunks.length); assert.match(source.content, /https:\/\//);
    assert.equal(source.topic, 'support'); assert.equal(source.path, '/services');
  }
});

test('Không dùng nguyên nhân cũ khi Tin tức đã ẩn bài hoặc database không đọc được', async () => {
  for (const failed of [false, true]) {
    const { tool } = loadRepairModules(async () => { assert.fail('Không tra đặt dịch vụ khi chưa có nguồn bài viết'); },
      async () => { if (failed) throw new Error('Lỗi đọc bài giả lập'); return []; });
    const result = await tool.execute({ signal: AbortSignal.timeout(5000) }, { description: 'Điều hòa không lạnh' });
    assert.equal(result.newsLookup, failed ? 'unavailable' : 'no_match');
    assert.equal(result.knowledgeSource, 'published_news');
    assert.equal(result.articles.length, 0);
    assert.equal(result.cases[0].possibleCauses, undefined);
    assert.equal(result.services.length, 0);
  }
});

test('Agent chính ưu tiên an toàn, lưu phản hồi và chống lặp request mà không gọi model', async () => {
  const { advice, load } = loadRepairModules();
  const session = load('ai/agent/agent-state.ts').newSession('session', 'customer');
  let saves = 0, releases = 0;
  const filename = path.resolve(__dirname, '../src/ai/agent/agent.service.ts');
  const exports = {};
  const source = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const messageRepository = load('ai/session/message.repository.ts');
  const modules = {
    'node:crypto': require('node:crypto'), zod: require('zod'),
    '../../utils/appError': { AppError: Error },
    '../knowledge/repair-advice': advice,
    '../session/message.repository': messageRepository,
    './session-lifecycle': { sessionStorageFull: () => false },
    './runtime-limits': { AGENT_REQUEST_TIMEOUT_MS: 5000 },
    './agent-loop.service': {},
    '../../services/agentPayment.service': {},
    './timeout': {}, '../tools/implementations/booking.schemas': {}, './booking-attachments': {},
    '../../services/agentOrderProgress.service': {}, '../../services/agentAssignedProvider.service': {},
    '../../utils/agentAddressFormatting': {},
  };
  vm.runInNewContext(source, { exports, Date, Map, Set, Buffer, AbortSignal,
    require(name) { assert.ok(name in modules, name); return modules[name]; } }, { filename });
  const store = { acquire: async () => ({ session, lockId: 'lock' }),
    async save() { saves++; }, async release() { releases++; } };
  const loop = { async run() { assert.fail('Không được gọi model khi có khói'); },
    reply(current, state, message) {
      current.state = state; new messageRepository.MessageRepository().append(current, 'assistant', message);
    } };
  const service = new exports.AgentService(store, loop);
  const user = { id: 'customer', role: 'CUSTOMER' };
  const input = { requestId: 'req-1', message: 'Máy giặt đang bốc khói' };
  const result = await service.send(user, 'session', input);
  assert.equal(result.state, 'WAITING_USER_INPUT');
  assert.match(result.messages.at(-1).content, /114/);
  assert.equal(session.receipts.length, 1); assert.equal(session.activeRequest, null);
  assert.ok(saves > 0); assert.equal(releases, 1);
  await service.send(user, 'session', input);
  assert.equal(session.conversation.length, 2); assert.equal(releases, 2);
});

test('Công cụ tư vấn có sẵn ở mọi nhóm, được phép tra cứu và từ chối vai trò ngoài khách hàng', () => {
  const { tool, load } = loadRepairModules();
  const { ToolRegistry } = load('ai/tools/tool-registry.ts');
  const registry = new ToolRegistry({}, true).register(tool);
  const context = { user: { id: 'customer', role: 'CUSTOMER' }, readOnly: true };
  for (const intent of [undefined, 'booking', 'payment', 'order', 'support', 'complaint']) {
    assert.ok(registry.forIntent(context, intent).some(item => item.name === 'get_repair_advice'));
  }
  for (const role of ['PROVIDER', 'ADMIN']) {
    assert.throws(() => registry.get('get_repair_advice', { user: { id: 'other', role } }));
  }
});
