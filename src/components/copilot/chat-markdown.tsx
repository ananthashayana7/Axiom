'use client'

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import {
    BarChart,
    Bar,
    LineChart,
    Line,
    AreaChart,
    Area,
    ScatterChart,
    Scatter,
    RadarChart,
    Radar,
    PolarGrid,
    PolarAngleAxis,
    PolarRadiusAxis,
    PieChart,
    Pie,
    Cell,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Legend
} from 'recharts'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'

const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#0088FE', '#00C49F', '#FFBB28', '#FF6B6B', '#4ECDC4'];

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

const CHART_TYPE_LABELS: Record<string, string> = {
    bar: 'Bar Chart',
    pie: 'Pie Chart',
    line: 'Line Chart',
    area: 'Area Chart',
    scatter: 'Scatter Plot',
    radar: 'Radar Chart',
}

function ChatChart({ config }: { config: any }) {
    const { chartType, data, keys, xAxisKey } = config

    const commonAxisProps = {
        fontSize: 10,
        tickLine: false as const,
        axisLine: false as const,
        tick: { fill: '#888' },
    }

    const tooltipStyle = {
        contentStyle: { borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' },
    }

    const renderChart = () => {
        switch (chartType) {
            case 'line':
                return (
                    <LineChart data={data}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.05)" />
                        <XAxis dataKey={xAxisKey} {...commonAxisProps} />
                        <YAxis {...commonAxisProps} />
                        <Tooltip {...tooltipStyle} />
                        <Legend verticalAlign="bottom" height={36} />
                        {keys.map((key: string, idx: number) => (
                            <Line
                                key={key}
                                type="monotone"
                                dataKey={key}
                                stroke={COLORS[idx % COLORS.length]}
                                strokeWidth={2}
                                dot={{ r: 4, fill: COLORS[idx % COLORS.length] }}
                                activeDot={{ r: 6 }}
                            />
                        ))}
                    </LineChart>
                )

            case 'area':
                return (
                    <AreaChart data={data}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.05)" />
                        <XAxis dataKey={xAxisKey} {...commonAxisProps} />
                        <YAxis {...commonAxisProps} />
                        <Tooltip {...tooltipStyle} />
                        <Legend verticalAlign="bottom" height={36} />
                        {keys.map((key: string, idx: number) => (
                            <Area
                                key={key}
                                type="monotone"
                                dataKey={key}
                                stroke={COLORS[idx % COLORS.length]}
                                fill={COLORS[idx % COLORS.length]}
                                fillOpacity={0.2}
                                strokeWidth={2}
                            />
                        ))}
                    </AreaChart>
                )

            case 'scatter':
                return (
                    <ScatterChart>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" />
                        <XAxis dataKey={xAxisKey || keys[0]} name={xAxisKey || keys[0]} {...commonAxisProps} />
                        <YAxis dataKey={keys[1] || keys[0]} name={keys[1] || keys[0]} {...commonAxisProps} />
                        <Tooltip {...tooltipStyle} cursor={{ strokeDasharray: '3 3' }} />
                        <Legend verticalAlign="bottom" height={36} />
                        <Scatter
                            name={config.title || 'Data'}
                            data={data}
                            fill={COLORS[0]}
                        >
                            {data.map((_entry: any, index: number) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                        </Scatter>
                    </ScatterChart>
                )

            case 'radar':
                return (
                    <RadarChart cx="50%" cy="50%" outerRadius="70%" data={data}>
                        <PolarGrid stroke="rgba(0,0,0,0.1)" />
                        <PolarAngleAxis dataKey={xAxisKey} fontSize={10} tick={{ fill: '#888' }} />
                        <PolarRadiusAxis fontSize={9} tick={{ fill: '#999' }} />
                        <Tooltip {...tooltipStyle} />
                        <Legend verticalAlign="bottom" height={36} />
                        {keys.map((key: string, idx: number) => (
                            <Radar
                                key={key}
                                name={key}
                                dataKey={key}
                                stroke={COLORS[idx % COLORS.length]}
                                fill={COLORS[idx % COLORS.length]}
                                fillOpacity={0.25}
                            />
                        ))}
                    </RadarChart>
                )

            case 'pie':
                return (
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
                            {data.map((_entry: any, index: number) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                        </Pie>
                        <Tooltip />
                        <Legend verticalAlign="bottom" height={36} />
                    </PieChart>
                )

            case 'bar':
            default:
                return (
                    <BarChart data={data}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.05)" />
                        <XAxis dataKey={xAxisKey} {...commonAxisProps} />
                        <YAxis {...commonAxisProps} tickFormatter={(val) => `₹${val}`} />
                        <Tooltip
                            {...tooltipStyle}
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
                )
        }
    }

    return (
        <Card className="my-4 p-4 bg-background/80 dark:bg-black/40 border-border shadow-sm">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-4 flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-primary" />
                {config.title || "AI Insight Visualization"}
                <span className="ml-auto text-[10px] font-medium text-muted-foreground/60 normal-case">
                    {CHART_TYPE_LABELS[chartType] || 'Chart'}
                </span>
            </h4>
            <div className="h-[280px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                    {renderChart()}
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
