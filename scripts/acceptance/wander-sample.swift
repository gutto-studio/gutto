// gutto wander acceptance sampler (2026-10-03):
//  - posts a tiny mouseMoved every 10s (with a real timestamp!) so the night
//    sleep watchdog (15s bar, 23:00-05:00) can't doze her off mid-acceptance
//  - samples the pet window origin every 2s for N seconds
//  - prints a CSV-ish trail + a segment summary (moves vs holds)
import AppKit
import CoreGraphics
import Foundation

let pid = Int(CommandLine.arguments.count > 1 ? CommandLine.arguments[1] : "0") ?? 0
let seconds = Double(CommandLine.arguments.count > 2 ? CommandLine.arguments[2] : "150") ?? 150

func petWindowFrame() -> CGRect? {
    guard let list = CGWindowListCopyWindowInfo([.optionOnScreenOnly], kCGNullWindowID) as? [[String: Any]] else { return nil }
    var best: CGRect?
    for info in list {
        guard (info[kCGWindowOwnerPID as String] as? Int) == pid,
              let bounds = info[kCGWindowBounds as String] as? [String: NSNumber]
        else { continue }
        let frame = CGRect(
            x: bounds["X"]?.doubleValue ?? 0,
            y: bounds["Y"]?.doubleValue ?? 0,
            width: bounds["Width"]?.doubleValue ?? 0,
            height: bounds["Height"]?.doubleValue ?? 0
        )
        // the pet window is the small square one; message/surface panels are
        // either zero-size or taller strips — keep the smallest non-trivial
        if frame.width > 40, frame.height > 40, frame.height < 400 {
            if best == nil || frame.width * frame.height < best!.width * best!.height {
                best = frame
            }
        }
    }
    return best
}

func keepAwake() {
    let loc = NSEvent.mouseLocation
    let target = CGPoint(x: loc.x + Double.random(in: -40...40), y: max(40, loc.y + Double.random(in: -20...20)))
    guard let ev = CGEvent(mouseEventSource: nil, mouseType: .mouseMoved, mouseCursorPosition: target, mouseButton: .left) else { return }
    ev.timestamp = UInt64(ProcessInfo.processInfo.systemUptime * 1e9)
    ev.post(tap: .cghidEventTap)
}

var samples: [(t: Double, x: Double, y: Double)] = []
let start = Date()
var lastKeepAwake = Date.distantPast

while Date().timeIntervalSince(start) < seconds {
    if Date().timeIntervalSince(lastKeepAwake) > 10 {
        keepAwake()
        lastKeepAwake = Date()
    }
    if let frame = petWindowFrame() {
        samples.append((Date().timeIntervalSince(start), frame.minX, frame.maxY))
    }
    Thread.sleep(forTimeInterval: 2)
}

print("t(s)\tpetX\tpetY(top)")
for s in samples {
    print(String(format: "%.0f\t%.0f\t%.0f", s.t, s.x, s.y))
}

// segment summary: group consecutive samples into moves (x drifting > 8pt)
// and holds
print("\n--- segments ---")
if !samples.isEmpty {
    var segStart = 0
    var moving = false
    for i in 1..<samples.count {
        let dx = abs(samples[i].x - samples[i - 1].x)
        let isMoving = dx > 8
        if isMoving != moving {
            let seg = samples[segStart..<i]
            let span = samples[i - 1].x - samples[segStart].x
            print(String(format: "%.0f-%.0fs %@ (%.0f -> %.0f, %+.0fpt)", seg.first!.t, samples[i-1].t, moving ? "MOVE" : "HOLD", seg.first!.x, samples[i-1].x, span))
            segStart = i
            moving = isMoving
        }
        moving = isMoving
    }
    let seg = samples[segStart...]
    print(String(format: "%.0f-%.0fs %@ (%.0f -> %.0f)", seg.first!.t, samples.last!.t, moving ? "MOVE" : "HOLD", seg.first!.x, samples.last!.x))
}
