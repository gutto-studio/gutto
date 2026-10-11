// one tiny keep-awake mouseMoved (real timestamp per house rule)
import AppKit
import CoreGraphics
import Foundation

let loc = NSEvent.mouseLocation
let t = CGPoint(x: loc.x + Double.random(in: -40...40), y: max(40, loc.y + Double.random(in: -20...20)))
if let ev = CGEvent(mouseEventSource: nil, mouseType: .mouseMoved, mouseCursorPosition: t, mouseButton: .left) {
    ev.timestamp = UInt64(ProcessInfo.processInfo.systemUptime * 1e9)
    ev.post(tap: .cghidEventTap)
}
