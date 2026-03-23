export const SUPPORT_FAQS = [
    { q: 'How do I reset my password?', a: 'Contact your admin or use the password reset link on the login page. An email will be sent to your registered address from pma.axiom.support@gmail.com.' },
    { q: 'How do I import SAP data into Axiom?', a: 'Go to Admin → Import Data, upload your SAP-exported CSV file, preview the mapping, and confirm the import. Supported datasets include Suppliers, Parts, and Invoices.' },
    { q: 'How are currencies displayed?', a: 'Axiom automatically detects your country from your browser locale/timezone and displays amounts in your local currency (e.g. ₹ for India, € for Germany, $ for USA). You can also manually switch currencies using the toggle on analytics pages.' },
    { q: 'How do I add a new supplier?', a: 'Navigate to Suppliers → New Supplier. Fill in business details, tier level, risk scores, ESG metrics and save. You can then invite the supplier to access the Supplier Portal.' },
    { q: 'Who can access the Analytics dashboard?', a: 'The Analytics/Intelligence Hub is visible to admin users. Regular users can access spend insights, savings data, and their own order history.' },
    { q: 'What is the support contact email?', a: 'All support emails are handled through pma.axiom.support@gmail.com. Ticket replies will be sent to your registered email.' },
    { q: 'How does three-way matching work?', a: 'Axiom performs 3-way compliance matching by comparing the Purchase Order (PO), Goods Receipt, and Supplier Invoice. When all three match, the invoice is approved for payment. Discrepancies are flagged for review.' },
    { q: 'What are AI Agents and how do they work?', a: 'Axiom AI Agents are intelligent automated workflows for tasks like fraud detection, demand forecasting, and payment optimization. They run on scheduled intervals or can be triggered manually from the AI Agents dashboard.' },
    { q: 'How do I raise an internal requisition?', a: 'Navigate to Sourcing → Requisitions and click "New Request". Fill in the purpose, estimated amount, department, and justification. The request will be routed to the configured approvers.' },
    { q: 'What ticket ID format does Axiom use?', a: 'Support tickets follow the format PMA-YEAR-MONTH-SERIAL (e.g., PMA-2026-03-001). This ensures traceability and compliance across all documentation.' },
    { q: 'How do I access the Supplier Portal?', a: 'Suppliers are configured by the admin in User Management with the "supplier" role. Once configured, suppliers log in with their credentials and see only the Supplier Portal — their orders, documents, RFQs, and profile.' },
    { q: 'Can I export audit trail data?', a: 'Yes. Navigate to Admin → Audit Trail and click "Export Evidence (CSV)". The export includes 12 columns with timestamps, user details, action types, and compliance status for regulatory readiness.' },
] as const;

export function canManageSupportTickets(role?: string | null) {
    return role === 'admin';
}
