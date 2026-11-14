# Keeps Windows from going to standby while a long job runs (run-review.sh starts it). The screen may still turn off.
# It does not change the power plan: the request ends when the lock file is removed, after MaxHours, or when this process exits.
param(
    [Parameter(Mandatory = $true)][string]$LockFile,
    [int]$MaxHours = 12
)

Add-Type -Namespace Kit -Name Power -MemberDefinition '[DllImport("kernel32.dll")] public static extern uint SetThreadExecutionState(uint esFlags);'
$Continuous = [uint32]2147483648   # ES_CONTINUOUS
$SystemRequired = [uint32]1        # ES_SYSTEM_REQUIRED

$until = (Get-Date).AddHours($MaxHours)
[Kit.Power]::SetThreadExecutionState($Continuous -bor $SystemRequired) | Out-Null
try {
    while ((Test-Path -LiteralPath $LockFile) -and (Get-Date) -lt $until) { Start-Sleep -Seconds 30 }
}
finally {
    [Kit.Power]::SetThreadExecutionState($Continuous) | Out-Null
}
