'use client';

export type StoredUploadResult = {
    success: true;
    url: string;
    filename: string;
    size: number;
    type: string;
};

export async function uploadFileToStorage(file: File): Promise<StoredUploadResult> {
    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
    });

    const payload = await response.json().catch(() => null);

    if (!response.ok || !payload?.success || !payload?.url) {
        throw new Error(payload?.error || "Upload failed");
    }

    return payload as StoredUploadResult;
}
