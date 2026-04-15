import { AssetLayout } from '../../layouts';

/** Asset management route — chrome and grid live in `AssetLayout`. */
export default function AssetManagementPage() {
  return (
    <div className="asset-management-page relative isolate flex min-h-screen w-full flex-1 flex-col">
      <AssetLayout />
    </div>
  );
}
