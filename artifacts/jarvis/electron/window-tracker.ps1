Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
using System.Text;

public class Win32 {
    [DllImport("user32.dll")]
    public static extern IntPtr GetForegroundWindow();

    [DllImport("user32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    public static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);

    [StructLayout(LayoutKind.Sequential)]
    public struct RECT {
        public int Left;
        public int Top;
        public int Right;
        public int Bottom;
    }
}
"@

while ($true) {
    $hwnd = [Win32]::GetForegroundWindow()
    if ($hwnd -ne 0) {
        $rect = New-Object Win32+RECT
        $res = [Win32]::GetWindowRect($hwnd, [ref]$rect)
        if ($res) {
            $w = $rect.Right - $rect.Left
            $h = $rect.Bottom - $rect.Top
            Write-Host "$($rect.Left),$($rect.Top),$w,$h,$hwnd"
        }
    }
    Start-Sleep -Milliseconds 33
}
