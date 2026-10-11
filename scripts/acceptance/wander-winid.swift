import CoreGraphics
import Foundation
let list = CGWindowListCopyWindowInfo([.optionOnScreenOnly], kCGNullWindowID) as! [[String: Any]]
for info in list {
    if (info[kCGWindowOwnerPID as String] as? Int) == Int(CommandLine.arguments[1]) {
        let b = info[kCGWindowBounds as String] as! [String: NSNumber]
        if b["Width"]!.doubleValue > 40 && b["Height"]!.doubleValue > 40 && b["Height"]!.doubleValue < 400 {
            print(info[kCGWindowNumber as String] as! Int)
            break
        }
    }
}
