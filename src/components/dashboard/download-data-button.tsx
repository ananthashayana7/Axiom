'use client';

import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";

interface DownloadDataButtonProps {
    data: any;
    filename?: string;
}

export function DownloadDataButton({ data, filename = "dashboard-data.json" }: DownloadDataButtonProps) {
    const handleDownload = () => {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    return (
        <Button variant="outline" onClick={handleDownload} className="gap-2">
            <Download className="h-4 w-4" />
            Download Data
        </Button>
    );
}
