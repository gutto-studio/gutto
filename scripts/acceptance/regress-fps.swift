// P0 帧率验收：ScreenCaptureKit 单窗口 60fps 流（2026-10-04 帧率根治轮）
// 用法：regress-fps <wid> <seconds> <outdir>
// SCStream desktopIndependentWindow 捕宠物窗口，minimumFrameInterval=1/60；
// 每帧存 raw RGBA + stamps.txt（hostTime ns + 帧号）——python 侧帧差 gap 直方图。
// 注：CGDisplayStream 在 macOS 26 SDK 已 unavailable；screencapture 静态全屏
// 合成拍不到 statusBar 层的她（第十一轮坑），单窗口 SCStream 是正道。
import AppKit
import CoreGraphics
import CoreVideo
import Foundation
import ScreenCaptureKit

let args = CommandLine.arguments
guard args.count >= 4,
      let wid = UInt32(args[1]),
      let seconds = Double(args[2]) else {
    FileHandle.standardError.write(Data("usage: regress-fps <wid> <seconds> <outdir>\n".utf8))
    exit(2)
}
let outdir = URL(fileURLWithPath: args[3])
try? FileManager.default.createDirectory(at: outdir, withIntermediateDirectories: true)

// CGS_REQUIRE_INIT 断言修复：SCShareableContent 需要 GUI app 上下文，
// 裸 CLI 工具得先把 NSApplication 拉起来（prohibited = 不抢 Dock/焦点）
let app = NSApplication.shared
app.setActivationPolicy(.prohibited)

final class Sink: NSObject, SCStreamOutput, @unchecked Sendable {
    var count = 0
    let lock = NSLock()
    let stampPath = outdir.appendingPathComponent("stamps.txt").path

    override init() {
        super.init()
        FileManager.default.createFile(atPath: stampPath, contents: nil)
    }

    func stream(_ stream: SCStream, didOutputSampleBuffer sampleBuffer: CMSampleBuffer, of type: SCStreamOutputType) {
        guard type == .screen, sampleBuffer.isValid else {
            FileHandle.standardError.write(Data("drop: type/valid\n".utf8)); return
        }
        let attachArray = CMSampleBufferGetSampleAttachmentsArray(sampleBuffer, createIfNecessary: false)
        var frameStatus: SCFrameStatus = .complete
        if let dicts = attachArray as? [[SCStreamFrameInfo: Any]],
           let props = dicts.first,
           let statusRaw = props[SCStreamFrameInfo.status] as? Int,
           let parsed = SCFrameStatus(rawValue: statusRaw) {
            frameStatus = parsed
        } else if let dicts2 = attachArray as? [[String: Any]],
                  let props = dicts2.first,
                  let statusRaw = props[SCStreamFrameInfo.status.rawValue] as? Int,
                  let parsed = SCFrameStatus(rawValue: statusRaw) {
            frameStatus = parsed
        } else {
            FileHandle.standardError.write(Data("attach-unparsed count=\(attachArray.map { CFArrayGetCount($0) } ?? -1)\n".utf8))
        }
        guard frameStatus == .complete else {
            FileHandle.standardError.write(Data("status=\(frameStatus) raw=\(frameStatus.rawValue)\n".utf8)); return
        }
        guard let pixelBuffer = CMSampleBufferGetImageBuffer(sampleBuffer) else {
            FileHandle.standardError.write(Data("drop: pixelbuffer\n".utf8)); return
        }
        let hostTime = sampleBuffer.presentationTimeStamp.value

        let ci = CIImage(cvPixelBuffer: pixelBuffer)
        let w = Int(ci.extent.width), h = Int(ci.extent.height)
        guard w > 0, h > 0, let cg = ci.cgImage else { return }
        lock.lock()
        let idx = count
        count += 1
        let path = outdir.appendingPathComponent(String(format: "f%04d.rgba", idx)).path
        if let ctx = CGContext(
            data: nil, width: w, height: h,
            bitsPerComponent: 8, bytesPerRow: w * 4,
            space: CGColorSpaceCreateDeviceRGB(),
            bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
        ) {
            ctx.interpolationQuality = .none
            ctx.draw(cg, in: CGRect(x: 0, y: 0, width: w, height: h))
            if let data = ctx.data {
                _ = data.withMemoryRebound(to: UInt8.self, capacity: w * h * 4) { ptr in
                    try? Data(bytes: ptr, count: w * h * 4).write(to: URL(fileURLWithPath: path))
                }
            }
        }
        if let handle = FileHandle(forWritingAtPath: stampPath) {
            _ = try? handle.seekToEnd()
            try? handle.write(contentsOf: Data("\(hostTime) \(idx) \(w) \(h)\n".utf8))
            try? handle.close()
        }
        lock.unlock()
    }
}

let semGet = DispatchSemaphore(value: 0)
var targetWindow: SCWindow?
Task { @MainActor in
    let content = try? await SCShareableContent.excludingDesktopWindows(false, onScreenWindowsOnly: true)
    targetWindow = content?.windows.first { $0.windowID == CGWindowID(wid) }
    semGet.signal()
}
func spinWait(_ sem: DispatchSemaphore) {
    while sem.wait(timeout: .now() + 0.05) == .timedOut {
        RunLoop.current.run(mode: .default, before: Date().addingTimeInterval(0.05))
    }
}
spinWait(semGet)
guard let window = targetWindow else {
    FileHandle.standardError.write(Data("window \(wid) not found / no TCC screen-recording grant\n".utf8))
    exit(3)
}

let config = SCStreamConfiguration()
config.minimumFrameInterval = CMTime(value: 1, timescale: 60)
config.showsCursor = false
config.capturesAudio = false
config.queueDepth = 8

let filter = SCContentFilter(desktopIndependentWindow: window)
let sink = Sink()
let stream = SCStream(filter: filter, configuration: config, delegate: nil)
let addSem = DispatchSemaphore(value: 0)
var addError: Error?
Task { @MainActor in
    do {
        try await stream.addStreamOutput(sink, type: .screen, sampleHandlerQueue: DispatchQueue(label: "fps-q"))
        try await stream.startCapture()
    } catch {
        addError = error
    }
    addSem.signal()
}
spinWait(addSem)
if let addError {
    FileHandle.standardError.write(Data("start failed: \(addError)\n".utf8))
    exit(5)
}
FileHandle.standardError.write(Data("streaming \(seconds)s...\n".utf8))
// 录制期主线程泵 runloop（@MainActor 续作依赖它；SCStream 帧回调在 fps-q 队列）
let doneAt = Date().addingTimeInterval(seconds)
while Date() < doneAt {
    RunLoop.current.run(mode: .default, before: Date().addingTimeInterval(0.1))
}
let stopSem = DispatchSemaphore(value: 0)
Task { @MainActor in
    try? await stream.stopCapture()
    stopSem.signal()
}
spinWait(stopSem)
Thread.sleep(forTimeInterval: 0.4)
print("FRAMES \(sink.count)")
