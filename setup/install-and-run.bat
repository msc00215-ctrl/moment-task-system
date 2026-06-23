@echo off
chcp 65001 > nul
echo.
echo ╔══════════════════════════════════════╗
echo ║  MOMENT Obsidian 同期 セットアップ  ║
echo ╚══════════════════════════════════════╝
echo.

cd /d C:\Users\momose-o-25sf\moment-task-system

echo [1/3] パッケージインストール中...
npm install googleapis google-auth-library
echo.

echo [2/3] テスト実行（Google Sheets 認証なしで動作確認）...
node scripts\obsidian-sync.js --action analyze-decisions
echo.

echo [3/3] スケジューラー設定...
powershell -ExecutionPolicy Bypass -File setup\task-scheduler-setup.ps1
echo.

echo ✅ セットアップ完了！
echo.
echo 次のステップ:
echo   1. config\google-credentials.json を配置
echo   2. scripts\obsidian-sync.js の googleSheetsId を設定
echo   3. 「📡 今すぐデータ同期」ボタンをクリック
echo.
pause
