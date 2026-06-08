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

export class FileValidationError extends Error {
    status: number;

    constructor(message: string, status = 400) {
        super(message);
        this.name = "FileValidationError";
        this.status = status;
    }
}

function hasZipSignature(buffer: Buffer) {
    if (buffer.length < 4) return false;
    const signature = buffer.subarray(0, 4).toString("binary");
    return signature === "PK\u0003\u0004" || signature === "PK\u0005\u0006" || signature === "PK\u0007\u0008";
}

function looksLikeText(buffer: Buffer) {
    const sample = buffer.subarray(0, Math.min(buffer.length, 4096));
    return !sample.includes(0);
}

export function hasAllowedFileSignature(mimeType: string, buffer: Buffer) {
    if (buffer.length === 0) return false;

    switch (mimeType) {
        case "application/pdf":
            return buffer.subarray(0, 5).toString("ascii") === "%PDF-";
        case "image/png":
            return buffer.length >= 8
                && buffer[0] === 0x89
                && buffer[1] === 0x50
                && buffer[2] === 0x4e
                && buffer[3] === 0x47
                && buffer[4] === 0x0d
                && buffer[5] === 0x0a
                && buffer[6] === 0x1a
                && buffer[7] === 0x0a;
        case "image/jpeg":
        case "image/jpg":
            return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
        case "image/webp":
            return buffer.length >= 12
                && buffer.subarray(0, 4).toString("ascii") === "RIFF"
                && buffer.subarray(8, 12).toString("ascii") === "WEBP";
        case "application/zip":
        case "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
            return hasZipSignature(buffer);
        case "application/vnd.ms-excel":
            return hasZipSignature(buffer)
                || buffer.subarray(0, 8).equals(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]))
                || looksLikeText(buffer);
        case "text/csv":
        case "text/plain":
            return looksLikeText(buffer);
        default:
            return false;
    }
}

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
    options?: { allowedMimeTypes?: Set<string>; buffer?: Buffer },
): Promise<StoredFileResult> {
    const mimeType = resolveAllowedMimeType(file, options?.allowedMimeTypes || DEFAULT_STORABLE_MIME_TYPES);

    if (!mimeType) {
        throw new FileValidationError(`Unsupported file type: ${file.type || file.name}`, 400);
    }

    if (file.size <= 0) {
        throw new FileValidationError("File is empty", 400);
    }

    if (file.size > MAX_STORED_FILE_SIZE) {
        throw new FileValidationError(`File too large. Maximum size is ${MAX_STORED_FILE_SIZE / 1024 / 1024}MB`, 413);
    }

    const now = new Date();
    const year = now.getFullYear().toString();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const extension = EXTENSION_BY_MIME[mimeType] || "bin";
    const storedName = `${uuidv4()}.${extension}`;
    const buffer = options?.buffer ?? Buffer.from(await file.arrayBuffer());

    if (!hasAllowedFileSignature(mimeType, buffer)) {
        throw new FileValidationError("File content does not match the declared file type", 400);
    }

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
