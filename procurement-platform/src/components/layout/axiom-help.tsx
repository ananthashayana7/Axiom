"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { HelpCircle } from "lucide-react"

export function AxiomHelp() {
  const [open, setOpen] = useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" className="w-full justify-start text-sm font-medium hover:bg-accent px-3 py-2 h-10">
          <HelpCircle className="mr-2 h-4 w-4" />
          Help & Documentation
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">Axiom - How to Guide</DialogTitle>
          <DialogDescription>Complete documentation for using Axiom Procurement Platform</DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Getting Started */}
          <section>
            <h3 className="text-lg font-semibold mb-2">Getting Started</h3>
            <p className="text-sm text-muted-foreground mb-2">
              Axiom is an intelligent procurement platform designed to streamline supplier management, parts sourcing, and order management with AI-powered insights.
            </p>
          </section>

          {/* Dashboard */}
          <section>
            <h3 className="text-lg font-semibold mb-2">📊 Dashboard</h3>
            <ul className="text-sm space-y-2 text-muted-foreground">
              <li><strong>Overview:</strong> View your key procurement metrics including total tracked spend, verified suppliers, pending orders, and SKUs tracked.</li>
              <li><strong>Analytics Board:</strong> Monitor monthly spending trends and category-wise spend distribution with interactive charts.</li>
              <li><strong>Recent Activity:</strong> See your latest procurement orders and activities at a glance.</li>
              <li><strong>Download Data:</strong> Export dashboard data in multiple formats (CSV, HTML, Excel, JSON) with optional chart visualization.</li>
            </ul>
          </section>

          {/* Suppliers */}
          <section>
            <h3 className="text-lg font-semibold mb-2">👥 Suppliers</h3>
            <ul className="text-sm space-y-2 text-muted-foreground">
              <li><strong>View All Suppliers:</strong> Browse your complete supplier database with details and ratings.</li>
              <li><strong>Supplier Details:</strong> Click on any supplier to see contact information, performance metrics, and order history.</li>
              <li><strong>Verification Status:</strong> Track supplier verification status and compliance records.</li>
            </ul>
          </section>

          {/* Parts Catalog */}
          <section>
            <h3 className="text-lg font-semibold mb-2">📦 Parts Catalog</h3>
            <ul className="text-sm space-y-2 text-muted-foreground">
              <li><strong>Browse Parts:</strong> Search and filter through your parts inventory by category, SKU, or supplier.</li>
              <li><strong>Part Details:</strong> View specifications, pricing, and available suppliers for each part.</li>
              <li><strong>Quick Source:</strong> Identify best suppliers for specific parts based on price and ratings.</li>
            </ul>
          </section>

          {/* Orders */}
          <section>
            <h3 className="text-lg font-semibold mb-2">🛒 Orders & RFQ</h3>
            <ul className="text-sm space-y-2 text-muted-foreground">
              <li><strong>Create RFQ:</strong> Click "Create RFQ" to initiate a new Request for Quotation with multiple suppliers.</li>
              <li><strong>Manage Orders:</strong> Track all purchase orders, their status, and delivery timelines.</li>
              <li><strong>Order Details:</strong> View order history, invoicing, and payment status for each procurement.</li>
            </ul>
          </section>

          {/* Axiom Copilot */}
          <section>
            <h3 className="text-lg font-semibold mb-2">✨ Axiom Copilot (AI Assistant)</h3>
            <ul className="text-sm space-y-2 text-muted-foreground">
              <li><strong>Smart Insights:</strong> Get AI-powered recommendations for supplier selection and cost optimization.</li>
              <li><strong>Procurement Assistance:</strong> Ask questions about suppliers, parts, and orders - Axiom provides intelligent answers.</li>
              <li><strong>Analytics Interpretation:</strong> Understand spending patterns and trends with AI-driven analysis.</li>
            </ul>
          </section>

          {/* Admin Features */}
          <section>
            <h3 className="text-lg font-semibold mb-2">⚙️ Admin Panel (Admin Only)</h3>
            <ul className="text-sm space-y-2 text-muted-foreground">
              <li><strong>User Management:</strong> Create, edit, and manage user accounts and roles.</li>
              <li><strong>Permissions:</strong> Control user access levels and assign appropriate roles (Admin, User).</li>
            </ul>
          </section>

          {/* Tips & Tricks */}
          <section>
            <h3 className="text-lg font-semibold mb-2">💡 Tips & Tricks</h3>
            <ul className="text-sm space-y-2 text-muted-foreground">
              <li>Export your data regularly using the <strong>Download</strong> button for reporting and analysis.</li>
              <li>Check the <strong>Axiom Copilot</strong> for AI-powered insights on your procurement strategy.</li>
              <li>Keep your supplier information updated for accurate RFQ responses.</li>
              <li>Monitor the <strong>Analytics Board</strong> to identify cost-saving opportunities.</li>
            </ul>
          </section>

          {/* Support */}
          <section>
            <h3 className="text-lg font-semibold mb-2">📞 Need More Help?</h3>
            <p className="text-sm text-muted-foreground">
              For additional support, contact your procurement administrator or visit our documentation portal.
            </p>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  )
}
