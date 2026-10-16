param([switch]$Apply)

$ErrorActionPreference = 'Stop'
$taskConnection = Read-Host 'Nhập kết nối MongoDB Atlas đã xác thực (nội dung được ẩn)' -AsSecureString
$taskPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($taskConnection)
try {
    $env:HANDIGO_MONGO_URI = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($taskPointer)
    if ($Apply) {
        & node (Join-Path $PSScriptRoot 'update-content.cjs') --apply
    } else {
        & node (Join-Path $PSScriptRoot 'update-content.cjs')
    }
    if ($LASTEXITCODE -ne 0) { throw 'Script chưa hoàn tất. Xem thông báo ở trên.' }
} finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($taskPointer)
    Remove-Item Env:HANDIGO_MONGO_URI -ErrorAction SilentlyContinue
    $taskConnection.Dispose()
}
