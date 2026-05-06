import { auth } from "@/auth";
import { getSupplierWorkspaceRows } from "@/app/actions/suppliers";
import { SuppliersWorkspace } from "@/components/suppliers/suppliers-workspace";
import { canManageSuppliers } from "@/lib/rbac";

export const dynamic = "force-dynamic";

export default async function SuppliersPage() {
    const session = await auth();
    const initialRows = await getSupplierWorkspaceRows();
    const canManage = canManageSuppliers(session?.user);

    return (
        <SuppliersWorkspace
            initialRows={initialRows}
            canManage={canManage}
        />
    );
}
