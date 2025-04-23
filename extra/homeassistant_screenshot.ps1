$Path = "\\HASS_IP\media"

# Make sure that the directory to keep screenshots has been created, otherwise create it
If (!(test-path $path)) {
  New-Item -ItemType Directory -Force -Path $path
}

Add-Type -AssemblyName System.Windows.Forms

$screen = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds

# Get the current screen resolution
$image = New-Object System.Drawing.Bitmap($screen.Width, $screen.Height)

# Create a graphic object
$graphic = [System.Drawing.Graphics]::FromImage($image)

$point = New-Object System.Drawing.Point(0, 0)

$graphic.CopyFromScreen($point, $point, $image.Size);

$cursorBounds = New-Object System.Drawing.Rectangle([System.Windows.Forms.Cursor]::Position, [System.Windows.Forms.Cursor]::Current.Size)

# Get a screenshot
[System.Windows.Forms.Cursors]::Default.Draw($graphic, $cursorBounds)

# $screen_file = "$Path\" + $env:computername + "_" + $env:username + "_" + "$((get-date).tostring('yyyy.MM.dd-HH.mm.ss')).png"
$screen_file = "$Path\" + $env:computername + "-screenshot.png"

# Save the screenshot as a PNG file
$image.Save($screen_file, [System.Drawing.Imaging.ImageFormat]::Png)