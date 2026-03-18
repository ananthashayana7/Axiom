'use client'

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { PieChart as PieChartIcon, BarChart3 } from "lucide-react";

const STATUS_COLORS: Record<string, string> = { active: '#10b981', expired: '#ef4444', draft: '#94a3b8', terminated: '#6b7280' };
const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'];

interface ContractChartsProps {
    contracts: { status?: string; type?: string; value?: string | number; supplier?: { name?: string } | { name?: string }[] }[];
}

export function ContractCharts({ contracts }: ContractChartsProps) {
    if (contracts.length === 0) return null;

    // Status distribution
    const statusData = Object.entries(
        contracts.reduce((acc: Record<string, number>, c) => {
            const s = c.status || 'draft';
            acc[s] = (acc[s] || 0) + 1;
            return acc;
        }, {})
    ).map(([name, value]) => ({
        name: name.charAt(0).toUpperCase() + name.slice(1),
        value,
        fill: STATUS_COLORS[name] || '#94a3b8',
    }));

    // Value by type
    const typeData = Object.entries(
        contracts.reduce((acc: Record<string, number>, c) => {
            const t = (c.type || 'other').replace(/_/g, ' ');
            acc[t] = (acc[t] || 0) + (Number(c.value) || 0);
            return acc;
        }, {})
    ).map(([name, value]) => ({ name: name.charAt(0).toUpperCase() + name.slice(1), value })).sort((a, b) => b.value - a.value);

    return (
        <div className="grid gap-4 md:grid-cols-2">
            {/* Status Distribution */}
            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                        <PieChartIcon className="h-4 w-4 text-primary" /> Contract Status
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <ResponsiveContainer width="100%" height={220}>
                        <PieChart>
                            <Pie data={statusData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" paddingAngle={3}
                                label={({ name, value }) => `${name} (${value})`}>
                                {statusData.map((entry, idx) => <Cell key={idx} fill={entry.fill} />)}
                            </Pie>
                            <Tooltip />
                        </PieChart>
                    </ResponsiveContainer>
                </CardContent>
            </Card>

            {/* Value by Type */}
            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                        <BarChart3 className="h-4 w-4 text-primary" /> Value by Contract Type
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <ResponsiveContainer width="100%" height={220}>
                        <BarChart data={typeData} margin={{ left: 0, right: 16 }}>
                            <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                            <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                            <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => v >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `${(v / 1e3).toFixed(0)}K` : String(v)} />
                            <Tooltip formatter={(v: any) => Number(v).toLocaleString()} />
                            <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                                {typeData.map((_, idx) => <Cell key={idx} fill={COLORS[idx % COLORS.length]} />)}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </CardContent>
            </Card>
        </div>
    );
}
