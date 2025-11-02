// Updated, more robust convertPdfToImage
import type { PdfConversionResult } from "./types"; // adapt path

let pdfjsLib: any = null;
let loadPromise: Promise<any> | null = null;

async function loadPdfJs(): Promise<any> {
    if (pdfjsLib) return pdfjsLib;
    if (loadPromise) return loadPromise;

    // Use the legacy build for browser usage
    loadPromise = import("pdfjs-dist/legacy/build/pdf").then((lib) => {
        // Option A (recommended for Vite / modern bundlers)
        // lib.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.js', import.meta.url).toString();

        // Option B (if you placed worker in public/)
        lib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.js";

        pdfjsLib = lib;
        return lib;
    }).catch(err => {
        console.error("Failed to import pdfjs-dist:", err);
        throw err;
    });

    return loadPromise;
}

function computeScaleForMaxPixels(viewportWidth: number, viewportHeight: number, desiredMaxPixels = 3_000_000) {
    // target area = (width*scale) * (height*scale) <= desiredMaxPixels
    // scale^2 <= desiredMaxPixels / (width*height)
    const pagePixels = viewportWidth * viewportHeight;
    const maxScale = Math.sqrt(desiredMaxPixels / Math.max(1, pagePixels));
    // clamp between 0.5 and 3 (you can adjust)
    return Math.max(0.5, Math.min(3, maxScale));
}

export async function convertPdfToImage(file: File): Promise<PdfConversionResult> {
    try {
        const lib = await loadPdfJs();

        // quick guard: ensure it's a PDF
        if (!file.type.includes("pdf") && !file.name.toLowerCase().endsWith(".pdf")) {
            return { imageUrl: "", file: null, error: "File is not a PDF" };
        }

        const arrayBuffer = await file.arrayBuffer();
        const pdfDoc = await lib.getDocument({ data: arrayBuffer }).promise;

        // get first page (you can iterate pages if needed)
        const page = await pdfDoc.getPage(1);

        // get a default viewport (scale 1) to compute natural size
        const baseViewport = page.getViewport({ scale: 1 });
        // compute safe scale to avoid huge canvas
        const safeScale = computeScaleForMaxPixels(baseViewport.width, baseViewport.height, 2_500_000); // ~2.5 MP
        // but also allow devicePixelRatio (optional)
        const deviceScale = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
        const scale = Math.min(3, safeScale * Math.min(2, deviceScale));

        const viewport = page.getViewport({ scale });

        // create canvas
        const canvas = document.createElement("canvas");
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);

        const context = canvas.getContext("2d");
        if (!context) {
            return { imageUrl: "", file: null, error: "Failed to get 2D canvas context" };
        }

        // optional: clear background for white pages
        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, canvas.width, canvas.height);

        context.imageSmoothingEnabled = true;
        // imageSmoothingQuality accepts 'low'|'medium'|'high' in some browsers
        // @ts-ignore
        if ("imageSmoothingQuality" in context) context.imageSmoothingQuality = "high";

        const renderTask = page.render({ canvasContext: context, viewport });

        // wait for rendering
        await renderTask.promise;

        // create blob
        const blob: Blob | null = await new Promise((resolve) => {
            canvas.toBlob((b) => resolve(b), "image/png", 1.0);
        });

        if (!blob) {
            return { imageUrl: "", file: null, error: "Failed to create image blob from canvas" };
        }

        const originalName = file.name.replace(/\.pdf$/i, "");
        const imageFile = new File([blob], `${originalName}.png`, { type: "image/png" });
        const imageUrl = URL.createObjectURL(blob);

        return { imageUrl, file: imageFile };
    } catch (err: any) {
        console.error("convertPdfToImage error:", err);
        // provide the message for debugging
        return { imageUrl: "", file: null, error: `Failed to convert PDF: ${err?.message || String(err)}` };
    }
}
