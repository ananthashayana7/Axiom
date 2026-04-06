
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { formatCurrency } from "@/lib/utils/currency"

export function RecentProcurements({ orders }: { orders: any[] }) {
    return (
        <div className="space-y-8">
            {orders.map((order) => (
                <div key={order.id} className="flex items-center">
                    <Avatar className="h-9 w-9">
                        <AvatarFallback>{order.supplier.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div className="ml-4 space-y-1">
                        <p className="text-sm font-medium leading-none">{order.supplier.name}</p>
                        <p className="text-sm text-muted-foreground">Order ID: {order.id.replace(/-/g, '').slice(0, 6).toUpperCase()}</p>
                        {order.amountUnavailable && order.sourceReference && (
                            <p className="text-xs font-medium uppercase tracking-wide text-amber-700">Legacy source RFQ {order.sourceReference}</p>
                        )}
                    </div>
                    <div className="ml-auto text-right font-medium">
                        {order.amountUnavailable ? (
                            <span className="text-xs font-semibold uppercase tracking-wide text-amber-700">Pending reconciliation</span>
                        ) : (
                            formatCurrency(order.totalAmount)
                        )}
                    </div>
                </div>
            ))}
            {orders.length === 0 && (
                <p className="text-sm text-muted-foreground text-center">No recent orders.</p>
            )}
        </div>
    )
}
