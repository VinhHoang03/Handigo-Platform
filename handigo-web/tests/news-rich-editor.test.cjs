const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const { Editor } = require('@tiptap/core');
const root = path.join(__dirname, '../src');
const compile = filename => ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText;
const rich = {};
vm.runInNewContext(compile(path.join(root, 'features/content/utils/newsRichContent.ts')), { exports: rich, URL });
const backend = {};
vm.runInNewContext(compile(path.join(__dirname, '../../handigo-backend/src/utils/newsRichContent.ts')), { exports: backend, URL });
const extensions = {};
new Function('exports', 'require', compile(path.join(root, 'features/admin/components/news/newsEditorExtensions.ts')))(
  extensions, name => name.startsWith('@/') ? rich : require(name),
);
const createEditor = (content = [{ type: 'paragraph', text: 'Nội dung Handigo' }]) => new Editor({
  element: null, extensions: extensions.newsEditorExtensions(), content: rich.newsRichContentFromBlocks(content),
});

test('Bôi chọn một phần rồi định dạng không ảnh hưởng phần chữ còn lại', () => {
  const editor = createEditor();
  try {
    editor.commands.setTextSelection({ from: 1, to: 9 });
    editor.commands.setBold(); editor.commands.setItalic(); editor.commands.setUnderline(); editor.commands.setStrike();
    editor.commands.setFontFamily('Times New Roman'); editor.commands.setFontSize('24px');
    editor.commands.setColor('#ff0000'); editor.commands.setBackgroundColor('#ffff00'); editor.commands.setLineHeight('1.5');
    editor.commands.setTextAlign('center');
    const doc = rich.normalizeNewsRichContent(editor.getJSON());
    const paragraph = doc.content[0];
    assert.equal(paragraph.attrs.textAlign, 'center');
    assert.equal(paragraph.content[0].text, 'Nội dung');
    assert.equal(paragraph.content[1].text, ' Handigo');
    assert.equal(paragraph.content[1].marks, undefined);
    const marks = paragraph.content[0].marks;
    for (const name of ['bold', 'italic', 'underline', 'strike']) assert(marks.some(mark => mark.type === name));
    const style = marks.find(mark => mark.type === 'textStyle').attrs;
    assert.equal(style.fontFamily, 'Times New Roman'); assert.equal(style.fontSize, '24px');
    assert.equal(style.backgroundColor, '#ffff00'); assert.equal(style.lineHeight, '1.5');
    assert(backend.isNewsRichContent(doc));
  } finally { editor.destroy(); }
});

test('Đủ bốn kiểu căn lề, ba cấp tiêu đề và liên kết được backend chấp nhận', () => {
  const editor = createEditor();
  try {
    editor.commands.setTextSelection({ from: 1, to: 9 });
    editor.commands.setLink({ href: 'https://example.com/tin-tuc' });
    for (const align of ['left', 'center', 'right', 'justify']) {
      for (const level of [1, 2, 3]) {
        editor.commands.setHeading({ level }); editor.commands.setTextAlign(align);
        const doc = rich.normalizeNewsRichContent(editor.getJSON());
        assert.equal(doc.content[0].attrs.level, level); assert.equal(doc.content[0].attrs.textAlign, align);
        assert(backend.isNewsRichContent(doc));
      }
    }
    editor.commands.unsetLink();
    assert(!JSON.stringify(editor.getJSON()).includes('https://example.com'));
  } finally { editor.destroy(); }
});

test('Danh sách đánh số/dấu chấm, trích dẫn và đường kẻ giữ qua vòng JSON', () => {
  for (const command of ['toggleBulletList', 'toggleOrderedList', 'toggleBlockquote', 'setHorizontalRule']) {
    const editor = createEditor();
    try {
      editor.commands[command]();
      const doc = rich.normalizeNewsRichContent(editor.getJSON());
      assert(backend.isNewsRichContent(doc), command);
      const restored = new Editor({ element: null, extensions: extensions.newsEditorExtensions(), content: JSON.parse(JSON.stringify(doc)) });
      assert.equal(restored.getText(), editor.getText()); restored.destroy();
    } finally { editor.destroy(); }
  }
});

test('Chuyển bài cũ vào editor giữ chữ, xuống dòng và danh sách', () => {
  const blocks = [{ type: 'heading', text: 'Đề mục' }, { type: 'paragraph', text: 'Dòng một\nDòng hai' },
    { type: 'quote', text: 'Ghi nhớ' }, { type: 'list', items: ['Một', 'Hai'] }];
  const doc = rich.newsRichContentFromBlocks(blocks);
  assert(backend.isNewsRichContent(doc));
  assert.equal(JSON.stringify(rich.newsBlocksFromRichContent(doc)), JSON.stringify(blocks));
});

test('Lưu và khôi phục JSON giữ định dạng; bản chữ thuần không chứa HTML', () => {
  const editor = createEditor();
  try {
    editor.commands.selectAll(); editor.commands.setBold(); editor.commands.setFontSize('32px');
    const doc = rich.normalizeNewsRichContent(editor.getJSON());
    const stored = JSON.parse(JSON.stringify(doc));
    assert(rich.isNewsRichDocument(stored)); assert(backend.isNewsRichContent(stored));
    assert.equal(JSON.stringify(stored), JSON.stringify(doc));
    assert.equal(rich.newsBlocksFromRichContent(stored)[0].text, 'Nội dung Handigo');
  } finally { editor.destroy(); }
});

test('Chuẩn hóa nội dung dán bỏ URL và CSS không an toàn, giữ chữ', () => {
  const doc = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Vẫn giữ nội dung', marks: [
    { type: 'link', attrs: { href: 'javascript:alert(1)' } },
    { type: 'textStyle', attrs: { fontFamily: 'khong-ho-tro', color: 'url(https://example.com)', fontSize: '999px' } },
  ] }] }] };
  const clean = rich.normalizeNewsRichContent(doc);
  assert(backend.isNewsRichContent(clean));
  assert(!JSON.stringify(clean).includes('javascript:')); assert(!JSON.stringify(clean).includes('url('));
  assert.equal(rich.newsBlocksFromRichContent(clean)[0].text, 'Vẫn giữ nội dung');
});

test('Nháp sai cấu trúc không được đưa vào editor', () => {
  assert(!rich.isNewsRichDocument({ type: 'doc', content: [{ type: 'text', text: 'Sai cấp' }] }));
  assert(!rich.isNewsRichDocument({ type: 'doc', content: [{ type: 'orderedList', content: [{ type: 'paragraph' }] }] }));
});
