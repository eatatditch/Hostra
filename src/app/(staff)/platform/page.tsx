"use client";

import { useState, useRef } from "react";
import { trpc } from "@/lib/trpc/client";
import { useLocation } from "@/components/dashboard/location-provider";
import { Card, CardHeader, CardTitle, Button, Input } from "@/components/ui";
import { HostOSLogo } from "@/components/ui/hostos-logo";
import { Trash2 } from "lucide-react";

export default function PlatformPage() {
  const { isPlatformAdmin, isLoading: locLoading } = useLocation();
  const { data: brand, isLoading } = trpc.table.getBrandSettings.useQuery();
  const updateMutation = trpc.table.updatePlatformLogo.useMutation();
  const utils = trpc.useUtils();
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (locLoading) {
    return (
      <div className="p-4 lg:p-6">
        <div className="h-64 bg-surface-alt rounded-xl animate-pulse" />
      </div>
    );
  }

  if (!isPlatformAdmin) {
    return (
      <div className="p-4 lg:p-6 text-center py-20">
        <h2 className="text-xl font-display font-bold text-ditch-charcoal">Access Restricted</h2>
        <p className="text-sm text-text-muted mt-2">Platform settings are only available to HostOS administrators.</p>
      </div>
    );
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadError("");
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("bucket", "brand-assets");
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) { setUploadError(data.error || "Upload failed"); return; }
      await updateMutation.mutateAsync({ platformLogoUrl: data.url });
      utils.table.getBrandSettings.invalidate();
    } catch { setUploadError("Upload failed."); }
    finally { setUploading(false); if (fileInputRef.current) fileInputRef.current.value = ""; }
  }

  async function handleRemove() {
    await updateMutation.mutateAsync({ platformLogoUrl: "" });
    utils.table.getBrandSettings.invalidate();
  }

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-3xl">
      <div>
        <div className="flex items-center gap-3 mb-1">
          <HostOSLogo height={28} />
          <span className="text-xs font-medium bg-primary/10 text-primary px-2 py-0.5 rounded-full">Platform Admin</span>
        </div>
        <p className="text-sm text-text-muted">
          Manage the HostOS platform. These settings are only visible to you.
        </p>
      </div>

      {/* Platform Logo */}
      <Card>
        <CardHeader>
          <CardTitle>Platform Logo</CardTitle>
        </CardHeader>
        {isLoading ? (
          <div className="h-16 bg-surface-alt rounded-lg animate-pulse" />
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-text-muted">
              This logo appears on the login page, admin sidebar, and the "Powered by" footer on all guest-facing pages.
            </p>

            {brand?.platform_logo_url ? (
              <div className="flex items-center gap-4 p-4 rounded-xl border border-border bg-surface-alt">
                <img src={brand.platform_logo_url} alt="HostOS" className="h-14 object-contain" />
                <div className="flex-1" />
                <Button variant="ghost" size="sm" onClick={() => fileInputRef.current?.click()} loading={uploading}>
                  Replace
                </Button>
                <Button variant="ghost" size="sm" onClick={handleRemove}>
                  <Trash2 className="h-3.5 w-3.5 text-status-error" />
                </Button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="w-full p-8 rounded-xl border-2 border-dashed border-primary/30 hover:border-primary transition-colors cursor-pointer text-center bg-primary/5"
              >
                {uploading ? (
                  <div className="flex items-center justify-center gap-2 text-sm text-text-muted">
                    <div className="h-4 w-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    Uploading...
                  </div>
                ) : (
                  <div>
                    <p className="text-sm font-semibold text-primary">Upload HostOS Logo</p>
                    <p className="text-xs text-text-muted mt-1">PNG, JPG, SVG, or WebP — Max 2MB</p>
                  </div>
                )}
              </button>
            )}
            <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" onChange={handleFileUpload} className="hidden" />
            {uploadError && <p className="text-sm text-status-error mt-1">{uploadError}</p>}

            {/* Preview */}
            <div className="space-y-3 pt-4 border-t border-border">
              <p className="text-xs font-semibold text-text-muted">Preview — how it appears:</p>
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-white rounded-lg border border-border p-3 text-center">
                  <p className="text-[10px] text-text-muted mb-2">Sidebar</p>
                  <HostOSLogo height={22} />
                </div>
                <div className="bg-white rounded-lg border border-border p-3 text-center">
                  <p className="text-[10px] text-text-muted mb-2">Login</p>
                  <HostOSLogo height={30} />
                </div>
                <div className="bg-surface-alt rounded-lg border border-border p-3 text-center">
                  <p className="text-[10px] text-text-muted mb-2">Footer</p>
                  <div className="flex items-center justify-center gap-1 opacity-30">
                    <span className="text-[8px]">Powered by</span>
                    <HostOSLogo height={10} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* Platform Info */}
      <Card>
        <CardHeader>
          <CardTitle>Platform Info</CardTitle>
        </CardHeader>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-text-muted">Platform</span>
            <span className="font-medium">HostOS</span>
          </div>
          <div className="flex justify-between">
            <span className="text-text-muted">Tagline</span>
            <span className="font-medium">Powered by GuestIQ</span>
          </div>
          <div className="flex justify-between">
            <span className="text-text-muted">Your Role</span>
            <span className="font-medium text-primary">Platform Owner</span>
          </div>
        </div>
      </Card>
    </div>
  );
}
