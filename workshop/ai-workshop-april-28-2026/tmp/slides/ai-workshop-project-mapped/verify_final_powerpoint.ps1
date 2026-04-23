$ErrorActionPreference = "Stop"

$File = "C:\Users\anantha.shayana\Downloads\AI_Workshop_Project_Mapped_Showcase.pptx"
$ppt = $null
$deck = $null
try {
  $ppt = New-Object -ComObject PowerPoint.Application
  $ppt.DisplayAlerts = 1
  $ppt.Visible = -1
  $deck = $ppt.Presentations.Open($File, -1, 0, 0)
  Write-Output "Slides=$($deck.Slides.Count)"
  Write-Output "SlideWidth=$($deck.PageSetup.SlideWidth)"
  Write-Output "SlideHeight=$($deck.PageSetup.SlideHeight)"
} finally {
  if ($deck -ne $null) {
    $deck.Close() | Out-Null
    [System.Runtime.InteropServices.Marshal]::ReleaseComObject($deck) | Out-Null
  }
  if ($ppt -ne $null) {
    $ppt.Quit()
    [System.Runtime.InteropServices.Marshal]::ReleaseComObject($ppt) | Out-Null
  }
  [GC]::Collect()
  [GC]::WaitForPendingFinalizers()
}
