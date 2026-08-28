param(
  [string]$OutputPath = (Join-Path $PSScriptRoot '..\public\assets\duck-atlas.png')
)

Add-Type -AssemblyName System.Drawing

$resolvedOutput = [System.IO.Path]::GetFullPath($OutputPath)
$outputDirectory = [System.IO.Path]::GetDirectoryName($resolvedOutput)
[System.IO.Directory]::CreateDirectory($outputDirectory) | Out-Null

$bitmap = [System.Drawing.Bitmap]::new(1024, 640, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$graphics.Clear([System.Drawing.Color]::Transparent)

function New-Brush([string]$Hex) {
  return [System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml($Hex))
}

function New-Pen([string]$Hex, [float]$Width) {
  $pen = [System.Drawing.Pen]::new([System.Drawing.ColorTranslator]::FromHtml($Hex), $Width)
  $pen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
  return $pen
}

function Draw-Duck([int]$CellX, [int]$CellY, [string]$Pose, [int]$Band) {
  $x = $CellX * 128
  $y = $CellY * 128
  $outline = New-Pen '#B7772B' 4
  $yellow = New-Brush '#FFDE63'
  $yellowLight = New-Brush '#FFF1A0'
  $ink = New-Brush '#43342E'
  $orange = New-Brush '#F18A35'
  $milk = New-Brush '#FFFDF1'
  $blue = New-Pen '#5791AA' 3

  $bodyHeight = 52 - ($Band * 3)
  $graphics.FillEllipse($yellow, $x + 28, $y + 61 + ($Band * 3), 75, $bodyHeight)
  $graphics.DrawEllipse($outline, $x + 28, $y + 61 + ($Band * 3), 75, $bodyHeight)
  $graphics.FillEllipse($yellowLight, $x + 45, $y + 74 + ($Band * 3), 31, 24)
  $graphics.FillEllipse($yellow, $x + 23, $y + 19, 67, 66)
  $graphics.DrawEllipse($outline, $x + 23, $y + 19, 67, 66)
  $graphics.FillEllipse($ink, $x + 43, $y + 42, 7, 8)
  $graphics.FillEllipse($ink, $x + 67, $y + 42, 7, 8)

  if ($Pose -eq 'spew') {
    $graphics.FillEllipse($orange, $x + 49, $y + 58, 34, 13)
    $graphics.FillPie($milk, $x + 1, $y + 51, 56, 31, 325, 70)
  } else {
    $graphics.FillEllipse($orange, $x + 49, $y + 57, 36, 11)
  }

  if ($Pose -eq 'drink') {
    $graphics.TranslateTransform([float]($x + 90), [float]($y + 67))
    $graphics.RotateTransform(-43)
    $graphics.FillRectangle($milk, -9, -38, 23, 56)
    $graphics.DrawRectangle($blue, -9, -38, 23, 56)
    $graphics.ResetTransform()
  } elseif ($Pose -eq 'ready') {
    $graphics.FillRectangle($milk, $x + 89, $y + 39, 24, 64)
    $graphics.DrawRectangle($blue, $x + 89, $y + 39, 24, 64)
  } elseif ($Pose -eq 'success') {
    $graphics.TranslateTransform([float]($x + 91), [float]($y + 36))
    $graphics.RotateTransform(23)
    $graphics.FillRectangle($milk, -9, -32, 23, 58)
    $graphics.DrawRectangle($blue, -9, -32, 23, 58)
    $graphics.ResetTransform()
    $wing = New-Pen '#B7772B' 5
    $graphics.DrawArc($wing, $x + 72, $y + 42, 38, 45, 185, 125)
    $wing.Dispose()
  }

  $outline.Dispose(); $yellow.Dispose(); $yellowLight.Dispose(); $ink.Dispose(); $orange.Dispose(); $milk.Dispose(); $blue.Dispose()
}

function Draw-Bottle([int]$CellX, [int]$CellY, [float]$FillRatio) {
  $x = $CellX * 128
  $y = $CellY * 128
  $glass = New-Brush '#DDF6FA'
  $milk = New-Brush '#FFFDF1'
  $line = New-Pen '#5791AA' 4
  $cap = New-Brush '#69AFC7'
  $graphics.FillRectangle($glass, $x + 37, $y + 31, 54, 83)
  $graphics.DrawRectangle($line, $x + 37, $y + 31, 54, 83)
  $graphics.FillRectangle($cap, $x + 47, $y + 13, 34, 26)
  $graphics.FillRectangle($milk, $x + 43, $y + 107 - [int](68 * $FillRatio), 42, [int](68 * $FillRatio))
  $glass.Dispose(); $milk.Dispose(); $line.Dispose(); $cap.Dispose()
}

function Draw-Star([int]$CellX, [int]$CellY, [string]$Color) {
  $x = $CellX * 128 + 64
  $y = $CellY * 128 + 64
  $points = [System.Drawing.PointF[]]::new(16)
  for ($i = 0; $i -lt 16; $i++) {
    $angle = -[Math]::PI / 2 + $i * [Math]::PI / 8
    $radius = if ($i % 2 -eq 0) { 53 } else { 30 }
    $points[$i] = [System.Drawing.PointF]::new([float]($x + [Math]::Cos($angle) * $radius), [float]($y + [Math]::Sin($angle) * $radius))
  }
  $fill = New-Brush $Color
  $line = New-Pen '#A94832' 4
  $graphics.FillPolygon($fill, $points)
  $graphics.DrawPolygon($line, $points)
  $fill.Dispose(); $line.Dispose()
}

function Draw-Label([int]$CellX, [int]$CellY, [string]$Text, [string]$Color, [float]$Size) {
  $x = $CellX * 128
  $y = $CellY * 128
  $font = [System.Drawing.Font]::new('Arial Rounded MT Bold', $Size, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
  $fill = New-Brush $Color
  $format = [System.Drawing.StringFormat]::new()
  $format.Alignment = [System.Drawing.StringAlignment]::Center
  $format.LineAlignment = [System.Drawing.StringAlignment]::Center
  $graphics.DrawString($Text, $font, $fill, [System.Drawing.RectangleF]::new($x, $y, 128, 128), $format)
  $font.Dispose(); $fill.Dispose(); $format.Dispose()
}

Draw-Duck 0 0 'ready' 0
Draw-Duck 1 0 'success' 0
Draw-Duck 2 0 'idle' 0
Draw-Duck 3 0 'drink' 0
Draw-Duck 4 0 'spew' 0
Draw-Duck 5 0 'idle' 1
Draw-Duck 6 0 'drink' 1
Draw-Duck 7 0 'spew' 1
Draw-Duck 0 1 'idle' 2
Draw-Duck 1 1 'drink' 2
Draw-Duck 2 1 'spew' 2

Draw-Bottle 3 1 1.0
Draw-Bottle 4 1 0.66
Draw-Bottle 5 1 0.33
Draw-Bottle 6 1 0.0
Draw-Star 7 1 '#F6C945'
Draw-Star 0 2 '#E94B3F'
Draw-Label 1 2 'READY' '#F28A3D' 29
Draw-Label 2 2 'GO!' '#41A98B' 43

for ($digit = 0; $digit -le 9; $digit++) {
  $index = 19 + $digit
  $cellX = $index % 8
  $cellY = [Math]::Floor($index / 8)
  Draw-Label $cellX $cellY ([string]$digit) '#463730' 66
}

$bitmap.Save($resolvedOutput, [System.Drawing.Imaging.ImageFormat]::Png)
$graphics.Dispose()
$bitmap.Dispose()
Write-Output $resolvedOutput
