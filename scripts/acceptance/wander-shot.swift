// capture the openpets pet window via CGWindowListCreateImage (args: [outpath])
import AppKit
import CoreGraphics
import Foundation

let out = CommandLine.arguments.count > 1 ? CommandLine.arguments[1] : "/tmp/pet-window.png"
guard let list = CGWindowListCopyWindowInfo([.optionOnScreenOnly], kCGNullWindowID) as? [[String: Any]] else { exit(1) }
for info in list {
    let owner = info[kCGWindowOwnerName as String] as? String ?? "?"
    guard owner.contains("openpets") else { continue }
    let b = info[kCGWindowBounds as String] as! [String: NSNumber]
    guard b["Width"]!.doubleValue > 40, b["Height"]!.doubleValue < 400 else { continue }
    let id = info[kCGWindowNumber as String] as! Int
    print("win \(id) at \(b["X"]!),\(b["Y"]!) \(b["Width"]!)x\(b["Height"]!)")
    guard let img = CGWindowListCreateImage(
        .null, .optionOnScreenBelowWindow, CGWindowID(id),
        [.bestResolution, .boundsIgnoreFraming]
    ) else {
        print("CGWindowListCreateImage nil")
        exit(2)
    }
    let rep = NSBitmapImageRep(cgImage: img)
    guard let data = rep.representation(using: NSBitmapImageRep.FileType.png, properties: [:]) else { exit(3) }
    try! data.write(to: URL(fileURLWithPath: out))
    print("saved \(out) \(img.width)x\(img.height)")
    exit(0)
}
print("no pet window")
exit(4)
