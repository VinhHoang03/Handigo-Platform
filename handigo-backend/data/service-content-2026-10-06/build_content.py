import json
from pathlib import Path

root = Path(__file__).resolve().parent
source = json.loads((root / 'content-source.json').read_text(encoding='utf-8'))
downloads = Path('C:/Users/gamer/Downloads')
patch = {'categories': [], 'services': []}
report = ['# Nội dung danh mục và dịch vụ', '', 'Bản xuất gồm 11 danh mục và 33 dịch vụ. Mỗi dịch vụ có 6 bước. Script cập nhật toàn bộ bản ghi trong hai file, bao gồm dịch vụ đã xóa mềm hoặc tạm ngừng hoạt động; giữ nguyên trạng thái hiện có.', '', 'Mô tả về máy giặt, tủ lạnh, tivi và thiết bị được viết theo phạm vi kiểm tra/sửa chữa dựa trên danh mục và loại giá hiện có. Các hạng mục thực hiện phải được xác nhận khi khảo sát.', '']

for collection in ('categories', 'services'):
    docs = json.loads((downloads / f'FixNow.{collection}.json').read_text(encoding='utf-8-sig'))
    assert {d['name'] for d in docs} == set(source[collection]), 'Nội dung chưa khớp tên trong bản xuất'
    for doc in docs:
        old = {key: doc[key] for key in ('description', 'processSteps') if key in doc}
        if collection == 'categories':
            fields = {'description': source[collection][doc['name']]}
        else:
            intro, *specific = source[collection][doc['name']]
            pricing = ('Chi phí sửa chữa, vật tư và hạng mục phát sinh phụ thuộc kết quả khảo sát và phải được khách hàng đồng ý trước khi thực hiện.' if doc['serviceType'] == 'variable_price' else 'Phạm vi áp dụng đơn giá được xác nhận theo dịch vụ và số lượng hoặc khối lượng đã chọn; hạng mục ngoài phạm vi cần được thông báo và thống nhất riêng trước khi thực hiện.')
            steps = [{'title': 'Xác nhận yêu cầu và điều kiện thực hiện', 'description': 'Trao đổi triệu chứng hoặc nhu cầu, xác nhận phạm vi, vị trí và điều kiện tiếp cận. Ghi nhận hiện trạng cùng các vật dụng cần bảo vệ trước khi thao tác.'}]
            for index, text in enumerate(specific):
                title, description = text.split('|')
                steps.append({'title': title, 'description': description})
                if index == 0:
                    steps.append({'title': 'Thống nhất phương án và phạm vi công việc', 'description': 'Thông báo kết quả khảo sát, công việc có thể thực hiện, giới hạn và thời gian dự kiến. Xác nhận chi phí, vật tư hoặc hạng mục phát sinh nếu có; chỉ thực hiện khi khách hàng đồng ý.'})
            steps.append({'title': 'Nghiệm thu và hướng dẫn sau dịch vụ', 'description': 'Cùng khách hàng kiểm tra kết quả trong phạm vi đã thống nhất, ghi nhận phần cần theo dõi hoặc chưa thể xử lý. Thu dọn khu vực thao tác và hướng dẫn sử dụng, bảo quản hoặc phòng ngừa phù hợp với công việc vừa hoàn tất.'})
            fields = {'description': intro + ' ' + pricing + ' Kết quả được kiểm tra cùng khách hàng và có hướng dẫn theo dõi sau dịch vụ.', 'processSteps': steps}
            assert len(steps) == 6
            assert all(0 < len(s['title']) <= 120 and 0 < len(s['description']) <= 2000 for s in steps)
        assert len(fields['description']) >= 200
        patch[collection].append({'id': doc['_id']['$oid'], 'name': doc['name'], 'isDeleted': doc.get('isDeleted', False), 'previous': old, 'set': fields})
        doc.update(fields)
        report.extend([f"## {doc['name']}" + (' — cập nhật nội dung, giữ trạng thái đã xóa mềm' if doc.get('isDeleted') else ''), '', fields['description'], ''])
        for i, step in enumerate(fields.get('processSteps', []), 1):
            report.extend([f"{i}. **{step['title']}:** {step['description']}"])
        report.append('')
    (root / f'FixNow.{collection}.enriched.json').write_text(json.dumps(docs, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

(root / 'content-update.json').write_text(json.dumps(patch, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
(root / 'noi-dung.md').write_text('\n'.join(report), encoding='utf-8')

# Shell trong giao diện có thể không hỗ trợ load hoặc truy cập filesystem.
shell = (root / 'update-content.mongosh.js').read_text(encoding='utf-8')
start = shell.index("  const fs = require('fs');")
end = shell.index("  const target = db.getSiblingDB('FixNow');")
shell = shell[:start] + '  const payload = ' + json.dumps(patch, ensure_ascii=False, indent=2) + ';\n' + shell[end:]
shell = shell.replace('// Chạy bằng load(...) trong MongoDB Shell đã kết nối với cụm chứa FixNow.', '// Sao chép TOÀN BỘ file và dán trực tiếp vào MongoDB Shell đang kết nối tới FixNow.')
shell = shell.replace("  const backupPath = `${directory}/backup-mongosh-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;\n  fs.writeFileSync(backupPath, EJSON.stringify(backup, null, 2), { flag: 'wx' });", "  const backupResult = await target.getCollection('handigo_content_backups').insertOne({ ...backup, source: 'service-content-2026-10-06' });\n  print(`Đã sao lưu tại FixNow.handigo_content_backups, ID: ${backupResult.insertedId}`);")
shell = shell.replace('  print(`File sao lưu: ${backupPath}`);', "  print(`Bản sao lưu: FixNow.handigo_content_backups, ID: ${backupResult.insertedId}`);")
shell = shell.replace('await ', '').replace('async function ', 'function ').replace('async ()', '()')
shell = shell.replace('// Sao chép TOÀN BỘ file và dán trực tiếp vào MongoDB Shell đang kết nối tới FixNow.', '// Dán toàn bộ file vào một dòng lệnh MỚI của MongoDB Shell. File UTF-8 không BOM.\n// mongosh tự chờ các lệnh database; không thêm async/await vào bản này.')
assert 'require(' not in shell and 'fs.' not in shell and 'backupPath' not in shell and '\ufeff' not in shell
(root / 'paste-into-mongosh.js').write_text(shell, encoding='utf-8')
print(json.dumps({'danh_muc': len(patch['categories']), 'dich_vu': len(patch['services']), 'dich_vu_cap_nhat_mongo': len(patch['services']), 'so_buoc_moi_dich_vu': 6}, ensure_ascii=False))
