// Demo credentials shown on the login screens for recruiters testing the app.
// Edit these values (or set the matching VITE_DEMO_* env vars) to match the
// accounts you created in your backend/database.
export interface DemoAccount {
  label: string
  email: string
  password: string
}

export const demoAccounts: { customer: DemoAccount; admin: DemoAccount } = {
  customer: {
    label: 'Demo customer',
    email: import.meta.env.VITE_DEMO_CUSTOMER_EMAIL || 'demo@wallet.dev',
    password: import.meta.env.VITE_DEMO_CUSTOMER_PASSWORD || 'password123',
  },
  admin: {
    label: 'Demo admin',
    email: import.meta.env.VITE_DEMO_ADMIN_EMAIL || 'admin@wallet.dev',
    password: import.meta.env.VITE_DEMO_ADMIN_PASSWORD || 'password123',
  },
}
