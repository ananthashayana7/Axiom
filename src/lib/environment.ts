export type EnvironmentStatus = {
    label: string;
    tone: 'emerald' | 'amber' | 'blue' | 'rose';
    description: string;
};

export function getEnvironmentStatus(): EnvironmentStatus {
    const appEnv = (
        process.env.APP_ENV ||
        process.env.VERCEL_ENV ||
        process.env.NODE_ENV ||
        'development'
    ).toLowerCase();

    if (process.env.ALLOW_DEMO_BYPASS === 'true') {
        return {
            label: 'DEMO BYPASS',
            tone: 'amber',
            description: 'Security bypass is enabled. Treat this workspace as demo-only.',
        };
    }

    if (appEnv === 'production') {
        return {
            label: 'PRODUCTION',
            tone: 'rose',
            description: 'Live workspace. Changes affect operational data and audit posture.',
        };
    }

    if (appEnv === 'staging' || appEnv === 'preview') {
        return {
            label: 'STAGING',
            tone: 'blue',
            description: 'Pre-production workspace for validation, demos, and release checks.',
        };
    }

    return {
        label: 'DEVELOPMENT',
        tone: 'emerald',
        description: 'Local workspace for implementation, experiments, and safe testing.',
    };
}
