
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

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
                        <p className="text-sm text-muted-foreground">Order ID: {order.id.slice(0, 8)}</p>
                    </div>
                    <div className="ml-auto font-medium">+₹{order.totalAmount}</div>
                </div>
            ))}
            {orders.length === 0 && (
                <p className="text-sm text-muted-foreground text-center">No recent orders.</p>
            )}
        </div>
    )
}
