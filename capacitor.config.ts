import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.axiom.procurement',
  appName: 'Axiom Platform',
  webDir: 'public',
  server: {
    // IMPORTANT: For production, replace this with your actual hosted platform URL.
    // Example: url: 'https://axiom-procurement.vercel.app',
    url: 'http://localhost:3000',
    cleartext: true
  }
};

export default config;
