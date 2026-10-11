// one synthetic click on the pet window (args: pid)
import AppKit
import CoreGraphics
import Foundation

let pid = Int(CommandLine.arguments.count > 1 ? CommandLine.arguments[1] : "0") ?? 0
guard let list = CGWindowListCopyWindowInfo([.optionOnScreenOnly], kCGNullWindowID) as? [[String: Any]] else { exit(1) }
var best: CGRect?
for info in list {
    guard (info[kCGWindowOwnerPID as String] as? Int) == pid,
          let b = info[kCGWindowBounds as String] as? [String: NSNumber]
    else { continue }
    let f = CGRect(x: b["X"]!.doubleValue, y: b["Y"]!.doubleValue, width: b["Width"]!.doubleValue, height: b["Height"]!.doubleValue)
    if f.width > 40, f.height > 40, f.height < 400, best == nil || f.width * f.height < best!.width * best!.height {
        best = f
    }
}
guard let f = best else { print("NO WINDOW"); exit(1) }
let c = CGPoint(x: f.midX, y: f.midY)
let stamp = { UInt64(ProcessInfo.processInfo.systemUptime * 1e9) }
if let down = CGEvent(mouseEventSource: nil, mouseType: .leftMouseDown, mouseCursorPosition: c, mouseButton: .left) {
    down.timestamp = stamp()
    down.post(tap: .cghidEventTap)
}
Thread.sleep(forTimeInterval: 0.08)
if let up = CGEvent(mouseEventSource: nil, mouseType: .leftMouseUp, mouseCursorPosition: c, mouseButton: .left) {
    up.timestamp = stamp()
    up.post(tap: .cghidEventTap)
}
print("CLICKED (\(Int(c.x)), \(Int(c.y)))")
