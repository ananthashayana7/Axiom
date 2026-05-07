import packageJson from "../../package.json";

export type RuntimeVersionSnapshot = {
    version: string;
    label: string;
};

function trimBuildToken(value: string | undefined) {
    const token = value?.trim();
    return token && token.length > 0 ? token : null;
}

export function getRuntimeVersionSnapshot(): RuntimeVersionSnapshot {
    const packageVersion = trimBuildToken(packageJson.version) || "0.0.0";
    const buildToken = trimBuildToken(process.env.NEXT_PUBLIC_APP_VERSION)
        || trimBuildToken(process.env.VERCEL_GIT_COMMIT_SHA)
        || packageVersion;
    const shortBuildToken = buildToken.length > 12 ? buildToken.slice(0, 12) : buildToken;

    return {
        version: buildToken,
        label: buildToken === packageVersion
            ? `v${packageVersion}`
            : `v${packageVersion} - ${shortBuildToken}`,
    };
}
