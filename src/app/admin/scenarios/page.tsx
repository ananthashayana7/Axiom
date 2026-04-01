'use client'

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import {
    BarChart3,
    TrendingUp,
    TrendingDown,
    Zap,
    Play,
    RotateCcw,
    Plus,
    Target,
    AlertTriangle,
    CheckCircle2,
    ArrowRight
} from "lucide-react";
import { runScenarioAnalysis } from "@/app/actions/agents/scenario-modeling";
import { toast } from "sonner";

type ScenarioOutcome = {
    metric: string;
    currentValue: string;
    projectedValue: string;
    impact: 'positive' | 'negative' | string;
    changePercent: number;
};

type ScenarioResult = {
    scenarioId: string;
    title: string;
    description: string;
    confidenceScore: number;
    overallImpact: string;
    outcomes: ScenarioOutcome[];
    recommendations: string[];
    riskFactors: string[];
};

type ScenarioInput = {
    scenarioType: string;
    title?: string;
    description: string;
    parameters: {
        percentChange: number;
        volumeShift?: number;
    };
};

export default function ScenarioModelingPage() {
    const [scenarios, setScenarios] = useState<ScenarioResult[]>([]);
    const [isSimulating, setIsSimulating] = useState(false);
    const [params, setParams] = useState<{ percentChange: number; volumeShift: number }>({
        percentChange: 10,
        volumeShift: 20
    });

    const handleRunSimulation = async (template?: ScenarioInput) => {
        setIsSimulating(true);
        const scenarioInput: ScenarioInput = template || {
            scenarioType: 'price_change',
            description: `Simulating a ${params.percentChange}% price fluctuation across key categories.`,
            parameters: params
        };

        try {
            const result = await runScenarioAnalysis(scenarioInput);
            if (result.success && result.data) {
                setScenarios([result.data, ...scenarios]);
                toast.success("Simulation Complete", {
                    description: `Scenario "${result.data.title}" has been modeled successfully.`
                });
            }
        } catch (_error) {
            toast.error("Simulation Failed", {
                description: "AI engine encountered an error during Monte Carlo simulation."
            });
        } finally {
            setIsSimulating(false);
        }
    };

    const getImpactColor = (impact: string) => {
        if (impact.includes('positive')) return 'text-emerald-600';
        if (impact.includes('negative')) return 'text-red-600';
        return 'text-amber-600';
    };

    return (
        <div className="p-4 lg:p-8 space-y-8 bg-stone-50/50 min-h-full">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-black tracking-tighter text-stone-900 uppercase flex items-center gap-3">
                        <BarChart3 className="h-8 w-8 text-indigo-600" />
                        Scenario Modeling Engine
                    </h1>
                    <p className="text-sm text-stone-500 font-bold uppercase tracking-widest mt-1">
                        Predictive &ldquo;What-If&rdquo; Intelligence & Impact Simulation
                    </p>
                </div>
                <div className="flex items-center gap-3 font-mono text-xs">
                    <Badge variant="outline" className="bg-white">AI ENGINE: v2.4.0</Badge>
                    <Badge variant="outline" className="bg-white">MODE: STOCHASTIC</Badge>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Control Panel */}
                <div className="lg:col-span-4 space-y-6">
                    <Card className="border-2 border-indigo-100 shadow-sm overflow-hidden">
                        <CardHeader className="bg-indigo-50/50 border-b">
                            <CardTitle className="text-lg flex items-center gap-2">
                                <Zap className="h-5 w-5 text-indigo-600" />
                                Simulation Controls
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-6 space-y-6">
                            <div className="space-y-4">
                                <label className="text-xs font-black uppercase text-stone-500 tracking-wider">Price Variance (%)</label>
                                <div className="flex items-center gap-4">
                                    <Slider
                                        value={[params.percentChange]}
                                        onValueChange={([v]) => setParams({ ...params, percentChange: v })}
                                        max={50}
                                        min={-50}
                                        step={1}
                                        className="flex-1"
                                    />
                                    <span className={`w-12 text-center font-mono font-bold ${params.percentChange > 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                                        {params.percentChange > 0 ? '+' : ''}{params.percentChange}%
                                    </span>
                                </div>
                            </div>

                            <div className="space-y-4 font-mono text-[10px] bg-stone-50 p-4 rounded-lg border">
                                <p className="text-stone-400">ENGINE.LOG // SIM_PARAMS_INDEXED</p>
                                <ul className="space-y-1 text-stone-600">
                                    <li>MODE: Price Sensitivity Analysis</li>
                                    <li>ALPHA: 0.95 (Confidence Interval)</li>
                                    <li>DATASET: Active POs - Lookback 12M</li>
                                </ul>
                            </div>

                            <Button
                                className="w-full h-12 bg-indigo-600 hover:bg-indigo-700 font-bold gap-2"
                                onClick={() => handleRunSimulation()}
                                disabled={isSimulating}
                            >
                                {isSimulating ? <RotateCcw className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                                {isSimulating ? "Running Simulation..." : "Execute Analysis"}
                            </Button>
                        </CardContent>
                    </Card>

                    <Card className="shadow-none border-dashed">
                        <CardHeader>
                            <CardTitle className="text-xs font-black text-stone-400 uppercase tracking-widest">Pre-built Templates</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                            {[
                                { id: 's1', title: 'Global Inflation Peak', change: 15 },
                                { id: 's2', title: 'Supplier Bankruptcy Fallback', change: -5 },
                                { id: 's3', title: 'Energy Crisis Delta', change: 25 }
                            ].map(t => (
                                <button
                                    key={t.id}
                                    onClick={() => {
                                        setParams({ ...params, percentChange: t.change });
                                        handleRunSimulation({
                                            scenarioType: 'price_change',
                                            title: t.title,
                                            description: `Simulating ${t.title} scenario.`,
                                            parameters: { percentChange: t.change }
                                        });
                                    }}
                                    className="w-full text-left p-3 rounded-md hover:bg-white hover:shadow-sm border border-transparent hover:border-indigo-100 transition-all group flex items-center justify-between"
                                >
                                    <span className="text-sm font-semibold text-stone-700 group-hover:text-indigo-600">{t.title}</span>
                                    <Plus className="h-3 w-3 text-stone-300 group-hover:text-indigo-400" />
                                </button>
                            ))}
                        </CardContent>
                    </Card>
                </div>

                {/* Results Panel */}
                <div className="lg:col-span-8 space-y-6">
                    {scenarios.length === 0 ? (
                        <div className="h-[400px] flex flex-col items-center justify-center border-2 border-dashed rounded-3xl bg-white/50 text-center p-12">
                            <div className="h-20 w-20 bg-indigo-50 flex items-center justify-center rounded-full mb-6">
                                <Target className="h-10 w-10 text-indigo-400 opacity-50" />
                            </div>
                            <h3 className="text-xl font-bold text-stone-800">No Active Simulations</h3>
                            <p className="text-stone-500 max-w-sm mt-2">
                                Adjust parameters on the left and execute to see how market shifts affect your procurement strategy.
                            </p>
                        </div>
                    ) : (
                        scenarios.map((scenario, idx) => (
                            <Card key={scenario.scenarioId} className={`border-2 animate-in fade-in slide-in-from-right-4 duration-500 ${idx === 0 ? 'border-indigo-500 shadow-xl' : 'opacity-80'}`}>
                                <CardHeader className="pb-4 border-b">
                                    <div className="flex items-start justify-between">
                                        <div>
                                            <div className="flex items-center gap-2 mb-1">
                                                <Badge className={getImpactColor(scenario.overallImpact)} variant="outline">
                                                    {scenario.overallImpact.replace('_', ' ').toUpperCase()}
                                                </Badge>
                                                <span className="text-[10px] font-mono text-stone-400">ID: {scenario.scenarioId}</span>
                                            </div>
                                            <CardTitle className="text-2xl font-black">{scenario.title}</CardTitle>
                                            <CardDescription className="text-stone-600 font-medium">{scenario.description}</CardDescription>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-xs font-black text-stone-400 uppercase tracking-widest">Confidence</p>
                                            <p className="text-2xl font-black text-indigo-600">{scenario.confidenceScore}%</p>
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent className="pt-6">
                                    <div className="grid md:grid-cols-2 gap-8">
                                        <div className="space-y-6">
                                            <h4 className="text-xs font-black text-stone-400 uppercase tracking-widest">Projected Outcomes</h4>
                                            <div className="space-y-4">
                                                {scenario.outcomes.map((outcome, i: number) => (
                                                    <div key={i} className="flex items-center justify-between p-4 bg-stone-50 rounded-xl border">
                                                        <div>
                                                            <p className="text-[10px] font-black text-stone-400 uppercase mb-1">{outcome.metric}</p>
                                                            <div className="flex items-center gap-3">
                                                                <span className="text-sm font-bold text-stone-500 line-through">{outcome.currentValue}</span>
                                                                <ArrowRight className="h-3 w-3 text-stone-300" />
                                                                <span className="text-base font-black text-stone-900">{outcome.projectedValue}</span>
                                                            </div>
                                                        </div>
                                                        <div className={`text-right ${outcome.impact === 'positive' ? 'text-emerald-600' : 'text-red-600'}`}>
                                                            <span className="text-xs font-black">{outcome.changePercent}%</span>
                                                            {outcome.impact === 'positive' ? <TrendingDown className="h-4 w-4 ml-1 inline" /> : <TrendingUp className="h-4 w-4 ml-1 inline" />}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="space-y-6">
                                            <div className="bg-indigo-900 text-white p-6 rounded-2xl shadow-inner relative overflow-hidden">
                                                <Zap className="absolute -right-4 -bottom-4 h-24 w-24 text-white/5 rotate-12" />
                                                <h4 className="text-xs font-black text-indigo-300 uppercase tracking-widest mb-4">AI Recommendations</h4>
                                                <ul className="space-y-3">
                                                    {scenario.recommendations.map((rec, i: number) => (
                                                        <li key={i} className="flex items-start gap-3 text-sm font-medium">
                                                            <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                                                            {rec}
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>

                                            <div className="p-4 rounded-2xl border-2 border-amber-100 bg-amber-50/50">
                                                <h4 className="text-xs font-black text-amber-600 uppercase tracking-widest mb-3 flex items-center gap-1">
                                                    <AlertTriangle className="h-3 w-3" /> Risk Factors
                                                </h4>
                                                <div className="flex flex-wrap gap-2">
                                                    {scenario.riskFactors.map((risk: string, i: number) => (
                                                        <Badge key={i} variant="secondary" className="bg-white border-amber-200 text-amber-700 text-[10px] font-bold">
                                                            {risk}
                                                        </Badge>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
