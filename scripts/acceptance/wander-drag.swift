// synthetic drag-and-fling on the pet window (args: pid)
// events carry real timestamps so the engine dragTracker computes a nonzero
// release velocity (house rule: no timestamp -> velocity reads 0)
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

let start = CGPoint(x: f.midX, y: f.midY)
let end = CGPoint(x: f.midX + 300, y: f.midY - 120)  // up-right fling
let steps = 12
let stamp = { UInt64(ProcessInfo.processInfo.systemUptime * 1e9) }

func post(_ type: CGEventType, at p: CGPoint) {
    guard let ev = CGEvent(mouseEventSource: nil, mouseType: type, mouseCursorPosition: p, mouseButton: .left) else { return }
    ev.timestamp = stamp()
    ev.post(tap: .cghidEventTap)
}

post(.leftMouseDown, at: start)
for i in 1...steps {
    Thread.sleep(forTimeInterval: 0.016)
    let p = CGPoint(
        x: start.x + (end.x - start.x) * CGFloat(i) / CGFloat(steps),
        y: start.y + (end.y - start.y) * CGFloat(i) / CGFloat(steps)
    )
    post(.leftMouseDragged, at: p)
}
Thread.sleep(forTimeInterval: 0.016)
post(.leftMouseUp, at: end)
print("FLUNG \(start) -> \(end)")
