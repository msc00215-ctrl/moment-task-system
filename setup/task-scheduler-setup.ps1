# MOMENT タスクスケジューラー 自動設定スクリプト
# 実行方法: PowerShell を管理者権限で開いて実行
# .\task-scheduler-setup.ps1

$NodePath = "C:\Program Files\nodejs\node.exe"
$ScriptDir = "C:\Users\momose-o-25sf\moment-task-system"
$Script = "scripts\obsidian-sync.js"

# 朝 6:00 — データ同期
$Action1 = New-ScheduledTaskAction -Execute $NodePath -Argument "$Script --action sync-tasks" -WorkingDirectory $ScriptDir
$Trigger1 = New-ScheduledTaskTrigger -Daily -At "06:00"
Register-ScheduledTask -TaskName "MOMENT_朝同期" -Action $Action1 -Trigger $Trigger1 -RunLevel Highest -Force
Write-Host "✅ 朝6時 同期タスク登録完了"

# 昼 12:00 — 判定学習
$Action2 = New-ScheduledTaskAction -Execute $NodePath -Argument "$Script --action analyze-decisions" -WorkingDirectory $ScriptDir
$Trigger2 = New-ScheduledTaskTrigger -Daily -At "12:00"
Register-ScheduledTask -TaskName "MOMENT_昼判定学習" -Action $Action2 -Trigger $Trigger2 -RunLevel Highest -Force
Write-Host "✅ 昼12時 判定学習タスク登録完了"

# 夜 22:00 — ダッシュボード生成
$Action3 = New-ScheduledTaskAction -Execute $NodePath -Argument "$Script --action generate-dashboard" -WorkingDirectory $ScriptDir
$Trigger3 = New-ScheduledTaskTrigger -Daily -At "22:00"
Register-ScheduledTask -TaskName "MOMENT_夜ダッシュボード" -Action $Action3 -Trigger $Trigger3 -RunLevel Highest -Force
Write-Host "✅ 夜22時 ダッシュボードタスク登録完了"

Write-Host ""
Write-Host "🎉 全3タスク自動実行スケジュール設定完了！"
Write-Host "  朝6時  → データ同期"
Write-Host "  昼12時 → 判定学習"
Write-Host "  夜22時 → ダッシュボード生成"
