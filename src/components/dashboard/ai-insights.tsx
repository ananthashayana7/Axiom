"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Sparkles, Loader } from "lucide-react"
import { analyzeSpend } from "@/app/actions/ai"

export function AiInsights() {
    const [analysis, setAnalysis] = useState<any>(null)
    const [loading, setLoading] = useState(false)

    const handleAnalyze = async () => {
        setLoading(true)
        const result = await analyzeSpend()
        setAnalysis(result)
        setLoading(false)
    }

    useEffect(() => {
        handleAnalyze()
    }, [])

    return (
        <Card className="border-primary/10 bg-primary/5">
            <CardHeader>
                <div className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-primary" />
                    <CardTitle>AI Procurement Intelligence</CardTitle>
                </div>
                <CardDescription>
                    Real-time analysis of your spend data and risks.
                </CardDescription>
            </CardHeader>
            <CardContent>
                {!analysis && (
                    <div className="flex flex-col items-center justify-center py-6 text-center">
                        <p className="text-sm text-muted-foreground mb-4 font-medium animate-pulse">
                            Initializing AI Procurement Intelligence...
                        </p>
                    </div>
                )}

                {analysis && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
                        <div className="rounded-lg bg-background p-4 shadow-sm border border-border">
                            <p className="font-medium text-sm text-foreground mb-2">Analysis Summary</p>
                            <p className="text-sm text-muted-foreground">{analysis.summary}</p>
                        </div>

                        <div className="rounded-lg bg-green-500/5 p-4 border border-green-500/20">
                            <div className="flex justify-between items-center mb-2">
                                <p className="font-medium text-sm text-green-600 dark:text-green-400">Potential Savings</p>
                                <span className="font-bold text-green-600 dark:text-green-400 text-lg">₹{analysis.savingsPotential.toLocaleString()}</span>
                            </div>
                        </div>

                        <div>
                            <p className="font-medium text-sm mb-2">Recommendations</p>
                            <ul className="list-disc pl-4 space-y-1">
                                {analysis.recommendations.map((rec: string, i: number) => (
                                    <li key={i} className="text-sm text-muted-foreground">{rec}</li>
                                ))}
                            </ul>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card >
    )
}
