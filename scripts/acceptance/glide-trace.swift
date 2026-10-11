// fling the pet hard and record full x/y trace to see where the time goes
import AppKit
import CoreGraphics
import Foundation

let pid = Int(CommandLine.arguments[1])!

func frame() -> CGRect? {
    guard let list = CGWindowListCopyWindowInfo([.optionOnScreenOnly], kCGNullWindowID) as? [[String: Any]] else { return nil }
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
    return best
}

func post(_ type: CGEventType, at p: CGPoint) {
    guard let ev = CGEvent(mouseEventSource: nil, mouseType: type, mouseCursorPosition: p, mouseButton: .left) else { return }
    ev.timestamp = UInt64(ProcessInfo.processInfo.systemUptime * 1e9)
    ev.post(tap: .cghidEventTap)
}

guard let f = frame() else { print("NO WINDOW"); exit(1) }
let start = CGPoint(x: f.midX, y: f.midY)
let end = CGPoint(x: f.midX + 420, y: f.midY - 200)
let steps = 14
post(.leftMouseDown, at: start)
for i in 1...steps {
    Thread.sleep(forTimeInterval: 0.014)
    post(.leftMouseDragged, at: CGPoint(
        x: start.x + (end.x - start.x) * CGFloat(i) / CGFloat(steps),
        y: start.y + (end.y - start.y) * CGFloat(i) / CGFloat(steps)
    ))
}
Thread.sleep(forTimeInterval: 0.014)
post(.leftMouseUp, at: end)

let t0 = Date()
var lastX = -1.0
var lastY = -1.0
var lines: [String] = []
while Date().timeIntervalSince(t0) < 12 {
    Thread.sleep(forTimeInterval: 0.2)
    guard let f = frame() else { continue }
    let x = f.minX, y = f.minY
    lines.append(String(format: "%.1f  x=%4.0f y=%4.0f%@", Date().timeIntervalSince(t0), x, y, (abs(x-lastX) < 0.5 && abs(y-lastY) < 0.5) ? "  still" : ""))
    lastX = x; lastY = y
}
print(lines.joined(separator: "\n"))
