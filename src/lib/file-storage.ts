import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { v4 as uuidv4 } from "uuid";

export const MAX_STORED_FILE_SIZE = 10 * 1024 * 1024;

export const DEFAULT_STORABLE_MIME_TYPES = new Set([
    "application/pdf",
    "image/png",
    "image/jpeg",
    "image/jpg",
    "image/webp",
    "text/csv",
    "text/plain",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/zip",
]);

const MIME_BY_EXTENSION: Record<string, string> = {
    pdf: "application/pdf",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    webp: "image/webp",
    csv: "text/csv",
    txt: "text/plain",
    xls: "application/vnd.ms-excel",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    zip: "application/zip",
};

const EXTENSION_BY_MIME: Record<string, string> = {
    "application/pdf": "pdf",
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/webp": "webp",
    "text/csv": "csv",
    "text/plain": "txt",
    "application/vnd.ms-excel": "xls",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
    "application/zip": "zip",
};

export type StoredFileResult = {
    url: string;
    filename: string;
    size: number;
    type: string;
};

export function inferMimeTypeFromName(fileName: string) {
    const extension = fileName.split(".").pop()?.toLowerCase();
    return extension ? MIME_BY_EXTENSION[extension] ?? null : null;
}

export function resolveAllowedMimeType(
    file: Pick<File, "name" | "type" | "size">,
    allowedMimeTypes: Set<string> = DEFAULT_STORABLE_MIME_TYPES,
) {
    const declaredType = file.type?.toLowerCase();
    if (declaredType && allowedMimeTypes.has(declaredType)) {
        return declaredType;
    }

    const inferredType = inferMimeTypeFromName(file.name);
    if (inferredType && allowedMimeTypes.has(inferredType)) {
        return inferredType;
    }

    return null;
}

export async function storeUploadedFile(
    file: File,
    options?: { allowedMimeTypes?: Set<string> },
): Promise<StoredFileResult> {
    const mimeType = resolveAllowedMimeType(file, options?.allowedMimeTypes || DEFAULT_STORABLE_MIME_TYPES);

    if (!mimeType) {
        throw new Error(`Unsupported file type: ${file.type || file.name}`);
    }

    if (file.size > MAX_STORED_FILE_SIZE) {
        throw new Error(`File too large. Maximum size is ${MAX_STORED_FILE_SIZE / 1024 / 1024}MB`);
    }

    const now = new Date();
    const year = now.getFullYear().toString();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const extension = EXTENSION_BY_MIME[mimeType] || "bin";
    const storedName = `${uuidv4()}.${extension}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    let url = `/uploads/${year}/${month}/${storedName}`;

    const azureConnectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
    const azureContainer = process.env.AZURE_STORAGE_CONTAINER || "axiom-docs";
    const shouldUseAzure = process.env.NODE_ENV === "production" || Boolean(azureConnectionString);

    if (shouldUseAzure) {
        if (!azureConnectionString) {
            throw new Error("File storage is not configured. Missing AZURE_STORAGE_CONNECTION_STRING.");
        }

        const { BlobServiceClient } = await import("@azure/storage-blob");
        const blobServiceClient = BlobServiceClient.fromConnectionString(azureConnectionString);
        const containerClient = blobServiceClient.getContainerClient(azureContainer);
        await containerClient.createIfNotExists();

        const blobPath = `${year}/${month}/${storedName}`;
        const blockBlobClient = containerClient.getBlockBlobClient(blobPath);
        await blockBlobClient.uploadData(buffer, {
            blobHTTPHeaders: {
                blobContentType: mimeType,
            },
        });

        url = blockBlobClient.url;
    } else {
        const uploadDir = path.join(process.cwd(), "public", "uploads", year, month);
        await mkdir(uploadDir, { recursive: true });
        await writeFile(path.join(uploadDir, storedName), buffer);
    }

    return {
        url,
        filename: file.name,
        size: file.size,
        type: mimeType,
    };
}
