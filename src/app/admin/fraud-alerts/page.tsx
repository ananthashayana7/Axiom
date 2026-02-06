import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getOpenFraudAlerts } from "@/app/actions/agents/fraud-detection";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
    Shield,
    AlertTriangle,
    CheckCircle2,
    Clock,
    FileText,
    Building2,
    Banknote
} from "lucide-react";

const severityColors = {
    critical: 'bg-red-100 text-red-700 border-red-300',
    high: 'bg-orange-100 text-orange-700 border-orange-300',
    medium: 'bg-amber-100 text-amber-700 border-amber-300',
    low: 'bg-blue-100 text-blue-700 border-blue-300'
};

const alertTypeLabels: Record<string, string> = {
    'duplicate_invoice': 'Duplicate Invoice',
    'unusual_amount': 'Unusual Amount',
    'new_vendor_high_value': 'New Vendor High-Value',
    'round_number_pattern': 'Round Number Pattern',
    'segregation_violation': 'Segregation of Duties'
};

export default async function FraudAlertsPage() {
    const session = await auth();
    if (!session?.user || (session.user as { role: string }).role !== 'admin') {
        redirect('/');
    }

    const alerts = await getOpenFraudAlerts();

    const criticalCount = alerts.filter(a => a.severity === 'critical').length;
    const highCount = alerts.filter(a => a.severity === 'high').length;

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg bg-red-100 flex items-center justify-center">
                            <Shield className="h-5 w-5 text-red-600" />
                        </div>
                        Fraud Detection Alerts
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        AI-detected anomalies requiring investigation
                    </p>
                </div>
                <div className="flex gap-3">
                    <div className="text-center px-4 py-2 rounded-lg bg-red-50 border border-red-200">
                        <p className="text-2xl font-bold text-red-600">{criticalCount}</p>
                        <p className="text-xs text-red-500">Critical</p>
                    </div>
                    <div className="text-center px-4 py-2 rounded-lg bg-orange-50 border border-orange-200">
                        <p className="text-2xl font-bold text-orange-600">{highCount}</p>
                        <p className="text-xs text-orange-500">High</p>
                    </div>
                    <div className="text-center px-4 py-2 rounded-lg bg-stone-50 border border-stone-200">
                        <p className="text-2xl font-bold text-stone-600">{alerts.length}</p>
                        <p className="text-xs text-stone-500">Total</p>
                    </div>
                </div>
            </div>

            {/* Alerts List */}
            {alerts.length === 0 ? (
                <Card className="bg-emerald-50 border-emerald-200">
                    <CardContent className="pt-6 text-center">
                        <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto mb-4" />
                        <h3 className="text-lg font-semibold text-emerald-700">All Clear!</h3>
                        <p className="text-emerald-600 text-sm">
                            No fraud alerts detected. Your transactions look healthy.
                        </p>
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-4">
                    {alerts.map((alert) => (
                        <Card key={alert.id} className="hover:shadow-md transition-shadow">
                            <CardHeader className="pb-3">
                                <div className="flex items-start justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${alert.severity === 'critical' ? 'bg-red-100' :
                                                alert.severity === 'high' ? 'bg-orange-100' : 'bg-amber-100'
                                            }`}>
                                            <AlertTriangle className={`h-5 w-5 ${alert.severity === 'critical' ? 'text-red-600' :
                                                    alert.severity === 'high' ? 'text-orange-600' : 'text-amber-600'
                                                }`} />
                                        </div>
                                        <div>
                                            <CardTitle className="text-base">
                                                {alertTypeLabels[alert.alertType] || alert.alertType}
                                            </CardTitle>
                                            <div className="flex items-center gap-2 mt-1">
                                                <Badge
                                                    variant="outline"
                                                    className={severityColors[alert.severity as keyof typeof severityColors]}
                                                >
                                                    {alert.severity.toUpperCase()}
                                                </Badge>
                                                <span className="text-xs text-muted-foreground flex items-center gap-1">
                                                    <Clock className="h-3 w-3" />
                                                    {alert.createdAt ? new Date(alert.createdAt).toLocaleDateString() : 'Recently'}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    <Badge variant="outline" className="text-xs">
                                        {alert.entityType === 'invoice' && <FileText className="h-3 w-3 mr-1" />}
                                        {alert.entityType === 'order' && <Banknote className="h-3 w-3 mr-1" />}
                                        {alert.entityType === 'supplier' && <Building2 className="h-3 w-3 mr-1" />}
                                        {alert.entityType}
                                    </Badge>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                <p className="text-sm text-stone-600">{alert.description}</p>

                                {alert.indicators && alert.indicators.length > 0 && (
                                    <div className="bg-stone-50 rounded-lg p-3">
                                        <p className="text-xs font-semibold text-stone-500 uppercase mb-2">Indicators</p>
                                        <ul className="space-y-1">
                                            {alert.indicators.map((indicator: string, i: number) => (
                                                <li key={i} className="text-xs text-stone-600 flex items-start gap-2">
                                                    <span className="text-red-400">•</span>
                                                    {indicator}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}

                                {alert.suggestedAction && (
                                    <div className="bg-blue-50 rounded-lg p-3 border border-blue-100">
                                        <p className="text-xs font-semibold text-blue-600 uppercase mb-1">Suggested Action</p>
                                        <p className="text-sm text-blue-700">{alert.suggestedAction}</p>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}
