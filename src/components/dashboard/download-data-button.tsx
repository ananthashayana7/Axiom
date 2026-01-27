'use client';

import { Button } from "@/components/ui/button";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";

interface DownloadDataButtonProps {
    chartId: string;
    filename?: string;
}

export function DownloadDataButton({ chartId, filename = "chart-export" }: DownloadDataButtonProps) {
    const [isExporting, setIsExporting] = useState(false);

    const handleDownload = async () => {
        setIsExporting(true);
        try {
            const container = document.getElementById(chartId);
            if (!container) throw new Error("Chart container not found");

            const svgElement = container.querySelector("svg");
            if (!svgElement) throw new Error("Chart SVG not found");

            // 1. Serialize SVG
            const serializer = new XMLSerializer();
            const svgString = serializer.serializeToString(svgElement);

            // 2. Prepare Canvas
            const canvas = document.createElement("canvas");
            const ctx = canvas.getContext("2d");
            if (!ctx) throw new Error("Canvas context failed");

            // Set canvas size to match SVG (or high-res)
            const width = svgElement.clientWidth || 800;
            const height = svgElement.clientHeight || 400;
            canvas.width = width * 2; // 2x for Retina/High Res
            canvas.height = height * 2;
            ctx.scale(2, 2);

            // 3. Create Image from SVG
            const img = new Image();
            const svgBlob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
            const url = URL.createObjectURL(svgBlob);

            img.onload = () => {
                // Fill background white (charts are usually transparent)
                ctx.fillStyle = "#ffffff";
                ctx.fillRect(0, 0, width, height);

                // Draw SVG
                ctx.drawImage(img, 0, 0, width, height);

                // 4. Download
                const pngUrl = canvas.toDataURL("image/png");
                const downloadLink = document.createElement("a");
                downloadLink.href = pngUrl;
                downloadLink.download = `${filename}.png`;
                document.body.appendChild(downloadLink);
                downloadLink.click();
                document.body.removeChild(downloadLink);

                URL.revokeObjectURL(url);
                setIsExporting(false);
                toast.success("Chart exported as PNG!");
            };

            img.onerror = () => {
                throw new Error("Failed to load SVG image");
            };

            img.src = url;

        } catch (error) {
            console.error("Export failed:", error);
            toast.error("Failed to export chart image.");
            setIsExporting(false);
        }
    };

    return (
        <Button
            variant="outline"
            size="sm"
            onClick={handleDownload}
            disabled={isExporting}
            className="h-8 gap-2 border-border bg-background"
        >
            {isExporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
            <span className="hidden sm:inline">Export PNG</span>
        </Button>
    );
}
