'use client'

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell,
    Legend
} from 'recharts'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'

const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#0088FE', '#00C49F', '#FFBB28'];

interface ChatMarkdownProps {
    content: string
}

export function ChatMarkdown({ content }: ChatMarkdownProps) {
    return (
        <div className="prose prose-sm dark:prose-invert max-w-none break-words">
            <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                    table: ({ children }) => (
                        <div className="my-4 overflow-x-auto rounded-lg border border-border bg-background/50 dark:bg-black/20 font-sans">
                            <table className="w-full text-left text-xs border-collapse">
                                {children}
                            </table>
                        </div>
                    ),
                    thead: ({ children }) => <thead className="bg-primary/5">{children}</thead>,
                    th: ({ children }) => <th className="p-2 font-bold border-b border-primary/10">{children}</th>,
                    td: ({ children }) => <td className="p-2 border-b border-primary/5 whitespace-nowrap">{children}</td>,
                    code: ({ node, inline, className, children, ...props }: any) => {
                        const match = /language-(\w+)/.exec(className || '')
                        const language = match ? match[1] : ''

                        if (!inline && language === 'json' && children) {
                            try {
                                const data = JSON.parse(String(children).replace(/\n/g, ""))
                                if (data.type === 'chart') {
                                    return <ChatChart config={data} />
                                }
                            } catch (e) {
                                // If invalid JSON, just render as code
                            }
                        }

                        return (
                            <code className={cn("bg-muted px-1 py-0.5 rounded text-xs break-all", className)} {...props}>
                                {children}
                            </code>
                        )
                    },
                    pre: ({ children }) => <pre className="bg-muted p-4 rounded-lg my-4 overflow-x-auto border border-primary/10">{children}</pre>,
                    p: ({ children }) => <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>,
                    ul: ({ children }) => <ul className="list-disc ml-4 mb-4 space-y-1">{children}</ul>,
                    ol: ({ children }) => <ol className="list-decimal ml-4 mb-4 space-y-1">{children}</ol>,
                }}
            >
                {content}
            </ReactMarkdown>
        </div>
    )
}

function ChatChart({ config }: { config: any }) {
    const { chartType, data, keys, xAxisKey } = config

    return (
        <Card className="my-4 p-4 bg-background/80 dark:bg-black/40 border-border shadow-sm">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-4 flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-primary" />
                {config.title || "AI Insight Visualization"}
            </h4>
            <div className="h-[250px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                    {chartType === 'bar' ? (
                        <BarChart data={data}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.05)" />
                            <XAxis
                                dataKey={xAxisKey}
                                fontSize={10}
                                tickLine={false}
                                axisLine={false}
                                tick={{ fill: '#888' }}
                            />
                            <YAxis
                                fontSize={10}
                                tickLine={false}
                                axisLine={false}
                                tick={{ fill: '#888' }}
                                tickFormatter={(val) => `₹${val}`}
                            />
                            <Tooltip
                                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                                cursor={{ fill: 'rgba(0,0,0,0.02)' }}
                            />
                            {keys.map((key: string, idx: number) => (
                                <Bar
                                    key={key}
                                    dataKey={key}
                                    fill={COLORS[idx % COLORS.length]}
                                    radius={[4, 4, 0, 0]}
                                    barSize={40}
                                />
                            ))}
                        </BarChart>
                    ) : (
                        <PieChart>
                            <Pie
                                data={data}
                                cx="50%"
                                cy="50%"
                                innerRadius={60}
                                outerRadius={80}
                                paddingAngle={5}
                                dataKey={keys[0]}
                                nameKey={xAxisKey}
                            >
                                {data.map((entry: any, index: number) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                            </Pie>
                            <Tooltip />
                            <Legend verticalAlign="bottom" height={36} fontSize={10} />
                        </PieChart>
                    )}
                </ResponsiveContainer>
            </div>
            {config.insight && (
                <p className="mt-4 text-[11px] text-muted-foreground italic border-t pt-3">
                    <strong>AI Observation:</strong> {config.insight}
                </p>
            )}
        </Card>
    )
}
