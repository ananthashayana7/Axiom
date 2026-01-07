"use client"

import { useState } from "react"
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

    return (
        <Card className="border-indigo-100 bg-indigo-50/50 dark:bg-indigo-900/10 dark:border-indigo-900">
            <CardHeader>
                <div className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                    <CardTitle className="text-indigo-900 dark:text-indigo-100">AI Procurement Intelligence</CardTitle>
                </div>
                <CardDescription>
                    Real-time analysis of your spend data and risks.
                </CardDescription>
            </CardHeader>
            <CardContent>
                {!analysis && (
                    <div className="flex flex-col items-center justify-center py-6 text-center">
                        <p className="text-sm text-muted-foreground mb-4">
                            Generate insights to identify savings and optimize supplier performance.
                        </p>
                        <Button onClick={handleAnalyze} disabled={loading} className="bg-indigo-600 hover:bg-indigo-700 text-white">
                            {loading && <Loader className="mr-2 h-4 w-4 animate-spin" />}
                            Analyze Spend Data
                        </Button>
                    </div>
                )}

                {analysis && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
                        <div className="rounded-lg bg-white p-4 shadow-sm dark:bg-gray-800">
                            <p className="font-medium text-sm text-gray-900 dark:text-gray-100 mb-2">Analysis Summary</p>
                            <p className="text-sm text-muted-foreground">{analysis.summary}</p>
                        </div>

                        <div className="rounded-lg bg-green-50 p-4 border border-green-100 dark:bg-green-900/20 dark:border-green-900">
                            <div className="flex justify-between items-center mb-2">
                                <p className="font-medium text-sm text-green-900 dark:text-green-100">Potential Savings</p>
                                <span className="font-bold text-green-700 dark:text-green-300 text-lg">₹{analysis.savingsPotential.toLocaleString()}</span>
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
                        <Button variant="outline" size="sm" onClick={handleAnalyze} disabled={loading} className="w-full mt-2">
                            Refresh Analysis
                        </Button>
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
