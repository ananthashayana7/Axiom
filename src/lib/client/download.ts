'use client';

import { buildCsv } from "@/lib/csv";

function triggerDownload(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.style.visibility = "hidden";
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
}

export function downloadCsvFile(filename: string, rows: Array<Array<unknown>>) {
    const blob = new Blob([buildCsv(rows)], { type: "text/csv;charset=utf-8;" });
    triggerDownload(blob, filename);
}

export function openOrDownloadFile(url: string, filename?: string) {
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.target = "_blank";
    anchor.rel = "noreferrer noopener";
    if (filename) {
        anchor.download = filename;
    }
    anchor.style.visibility = "hidden";
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
}
