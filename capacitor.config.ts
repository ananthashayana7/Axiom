import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.axiom.procurement',
  appName: 'Axiom Platform',
  webDir: 'public',
  server: {
    // IMPORTANT: For production, replace this with your actual hosted platform URL.
    url: 'https://axiom-procurement.example.com',
    cleartext: true
  }
};

export default config;
