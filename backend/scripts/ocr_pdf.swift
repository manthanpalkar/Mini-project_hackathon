import Foundation
import PDFKit
import Vision

guard CommandLine.arguments.count > 1 else {
    print("Usage: ocr_pdf.swift <path-to-pdf>")
    exit(1)
}

let pdfPath = CommandLine.arguments[1]
let pdfURL = URL(fileURLWithPath: pdfPath)
guard let pdfDoc = PDFDocument(url: pdfURL) else {
    print("Cannot open PDF: \(pdfPath)")
    exit(1)
}

let pageCount = pdfDoc.pageCount
for i in 0..<pageCount {
    guard let page = pdfDoc.page(at: i) else { continue }
    let pageBounds = page.bounds(for: .mediaBox)
    
    // Render PDF page to CGImage
    let colorSpace = CGColorSpaceCreateDeviceRGB()
    let bitmapInfo = CGImageAlphaInfo.premultipliedLast.rawValue
    let width = Int(pageBounds.width * 2)
    let height = Int(pageBounds.height * 2)
    guard let context = CGContext(data: nil, width: width, height: height, bitsPerComponent: 8, bytesPerRow: 0, space: colorSpace, bitmapInfo: bitmapInfo) else {
        continue
    }
    context.scaleBy(x: 2.0, y: 2.0)
    page.draw(with: .mediaBox, to: context)
    guard let cgImage = context.makeImage() else { continue }

    let request = VNRecognizeTextRequest()
    request.recognitionLevel = .accurate
    request.usesLanguageCorrection = true

    let handler = VNImageRequestHandler(cgImage: cgImage, options: [:])
    try? handler.perform([request])

    guard let observations = request.results else { continue }
    print("--- PAGE \(i+1) ---")
    for obs in observations {
        let topCandidate = obs.topCandidates(1).first?.string ?? ""
        print(topCandidate)
    }
}
