"use client";

import dynamic from "next/dynamic";
import type { ReactNode } from "react";
import { BarChart3, TrendingUp } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { DataExplorerProps } from "@/components/dashboard/data-explorer";
import type { InsightInfographicsProps } from "@/components/dashboard/insight-infographics";

const InsightInfographicsView = dynamic(
    () => import("@/components/dashboard/insight-infographics").then((mod) => mod.InsightInfographics),
    {
        ssr: false,
        loading: () => (
            <DashboardChartsShell
                title="Loading Insight Infographics"
                description="Charts are deferred so low-bandwidth sessions can stay interactive first."
                icon={<TrendingUp className="h-5 w-5 text-primary" />}
                heightClassName="h-[520px]"
            />
        ),
    }
);

const DataExplorerView = dynamic(
    () => import("@/components/dashboard/data-explorer").then((mod) => mod.DataExplorer),
    {
        ssr: false,
        loading: () => (
            <DashboardChartsShell
                title="Loading Intelligence Hub"
                description="Heavy chart bundles hydrate after the workspace shell is ready."
                icon={<BarChart3 className="h-5 w-5 text-emerald-600" />}
                heightClassName="h-[450px]"
            />
        ),
    }
);

function DashboardChartsShell({
    title,
    description,
    icon,
    heightClassName,
}: {
    title: string;
    description: string;
    icon: ReactNode;
    heightClassName: string;
}) {
    return (
        <Card className="overflow-hidden border-slate-200 shadow-sm">
            <CardHeader className="border-b bg-muted/20">
                <CardTitle className="flex items-center gap-2 text-lg">
                    {icon}
                    {title}
                </CardTitle>
                <CardDescription>{description}</CardDescription>
            </CardHeader>
            <CardContent className={`space-y-4 p-6 ${heightClassName}`}>
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <Skeleton className="h-28 rounded-2xl" />
                    <Skeleton className="h-28 rounded-2xl" />
                    <Skeleton className="h-28 rounded-2xl" />
                    <Skeleton className="h-28 rounded-2xl" />
                </div>
                <Skeleton className="h-full rounded-2xl" />
            </CardContent>
        </Card>
    );
}

export function LazyInsightInfographics(props: InsightInfographicsProps) {
    return <InsightInfographicsView {...props} />;
}

export function LazyDataExplorer(props: DataExplorerProps) {
    return <DataExplorerView {...props} />;
}
